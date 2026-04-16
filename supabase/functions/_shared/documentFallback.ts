import * as XLSX from "https://esm.sh/xlsx@0.18.5";

export interface FallbackMeta {
  category: string;
  fileName: string;
  targetTable: string;
}

const normalizeKey = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const parseNumber = (value: unknown) => {
  let raw = String(value ?? '').trim();
  if (!raw) return 0;

  const negative = (raw.includes('(') && raw.includes(')')) || raw.startsWith('-');
  raw = raw.replace(/[()]/g, '').replace(/^[+-]/, '').replace(/\s+/g, '').replace(/[€$£¥]/g, '').replace(/%/g, '');

  const commaCount = (raw.match(/,/g) || []).length;
  const dotCount = (raw.match(/\./g) || []).length;

  if (commaCount > 0 && dotCount > 0) {
    raw = raw.lastIndexOf(',') > raw.lastIndexOf('.')
      ? raw.replace(/\./g, '').replace(',', '.')
      : raw.replace(/,/g, '');
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

  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) ? (negative ? -parsed : parsed) : 0;
};

const normalizeOpportunityStatus = (value: unknown) => {
  const status = String(value ?? '').trim().toLowerCase();
  if (!status) return 'open';
  if (['won', 'ganado', 'sold', 'vendido', 'closed won', 'booked', 'awarded'].some((token) => status.includes(token))) return 'won';
  if (['lost', 'perdido', 'closed lost', 'cancel', 'rejected', 'declined'].some((token) => status.includes(token))) return 'lost';
  if (['desatendido', 'neglected', 'unattended', 'stalled', 'abandoned', 'sin seguimiento'].some((token) => status.includes(token))) return 'neglected';
  return 'open';
};

const pickValue = (row: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
};

const detectDelimiter = (header: string) => {
  const delimiters = [',', ';', '\t', '|'];
  return delimiters.sort((a, b) => header.split(b).length - header.split(a).length)[0] || ',';
};

const parseStructuredRows = (content: string | ArrayBuffer) => {
  if (content instanceof ArrayBuffer) {
    try {
      const workbook = XLSX.read(content, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      return rows.slice(0, 200).map((row) => {
        const normalized: Record<string, unknown> = {};
        Object.entries(row).forEach(([key, value]) => {
          normalized[normalizeKey(key)] = value;
        });
        return normalized;
      });
    } catch {
      return [] as Record<string, unknown>[];
    }
  }

  const trimmed = content.trim();
  if (!trimmed) return [] as Record<string, unknown>[];

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed as Record<string, unknown>[];
      if (Array.isArray((parsed as any)?.data)) return (parsed as any).data as Record<string, unknown>[];
    } catch {
      // Fall through to delimited parsing.
    }
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [] as Record<string, unknown>[];

  const delimiter = detectDelimiter(lines[0]);
  const headers = lines[0].split(delimiter).map((header) => normalizeKey(header));

  return lines.slice(1, 201).map((line) => {
    const values = line.split(delimiter).map((value) => value.trim().replace(/^"|"$/g, ''));
    const row: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });
    return row;
  });
};

const mapRowToTarget = (row: Record<string, unknown>, targetTable: string) => {
  if (targetTable === 'company_contacts') {
    return {
      name: pickValue(row, ['name', 'full_name', 'contact', 'contact_name']),
      email: pickValue(row, ['email', 'email_address', 'mail']),
      role: pickValue(row, ['role', 'job_title', 'title']),
      department: pickValue(row, ['department', 'dept']),
      notes: pickValue(row, ['notes', 'phone', 'comments']),
    };
  }

  if (targetTable === 'orders') {
    return {
      po_date: pickValue(row, ['po_date', 'date', 'order_date']),
      customer_name: pickValue(row, ['customer_name', 'customer', 'account']),
      product_family: pickValue(row, ['product_family', 'product', 'item']),
      region: pickValue(row, ['region']),
      country: pickValue(row, ['country']),
      segment: pickValue(row, ['segment']),
      selling_price: parseNumber(pickValue(row, ['selling_price', 'price', 'amount', 'value'])),
      margin: parseNumber(pickValue(row, ['margin', 'gross_margin'])),
      kam: pickValue(row, ['kam', 'account_manager']),
      purchasing_year: pickValue(row, ['purchasing_year', 'year']),
      purchasing_quarter: pickValue(row, ['purchasing_quarter', 'quarter']),
      scope: pickValue(row, ['scope']),
    };
  }

  if (targetTable === 'opportunities') {
    return {
      opp_number: pickValue(row, ['opp_number', 'opportunity_id', 'offer_number', 'id']),
      status: normalizeOpportunityStatus(pickValue(row, ['status', 'stage'])),
      customer_name: pickValue(row, ['customer_name', 'customer', 'account']),
      product_family: pickValue(row, ['product_family', 'product']),
      region: pickValue(row, ['region']),
      est_revenue: parseNumber(pickValue(row, ['est_revenue', 'revenue', 'value', 'amount', 'selling_price', 'price'])),
      contract_prob: parseNumber(pickValue(row, ['contract_prob', 'probability'])),
      margin: parseNumber(pickValue(row, ['margin'])),
      kam: pickValue(row, ['kam', 'account_manager']),
      est_purchasing_year: pickValue(row, ['est_purchasing_year', 'year']),
    };
  }

  if (targetTable === 'strategy') {
    return {
      product_family: pickValue(row, ['product_family', 'product']),
      number_of_segment: pickValue(row, ['number_of_segment', 'segment']),
      region: pickValue(row, ['region']),
      est_purchasing_quarter: pickValue(row, ['est_purchasing_quarter', 'quarter']),
      est_revenue: parseNumber(pickValue(row, ['est_revenue', 'revenue', 'amount'])),
      margin: parseNumber(pickValue(row, ['margin'])),
      kam: pickValue(row, ['kam', 'account_manager']),
    };
  }

  if (targetTable === 'products') {
    return {
      name: pickValue(row, ['name', 'product', 'product_name']),
      average_value: parseNumber(pickValue(row, ['average_value', 'price', 'value'])),
      type: pickValue(row, ['type', 'category']),
      comments: pickValue(row, ['comments', 'notes', 'description']),
    };
  }

  return row;
};

const hasUsefulValue = (record: Record<string, unknown>) =>
  Object.values(record).some((value) => String(value ?? '').trim() !== '' && String(value) !== '0');

export function buildFallbackExtraction(meta: FallbackMeta, content: string | ArrayBuffer) {
  const rawRows = parseStructuredRows(content);
  const extracted_records = rawRows
    .map((row) => mapRowToTarget(row, meta.targetTable))
    .filter((row) => hasUsefulValue(row as Record<string, unknown>));

  return {
    extracted_records,
    summary: extracted_records.length > 0
      ? `Basic extraction completed for ${meta.fileName} without the AI gateway.`
      : `The file ${meta.fileName} was saved, but only a basic fallback analysis was available.`,
    record_count: extracted_records.length,
    confidence_score: extracted_records.length > 0 ? 55 : 20,
    data_quality_notes: [
      'Fallback mode was used because the AI gateway key is unavailable or unauthorized.',
      'Please review the extracted data before relying on it for automation.',
    ],
    target_table: meta.targetTable,
    company_info_updates: {},
  };
}
