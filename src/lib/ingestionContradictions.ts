import { supabase } from '@/integrations/supabase/client';
import type { IngestionContradiction } from '@/agents/dataManagementAgent';

export interface ContradictionResolutionPayload {
  resolvedValue: string;
  resolvedByUserId?: string;
}

const toError = (error: unknown) => (error instanceof Error ? error.message : String(error));

export async function persistIngestionContradictions(params: {
  companyId: string;
  contradictions: IngestionContradiction[];
  uploadDocIds: string[];
}) {
  if (!params.companyId || params.contradictions.length === 0) return;

  const rows = params.contradictions.map((item) => ({
    id: item.id,
    company_id: params.companyId,
    entity_hash: item.entity_hash,
    entity_name: item.entity_name,
    field_name: item.field_name,
    value_a: item.value_a,
    value_b: item.value_b,
    source_a: item.source_a,
    source_b: item.source_b,
    source_doc_ids: item.source_doc_ids?.length ? item.source_doc_ids : params.uploadDocIds,
    status: item.status || 'pending',
    resolved_value: item.resolved_value || null,
    resolved_by_user_id: item.resolved_by_user_id || null,
    low_confidence: item.low_confidence ?? false,
    confidence_score: item.confidence_score ?? null,
    created_at: item.timestamp,
  }));

  const { error } = await (supabase.from('ingestion_contradictions' as any).upsert(rows as any));
  if (error) throw new Error(error.message);
}

export async function fetchPendingContradictions(params: {
  companyId: string;
  uploadDocIds: string[];
}) {
  if (!params.companyId) return [] as IngestionContradiction[];

  const { data, error } = await supabase
    .from('ingestion_contradictions' as any)
    .select('*')
    .eq('company_id', params.companyId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  const allRows = (data || []) as any[];
  if (params.uploadDocIds.length === 0) {
    return allRows as IngestionContradiction[];
  }

  return allRows.filter((row) => {
    const ids = Array.isArray(row.source_doc_ids) ? row.source_doc_ids : [];
    return ids.some((id: string) => params.uploadDocIds.includes(id));
  }) as IngestionContradiction[];
}

export async function resolveIngestionContradiction(id: string, payload: ContradictionResolutionPayload) {
  const endpoint = `/api/contradictions/${encodeURIComponent(id)}/resolve`;
  try {
    const response = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      return await response.json().catch(() => ({ success: true }));
    }
  } catch {
    // Fall back to direct DB update when the API route is not mounted in local SPA mode.
  }

  const { error } = await supabase
    .from('ingestion_contradictions' as any)
    .update({
      status: 'resolved',
      resolved_value: payload.resolvedValue,
      resolved_by_user_id: payload.resolvedByUserId || null,
      resolved_at: new Date().toISOString(),
    } as any)
    .eq('id', id);

  if (error) throw new Error(error.message);
  return { success: true };
}

export async function logContradictionResolutionDecision(params: {
  companyId: string;
  contradiction: IngestionContradiction;
  resolvedValue: string;
  resolvedBy?: string;
}) {
  const now = new Date().toISOString();
  const payload = {
    company_id: params.companyId,
    contradiction_id: params.contradiction.id,
    entity_hash: params.contradiction.entity_hash,
    field_name: params.contradiction.field_name,
    value_a: params.contradiction.value_a,
    value_b: params.contradiction.value_b,
    resolved_value: params.resolvedValue,
    chosen_side: params.resolvedValue === params.contradiction.value_a ? 'A' : params.resolvedValue === params.contradiction.value_b ? 'B' : 'custom',
    resolved_by_user_id: params.resolvedBy || null,
    created_at: now,
  };

  const [analyticsResult, historyResult] = await Promise.all([
    supabase.from('contradiction_resolution_analytics' as any).insert(payload as any),
    supabase.from('field_history' as any).insert({
      entity_id: params.contradiction.entity_hash,
      field_name: params.contradiction.field_name,
      old_value: `${params.contradiction.value_a} | ${params.contradiction.value_b}`,
      new_value: params.resolvedValue,
      resolved_by: params.resolvedBy || null,
      source_contradiction_id: params.contradiction.id,
      created_at: now,
    } as any),
  ]);

  if (analyticsResult.error) throw new Error(toError(analyticsResult.error));
  if (historyResult.error) throw new Error(toError(historyResult.error));

  const { error: companyError } = await (supabase.rpc('append_company_contradiction_archive' as any, {
    p_company_id: params.companyId,
    p_entity_hash: params.contradiction.entity_hash,
    p_field_name: params.contradiction.field_name,
    p_values: {
      value_a: params.contradiction.value_a,
      value_b: params.contradiction.value_b,
      resolved: params.resolvedValue,
      at: now,
    },
  } as any));

  if (companyError) {
    // Optional path: RPC may not be available in older schemas.
    console.warn('append_company_contradiction_archive RPC unavailable:', companyError.message);
  }
}
