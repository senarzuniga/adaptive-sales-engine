import type { CompanyProfile, ProductRecord, StrategyRecord } from '@/store/DataStore';
import { defaultEliteMemory, expectedImpactScore, runEliteLoop, type EliteAgentMemory, type EliteLoopStep } from '@/lib/eliteAgentCore';
import {
  buildRoi,
  classifyLead,
  estimateCosts,
  priorityLabel,
  scoreTradeShow,
  type CompetitorMessaging,
  type ConfirmedEvent,
  type ConfirmedEventCosts,
  type EventLead,
  type TradeShow,
  type TradeShowScoreBreakdown,
} from '@/lib/tradeShows';

export interface TradeShowStrategistInput {
  company: CompanyProfile;
  products: ProductRecord[];
  strategy: StrategyRecord[];
}

export interface AccountTarget {
  account: string;
  revenue_potential: number;
  fit: number;
  engagement_likelihood: number;
  account_score: number;
  talking_points: string[];
  meeting_suggestion: string;
}

export interface EventPlan {
  objectives: string[];
  keyMessages: string[];
  recommendedAssets: string[];
  accountTargets: AccountTarget[];
  competitorMessaging: CompetitorMessaging[];
  counterMessaging: string[];
  differentiationStrategy: string[];
  meetingTemplates: string[];
}

export interface TradeShowStrategistResult {
  recommended: Array<TradeShow & { priority: 'HIGH PRIORITY' | 'MEDIUM' | 'LOW' }>;
  explainability: string[];
  loop: EliteLoopStep<{ candidateCount: number }>;
  memory: EliteAgentMemory<{ candidateCount: number }>;
}

const BASE_EVENTS: Array<Omit<TradeShow, 'strategic_fit_score' | 'total_score'>> = [
  {
    id: 'ts_hannover_messe',
    name: 'Hannover Messe',
    industry: 'Industrial Technology',
    sectors: ['automation', 'digitalization', 'manufacturing'],
    location: 'Hannover, Germany',
    date: '2026-06-14',
    audience_type: 'B2B industrial buyers',
    exhibitor_profile: 'Global industrial technology leaders',
    estimated_attendance: 130000,
    digital_presence_score: 0.89,
    estimated_cost_range: '€90k - €210k',
    recommended_actions: ['Book meetings with top 20 target accounts', 'Showcase predictive maintenance demo'],
  },
  {
    id: 'ts_sps_smart',
    name: 'SPS Smart Production Solutions',
    industry: 'Automation',
    sectors: ['industrial automation', 'controls', 'iot'],
    location: 'Nuremberg, Germany',
    date: '2026-11-24',
    audience_type: 'Automation engineers and plant leaders',
    exhibitor_profile: 'Automation and controls vendors',
    estimated_attendance: 65000,
    digital_presence_score: 0.81,
    estimated_cost_range: '€55k - €140k',
    recommended_actions: ['Run solution workshops', 'Target retrofit opportunities'],
  },
  {
    id: 'ts_fespa_global',
    name: 'FESPA Global Print Expo',
    industry: 'Print & Packaging',
    sectors: ['print', 'packaging', 'industrial signage'],
    location: 'Barcelona, Spain',
    date: '2026-05-19',
    audience_type: 'Commercial print and packaging decision makers',
    exhibitor_profile: 'Print systems, software, finishing',
    estimated_attendance: 39000,
    digital_presence_score: 0.78,
    estimated_cost_range: '€45k - €120k',
    recommended_actions: ['Launch targeted campaign for packaging segment', 'Prepare competitive comparison sheet'],
  },
  {
    id: 'ts_advanced_factories',
    name: 'Advanced Factories',
    industry: 'Smart Manufacturing',
    sectors: ['industry4.0', 'robotics', 'operations'],
    location: 'Barcelona, Spain',
    date: '2026-04-09',
    audience_type: 'Operations and manufacturing leaders',
    exhibitor_profile: 'Smart factory providers and integrators',
    estimated_attendance: 32000,
    digital_presence_score: 0.74,
    estimated_cost_range: '€35k - €95k',
    recommended_actions: ['Promote AI-assisted operations story', 'Schedule account-specific demos'],
  },
];

let strategistMemory = defaultEliteMemory<{ candidateCount: number }>();

const parseStrategicKeywords = (input: TradeShowStrategistInput): string[] => {
  const raw = [
    input.company.industry,
    input.company.main_products,
    input.company.current_challenges,
    input.company.strategic_goals,
    ...input.products.map((p) => p.name),
    ...input.products.map((p) => p.type),
    ...input.strategy.map((s) => s.productFamily),
  ].join(' ').toLowerCase();

  return raw
    .split(/[^a-z0-9]+/g)
    .filter((w) => w.length > 3)
    .filter((w, i, arr) => arr.indexOf(w) === i)
    .slice(0, 50);
};

