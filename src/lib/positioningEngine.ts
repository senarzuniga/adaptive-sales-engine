import type { CompanyProfile, OpportunityRecord, OrderRecord, ProductRecord, StrategyRecord } from '@/store/DataStore';
import type {
  CompetitiveLandscape,
  PortfolioAnalysis,
  ProductLifecycle,
  ProductPositioning,
  SalesApproach,
  StrategyRoadmap,
} from '@/models/positioning';
import { isOpenOpportunityStatus } from '@/lib/salesData';

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const rank = (value: number, low = 0.33, high = 0.66): 'low' | 'medium' | 'high' =>
  value >= high ? 'high' : value >= low ? 'medium' : 'low';

const inferLifecycle = (product: ProductRecord, revenue: number, weightedPipeline: number): ProductLifecycle => {
  const lifecycleHint = (product.lifecycleStage || product.type || '').toLowerCase();
  if (/obsolete|sunset/.test(lifecycleHint)) return 'obsolescence';
  if (/declin|retired/.test(lifecycleHint)) return 'decline';
  if (/intro|new/.test(lifecycleHint)) return 'introduction';
  if (/growth/.test(lifecycleHint)) return 'growth';
  if (/matur|core/.test(lifecycleHint)) return 'maturity';
  if (/satur|commodity/.test(lifecycleHint)) return 'saturation';
  if (weightedPipeline > revenue * 0.8) return 'growth';
  if (revenue > 0 && weightedPipeline < revenue * 0.2) return 'maturity';
  return 'maturity';
};

const inferSalesApproach = (lifecycle: ProductLifecycle, commoditizationRisk: number): SalesApproach => {
  if (lifecycle === 'introduction' || lifecycle === 'growth') return 'consultative';
  if (commoditizationRisk > 0.7) return 'value_selling';
  if (lifecycle === 'decline' || lifecycle === 'obsolescence') return 'challenger_sale';
  return 'solution_selling';
};

const inferCompetitivePosition = (differentiationScore: number, commoditizationRisk: number): ProductPositioning['competitivePosition'] => {
  if (differentiationScore >= 0.8) return 'leader';
  if (differentiationScore >= 0.65) return 'challenger';
  if (commoditizationRisk >= 0.75) return 'commodity';
  if (differentiationScore >= 0.45) return 'niche';
  return 'follower';
};

