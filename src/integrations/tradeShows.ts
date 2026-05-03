import { supabase } from '@/integrations/supabase/client';
import { classifyEdgeRuntimeError, invokeEdgeWithRetry } from '@/lib/edgeStability';
import {
  estimateCosts,
  type ConfirmedEvent,
  type CrmExportStatus,
  type EventLead,
  type LinkedInTradeShowIntelligence,
  type TradeShowHistoryEntry,
  type TravelCostContext,
} from '@/lib/tradeShows';

const isSupabaseConfigured =
  !!import.meta.env.VITE_SUPABASE_URL &&
  import.meta.env.VITE_SUPABASE_URL !== 'https://placeholder.supabase.co';

const LS = {
  get: <T,>(key: string, fallback: T): T => {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) as T : fallback;
    } catch {
      return fallback;
    }
  },
  set: <T,>(key: string, value: T) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore storage quota issues and continue with in-memory state.
    }
  },
};

export interface TradeShowWorkspace {
  events: ConfirmedEvent[];
  leadsByEvent: Record<string, EventLead[]>;
  history: TradeShowHistoryEntry[];
}

export interface ExportTradeShowLeadsInput {
  companyId: string;
  event: ConfirmedEvent;
  leads: EventLead[];
  provider: 'hubspot' | 'salesforce';
  companyName?: string;
}

export interface FetchLinkedInIntelligenceInput {
  companyId: string;
  event: ConfirmedEvent;
  eventName: string;
  industry: string;
  location: string;
  targetAccounts: string[];
  companyName?: string;
}

export interface EstimateTravelCostsInput {
  event: ConfirmedEvent;
  eventName: string;
  location: string;
  teamSize: number;
  travelDistanceKm: number;
  countryCostIndex: number;
}

type LocalWorkspaceShape = TradeShowWorkspace;

const workspaceKey = (companyId: string) => `acs_trade_shows_${companyId}`;

const emptyWorkspace = (): TradeShowWorkspace => ({ events: [], leadsByEvent: {}, history: [] });

const readLocalWorkspace = (companyId: string): LocalWorkspaceShape => LS.get(workspaceKey(companyId), emptyWorkspace());

const writeLocalWorkspace = (companyId: string, workspace: LocalWorkspaceShape) => {
  LS.set(workspaceKey(companyId), workspace);
};

const asRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
);

const asStringArray = (value: unknown): string[] => Array.isArray(value)
  ? value.filter((entry): entry is string => typeof entry === 'string')
  : [];

const mapConfirmedEvent = (event: any): ConfirmedEvent => ({
  id: String(event?.id || ''),
  trade_show_id: String(event?.trade_show_id || ''),
  status: event?.status || 'confirmed',
  stand_size: String(event?.stand_size || 'medium'),
  location_within_event: String(event?.location_within_event || 'Main hall'),
  event_date: String(event?.event_date || ''),
  venue: String(event?.venue || ''),
  objectives: asStringArray(event?.objectives),
  key_messages: asStringArray(event?.key_messages),
  target_accounts: asStringArray(event?.target_accounts),
  assigned_team: asStringArray(event?.assigned_team),
  costs: event?.costs,
  roi: event?.roi,
  crm_export: event?.crm_export as CrmExportStatus | undefined,
  linkedin_intelligence: event?.linkedin_intelligence as LinkedInTradeShowIntelligence | undefined,
  travel_context: event?.travel_context as TravelCostContext | undefined,
  created_at: event?.created_at,
  updated_at: event?.updated_at,
});

const mapEventLead = (lead: any): EventLead => ({
  id: String(lead?.id || `lead_${Date.now()}`),
  event_id: lead?.event_id ? String(lead.event_id) : undefined,
  name: String(lead?.name || ''),
  company: String(lead?.company || ''),
  role: String(lead?.role || ''),
  interest_level: lead?.interest_level === 'A' || lead?.interest_level === 'C' ? lead.interest_level : 'B',
  notes: String(lead?.notes || ''),
  next_action: String(lead?.next_action || ''),
  created_at: lead?.created_at,
});

const mapHistoryEntry = (entry: any): TradeShowHistoryEntry => ({
  id: String(entry?.id || `history_${Date.now()}`),
  event_id: String(entry?.event_id || ''),
  company_id: String(entry?.company_id || ''),
  action_type: String(entry?.action_type || 'unknown'),
  actor: String(entry?.actor || 'system'),
  payload: asRecord(entry?.payload),
  created_at: String(entry?.created_at || new Date().toISOString()),
});

const normalizeWorkspace = (payload: any): TradeShowWorkspace => {
  const events = Array.isArray(payload?.events) ? payload.events.map(mapConfirmedEvent) : [];
  const leadRows = Array.isArray(payload?.leads) ? payload.leads.map(mapEventLead) : [];
  const history = Array.isArray(payload?.history) ? payload.history.map(mapHistoryEntry) : [];

  const leadsByEvent = leadRows.reduce<Record<string, EventLead[]>>((acc, lead) => {
    if (!lead.event_id) return acc;
    acc[lead.event_id] = [...(acc[lead.event_id] || []), lead];
    return acc;
  }, {});

  return { events, leadsByEvent, history };
};

