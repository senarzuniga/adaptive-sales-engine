import { supabase } from '@/integrations/supabase/client';
import type { GoaDataSnapshot, GoaPanelContext, GoaProposedChange } from '@/agents/goa/types';

export interface HierarchyCorrectionResult {
  updatedData: GoaDataSnapshot;
  changes: GoaProposedChange[];
  suggestions: string[];
  confidence: number;
}

const isSupabaseConfigured =
  !!import.meta.env.VITE_SUPABASE_URL &&
  import.meta.env.VITE_SUPABASE_URL !== 'https://placeholder.supabase.co';

const cloneSnapshot = (snapshot: GoaDataSnapshot): GoaDataSnapshot => ({
  orders: snapshot.orders.map((order) => ({ ...order })),
  opportunities: snapshot.opportunities.map((opportunity) => ({ ...opportunity })),
  products: snapshot.products.map((product) => ({ ...product })),
  strategy: snapshot.strategy.map((strategy) => ({ ...strategy })),
  leads: snapshot.leads.map((lead) => ({ ...lead })),
  contacts: snapshot.contacts.map((contact) => ({ ...contact })),
  companyProfile: { ...snapshot.companyProfile },
});

const normalize = (value?: string) =>
  (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const namePattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}\b/g;

function deepCollectStrings(input: unknown, out: string[]) {
  if (typeof input === 'string') {
    if (input.trim()) out.push(input);
    return;
  }

  if (Array.isArray(input)) {
    input.forEach((item) => deepCollectStrings(item, out));
    return;
  }

  if (input && typeof input === 'object') {
    Object.values(input as Record<string, unknown>).forEach((value) => deepCollectStrings(value, out));
  }
}

function deepCollectObjects(input: unknown, out: Array<Record<string, unknown>>) {
  if (!input) return;

  if (Array.isArray(input)) {
    input.forEach((item) => deepCollectObjects(item, out));
    return;
  }

  if (input && typeof input === 'object') {
    const candidate = input as Record<string, unknown>;
    out.push(candidate);
    Object.values(candidate).forEach((value) => deepCollectObjects(value, out));
  }
}

function pickObjectValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function extractKamNames(textSources: string[]) {
  const names = new Set<string>();

  textSources.forEach((text) => {
    const lines = text.split(/\r?\n/g);
    lines.forEach((line) => {
      const lower = line.toLowerCase();
      const hasRoleSignal =
        /\b(kam|key\s*account\s*manager|account\s*manager|commercial\s*manager|sales\s*manager|director comercial)\b/.test(lower);

      if (hasRoleSignal) {
        const matches = line.match(namePattern) || [];
        matches.forEach((match) => {
          const trimmed = match.trim();
          if (trimmed.split(/\s+/g).length >= 2) names.add(trimmed);
        });
      }

      const roleAfterName = line.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b\s*[-,:;|]\s*(?:KAM|Key Account|Account Manager|Commercial Manager)/i);
      if (roleAfterName?.[1]) names.add(roleAfterName[1].trim());
    });
  });

  return [...names];
}

function scoreNameSimilarity(inputName: string, candidate: string) {
  const a = normalize(inputName);
  const b = normalize(candidate);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.92;

  const aTokens = new Set(a.split(' ').filter(Boolean));
  const bTokens = new Set(b.split(' ').filter(Boolean));

  let overlap = 0;
  aTokens.forEach((token) => {
    if (bTokens.has(token)) overlap += 1;
  });

  if (overlap === 0) return 0;
  return overlap / Math.max(aTokens.size, bTokens.size);
}

function findBestKam(current: string, canonicalKams: string[]) {
  if (canonicalKams.length === 0) return null;

  const normalizedCurrent = normalize(current);
  if (!normalizedCurrent) {
    return canonicalKams.length === 1 ? { kam: canonicalKams[0], score: 0.84 } : null;
  }

  let bestKam: string | null = null;
  let bestScore = 0;

  canonicalKams.forEach((candidate) => {
    const score = scoreNameSimilarity(current, candidate);
    if (score > bestScore) {
      bestScore = score;
      bestKam = candidate;
    }
  });

  if (!bestKam || bestScore < 0.75) return null;
  return { kam: bestKam, score: bestScore };
}

