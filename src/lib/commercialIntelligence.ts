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
  objectives?: string;
  strategy_context?: string;
  additional_notes?: string;
  annual_revenue?: string;
  current_challenges?: string;
  main_products?: string;
  sales_channels?: string;
}

export interface StrategyPillarDiagnostic {
  pillar: 'standard' | 'custom' | 'services' | 'other';
  label: string;
  targetRevenue: number;
  currentRevenue: number;
  weightedPipeline: number;
  revenueGap: number;
  achievementPct: number;
  coveragePct: number;
}

export interface StrategyRootCause {
  title: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
}

export interface BridgePlanItem {
  title: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  expectedImpact: number;
  rationale: string;
}

export interface StrategyDiagnostic {
  targetRevenue: number;
  targetSource: string;
  currentRevenue: number;
  currentRevenueSource: string;
  weightedPipeline: number;
  revenueGap: number;
  coverageGap: number;
  currentAchievementPct: number;
  pipelineCoveragePct: number;
  currentMarginPct: number;
  targetMarginPct: number;
  marginGapPct: number;
  mixAlignmentPct: number;
  byPillar: StrategyPillarDiagnostic[];
  validationStatus: 'ok' | 'warning' | 'critical';
  validationWarnings: string[];
  targetCandidates: Array<{ source: string; value: number }>;
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

type StrategicPillar = 'standard' | 'custom' | 'services' | 'other';
const STRATEGIC_PILLAR_LABELS: Record<StrategicPillar, string> = {
  standard: 'Standard Products',
  custom: 'Custom Projects',
  services: 'Services',
  other: 'Other',
};

const emptyPillarTotals = (): Record<StrategicPillar, number> => ({
  standard: 0,
  custom: 0,
  services: 0,
  other: 0,
});

function classifyStrategicPillar(value: unknown, fallback: StrategicPillar = 'standard'): StrategicPillar {
  const normalized = keyify(value);
  if (!normalized) return 'other';

  if (/(service|services|maintenance|support|contract|spare|lifecycle|after sales|retrofit)/i.test(normalized)) return 'services';
  if (/(custom|project|projects|engineering|integration|system|solution|turnkey|cell|upgrade)/i.test(normalized)) return 'custom';
  if (/(standard|product|products|equipment|machine|amr|retal|easy pack|pallet)/i.test(normalized)) return 'standard';
  return fallback;
}

function parseScaledAmount(raw: string, unit?: string) {
  const base = parseFlexibleNumber(raw);
  const normalizedUnit = clean(unit).toLowerCase();
  if (!base) return 0;
  if (['m', 'mn', 'mln', 'million'].includes(normalizedUnit)) return base * 1_000_000;
  if (['k', 'thousand'].includes(normalizedUnit)) return base * 1_000;
  return base;
}

function extractAmountMentions(text: string) {
  const matches: Array<{ amount: number; context: string }> = [];
  const pattern = /(?:€|eur|euro)?\s*([0-9]+(?:[.,][0-9]+)?)\s*(m|mn|mln|million|k|thousand)?\+?/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const amount = parseScaledAmount(match[1], match[2]);
    if (amount < 1000) continue;
    const context = text.slice(Math.max(0, match.index - 60), Math.min(text.length, match.index + match[0].length + 60)).toLowerCase();
    matches.push({ amount, context });
  }

  return matches;
}

function extractCurrentRevenueHint(company: CommercialCompany) {
  const notes = clean(company.additional_notes);
  const description = clean(company.business_description);
  const annualRevenue = clean(company.annual_revenue);
  const searchText = [notes, annualRevenue, description].filter(Boolean).join(' | ');

  const contextualMentions = extractAmountMentions(searchText).filter(({ context }) => /(current|today|actual|average revenue|annual revenue|revenue)/i.test(context));
  const bestMatch = contextualMentions.sort((left, right) => right.amount - left.amount)[0];

  return {
    value: bestMatch?.amount || 0,
    source: bestMatch ? 'Company Profile Revenue Baseline' : 'Confirmed Sales Orders',
  };
}

