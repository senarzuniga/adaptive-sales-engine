export interface SalesArchitectureRegion {
  region: string;
  pipeline: number;
  customers: number;
  neglected: number;
}

export interface SalesArchitectureKam {
  name: string;
  pipeline: number;
  sold: number;
  neglected: number;
  regions: string[];
}

export interface SalesArchitectureContext {
  companyName: string;
  currentRevenue: number;
  targetRevenue: number;
  teamSize: number;
  businessDescription: string;
  strategicGoals: string;
  totalPipeline: number;
  totalNeglected: number;
  regions: SalesArchitectureRegion[];
  kams: SalesArchitectureKam[];
}

interface ArchitectureOption {
  name: string;
  model: string;
  businessImpact: number;
  technicalRisk: number;
  complexity: number;
  maintainability: number;
  scalability: number;
  score: number;
  rationale: string;
}

const fmt = (v: number) =>
  v >= 1_000_000 ? `€${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `€${(v / 1_000).toFixed(0)}K` : `€${v.toFixed(0)}`;

const scoreOption = (option: Omit<ArchitectureOption, 'score'>): ArchitectureOption => ({
  ...option,
  score: Number(((
    option.businessImpact * 2.0 +
    (10 - option.technicalRisk) * 1.5 +
    (10 - option.complexity) * 0.5 +
    option.maintainability * 1.0 +
    option.scalability * 1.0
  ) / 6.0).toFixed(1)),
});

export function buildSalesArchitectureFallbackRecommendation(context: SalesArchitectureContext) {
  const sortedRegions = [...context.regions].sort((a, b) => b.pipeline - a.pipeline);
  const sortedKams = [...context.kams].sort((a, b) => b.pipeline - a.pipeline);
  const primaryRegion = sortedRegions[0];
  const secondaryRegion = sortedRegions[1];
  const topKam = sortedKams[0];
  const neglectedShare = context.totalPipeline > 0 ? (context.totalNeglected / context.totalPipeline) * 100 : 0;
  const revenueGap = Math.max(context.targetRevenue - context.currentRevenue, 0);

  const options = [
    scoreOption({
      name: 'Centralized HQ Only',
      model: 'Direct team concentrated at headquarters',
      businessImpact: primaryRegion && context.regions.length <= 2 ? 6 : 4,
      technicalRisk: 3,
      complexity: 3,
      maintainability: 7,
      scalability: 4,
      rationale: 'Low-cost model, but weak when multiple regions and neglected deals require local coverage.',
    }),
    scoreOption({
      name: 'Hybrid Hub-and-Spoke',
      model: 'HQ control plus regional reps, agents, and channel partners',
      businessImpact: 9,
      technicalRisk: 4,
      complexity: 5,
      maintainability: 8,
      scalability: 9,
      rationale: 'Balances control, speed, and international reach while staying scalable and operationally safe.',
    }),
    scoreOption({
      name: 'Regional Partner Network',
      model: 'Heavy use of agents and distributors in most regions',
      businessImpact: 7,
      technicalRisk: 5,
      complexity: 4,
      maintainability: 6,
      scalability: 8,
      rationale: 'Fast to expand geographically, but margin control and execution quality can become inconsistent.',
    }),
  ].sort((a, b) => b.score - a.score);

  const selected = options.find((option) => option.businessImpact >= 7 && option.technicalRisk <= 4) || options[0];

  const marketSegmentation = [
    `Strategic key accounts: large multinational or multi-site customers in ${primaryRegion?.region || 'core markets'} with complex buying cycles and high lifetime value.`,
    `Growth accounts: mid-size industrial customers in ${secondaryRegion?.region || 'secondary regions'} that can be expanded through cross-sell and stronger opportunity discipline.`,
    'Channel accounts: smaller or distant accounts served through agents, distributors, or finders to reduce fixed-cost coverage.',
    'Service and installed-base accounts: customers best monetized through recurring service contracts, spare parts, and upgrade opportunities.',
  ];

  const geographicModel = [
    `Headquarters should own pricing governance, CRM discipline, and major bid approvals while ${primaryRegion?.region || 'the primary market'} gets direct commercial focus.`,
    `Use regional reps or exclusive agents in the top opportunity regions${primaryRegion ? `, starting with ${primaryRegion.region}` : ''}${secondaryRegion ? ` and ${secondaryRegion.region}` : ''}.`,
    'Use low-fixed-cost coverage for exploratory markets until recurring pipeline justifies direct hires.',
  ];

  const channelStrategy = [
    'Direct sales for strategic and technically complex opportunities.',
    'Exclusive agents for regions where local trust and market access matter more than daily coordination.',
    'Distributors or partners for long-tail demand and lower-ticket opportunities.',
    'Service channel as a separate recurring-revenue engine with contract renewals, upgrades, and installed-base coverage.',
  ];

  const pricingArchitecture = [
    'Set value-based pricing for differentiated offers and outcome-driven service packages.',
    'Use price floors and approval gates for discount control by segment, region, and channel.',
    'Separate pricing logic for direct sales, agents, and distributors so margin leakage is visible and controlled.',
    'Link premium pricing to service response times, uptime guarantees, technical support depth, and bundled value.',
  ];

  const opportunityManagement = [
    `Treat ${fmt(context.totalNeglected)} of neglected pipeline as the first recovery program with mandatory weekly review.`,
    'Define clear stage exit criteria, owner accountability, next action dates, and close plans for all live opportunities.',
    'Use a simple cadence: weekly pipeline review, monthly regional review, and quarterly strategic account review.',
    'Escalate stalled deals early and trigger support from product, pricing, or leadership before opportunities become inactive.',
  ];

  const resourceAllocation = [
    'Protect strategic account capacity by moving quote prep, CRM updates, and follow-up admin to inside sales or back-office roles.',
    `Prioritize field and agent time toward the highest-pipeline regions${primaryRegion ? `, especially ${primaryRegion.region}` : ''}.`,
    `Rebalance overloaded ownership if ${topKam?.name || 'the current lead'} is covering too many regions or neglected deals.`,
    `Invest first in roles that close the revenue gap of ${fmt(revenueGap)} with the lowest fixed-cost risk.`,
  ];

  const scoreLines = options.map((option) =>
    `- ${option.name} — Score ${option.score}/10 | Impact ${option.businessImpact} | Risk ${option.technicalRisk} | Complexity ${option.complexity} | Maintainability ${option.maintainability} | Scalability ${option.scalability}`
  );

  return `## Global Sales Architecture — ${context.companyName || 'Company'}