const breakdownForEvent = (event: Omit<TradeShow, 'strategic_fit_score' | 'total_score'>, keywords: string[]): TradeShowScoreBreakdown => {
  const sectorHits = event.sectors.filter((s) => keywords.some((k) => s.includes(k) || k.includes(s))).length;
  const strategic_fit = Math.min(1, 0.45 + sectorHits * 0.18);
  const audience_quality = Math.min(1, 0.35 + Math.min(event.estimated_attendance / 150000, 0.5));
  const market_relevance = Math.min(1, 0.4 + (event.digital_presence_score * 0.6));
  const competition_presence = Math.min(1, 0.5 + (event.exhibitor_profile.toLowerCase().includes('global') ? 0.3 : 0.12));
  const cost_efficiency = event.estimated_cost_range.includes('210k') ? 0.45 : event.estimated_cost_range.includes('140k') ? 0.63 : 0.76;
  return { strategic_fit, audience_quality, market_relevance, competition_presence, cost_efficiency };
};

export function runTradeShowStrategistAgent(input: TradeShowStrategistInput): TradeShowStrategistResult {
  const keywords = parseStrategicKeywords(input);

  const recommended = BASE_EVENTS.map((event) => {
    const breakdown = breakdownForEvent(event, keywords);
    const total = scoreTradeShow(breakdown);
    const strategic_fit_score = Number(breakdown.strategic_fit.toFixed(3));
    return {
      ...event,
      strategic_fit_score,
      total_score: total,
      scoring_breakdown: breakdown,
      priority: priorityLabel(total),
    };
  }).sort((a, b) => b.total_score - a.total_score);

  const explainability = recommended.map((event) => {
    const accountsEstimate = Math.round((event.estimated_attendance / 10000) * (event.total_score * 10));
    return `${event.name}: strategic fit ${event.strategic_fit_score.toFixed(2)}, expected target accounts ${accountsEstimate}, expected ROI potential ${(event.total_score * 4.2).toFixed(1)}x.`;
  });

  const avgScore = recommended.reduce((sum, ev) => sum + ev.total_score, 0) / Math.max(1, recommended.length);
  const loop = runEliteLoop({
    observation: { candidateCount: recommended.length },
    understand: 'Event attractiveness depends on strategic fit, audience quality, market relevance, competitor pressure, and cost efficiency.',
    hypotheses: [
      'Higher strategic fit and audience quality improve pipeline generation probability.',
      'Cost-efficient events with high digital presence improve ROI reliability.',
    ],
    action: 'Ranked events and generated attendance recommendations with explainability.',
    expectedOutcome: 0.68,
    realOutcome: Number(avgScore.toFixed(3)),
    reason: 'Prioritized events with strongest strategic and revenue potential alignment.',
    dataUsed: ['company profile', 'product portfolio', 'strategy priorities', 'event benchmark attributes'],
    expectedImpact: 'Higher event ROI and better account meeting conversion.',
  });

  strategistMemory.shortTerm = [{ candidateCount: recommended.length }];
  strategistMemory.longTerm.push({
    actionId: `event_ranking_${Date.now()}`,
    context: `${input.company.company_name || 'company'} event ranking cycle`,
    expectedOutcome: loop.measurement.expectedOutcome,
    realOutcome: loop.measurement.realOutcome,
    delta: loop.measurement.delta,
    timestamp: new Date().toISOString(),
  });

  return {
    recommended,
    explainability,
    loop,
    memory: strategistMemory,
  };
}