async function loadRecentHierarchyText(companyId: string) {
  if (!isSupabaseConfigured || !companyId) return { textSources: [] as string[], sourceDoc: '', extractedData: {} as Record<string, unknown> };

  try {
    const client = supabase as any;
    const { data } = await client
      .from('company_documents')
      .select('id, file_name, category, created_at, raw_text, cleaned_text, extracted_data, processing_status')
      .eq('company_id', companyId)
      .in('category', ['hierarchy', 'employees', 'general'])
      .order('created_at', { ascending: false })
      .limit(8);

    const docs = (data || []) as any[];
    if (docs.length === 0) return { textSources: [] as string[], sourceDoc: '', extractedData: {} as Record<string, unknown> };

    let bestDoc = docs[0];
    let bestSignals = -1;

    docs.forEach((doc) => {
      const raw = [String(doc.cleaned_text || ''), String(doc.raw_text || '')].join('\n');
      const hierarchySignals = (raw.match(/\b(kam|key account|commercial structure|org chart|hierarchy|account manager)\b/gi) || []).length;
      if (hierarchySignals > bestSignals) {
        bestSignals = hierarchySignals;
        bestDoc = doc;
      }
    });

    const strings: string[] = [];
    deepCollectStrings(bestDoc.extracted_data, strings);
    const textSources = [String(bestDoc.cleaned_text || ''), String(bestDoc.raw_text || ''), ...strings].filter(Boolean);

    return {
      textSources,
      sourceDoc: String(bestDoc.file_name || bestDoc.id || ''),
      extractedData: (bestDoc.extracted_data || {}) as Record<string, unknown>,
    };
  } catch {
    return { textSources: [] as string[], sourceDoc: '', extractedData: {} as Record<string, unknown> };
  }
}

function buildCustomerKamMapFromExtractedData(input: {
  extractedData: Record<string, unknown>;
  canonicalKams: string[];
}) {
  const rows: Array<Record<string, unknown>> = [];
  deepCollectObjects(input.extractedData, rows);

  const customerToKam = new Map<string, string>();

  rows.forEach((row) => {
    const customer = pickObjectValue(row, [
      'customer_name',
      'customerName',
      'account_name',
      'accountName',
      'company_name',
      'companyName',
      'client_name',
      'clientName',
      'name',
    ]);

    const kamRaw = pickObjectValue(row, [
      'kam',
      'owner',
      'account_manager',
      'accountManager',
      'sales_manager',
      'salesManager',
      'commercial_manager',
      'commercialManager',
      'manager',
      'responsible',
      'responsable',
    ]);

    if (!customer || !kamRaw) return;

    const bestKam = findBestKam(kamRaw, input.canonicalKams);
    const normalizedCustomer = normalize(customer);
    if (!normalizedCustomer) return;

    customerToKam.set(normalizedCustomer, bestKam?.kam || kamRaw);
  });

  return customerToKam;
}

function remapKamFields<T extends { kam: string }>(
  rows: T[],
  canonicalKams: string[],
  dataset: GoaProposedChange['dataset'],
  label: string,
  changes: GoaProposedChange[],
) {
  return rows.map((row, index) => {
    const match = findBestKam(row.kam, canonicalKams);
    if (!match || match.kam === row.kam) return row;

    const updated = { ...row, kam: match.kam };
    changes.push({
      dataset,
      description: `Updated ${label} KAM on row ${index + 1} from "${row.kam || 'empty'}" to "${updated.kam}".`,
      before: { kam: row.kam },
      after: { kam: updated.kam },
    });
    return updated;
  });
}

