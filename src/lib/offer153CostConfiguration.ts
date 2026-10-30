import rawSpecification from '../../OFF-2026-153.costs.json?raw';
import type { ProductRecord } from '@/store/DataStore';
import { DEFAULT_INGECART_POLICY } from '@/lib/utils';
import { summarizePackageCostWithPolicy } from '@/lib/offerPackages';

type Row = Record<string, any>;
interface Specification {
  revision: string;
  companyName: string;
  offerNumber: string;
  currency: string;
  sellingPrice: number;
  product: { name: string; lengthM: number; quantity: number; materials: [string, number | null, number | null][]; processes: { name: string; category: string; quantity: number; unitCost: number }[] };
  ramp: { name: string; category: string; quantity: number; unitCost: number };
  installation: { name: string; quantity: number; unitCost: number; note: string };
  expected: { materialsProduct: number; productCost: number; directCost: number };
  notes: string[];
}
export const offer153Specification = JSON.parse(rawSpecification) as Specification;
const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const normalize = (value: string) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function buildOffer153Configuration(offer: Row, now = new Date().toISOString()) {
  const spec = offer153Specification;
  const productId = `${offer.id}-sr1400-104m`;
  const rampId = `${offer.id}-ramp`;
  const installationId = `${offer.id}-installation`;
  const costRows: Row[] = [];
  const addCost = (itemId: string, label: string, category: string, quantity: number, unitCost: number, notes = '', extra: Row = {}) => {
    costRows.push({
      id: `${itemId}-cost-${costRows.length + 1}`, offer_item_id: itemId,
      category, line_item: label, quantity, unit_cost: unitCost, total_cost: money(quantity * unitCost),
      hours: 0,
      hourly_rate: 0,
      days: 0, resources: 0, surcharge_pct: 0, structure_pct: 0,
      notes, installation: null, linked_travel_line_id: null, created_at: now, ...extra,
    });
  };
  for (const [label, quantity, unitCost] of spec.product.materials) {
    addCost(productId, label, 'materials', quantity ?? 0, unitCost ?? 0,
      quantity === null || unitCost === null ? 'PENDIENTE: cantidad y precio no facilitados. Cero provisional, no gratuidad confirmada.' : 'BOM facilitada por el usuario; coste para 104 metros.');
  }
  for (const line of spec.product.processes) addCost(productId, line.name, line.category, line.quantity, line.unitCost,
    line.category === 'engineering' ? 'Ingeniería a forfait: 1 unidad a 2.500 EUR. No se han especificado horas ni tarifa horaria.' : '');
  addCost(rampId, spec.ramp.name, 'materials', spec.ramp.quantity, spec.ramp.unitCost, 'Material de comercio. Rampa incluida en el alcance y en el precio total de la oferta.');
  addCost(installationId, spec.installation.name, 'installation', 1, spec.installation.unitCost, spec.installation.note, {
    installation: { fixedTotalCost: spec.installation.unitCost, days: 0, resources: 0, travelMode: 'none', hotelNights: 0, trips: 0 },
  });
  const items = [
    { id: productId, offer_id: offer.id, item_name: spec.product.name, item_type: 'product', quantity: 1, description: 'Sistema retal SR1400 de 104 metros. Materiales, procesos subcontratados, ingeniería y 65 horas de montaje en taller incluidos en el coste del producto. Perno charnela y manómetro pendientes de cantidad/precio.', created_at: now },
    { id: rampId, offer_id: offer.id, item_name: spec.ramp.name, item_type: 'product', quantity: 1, description: 'Rampa: material de comercio con coste directo de 17.400 EUR, incluida en oferta.', created_at: now },
    { id: installationId, offer_id: offer.id, item_name: spec.installation.name, item_type: 'service', quantity: 1, description: spec.installation.note, created_at: now },
  ];
  const policy = { ...DEFAULT_INGECART_POLICY, ...(offer.cost_policy || {}), pricingExclusions: [] };
  const summary = summarizePackageCostWithPolicy(
    { id: `${offer.id}-core`, name: spec.product.name, type: 'core', itemIds: items.map((item) => item.id), commercialPrice: spec.sellingPrice, executiveSummary: '', sortOrder: 1 },
    items, costRows, policy,
    (itemId) => itemId === installationId && policy.policyScope === 'split' ? { ...policy, ...policy.servicePolicy } : policy,
  );
  const productCost = money(costRows.filter((line) => line.offer_item_id === productId).reduce((sum, line) => sum + line.total_cost, 0));
  const directCost = money(summary.directCost);
  if (productCost !== spec.expected.productCost || directCost !== spec.expected.directCost) throw new Error('OFF-2026-153: los costes no cuadran con el desglose autorizado.');
  const totalCost = money(summary.totalCostWithPolicy);
  const margin = money(spec.sellingPrice - totalCost);
  const product: ProductRecord = {
    name: spec.product.name, averageValue: 0, type: 'product', category: 'product', estimatedCost: productCost,
    comments: `Coste aprobado por instrucción del usuario: ${productCost} EUR para 104 m; precio individual de venta no especificado (el precio de 165708 EUR corresponde al conjunto de la oferta). Perno charnela y manómetro pendientes de valoración.`,
    characteristics: ['Sistema retal SR1400', 'Longitud: 104 metros', 'Montaje en taller: 65 h a 50 EUR/h'],
    defaultLengthM: spec.product.lengthM, configurableByLength: false, validated: false, source: 'manual', repositories: ['OFF-2026-153.costs.json'],
    costPreset: costRows.filter((line) => line.offer_item_id === productId).map((line) => ({
      category: line.category, lineItem: line.line_item, mode: 'unit',
      quantity: line.quantity, unitCost: line.unit_cost, hours: line.hours, hourlyRate: line.hourly_rate,
      surchargePct: 0, structurePct: 0, scalesWithLength: false, notes: line.notes,
    })),
  };
  return {
    offer: {
      ...offer, currency: spec.currency, company_name: spec.companyName, offer_kind: 'standard',
      contract_value: spec.sellingPrice, offer_total_price: spec.sellingPrice, offer_total_price_override: spec.sellingPrice,
      principal_package_price: spec.sellingPrice, principal_package_price_override: spec.sellingPrice,
      package_price_sum: spec.sellingPrice, bundle_adjustment: 0,
      total_cost: totalCost, cost_policy: policy, updated_at: now, storage: 'local',
    },
    items, costRows, product, directCost, totalCost,
    packages: [{ id: `${offer.id}-core`, offer_id: offer.id, package_name: 'SR1400 104 METROS + RAMPA + INSTALACIÓN', package_type: 'core', item_ids: items.map((item) => item.id), executive_summary: 'Alcance completo incluido. Instalación con viajes, hotel y demás gastos incluidos; sin duplicar gastos de desplazamiento.', commercial_price: spec.sellingPrice, sort_order: 1, created_at: now, updated_at: now }],
    scenarios: [{ id: `${offer.id}-base`, offer_id: offer.id, scenario_type: 'base', total_cost: totalCost, selling_price: spec.sellingPrice, margin_amount: margin, margin_pct: margin / spec.sellingPrice * 100, ai_analysis: { source: spec.revision, directCost, policyCharges: summary.policyCharges, notes: spec.notes }, created_at: now }],
  };
}

