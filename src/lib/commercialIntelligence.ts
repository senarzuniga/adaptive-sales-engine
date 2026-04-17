import { buildPipelineMetrics, getProbabilityGuidance, getActivePipelineOpportunities, isOpportunityCoveredByOrder, normalizeOpportunityStatus, parseFlexibleNumber } from '@/lib/salesData';

export interface CommercialOrder {
  oppNumber?: string;
  customerName?: string;
  productFamily?: string;
  region?: string;
  sellingPrice?: number;
  margin?: number;
  kam?: string;
  truthSource?: string;
}

export interface CommercialOpportunity {
  oppNumber?: string;
  customerName?: string;
  productFamily?: string;
  region?: string;
  estRevenue?: number;
  contractProb?: number;
  margin?: number;
  status?: string;
  kam?: string;
  truthSource?: string;
}

export interface CommercialProduct {
  name?: string;
  averageValue?: number;
  type?: string;
  comments?: string;
}

export interface CommercialStrategy {
  productFamily?: string;
  region?: string;
  estRevenue?: number;
  margin?: number;
  kam?: string;
}

export interface CommercialLead {
  company?: string;
  region?: string;
  interest?: string;
  sector?: string;
  value?: number;
}

export interface CommercialAsset {
  customerName?: string;
  lifecycle_stage?: string;
  risk_level?: string;
}

export interface CommercialCompany {
  company_name?: string;
  industry?: string;
  main_customer_segments?: string;
  main_competitors?: string;
  strategic_goals?: string;
  market_context?: string;
  business_description?: string;
}

interface IntelligenceInput {
  company?: CommercialCompany;
  orders?: CommercialOrder[];
  opportunities?: CommercialOpportunity[];
  products?: CommercialProduct[];
  strategy?: CommercialStrategy[];
  leads?: CommercialLead[];
  assets?: CommercialAsset[];
}

const clean = (value: unknown) => String(value ?? '').trim();
const keyify = (value: unknown) => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const uniq = <T,>(values: T[]) => [...new Set(values)];

const getTier = (score: number) => (score >= 75 ? 'A' : score >= 50 ? 'B' : 'C');
const getPriority = (score: number) => (score >= 80 ? 'critical' : score >= 60 ? 'high' : score >= 40 ? 'medium' : 'low');
const getEffort = (score: number) => (score >= 80 ? 'high' : score >= 55 ? 'medium' : 'low');

function buildOfferKey(record: { oppNumber?: string; customerName?: string; productFamily?: string; region?: string }) {
  const opp = keyify(record.oppNumber);
  if (opp) return `opp:${opp}`;
  return `acct:${keyify(record.customerName)}|${keyify(record.productFamily)}|${keyify(record.region)}`;
}

