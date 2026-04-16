import { isOpenOpportunityStatus } from '@/lib/salesData';

interface ProductLike {
  name?: string;
  averageValue?: number;
  type?: string;
  comments?: string;
}

interface OrderLike {
  productFamily?: string;
  sellingPrice?: number;
  margin?: number;
  region?: string;
}

interface OpportunityLike {
  productFamily?: string;
  estRevenue?: number;
  contractProb?: number;
  status?: string;
  region?: string;
}

export interface ProductStrategyProductSnapshot {
  name: string;
  lifecycleLabel: 'Innovation' | 'Commodity' | 'Growth' | 'Core';
  marketFitScore: number;
  revenue: number;
  pipeline: number;
  weightedPipeline: number;
  avgMargin: number;
  positioning: 'Scale' | 'Optimize' | 'Review';
  notes: string;
}

export interface ProductPositionAction {
  id: string;
  title: string;
  productName: string;
  priority: 'high' | 'medium' | 'low';
  scenario: string;
  goal: string;
  supportContent: string;
  script: string;
  recommendedMove: string;
}

export interface ProductActionEvaluation {
  priority: 'high' | 'medium' | 'low';
  evaluation: string;
  scenarioAdjustment: string;
  newActionNeeded: boolean;
  suggestedActionTitle?: string;
}

export function buildProductStrategySnapshot(input: {
  products: ProductLike[];
  orders: OrderLike[];
  opportunities: OpportunityLike[];
}) {
  const names = new Set<string>([
    ...input.products.map((p) => p.name || '').filter(Boolean),
    ...input.orders.map((o) => o.productFamily || '').filter(Boolean),
    ...input.opportunities.map((o) => o.productFamily || '').filter(Boolean),
  ]);

  const products: ProductStrategyProductSnapshot[] = Array.from(names).map((name) => {
    const product = input.products.find((item) => (item.name || '') === name);
    const orderRows = input.orders.filter((order) => (order.productFamily || '') === name);
    const oppRows = input.opportunities.filter((opp) => (opp.productFamily || '') === name);

    const revenue = orderRows.reduce((sum, row) => sum + (row.sellingPrice || 0), 0);
    const margin = orderRows.length > 0 ? orderRows.reduce((sum, row) => sum + (row.margin || 0), 0) / orderRows.length : 0;
    const openPipeline = oppRows.filter((opp) => isOpenOpportunityStatus(opp.status)).reduce((sum, row) => sum + (row.estRevenue || 0), 0);
    const weightedPipeline = oppRows.filter((opp) => isOpenOpportunityStatus(opp.status)).reduce((sum, row) => sum + ((row.estRevenue || 0) * ((row.contractProb || 0) / 100)), 0);

    const type = (product?.type || '').toLowerCase();
    const comments = (product?.comments || '').toLowerCase();
    const innovationSignal = type.includes('innovation') || comments.includes('predictive') || comments.includes('digital') || comments.includes('solution');
    const commoditySignal = type.includes('commodity') || comments.includes('standard') || comments.includes('replacement');

    const lifecycleLabel: ProductStrategyProductSnapshot['lifecycleLabel'] = innovationSignal
      ? 'Innovation'
      : commoditySignal
        ? 'Commodity'
        : openPipeline > revenue
          ? 'Growth'
          : 'Core';

    const marketFitScore = Math.max(0, Math.min(100,
      (revenue > 0 ? Math.min(40, revenue / 25000) : 0) +
      (weightedPipeline > 0 ? Math.min(35, weightedPipeline / 20000) : 0) +
      (margin > 0 ? Math.min(20, margin / 2) : 0) +
      (innovationSignal ? 5 : 0)
    ));

    return {
      name,
      lifecycleLabel,
      marketFitScore,
      revenue,
      pipeline: openPipeline,
      weightedPipeline,
      avgMargin: margin,
      positioning: marketFitScore >= 65 ? 'Scale' : marketFitScore >= 35 ? 'Optimize' : 'Review',
      notes: product?.comments || '',
    };
  }).sort((a, b) => (b.revenue + b.pipeline) - (a.revenue + a.pipeline));

  const summary = `Portfolio review: ${products.length} product lines analyzed across booked revenue, pipeline health, lifecycle position, and market fit.`;

  return { products, summary };
}

