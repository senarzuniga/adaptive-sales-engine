import { getProbabilityGuidance, isNeglectedStatus, isOpenOpportunityStatus } from '@/lib/salesData';

interface ActionPoolInput {
  companyProfile?: any;
  opportunities?: any[];
  orders?: any[];
  strategy?: any[];
  tasks?: any[];
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);

const buildActionContent = (customer: string, product: string, rationale: string) => ({
  goal: `Advance a high-value conversation with ${customer} and secure the next commercial step for ${product}. Success means a confirmed meeting, clear buying process, and committed next action.`,
  callScript: `Open by referencing the current business context with ${customer}, confirm priorities around ${product}, explore blockers, and ask for a concrete next decision date. Use the rationale that ${rationale}. Close by agreeing the owner, deadline, and follow-up format.`,
  emailTemplate: `Subject: Next step on ${product} opportunity\n\nHello ${customer},\n\nFollowing our recent discussions, I would like to align on the next step for ${product}. We see a strong business case and want to support your team with a clear, low-friction path forward.\n\nPlease let us know a suitable time this week to review scope, timing, and decision criteria.\n\nBest regards,`,
  presentationNotes: `Prepare current revenue exposure, open pipeline value, margin assumptions, likely objections, and a simple commercial proposal. Highlight why ${rationale}.`,
});

export function buildFallbackActionPool(input: ActionPoolInput) {
  const opportunities = [...(input.opportunities || [])];
  const orders = [...(input.orders || [])];
  const actions: any[] = [];

  const neglected = opportunities
    .filter((o) => isNeglectedStatus(o.status))
    .sort((a, b) => (b.estRevenue || 0) - (a.estRevenue || 0));

  neglected.slice(0, 2).forEach((opp) => {
    actions.push({
      title: `Recover ${opp.customerName || 'customer'} opportunity`,
      description: `Reactivate the neglected ${opp.productFamily || 'commercial'} opportunity in ${opp.region || 'the target market'} and either recover momentum or close it decisively.`,
      category: 'follow_up',
      pillar: 'p4',
      priority: 'critical',
      assignee: opp.kam || '',
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      rationale: 'neglected pipeline is the fastest source of avoidable revenue loss',
      estimatedRevenue: opp.estRevenue || 0,
      riskIfNotDone: 'The deal will likely be lost or displaced by a competitor.',
      actionContent: buildActionContent(opp.customerName || 'the customer', opp.productFamily || 'the proposal', 'this deal is already in the pipeline but unattended'),
    });
  });

  const bestOpen = opportunities
    .filter((o) => isOpenOpportunityStatus(o.status))
    .sort((a, b) => ((b.contractProb || 0) * (b.estRevenue || 0)) - ((a.contractProb || 0) * (a.estRevenue || 0)));

  bestOpen.slice(0, 3).forEach((opp) => {
    const guidance = getProbabilityGuidance(opp.contractProb || 0);
    actions.push({
      title: `Accelerate ${opp.customerName || 'priority'} deal`,
      description: `Prioritize the ${opp.productFamily || 'offer'} opportunity and move it to the next buying step with a clear forecast update.`,
      category: 'strategy',
      pillar: 'p4',
      priority: guidance.band === 'strong' ? 'high' : 'medium',
      assignee: opp.kam || '',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      rationale: guidance.band === 'strong'
        ? 'probability is already above 75%, so the action should reinforce confidence, customer relationship, and disciplined follow-up'
        : 'probability is below 75%, so the action should improve the chance of success through value reinforcement and objection handling',
      estimatedRevenue: opp.estRevenue || 0,
      riskIfNotDone: 'Forecast accuracy and close probability will deteriorate.',
      actionContent: buildActionContent(opp.customerName || 'the customer', opp.productFamily || 'the proposal', 'this is one of the highest-value open deals'),
    });
  });

  const topCustomer = orders
    .reduce((acc: Record<string, number>, order: any) => {
      const name = order.customerName || 'Unknown';
      acc[name] = (acc[name] || 0) + (order.sellingPrice || 0);
      return acc;
    }, {} as Record<string, number>);

  const bestCustomer = Object.entries(topCustomer).sort((a, b) => b[1] - a[1])[0];
  if (bestCustomer) {
    actions.push({
      title: `Expand value with ${bestCustomer[0]}`,
      description: `Launch a structured cross-sell and loyalty plan for ${bestCustomer[0]} to protect existing revenue and increase account share.`,
      category: 'cross_sell',
      pillar: 'p4',
      priority: 'high',
      assignee: '',
      dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      rationale: 'existing customers usually deliver the fastest and most profitable growth',
      estimatedRevenue: bestCustomer[1] * 0.15,
      riskIfNotDone: 'Share-of-wallet and retention will weaken over time.',
      actionContent: buildActionContent(bestCustomer[0], 'an expanded commercial plan', 'this customer already represents meaningful booked revenue'),
    });
  }

  const deduped = actions.filter((action, index, array) => array.findIndex((candidate) => candidate.title === action.title) === index);

  return {
    actions: deduped,
    summary: {
      totalActions: deduped.length,
      criticalCount: deduped.filter((action) => action.priority === 'critical').length,
      estimatedPipelineProtected: deduped.reduce((sum, action) => sum + (action.priority === 'critical' ? (action.estimatedRevenue || 0) : 0), 0),
      estimatedNewRevenue: deduped.reduce((sum, action) => sum + (action.priority !== 'critical' ? (action.estimatedRevenue || 0) : 0), 0),
      coverageGaps: [
        `${input.companyProfile?.company_name || 'The company'} should treat open deals below 75% probability as weak offers that need improvement actions, while deals at or above 75% should focus on confidence and relationship follow-up.`,
        `Current action engine fallback created ${deduped.length} actions covering recovery, acceleration, and cross-sell priorities.`,
      ],
    },
  };
}
