import { publishWorkspaceChange } from '@/lib/workspaceStorage';

// Only explicitly shipped durable offers may be added to an already populated workspace.
const DURABLE_OFFER_NUMBERS = ['OFF-2026-S138'];
type Row = Record<string, any>;
const normalizeNumber = (row: Row) => String(row.offer_number || '').trim().toUpperCase();
const readRows = (raw: string | null): Row[] | null => {
  if (raw === null) return null;
  const rows = JSON.parse(raw);
  if (!Array.isArray(rows)) throw new Error('El workspace Ingecart no contiene una lista válida.');
  return rows;
};

/** Restore missing datasets and explicitly shipped offers; preserve edits and explicit empty lists. */
export async function recoverMissingIngecartData(companyId: string, companyName: string) {
  if (companyName.toLowerCase().replace(/[^a-z0-9]/g, '') !== 'ingecart2018sl') return;
  if (localStorage.getItem(`acs_ingecart_recovery_disabled_${companyId}`) === 'true') return;
  const core: Record<string, string> = { orders: 'orders', opportunities: 'opps', products: 'products', strategy: 'strategy', leads: 'leads', contacts: 'contacts', tasks: 'tasks', entityRegistries: 'registries', qualityReports: 'quality', enrichedProfiles: 'enriched' };
  const missingCore = ['orders', 'opps', 'products', 'strategy', 'leads', 'contacts', 'tasks'].some((suffix) => localStorage.getItem(`acs_${suffix}_${companyId}`) === null);
  const offersKey = `acs_workspace_offers_${companyId}`;
  const existingOffers = readRows(localStorage.getItem(offersKey));
  const needsOfferRecovery = existingOffers === null || (existingOffers.length > 0 && DURABLE_OFFER_NUMBERS.some((number) => !existingOffers.some((row) => normalizeNumber(row) === number)));
  if (!missingCore && !needsOfferRecovery) return;
  const response = await fetch('/company-packs/Ingecart/ingecart_pack.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error(`No se pudo recuperar el snapshot Ingecart: HTTP ${response.status}`);
  const pack = await response.json();
  if (pack?.companyProfile?.company_name !== 'Ingecart 2018 SL' || !Array.isArray(pack?.workspace?.offers)) throw new Error('El snapshot no corresponde a Ingecart 2018 SL.');
  // Re-read after the network boundary: another tab may have edited or disabled recovery.
  if (localStorage.getItem(`acs_ingecart_recovery_disabled_${companyId}`) === 'true') return;
  const currentOffers = readRows(localStorage.getItem(offersKey));
  const durableOffers: Row[] = pack.workspace.offers.filter((row: Row) => DURABLE_OFFER_NUMBERS.includes(normalizeNumber(row)));
  const durableIds = new Set(durableOffers.map((row) => row.id));
  const durableItemIds = new Set((pack.workspace.offer_items || []).filter((row: Row) => durableIds.has(row.offer_id)).map((row: Row) => row.id));
  const belongsToDurableOffer = (table: string, row: Row) => table === 'offers' ? durableIds.has(row.id)
    : table === 'cost_breakdowns' ? durableItemIds.has(row.offer_item_id) : durableIds.has(row.offer_id);
  const writes: Record<string, string> = {};
  for (const [field, suffix] of Object.entries(core)) {
    const key = `acs_${suffix}_${companyId}`;
    if (localStorage.getItem(key) === null && pack[field] !== undefined) writes[key] = JSON.stringify(pack[field]);
  }
  for (const [table, rows] of Object.entries(pack.workspace || {})) {
    const key = `acs_workspace_${table}_${companyId}`;
    if (localStorage.getItem(key) === null && Array.isArray(rows)) {
      writes[key] = JSON.stringify(rows.filter((row) => !belongsToDurableOffer(table, row)).map((row) => ({ ...row, ...(row.company_id ? { company_id: companyId } : {}) })));
    }
  }
  for (const offer of durableOffers) {
    if (currentOffers !== null && (currentOffers.length === 0 || currentOffers.some((row) => normalizeNumber(row) === normalizeNumber(offer) || row.id === offer.id))) continue;
    const itemIds = new Set((pack.workspace.offer_items || []).filter((row: Row) => row.offer_id === offer.id).map((row: Row) => row.id));
    const bundle: Record<string, Row[]> = {};
    for (const [table, rows] of Object.entries(pack.workspace) as [string, Row[]][]) {
      if (!Array.isArray(rows)) continue;
      const related = rows.filter((row) => table === 'offers' ? row.id === offer.id
        : table === 'cost_breakdowns' ? itemIds.has(row.offer_item_id) : row.offer_id === offer.id);
      if (related.length) bundle[table] = related;
    }
    // Do not partially install a bundle into tables explicitly cleared by the user,
    // or attach costs to colliding identifiers owned by existing records.
    if (Object.entries(bundle).some(([table, rows]) => {
      const existing = readRows(localStorage.getItem(`acs_workspace_${table}_${companyId}`));
      return existing !== null && (existing.length === 0 || rows.some((row) => existing.some((saved) => saved.id === row.id)));
    })) continue;
    for (const [table, rows] of Object.entries(bundle)) {
      const key = `acs_workspace_${table}_${companyId}`;
      const existing = readRows(writes[key] ?? localStorage.getItem(key)) || [];
      writes[key] = JSON.stringify([...existing, ...rows.map((row) => ({ ...row, ...(table === 'offers' || row.company_id ? { company_id: companyId } : {}) }))]);
    }
  }
  const previous = new Map<string, string | null>();
  try {
    for (const [key, value] of Object.entries(writes)) {
      const oldValue = localStorage.getItem(key);
      if (oldValue === value) continue;
      previous.set(key, oldValue);
      localStorage.setItem(key, value);
    }
  } catch (error) {
    for (const [key, value] of previous) if (localStorage.getItem(key) === writes[key]) {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    }
    throw error;
  }
  if (previous.size) publishWorkspaceChange(offersKey);
}