function inferMarginPct(margins: number[], revenues: number[] = []) {
  const normalizedMargins = margins.map((value) => parseFlexibleNumber(value)).filter((value) => Number.isFinite(value) && value !== 0);
  if (normalizedMargins.length === 0) return 0;

  const avgAbs = normalizedMargins.reduce((sum, value) => sum + Math.abs(value), 0) / normalizedMargins.length;
  if (avgAbs <= 100) {
    return normalizedMargins.reduce((sum, value) => sum + value, 0) / normalizedMargins.length;
  }

  const totalRevenue = revenues.reduce((sum, value) => sum + parseFlexibleNumber(value), 0);
  return totalRevenue > 0 ? (normalizedMargins.reduce((sum, value) => sum + value, 0) / totalRevenue) * 100 : 0;
}

export function buildOutputDataChecks(input: {
  explicitOverallTarget: number;
  contextualPillarTarget: number;
  strategyRowTarget: number;
  currentRevenue: number;
}) {
  const { explicitOverallTarget, contextualPillarTarget, strategyRowTarget, currentRevenue } = input;
  const validationWarnings: string[] = [];
  const targetCandidates = [
    ...(explicitOverallTarget > 0 ? [{ source: 'Company Profile Target', value: explicitOverallTarget }] : []),
    ...(contextualPillarTarget > 0 ? [{ source: 'Strategy Model Target', value: contextualPillarTarget }] : []),
    ...(strategyRowTarget > 0 ? [{ source: 'Strategy Row Sum', value: strategyRowTarget }] : []),
  ];

  let targetRevenue = 0;
  let targetSource = 'No strategic target';

  if (explicitOverallTarget > 0) {
    targetRevenue = explicitOverallTarget;
    targetSource = 'Company Profile Target';

    if (strategyRowTarget >= explicitOverallTarget * 2) {
      validationWarnings.push(`Strategy rows imply ${Math.round(strategyRowTarget).toLocaleString('en-US')} EUR, which is materially above the stated company target of ${Math.round(explicitOverallTarget).toLocaleString('en-US')} EUR.`);
    }

    if (contextualPillarTarget > 0 && contextualPillarTarget > explicitOverallTarget * 1.5) {
      validationWarnings.push('The product-mix model target appears higher than the explicit company goal and should be reviewed.');
    }
  } else if (contextualPillarTarget > 0) {
    targetRevenue = contextualPillarTarget;
    targetSource = 'Strategy Model Target';

    if (strategyRowTarget > contextualPillarTarget * 2) {
      validationWarnings.push('Summed strategy rows look inflated compared with the product-mix target.');
    }
  } else if (strategyRowTarget > 0) {
    targetRevenue = strategyRowTarget;
    targetSource = 'Strategy Data';
  }

  if (currentRevenue > 0 && targetRevenue > currentRevenue * 20) {
    validationWarnings.push('The selected target is more than 20x current confirmed revenue, so the uploaded output should be checked.');
  }

  const validationStatus = validationWarnings.length === 0
    ? 'ok'
    : validationWarnings.some((warning) => /materially above|inflated|20x/i.test(warning))
      ? 'critical'
      : 'warning';

  return { targetRevenue, targetSource, validationStatus, validationWarnings, targetCandidates };
}