export function buildProductPositioningModel(input: {
  company: CompanyProfile;
  products: ProductRecord[];
  orders: OrderRecord[];
  opportunities: OpportunityRecord[];
  strategy: StrategyRecord[];
}): ProductPositioning[] {
  const names = new Set<string>([
    ...input.products.map((p) => p.name).filter(Boolean),
    ...input.orders.map((row) => row.productFamily).filter(Boolean),
    ...input.opportunities.map((row) => row.productFamily).filter(Boolean),
  ]);

  return Array.from(names).map((name, idx) => {
    const product = input.products.find((p) => p.name === name) || ({ name, type: 'Core', averageValue: 0, comments: '' } as ProductRecord);
    const productOrders = input.orders.filter((row) => row.productFamily === name);
    const productOpps = input.opportunities.filter((row) => row.productFamily === name && isOpenOpportunityStatus(row.status));
    const productStrategy = input.strategy.filter((row) => row.productFamily === name);

    const revenue = productOrders.reduce((sum, row) => sum + (row.sellingPrice || 0), 0);
    const weightedPipeline = productOpps.reduce((sum, row) => sum + ((row.estRevenue || 0) * ((row.contractProb || 0) / 100)), 0);
    const avgMargin = productOrders.length > 0
      ? productOrders.reduce((sum, row) => sum + (row.margin || 0), 0) / productOrders.length
      : product.averageMargin || 0;
    const strategyRows = productStrategy.length;

    const innovationSignal = /innovation|digital|smart|predictive|solution/.test((product.type || '').toLowerCase() + ' ' + (product.comments || '').toLowerCase());
    const commoditizationRisk = clamp01((/commodity|standard|replacement/.test((product.type || '').toLowerCase()) ? 0.6 : 0.25) + (avgMargin < 15 ? 0.25 : 0) + (weightedPipeline < revenue * 0.2 ? 0.15 : 0));
    const differentiationScore = clamp01((innovationSignal ? 0.45 : 0.2) + (avgMargin >= 25 ? 0.25 : avgMargin >= 15 ? 0.12 : 0) + (strategyRows > 0 ? 0.18 : 0));

    const lifecycleStage = inferLifecycle(product, revenue, weightedPipeline);
    const lifecycleConfidence = clamp01((strategyRows > 0 ? 0.3 : 0.1) + (revenue > 0 ? 0.4 : 0.15) + (weightedPipeline > 0 ? 0.2 : 0.05));
    const competitivePosition = inferCompetitivePosition(differentiationScore, commoditizationRisk);

    const pricingPower: ProductPositioning['pricingPower'] = differentiationScore >= 0.75 ? 'high' : differentiationScore >= 0.5 ? 'medium' : 'low';
    const pricingStrategy: ProductPositioning['pricingStrategy'] = pricingPower === 'high'
      ? 'value_based'
      : commoditizationRisk >= 0.7
        ? 'competitive'
        : 'cost_plus';

    const marketMaturity: ProductPositioning['marketMaturity'] = lifecycleStage === 'introduction'
      ? 'emerging'
      : lifecycleStage === 'growth'
        ? 'growing'
        : lifecycleStage === 'decline' || lifecycleStage === 'obsolescence'
          ? 'declining'
          : 'mature';

    const technologyTrajectory: ProductPositioning['technologyTrajectory'] = innovationSignal
      ? 'cutting_edge'
      : lifecycleStage === 'obsolescence'
        ? 'obsolete'
        : lifecycleStage === 'decline'
          ? 'aging'
          : lifecycleStage === 'growth'
            ? 'growing'
            : 'stable';

    const targetCustomerProfile = [
      input.company.industry || 'Industrial operations',
      input.company.main_customer_segments || 'value-driven B2B buyers',
    ].filter(Boolean).join(' - ');

    return {
      productId: product.id || `product_${idx + 1}`,
      sku: product.sku || '',
      name,
      lifecycleStage,
      lifecycleConfidence,
      competitivePosition,
      marketMaturity,
      technologyTrajectory,
      commoditizationRisk,
      differentiationScore,
      pricingPower,
      recommendedSalesApproach: inferSalesApproach(lifecycleStage, commoditizationRisk),
      pricingStrategy,
      valueProposition: `${name} improves operational performance with a ${pricingPower}-power positioning and ${marketMaturity} market profile.`,
      targetCustomerProfile,
      competitiveAdvantages: [
        innovationSignal ? 'Technology-led differentiation' : 'Operational reliability and deployment speed',
        avgMargin >= 20 ? 'Healthy margin profile supporting value-based selling' : 'Room for margin-defense tactics',
      ],
      vulnerabilities: [
        commoditizationRisk >= 0.7 ? 'High commoditization pressure' : 'Moderate substitution pressure',
        weightedPipeline < revenue * 0.25 ? 'Pipeline below desired coverage' : 'Pipeline dependency risk under control',
      ],
      adjacentOpportunities: [
        'Service bundling and lifecycle contracts',
        'Cross-sell into underpenetrated target accounts',
      ],
      analysisTimestamp: new Date().toISOString(),
    };
  }).sort((a, b) => b.differentiationScore - a.differentiationScore);
}

export function buildPortfolioAnalysis(positioning: ProductPositioning[], orders: OrderRecord[]): PortfolioAnalysis {
  const lifecycleDistribution: PortfolioAnalysis['lifecycleDistribution'] = {
    introduction: 0,
    growth: 0,
    maturity: 0,
    saturation: 0,
    decline: 0,
    obsolescence: 0,
  };

  positioning.forEach((entry) => {
    lifecycleDistribution[entry.lifecycleStage] += 1;
  });

  const byProductRevenue = positioning.map((entry) => {
    const value = orders.filter((row) => row.productFamily === entry.name).reduce((sum, row) => sum + (row.sellingPrice || 0), 0);
    return { name: entry.name, value };
  }).sort((a, b) => b.value - a.value);

  const totalRevenue = byProductRevenue.reduce((sum, item) => sum + item.value, 0);
  const top3Revenue = byProductRevenue.slice(0, 3).reduce((sum, item) => sum + item.value, 0);
  const innovationCount = lifecycleDistribution.introduction + lifecycleDistribution.growth;
  const declineCount = lifecycleDistribution.decline + lifecycleDistribution.obsolescence;
  const maturityCount = lifecycleDistribution.maturity + lifecycleDistribution.saturation;

  const innovationRatio = positioning.length > 0 ? innovationCount / positioning.length : 0;
  const cashCowRatio = positioning.length > 0 ? maturityCount / positioning.length : 0;
  const declineExposure = positioning.length > 0 ? declineCount / positioning.length : 0;
  const concentration = totalRevenue > 0 ? top3Revenue / totalRevenue : 0;

  const portfolioHealthScore = Math.max(0, Math.min(1,
    (innovationRatio * 0.35) +
    (cashCowRatio * 0.25) +
    ((1 - declineExposure) * 0.25) +
    ((1 - concentration) * 0.15)
  ));

  const strategicRecommendations: string[] = [];
  if (innovationRatio < 0.25) strategicRecommendations.push('Increase innovation pipeline and launch readiness for emerging offers.');
  if (declineExposure > 0.3) strategicRecommendations.push('Create phase-out or repositioning plans for decline-exposed product lines.');
  if (concentration > 0.65) strategicRecommendations.push('Reduce revenue concentration by expanding cross-sell in secondary product families.');
  if (strategicRecommendations.length === 0) strategicRecommendations.push('Portfolio balance is healthy; focus on disciplined execution and service attach rate.');

  return {
    totalProducts: positioning.length,
    lifecycleDistribution,
    revenueConcentration: concentration,
    innovationRatio,
    cashCowRatio,
    declineExposure,
    portfolioHealthScore,
    strategicRecommendations,
    riskFactors: [
      concentration > 0.65 ? 'Revenue concentration in top product lines.' : 'No critical concentration risk detected.',
      declineExposure > 0.3 ? 'High exposure to declining lifecycle stages.' : 'Lifecycle decline exposure is controlled.',
    ],
    growthOpportunities: [
      'Bundle services and maintenance offers to improve recurring revenue mix.',
      'Prioritize value-selling scripts for medium differentiation products.',
    ],
  };
}