### Goal: Move from Opportunistic Sales → Systematic Growth
Build a scalable commercial system that improves coverage, reduces neglected opportunities, and converts pipeline into predictable revenue growth.

### Option Scorecard
${scoreLines.join('\n')}

### Recommended Model
**${selected.name}**
${selected.rationale}

### Market Segmentation
${marketSegmentation.map((item) => `- ${item}`).join('\n')}

### Geographic Sales Model
${geographicModel.map((item) => `- ${item}`).join('\n')}

### Channel Strategy
${channelStrategy.map((item) => `- ${item}`).join('\n')}

### Pricing Architecture
${pricingArchitecture.map((item) => `- ${item}`).join('\n')}

### Opportunity Management
${opportunityManagement.map((item) => `- ${item}`).join('\n')}

### Sales Resource Allocation
${resourceAllocation.map((item) => `- ${item}`).join('\n')}

### 90-Day Priorities
- Recover neglected pipeline above ${fmt(context.totalNeglected)} with named owners and due dates.
- Formalize territory rules, channel rules, and pricing approval thresholds.
- Add or reassign inside sales / back-office support to protect selling time.

### 6–12 Month Roadmap
- Expand the hybrid model into the highest-return regions first.
- Add channel enablement and service-commercial plays for recurring revenue.
- Track win rate, speed-to-quote, discount leakage, and region productivity monthly.

### Systematic Growth KPIs
- Win rate improvement in priority regions
- Neglected pipeline reduced below 10%
- Revenue per seller and per channel
- Gross margin by region and channel
- Share of recurring or service-linked revenue

### Critical Notes
- Current pipeline: ${fmt(context.totalPipeline)}
- Neglected share: ${neglectedShare.toFixed(1)}%
- Revenue gap to target: ${fmt(revenueGap)}
- Strategic context: ${context.strategicGoals || context.businessDescription || 'Not provided'}`;
}