export function buildStrategyDiagnostic(input: Pick<IntelligenceInput, 'company' | 'strategy' | 'orders' | 'opportunities'>): StrategyDiagnostic {
  const company = input.company || {};
  const strategy = input.strategy || [];
  const orders = input.orders || [];
  const opportunities = input.opportunities || [];

  const strategySegments = [
    clean(company.strategic_goals),
    clean(company.objectives),
    clean(company.strategy_context),
  ].filter(Boolean);
  const strategyNarrative = strategySegments.join(' | ');

  const contextSegments = [
    clean(company.business_description),
    clean(company.market_context),
    clean(company.additional_notes),
    clean(company.annual_revenue),
    clean(company.main_products),
  ].filter(Boolean);
  const contextNarrative = contextSegments.join(' | ');

  const companyText = [...strategySegments, ...contextSegments].join(' | ');

  const textTargetByPillar = emptyPillarTotals();
  const strategyTargetByPillar = emptyPillarTotals();
  const explicitOverallTargets: number[] = [];

  strategySegments.forEach((segment) => {
    extractAmountMentions(segment).forEach(({ amount, context }) => {
      const pillar = classifyStrategicPillar(context, 'other');
      if (pillar !== 'other') {
        if (textTargetByPillar[pillar] === 0) {
          textTargetByPillar[pillar] = amount;
        }
      } else {
        explicitOverallTargets.push(amount);
      }
    });
  });

  contextSegments.forEach((segment) => {
    const hasTargetSignal = /(target|goal|objective|reach|grow|growing|ambition|within|plan)/i.test(segment);
    extractAmountMentions(segment).forEach(({ amount, context }) => {
      const pillar = classifyStrategicPillar(context, 'other');
      if (hasTargetSignal && pillar !== 'other') {
        if (textTargetByPillar[pillar] === 0) {
          textTargetByPillar[pillar] = amount;
        }
      }
      if (hasTargetSignal) {
        explicitOverallTargets.push(amount);
      }
    });
  });

  const seenStrategyRows = new Set<string>();
  strategy.forEach((row) => {
    const revenue = parseFlexibleNumber(row.estRevenue);
    if (revenue <= 0) return;

    const rowKey = [
      keyify(row.productFamily),
      keyify(row.region),
      keyify((row as { estPurchasingQuarter?: string }).estPurchasingQuarter),
      Math.round(revenue),
    ].join('|');

    if (seenStrategyRows.has(rowKey)) return;
    seenStrategyRows.add(rowKey);

    const pillar = classifyStrategicPillar(row.productFamily);
    strategyTargetByPillar[pillar] += revenue;
  });

  const targetByPillar = (Object.keys(textTargetByPillar) as StrategicPillar[]).reduce((acc, pillar) => {
    acc[pillar] = textTargetByPillar[pillar] > 0 ? textTargetByPillar[pillar] : strategyTargetByPillar[pillar];
    return acc;
  }, emptyPillarTotals());

  const strategyRowTarget = Object.values(strategyTargetByPillar).reduce((sum, value) => sum + value, 0);
  const contextualPillarTarget = Object.values(targetByPillar).reduce((sum, value) => sum + value, 0);
  const explicitOverallTarget = explicitOverallTargets.length > 0 ? Math.max(...explicitOverallTargets) : 0;

  const pipelineMetrics = buildPipelineMetrics({ opportunities, orders });
  const currentRevenueHint = extractCurrentRevenueHint(company);
  const currentRevenue = pipelineMetrics.soldRevenue > 0 ? pipelineMetrics.soldRevenue : currentRevenueHint.value;
  const currentRevenueSource = pipelineMetrics.soldRevenue > 0 ? 'Confirmed Sales Orders' : currentRevenueHint.source;
  const { targetRevenue, targetSource, validationStatus, validationWarnings, targetCandidates } = buildOutputDataChecks({
    explicitOverallTarget,
    contextualPillarTarget,
    strategyRowTarget,
    currentRevenue,
  });
  const activePipeline = getActivePipelineOpportunities(opportunities, orders);

  const currentByPillar = emptyPillarTotals();
  orders.forEach((order) => {
    const pillar = classifyStrategicPillar(order.productFamily);
    currentByPillar[pillar] += parseFlexibleNumber(order.sellingPrice);
  });

  const weightedPipelineByPillar = emptyPillarTotals();
  activePipeline.forEach((opportunity) => {
    const pillar = classifyStrategicPillar(opportunity.productFamily);
    const weightedValue = parseFlexibleNumber(opportunity.estRevenue) * (getProbabilityGuidance(opportunity.contractProb).probability / 100);
    weightedPipelineByPillar[pillar] += weightedValue;
  });

  const pillars = (Object.keys(STRATEGIC_PILLAR_LABELS) as StrategicPillar[])
    .filter((pillar) => targetByPillar[pillar] > 0 || currentByPillar[pillar] > 0 || weightedPipelineByPillar[pillar] > 0)
    .map((pillar) => {
      const target = targetByPillar[pillar];
      const current = currentByPillar[pillar];
      const weighted = weightedPipelineByPillar[pillar];
      const gap = Math.max(0, target - current);
      return {
        pillar,
        label: STRATEGIC_PILLAR_LABELS[pillar],
        targetRevenue: target,
        currentRevenue: current,
        weightedPipeline: weighted,
        revenueGap: gap,
        achievementPct: target > 0 ? (current / target) * 100 : 0,
        coveragePct: target > 0 ? ((current + weighted) / target) * 100 : 0,
      };
    })
    .sort((left, right) => right.revenueGap - left.revenueGap);

  const currentMarginPct = inferMarginPct(orders.map((order) => parseFlexibleNumber(order.margin)), orders.map((order) => parseFlexibleNumber(order.sellingPrice)));
  const targetMarginPct = inferMarginPct(strategy.map((row) => parseFlexibleNumber(row.margin)), strategy.map((row) => parseFlexibleNumber(row.estRevenue)));
  const mixAlignmentPct = pillars.length > 0
    ? pillars.reduce((sum, pillar) => sum + Math.min(100, pillar.coveragePct), 0) / pillars.length
    : 0;

  return {
    targetRevenue,
    targetSource,
    currentRevenue,
    currentRevenueSource,
    weightedPipeline: pipelineMetrics.weightedOpenRevenue,
    revenueGap: Math.max(0, targetRevenue - currentRevenue),
    coverageGap: Math.max(0, targetRevenue - (currentRevenue + pipelineMetrics.weightedOpenRevenue)),
    currentAchievementPct: targetRevenue > 0 ? (currentRevenue / targetRevenue) * 100 : 0,
    pipelineCoveragePct: targetRevenue > 0 ? ((currentRevenue + pipelineMetrics.weightedOpenRevenue) / targetRevenue) * 100 : 0,
    currentMarginPct,
    targetMarginPct,
    marginGapPct: targetMarginPct > 0 ? targetMarginPct - currentMarginPct : 0,
    mixAlignmentPct,
    byPillar: pillars,
    validationStatus,
    validationWarnings,
    targetCandidates,
  };
}

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
  const strategyDiagnostic = buildStrategyDiagnostic({ company, strategy, orders, opportunities });
  const weightedPipeline = strategyDiagnostic.weightedPipeline;
  const strategyTarget = strategyDiagnostic.targetRevenue;
  const strategyAchievement = strategyDiagnostic.currentAchievementPct;

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

  const top3Share = soldRevenue > 0
    ? keyAccounts.slice(0, 3).reduce((sum, account) => sum + (account.revenue / soldRevenue) * 100, 0)
    : 0;

  const rootCauseMap: StrategyRootCause[] = [
    ...(strategyTarget > 0 && strategyDiagnostic.currentAchievementPct < 60 ? [{
      title: 'Revenue performance is materially below the strategic ambition',
      severity: strategyDiagnostic.currentAchievementPct < 30 ? 'high' as const : 'medium' as const,
      description: `Current confirmed revenue is tracking at ${strategyDiagnostic.currentAchievementPct.toFixed(0)}% of the target, leaving a sizable execution gap.`,
    }] : []),
    ...(strategyTarget > 0 && strategyDiagnostic.pipelineCoveragePct < 100 ? [{
      title: 'Qualified pipeline does not yet bridge the target gap',
      severity: strategyDiagnostic.pipelineCoveragePct < 70 ? 'high' as const : 'medium' as const,
      description: `Even including weighted open deals, coverage reaches only ${strategyDiagnostic.pipelineCoveragePct.toFixed(0)}% of the plan.`,
    }] : []),
    ...(strategyDiagnostic.byPillar.filter((pillar) => pillar.targetRevenue > 0 && pillar.coveragePct < 75).length > 0 ? [{
      title: 'Product mix is misaligned with the growth model',
      severity: 'high' as const,
      description: `Weak coverage in ${strategyDiagnostic.byPillar.filter((pillar) => pillar.targetRevenue > 0 && pillar.coveragePct < 75).slice(0, 3).map((pillar) => pillar.label).join(', ')} is holding back the strategy.`,
    }] : []),
    ...(strategyDiagnostic.targetMarginPct > 0 && strategyDiagnostic.marginGapPct > 5 ? [{
      title: 'Margin quality is below the strategic expectation',
      severity: 'medium' as const,
      description: `Current margin is trailing the target by ${strategyDiagnostic.marginGapPct.toFixed(1)} percentage points.`,
    }] : []),
    ...(top3Share > 65 ? [{
      title: 'Customer concentration is amplifying risk',
      severity: top3Share > 80 ? 'high' as const : 'medium' as const,
      description: `The top three accounts represent ${top3Share.toFixed(0)}% of confirmed revenue, which limits resilience.`,
    }] : []),
  ];

  const bridgePlan: BridgePlanItem[] = [
    ...strategyDiagnostic.byPillar
      .filter((pillar) => pillar.targetRevenue > 0 && pillar.coveragePct < 90)
      .slice(0, 3)
      .map((pillar) => ({
        title: `Build focused demand in ${pillar.label}`,
        priority: pillar.coveragePct < 50 ? 'critical' as const : 'high' as const,
        expectedImpact: Math.round(Math.max(0, pillar.targetRevenue - (pillar.currentRevenue + pillar.weightedPipeline))),
        rationale: `Current sales and weighted pipeline are not sufficient for the ${pillar.label.toLowerCase()} target, so account plans and campaigns should concentrate here.`,
      })),
    ...(strategyDiagnostic.coverageGap > 0 ? [{
      title: 'Close the execution gap with a target-bridging pipeline plan',
      priority: strategyDiagnostic.pipelineCoveragePct < 60 ? 'critical' as const : 'high' as const,
      expectedImpact: Math.round(strategyDiagnostic.coverageGap),
      rationale: 'The current funnel does not yet create enough qualified coverage to achieve the strategic revenue goal.',
    }] : []),
    ...(strategyDiagnostic.marginGapPct > 5 ? [{
      title: 'Improve value pricing and margin discipline',
      priority: 'medium' as const,
      expectedImpact: Math.round(soldRevenue * 0.05),
      rationale: 'Pricing discipline, service bundles, and scope control are needed to reach the target margin profile.',
    }] : []),
  ];

  const opportunityPool = [
    ...activePipeline.map((item) => {
      const guidance = getProbabilityGuidance(item.contractProb);
      const pillar = classifyStrategicPillar(item.productFamily);
      const pillarGap = strategyDiagnostic.byPillar.find((entry) => entry.pillar === pillar);
      const alignmentBonus = pillarGap
        ? (pillarGap.coveragePct < 50 ? 25 : pillarGap.coveragePct < 80 ? 15 : 5)
        : (strategy.some((row) => clean(row.productFamily) === clean(item.productFamily)) ? 15 : 0);
      const qualificationScore = Math.round((guidance.probability * 0.6) + (parseFlexibleNumber(item.margin) >= 20 ? 20 : 10) + alignmentBonus);
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

  const actions = [
    ...bridgePlan.map((item) => ({
      title: item.title,
      customer: '',
      product: 'Strategic gap closure',
      priority: item.priority,
      expectedImpact: item.expectedImpact,
      requiredEffort: getEffort(item.priority === 'critical' ? 90 : item.priority === 'high' ? 70 : 45),
      rationale: item.rationale,
      module: 'strategy_bridge',
    })),
    ...opportunityPool.slice(0, 12).map((opportunity) => ({
      title: opportunity.title,
      customer: opportunity.customer,
      product: opportunity.product,
      priority: opportunity.priority,
      expectedImpact: opportunity.expectedImpact,
      requiredEffort: getEffort(opportunity.qualificationScore),
      rationale: opportunity.description,
      module: opportunity.type,
    })),
  ].slice(0, 12);

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
    ...strategyDiagnostic.validationWarnings.map((warning) => `Output data check: ${warning}`),
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
    currentAchievement: strategyDiagnostic.currentAchievementPct,
    pipelineCoverage: strategyDiagnostic.pipelineCoveragePct,
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
    strategyDiagnostic,
    rootCauseMap,
    bridgePlan,
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
      const category = action.module === 'cross_sell'
        ? 'cross_sell'
        : action.module === 'lifecycle' || action.module === 'strategy_bridge'
          ? 'strategy'
          : 'follow_up';

      return {
        title: action.title,
        description: action.rationale,
        category,
        pillar: action.module === 'lifecycle' || action.module === 'strategy_bridge' ? 'p3' : 'p4',
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