/** One-time local data correction. Never create an invented offer/customer or overwrite another company. */
export function applyOffer153LocalConfiguration(companyId: string, companyName: string): 'applied' | 'already-applied' | 'not-found' | 'other-company' {
  const spec = offer153Specification;
  if (normalize(companyName) !== normalize(spec.companyName)) return 'other-company';
  const marker = `acs_cost_configuration_${companyId}_${spec.revision}`;
  if (localStorage.getItem(marker)) return 'already-applied';
  const key = (table: string) => `acs_workspace_${table}_${companyId}`;
  const read = (storageKey: string): Row[] => JSON.parse(localStorage.getItem(storageKey) || '[]');
  const offers = read(key('offers'));
  const targets = offers.filter((offer) => String(offer.offer_number || '').trim().toUpperCase() === spec.offerNumber && (!offer.company_id || offer.company_id === companyId));
  if (targets.length !== 1) return 'not-found';
  const offer = targets[0];
  const result = buildOffer153Configuration(offer);
  const oldItems = read(key('offer_items'));
  const oldItemIds = new Set(oldItems.filter((item) => item.offer_id === offer.id).map((item) => item.id));
  const productKey = `acs_products_${companyId}`;
  const products = read(productKey);
  const oldProduct = products.find((entry) => normalize(entry.name) === normalize(spec.product.name));
  const updatedProducts = [...products.filter((entry) => normalize(entry.name) !== normalize(spec.product.name)), { ...oldProduct, ...result.product, averageValue: oldProduct?.averageValue ?? 0 }];
  const updates: Record<string, string | null> = {
    [key('offers')]: JSON.stringify(offers.map((entry) => entry.id === offer.id ? result.offer : entry)),
    [key('offer_items')]: JSON.stringify([...oldItems.filter((item) => item.offer_id !== offer.id), ...result.items]),
    [key('cost_breakdowns')]: JSON.stringify([...read(key('cost_breakdowns')).filter((row) => !oldItemIds.has(row.offer_item_id)), ...result.costRows]),
    [key('offer_packages')]: JSON.stringify([...read(key('offer_packages')).filter((row) => row.offer_id !== offer.id), ...result.packages]),
    [key('offer_scenarios')]: JSON.stringify([...read(key('offer_scenarios')).filter((row) => row.offer_id !== offer.id), ...result.scenarios]),
    [key('offer_scores')]: JSON.stringify(read(key('offer_scores')).filter((row) => row.offer_id !== offer.id)),
    [productKey]: JSON.stringify(updatedProducts),
  };
  const opportunitiesKey = `acs_opps_${companyId}`;
  updates[opportunitiesKey] = JSON.stringify(read(opportunitiesKey).map((row) =>
    String(row.oppNumber || row.opp_number || '').toUpperCase() === spec.offerNumber
      ? { ...row, estRevenue: spec.sellingPrice, ...(row.est_revenue !== undefined ? { est_revenue: spec.sellingPrice } : {}) }
      : row));
  const draftKey = `acs_offer_pricing_draft_${companyId}`;
  const draft = JSON.parse(localStorage.getItem(draftKey) || 'null');
  if (draft && (draft.editingOfferId === offer.id || draft.offerNumber === spec.offerNumber)) updates[draftKey] = null;
  const backup = Object.fromEntries(Object.keys(updates).map((storageKey) => [storageKey, localStorage.getItem(storageKey)]));
  localStorage.setItem(`${marker}_backup`, JSON.stringify(backup));
  try {
    for (const [storageKey, value] of Object.entries(updates)) {
      if (value === null) localStorage.removeItem(storageKey); else localStorage.setItem(storageKey, value);
    }
    localStorage.setItem(marker, JSON.stringify({ appliedAt: new Date().toISOString(), offerId: offer.id, directCost: result.directCost, totalCost: result.totalCost, sellingPrice: spec.sellingPrice }));
  } catch (error) {
    for (const [storageKey, value] of Object.entries(backup)) {
      if (value === null) localStorage.removeItem(storageKey); else localStorage.setItem(storageKey, value);
    }
    throw error;
  }
  return 'applied';
}