export type ProductCategory = 'product' | 'service';

export type ProductCostMode = 'unit' | 'engineering' | 'installation';

export interface ProductCostPresetLine {
  category: 'materials' | 'engineering' | 'subcontracting' | 'installation' | 'transport' | 'indirect';
  lineItem: string;
  mode?: ProductCostMode;
  quantity?: number;
  unitCost?: number;
  surchargePct?: number;
  hours?: number;
  hourlyRate?: number;
  days?: number;
  resources?: number;
  notes?: string;
  role?: string;
  optional?: boolean;
  scalesWithLength?: boolean;
  unitsPerLengthM?: number;
}

export interface ProductCompetitorBenchmark {
  name: string;
  offer: string;
  performance: string;
  marketFit: number;
  fitGap: string;
  gainFitActions: string[];
}

export type ProductEvidenceStatus = 'verified' | 'commercial-claim' | 'modelled' | 'pre-engineering' | 'pending';

export interface ProductTechnicalSpecification {
  parameter: string;
  value: string;
  status: ProductEvidenceStatus;
}

export interface ProductTechnicalDossier {
  dossierId: string;
  revision: string;
  updatedAt: string;
  valueProposition: string;
  applications: string[];
  technicalSpecifications: ProductTechnicalSpecification[];
  performanceKpis: string[];
  roiFramework: string[];
  risksAndLimits: string[];
  acceptanceCriteria: string[];
  sourceReferences: string[];
}

export interface ProductCatalogMeta {
  category?: ProductCategory;
  characteristics?: string[];
  estimatedCost?: number;
  repositories?: string[];
  validated?: boolean;
  source?: 'manual' | 'generated';
  productInfoUrl?: string;
  productVideoUrl?: string;
  linkedReports?: string[];
  defaultLengthM?: number;
  configurableByLength?: boolean;
  costPreset?: ProductCostPresetLine[];
  competitors?: ProductCompetitorBenchmark[];
  marketFitNotes?: string[];
  fitImprovementActions?: string[];
  technicalDossier?: ProductTechnicalDossier;
}

const META_TOKEN = '[ASE_CATALOG_META]';

export function inferProductCategory(type?: string, category?: ProductCategory): ProductCategory {
  if (category === 'service' || category === 'product') return category;
  return String(type || '').toLowerCase().includes('service') ? 'service' : 'product';
}

function safeParseMeta(raw: string): ProductCatalogMeta {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as ProductCatalogMeta;
  } catch {
    return {};
  }
}

function cleanList(values?: string[]) {
  return (values || []).map((value) => String(value || '').trim()).filter(Boolean);
}

function cleanCostPreset(costPreset?: ProductCostPresetLine[]) {
  return (costPreset || []).filter(Boolean).map((line) => ({
    category: line.category,
    lineItem: String(line.lineItem || '').trim(),
    mode: line.mode,
    quantity: Number.isFinite(line.quantity) ? Number(line.quantity) : undefined,
    unitCost: Number.isFinite(line.unitCost) ? Number(line.unitCost) : undefined,
    surchargePct: Number.isFinite(line.surchargePct) ? Number(line.surchargePct) : undefined,
    hours: Number.isFinite(line.hours) ? Number(line.hours) : undefined,
    hourlyRate: Number.isFinite(line.hourlyRate) ? Number(line.hourlyRate) : undefined,
    days: Number.isFinite(line.days) ? Number(line.days) : undefined,
    resources: Number.isFinite(line.resources) ? Number(line.resources) : undefined,
    notes: String(line.notes || '').trim() || undefined,
    role: String(line.role || '').trim() || undefined,
    optional: line.optional ? true : undefined,
    scalesWithLength: line.scalesWithLength ? true : undefined,
    unitsPerLengthM: Number.isFinite(line.unitsPerLengthM) ? Number(line.unitsPerLengthM) : undefined,
  })).filter((line) => line.lineItem);
}

function cleanCompetitors(competitors?: ProductCompetitorBenchmark[]) {
  return (competitors || []).filter(Boolean).map((item) => ({
    name: String(item.name || '').trim(),
    offer: String(item.offer || '').trim(),
    performance: String(item.performance || '').trim(),
    marketFit: Number.isFinite(item.marketFit) ? Number(item.marketFit) : 0,
    fitGap: String(item.fitGap || '').trim(),
    gainFitActions: cleanList(item.gainFitActions),
  })).filter((item) => item.name);
}

