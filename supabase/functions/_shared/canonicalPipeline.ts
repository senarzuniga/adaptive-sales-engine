export type CanonicalCategory =
  | 'contacts'
  | 'leads'
  | 'customers'
  | 'sales'
  | 'offers'
  | 'strategy'
  | 'products'
  | 'employees'
  | 'finance'
  | 'market'
  | 'competitors'
  | 'contracts'
  | 'general';

export type ValidationStatus = 'raw_extracted' | 'validated' | 'rejected' | 'flagged' | 'enriched' | 'analytical';

export interface SectionScopedExtractionInput {
  category: string;
  documentId: string;
  uploadSection: string;
  rows: Array<Record<string, unknown>>;
  sourceType?: string;
  extractionTimestamp?: string;
}

export interface ExtractedEntityRecord {
  id?: string;
  section: string;
  extracted_fields: Record<string, unknown>;
  confidence_score: number;
  source_document_id: string;
  source_type: string;
  extraction_timestamp: string;
  uploaded_section: string;
  completeness_score?: number;
  consistency_score?: number;
  validation_status?: ValidationStatus;
  validation_issues?: string[];
  version?: number;
}

export interface EnrichedCanonicalRecord {
  id: string;
  source_document_id: string;
  source_type: string;
  extraction_timestamp: string;
  uploaded_section: string;
  confidence_score: number;
  completeness_score: number;
  consistency_score: number;
  validation_status: ValidationStatus;
  created_at: string;
  updated_at: string;
  version: number;
  data_maturity: 'raw_extracted' | 'normalized' | 'enriched' | 'validated' | 'analytical';
  normalized_fields: Record<string, unknown>;
  linked_entities: Record<string, string>;
  derived_metrics: Record<string, number>;
  ai_insights: Record<string, unknown>;
  alternative_values: Record<string, unknown[]>;
}

export interface ValidationResult {
  validated: ExtractedEntityRecord[];
  rejected: Array<ExtractedEntityRecord & { validation_status: 'rejected'; validation_issues: string[] }>;
  report: {
    section: string;
    validated: number;
    rejected: number;
  };
}

export interface EnrichmentLogEntry {
  source_document_id: string;
  action: string;
  entity_key: string;
  details: Record<string, unknown>;
  confidence_after: number;
  created_at: string;
}

export interface EnrichmentResult {
  records: EnrichedCanonicalRecord[];
  logs: EnrichmentLogEntry[];
}

export interface PreprocessResult {
  cleanedText: string;
  language: string;
  duplicateLinesRemoved: number;
}

const clean = (value: unknown) => String(value ?? '').trim();
const normalizeKey = (value: unknown) => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const unique = <T,>(items: T[]) => [...new Set(items)];

export function parseFlexibleNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

  let raw = clean(value);
  if (!raw) return 0;

  const negative = (raw.includes('(') && raw.includes(')')) || raw.startsWith('-');
  raw = raw
    .replace(/[()]/g, '')
    .replace(/^[+-]/, '')
    .replace(/\s+/g, '')
    .replace(/[€$£¥]/g, '')
    .replace(/%/g, '');

  const commaCount = (raw.match(/,/g) || []).length;
  const dotCount = (raw.match(/\./g) || []).length;

  if (commaCount > 0 && dotCount > 0) {
    raw = raw.lastIndexOf(',') > raw.lastIndexOf('.') ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '');
  } else if (commaCount > 1) {
    raw = raw.replace(/,/g, '');
  } else if (dotCount > 1) {
    raw = raw.replace(/\./g, '');
  } else if (commaCount === 1) {
    const [left, right] = raw.split(',');
    raw = left !== '0' && right?.length === 3 ? `${left}${right}` : `${left}.${right ?? ''}`;
  } else if (dotCount === 1) {
    const [left, right] = raw.split('.');
    if (left !== '0' && right?.length === 3) raw = `${left}${right}`;
  }

  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? (negative ? -parsed : parsed) : 0;
}