export function buildProductPositioningActions(products: ProductStrategyProductSnapshot[], companyName = 'Company'): ProductPositionAction[] {
  return products.slice(0, 6).map((product, index) => {
    const scenario = product.lifecycleLabel === 'Innovation'
      ? 'Consultative selling for innovative solutions'
      : product.lifecycleLabel === 'Commodity'
        ? 'Coverage and efficiency for mature products'
        : product.positioning === 'Scale'
          ? 'Integrated solution scaling'
          : 'Lifecycle value expansion';

    const priority: ProductPositionAction['priority'] = product.positioning === 'Scale' || product.pipeline > 0
      ? 'high'
      : product.positioning === 'Optimize'
        ? 'medium'
        : 'low';

    const recommendedMove = product.lifecycleLabel === 'Commodity'
      ? 'Defend margin, improve market coverage, and strengthen value messaging beyond price.'
      : product.lifecycleLabel === 'Innovation'
        ? 'Use consultative selling and proof-based positioning to accelerate adoption.'
        : product.positioning === 'Review'
          ? 'Reposition or transform the offer before commercial effort is scaled.'
          : 'Bundle service and long-term value into the commercial offer.';

    return {
      id: `${product.name}-${index}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      title: `${product.positioning} ${product.name}`,
      productName: product.name,
      priority,
      scenario,
      goal: `Position ${product.name} in the right value-selling scenario for ${companyName}, improving commercial focus, conversion quality, and future portfolio value.`,
      supportContent: `Positioning support content: ${product.name} is currently classified as ${product.lifecycleLabel} with a ${product.marketFitScore.toFixed(0)}% market-fit score. Revenue is ${product.revenue.toFixed(0)} and pipeline is ${product.pipeline.toFixed(0)}. Recommended move: ${recommendedMove}`,
      script: `Opening: “We are reviewing how ${product.name} creates value for customers beyond a transactional sale.”\nDiscovery: confirm if the buyer values performance, lifecycle cost, or price efficiency most.\nPositioning: explain why ${product.name} should be sold through a ${scenario.toLowerCase()} approach.\nClose: agree the next step, stakeholder owner, and decision criteria.`,
      recommendedMove,
    };
  });
}

export function evaluateProductActionFeedback(
  action: Pick<ProductPositionAction, 'id' | 'title' | 'priority' | 'scenario'>,
  feedback: string,
): ProductActionEvaluation {
  const lower = (feedback || '').toLowerCase();
  let priority: ProductActionEvaluation['priority'] = action.priority;
  let scenarioAdjustment = action.scenario;
  let newActionNeeded = false;
  let suggestedActionTitle = '';

  if (/stalled|urgent|risk|blocked|competitor|lost|price pressure/.test(lower)) {
    priority = 'high';
    newActionNeeded = true;
  }

  if (/service|lifecycle|maintenance|contract/.test(lower)) {
    scenarioAdjustment = 'service-value repositioning';
    suggestedActionTitle = `Launch service-value scenario for ${action.title}`;
    newActionNeeded = true;
  } else if (/price|commodity|discount/.test(lower)) {
    scenarioAdjustment = 'margin-defense and coverage efficiency';
    suggestedActionTitle = `Defend margin on ${action.title}`;
  } else if (/obsolete|declin|phase out|sunset/.test(lower)) {
    scenarioAdjustment = 'portfolio transformation and repositioning';
    suggestedActionTitle = `Review phase-out plan for ${action.title}`;
    newActionNeeded = true;
  } else if (/pilot|interest|traction|good fit|demand/.test(lower)) {
    scenarioAdjustment = 'accelerate consultative growth';
  }

  return {
    priority,
    evaluation: `Feedback evaluated. The action now requires a ${priority.toUpperCase()} response with emphasis on ${scenarioAdjustment}.`,
    scenarioAdjustment,
    newActionNeeded,
    suggestedActionTitle: suggestedActionTitle || undefined,
  };
}