export function harmonizeCommercialRecords(input: { orders?: CommercialOrder[]; opportunities?: CommercialOpportunity[] }) {
  const orders = (input.orders || []).map((order) => ({
    ...order,
    sellingPrice: parseFlexibleNumber(order.sellingPrice),
    margin: parseFlexibleNumber(order.margin),
    truthSource: clean(order.truthSource) || 'sales_document',
  }));

  const opportunityByKey = new Map<string, CommercialOpportunity>();
  const conflicts: string[] = [];

  (input.opportunities || []).forEach((opportunity) => {
    const contractProb = Math.max(0, Math.min(100, parseFlexibleNumber(opportunity.contractProb)));
    let status = normalizeOpportunityStatus(opportunity.status);
    if (contractProb >= 100) status = 'won';

    const normalized: CommercialOpportunity = {
      ...opportunity,
      estRevenue: parseFlexibleNumber(opportunity.estRevenue),
      contractProb,
      margin: parseFlexibleNumber(opportunity.margin),
      status,
      truthSource: clean(opportunity.truthSource) || 'sales_document',
    };

    const key = buildOfferKey(normalized);
    const existing = opportunityByKey.get(key);
    if (!existing) {
      opportunityByKey.set(key, normalized);
      return;
    }

    const incomingScore = (normalized.truthSource === 'sales_document' ? 3 : 1) + (normalized.contractProb || 0) / 100;
    const existingScore = (existing.truthSource === 'sales_document' ? 3 : 1) + (existing.contractProb || 0) / 100;

    if (incomingScore >= existingScore) {
      if ((existing.estRevenue || 0) > 0 && (normalized.estRevenue || 0) > 0 && Math.abs((existing.estRevenue || 0) - (normalized.estRevenue || 0)) > Math.max(5000, (existing.estRevenue || 0) * 0.25)) {
        conflicts.push(`Value mismatch for ${clean(normalized.customerName) || clean(normalized.oppNumber) || 'offer'} — document value prevailed.`);
      }
      opportunityByKey.set(key, normalized);
    }
  });

  const opportunities = Array.from(opportunityByKey.values()).map((opportunity) => {
    if (isOpportunityCoveredByOrder(opportunity, orders)) {
      const matchingOrder = orders.find((order) => buildOfferKey(order) === buildOfferKey(opportunity));
      return {
        ...opportunity,
        status: 'won',
        contractProb: 100,
        estRevenue: matchingOrder?.sellingPrice && matchingOrder.sellingPrice > 0 ? matchingOrder.sellingPrice : opportunity.estRevenue,
      };
    }
    return opportunity;
  });

  const metrics = buildPipelineMetrics({ opportunities, orders });
  const truthRulesApplied = [
    'Only sales documents define confirmed sales truth.',
    'Offers at 100% probability are force-classified as sold.',
    'Document values prevail over inferred values on conflicts.',
    'Open pipeline excludes already sold or covered opportunities.',
  ];

  return { orders, opportunities, metrics, conflicts: uniq(conflicts), truthRulesApplied };
}