const inferCountryCostIndex = (location: string): number => {
  const lower = location.toLowerCase();
  if (lower.includes('germany') || lower.includes('munich') || lower.includes('hannover')) return 1.12;
  if (lower.includes('spain') || lower.includes('barcelona')) return 0.94;
  if (lower.includes('france')) return 1.08;
  if (lower.includes('uk') || lower.includes('london')) return 1.18;
  return 1;
};

const fallbackTravelContext = (input: EstimateTravelCostsInput, message?: string): TravelCostContext => ({
  source: 'fallback',
  travel_distance_km: input.travelDistanceKm,
  country_cost_index: input.countryCostIndex,
  scenarios: estimateCosts({
    standSize: input.event.stand_size,
    teamSize: input.teamSize,
    travelDistanceKm: input.travelDistanceKm,
    countryCostIndex: input.countryCostIndex,
  }),
  last_updated_at: new Date().toISOString(),
});

const fallbackLinkedInIntelligence = (input: FetchLinkedInIntelligenceInput, message?: string): LinkedInTradeShowIntelligence => ({
  source: 'fallback',
  summary: message || `${input.eventName} intelligence prepared locally from target-account priorities and event context.`,
  attending_companies: input.targetAccounts.slice(0, 5).map((account, index) => ({
    company: account,
    relevance: Number((0.88 - index * 0.08).toFixed(2)),
    rationale: `High-fit account for ${input.industry.toLowerCase()} outreach during ${input.eventName}.`,
  })),
  decision_makers: input.targetAccounts.slice(0, 4).map((account, index) => ({
    company: account,
    role: index % 2 === 0 ? 'Commercial Director' : 'Operations Director',
    priority: index < 2 ? 'high' : 'medium',
    outreach_hint: `Reference ${input.eventName} benchmarks and propose a 20-minute working session.`,
  })),
  competitor_patterns: [
    {
      company: 'Competitor A',
      message: 'Fast deployment with lower operational disruption.',
      positioning: 'Deployment speed',
      keywords: ['deployment', 'speed', 'low disruption'],
      campaign_type: 'Trade show campaign',
    },
    {
      company: 'Competitor B',
      message: 'Reduce cost-to-serve through process automation.',
      positioning: 'Cost efficiency',
      keywords: ['efficiency', 'automation', 'cost reduction'],
      campaign_type: 'Demand generation',
    },
  ],
  counter_messaging: [
    'Lead with quantified business impact instead of generic feature comparisons.',
    'Anchor outreach on lifecycle value and implementation reliability.',
    'Use target-account proof points gathered from the current portfolio.',
  ],
  last_updated_at: new Date().toISOString(),
});

const fallbackCrmExport = (input: ExportTradeShowLeadsInput, message: string): CrmExportStatus => ({
  provider: input.provider,
  status: 'fallback',
  exported_count: input.leads.length,
  source: 'fallback',
  message,
  last_exported_at: new Date().toISOString(),
  external_ids: input.leads.map((lead) => lead.id),
});

export async function loadTradeShowWorkspace(companyId: string): Promise<TradeShowWorkspace> {
  if (!companyId) return emptyWorkspace();

  if (!isSupabaseConfigured) {
    return readLocalWorkspace(companyId);
  }

  try {
    const data = await invokeEdgeWithRetry<{
      events: unknown[];
      leads: unknown[];
      history: unknown[];
    }>('trade-show-persistence', { action: 'load', companyId }, { fallbackLabel: 'local trade show workspace' });
    return normalizeWorkspace(data);
  } catch {
    return readLocalWorkspace(companyId);
  }
}

export async function upsertConfirmedEvent(companyId: string, event: ConfirmedEvent): Promise<ConfirmedEvent> {
  if (!companyId) return event;

  if (!isSupabaseConfigured) {
    const workspace = readLocalWorkspace(companyId);
    const nextEvents = [event, ...workspace.events.filter((entry) => entry.id !== event.id)];
    writeLocalWorkspace(companyId, { ...workspace, events: nextEvents });
    return event;
  }

  try {
    const data = await invokeEdgeWithRetry<{ event: unknown }>('trade-show-persistence', {
      action: 'upsert_event',
      companyId,
      event,
    }, { fallbackLabel: 'local trade show persistence' });
    return mapConfirmedEvent(data.event);
  } catch {
    const workspace = readLocalWorkspace(companyId);
    const nextEvents = [event, ...workspace.events.filter((entry) => entry.id !== event.id)];
    writeLocalWorkspace(companyId, { ...workspace, events: nextEvents });
    return event;
  }
}