export function normalizeOpportunityStatus(value: unknown): 'won' | 'lost' | 'neglected' | 'open' {
  const status = clean(value).toLowerCase();
  if (!status) return 'open';
  if (['won', 'ganado', 'sold', 'vendido', 'closed won', 'booked', 'awarded'].some((token) => status.includes(token))) return 'won';
  if (['lost', 'perdido', 'closed lost', 'cancel', 'rejected', 'declined'].some((token) => status.includes(token))) return 'lost';
  if (['desatendido', 'neglected', 'unattended', 'stalled', 'abandoned', 'sin seguimiento'].some((token) => status.includes(token))) return 'neglected';
  return 'open';
}

export function normalizeCurrency(value: unknown): string {
  const currency = clean(value).toUpperCase();
  if (!currency) return 'EUR';
  if (currency.includes('€') || currency.includes('EUR')) return 'EUR';
  if (currency.includes('$') || currency.includes('USD')) return 'USD';
  if (currency.includes('GBP') || currency.includes('£')) return 'GBP';
  return currency.slice(0, 3) || 'EUR';
}

export function toIsoDate(value: unknown): string {
  const raw = clean(value);
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const normalized = raw.replace(/\./g, '-').replace(/\//g, '-');
  const direct = new Date(normalized);
  if (!Number.isNaN(direct.getTime())) return direct.toISOString().slice(0, 10);

  const parts = normalized.split('-');
  if (parts.length === 3) {
    const [a, b, c] = parts;
    if (a.length === 2 && b.length === 2 && c.length === 4) {
      return `${c}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
    }
  }

  return '';
}

export function toCanonicalTable(category: string): string {
  const normalized = normalizeKey(category);
  const mapping: Record<string, string> = {
    contacts: 'company_contacts',
    leads: 'company_contacts',
    customers: 'customers',
    sales: 'orders',
    offers: 'offers',
    strategy: 'strategy',
    products: 'products',
    employees: 'company_contacts',
    competitors: 'competitors',
    finance: 'company_info_update',
    market: 'company_info_update',
    general: 'none',
  };
  return mapping[normalized] || 'none';
}

export function preprocessDocumentText(text: string): PreprocessResult {
  const lines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const deduped = lines.filter((line) => {
    const key = normalizeKey(line);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const joined = deduped.join('\n');
  const spanishSignals = (joined.match(/\b(el|la|de|para|con|empresa|ventas|oferta)\b/gi) || []).length;
  const englishSignals = (joined.match(/\b(the|and|for|with|company|sales|offer)\b/gi) || []).length;

  return {
    cleanedText: joined,
    language: spanishSignals > englishSignals ? 'es' : 'en',
    duplicateLinesRemoved: Math.max(0, lines.length - deduped.length),
  };
}

const pickValue = (row: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && clean(value) !== '') return clean(value);
  }
  return '';
};

const mapRowByCategory = (category: CanonicalCategory, row: Record<string, unknown>) => {
  switch (category) {
    case 'contacts':
    case 'employees':
      return {
        name: pickValue(row, ['name', 'full_name', 'contact', 'contact_name']),
        email: pickValue(row, ['email', 'email_address', 'mail']),
        role: pickValue(row, ['role', 'job_title', 'title']),
        department: pickValue(row, ['department', 'dept']),
        notes: pickValue(row, ['notes', 'phone', 'comments']),
      };
    case 'leads':
      return {
        lead_name: pickValue(row, ['lead_name', 'name', 'full_name', 'contact_name']),
        company_name: pickValue(row, ['company_name', 'customer_name', 'account', 'company']),
        email: pickValue(row, ['email', 'email_address', 'mail']),
        status: pickValue(row, ['status', 'stage']) || 'open',
        source: pickValue(row, ['source', 'channel']),
        estimated_value: parseFlexibleNumber(pickValue(row, ['estimated_value', 'value', 'amount'])),
      };
    case 'customers':
      return {
        customer_name: pickValue(row, ['customer_name', 'customer', 'account', 'company_name', 'name']),
        account_tier: pickValue(row, ['account_tier', 'tier']),
        strategic_importance: parseFlexibleNumber(pickValue(row, ['strategic_importance', 'importance'])),
        growth_potential: parseFlexibleNumber(pickValue(row, ['growth_potential', 'growth'])),
        relationship_strength: parseFlexibleNumber(pickValue(row, ['relationship_strength', 'relationship'])),
        operating_region: pickValue(row, ['operating_region', 'region']),
        sector: pickValue(row, ['sector', 'segment']),
        notes: pickValue(row, ['notes', 'comments']),
      };
    case 'sales':
      return {
        po_date: pickValue(row, ['po_date', 'date', 'order_date']),
        customer_name: pickValue(row, ['customer_name', 'customer', 'account']),
        product_family: pickValue(row, ['product_family', 'product', 'item']),
        region: pickValue(row, ['region']),
        country: pickValue(row, ['country']),
        segment: pickValue(row, ['segment']),
        selling_price: parseFlexibleNumber(pickValue(row, ['selling_price', 'price', 'amount', 'value'])),
        margin: parseFlexibleNumber(pickValue(row, ['margin', 'gross_margin'])),
        currency: normalizeCurrency(pickValue(row, ['currency'])),
        kam: pickValue(row, ['kam', 'account_manager']),
        purchasing_year: pickValue(row, ['purchasing_year', 'year']),
        purchasing_quarter: pickValue(row, ['purchasing_quarter', 'quarter']),
        scope: pickValue(row, ['scope']),
      };
    case 'offers':
      return {
        offer_number: pickValue(row, ['offer_number', 'opp_number', 'opportunity_id', 'id']),
        title: pickValue(row, ['title', 'scope', 'description']),
        customer_name: pickValue(row, ['customer_name', 'customer', 'account']),
        status: normalizeOpportunityStatus(pickValue(row, ['status', 'stage'])),
        total_value: parseFlexibleNumber(pickValue(row, ['total_value', 'est_revenue', 'revenue', 'amount', 'value', 'selling_price', 'price'])),
        margin: parseFlexibleNumber(pickValue(row, ['margin'])),
        currency: normalizeCurrency(pickValue(row, ['currency'])),
        probability: Math.max(0, Math.min(100, parseFlexibleNumber(pickValue(row, ['probability', 'contract_prob'])))),
      };
    case 'strategy':
      return {
        product_family: pickValue(row, ['product_family', 'product']),
        number_of_segment: pickValue(row, ['number_of_segment', 'segment']),
        region: pickValue(row, ['region']),
        est_purchasing_quarter: pickValue(row, ['est_purchasing_quarter', 'quarter']),
        est_revenue: parseFlexibleNumber(pickValue(row, ['est_revenue', 'revenue', 'amount'])),
        margin: parseFlexibleNumber(pickValue(row, ['margin'])),
        kam: pickValue(row, ['kam', 'account_manager']),
      };
    case 'products': {
      const unitCost = parseFlexibleNumber(pickValue(row, ['unit_cost', 'cost', 'usd_purchase', 'compra', 'coste']));
      const sellingPrice = parseFlexibleNumber(pickValue(row, ['selling_price', 'sale_price', 'pvp_cliente', 'venta', 'price', 'value']));
      const averageValue = parseFlexibleNumber(pickValue(row, ['average_value', 'pvp_in', 'selling_price', 'sale_price', 'price', 'value'])) || sellingPrice;

      return {
        name: pickValue(row, ['name', 'product', 'product_name', 'text', 'descripcion', 'description', 'item']),
        sku: pickValue(row, ['sku', 'code', 'codigo', 'ref', 'reference']),
        category: pickValue(row, ['category', 'categoria', '__sheet_name']),
        subcategory: pickValue(row, ['subcategory', 'subcategoria', 'line']),
        brand: pickValue(row, ['brand', 'marca']),
        description: pickValue(row, ['description', 'descripcion', 'notes', 'comments']),
        currency: normalizeCurrency(pickValue(row, ['currency', 'moneda'])),
        list_price: sellingPrice || averageValue,
        unit_cost: unitCost,
        selling_price: sellingPrice || averageValue,
        average_value: averageValue,
        average_margin: parseFlexibleNumber(pickValue(row, ['average_margin', 'margin', 'margin_kam'])),
        stock_quantity: parseFlexibleNumber(pickValue(row, ['stock_quantity', 'qty', 'cantidad', 'stock'])),
        stock_unit: pickValue(row, ['stock_unit', 'unit', 'unidad']),
        lead_time_days: parseFlexibleNumber(pickValue(row, ['lead_time_days', 'lead_time', 'plazo'])),
        moq: parseFlexibleNumber(pickValue(row, ['moq', 'minimum_order_quantity'])),
        packaging: pickValue(row, ['packaging', 'empaque']),
        tags: unique((pickValue(row, ['tags', 'tag']) || '').split(/[;,]/g).map((tag) => tag.trim()).filter(Boolean)),
        markets: unique((pickValue(row, ['markets', 'market']) || '').split(/[;,]/g).map((market) => market.trim()).filter(Boolean)),
        type: pickValue(row, ['type', 'lifecycle', 'lifecycle_stage', 'category']) || 'Core',
        lifecycle_stage: pickValue(row, ['lifecycle_stage', 'lifecycle', 'type']) || 'core',
        status: pickValue(row, ['status']) || 'active',
        comments: pickValue(row, ['comments', 'notes', 'description']),
        source_sheet: pickValue(row, ['__sheet_name']),
        source_row: parseFlexibleNumber(pickValue(row, ['__row_number'])),
      };
    }
    case 'competitors':
      return {
        competitor_name: pickValue(row, ['competitor_name', 'name']),
        product_family: pickValue(row, ['product_family', 'product']),
        positioning: pickValue(row, ['positioning']),
        price_positioning: pickValue(row, ['price_positioning', 'price']),
        value_proposition: pickValue(row, ['value_proposition', 'value']),
      };
    default:
      return Object.fromEntries(
        Object.entries(row)
          .filter(([, value]) => clean(value) !== '')
          .slice(0, 12),
      );
  }
};

const hasUsefulValue = (record: Record<string, unknown>) =>
  Object.values(record).some((value) => clean(value) !== '' && clean(value) !== '0');

const scoreCompleteness = (record: Record<string, unknown>) => {
  const values = Object.values(record);
  if (values.length === 0) return 0;
  const populated = values.filter((value) => clean(value) !== '' && clean(value) !== '0').length;
  return Number((populated / values.length).toFixed(2));
};

const scoreConsistency = (issueCount: number) => Number(Math.max(0, 1 - issueCount * 0.2).toFixed(2));

const buildEntityKey = (section: string, fields: Record<string, unknown>) => {
  const primary =
    clean(fields.email) ||
    clean(fields.offer_number) ||
    clean(fields.opp_number) ||
    clean(fields.customer_name) ||
    clean(fields.company_name) ||
    clean(fields.name) ||
    clean(fields.lead_name);

  return `${normalizeKey(section)}_${normalizeKey(primary || JSON.stringify(fields).slice(0, 80) || 'record')}`;
};

export function extractSectionScopedRecords(input: SectionScopedExtractionInput): ExtractedEntityRecord[] {
  const section = (normalizeKey(input.category) || 'general') as CanonicalCategory;
  const extractionTimestamp = input.extractionTimestamp || new Date().toISOString();

  return input.rows
    .map((row) => mapRowByCategory(section, row))
    .filter((row) => hasUsefulValue(row))
    .map((extracted_fields) => ({
      section,
      extracted_fields,
      confidence_score: Math.max(0.55, Math.min(0.95, 0.55 + scoreCompleteness(extracted_fields) * 0.4)),
      source_document_id: input.documentId,
      source_type: input.sourceType || 'document_upload',
      extraction_timestamp: extractionTimestamp,
      uploaded_section: input.uploadSection,
      validation_status: 'raw_extracted',
      version: 1,
    }));
}

export function validateExtractedRecords(section: string, records: ExtractedEntityRecord[]): ValidationResult {
  const validated: ExtractedEntityRecord[] = [];
  const rejected: Array<ExtractedEntityRecord & { validation_status: 'rejected'; validation_issues: string[] }> = [];

  records.forEach((record) => {
    const normalizedFields = { ...record.extracted_fields };
    const issues: string[] = [];

    const dateFields = ['po_date', 'first_offer_date', 'valid_from', 'valid_to'];
    dateFields.forEach((field) => {
      const rawValue = normalizedFields[field];
      if (clean(rawValue)) {
        const iso = toIsoDate(rawValue);
        if (iso) normalizedFields[field] = iso;
        else issues.push(`${field} must be in ISO date format.`);
      }
    });

    ['selling_price', 'margin', 'est_revenue', 'total_value', 'estimated_value', 'average_value', 'growth_potential', 'relationship_strength', 'strategic_importance']
      .forEach((field) => {
        if (field in normalizedFields) normalizedFields[field] = parseFlexibleNumber(normalizedFields[field]);
      });

    if ('currency' in normalizedFields) normalizedFields.currency = normalizeCurrency(normalizedFields.currency);
    if ('probability' in normalizedFields) normalizedFields.probability = Math.max(0, Math.min(100, parseFlexibleNumber(normalizedFields.probability)));
    if ('contract_prob' in normalizedFields) normalizedFields.contract_prob = Math.max(0, Math.min(100, parseFlexibleNumber(normalizedFields.contract_prob)));
    if ('status' in normalizedFields) normalizedFields.status = normalizeOpportunityStatus(normalizedFields.status);

    const revenue = Number(normalizedFields.selling_price ?? normalizedFields.est_revenue ?? normalizedFields.total_value ?? 0);
    const margin = Number(normalizedFields.margin ?? 0);

    if (revenue < 0) issues.push('Revenue must be greater than or equal to 0.');
    if (margin < 0) issues.push('Margin must be greater than or equal to 0.');
    if (revenue > 0 && margin > revenue) issues.push('Margin cannot exceed revenue.');

    const validFrom = clean(normalizedFields.valid_from);
    const validTo = clean(normalizedFields.valid_to);
    if (validFrom && validTo && validFrom > validTo) issues.push('Dates are not chronological.');

    if ((record.confidence_score ?? 0) < 0.75) issues.push('Confidence score is below the canonical threshold of 0.75.');

    const completeness_score = scoreCompleteness(normalizedFields);
    const consistency_score = scoreConsistency(issues.length);

    const nextRecord: ExtractedEntityRecord = {
      ...record,
      extracted_fields: normalizedFields,
      completeness_score,
      consistency_score,
      validation_issues: issues,
      validation_status: issues.length === 0 ? 'validated' : 'rejected',
      version: record.version || 1,
    };

    if (issues.length === 0) validated.push(nextRecord);
    else rejected.push({ ...nextRecord, validation_status: 'rejected', validation_issues: issues });
  });

  return {
    validated,
    rejected,
    report: {
      section: normalizeKey(section) || 'general',
      validated: validated.length,
      rejected: rejected.length,
    },
  };
}

export function buildConfidenceScore(params: {
  completeness: number;
  consistency: number;
  sourceQuality: number;
  crossValidation: number;
}): number {
  return Number((
    (params.completeness * 0.3) +
    (params.consistency * 0.3) +
    (params.sourceQuality * 0.2) +
    (params.crossValidation * 0.2)
  ).toFixed(2));
}

const deriveMetrics = (fields: Record<string, unknown>) => {
  const metrics: Record<string, number> = {};
  const revenue = Number(fields.selling_price ?? fields.est_revenue ?? fields.total_value ?? 0);
  const margin = Number(fields.margin ?? 0);
  if (revenue > 0 && margin >= 0) metrics.margin_percentage = Number(((margin / revenue) * 100).toFixed(2));
  if (Number(fields.probability ?? fields.contract_prob ?? 0) > 0) metrics.win_rate = Number(fields.probability ?? fields.contract_prob ?? 0);
  if (revenue > 0) metrics.customer_lifetime_value = Number((revenue * 1.2).toFixed(2));
  return metrics;
};

export function enrichValidatedRecords(section: string, records: ExtractedEntityRecord[]): EnrichmentResult {
  const winnerByKey = new Map<string, EnrichedCanonicalRecord>();
  const logs: EnrichmentLogEntry[] = [];
  const now = new Date().toISOString();

  records.forEach((record) => {
    const dedupeKey = buildEntityKey(section, record.extracted_fields);
    const derived_metrics = deriveMetrics(record.extracted_fields);
    const linked_entities: Record<string, string> = {};

    if (clean(record.extracted_fields.customer_name)) linked_entities.customer_ref = normalizeKey(record.extracted_fields.customer_name);
    if (clean(record.extracted_fields.company_name)) linked_entities.customer_ref = normalizeKey(record.extracted_fields.company_name);
    if (clean(record.extracted_fields.email)) linked_entities.contact_ref = normalizeKey(record.extracted_fields.email);

    const sourceQuality = Math.max(0.75, Math.min(1, record.confidence_score || 0.75));
    const crossValidation = Object.keys(linked_entities).length > 0 ? 0.9 : 0.7;
    const confidence_score = buildConfidenceScore({
      completeness: record.completeness_score ?? scoreCompleteness(record.extracted_fields),
      consistency: record.consistency_score ?? 0.9,
      sourceQuality,
      crossValidation,
    });

    const enriched: EnrichedCanonicalRecord = {
      id: record.id || dedupeKey,
      source_document_id: record.source_document_id,
      source_type: record.source_type || 'document_upload',
      extraction_timestamp: record.extraction_timestamp,
      uploaded_section: record.uploaded_section,
      confidence_score,
      completeness_score: record.completeness_score ?? scoreCompleteness(record.extracted_fields),
      consistency_score: record.consistency_score ?? 0.9,
      validation_status: 'validated',
      created_at: now,
      updated_at: now,
      version: record.version || 1,
      data_maturity: 'enriched',
      normalized_fields: {
        ...record.extracted_fields,
        currency: 'currency' in record.extracted_fields ? normalizeCurrency(record.extracted_fields.currency) : undefined,
      },
      linked_entities,
      derived_metrics,
      ai_insights: {
        ai_generated: true,
        segmentation: confidence_score >= 0.85 ? 'high-value' : confidence_score >= 0.75 ? 'growth' : 'flagged',
        risk_indicator: confidence_score >= 0.85 ? 'low' : confidence_score >= 0.75 ? 'medium' : 'high',
        propensity_score: Math.round(confidence_score * 100),
      },
      alternative_values: {},
    };

    const existing = winnerByKey.get(dedupeKey);
    if (!existing || enriched.confidence_score >= existing.confidence_score) {
      if (existing) {
        existing.alternative_values = {
          ...existing.alternative_values,
          superseded_record: unique([JSON.stringify(existing.normalized_fields)]),
        };
      }
      winnerByKey.set(dedupeKey, enriched);
    } else {
      const current = winnerByKey.get(dedupeKey)!;
      current.alternative_values = {
        ...current.alternative_values,
        candidate_record: [...(current.alternative_values.candidate_record || []), enriched.normalized_fields],
      };
    }

    logs.push({
      source_document_id: record.source_document_id,
      action: 'record_enriched',
      entity_key: dedupeKey,
      details: {
        section: normalizeKey(section),
        linked_entities,
        derived_metrics,
        selected_value: record.extracted_fields,
      },
      confidence_after: confidence_score,
      created_at: now,
    });
  });

  return {
    records: Array.from(winnerByKey.values()).map((record) => ({
      ...record,
      validation_status: record.confidence_score >= 0.75 ? 'enriched' : 'flagged',
    })),
    logs,
  };
}

export const DocumentIngestionService = {
  buildRawDocumentRecord(params: {
    documentId: string;
    companyId: string;
    filePath: string;
    uploadSection: string;
    uploadedBy?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    return {
      document_id: params.documentId,
      company_id: params.companyId,
      file_path: params.filePath,
      upload_section: params.uploadSection,
      uploaded_by: params.uploadedBy || null,
      timestamp: new Date().toISOString(),
      metadata: params.metadata || {},
    };
  },
};

export const PreprocessingService = {
  run: preprocessDocumentText,
};

export const SectionBasedExtractionService = {
  extract: extractSectionScopedRecords,
};

export const ValidationService = {
  validate: validateExtractedRecords,
};

export const DataEnrichmentService = {
  enrich: enrichValidatedRecords,
};

export const CanonicalStorageService = {
  tableForCategory: toCanonicalTable,
};