export function buildCompetitiveLandscapes(positioning: ProductPositioning[], company: CompanyProfile): CompetitiveLandscape[] {
  const competitors = (company.main_competitors || '')
    .split('|')
    .flatMap((group) => group.split(','))
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 6);

  return positioning.map((entry) => {
    const intensity = rank((1 - entry.differentiationScore) + entry.commoditizationRisk, 0.9, 1.3);
    const barrierToEntry = rank(entry.differentiationScore + (1 - entry.commoditizationRisk), 0.6, 1.2);
    const directCompetitors = competitors.map((name, idx) => ({
      name,
      position: idx === 0 ? 'primary competitor' : 'alternative competitor',
      threatLevel: idx < 2 ? 'high' : idx < 4 ? 'medium' : 'low' as 'low' | 'medium' | 'high',
    }));

    return {
      productId: entry.productId,
      directCompetitors,
      substituteThreats: ['In-house engineering alternatives', 'Low-cost integrator substitutes'],
      barrierToEntry,
      competitiveIntensity: intensity,
      pricePosition: entry.pricingPower === 'high' ? 'premium' : entry.pricingPower === 'medium' ? 'parity' : 'discount',
      marketShareEstimate: undefined,
      keyDifferentiators: entry.competitiveAdvantages,
      competitiveAdvantageSustainability: entry.differentiationScore >= 0.75 ? 'defensible' : entry.differentiationScore >= 0.55 ? 'sustainable' : 'temporary',
    };
  });
}

export function buildStrategyRoadmaps(positioning: ProductPositioning[]): StrategyRoadmap[] {
  return positioning.map((entry) => {
    const shortTermImpact = Math.round(50_000 * (entry.differentiationScore + (1 - entry.commoditizationRisk)));
    const mediumTermImpact = Math.round(shortTermImpact * 1.6);
    const longTermImpact = Math.round(shortTermImpact * 2.4);

    return {
      productId: entry.productId,
      shortTermActions: [
        { title: `Refine value messaging for ${entry.name}`, owner: 'KAM Lead', expectedImpact: shortTermImpact },
        { title: 'Update commercial objection handling', owner: 'Sales Enablement', expectedImpact: Math.round(shortTermImpact * 0.7) },
      ],
      mediumTermInitiatives: [
        { title: 'Launch account-specific campaign', owner: 'Growth Marketing', expectedImpact: mediumTermImpact },
        { title: 'Bundle service and lifecycle offer', owner: 'Commercial Director', expectedImpact: Math.round(mediumTermImpact * 0.8) },
      ],
      longTermStrategicMoves: [
        { title: 'Expand strategic channels for priority segment', owner: 'GM', expectedImpact: longTermImpact },
        { title: 'Product roadmap alignment with market trajectory', owner: 'Product Strategy', expectedImpact: Math.round(longTermImpact * 0.9) },
      ],
      salesScripts: [
        {
          scenario: `${entry.recommendedSalesApproach} scenario`,
          script: `Our focus with ${entry.name} is to deliver measurable business outcomes and defend value beyond price pressure.`,
        },
      ],
      supportContentNeeded: ['ROI one-pager', 'Competitive battlecard', 'Reference case study'],
      trainingRecommendations: ['Value-selling workshop', 'Competitive positioning simulation'],
      roiProjections: {
        quarter_1: shortTermImpact,
        quarter_2: mediumTermImpact,
        quarter_4: longTermImpact,
      },
    };
  });
}