export function buildCommercialIntelligence(input: IntelligenceInput) {
  const company = input.company || {};
  const leads = input.leads || [];
  const assets = input.assets || [];
  const strategy = input.strategy || [];
  const products = input.products || [];
  const harmonized = harmonizeCommercialRecords({ orders: input.orders, opportunities: input.opportunities });
  const orders = harmonized.orders;
  const opportunities = harmonized.opportunities;
  const activePipeline = getActivePipelineOpportunities(opportunities, orders);
  const soldRevenue = harmonized.metrics.soldRevenue;
  const weightedPipeline = harmonized.metrics.weightedOpenRevenue;
  const strategyTarget = strategy.reduce((sum, row) => sum + parseFlexibleNumber(row.estRevenue), 0);
  const strategyAchievement = strategyTarget > 0 ? ((soldRevenue + weightedPipeline) / strategyTarget) * 100 : 0;

  const customerNames = uniq([
    ...orders.map((item) => clean(item.customerName)),
    ...opportunities.map((item) => clean(item.customerName)),
    ...leads.map((item) => clean(item.company)),
    ...assets.map((item) => clean(item.customerName)),
  ].filter(Boolean));

  const keyAccounts = customerNames.map((customer) => {
    const accountOrders = orders.filter((item) => clean(item.customerName) === customer);
    const accountPipeline = activePipeline.filter((item) => clean(item.customerName) === customer);
    const accountAssets = assets.filter((item) => clean(item.customerName) === customer);
    const revenue = accountOrders.reduce((sum, item) => sum + parseFlexibleNumber(item.sellingPrice), 0);
    const pipeline = accountPipeline.reduce((sum, item) => sum + parseFlexibleNumber(item.estRevenue), 0);
    const marginPct = revenue > 0
      ? accountOrders.reduce((sum, item) => sum + parseFlexibleNumber(item.margin), 0) / revenue * 100
      : accountPipeline.reduce((sum, item) => sum + parseFlexibleNumber(item.margin), 0) / Math.max(pipeline, 1) * 100;
    const strategicImportance = Math.min(100, Math.round((revenue / Math.max(soldRevenue, 1)) * 60 + (pipeline > 0 ? 20 : 0) + (accountAssets.length > 0 ? 20 : 0)));
    const growthPotential = Math.min(100, Math.round((pipeline / Math.max(strategyTarget, 1)) * 100 + (accountPipeline.length > 0 ? 15 : 0)));
    const relationshipStrength = Math.min(100, Math.round((accountOrders.length * 15) + (accountAssets.length * 20) + (marginPct > 20 ? 15 : 0)));
    const score = Math.round(strategicImportance * 0.45 + growthPotential * 0.3 + relationshipStrength * 0.25);

    return {
      customer,
      revenue,
      pipeline,
      strategicImportance,
      growthPotential,
      relationshipStrength,
      score,
      tier: getTier(score),
    };
  }).sort((left, right) => right.score - left.score);

  const knownCompetitors = uniq([
    ...clean(company.main_competitors).split(',').map((value) => clean(value)),
    ...leads.flatMap((lead) => clean(lead.interest).match(/abb|siemens|schneider|rockwell|fanuc|kuka/ig) || []),
  ].filter(Boolean));

  const competitors = (knownCompetitors.length > 0 ? knownCompetitors : ['ABB', 'Siemens']).map((name, index) => ({
    name,
    focusProducts: uniq(products.slice(index, index + 2).map((product) => clean(product.name)).filter(Boolean)),
    pricePositioning: index % 2 === 0 ? 'premium-performance' : 'value-price',
    positioning: index % 2 === 0 ? 'High automation reliability and installed-base trust' : 'Strong value proposition for standardized projects',
    valueProposition: index % 2 === 0 ? 'Performance, service continuity, and engineering depth' : 'Competitive acquisition price and rapid rollout',
    competitiveGap: index % 2 === 0 ? 'Need stronger service bundles and lifecycle contracts' : 'Need differentiation beyond price',
  }));

  const productPortfolio = products.map((product) => {
    const name = clean(product.name);
    const revenue = orders.filter((item) => clean(item.productFamily) === name).reduce((sum, item) => sum + parseFlexibleNumber(item.sellingPrice), 0);
    const pipeline = activePipeline.filter((item) => clean(item.productFamily) === name).reduce((sum, item) => sum + parseFlexibleNumber(item.estRevenue), 0);
    const fitScore = Math.min(100, Math.round((revenue > 0 ? 40 : 10) + (pipeline > 0 ? 25 : 0) + (clean(product.comments).length > 10 ? 15 : 0) + (clean(company.main_customer_segments).length > 0 ? 20 : 0)));
    const alignmentScore = Math.min(100, Math.round(strategy.filter((item) => clean(item.productFamily) === name).reduce((sum, item) => sum + parseFlexibleNumber(item.estRevenue), 0) > 0 ? 85 : 45));
    const sectorClass = /innov/i.test(clean(product.type)) ? 'innovation' : /declin/i.test(clean(product.type)) ? 'decline' : 'commodity';
    const gapAnalysis = pipeline <= 0
      ? 'No active pipeline despite loaded product data — generate demand and account expansion actions.'
      : revenue <= 0
        ? 'Open pipeline exists but no confirmed sales yet — protect conversion discipline.'
        : 'Product is commercially active but should be benchmarked against competitor positioning.';

    return {
      name,
      revenue,
      pipeline,
      fitScore,
      sectorClass,
      alignmentScore,
      competitorCoverage: competitors.map((competitor) => competitor.name).join(', '),
      gapAnalysis,
    };
  });

  const segmentSeed = uniq([
    ...clean(company.main_customer_segments).split(',').map((value) => clean(value)),
    ...orders.map((item) => clean(item.region)),
    ...leads.map((lead) => clean(lead.region || lead.sector || lead.interest)),
  ].filter(Boolean));

  const marketSegments = segmentSeed.map((segment) => {
    const regionalOrders = orders.filter((item) => clean(item.region) === segment || clean(item.customerName).includes(segment.toLowerCase()));
    const regionalLeads = leads.filter((lead) => clean(lead.region) === segment || clean(lead.sector) === segment);
    const similarCompanies = uniq(regionalLeads.map((lead) => clean(lead.company)).filter(Boolean));
    return {
      segment,
      revenue: regionalOrders.reduce((sum, item) => sum + parseFlexibleNumber(item.sellingPrice), 0),
      leadCount: regionalLeads.length,
      similarCompanies,
      attractiveness: regionalLeads.length > 0 || regionalOrders.length > 0 ? 'high' : 'medium',
    };
  }).filter((segment) => clean(segment.segment));

  const opportunityPool = [
    ...activePipeline.map((item) => {
      const guidance = getProbabilityGuidance(item.contractProb);
      const qualificationScore = Math.round((guidance.probability * 0.6) + (parseFlexibleNumber(item.margin) >= 20 ? 20 : 10) + (strategy.some((row) => clean(row.productFamily) === clean(item.productFamily)) ? 20 : 0));
      return {
        type: 'pipeline',
        customer: clean(item.customerName),
        product: clean(item.productFamily),
        title: `Protect ${clean(item.customerName)} ${clean(item.productFamily)} opportunity`,
        description: guidance.band === 'strong'
          ? 'Close the deal with confidence-building follow-up, stakeholder mapping, and decision-date control.'
          : 'Improve qualification, value framing, and next-step commitment to raise conversion probability.',
        estimatedValue: parseFlexibleNumber(item.estRevenue),
        qualificationScore,
        priority: getPriority(qualificationScore),
        expectedImpact: Math.round(parseFlexibleNumber(item.estRevenue) * (guidance.probability / 100)),
      };
    }),
    ...keyAccounts.filter((account) => account.revenue > 0 && account.pipeline === 0).map((account) => ({
      type: 'cross_sell',
      customer: account.customer,
      product: 'Service bundle',
      title: `Create cross-sell plan for ${account.customer}`,
      description: 'Existing revenue with no open pipeline indicates whitespace for service, integration, or spare-parts expansion.',
      estimatedValue: Math.round(account.revenue * 0.15),
      qualificationScore: Math.min(95, account.score + 10),
      priority: getPriority(account.score + 10),
      expectedImpact: Math.round(account.revenue * 0.1),
    })),
    ...assets.filter((asset) => /mid-life|end-of-life/i.test(clean(asset.lifecycle_stage))).map((asset) => ({
      type: 'lifecycle',
      customer: clean(asset.customerName),
      product: 'Upgrade / service contract',
      title: `Launch lifecycle offer for ${clean(asset.customerName)}`,
      description: 'Installed-base lifecycle signal shows a timed opportunity for retrofit, predictive maintenance, or renewal.',
      estimatedValue: 75000,
      qualificationScore: 78,
      priority: 'high',
      expectedImpact: 50000,
    })),
  ].sort((left, right) => right.qualificationScore - left.qualificationScore);

  const strategyClassification = productPortfolio.map((product) => ({
    name: product.name,
    lifecycle: product.sectorClass,
    businessModel: /service/i.test(product.name) ? 'services' : /solution|cell|system/i.test(product.name) ? 'solutions' : 'equipment',
    competitiveStrategy: product.fitScore >= 75 ? 'performance' : product.alignmentScore >= 70 ? 'value' : 'price',
    recommendedAction: product.sectorClass === 'decline'
      ? 'Protect margin and migrate accounts to service-led replacements.'
      : product.sectorClass === 'innovation'
        ? 'Prioritize lighthouse accounts and reference wins.'
        : 'Bundle with services to avoid pure price competition.',
  }));

  const actions = opportunityPool.slice(0, 12).map((opportunity) => ({
    title: opportunity.title,
    customer: opportunity.customer,
    product: opportunity.product,
    priority: opportunity.priority,
    expectedImpact: opportunity.expectedImpact,
    requiredEffort: getEffort(opportunity.qualificationScore),
    rationale: opportunity.description,
    module: opportunity.type,
  }));

  const dataUsage = [
    { dataset: 'orders', loaded: orders.length, modules: orders.length > 0 ? ['keyAccounts', 'forecasting', 'portfolio', 'actions'] : [] },
    { dataset: 'opportunities', loaded: opportunities.length, modules: opportunities.length > 0 ? ['qualification', 'forecasting', 'actions'] : [] },
    { dataset: 'products', loaded: products.length, modules: products.length > 0 ? ['portfolio', 'strategyClassification', 'competitorAnalysis'] : [] },
    { dataset: 'strategy', loaded: strategy.length, modules: strategy.length > 0 ? ['alignment', 'gapAnalysis', 'prioritization'] : [] },
    { dataset: 'leads', loaded: leads.length, modules: leads.length > 0 ? ['marketSegmentation', 'marketExpansion', 'competitorInference'] : [] },
    { dataset: 'assets', loaded: assets.length, modules: assets.length > 0 ? ['installedBase', 'lifecycleDetection'] : [] },
    { dataset: 'company', loaded: clean(company.company_name) ? 1 : 0, modules: clean(company.company_name) ? ['context', 'competitorAnalysis', 'strategyNarrative'] : [] },
  ];

  const issues = [
    ...(competitors.length === 0 ? ['No competitor analysis'] : []),
    ...(marketSegments.length === 0 ? ['No segmentation'] : []),
    ...(opportunityPool.length === 0 ? ['No opportunities generated'] : []),
    ...(actions.length === 0 ? ['No actions generated'] : []),
    ...harmonized.conflicts.map((issue) => `Data inconsistency: ${issue}`),
    ...dataUsage.filter((entry) => entry.loaded > 0 && entry.modules.length === 0).map((entry) => `Unused data: ${entry.dataset}`),
  ];

  const correctedOutputExample = {
    customer: keyAccounts[0]?.customer || 'Priority account',
    accountTier: keyAccounts[0]?.tier || 'B',
    nextAction: actions[0]?.title || 'Generate cross-sell plan',
    expectedImpact: actions[0]?.expectedImpact || 0,
    strategicPositioning: strategyClassification[0]?.competitiveStrategy || 'value',
  };

  return {
    harmonized,
    forecast: {
      soldRevenue,
      openPipeline: harmonized.metrics.openPipeline,
      weightedPipeline,
      strategyTarget,
      strategyAchievement,
    },
    keyAccounts,
    productPortfolio,
    competitors,
    marketSegments,
    opportunities: opportunityPool,
    actions,
    strategyClassification,
    cascade: {
      stages: ['new-data', 'enrichment', 'database-update', 're-analysis', 'opportunity-generation', 'prioritized-actions'],
      status: issues.length === 0 ? 'healthy' : 'attention-required',
    },
    dataUsage,
    qualityGate: {
      accepted: issues.length === 0,
      issues,
    },
    correctedOutputExample,
  };
}

