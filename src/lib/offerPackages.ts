import { DEFAULT_INGECART_POLICY, type OfferCostPolicy } from '@/lib/utils';

export type OfferPackageType = 'core' | 'optional' | 'installation';

export interface OfferPackageDraft {
  id: string;
  name: string;
  type: OfferPackageType;
  itemIds: string[];
  executiveSummary: string;
  commercialPrice: number;
  sortOrder: number;
}

export interface PaymentMilestone {
  id: string;
  percentage: number;
  description: string;
}

export interface OfferCommercialTerms {
  equipmentIncoterm: string;
  incotermLocation: string;
  deliveryMonths: number;
  deliveryNotes: string;
  validityDays: number;
  warrantyMonths: number;
  paymentMilestones: PaymentMilestone[];
}

export type OfferLikeItem = {
  id: string;
  item_name?: string;
  name?: string;
  description?: string;
  quantity?: number;
};

export type OfferLikeCostRow = {
  offer_item_id?: string;
  category?: string;
  line_item?: string;
  total_cost?: number;
  hours?: number;
  quantity?: number;
  days?: number;
  resources?: number;
};

export type OfferCostCategory = 'materials' | 'engineering' | 'subcontracting' | 'installation' | 'transport' | 'indirect';
export type OfferCostCategoryTotals = Record<OfferCostCategory, number>;

export interface OfferPolicyCharges {
  warranty: number;
  materialStructure: number;
  financial: number;
  commercialMgmt: number;
  total: number;
}

export interface OfferCostWithPolicySummary {
  categoryTotals: OfferCostCategoryTotals;
  directCost: number;
  policyCharges: OfferPolicyCharges;
  totalCostWithPolicy: number;
}

const EMPTY_CATEGORY_TOTALS = (): OfferCostCategoryTotals => ({
  materials: 0,
  engineering: 0,
  subcontracting: 0,
  installation: 0,
  transport: 0,
  indirect: 0,
});

export const DEFAULT_PAYMENT_MILESTONES: PaymentMilestone[] = [
  { id: 'po', percentage: 30, description: 'by bank transfer with the purchase order' },
  { id: 'engineering', percentage: 20, description: 'by bank transfer with the completion of engineering package' },
  { id: 'ready', percentage: 45, description: "by bank transfer upon notification that the goods are ready for collection at INGECART\'s workshops" },
  { id: 'commissioning', percentage: 5, description: 'by bank transfer at commissioning, and no later than 90 days from the Certificate of Loading / check-in' },
];

export const DEFAULT_COMMERCIAL_TERMS: OfferCommercialTerms = {
  equipmentIncoterm: 'EXW',
  incotermLocation: 'Barcelona, Spain',
  deliveryMonths: 8,
  deliveryNotes: 'Final date confirmed after kick-off and supplier scheduling.',
  validityDays: 30,
  warrantyMonths: 12,
  paymentMilestones: DEFAULT_PAYMENT_MILESTONES,
};

export const DEFAULT_OFFER_SECTIONS = [
  '11  PROJECT EXECUTION AND ACCEPTANCE',
  '11.1 Acceptance KPIs to be agreed during engineering.',
  '12  COMMERCIAL CONDITIONS',
  '12.1 Price inclusions.',
  '12.2 Exclusions.',
  '12.3 Customer responsibilities.',
  '13  WARRANTY AND GENERAL SALES CONDITIONS',
  '14  OFFER ACCEPTANCE',
] as const;

export const INSTALLATION_ASSOCIATED_COSTS_TEXT = 'Associated costs include the hotel, flights, local transport and subsistence amounts listed in the approved scope basis. Durations are working-day estimates and assume continuous access to a ready site, required lifting equipment and timely customer support.';

export const INSTALLATION_CUSTOMER_SUPPORT_TEXT = 'Customer to provide additional mechanical and electrical support as well as needed cranes and auxiliary equipment.';

export const INSTALLATION_SERVICE_DELIVERABLES = [
  'Mechanical supervision/assembly according to the responsibility matrix.',
  'Cold commissioning, I/O checks and station handshake verification.',
  'Software start-up, sequence tuning and production-mode testing.',
  'RFID/MES interface support within the agreed protocol and data scope.',
  'AMR mapping, route and station setup under actual plant conditions.',
  'Operator and maintenance training for normal operation, alarms and recovery.',
  'SAT support and closure of agreed punch-list items.',
] as const;