export async function insertTradeShowLead(companyId: string, eventId: string, lead: EventLead): Promise<EventLead> {
  if (!companyId) return { ...lead, event_id: eventId };

  const withEvent = { ...lead, event_id: eventId };
  if (!isSupabaseConfigured) {
    const workspace = readLocalWorkspace(companyId);
    writeLocalWorkspace(companyId, {
      ...workspace,
      leadsByEvent: {
        ...workspace.leadsByEvent,
        [eventId]: [...(workspace.leadsByEvent[eventId] || []), withEvent],
      },
    });
    return withEvent;
  }

  try {
    const data = await invokeEdgeWithRetry<{ lead: unknown }>('trade-show-persistence', {
      action: 'insert_lead',
      companyId,
      eventId,
      lead: withEvent,
    }, { fallbackLabel: 'local trade show lead capture' });
    return mapEventLead(data.lead);
  } catch {
    const workspace = readLocalWorkspace(companyId);
    writeLocalWorkspace(companyId, {
      ...workspace,
      leadsByEvent: {
        ...workspace.leadsByEvent,
        [eventId]: [...(workspace.leadsByEvent[eventId] || []), withEvent],
      },
    });
    return withEvent;
  }
}

export async function appendTradeShowHistory(
  companyId: string,
  eventId: string,
  actionType: string,
  payload: Record<string, unknown>,
  actor = 'copilot',
): Promise<TradeShowHistoryEntry> {
  const entry: TradeShowHistoryEntry = {
    id: `history_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    company_id: companyId,
    event_id: eventId,
    action_type: actionType,
    actor,
    payload,
    created_at: new Date().toISOString(),
  };

  if (!companyId || !isSupabaseConfigured) {
    if (companyId) {
      const workspace = readLocalWorkspace(companyId);
      writeLocalWorkspace(companyId, { ...workspace, history: [entry, ...workspace.history] });
    }
    return entry;
  }

  try {
    const data = await invokeEdgeWithRetry<{ historyEntry: unknown }>('trade-show-persistence', {
      action: 'append_history',
      companyId,
      eventId,
      actor,
      actionType,
      payload,
    }, { fallbackLabel: 'local trade show history' });
    return mapHistoryEntry(data.historyEntry);
  } catch {
    const workspace = readLocalWorkspace(companyId);
    writeLocalWorkspace(companyId, { ...workspace, history: [entry, ...workspace.history] });
    return entry;
  }
}

export async function exportTradeShowLeads(input: ExportTradeShowLeadsInput): Promise<CrmExportStatus> {
  if (!isSupabaseConfigured) {
    return fallbackCrmExport(input, 'Supabase is not configured, so leads were prepared for manual CRM export.');
  }

  try {
    const data = await invokeEdgeWithRetry<CrmExportStatus>('trade-show-crm-export', input, {
      fallbackLabel: 'manual CRM export package',
    });
    return data;
  } catch (error) {
    const details = classifyEdgeRuntimeError(error, 'manual CRM export package');
    return fallbackCrmExport(input, details.description);
  }
}

export async function fetchLinkedInTradeShowIntelligence(input: FetchLinkedInIntelligenceInput): Promise<LinkedInTradeShowIntelligence> {
  if (!isSupabaseConfigured) {
    return fallbackLinkedInIntelligence(input, 'Supabase is not configured, so local LinkedIn intelligence was generated.');
  }

  try {
    const data = await invokeEdgeWithRetry<LinkedInTradeShowIntelligence>('trade-show-linkedin-enrichment', input, {
      fallbackLabel: 'local LinkedIn intelligence',
    });
    return data;
  } catch (error) {
    const details = classifyEdgeRuntimeError(error, 'local LinkedIn intelligence');
    return fallbackLinkedInIntelligence(input, details.description);
  }
}

export async function estimateTradeShowTravelCosts(input: EstimateTravelCostsInput): Promise<TravelCostContext> {
  if (!isSupabaseConfigured) {
    return fallbackTravelContext(input, 'Supabase is not configured, so travel costs were estimated locally.');
  }

  try {
    const data = await invokeEdgeWithRetry<TravelCostContext>('trade-show-travel-costs', input, {
      fallbackLabel: 'local travel cost estimation',
    });
    return data;
  } catch (error) {
    const details = classifyEdgeRuntimeError(error, 'local travel cost estimation');
    return fallbackTravelContext(input, details.description);
  }
}

export function deriveTravelInputs(event: ConfirmedEvent, location: string, headquarters?: string) {
  const normalizedHeadquarters = (headquarters || '').toLowerCase();
  const normalizedLocation = location.toLowerCase();
  const sameCountry = normalizedHeadquarters && normalizedLocation.includes(normalizedHeadquarters);

  return {
    teamSize: Math.max(3, event.assigned_team.length || 6),
    travelDistanceKm: sameCountry ? 320 : 1200,
    countryCostIndex: inferCountryCostIndex(location),
  };
}

export function persistWorkspaceSnapshot(companyId: string, workspace: TradeShowWorkspace) {
  if (!companyId) return;
  writeLocalWorkspace(companyId, workspace);
}