export async function runHierarchyCorrectionAgent(input: {
  context: GoaPanelContext;
  prompt: string;
  data: GoaDataSnapshot;
}): Promise<HierarchyCorrectionResult> {
  const updatedData = cloneSnapshot(input.data);
  const changes: GoaProposedChange[] = [];
  const suggestions: string[] = [];

  const asksForHierarchySync = /\b(kam|key\s*account|hierarchy|org\s*chart|commercial\s*structure|agent\s*structure|company\s*hierarchy)\b/i.test(input.prompt);
  if (!asksForHierarchySync) {
    return { updatedData, changes, suggestions, confidence: 0.6 };
  }

  const { textSources, sourceDoc, extractedData } = await loadRecentHierarchyText(input.context.company_id);
  if (textSources.length === 0) {
    suggestions.push('No processed Company Hierarchy document was found for the active company, so KAM structure could not be corrected.');
    return { updatedData, changes, suggestions, confidence: 0.64 };
  }

  const canonicalKams = extractKamNames(textSources);
  if (canonicalKams.length === 0) {
    suggestions.push(`A hierarchy document was found (${sourceDoc || 'latest document'}), but no KAM names were detected from its content.`);
    return { updatedData, changes, suggestions, confidence: 0.66 };
  }

  suggestions.push(`Using KAM structure extracted from hierarchy document: ${sourceDoc || 'latest document'}.`);

  const customerToKam = buildCustomerKamMapFromExtractedData({ extractedData, canonicalKams });

  const resolveKamFromCustomer = (customer?: string) => {
    const normalizedCustomer = normalize(customer);
    if (!normalizedCustomer) return '';
    return customerToKam.get(normalizedCustomer) || '';
  };

  const remapByCustomer = <T extends { kam: string }>(
    rows: T[],
    dataset: GoaProposedChange['dataset'],
    label: string,
    customerAccessor: (row: T) => string,
  ) => rows.map((row, index) => {
    const mappedKam = resolveKamFromCustomer(customerAccessor(row));
    if (!mappedKam || mappedKam === row.kam) return row;

    const updated = { ...row, kam: mappedKam };
    changes.push({
      dataset,
      description: `Updated ${label} KAM from customer hierarchy on row ${index + 1} from "${row.kam || 'empty'}" to "${updated.kam}".`,
      before: { kam: row.kam },
      after: { kam: updated.kam },
    });
    return updated;
  });

  updatedData.orders = remapByCustomer(updatedData.orders, 'orders', 'order', (row) => row.customerName);
  updatedData.opportunities = remapByCustomer(updatedData.opportunities, 'opportunities', 'opportunity', (row) => row.customerName);
  updatedData.contacts = remapByCustomer(updatedData.contacts, 'contacts', 'contact', (row) => row.companyName);

  updatedData.leads = updatedData.leads.map((lead, index) => {
    const mappedOwner = resolveKamFromCustomer(lead.companyName);
    if (!mappedOwner || mappedOwner === lead.owner) return lead;

    const updated = { ...lead, owner: mappedOwner };
    changes.push({
      dataset: 'leads',
      description: `Updated lead owner from hierarchy on row ${index + 1} from "${lead.owner || 'empty'}" to "${updated.owner}".`,
      before: { owner: lead.owner },
      after: { owner: updated.owner },
    });
    return updated;
  });

  // Fallback pass for records not matched by customer mapping.
  updatedData.orders = remapKamFields(updatedData.orders, canonicalKams, 'orders', 'order', changes);
  updatedData.opportunities = remapKamFields(updatedData.opportunities, canonicalKams, 'opportunities', 'opportunity', changes);
  updatedData.strategy = remapKamFields(updatedData.strategy, canonicalKams, 'strategy', 'strategy record', changes);
  updatedData.contacts = remapKamFields(updatedData.contacts, canonicalKams, 'contacts', 'contact', changes);

  updatedData.leads = updatedData.leads.map((lead, index) => {
    const match = findBestKam(lead.owner, canonicalKams);
    if (!match || match.kam === lead.owner) return lead;

    const updated = { ...lead, owner: match.kam };
    changes.push({
      dataset: 'leads',
      description: `Updated lead owner on row ${index + 1} from "${lead.owner || 'empty'}" to "${updated.owner}".`,
      before: { owner: lead.owner },
      after: { owner: updated.owner },
    });
    return updated;
  });

  if (changes.length === 0) {
    suggestions.push('Hierarchy data was read, but no KAM fields required remapping based on similarity thresholds.');
    return { updatedData, changes, suggestions, confidence: 0.72 };
  }

  return { updatedData, changes, suggestions, confidence: 0.88 };
}
