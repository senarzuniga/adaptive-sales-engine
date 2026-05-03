import * as XLSX from 'xlsx';
import { parseFlexibleNumber } from '@/lib/salesData';
import type { ProductRecord } from '@/store/DataStore';

export interface WorkbookSheetDiagnostics {
  sheetName: string;
  rowCount: number;
  columnCount: number;
  headers: string[];
  previewRows: string[][];
  inferredProductName: string;
  skipped: boolean;
  reason?: string;
}

export interface ParsedProductWorkbookResult {
  products: ProductRecord[];
  diagnostics: WorkbookSheetDiagnostics[];
  errors: Array<{ sheetName: string; message: string }>;
}

const normalizeKey = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const productTokens = ['name', 'product', 'producto', 'text', 'descripcion', 'description', 'cost', 'price', 'venta', 'pvp', 'sku', 'ref', 'codigo', 'qty', 'cantidad'];

const inferHeaderIndex = (rows: unknown[][]) => {
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

const pickValue = (row: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
};

const safeString = (value: unknown) => String(value ?? '').trim();

const inferProductName = (rows: unknown[][], sheetName: string) => {
  const firstCell = safeString(rows?.[0]?.[0]);
  const secondCell = safeString(rows?.[0]?.[1]);
  const keyInFirst = normalizeKey(firstCell);
  if (keyInFirst.includes('name') || keyInFirst.includes('product') || keyInFirst.includes('service')) {
    if (secondCell) return secondCell;
  }
  if (firstCell && firstCell.length >= 3 && firstCell.length <= 120) return firstCell;
  return sheetName;
};

const isNonProductSheet = (sheetName: string, rows: unknown[][]) => {
  const lower = sheetName.toLowerCase().trim();
  const blocked = [
    'index',
    'table of contents',
    'summary',
    'overview',
    'instructions',
    'notes',
    'readme',
    'cover',
    'template',
    'guide',
  ];
  if (blocked.some((key) => lower === key || lower.includes(key))) return true;
  const firstCell = safeString(rows?.[0]?.[0]).toLowerCase();
  return firstCell.includes('table of contents') || firstCell === 'index';
};

const cleanPrice = (value: unknown) => {
  const parsed = parseFlexibleNumber(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

function extractKeyValueProduct(
  rows: unknown[][],
  sheetName: string,
  sourceDocumentName: string,
): ProductRecord | null {
  const values: Record<string, string> = {};
  const costBreakdown: Array<{ item: string; value: string }> = [];
  const subproducts: Array<{ name: string; details: string }> = [];
  const features: Record<string, string> = {};
  const technicalSpecs: Record<string, string> = {};

  type Section = 'general' | 'cost_breakdown' | 'subproducts' | 'features' | 'technical_specs';
  let section: Section = 'general';

  const sectionSwitch: Array<{ token: string; section: Section }> = [
    { token: 'cost', section: 'cost_breakdown' },
    { token: 'pricing', section: 'cost_breakdown' },
    { token: 'price breakdown', section: 'cost_breakdown' },
    { token: 'subproduct', section: 'subproducts' },
    { token: 'sub product', section: 'subproducts' },
    { token: 'component', section: 'subproducts' },
    { token: 'part', section: 'subproducts' },
    { token: 'feature', section: 'features' },
    { token: 'spec', section: 'technical_specs' },
    { token: 'technical', section: 'technical_specs' },
  ];

  for (const row of rows) {
    const key = safeString(row?.[0]);
    const value = safeString(row?.[1]);
    const normKey = normalizeKey(key);
    if (!key && !value) continue;

    const switched = sectionSwitch.find((entry) => normKey.includes(normalizeKey(entry.token)));
    if (switched && !value) {
      section = switched.section;
      continue;
    }

    if (section === 'general') {
      if (normKey.includes('name') || normKey.includes('product') || normKey.includes('service')) values.name = value;
      else if (normKey.includes('description') || normKey.includes('overview')) values.description = value;
      else if (normKey.includes('category') || normKey.includes('type')) values.category = value;
      else if (normKey.includes('currency')) values.currency = value;
      else if (normKey.includes('price') || normKey.includes('selling')) values.sellingPrice = value;
      else if (normKey.includes('averagevalue') || normKey.includes('average') || normKey.includes('value')) values.averageValue = value;
      else if (normKey.includes('cost') || normKey.includes('unitcost')) values.unitCost = value;
      else if (normKey.includes('comment') || normKey.includes('note')) values.comments = value;
      else if (key && value) features[key] = value;
    } else if (section === 'cost_breakdown') {
      if (key && value) costBreakdown.push({ item: key, value });
    } else if (section === 'subproducts') {
      if (key || value) subproducts.push({ name: key || value, details: key && value ? value : '' });
    } else if (section === 'features') {
      if (key && value) features[key] = value;
    } else {
      if (key && value) technicalSpecs[key] = value;
    }
  }

  const name = values.name || inferProductName(rows, sheetName);
  const sellingPrice = cleanPrice(values.sellingPrice);
  const averageValue = cleanPrice(values.averageValue) || sellingPrice;
  const unitCost = cleanPrice(values.unitCost);

  if (!name && !sellingPrice && !averageValue && !unitCost) return null;

  return {
    name,
    sku: '',
    category: values.category || sheetName,
    subcategory: '',
    brand: '',
    description: values.description || '',
    currency: values.currency || 'EUR',
    listPrice: sellingPrice || averageValue,
    unitCost,
    sellingPrice: sellingPrice || averageValue,
    averageValue: averageValue || sellingPrice,
    averageMargin: 0,
    stockQuantity: 0,
    stockUnit: '',
    leadTimeDays: 0,
    moq: 0,
    packaging: '',
    attributes: {
      costBreakdown,
      subproducts,
      features,
      technicalSpecs,
      extractionLayout: 'sheet_key_value',
    },
    tags: [],
    markets: [],
    type: values.category || 'Core',
    lifecycleStage: 'core',
    status: 'active',
    isActive: true,
    comments: values.comments || '',
    sourceDocument: sourceDocumentName,
    sourceSheet: sheetName,
    sourceRow: 1,
    confidence: 0.9,
    lastSeenAt: new Date().toISOString(),
  };
}

function extractTableProducts(
  rows: unknown[][],
  sheetName: string,
  sourceDocumentName: string,
): ProductRecord[] {
  const headerIndex = inferHeaderIndex(rows);
  const headerRow = rows[headerIndex] || [];
  const headers = headerRow.map((cell, idx) => normalizeKey(String(cell || `column_${idx + 1}`)));
  const extracted: ProductRecord[] = [];

  for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] || [];
    if (!Array.isArray(row)) continue;

    const normalized: Record<string, unknown> = {};
    headers.forEach((header, colIndex) => {
      if (!header) return;
      normalized[header] = row[colIndex] ?? '';
    });

    if (Object.values(normalized).every((value) => safeString(value) === '')) continue;
    normalized.__sheet_name = sheetName;
    normalized.__row_number = rowIndex + 1;
    normalized.__source_document = sourceDocumentName;

    const mapped = mapRowToProduct(normalized);
    if (mapped.name.trim() !== '' || (mapped.sellingPrice ?? 0) > 0 || (mapped.unitCost ?? 0) > 0) {
      extracted.push(mapped);
    }
  }

  return extracted;
}

const mapRowToProduct = (row: Record<string, unknown>): ProductRecord => {
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
    currency: pickValue(row, ['currency', 'moneda']) || 'EUR',
    listPrice: sellingPrice || averageValue,
    unitCost,
    sellingPrice: sellingPrice || averageValue,
    averageValue,
    averageMargin: parseFlexibleNumber(pickValue(row, ['average_margin', 'margin', 'margin_kam'])),
    stockQuantity: parseFlexibleNumber(pickValue(row, ['stock_quantity', 'qty', 'cantidad', 'stock'])),
    stockUnit: pickValue(row, ['stock_unit', 'unit', 'unidad']),
    leadTimeDays: parseFlexibleNumber(pickValue(row, ['lead_time_days', 'lead_time', 'plazo'])),
    moq: parseFlexibleNumber(pickValue(row, ['moq', 'minimum_order_quantity'])),
    packaging: pickValue(row, ['packaging', 'empaque']),
    tags: [],
    markets: [],
    type: pickValue(row, ['type', 'lifecycle', 'lifecycle_stage', 'category']) || 'Core',
    lifecycleStage: pickValue(row, ['lifecycle_stage', 'lifecycle', 'type']) || 'core',
    status: pickValue(row, ['status']) || 'active',
    isActive: true,
    comments: pickValue(row, ['comments', 'notes', 'description']),
    sourceDocument: pickValue(row, ['__source_document']),
    sourceSheet: pickValue(row, ['__sheet_name']),
    sourceRow: parseFlexibleNumber(pickValue(row, ['__row_number'])),
    confidence: 0.75,
    lastSeenAt: new Date().toISOString(),
  };
};