export function buildDeterministicActionPool(input: IntelligenceInput) {
  const intelligence = buildCommercialIntelligence(input);
  const today = new Date();

  return {
    summary: {
      source: 'deterministic-commercial-intelligence',
      qualityGate: intelligence.qualityGate,
      strategyAchievement: intelligence.forecast.strategyAchievement,
      issues: intelligence.qualityGate.issues,
    },
    actions: intelligence.actions.map((action, index) => {
      const dueDate = new Date(today.getTime() + (index < 3 ? 7 : index < 8 ? 14 : 21) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const category = action.module === 'cross_sell' ? 'cross_sell' : action.module === 'lifecycle' ? 'strategy' : 'follow_up';

      return {
        title: action.title,
        description: action.rationale,
        category,
        pillar: action.module === 'lifecycle' ? 'p3' : 'p4',
        priority: action.priority,
        assignee: '',
        dueDate,
        rationale: action.rationale,
        estimatedRevenue: action.expectedImpact,
        riskIfNotDone: 'Pipeline quality, conversion confidence, or account expansion will deteriorate.',
        actionContent: {
          goal: `Advance ${action.customer || 'the target account'} through the next best commercial step with a focus on ${action.product || 'the relevant offer'}.`,
          callScript: `Open by referencing the current commercial context for ${action.customer || 'the account'}, confirm urgency, and align on the next decision point. Reinforce value, clarify blockers, and secure one dated next action.`,
          emailTemplate: `Subject: Next step for ${action.customer || 'the account'}\n\nHello,\n\nI would like to move forward on the current commercial topic around ${action.product || 'the proposed solution'}. Please let us know a suitable moment this week to confirm the next step and timeline.\n\nBest regards,`,
          presentationNotes: `Use a concise customer-specific value case, expected business impact, decision risks, and the exact next-step recommendation for ${action.customer || 'the account'}.`,
        },
      };
    }),
  };
}