export function generateEventPlan(params: {
  event: TradeShow;
  company: CompanyProfile;
  products: ProductRecord[];
  strategy: StrategyRecord[];
}): EventPlan {
  const keyProducts = params.products.slice(0, 4).map((p) => p.name);
  const topAccounts = [
    'Atlas Industrial Group',
    'Northline Manufacturing',
    'Iberia Process Systems',
    'Vertex Energy Services',
    'Continental Packaging Solutions',
  ];

  const accountTargets: AccountTarget[] = topAccounts.map((account, idx) => {
    const revenue_potential = 0.56 + (idx * 0.07);
    const fit = 0.64 + (idx % 3) * 0.08;
    const engagement_likelihood = 0.51 + ((4 - idx) * 0.06);
    const account_score = Number(((revenue_potential * 0.4) + (fit * 0.3) + (engagement_likelihood * 0.3)).toFixed(3));
    return {
      account,
      revenue_potential,
      fit,
      engagement_likelihood,
      account_score,
      talking_points: [
        `Show quantified impact of ${keyProducts[0] || 'your top offering'}.`,
        'Address integration speed and expected payback period.',
      ],
      meeting_suggestion: `Invite ${account} to a focused 30-minute value engineering meeting during day ${idx % 3 + 1}.`,
    };
  }).sort((a, b) => b.account_score - a.account_score);

  const competitorMessaging: CompetitorMessaging[] = [
    {
      company: 'Competitor A',
      message: 'We deliver fastest deployment with lower integration risk.',
      positioning: 'Speed and simplicity',
      keywords: ['fast deployment', 'risk-free', 'modular'],
      campaign_type: 'Launch campaign',
    },
    {
      company: 'Competitor B',
      message: 'Our platform reduces operational costs through automation.',
      positioning: 'Efficiency and cost reduction',
      keywords: ['efficiency', 'automation', 'operational savings'],
      campaign_type: 'Thought leadership',
    },
  ];

  const counterMessaging = [
    `Differentiate with proof: show outcome metrics from ${params.company.company_name || 'recent deployments'}.`,
    'Lead with quantified total value rather than feature parity.',
    'Anchor messaging on faster time-to-impact and lifecycle support quality.',
  ];

  return {
    objectives: [
      'Generate 120 leads with at least 40 qualified (A/B).',
      'Schedule 25 strategic meetings with target accounts.',
      'Create €1.8M influenced pipeline within 45 days after event.',
    ],
    keyMessages: [
      `${params.company.company_name || 'Our company'} helps industrial teams improve productivity with measurable ROI.`,
      'Our approach combines implementation speed, reliability, and lifecycle value.',
      'We outperform alternatives through stronger business outcomes, not only technical specs.',
    ],
    recommendedAssets: [
      'Case study deck: ROI outcomes in similar accounts',
      'Demo video: end-to-end workflow and analytics',
      'One-page comparison: differentiation vs major competitors',
      'Presentation: implementation roadmap by segment',
    ],
    accountTargets,
    competitorMessaging,
    counterMessaging,
    differentiationStrategy: [
      'Build category narrative around business outcomes and operational resilience.',
      'Use proof-based messaging with quantified before/after metrics.',
      'Prioritize account-specific mini-briefs for top 20 meetings.',
    ],
    meetingTemplates: [
      `Hi {{name}}, we will be at ${params.event.name}. We prepared a short session focused on improving {{priority_metric}} for ${params.company.company_name || 'your team'}. Would a 20-minute meeting on day 2 work for you?`,
      `Our team is showcasing practical approaches for ${params.event.industry}. If useful, we can share a tailored benchmark for {{company}} during the event.`,
    ],
  };
}

export function createConfirmedEventFromTradeShow(event: TradeShow): ConfirmedEvent {
  const scenarios = estimateCosts({
    standSize: 'medium',
    teamSize: 6,
    travelDistanceKm: 1200,
    countryCostIndex: 1,
  });
  const baseCosts: ConfirmedEventCosts = scenarios.medium;

  return {
    id: `confirmed_${event.id}_${Date.now()}`,
    trade_show_id: event.id,
    status: 'confirmed',
    stand_size: 'medium',
    location_within_event: 'Main hall',
    event_date: event.date,
    venue: event.location,
    objectives: [],
    key_messages: [],
    target_accounts: [],
    assigned_team: ['Sales Director', 'KAM Lead', 'Pre-sales Engineer'],
    costs: baseCosts,
    roi: buildRoi(baseCosts, {
      leadsGenerated: 0,
      qualifiedLeads: 0,
      opportunitiesCreated: 0,
      revenueGenerated: 0,
    }),
  };
}

export function enrichLeadWithNextAction(
  lead: Omit<EventLead, 'next_action' | 'id'> & Partial<Pick<EventLead, 'id' | 'created_at' | 'event_id'>>,
): EventLead {
  return {
    ...lead,
    id: lead.id || `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    next_action: classifyLead(lead.interest_level),
    created_at: lead.created_at || new Date().toISOString(),
  };
}

export function decideNextBestAction(params: {
  revenueProbability: number;
  value: number;
  cost: number;
  effort: number;
}): { action: string; expected_impact: number } {
  const expected_impact = expectedImpactScore(params);
  const action = expected_impact > 0
    ? 'Accelerate this action and assign execution owner now.'
    : 'Defer and test a lower-cost alternative action.';
  return { action, expected_impact };
}
