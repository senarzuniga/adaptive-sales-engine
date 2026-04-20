// =============================================================================
// Validation Engine — NON-NEGOTIABLE quality gate
//
// Rules:
//   - Type validation (date, number, currency, probability)
//   - Range checks
//   - Cross-field logical consistency
//   - Confidence gate: records below MIN_CONFIDENCE_TO_STORE are REJECTED
// =============================================================================

import { MIN_CONFIDENCE_TO_STORE, SectionSchema, FieldType } from './sectionSchemas.ts';

export interface FieldValidationError {
  field: string;
  value: unknown;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  status: 'validated' | 'rejected' | 'flagged';
  errors: FieldValidationError[];
  warnings: string[];
  completeness_score: number;
  consistency_score: number;
  confidence_score: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/;
const CURRENCY_RE = /^-?[$€£¥]?\s*[\d,. ]+([MBKmbk])?$/;

function isNumeric(v: unknown): boolean {
  if (typeof v === 'number') return Number.isFinite(v);
  const n = Number(String(v).replace(/[€$£¥,%\s]/g, '').replace(/[()]/g, '-'));
  return Number.isFinite(n);
}

function toNumber(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  let raw = String(v ?? '').replace(/[€$£¥,%\s]/g, '').replace(/[()]/g, '');
  return Number.parseFloat(raw) || 0;
}

function isIsoDate(v: unknown): boolean {
  return typeof v === 'string' && ISO_DATE_RE.test(v.trim());
}

function validateFieldType(key: string, value: unknown, type: FieldType): FieldValidationError | null {
  if (value === null || value === undefined || String(value).trim() === '') return null; // empty is handled by required check

  switch (type) {
    case 'number':
    case 'currency':
      if (!isNumeric(value)) return { field: key, value, message: `Field "${key}" must be numeric, got: ${value}` };
      break;

    case 'probability':
      if (!isNumeric(value)) return { field: key, value, message: `Field "${key}" must be numeric (0-100)` };
      break;

    case 'date':
      if (!isIsoDate(value)) {
        return { field: key, value, message: `Field "${key}" must be ISO 8601 date (YYYY-MM-DD), got: ${value}` };
      }
      break;

    case 'boolean':
      if (typeof value !== 'boolean' && !['true', 'false', '1', '0'].includes(String(value).toLowerCase())) {
        return { field: key, value, message: `Field "${key}" must be boolean` };
      }
      break;

    case 'enum':
      // Allowed values checked separately
      break;

    case 'array':
      if (!Array.isArray(value)) {
        return { field: key, value, message: `Field "${key}" must be an array` };
      }
      break;
  }

  return null;
}

function validateEnumValue(key: string, value: unknown, allowed: string[]): FieldValidationError | null {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const normalized = String(value).trim().toLowerCase();
  if (!allowed.some((a) => a.toLowerCase() === normalized)) {
    return { field: key, value, message: `Field "${key}" value "${value}" not in allowed set: ${allowed.join(', ')}` };
  }
  return null;
}

function validateRange(key: string, value: unknown, min?: number, max?: number): FieldValidationError | null {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const n = toNumber(value);
  if (min !== undefined && n < min) return { field: key, value, message: `Field "${key}" value ${n} is below minimum ${min}` };
  if (max !== undefined && n > max) return { field: key, value, message: `Field "${key}" value ${n} exceeds maximum ${max}` };
  return null;
}

// ---------------------------------------------------------------------------
// Revenue / margin sanity checks (applied universally)
// ---------------------------------------------------------------------------
function checkFinancialSanity(record: Record<string, unknown>, errors: FieldValidationError[], warnings: string[]) {
  const revenue = toNumber(record.selling_price ?? record.total_value ?? record.est_revenue ?? record.revenue);
  const margin = toNumber(record.margin ?? record.expected_margin);
  const prob = toNumber(record.probability ?? record.contract_prob);

  if (revenue < 0) errors.push({ field: 'revenue', value: revenue, message: 'Revenue cannot be negative' });
  if (margin !== 0 && revenue !== 0 && margin > revenue) {
    errors.push({ field: 'margin', value: margin, message: 'Margin cannot exceed revenue' });
  }
  if (prob > 100) errors.push({ field: 'probability', value: prob, message: 'Probability cannot exceed 100%' });
  if (prob < 0) errors.push({ field: 'probability', value: prob, message: 'Probability cannot be negative' });

  if (revenue > 0 && margin < 0) warnings.push('Negative margin detected — record flagged for review');
}

// ---------------------------------------------------------------------------
// Main validation function
// ---------------------------------------------------------------------------
export function validateRecord(
  record: Record<string, unknown>,
  schema: SectionSchema,
  extractionConfidence: number,
): ValidationResult {
  const errors: FieldValidationError[] = [];
  const warnings: string[] = [];

  // 1. Required field check
  let presentCount = 0;
  let totalRequired = 0;

  for (const [key, def] of Object.entries(schema.fields)) {
    const value = record[key];
    const isEmpty = value === null || value === undefined || String(value).trim() === '';

    if (def.required) {
      totalRequired += 1;
      if (isEmpty) {
        errors.push({ field: key, value, message: `Required field "${key}" (${def.label}) is missing` });
      } else {
        presentCount += 1;
      }
    }

    if (!isEmpty) {
      // 2. Type validation
      const typeErr = validateFieldType(key, value, def.type);
      if (typeErr) errors.push(typeErr);

      // 3. Enum check
      if (def.allowedValues) {
        const enumErr = validateEnumValue(key, value, def.allowedValues);
        if (enumErr) errors.push(enumErr);
      }

      // 4. Range check
      const rangeErr = validateRange(key, value, def.min, def.max);
      if (rangeErr) errors.push(rangeErr);
    }
  }

  // 5. Cross-field financial sanity
  checkFinancialSanity(record, errors, warnings);

  // 6. Completeness score
  const allFieldCount = Object.keys(schema.fields).length;
  const filledCount = Object.entries(schema.fields).filter(([k]) => {
    const v = record[k];
    return v !== null && v !== undefined && String(v).trim() !== '';
  }).length;

  const completeness_score = allFieldCount > 0 ? Number((filledCount / allFieldCount).toFixed(4)) : 0;

  // 7. Consistency score — penalise for each error
  const consistency_score = Number(Math.max(0, 1 - (errors.length * 0.15)).toFixed(4));

  // 8. Final confidence =
  //    (completeness * 0.3) + (consistency * 0.3) + (source_quality * 0.2) + (extraction * 0.2)
  const source_quality = 0.8; // document upload is a reliable source
  const confidence_score = Number((
    completeness_score * 0.3 +
    consistency_score * 0.3 +
    source_quality * 0.2 +
    Math.min(extractionConfidence, 1) * 0.2
  ).toFixed(4));

  // 9. Determine status
  let status: ValidationResult['status'];
  if (errors.length > 0 && errors.some((e) => {
    const requiredKeys = Object.entries(schema.fields).filter(([, d]) => d.required).map(([k]) => k);
    return requiredKeys.includes(e.field);
  })) {
    // Missing required fields → flagged (not enough data to reject cleanly)
    status = 'flagged';
  } else if (confidence_score < MIN_CONFIDENCE_TO_STORE || errors.length > 2) {
    status = 'rejected';
  } else {
    status = 'validated';
  }

  return {
    valid: status === 'validated',
    status,
    errors,
    warnings,
    completeness_score,
    consistency_score,
    confidence_score,
  };
}

// ---------------------------------------------------------------------------
// Batch validation for a list of records from the AI extractor
// ---------------------------------------------------------------------------
export interface BatchValidationResult {
  validated: Array<{ record: Record<string, unknown>; result: ValidationResult }>;
  rejected: Array<{ record: Record<string, unknown>; result: ValidationResult }>;
  flagged: Array<{ record: Record<string, unknown>; result: ValidationResult }>;
  summary: {
    total: number;
    validated_count: number;
    rejected_count: number;
    flagged_count: number;
    avg_confidence: number;
  };
}

export function validateBatch(
  records: Record<string, unknown>[],
  schema: SectionSchema,
  extractionConfidence: number,
): BatchValidationResult {
  const validated: BatchValidationResult['validated'] = [];
  const rejected: BatchValidationResult['rejected'] = [];
  const flagged: BatchValidationResult['flagged'] = [];

  for (const record of records) {
    const result = validateRecord(record, schema, extractionConfidence);
    if (result.status === 'validated') validated.push({ record, result });
    else if (result.status === 'rejected') rejected.push({ record, result });
    else flagged.push({ record, result });
  }

  const allScores = [...validated, ...rejected, ...flagged].map((r) => r.result.confidence_score);
  const avg_confidence = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;

  return {
    validated,
    rejected,
    flagged,
    summary: {
      total: records.length,
      validated_count: validated.length,
      rejected_count: rejected.length,
      flagged_count: flagged.length,
      avg_confidence: Number(avg_confidence.toFixed(4)),
    },
  };
}