export const createOfferPackage = (sortOrder = 1): OfferPackageDraft => ({
  id: crypto.randomUUID(),
  name: `Package ${sortOrder}`,
  type: 'core',
  itemIds: [],
  executiveSummary: '',
  commercialPrice: 0,
  sortOrder,
});

export const createPaymentMilestone = (seed?: Partial<PaymentMilestone>): PaymentMilestone => ({
  id: seed?.id || crypto.randomUUID(),
  percentage: Number(seed?.percentage || 0),
  description: String(seed?.description || '').trim(),
});

export const buildDefaultCommercialTerms = (): OfferCommercialTerms => ({
  equipmentIncoterm: DEFAULT_COMMERCIAL_TERMS.equipmentIncoterm,
  incotermLocation: DEFAULT_COMMERCIAL_TERMS.incotermLocation,
  deliveryMonths: DEFAULT_COMMERCIAL_TERMS.deliveryMonths,
  deliveryNotes: DEFAULT_COMMERCIAL_TERMS.deliveryNotes,
  validityDays: DEFAULT_COMMERCIAL_TERMS.validityDays,
  warrantyMonths: DEFAULT_COMMERCIAL_TERMS.warrantyMonths,
  paymentMilestones: DEFAULT_COMMERCIAL_TERMS.paymentMilestones.map((milestone) => createPaymentMilestone(milestone)),
});

export const resizePaymentMilestones = (count: number, current: PaymentMilestone[]): PaymentMilestone[] => {
  const safeCount = Math.max(1, Math.round(Number(count) || 1));
  const normalized = current.map((milestone) => createPaymentMilestone(milestone));
  if (normalized.length === safeCount) return normalized;
  if (normalized.length > safeCount) return normalized.slice(0, safeCount);
  const extra = Array.from({ length: safeCount - normalized.length }, (_, index) => createPaymentMilestone({ description: `milestone ${normalized.length + index + 1}` }));
  return [...normalized, ...extra];
};

export const hydrateCommercialTerms = (row: any): OfferCommercialTerms => {
  const defaults = buildDefaultCommercialTerms();
  if (!row) return defaults;
  const rawMilestones = Array.isArray(row.payment_milestones) ? row.payment_milestones : row.paymentMilestones;
  return {
    equipmentIncoterm: String(row.equipment_incoterm || row.equipmentIncoterm || defaults.equipmentIncoterm),
    incotermLocation: String(row.incoterm_location || row.incotermLocation || defaults.incotermLocation),
    deliveryMonths: Number(row.delivery_months || row.deliveryMonths || defaults.deliveryMonths),
    deliveryNotes: String(row.delivery_notes || row.deliveryNotes || defaults.deliveryNotes),
    validityDays: Number(row.validity_days || row.validityDays || defaults.validityDays),
    warrantyMonths: Number(row.warranty_months || row.warrantyMonths || defaults.warrantyMonths),
    paymentMilestones: Array.isArray(rawMilestones) && rawMilestones.length > 0
      ? rawMilestones.map((milestone) => createPaymentMilestone(milestone))
      : defaults.paymentMilestones,
  };
};

export const hydrateOfferPackage = (row: any, fallbackOrder = 1): OfferPackageDraft => ({
  id: String(row?.id || crypto.randomUUID()),
  name: String(row?.package_name || row?.name || `Package ${fallbackOrder}`),
  type: (row?.package_type || row?.type || 'core') as OfferPackageType,
  itemIds: Array.isArray(row?.item_ids) ? row.item_ids.map((value: unknown) => String(value)) : Array.isArray(row?.itemIds) ? row.itemIds.map((value: unknown) => String(value)) : [],
  executiveSummary: String(row?.executive_summary || row?.executiveSummary || ''),
  commercialPrice: Number(row?.commercial_price || row?.commercialPrice || 0),
  sortOrder: Number(row?.sort_order || row?.sortOrder || fallbackOrder),
});

export const sumPaymentMilestones = (milestones: PaymentMilestone[]) => milestones.reduce((sum, milestone) => sum + Number(milestone.percentage || 0), 0);

