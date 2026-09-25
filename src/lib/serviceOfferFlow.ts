import emailOpportunities from '../../data/from_email_context/ece_opportunities_from_email_context.json';

type Row = Record<string, unknown>;

export type OfferKind = 'standard' | 'service';

export type ServiceOpportunityType =
  | 'maintenance'
  | 'digital'
  | 'reliability'
  | 'spares'
  | 'retrofit'
  | 'contract-expansion';

export interface ServiceOpportunityCandidate {
  id: string;
  title: string;
  customerName: string;
  description: string;
  recommendedAction: string;
  recommendedScope: string;
  triggerSignal: string;
  opportunityType: ServiceOpportunityType;
  sourceType: string;
  sourceLabel: string;
  estimatedValue: number;
  probability: number;
  urgency: 'high' | 'medium' | 'low';
  score: number;
  aiGenerated: boolean;
  status: string;
  knownOfferNumber?: string;
  referenceDocuments: string[];
}

export interface ServiceOfferDraftSeed {
  offerKind: OfferKind;
  title: string;
  customerName: string;
  projectDescription: string;
  currency: string;
  targetMargin: number;
  documentLanguage: 'en' | 'es';
  linkedOpportunityId: string;
  linkedOpportunityTitle: string;
  items: Array<{
    id: string;
    name: string;
    type: 'service';
    quantity: number;
    description: string;
    costLines: Array<{
      id: string;
      category: string;
      lineItem: string;
      quantity: number;
      unitCost: number;
      totalCost: number;
      surchargePct: number;
      structurePct: number;
      hours: number;
      hourlyRate: number;
      days: number;
      resources: number;
      notes: string;
    }>;
  }>;
}

export interface BuildServiceOpportunityInput {
  opportunities: Row[];
  assets: Row[];
  contracts: Row[];
  interventions: Row[];
  spareParts: Row[];
}

type EmailContextOpportunity = {
  opportunity_id: string;
  name: string;
  status: string;
  probability: number;
  value: number;
  owner: string;
  customer: string;
  critical_items_count: number;
  risk_level: string | null;
  description: string;
  metadata?: {
    project_type?: string | null;
    location?: string | null;
  };
};

export const SMART_PLANT_ANNUAL_OFFER_REFERENCES = [
  {
    offerNumber: 'OFF-2026-S133',
    customerName: 'Cartonajes Font',
    title: 'Smart Plant Annual Maintenance Programme + INGEPRO',
    htmlPath: 'C:\\Users\\isena\\OneDrive\\Attachments\\smart_plant_annual_offers\\html\\OFF-2026-S133.html',
    wordPath: 'C:\\Users\\isena\\OneDrive\\Attachments\\smart_plant_annual_offers\\word\\OFF-2026-S133.docx',
  },
  {
    offerNumber: 'OFF-2026-S134',
    customerName: 'Cascades Sonoco-Calgary',
    title: 'Smart Plant Annual Maintenance Programme + INGEPRO',
    htmlPath: 'C:\\Users\\isena\\OneDrive\\Attachments\\smart_plant_annual_offers\\html\\OFF-2026-S134.html',
    wordPath: 'C:\\Users\\isena\\OneDrive\\Attachments\\smart_plant_annual_offers\\word\\OFF-2026-S134.docx',
  },
  {
    offerNumber: 'OFF-2026-S135',
    customerName: 'Cascades Sonoco-Waterloo',
    title: 'Smart Plant Annual Maintenance Programme + INGEPRO',
    htmlPath: 'C:\\Users\\isena\\OneDrive\\Attachments\\smart_plant_annual_offers\\html\\OFF-2026-S135.html',
    wordPath: 'C:\\Users\\isena\\OneDrive\\Attachments\\smart_plant_annual_offers\\word\\OFF-2026-S135.docx',
  },
  {
    offerNumber: 'OFF-2026-S136',
    customerName: 'IP Piscataway',
    title: 'Smart Plant Annual Maintenance Programme + INGEPRO',
    htmlPath: 'C:\\Users\\isena\\OneDrive\\Attachments\\smart_plant_annual_offers\\html\\OFF-2026-S136.html',
    wordPath: 'C:\\Users\\isena\\OneDrive\\Attachments\\smart_plant_annual_offers\\word\\OFF-2026-S136.docx',
  },
  {
    offerNumber: 'OFF-2026-S137',
    customerName: 'Sterner Global-Mastercorr',
    title: 'Smart Plant Annual Maintenance Programme + INGEPRO',
    htmlPath: 'C:\\Users\\isena\\OneDrive\\Attachments\\smart_plant_annual_offers\\html\\OFF-2026-S137.html',
    wordPath: 'C:\\Users\\isena\\OneDrive\\Attachments\\smart_plant_annual_offers\\word\\OFF-2026-S137.docx',
  },
] as const;