function cleanTechnicalDossier(dossier?: ProductTechnicalDossier): ProductTechnicalDossier | undefined {
  if (!dossier || typeof dossier !== 'object') return undefined;
  const dossierId = String(dossier.dossierId || '').trim();
  if (!dossierId) return undefined;
  const validStatuses: ProductEvidenceStatus[] = ['verified', 'commercial-claim', 'modelled', 'pre-engineering', 'pending'];
  return {
    dossierId,
    revision: String(dossier.revision || '').trim(),
    updatedAt: String(dossier.updatedAt || '').trim(),
    valueProposition: String(dossier.valueProposition || '').trim(),
    applications: cleanList(dossier.applications),
    technicalSpecifications: (dossier.technicalSpecifications || []).map((item) => ({
      parameter: String(item?.parameter || '').trim(),
      value: String(item?.value || '').trim(),
      status: validStatuses.includes(item?.status) ? item.status : 'pending',
    })).filter((item) => item.parameter && item.value),
    performanceKpis: cleanList(dossier.performanceKpis),
    roiFramework: cleanList(dossier.roiFramework),
    risksAndLimits: cleanList(dossier.risksAndLimits),
    acceptanceCriteria: cleanList(dossier.acceptanceCriteria),
    sourceReferences: cleanList(dossier.sourceReferences),
  };
}

export function parseProductComments(comments?: string | null): { notes: string; meta: ProductCatalogMeta } {
  const raw = (comments || '').trim();
  if (!raw.includes(META_TOKEN)) return { notes: raw, meta: {} };

  const [notesPart, metaPart] = raw.split(META_TOKEN);
  const meta = safeParseMeta(metaPart || '');
  return {
    notes: (notesPart || '').trim(),
    meta: {
      category: meta.category === 'service' ? 'service' : meta.category === 'product' ? 'product' : undefined,
      characteristics: cleanList(meta.characteristics),
      estimatedCost: Number.isFinite(meta.estimatedCost) ? Number(meta.estimatedCost) : undefined,
      repositories: cleanList(meta.repositories),
      validated: Boolean(meta.validated),
      source: meta.source === 'generated' ? 'generated' : meta.source === 'manual' ? 'manual' : undefined,
      productInfoUrl: typeof meta.productInfoUrl === 'string' ? meta.productInfoUrl.trim() : undefined,
      productVideoUrl: typeof meta.productVideoUrl === 'string' ? meta.productVideoUrl.trim() : undefined,
      linkedReports: cleanList(meta.linkedReports),
      defaultLengthM: Number.isFinite(meta.defaultLengthM) ? Number(meta.defaultLengthM) : undefined,
      configurableByLength: typeof meta.configurableByLength === 'boolean' ? meta.configurableByLength : undefined,
      costPreset: cleanCostPreset(meta.costPreset),
      competitors: cleanCompetitors(meta.competitors),
      marketFitNotes: cleanList(meta.marketFitNotes),
      fitImprovementActions: cleanList(meta.fitImprovementActions),
      technicalDossier: cleanTechnicalDossier(meta.technicalDossier),
    },
  };
}

export function serializeProductComments(notes: string, meta: ProductCatalogMeta): string {
  const normalizedMeta: ProductCatalogMeta = {
    category: meta.category,
    characteristics: cleanList(meta.characteristics),
    estimatedCost: Number.isFinite(meta.estimatedCost) ? Number(meta.estimatedCost) : undefined,
    repositories: cleanList(meta.repositories),
    validated: meta.validated ? true : undefined,
    source: meta.source,
    productInfoUrl: meta.productInfoUrl?.trim() || undefined,
    productVideoUrl: meta.productVideoUrl?.trim() || undefined,
    linkedReports: cleanList(meta.linkedReports),
    defaultLengthM: Number.isFinite(meta.defaultLengthM) ? Number(meta.defaultLengthM) : undefined,
    configurableByLength: typeof meta.configurableByLength === 'boolean' ? meta.configurableByLength : undefined,
    costPreset: cleanCostPreset(meta.costPreset),
    competitors: cleanCompetitors(meta.competitors),
    marketFitNotes: cleanList(meta.marketFitNotes),
    fitImprovementActions: cleanList(meta.fitImprovementActions),
    technicalDossier: cleanTechnicalDossier(meta.technicalDossier),
  };

  const hasMeta = Boolean(
    normalizedMeta.category ||
    (normalizedMeta.characteristics && normalizedMeta.characteristics.length > 0) ||
    Number.isFinite(normalizedMeta.estimatedCost) ||
    (normalizedMeta.repositories && normalizedMeta.repositories.length > 0) ||
    normalizedMeta.validated ||
    normalizedMeta.source ||
    normalizedMeta.productInfoUrl ||
    normalizedMeta.productVideoUrl ||
    (normalizedMeta.linkedReports && normalizedMeta.linkedReports.length > 0) ||
    Number.isFinite(normalizedMeta.defaultLengthM) ||
    normalizedMeta.configurableByLength ||
    (normalizedMeta.costPreset && normalizedMeta.costPreset.length > 0) ||
    (normalizedMeta.competitors && normalizedMeta.competitors.length > 0) ||
    (normalizedMeta.marketFitNotes && normalizedMeta.marketFitNotes.length > 0) ||
    (normalizedMeta.fitImprovementActions && normalizedMeta.fitImprovementActions.length > 0) ||
    normalizedMeta.technicalDossier
  );

  if (!hasMeta) return notes.trim();
  return `${notes.trim()}${notes.trim() ? '\n' : ''}${META_TOKEN}${JSON.stringify(normalizedMeta)}`;
}