const translatePaymentDescription = (value: string, language: 'en' | 'es' = 'en') => {
  const compact = String(value || '').trim().replace(/\s+/g, ' ');
  if (language !== 'es') return compact;
  return compact
    .replace(/^by bank transfer with the purchase order$/i, 'mediante transferencia bancaria con el pedido')
    .replace(/^by bank transfer with the completion of engineering package$/i, 'mediante transferencia bancaria con la finalizacion del paquete de ingenieria')
    .replace(/^by bank transfer upon notification that the goods are ready for collection at INGECART's workshops$/i, 'mediante transferencia bancaria tras la notificacion de que los equipos estan listos para su recogida en los talleres de INGECART')
    .replace(/^by bank transfer at commissioning, and no later than 90 days from the Certificate of Loading \/ check-in$/i, 'mediante transferencia bancaria en la puesta en marcha y, en todo caso, no mas tarde de 90 dias desde el Certificate of Loading / check-in');
};

export const buildPaymentTermsText = (terms: OfferCommercialTerms, language: 'en' | 'es' = 'en') =>
  terms.paymentMilestones
    .map((milestone) => `${Number(milestone.percentage || 0)}% ${translatePaymentDescription(String(milestone.description || '').trim(), language)}`.trim())
    .filter(Boolean)
    .join('; ') + '.';

export const buildDeliveryTermsText = (terms: OfferCommercialTerms, language: 'en' | 'es' = 'en') => {
  const notes = String(terms.deliveryNotes || '').trim();
  if (language === 'es') {
    return `Plazo objetivo de disponibilidad del equipo: ${Number(terms.deliveryMonths || 0)} meses desde la recepcion del anticipo, los datos tecnicos aprobados y el cierre de diseno. ${notes || 'La fecha final se confirmara tras el kick-off y la programacion de proveedores.'}`.trim();
  }
  return `Target equipment readiness: ${Number(terms.deliveryMonths || 0)} months from receipt of down payment, approved technical data and design freeze. ${notes}`.trim();
};

export const buildValidityTermsText = (terms: OfferCommercialTerms, language: 'en' | 'es' = 'en') =>
  language === 'es'
    ? `${Number(terms.validityDays || 0)} dias naturales desde la fecha de la propuesta, sujetos a disponibilidad de materiales y precios de proveedores.`
    : `${Number(terms.validityDays || 0)} calendar days from proposal date, subject to material and supplier price availability.`;

export const buildWarrantyTermsText = (terms: OfferCommercialTerms, language: 'en' | 'es' = 'en') =>
  language === 'es'
    ? `${Number(terms.warrantyMonths || 0)} meses desde la puesta en marcha o ${Number(terms.warrantyMonths || 0)} meses desde la entrega bajo el Incoterm acordado, lo que ocurra primero.`
    : `${Number(terms.warrantyMonths || 0)} months from commissioning or ${Number(terms.warrantyMonths || 0)} months from delivery under the agreed Incoterm, whichever occurs first.`;

export const buildEquipmentIncotermText = (terms: OfferCommercialTerms, language: 'en' | 'es' = 'en') => {
  const base = `${String(terms.equipmentIncoterm || '').trim()} ${String(terms.incotermLocation || '').trim()} (Incoterms 2020)`.replace(/\s+/g, ' ').trim();
  return language === 'es' ? `${base}, salvo modificacion expresa en el pedido final.` : `${base}, unless amended in the final order.`;
};

export const itemLabel = (item: OfferLikeItem) => String(item.item_name || item.name || '').trim();

export const calculateItemDirectCost = (itemId: string, items: OfferLikeItem[], costRows: OfferLikeCostRow[]) => {
  const item = items.find((candidate) => candidate.id === itemId);
  const quantity = Number(item?.quantity || 1);
  return costRows
    .filter((row) => row.offer_item_id === itemId)
    .reduce((sum, row) => sum + Number(row.total_cost || 0), 0) * quantity;
};

const summarizeCostByItemIds = (itemIds: string[], items: OfferLikeItem[], costRows: OfferLikeCostRow[]): OfferCostCategoryTotals => {
  const totals = EMPTY_CATEGORY_TOTALS();
  itemIds.forEach((itemId) => {
    const item = items.find((candidate) => candidate.id === itemId);
    const quantity = Math.max(1, Number(item?.quantity || 1));
    costRows
      .filter((row) => String(row.offer_item_id || '') === itemId)
      .forEach((row) => {
        const category = String(row.category || '') as OfferCostCategory;
        if (!(category in totals)) return;
        totals[category] += Number(row.total_cost || 0) * quantity;
      });
  });
  return totals;
};

export const estimatePolicyChargesFromCost = (
  categoryTotals: Partial<OfferCostCategoryTotals>,
  directCost: number,
  policy: OfferCostPolicy = DEFAULT_INGECART_POLICY,
): OfferPolicyCharges => {
  const materials = Number(categoryTotals.materials || 0);
  const engineering = Number(categoryTotals.engineering || 0);
  const subcontracting = Number(categoryTotals.subcontracting || 0);
  const safeDirect = Number(directCost || 0);
  const warranty = (materials + engineering + subcontracting) * (Number(policy.warrantyPct) || 0) / 100;
  const materialStructure = materials * (Number(policy.materialStructurePct) || 0) / 100;
  const financial = safeDirect * (Number(policy.financialPct) || 0) / 100;
  const commercialMgmt = safeDirect * (Number(policy.commercialMgmtPct) || 0) / 100;
  return {
    warranty,
    materialStructure,
    financial,
    commercialMgmt,
    total: warranty + materialStructure + financial + commercialMgmt,
  };
};

export const summarizePackageCostWithPolicy = (
  pkg: OfferPackageDraft,
  items: OfferLikeItem[],
  costRows: OfferLikeCostRow[],
  policy: OfferCostPolicy = DEFAULT_INGECART_POLICY,
): OfferCostWithPolicySummary => {
  const categoryTotals = summarizeCostByItemIds(pkg.itemIds, items, costRows);
  const directCost = Object.values(categoryTotals).reduce((sum, value) => sum + Number(value || 0), 0);
  const policyCharges = estimatePolicyChargesFromCost(categoryTotals, directCost, policy);
  return {
    categoryTotals,
    directCost,
    policyCharges,
    totalCostWithPolicy: directCost + policyCharges.total,
  };
};

export const calculatePackageDirectCost = (pkg: OfferPackageDraft, items: OfferLikeItem[], costRows: OfferLikeCostRow[]) =>
  summarizePackageCostWithPolicy(pkg, items, costRows).directCost;

export const buildPackageContentsText = (pkg: OfferPackageDraft, items: OfferLikeItem[]) => {
  const names = pkg.itemIds
    .map((itemId) => items.find((item) => item.id === itemId))
    .filter(Boolean)
    .map((item) => itemLabel(item as OfferLikeItem))
    .filter(Boolean);
  return names.join('; ');
};

export const isInstallationPackage = (pkg: OfferPackageDraft, costRows: OfferLikeCostRow[]) =>
  pkg.type === 'installation' || costRows.some((row) => pkg.itemIds.includes(String(row.offer_item_id || '')) && (row.category === 'installation' || row.category === 'transport'));

export const buildPackageExecutiveDetail = (pkg: OfferPackageDraft, items: OfferLikeItem[], costRows: OfferLikeCostRow[]) => {
  const itemDescriptions = pkg.itemIds
    .map((itemId) => items.find((item) => item.id === itemId))
    .filter(Boolean)
    .map((item) => [itemLabel(item as OfferLikeItem), String((item as OfferLikeItem).description || '').trim()].filter(Boolean).join(': '))
    .filter(Boolean);
  const lineLabels = costRows
    .filter((row) => pkg.itemIds.includes(String(row.offer_item_id || '')))
    .map((row) => String(row.line_item || '').trim())
    .filter(Boolean);
  const automated = [itemDescriptions.slice(0, 3).join(' | '), lineLabels.slice(0, 4).join(' | ')].filter(Boolean).join(' | ');
  const base = String(pkg.executiveSummary || '').trim() || automated || buildPackageContentsText(pkg, items);
  if (!isInstallationPackage(pkg, costRows)) return base;
  return [base, INSTALLATION_ASSOCIATED_COSTS_TEXT, INSTALLATION_CUSTOMER_SUPPORT_TEXT].filter(Boolean).join(' ');
};