const SERVICE_DRAFT_KEY_PREFIX = 'acs_service_offer_draft_';
const emailContextRows = emailOpportunities as EmailContextOpportunity[];

const text = (value: unknown) => String(value || '').trim();
const num = (value: unknown) => Number(value || 0);
const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, Math.round(value)));
const slug = (value: string) => text(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'item';

const opportunityTypeLabel: Record<ServiceOpportunityType, string> = {
  maintenance: 'Annual maintenance',
  digital: 'Smart plant enablement',
  reliability: 'Reliability recovery',
  spares: 'Critical spare parts',
  retrofit: 'Retrofit & modernization',
  'contract-expansion': 'Contract expansion',
};

const targetMarginByType: Record<ServiceOpportunityType, number> = {
  maintenance: 35,
  digital: 38,
  reliability: 34,
  spares: 28,
  retrofit: 30,
  'contract-expansion': 33,
};

const estimateValueByType: Record<ServiceOpportunityType, number> = {
  maintenance: 85000,
  digital: 42000,
  reliability: 36000,
  spares: 22000,
  retrofit: 68000,
  'contract-expansion': 55000,
};

function buildServiceCostLine(id: string, category: string, lineItem: string, notes: string) {
  return {
    id,
    category,
    lineItem,
    quantity: 1,
    unitCost: 0,
    totalCost: 0,
    surchargePct: 0,
    structurePct: 0,
    hours: 0,
    hourlyRate: 0,
    days: 0,
    resources: 0,
    notes,
  };
}

function computeScore(estimatedValue: number, probability: number, urgency: 'high' | 'medium' | 'low', aiGenerated: boolean, sourceType: string) {
  let score = Math.min(32, estimatedValue / 4000);
  score += probability * 0.38;
  score += urgency === 'high' ? 20 : urgency === 'medium' ? 10 : 4;
  if (aiGenerated) score += 6;
  if (sourceType === 'smart-plant-reference') score += 14;
  if (sourceType === 'email-context') score += 10;
  return clamp(score);
}

function normalizeWorkspaceOpportunity(row: Row): ServiceOpportunityCandidate {
  const estimatedValue = num(row.estimated_value);
  const probability = num(row.probability || 50);
  const title = text(row.title) || 'After-sales opportunity';
  const customerName = text(row.customer_name) || 'Ingecart account';
  const opportunityType = (text(row.opportunity_type).toLowerCase().includes('spare') ? 'spares'
    : text(row.opportunity_type).toLowerCase().includes('retro') ? 'retrofit'
      : text(row.opportunity_type).toLowerCase().includes('digital') ? 'digital'
        : text(row.opportunity_type).toLowerCase().includes('contract') ? 'contract-expansion'
          : 'maintenance') as ServiceOpportunityType;
  const urgency = text(row.urgency).toLowerCase() === 'high' ? 'high' : probability >= 70 ? 'high' : probability >= 45 ? 'medium' : 'low';
  return {
    id: text(row.id) || `workspace-${slug(customerName)}-${slug(title)}`,
    title,
    customerName,
    description: text(row.description),
    recommendedAction: text(row.recommended_action) || `Build a clear ${opportunityTypeLabel[opportunityType].toLowerCase()} offer with scope, assumptions and commercial milestones.`,
    recommendedScope: text(row.recommended_scope) || text(row.description) || 'Define the exact deliverables, service calendar, exclusions and customer inputs.',
    triggerSignal: text(row.trigger_signal) || 'Existing after-sales opportunity already identified in ASE.',
    opportunityType,
    sourceType: 'workspace',
    sourceLabel: 'ASE workspace',
    estimatedValue: estimatedValue || estimateValueByType[opportunityType],
    probability,
    urgency,
    score: computeScore(estimatedValue || estimateValueByType[opportunityType], probability, urgency, text(row.ai_generated) === 'true' || Boolean(row.ai_generated), 'workspace'),
    aiGenerated: Boolean(row.ai_generated),
    status: text(row.status) || 'identified',
    knownOfferNumber: text(row.offer_number),
    referenceDocuments: Array.isArray(row.document_paths) ? row.document_paths.map((value) => text(value)).filter(Boolean) : [],
  };
}

function buildGroupedCustomerSignal<T extends Row>(rows: T[], key: keyof T) {
  const grouped = new Map<string, T[]>();
  rows.forEach((row) => {
    const name = text(row[key]);
    if (!name) return;
    grouped.set(name, [...(grouped.get(name) || []), row]);
  });
  return grouped;
}

function pushCandidate(target: ServiceOpportunityCandidate[], candidate: ServiceOpportunityCandidate) {
  const dedupeKey = `${candidate.customerName.toLowerCase()}::${candidate.title.toLowerCase()}`;
  const existingIndex = target.findIndex((item) => `${item.customerName.toLowerCase()}::${item.title.toLowerCase()}` === dedupeKey);
  if (existingIndex === -1) {
    target.push(candidate);
    return;
  }
  if (candidate.score > target[existingIndex].score) target[existingIndex] = candidate;
}

export function buildServiceTopOpportunities(input: BuildServiceOpportunityInput): ServiceOpportunityCandidate[] {
  const candidates: ServiceOpportunityCandidate[] = [];

  input.opportunities.forEach((row) => pushCandidate(candidates, normalizeWorkspaceOpportunity(row)));

  SMART_PLANT_ANNUAL_OFFER_REFERENCES.forEach((reference) => {
    pushCandidate(candidates, {
      id: `smart-plant-${reference.offerNumber.toLowerCase()}`,
      title: `${reference.title} - ${reference.customerName}`,
      customerName: reference.customerName,
      description: 'Validated Smart Plant + INGEPRO service structure already available as a commercial reference for annual after-sales coverage.',
      recommendedAction: 'Activate a service-offer draft, adapt the annual maintenance scope to the current plant reality and refresh the commercial value proposition before printing.',
      recommendedScope: 'Annual preventive maintenance programme, digital monitoring / INGEPRO layer, performance follow-up cadence, exclusions, parts policy and optional modernization roadmap.',
      triggerSignal: `Existing annual service offer reference ${reference.offerNumber} available in Smart Plant attachments.`,
      opportunityType: 'maintenance',
      sourceType: 'smart-plant-reference',
      sourceLabel: 'Smart Plant annual offers',
      estimatedValue: estimateValueByType.maintenance,
      probability: 82,
      urgency: 'high',
      score: computeScore(estimateValueByType.maintenance, 82, 'high', true, 'smart-plant-reference'),
      aiGenerated: true,
      status: 'reference_ready',
      knownOfferNumber: reference.offerNumber,
      referenceDocuments: [reference.wordPath, reference.htmlPath],
    });
  });

  emailContextRows.forEach((row) => {
    const customerName = text(row.name || row.customer) || 'Email context account';
    const estimatedValue = num(row.value) > 0 ? num(row.value) * 0.18 : estimateValueByType.reliability;
    const probability = clamp(num(row.probability) * 100, 15, 95);
    const critical = num(row.critical_items_count);
    const opportunityType = /infrastructure|equipment|maintenance|acceptance/i.test(`${row.description} ${row.metadata?.project_type || ''}`) ? 'reliability' : 'retrofit';
    pushCandidate(candidates, {
      id: `email-${slug(row.opportunity_id)}`,
      title: `${opportunityTypeLabel[opportunityType]} recovery plan - ${customerName}`,
      customerName,
      description: `Email context detects ${critical} critical items and open coordination points around ${text(row.metadata?.project_type) || 'plant execution'}.`,
      recommendedAction: 'Prepare a focused post-sales recovery / support offer that closes the critical items, defines onsite support cadence and secures the next technical decision with the customer.',
      recommendedScope: 'Kickoff review, plant or equipment technical assessment, punch-list closure support, escalation protocol, service visits and formal decision log governance.',
      triggerSignal: `${text(row.description)}${text(row.metadata?.location) ? ` | ${text(row.metadata?.location)}` : ''}`,
      opportunityType,
      sourceType: 'email-context',
      sourceLabel: 'Email context',
      estimatedValue,
      probability,
      urgency: critical >= 4 ? 'high' : probability >= 55 ? 'medium' : 'low',
      score: computeScore(estimatedValue, probability, critical >= 4 ? 'high' : probability >= 55 ? 'medium' : 'low', true, 'email-context'),
      aiGenerated: true,
      status: text(row.status) || 'identified',
      referenceDocuments: [],
    });
  });

  const assetsByCustomer = buildGroupedCustomerSignal(input.assets, 'customer_name');
  assetsByCustomer.forEach((customerAssets, customerName) => {
    const highRisk = customerAssets.filter((asset) => text(asset.risk_level).toLowerCase() === 'high').length;
    const endOfLife = customerAssets.filter((asset) => text(asset.lifecycle_stage).toLowerCase() === 'end-of-life').length;
    const disconnected = customerAssets.filter((asset) => text(asset.connection_status).toLowerCase() !== 'connected').length;
    if (highRisk > 0 || endOfLife > 0) {
      const estimatedValue = estimateValueByType.maintenance + highRisk * 6000 + endOfLife * 5000;
      pushCandidate(candidates, {
        id: `asset-maint-${slug(customerName)}`,
        title: `Annual maintenance stabilization plan - ${customerName}`,
        customerName,
        description: `${highRisk} high-risk assets and ${endOfLife} end-of-life assets suggest immediate preventive coverage and service governance.`,
        recommendedAction: 'Launch a preventive annual maintenance proposal with visit calendar, critical checkpoints, response SLA and optional parts coverage.',
        recommendedScope: 'Asset baseline review, preventive maintenance routines, operator coaching, remote follow-up, SLA model and optional spare-parts frame agreement.',
        triggerSignal: `${highRisk} high-risk assets | ${endOfLife} end-of-life assets`,
        opportunityType: 'maintenance',
        sourceType: 'installed-base',
        sourceLabel: 'Installed base',
        estimatedValue,
        probability: 78,
        urgency: 'high',
        score: computeScore(estimatedValue, 78, 'high', true, 'installed-base'),
        aiGenerated: true,
        status: 'identified',
        referenceDocuments: [],
      });
    }
    if (disconnected > 0) {
      const estimatedValue = estimateValueByType.digital + disconnected * 4500;
      pushCandidate(candidates, {
        id: `asset-digital-${slug(customerName)}`,
        title: `Digital Smart Plant enablement - ${customerName}`,
        customerName,
        description: `${disconnected} assets are not connected, limiting plant intelligence and remote support coverage.`,
        recommendedAction: 'Prepare a Smart Plant / INGEPRO activation offer with connectivity scope, dashboard outputs and remote service governance.',
        recommendedScope: 'Machine connectivity, signal validation, dashboard deployment, alarm governance, remote assistance protocol and quarterly KPI review.',
        triggerSignal: `${disconnected} disconnected or only registered assets in the ASE installed base.`,
        opportunityType: 'digital',
        sourceType: 'digital-ecosystem',
        sourceLabel: 'Digital ecosystem / plant data',
        estimatedValue,
        probability: 72,
        urgency: disconnected >= 2 ? 'high' : 'medium',
        score: computeScore(estimatedValue, 72, disconnected >= 2 ? 'high' : 'medium', true, 'digital-ecosystem'),
        aiGenerated: true,
        status: 'identified',
        referenceDocuments: [],
      });
    }
  });

  const interventionsByCustomer = buildGroupedCustomerSignal(input.interventions, 'customer_name');
  interventionsByCustomer.forEach((customerInterventions, customerName) => {
    const reactive = customerInterventions.filter((intervention) => text(intervention.intervention_type).toLowerCase() === 'reactive');
    if (reactive.length < 2) return;
    const estimatedValue = estimateValueByType.reliability + reactive.length * 4500;
    pushCandidate(candidates, {
      id: `interventions-${slug(customerName)}`,
      title: `Reliability recovery programme - ${customerName}`,
      customerName,
      description: `${reactive.length} reactive interventions indicate an opportunity to convert emergency support into structured recurring service.`,
      recommendedAction: 'Convert the recurrent incidents into a reliability improvement service offer with root-cause analysis, corrective roadmap and follow-up visits.',
      recommendedScope: 'Incident review, root-cause workshop, corrective action backlog, planned service visits, remote check-ins and closure evidence per issue.',
      triggerSignal: `${reactive.length} reactive interventions already recorded in ASE.`,
      opportunityType: 'reliability',
      sourceType: 'service-history',
      sourceLabel: 'Service history',
      estimatedValue,
      probability: 76,
      urgency: reactive.length >= 3 ? 'high' : 'medium',
      score: computeScore(estimatedValue, 76, reactive.length >= 3 ? 'high' : 'medium', true, 'service-history'),
      aiGenerated: true,
      status: 'identified',
      referenceDocuments: [],
    });
  });

  const sparePartsByCustomer = buildGroupedCustomerSignal(input.spareParts, 'customer_name');
  sparePartsByCustomer.forEach((customerParts, customerName) => {
    const criticalLowStock = customerParts.filter((part) => text(part.stock_status).toLowerCase() === 'critical' || (num(part.quantity_on_hand) <= num(part.reorder_point) && num(part.reorder_point) > 0));
    if (criticalLowStock.length === 0) return;
    const estimatedValue = criticalLowStock.reduce((sum, part) => sum + (num(part.unit_price) * num(part.quantity_recommended || 1)), estimateValueByType.spares);
    pushCandidate(candidates, {
      id: `spares-${slug(customerName)}`,
      title: `Critical spare parts frame agreement - ${customerName}`,
      customerName,
      description: `${criticalLowStock.length} spare parts are at critical stock or below reorder point; a frame agreement secures availability and reduces downtime risk.`,
      recommendedAction: 'Prepare a spare-parts proposal with recommended quantities, lead times, price hold and availability commitment.',
      recommendedScope: 'Critical parts list, recommended stock levels, lead times, price validity, expedite option and annual review cadence.',
      triggerSignal: `${criticalLowStock.length} critical or low-stock spare parts detected.`,
      opportunityType: 'spares',
      sourceType: 'spare-parts',
      sourceLabel: 'Spare parts intelligence',
      estimatedValue,
      probability: 74,
      urgency: criticalLowStock.length >= 5 ? 'high' : 'medium',
      score: computeScore(estimatedValue, 74, criticalLowStock.length >= 5 ? 'high' : 'medium', true, 'spare-parts'),
      aiGenerated: true,
      status: 'identified',
      referenceDocuments: [],
    });
  });

  return candidates.sort((a, b) => b.score - a.score);
}

export function isServiceOfferNumber(offerNumber?: string) {
  return /^OFF-\d{4}-S\d+$/i.test(text(offerNumber));
}

export function getServiceOfferDraftStorageKey(companyId?: string | null) {
  return `${SERVICE_DRAFT_KEY_PREFIX}${companyId || 'default'}`;
}

export function buildServiceOfferDraftSeed(candidate: ServiceOpportunityCandidate): ServiceOfferDraftSeed {
  return {
    offerKind: 'service',
    title: candidate.title,
    customerName: candidate.customerName,
    projectDescription: `${candidate.recommendedAction} Scope: ${candidate.recommendedScope}`,
    currency: 'EUR',
    targetMargin: targetMarginByType[candidate.opportunityType] || 32,
    documentLanguage: 'en',
    linkedOpportunityId: candidate.id,
    linkedOpportunityTitle: candidate.title,
    items: [{
      id: `svc-${slug(candidate.title)}-${Date.now()}`,
      name: candidate.title,
      type: 'service',
      quantity: 1,
      description: candidate.recommendedScope,
      costLines: [
        buildServiceCostLine(`cl-${Date.now()}-eng`, 'engineering', 'Engineering / project management', 'Project management, scope definition and service governance.'),
        buildServiceCostLine(`cl-${Date.now()}-field`, 'field_service', 'Field service visits', 'On-site service visits according to the agreed calendar.'),
        buildServiceCostLine(`cl-${Date.now()}-remote`, 'remote_service', 'Remote support / INGEPRO monitoring', 'Remote assistance, dashboard monitoring and alarm follow-up.'),
        buildServiceCostLine(`cl-${Date.now()}-parts`, 'parts', 'Spare parts / consumables provision', 'Recommended spare parts and consumables within the service scope.'),
      ],
    }],
  };
}
