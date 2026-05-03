import { supabase } from '@/integrations/supabase/client';
import type { GoaChangeLogRecord, GoaMemoryRecord } from '@/agents/goa/types';

const isSupabaseConfigured =
  !!import.meta.env.VITE_SUPABASE_URL &&
  import.meta.env.VITE_SUPABASE_URL !== 'https://placeholder.supabase.co';

const memoryKey = (companyId: string, panelKey: string) => `goa_memory_${companyId}_${panelKey}`;
const promptHistoryKey = (companyId: string, panelKey: string) => `goa_prompt_history_${companyId}_${panelKey}`;

const LS = {
  get: <T,>(key: string, fallback: T): T => {
    try {
      const value = localStorage.getItem(key);
      return value ? (JSON.parse(value) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  set: <T,>(key: string, value: T) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore localStorage quota failures.
    }
  },
};

export function normalizePromptKey(prompt: string) {
  return prompt
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 180);
}

export async function loadPromptHistory(companyId: string, panelKey: string): Promise<string[]> {
  if (!companyId) return [];

  if (!isSupabaseConfigured) {
    return LS.get<string[]>(promptHistoryKey(companyId, panelKey), []);
  }

  try {
    const client = supabase as any;
    const { data } = await client
      .from('agent_memory')
      .select('prompt, created_at')
      .eq('company_id', companyId)
      .eq('panel_key', panelKey)
      .order('created_at', { ascending: false })
      .limit(12);

    const prompts = (data || []).map((row: any) => String(row.prompt || '')).filter(Boolean);
    if (prompts.length > 0) {
      LS.set(promptHistoryKey(companyId, panelKey), prompts);
      return prompts;
    }
  } catch {
    // Fall back to local history.
  }

  return LS.get<string[]>(promptHistoryKey(companyId, panelKey), []);
}

export async function appendPromptHistory(companyId: string, panelKey: string, prompt: string) {
  if (!companyId || !prompt.trim()) return;

  const existing = LS.get<string[]>(promptHistoryKey(companyId, panelKey), []);
  const next = [prompt.trim(), ...existing.filter((item) => item.trim() !== prompt.trim())].slice(0, 12);
  LS.set(promptHistoryKey(companyId, panelKey), next);
}

export async function findReusableMemory(params: {
  companyId: string;
  panelKey: string;
  promptKey: string;
}): Promise<GoaMemoryRecord | null> {
  if (!params.companyId) return null;

  const local = LS.get<GoaMemoryRecord[]>(memoryKey(params.companyId, params.panelKey), []);
  const localHit = local.find((record) => record.prompt_key === params.promptKey && record.auto_apply);
  if (localHit) return localHit;

  if (!isSupabaseConfigured) return null;

  try {
    const client = supabase as any;
    const { data } = await client
      .from('agent_memory')
      .select('*')
      .eq('company_id', params.companyId)
      .eq('panel_key', params.panelKey)
      .eq('prompt_key', params.promptKey)
      .eq('auto_apply', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return (data as GoaMemoryRecord) || null;
  } catch {
    return null;
  }
}

export async function saveAgentMemory(record: GoaMemoryRecord) {
  const localRecords = LS.get<GoaMemoryRecord[]>(memoryKey(record.company_id, record.panel_key), []);
  const nextLocal = [record, ...localRecords].slice(0, 30);
  LS.set(memoryKey(record.company_id, record.panel_key), nextLocal);

  if (!isSupabaseConfigured) return;

  try {
    const client = supabase as any;
    await client.from('agent_memory').insert(record);
  } catch {
    // Keep local memory if remote insert fails.
  }
}

export async function savePanelChangeLog(record: GoaChangeLogRecord) {
  if (!isSupabaseConfigured) return;
  try {
    const client = supabase as any;
    await client.from('panel_changes_log').insert(record);
  } catch {
    // Logging should never break user flow.
  }
}
