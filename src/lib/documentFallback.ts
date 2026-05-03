import * as XLSX from 'xlsx';
import { normalizeOpportunityStatus, parseFlexibleNumber } from '@/lib/salesData';

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

const parseNumber = (value: unknown) => parseFlexibleNumber(value);

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

const unique = <T,>(values: T[]) => [...new Set(values)];

const inferHeaderIndex = (rows: unknown[][]) => {
  const productTokens = ['name', 'product', 'producto', 'text', 'descripcion', 'description', 'cost', 'price', 'venta', 'pvp', 'sku', 'ref', 'codigo', 'qty', 'cantidad'];
  let bestIndex = 0;
  let bestScore = -1;

  for (let i = 0; i < Math.min(rows.length, 10); i += 1) {
    const row = rows[i] || [];
    const normalizedCells = row
      .map((cell) => normalizeKey(String(cell ?? '')))
      .filter((cell) => cell.length > 0);

    if (normalizedCells.length === 0) continue;

    const tokenScore = normalizedCells.reduce((acc, cell) => (
      acc + (productTokens.some((token) => cell.includes(token)) ? 1 : 0)
    ), 0);

    const diversityScore = new Set(normalizedCells).size;
    const score = tokenScore * 3 + diversityScore;

    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return bestIndex;
};

const parseStructuredRows = (content: string | ArrayBuffer) => {
  if (content instanceof ArrayBuffer) {
    try {
      const workbook = XLSX.read(content, { type: 'array' });
      const allRows: Record<string, unknown>[] = [];

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;

        const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
        if (!Array.isArray(rows) || rows.length === 0) continue;

        const headerIndex = inferHeaderIndex(rows);
        const headerRow = rows[headerIndex] || [];
        const headers = headerRow.map((cell, idx) => normalizeKey(String(cell || `column_${idx + 1}`)));

        for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex += 1) {
          const row = rows[rowIndex] || [];
          if (!Array.isArray(row)) continue;

          const normalized: Record<string, unknown> = {};
          headers.forEach((header, colIndex) => {
            if (!header) return;
            normalized[header] = row[colIndex] ?? '';
          });

          if (Object.values(normalized).every((value) => String(value ?? '').trim() === '')) continue;
          normalized.__sheet_name = sheetName;
          normalized.__row_number = rowIndex + 1;
          allRows.push(normalized);

          if (allRows.length >= 400) break;
        }

        if (allRows.length >= 400) break;
      }

      return allRows;
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

  if (targetTable === 'opportunities' || targetTable === 'offers') {
    const normalized = {
      opp_number: pickValue(row, ['opp_number', 'opportunity_id', 'offer_number', 'id']),
      offer_number: pickValue(row, ['offer_number', 'opp_number', 'opportunity_id', 'id']),
      status: normalizeOpportunityStatus(pickValue(row, ['status', 'stage'])),
      customer_name: pickValue(row, ['customer_name', 'customer', 'account']),
      title: pickValue(row, ['title', 'scope', 'description']),
      product_family: pickValue(row, ['product_family', 'product']),
      region: pickValue(row, ['region']),
      est_revenue: parseNumber(pickValue(row, ['est_revenue', 'revenue', 'value', 'amount', 'selling_price', 'price'])),
      total_value: parseNumber(pickValue(row, ['total_value', 'est_revenue', 'revenue', 'value', 'amount', 'selling_price', 'price'])),
      contract_prob: parseNumber(pickValue(row, ['contract_prob', 'probability'])),
      margin: parseNumber(pickValue(row, ['margin'])),
      currency: pickValue(row, ['currency']) || 'EUR',
      kam: pickValue(row, ['kam', 'account_manager']),
      est_purchasing_year: pickValue(row, ['est_purchasing_year', 'year']),
    };

    return targetTable === 'offers'
      ? {
          offer_number: normalized.offer_number,
          title: normalized.title,
          customer_name: normalized.customer_name,
          status: normalized.status,
          total_value: normalized.total_value,
          margin: normalized.margin,
          currency: normalized.currency,
        }
      : normalized;
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
    const unitCost = parseNumber(pickValue(row, ['unit_cost', 'cost', 'usd_purchase', 'compra', 'coste']));
    const sellingPrice = parseNumber(pickValue(row, ['selling_price', 'sale_price', 'pvp_cliente', 'venta', 'price', 'value']));
    const averageValue = parseNumber(pickValue(row, ['average_value', 'pvp_in', 'selling_price', 'sale_price', 'price', 'value'])) || sellingPrice;
    const marginValue = parseNumber(pickValue(row, ['average_margin', 'margin', 'margin_kam']));

    return {
      name: pickValue(row, ['name', 'product', 'product_name', 'text', 'descripcion', 'description', 'item']),
      sku: pickValue(row, ['sku', 'code', 'codigo', 'ref', 'reference']),
      category: pickValue(row, ['category', 'categoria', '__sheet_name']),
      subcategory: pickValue(row, ['subcategory', 'subcategoria', 'line']),
      brand: pickValue(row, ['brand', 'marca']),
      description: pickValue(row, ['description', 'descripcion', 'notes', 'comments']),
      currency: pickValue(row, ['currency', 'moneda']) || 'EUR',
      list_price: sellingPrice || averageValue,
      unit_cost: unitCost,
      selling_price: sellingPrice || averageValue,
      average_value: averageValue,
      average_margin: marginValue,
      stock_quantity: parseNumber(pickValue(row, ['stock_quantity', 'qty', 'cantidad', 'stock'])),
      stock_unit: pickValue(row, ['stock_unit', 'unit', 'unidad']),
      lead_time_days: parseNumber(pickValue(row, ['lead_time_days', 'lead_time', 'plazo'])),
      moq: parseNumber(pickValue(row, ['moq', 'minimum_order_quantity'])),
      packaging: pickValue(row, ['packaging', 'empaque']),
      tags: unique((pickValue(row, ['tags', 'tag']) || '').split(/[;,]/g).map((tag) => tag.trim()).filter(Boolean)),
      markets: unique((pickValue(row, ['markets', 'market']) || '').split(/[;,]/g).map((market) => market.trim()).filter(Boolean)),
      type: pickValue(row, ['type', 'lifecycle', 'lifecycle_stage', 'category']) || 'Core',
      lifecycle_stage: pickValue(row, ['lifecycle_stage', 'lifecycle', 'type']) || 'core',
      status: pickValue(row, ['status']) || 'active',
      comments: pickValue(row, ['comments', 'notes', 'description']),
      source_sheet: pickValue(row, ['__sheet_name']),
      source_row: parseNumber(pickValue(row, ['__row_number'])),
      confidence: 0.75,
      attributes: {
        kam: pickValue(row, ['kam', 'account_manager']),
        raw_margin: pickValue(row, ['margin', 'margin_kam']),
      },
    };
  }

  if (targetTable === 'customers') {
    return {
      customer_name: pickValue(row, ['customer_name', 'customer', 'account', 'company_name', 'name']),
      account_tier: pickValue(row, ['account_tier', 'tier']),
      strategic_importance: parseNumber(pickValue(row, ['strategic_importance', 'importance'])),
      growth_potential: parseNumber(pickValue(row, ['growth_potential', 'growth'])),
      relationship_strength: parseNumber(pickValue(row, ['relationship_strength', 'relationship'])),
      operating_region: pickValue(row, ['operating_region', 'region']),
      sector: pickValue(row, ['sector', 'segment']),
      notes: pickValue(row, ['notes', 'comments']),
    };
  }

  if (targetTable === 'competitors') {
    return {
      competitor_name: pickValue(row, ['competitor_name', 'name']),
      product_family: pickValue(row, ['product_family', 'product']),
      positioning: pickValue(row, ['positioning']),
      price_positioning: pickValue(row, ['price_positioning', 'price']),
      value_proposition: pickValue(row, ['value_proposition', 'value']),
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
      'The output has been stored as raw extracted data only; canonical automation requires validation and enrichment first.',
    ],
    target_table: meta.targetTable,
    company_info_updates: {},
  };
}
