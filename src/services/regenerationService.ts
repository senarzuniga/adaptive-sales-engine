import { supabase } from '@/integrations/supabase/client';

export interface RegenerationStartOptions {
  companyId?: string | null;
  keepTemplates?: boolean;
  dryRun?: boolean;
  userId?: string | null;
  reason?: string;
}

export interface RegenerationLog {
  id: string;
  company_id: string | null;
  started_at: string;
  completed_at: string | null;
  status: 'running' | 'waiting_manual_resolution' | 'completed' | 'failed' | 'rolled_back' | 'dry_run';
  pre_entity_count: number;
  post_entity_count: number;
  pre_document_count: number;
  post_document_count: number;
  entities_processed: number;
  documents_processed: number;
  unresolved_contradictions: number;
  execution_log: Array<Record<string, unknown>>;
  agents_executed: Array<Record<string, unknown>>;
}

export interface PendingContradiction {
  id: string;
  entity_hash: string;
  entity_name: string;
  field_name: string;
  value_a: string;
  value_b: string;
  source_a: string;
  source_b: string;
  status: string;
  confidence_score: number | null;
  low_confidence: boolean;
  created_at: string;
}

export interface RegenerationStatusResponse {
  log: RegenerationLog | null;
  pendingContradictions: PendingContradiction[];
}

const DEFAULT_REASON = 'regeneration_after_protocol_upgrade';

function dataApiUrl(path: string, query?: URLSearchParams) {
  const base = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/data-api${path}`;
  if (!query || [...query.keys()].length === 0) return base;
  return `${base}?${query.toString()}`;
}

async function readDataApiJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || `Request failed with status ${response.status}`);
  }
  return payload as T;
}

export async function startRegeneration(options: RegenerationStartOptions = {}) {
  const { data, error } = await supabase.functions.invoke('data-api', {
    body: {
      action: 'admin.regenerate.start',
      companyId: options.companyId || null,
      keepTemplates: options.keepTemplates ?? false,
      dryRun: options.dryRun ?? false,
      userId: options.userId || null,
      reason: options.reason || DEFAULT_REASON,
    },
  });

  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data as { regenerationId: string; status: string };
}

export async function fetchRegenerationStatus(params: { companyId?: string | null; regenerationId?: string | null } = {}) {
  const query = new URLSearchParams();
  query.set('action', 'admin.regenerate.status');
  if (params.companyId) query.set('companyId', params.companyId);
  if (params.regenerationId) query.set('regenerationId', params.regenerationId);

  const payload = await readDataApiJson<RegenerationStatusResponse>(dataApiUrl('/api/admin/regenerate/status', query));
  return payload;
}

export async function rollbackRegeneration(regenerationId: string) {
  const { data, error } = await supabase.functions.invoke('data-api', {
    body: {
      action: 'admin.regenerate.rollback',
      regenerationId,
    },
  });

  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data as { regenerationId: string; status: string };
}

export async function resolvePendingContradiction(id: string, resolvedValue: string, resolvedByUserId?: string | null) {
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-contradictions/api/contradictions/${encodeURIComponent(id)}/resolve`, {
    method: 'PATCH',
    headers: {
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      resolvedValue,
      resolvedByUserId: resolvedByUserId || null,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || `Could not resolve contradiction ${id}`);
  }
  return payload;
}

export async function regenerateAllData(keepTemplates = false, companyId?: string | null) {
  return startRegeneration({
    keepTemplates,
    companyId: companyId || null,
    reason: DEFAULT_REASON,
  });
}