export const parseProductsFromWorkbook = async (file: Blob, sourceDocumentName: string): Promise<ProductRecord[]> => {
  const { products } = await parseProductsFromWorkbookWithDiagnostics(file, sourceDocumentName);
  return products;
};

export const parseProductsFromWorkbookWithDiagnostics = async (
  file: Blob,
  sourceDocumentName: string,
): Promise<ParsedProductWorkbookResult> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const products: ProductRecord[] = [];
  const diagnostics: WorkbookSheetDiagnostics[] = [];
  const errors: Array<{ sheetName: string; message: string }> = [];

  for (const sheetName of workbook.SheetNames) {
    try {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;

      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
      if (!Array.isArray(rows) || rows.length === 0) {
        diagnostics.push({
          sheetName,
          rowCount: 0,
          columnCount: 0,
          headers: [],
          previewRows: [],
          inferredProductName: sheetName,
          skipped: true,
          reason: 'Empty sheet',
        });
        continue;
      }

      const nonEmptyRows = rows.filter((row) => Array.isArray(row) && row.some((cell) => safeString(cell) !== ''));
      const columnCount = nonEmptyRows.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0);
      const inferredProductName = inferProductName(nonEmptyRows, sheetName);
      const headerIndex = inferHeaderIndex(nonEmptyRows);
      const headers = (nonEmptyRows[headerIndex] || []).map((cell) => safeString(cell)).filter(Boolean);

      if (isNonProductSheet(sheetName, nonEmptyRows)) {
        diagnostics.push({
          sheetName,
          rowCount: nonEmptyRows.length,
          columnCount,
          headers,
          previewRows: nonEmptyRows.slice(0, 5).map((row) => (row as unknown[]).map((cell) => safeString(cell))),
          inferredProductName,
          skipped: true,
          reason: 'Detected as non-product sheet',
        });
        continue;
      }

      const keyValueProduct = extractKeyValueProduct(nonEmptyRows, sheetName, sourceDocumentName);
      const tableProducts = extractTableProducts(nonEmptyRows, sheetName, sourceDocumentName);

      if (keyValueProduct) {
        const merged = tableProducts[0]
          ? {
              ...tableProducts[0],
              ...keyValueProduct,
              attributes: {
                ...(tableProducts[0].attributes || {}),
                ...(keyValueProduct.attributes || {}),
              },
            }
          : keyValueProduct;
        products.push(merged);
      } else if (tableProducts.length > 0) {
        products.push(...tableProducts);
      }

      diagnostics.push({
        sheetName,
        rowCount: nonEmptyRows.length,
        columnCount,
        headers,
        previewRows: nonEmptyRows.slice(0, 5).map((row) => (row as unknown[]).map((cell) => safeString(cell))),
        inferredProductName,
        skipped: !keyValueProduct && tableProducts.length === 0,
        reason: !keyValueProduct && tableProducts.length === 0 ? 'No product-like data extracted' : undefined,
      });
    } catch (error) {
      errors.push({ sheetName, message: error instanceof Error ? error.message : String(error) });
    }
  }

  const dedupe = new Map<string, ProductRecord>();
  for (const product of products) {
    const key = `${product.sourceSheet || ''}::${(product.sku || product.name || '').trim().toLowerCase()}`;
    if (!key.endsWith('::')) dedupe.set(key, product);
  }

  return {
    products: Array.from(dedupe.values()),
    diagnostics,
    errors,
  };
};

export const inspectWorkbookSheets = async (file: Blob) => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  return workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
    const nonEmptyRows = rows.filter((row) => Array.isArray(row) && row.some((cell) => safeString(cell) !== ''));
    const columnCount = nonEmptyRows.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0);
    const headerIndex = inferHeaderIndex(nonEmptyRows);
    const headers = (nonEmptyRows[headerIndex] || []).map((cell) => safeString(cell)).filter(Boolean);
    return {
      sheetName,
      rowCount: nonEmptyRows.length,
      columnCount,
      headers,
      previewRows: nonEmptyRows.slice(0, 5).map((row) => (row as unknown[]).map((cell) => safeString(cell))),
      inferredProductName: inferProductName(nonEmptyRows, sheetName),
    };
  });
};
