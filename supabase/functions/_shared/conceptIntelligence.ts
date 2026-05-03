export type ConceptFieldType = 'text' | 'number' | 'date' | 'currency' | 'email' | 'phone' | 'array' | 'object';
export type ConceptRelationType = 'influences' | 'depends_on' | 'contains' | 'precedes' | 'conflicts_with';

export interface ConceptField {
  name: string;
  type: ConceptFieldType;
  required: boolean;
  examples: string[];
  description: string;
}

export interface ConceptRelation {
  fromConcept: string;
  toConcept: string;
  relationType: ConceptRelationType;
  bidirectional: boolean;
}

export interface Concept {
  id: string;
  name: string;
  description: string;
  fields: ConceptField[];
  relations: ConceptRelation[];
  contextualConcepts: string[];
  textualPatterns: string[];
}

const clean = (value: unknown) => String(value ?? '').trim();
const normalizeText = (value: unknown) => clean(value).toLowerCase();

const normalizeCurrencyNumber = (value: unknown) => {
  const raw = clean(value).replace(/[€$£¥,\s]/g, '');
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeDateIso = (value: unknown) => {
  const raw = clean(value);
  if (!raw) return '';
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return '';
};

const idFrom = (prefix: string, value: string) => `${prefix}_${normalizeText(value).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'item'}`;

export const CONCEPT_ONTOLOGY: Record<string, Concept> = {
  customers: {
    id: 'customers',
    name: 'Clientes',
    description: 'Informacion sobre clientes actuales y potenciales.',
    fields: [
      { name: 'name', type: 'text', required: true, examples: ['Telefonica', 'BBVA'], description: 'Nombre del cliente' },
      { name: 'industry', type: 'text', required: false, examples: ['Telecom', 'Banca'], description: 'Industria' },
      { name: 'revenue', type: 'currency', required: false, examples: ['1200000'], description: 'Ingresos anuales' },
      { name: 'employees', type: 'number', required: false, examples: ['150'], description: 'Numero de empleados' },
      { name: 'status', type: 'text', required: false, examples: ['active', 'potential'], description: 'Estado del cliente' },
      { name: 'satisfaction', type: 'number', required: false, examples: ['85'], description: 'Satisfaccion 0-100' },
    ],
    relations: [
      { fromConcept: 'customers', toConcept: 'sales', relationType: 'influences', bidirectional: true },
      { fromConcept: 'customers', toConcept: 'offers', relationType: 'contains', bidirectional: false },
      { fromConcept: 'customers', toConcept: 'leads', relationType: 'precedes', bidirectional: false },
    ],
    contextualConcepts: ['sales', 'offers', 'leads'],
    textualPatterns: ['cliente', 'customer', 'cuenta', 'empresa', 'compania'],
  },
  leads: {
    id: 'leads',
    name: 'Leads/Oportunidades',
    description: 'Oportunidades comerciales en pipeline.',
    fields: [
      { name: 'company', type: 'text', required: true, examples: ['Nuevo Cliente SA'], description: 'Empresa objetivo' },
      { name: 'value', type: 'currency', required: false, examples: ['50000'], description: 'Valor de oportunidad' },
      { name: 'probability', type: 'number', required: false, examples: ['75'], description: 'Probabilidad 0-100' },
      { name: 'stage', type: 'text', required: false, examples: ['proposal', 'negotiation'], description: 'Etapa pipeline' },
      { name: 'expectedClose', type: 'date', required: false, examples: ['2026-12-31'], description: 'Fecha cierre estimada' },
      { name: 'competitors', type: 'array', required: false, examples: ['Competidor A'], description: 'Competidores' },
    ],
    relations: [
      { fromConcept: 'leads', toConcept: 'customers', relationType: 'precedes', bidirectional: false },
      { fromConcept: 'leads', toConcept: 'sales', relationType: 'influences', bidirectional: true },
      { fromConcept: 'leads', toConcept: 'offers', relationType: 'contains', bidirectional: false },
    ],
    contextualConcepts: ['customers', 'sales', 'offers', 'products'],
    textualPatterns: ['lead', 'oportunidad', 'pipeline', 'propuesta', 'negociacion'],
  },
  strategy: {
    id: 'strategy',
    name: 'Estrategia',
    description: 'Objetivos y KPIs estrategicos.',
    fields: [
      { name: 'objective', type: 'text', required: true, examples: ['Aumentar market share 15%'], description: 'Objetivo' },
      { name: 'timeline', type: 'text', required: false, examples: ['Q3 2026'], description: 'Plazo' },
      { name: 'kpis', type: 'array', required: false, examples: ['ROI'], description: 'KPIs' },
      { name: 'owner', type: 'text', required: false, examples: ['Commercial VP'], description: 'Responsable' },
      { name: 'status', type: 'text', required: false, examples: ['planning'], description: 'Estado' },
    ],
    relations: [
      { fromConcept: 'strategy', toConcept: 'sales', relationType: 'influences', bidirectional: true },
      { fromConcept: 'strategy', toConcept: 'products', relationType: 'influences', bidirectional: true },
      { fromConcept: 'strategy', toConcept: 'market', relationType: 'depends_on', bidirectional: true },
    ],
    contextualConcepts: ['sales', 'products', 'market'],
    textualPatterns: ['estrategia', 'strategy', 'objetivo', 'plan', 'roadmap'],
  },
  products: {
    id: 'products',
    name: 'Productos',
    description: 'Catalogo de productos y servicios.',
    fields: [
      { name: 'name', type: 'text', required: true, examples: ['SaaS Pro'], description: 'Nombre del producto' },
      { name: 'price', type: 'currency', required: false, examples: ['299'], description: 'Precio' },
      { name: 'category', type: 'text', required: false, examples: ['Software'], description: 'Categoria' },
      { name: 'stage', type: 'text', required: false, examples: ['growth'], description: 'Ciclo de vida' },
      { name: 'margin', type: 'number', required: false, examples: ['65'], description: 'Margen %' },
    ],
    relations: [
      { fromConcept: 'products', toConcept: 'offers', relationType: 'contains', bidirectional: false },
      { fromConcept: 'products', toConcept: 'sales', relationType: 'influences', bidirectional: true },
    ],
    contextualConcepts: ['offers', 'sales', 'strategy'],
    textualPatterns: ['producto', 'servicio', 'solution', 'catalogo'],
  },
  market: {
    id: 'market',
    name: 'Mercado',
    description: 'Informacion de mercado y tendencias.',
    fields: [
      { name: 'sector', type: 'text', required: true, examples: ['SaaS'], description: 'Sector' },
      { name: 'size', type: 'currency', required: false, examples: ['10000000000'], description: 'Tamano de mercado' },
      { name: 'growth', type: 'number', required: false, examples: ['15'], description: 'Crecimiento anual' },
      { name: 'trends', type: 'array', required: false, examples: ['IA'], description: 'Tendencias' },
      { name: 'competitors', type: 'array', required: false, examples: ['Competidor A'], description: 'Competidores' },
    ],
    relations: [
      { fromConcept: 'market', toConcept: 'strategy', relationType: 'depends_on', bidirectional: true },
      { fromConcept: 'market', toConcept: 'products', relationType: 'influences', bidirectional: true },
    ],
    contextualConcepts: ['strategy', 'products', 'sales'],
    textualPatterns: ['mercado', 'market', 'sector', 'industria', 'competencia', 'tendencias'],
  },
  offers: {
    id: 'offers',
    name: 'Ofertas',
    description: 'Propuestas comerciales emitidas.',
    fields: [
      { name: 'customer', type: 'text', required: true, examples: ['Cliente X'], description: 'Cliente destino' },
      { name: 'value', type: 'currency', required: true, examples: ['150000'], description: 'Valor de oferta' },
      { name: 'products', type: 'array', required: false, examples: ['Producto A'], description: 'Productos' },
      { name: 'date', type: 'date', required: false, examples: ['2026-05-15'], description: 'Fecha emision' },
      { name: 'status', type: 'text', required: false, examples: ['sent', 'accepted'], description: 'Estado' },
      { name: 'validUntil', type: 'date', required: false, examples: ['2026-06-15'], description: 'Validez' },
    ],
    relations: [
      { fromConcept: 'offers', toConcept: 'customers', relationType: 'contains', bidirectional: false },
      { fromConcept: 'offers', toConcept: 'products', relationType: 'contains', bidirectional: false },
      { fromConcept: 'offers', toConcept: 'sales', relationType: 'influences', bidirectional: true },
      { fromConcept: 'offers', toConcept: 'leads', relationType: 'precedes', bidirectional: false },
    ],
    contextualConcepts: ['customers', 'products', 'sales', 'leads'],
    textualPatterns: ['oferta', 'propuesta', 'presupuesto', 'quote', 'proposal'],
  },
  sales: {
    id: 'sales',
    name: 'Ventas',
    description: 'Ventas realizadas e ingresos.',
    fields: [
      { name: 'customer', type: 'text', required: true, examples: ['Cliente X'], description: 'Cliente' },
      { name: 'value', type: 'currency', required: true, examples: ['75000'], description: 'Valor venta' },
      { name: 'date', type: 'date', required: false, examples: ['2026-04-30'], description: 'Fecha venta' },
      { name: 'products', type: 'array', required: false, examples: ['Producto A'], description: 'Productos vendidos' },
      { name: 'margin', type: 'number', required: false, examples: ['45'], description: 'Margen %' },
      { name: 'paymentStatus', type: 'text', required: false, examples: ['paid', 'pending'], description: 'Estado de pago' },
    ],
    relations: [
      { fromConcept: 'sales', toConcept: 'customers', relationType: 'influences', bidirectional: true },
      { fromConcept: 'sales', toConcept: 'products', relationType: 'contains', bidirectional: false },
      { fromConcept: 'sales', toConcept: 'strategy', relationType: 'influences', bidirectional: true },
    ],
    contextualConcepts: ['customers', 'products', 'offers', 'strategy'],
    textualPatterns: ['venta', 'orden', 'ingreso', 'factura', 'sale', 'order', 'invoice'],
  },
};

export class ConceptValidator {
  static validateField(field: ConceptField, value: unknown): { valid: boolean; error?: string } {
    if (field.required && (value === undefined || value === null || clean(value) === '')) {
      return { valid: false, error: `Campo ${field.name} es requerido` };
    }

    if (value === undefined || value === null || clean(value) === '') return { valid: true };

    if (field.type === 'number' && Number.isNaN(Number(value))) {
      return { valid: false, error: `Campo ${field.name} debe ser numero` };
    }

    if (field.type === 'currency' && normalizeCurrencyNumber(value) === null) {
      return { valid: false, error: `Campo ${field.name} debe ser moneda` };
    }

    if (field.type === 'date' && !normalizeDateIso(value)) {
      return { valid: false, error: `Campo ${field.name} debe ser fecha valida` };
    }

    if (field.type === 'array' && !Array.isArray(value)) {
      return { valid: false, error: `Campo ${field.name} debe ser array` };
    }

    return { valid: true };
  }

  static validateRecord(conceptId: string, record: Record<string, unknown>) {
    const concept = CONCEPT_ONTOLOGY[conceptId];
    if (!concept) return { valid: false, errors: [`Concepto ${conceptId} no encontrado`] };

    const errors: string[] = [];
    concept.fields.forEach((field) => {
      const result = this.validateField(field, record[field.name]);
      if (!result.valid && result.error) errors.push(result.error);
    });

    return { valid: errors.length === 0, errors };
  }
}

export interface ConceptContextualizedRecord {
  concept: string;
  extractedData: Record<string, unknown>;
  confidence: number;
  contextualNotes: string[];
  relatedConcepts: string[];
  validationErrors: string[];
}

const CONCEPT_FIELD_MAPPINGS: Record<string, Record<string, string[]>> = {
  customers: {
    name: ['customer_name', 'company_name', 'name'],
    industry: ['industry', 'sector'],
    revenue: ['revenue', 'total_value', 'selling_price', 'est_revenue'],
    employees: ['employee_count', 'employees'],
    status: ['status'],
    satisfaction: ['satisfaction', 'nps'],
  },
  leads: {
    company: ['company_name', 'customer_name', 'lead_name', 'name'],
    value: ['estimated_value', 'est_revenue', 'total_value'],
    probability: ['probability', 'contract_prob'],
    stage: ['status', 'stage'],
    expectedClose: ['valid_to', 'expected_close'],
    competitors: ['competitors'],
  },
  strategy: {
    objective: ['objective', 'title', 'scope'],
    timeline: ['timeline', 'est_purchasing_quarter'],
    kpis: ['kpis'],
    owner: ['kam', 'owner'],
    status: ['status'],
  },
  products: {
    name: ['name', 'product_name', 'product', 'title'],
    price: ['selling_price', 'average_value', 'list_price'],
    category: ['category', 'type'],
    stage: ['lifecycle_stage', 'stage'],
    margin: ['average_margin', 'margin'],
  },
  market: {
    sector: ['sector', 'industry'],
    size: ['market_size', 'size'],
    growth: ['growth', 'growth_potential'],
    trends: ['trends'],
    competitors: ['competitors'],
  },
  offers: {
    customer: ['customer_name', 'company_name'],
    value: ['total_value', 'est_revenue', 'selling_price'],
    products: ['products', 'items'],
    date: ['first_offer_date', 'date'],
    status: ['status'],
    validUntil: ['valid_to', 'valid_until'],
  },
  sales: {
    customer: ['customer_name', 'company_name'],
    value: ['selling_price', 'total_value'],
    date: ['po_date', 'date'],
    products: ['products', 'product_family'],
    margin: ['margin'],
    paymentStatus: ['payment_status'],
  },
};

const CATEGORY_TO_CONCEPT: Record<string, string> = {
  customers: 'customers',
  leads: 'leads',
  strategy: 'strategy',
  products: 'products',
  market: 'market',
  offers: 'offers',
  sales: 'sales',
  contacts: 'customers',
  employees: 'customers',
};

const extractValue = (record: Record<string, unknown>, aliases: string[]) => {
  for (const alias of aliases) {
    if (record[alias] !== undefined && record[alias] !== null && clean(record[alias]) !== '') {
      return record[alias];
    }
  }
  return undefined;
};

const normalizeByType = (value: unknown, type: ConceptFieldType) => {
  if (value === undefined || value === null) return undefined;

  if (type === 'number') {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }

  if (type === 'currency') {
    return normalizeCurrencyNumber(value) ?? undefined;
  }

  if (type === 'date') {
    const iso = normalizeDateIso(value);
    return iso || undefined;
  }

  if (type === 'array') {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string' && value.includes(',')) return value.split(',').map((item) => item.trim()).filter(Boolean);
    return clean(value) ? [clean(value)] : [];
  }

  return value;
};

const detectRelatedConcepts = (text: string, concept: Concept) => {
  const haystack = normalizeText(text);
  const detected: string[] = [];

  concept.contextualConcepts.forEach((relatedId) => {
    const related = CONCEPT_ONTOLOGY[relatedId];
    if (!related) return;
    if (related.textualPatterns.some((pattern) => haystack.includes(normalizeText(pattern)))) {
      detected.push(relatedId);
    }
  });

  return Array.from(new Set(detected));
};

const contextualNotesFor = (conceptId: string, record: Record<string, unknown>, errors: string[]) => {
  const notes: string[] = [];
  if (errors.length > 0) notes.push(`Validacion parcial: ${errors.join('; ')}`);

  if (conceptId === 'leads') {
    const probability = Number(record.probability ?? 0);
    const value = Number(record.value ?? 0);
    if (probability >= 70) notes.push('Lead caliente por probabilidad elevada.');
    if (value >= 100000) notes.push('Oportunidad de alto valor comercial.');
  }

  if (conceptId === 'sales') {
    const margin = Number(record.margin ?? 0);
    if (margin >= 50) notes.push('Venta con margen superior al umbral recomendado.');
  }

  if (conceptId === 'customers') {
    const revenue = Number(record.revenue ?? 0);
    if (revenue >= 1000000) notes.push('Cliente de alto valor estrategico.');
  }

  return notes;
};

export function resolveConceptFromCategory(category: string) {
  const key = normalizeText(category).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return CATEGORY_TO_CONCEPT[key] || '';
}

export function contextualizeByConcept(params: {
  conceptId: string;
  text: string;
  records: Array<Record<string, unknown>>;
}) {
  const concept = CONCEPT_ONTOLOGY[params.conceptId];
  if (!concept) return [] as ConceptContextualizedRecord[];

  const fieldMappings = CONCEPT_FIELD_MAPPINGS[params.conceptId] || {};

  return params.records.map((row) => {
    const extracted: Record<string, unknown> = {};

    concept.fields.forEach((field) => {
      const aliases = fieldMappings[field.name] || [field.name];
      const raw = extractValue(row, aliases);
      const normalized = normalizeByType(raw, field.type);
      if (normalized !== undefined && normalized !== null && !(Array.isArray(normalized) && normalized.length === 0)) {
        extracted[field.name] = normalized;
      }
    });

    const validation = ConceptValidator.validateRecord(params.conceptId, extracted);
    const relatedConcepts = detectRelatedConcepts(params.text, concept);
    const notes = contextualNotesFor(params.conceptId, extracted, validation.errors);

    const coverage = concept.fields.length > 0
      ? Object.keys(extracted).length / concept.fields.length
      : 0;
    const confidenceBase = validation.valid ? 0.85 : 0.65;
    const confidence = Number(Math.min(0.98, confidenceBase + coverage * 0.1).toFixed(2));

    return {
      concept: params.conceptId,
      extractedData: extracted,
      confidence,
      contextualNotes: notes,
      relatedConcepts,
      validationErrors: validation.errors,
    };
  });
}

export interface LinkedData {
  sourceConcept: string;
  sourceData: Record<string, unknown>;
  targetConcept: string;
  targetData: Record<string, unknown>;
  relationType: ConceptRelationType;
  confidence: number;
}

const compareIdentity = (left: Record<string, unknown>, right: Record<string, unknown>) => {
  const leftName = normalizeText(left.customer || left.company || left.name || '');
  const rightName = normalizeText(right.customer || right.company || right.name || '');
  if (leftName && rightName && leftName === rightName) return 0.9;

  const leftProducts = Array.isArray(left.products) ? left.products.map((p) => normalizeText(p)) : [];
  const rightProducts = Array.isArray(right.products) ? right.products.map((p) => normalizeText(p)) : [];
  if (leftProducts.length > 0 && rightProducts.length > 0) {
    const common = leftProducts.filter((p) => rightProducts.includes(p));
    if (common.length > 0) return 0.7;
  }

  return 0;
};

export function linkCrossConceptData(extractedData: Record<string, Array<Record<string, unknown>>>) {
  const linked: LinkedData[] = [];

  Object.entries(extractedData).forEach(([conceptId, records]) => {
    const concept = CONCEPT_ONTOLOGY[conceptId];
    if (!concept) return;

    concept.relations.forEach((relation) => {
      const targetRecords = extractedData[relation.toConcept] || [];
      records.forEach((sourceRow) => {
        targetRecords.forEach((targetRow) => {
          const score = compareIdentity(sourceRow, targetRow);
          if (score >= 0.6) {
            linked.push({
              sourceConcept: conceptId,
              sourceData: sourceRow,
              targetConcept: relation.toConcept,
              targetData: targetRow,
              relationType: relation.relationType,
              confidence: score,
            });
          }
        });
      });
    });
  });

  const nodeIds = new Set<string>();
  linked.forEach((item) => {
    nodeIds.add(`${item.sourceConcept}:${JSON.stringify(item.sourceData)}`);
    nodeIds.add(`${item.targetConcept}:${JSON.stringify(item.targetData)}`);
  });

  const allNodes: string[] = [];
  Object.entries(extractedData).forEach(([conceptId, rows]) => {
    rows.forEach((row) => allNodes.push(`${conceptId}:${JSON.stringify(row)}`));
  });

  const orphans = allNodes.filter((node) => !nodeIds.has(node));
  const avgConfidence = linked.length > 0
    ? Number((linked.reduce((acc, row) => acc + row.confidence, 0) / linked.length).toFixed(2))
    : 0;

  return {
    linked,
    orphans,
    graph: {
      nodeCount: allNodes.length,
      edgeCount: linked.length,
      avgConfidence,
    },
  };
}

export interface ConceptMemoryEntry {
  conceptId: string;
  recordId: string;
  data: Record<string, unknown>;
  timestamp: string;
  confidence: number;
  sourceDocumentId: string;
  version: number;
}

export class ConceptMemory {
  private memory = new Map<string, ConceptMemoryEntry[]>();

  store(conceptId: string, record: Record<string, unknown>, sourceDocumentId: string, confidence: number) {
    const entries = this.memory.get(conceptId) || [];
    const now = new Date().toISOString();

    const serialized = JSON.stringify(record);
    const similar = entries.find((item) => JSON.stringify(item.data) === serialized);

    const entry: ConceptMemoryEntry = {
      conceptId,
      recordId: similar?.recordId || idFrom(conceptId, `${Date.now()}_${Math.random().toString(36).slice(2)}`),
      data: record,
      timestamp: now,
      confidence,
      sourceDocumentId,
      version: (similar?.version || 0) + 1,
    };

    if (similar) {
      const index = entries.findIndex((item) => item.recordId === similar.recordId);
      entries[index] = entry;
    } else {
      entries.push(entry);
    }

    this.memory.set(conceptId, entries);
    return entry.recordId;
  }

  retrieve(conceptId: string, options?: { minConfidence?: number; limit?: number }) {
    let entries = [...(this.memory.get(conceptId) || [])];

    if (options?.minConfidence !== undefined) {
      entries = entries.filter((entry) => entry.confidence >= options.minConfidence!);
    }

    entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    if (options?.limit !== undefined) {
      entries = entries.slice(0, options.limit);
    }

    return entries;
  }

  getFullContext(conceptId: string, relatedConceptIds: string[]) {
    const mainConcept = this.retrieve(conceptId, { minConfidence: 0.6 });
    const relatedConcepts: Record<string, ConceptMemoryEntry[]> = {};

    relatedConceptIds.forEach((relatedId) => {
      relatedConcepts[relatedId] = this.retrieve(relatedId, { minConfidence: 0.6, limit: 20 });
    });

    const relatedCount = Object.values(relatedConcepts).reduce((acc, rows) => acc + rows.length, 0);
    const summary = `Concepto ${conceptId}: ${mainConcept.length} registros principales, ${relatedCount} relacionados.`;

    return { mainConcept, relatedConcepts, summary };
  }
}

const conceptMemorySingleton = new ConceptMemory();

export function buildConceptIntelligence(params: {
  category: string;
  text: string;
  sourceDocumentId: string;
  validatedRecords: Array<Record<string, unknown>>;
}) {
  const primaryConcept = resolveConceptFromCategory(params.category);
  const primaryRows = primaryConcept
    ? contextualizeByConcept({
        conceptId: primaryConcept,
        text: params.text,
        records: params.validatedRecords,
      })
    : [];

  const extractedByConcept: Record<string, Array<Record<string, unknown>>> = {};
  if (primaryConcept) {
    extractedByConcept[primaryConcept] = primaryRows.map((row) => row.extractedData);
  }

  const conceptMentions = Object.values(CONCEPT_ONTOLOGY)
    .filter((concept) => concept.textualPatterns.some((pattern) => normalizeText(params.text).includes(normalizeText(pattern))))
    .map((concept) => concept.id);

  conceptMentions.forEach((conceptId) => {
    if (!extractedByConcept[conceptId]) {
      extractedByConcept[conceptId] = contextualizeByConcept({
        conceptId,
        text: params.text,
        records: params.validatedRecords,
      }).map((row) => row.extractedData);
    }
  });

  const linking = linkCrossConceptData(extractedByConcept);

  const memorySnapshot: Record<string, { count: number; summary: string }> = {};
  Object.entries(extractedByConcept).forEach(([conceptId, rows]) => {
    rows.forEach((row) => {
      conceptMemorySingleton.store(conceptId, row, params.sourceDocumentId, 0.8);
    });
    const related = CONCEPT_ONTOLOGY[conceptId]?.contextualConcepts || [];
    const full = conceptMemorySingleton.getFullContext(conceptId, related);
    memorySnapshot[conceptId] = {
      count: full.mainConcept.length,
      summary: full.summary,
    };
  });

  return {
    conceptDriven: true,
    primaryConcept,
    conceptsDetected: Object.keys(extractedByConcept),
    contextualized: primaryRows,
    crossConcept: linking,
    memory: memorySnapshot,
    ontologyVersion: 'semantic-v1',
  };
}
