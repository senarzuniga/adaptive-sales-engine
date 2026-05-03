export interface TradeShow {
  id: string;
  name: string;
  industry: string;
  sectors: string[];
  location: string;
  date: string;
  audience_type: string;
  exhibitor_profile: string;
  estimated_attendance: number;
  digital_presence_score: number;
  strategic_fit_score: number;
  total_score: number;
  estimated_cost_range: string;
  recommended_actions: string[];
  scoring_breakdown?: TradeShowScoreBreakdown;
}

export interface TradeShowScoreBreakdown {
  strategic_fit: number;
  audience_quality: number;
  market_relevance: number;
  competition_presence: number;
  cost_efficiency: number;
}

export interface ConfirmedEventCosts {
  stand_cost: number;
  design_cost: number;
  logistics_cost: number;
  travel_cost: number;
  accommodation_cost: number;
  marketing_materials_cost: number;
  equipment_rental_cost: number;
  sponsorship_cost: number;
  total_cost: number;
}

export interface ConfirmedEventRoi {
  leads_generated: number;
  qualified_leads: number;
  opportunities_created: number;
  revenue_generated: number;
  cost_per_lead: number;
  ROI_ratio: number;
}

export interface ConfirmedEvent {
  id: string;
  trade_show_id: string;
  status: 'planned' | 'confirmed' | 'executing' | 'completed';
  stand_size: string;
  location_within_event: string;
  event_date: string;
  venue: string;
  objectives: string[];
  key_messages: string[];
  target_accounts: string[];
  assigned_team: string[];
  costs: ConfirmedEventCosts;
  roi: ConfirmedEventRoi;
  crm_export?: CrmExportStatus;
  linkedin_intelligence?: LinkedInTradeShowIntelligence;
  travel_context?: TravelCostContext;
  created_at?: string;
  updated_at?: string;
}

export interface EventLead {
  id: string;
  event_id?: string;
  name: string;
  company: string;
  role: string;
  interest_level: 'A' | 'B' | 'C';
  notes: string;
  next_action: string;
  created_at?: string;
}

export interface CrmExportStatus {
  provider: 'hubspot' | 'salesforce';
  status: 'exported' | 'not_configured' | 'fallback' | 'failed';
  exported_count: number;
  source: 'remote' | 'fallback';
  message: string;
  last_exported_at: string;
  external_ids?: string[];
}

export interface LinkedInTradeShowIntelligence {
  source: 'provider' | 'fallback';
  summary: string;
  attending_companies: Array<{
    company: string;
    relevance: number;
    rationale: string;
  }>;
  decision_makers: Array<{
    company: string;
    role: string;
    priority: 'high' | 'medium' | 'low';
    outreach_hint: string;
  }>;
  competitor_patterns: CompetitorMessaging[];
  counter_messaging: string[];
  last_updated_at: string;
}

export interface TravelCostContext {
  source: 'provider' | 'fallback';
  travel_distance_km: number;
  country_cost_index: number;
  scenarios: {
    low: ConfirmedEventCosts;
    medium: ConfirmedEventCosts;
    high: ConfirmedEventCosts;
  };
  last_updated_at: string;
}

export interface TradeShowHistoryEntry {
  id: string;
  event_id: string;
  company_id: string;
  action_type: string;
  actor: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface CompetitorMessaging {
  company: string;
  message: string;
  positioning: string;
  keywords: string[];
  campaign_type: string;
}

export function scoreTradeShow(b: TradeShowScoreBreakdown): number {
  return Number((
    (b.strategic_fit * 0.3) +
    (b.audience_quality * 0.2) +
    (b.market_relevance * 0.2) +
    (b.competition_presence * 0.1) +
    (b.cost_efficiency * 0.2)
  ).toFixed(3));
}

export function priorityLabel(totalScore: number): 'HIGH PRIORITY' | 'MEDIUM' | 'LOW' {
  if (totalScore >= 0.72) return 'HIGH PRIORITY';
  if (totalScore >= 0.48) return 'MEDIUM';
  return 'LOW';
}

export function estimateCosts(params: {
  standSize: string;
  teamSize: number;
  travelDistanceKm: number;
  countryCostIndex: number;
}): { low: ConfirmedEventCosts; medium: ConfirmedEventCosts; high: ConfirmedEventCosts } {
  const standBase = params.standSize === 'large' ? 42000 : params.standSize === 'medium' ? 26000 : 14000;
  const travelBase = Math.max(1200, params.teamSize * Math.max(250, params.travelDistanceKm * 0.45));
  const accommodationBase = params.teamSize * 3200;
  const logisticsBase = standBase * 0.18;
  const designBase = standBase * 0.22;
  const marketingMaterials = standBase * 0.12;
  const equipmentRental = standBase * 0.15;
  const sponsorship = standBase * 0.1;

  const build = (multiplier: number): ConfirmedEventCosts => {
    const index = params.countryCostIndex;
    const stand_cost = Math.round(standBase * multiplier * index);
    const design_cost = Math.round(designBase * multiplier * index);
    const logistics_cost = Math.round(logisticsBase * multiplier * index);
    const travel_cost = Math.round(travelBase * multiplier * index);
    const accommodation_cost = Math.round(accommodationBase * multiplier * index);
    const marketing_materials_cost = Math.round(marketingMaterials * multiplier * index);
    const equipment_rental_cost = Math.round(equipmentRental * multiplier * index);
    const sponsorship_cost = Math.round(sponsorship * multiplier * index);
    const total_cost = stand_cost + design_cost + logistics_cost + travel_cost + accommodation_cost + marketing_materials_cost + equipment_rental_cost + sponsorship_cost;
    return {
      stand_cost,
      design_cost,
      logistics_cost,
      travel_cost,
      accommodation_cost,
      marketing_materials_cost,
      equipment_rental_cost,
      sponsorship_cost,
      total_cost,
    };
  };

  return {
    low: build(0.85),
    medium: build(1),
    high: build(1.25),
  };
}

export function buildRoi(costs: ConfirmedEventCosts, params: {
  leadsGenerated: number;
  qualifiedLeads: number;
  opportunitiesCreated: number;
  revenueGenerated: number;
}): ConfirmedEventRoi {
  const costPerLead = params.leadsGenerated > 0 ? Number((costs.total_cost / params.leadsGenerated).toFixed(2)) : 0;
  const roiRatio = costs.total_cost > 0 ? Number((params.revenueGenerated / costs.total_cost).toFixed(2)) : 0;
  return {
    leads_generated: params.leadsGenerated,
    qualified_leads: params.qualifiedLeads,
    opportunities_created: params.opportunitiesCreated,
    revenue_generated: params.revenueGenerated,
    cost_per_lead: costPerLead,
    ROI_ratio: roiRatio,
  };
}

export function classifyLead(interestLevel: 'A' | 'B' | 'C'): string {
  if (interestLevel === 'A') return 'Trigger immediate follow-up with account executive within 24h.';
  if (interestLevel === 'B') return 'Start nurture sequence with relevant content and book discovery call.';
  return 'Track in low-priority queue and re-engage on future campaign.';
}
