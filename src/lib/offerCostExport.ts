import * as XLSX from 'xlsx';
import {
  buildDefaultCommercialTerms,
  estimatePolicyChargesFromCost,
  itemLabel,
  summarizePackageCostWithPolicy,
  type OfferCommercialTerms,
  type OfferCostCategoryTotals,
  type OfferLikeCostRow,
  type OfferLikeItem,
  type OfferPackageDraft,
} from '@/lib/offerPackages';
import { DEFAULT_INGECART_POLICY, type OfferCostPolicy } from '@/lib/utils';

type Row = Record<string, any>;
type ItemRow = Row & { id: string };
type CostRow = Row & { offer_item_id?: string };

type ExportLanguage = 'en' | 'es';

type ExportBlock = {
  code: string;
  label: string;
  included: number;
  directCost: number;
  price: number;
  note: string;
  categoryTotals: OfferCostCategoryTotals;
  itemIds: string[];
  itemNames: string[];
  detailRows: Array<{ family: string; line: string; effort: number; unitCost: number; totalCost: number; row: CostRow }>;
};

export interface OfferCostExportInput {
  offer: Row;
  items: Row[];
  costRows: Row[];
  pricingPolicy?: OfferCostPolicy | null;
  packages?: OfferPackageDraft[];
  commercialTerms?: OfferCommercialTerms | null;
  language?: ExportLanguage;
}

const text = (value: unknown) => String(value || '').trim();
const num = (value: unknown) => Number(value || 0);
const pct = (value: unknown) => Number(value || 0) / 100;

const sheetNameSafe = (value: string) => value.replace(/[\\/?*\[\]:]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31) || 'Sheet';
const fileSafe = (value: string) => value.replace(/[<>:"/\\|?*]+/g, '_').replace(/\s+/g, '_').trim() || 'offer';

const categoryLabel = (value: string, language: ExportLanguage) => {
  const isEs = language === 'es';
  const map: Record<string, string> = {
    materials: isEs ? 'materiales' : 'materials',
    engineering: isEs ? 'ingenieria' : 'engineering',
    subcontracting: isEs ? 'subcontratacion' : 'subcontracting',
    installation: isEs ? 'instalacion' : 'installation',
    transport: isEs ? 'transporte' : 'transport',
    indirect: isEs ? 'indirectos' : 'indirect',
  };
  return map[String(value || '').toLowerCase()] || String(value || '');
};

const columnName = (index: number) => XLSX.utils.encode_col(index);
const cellRef = (colIndex: number, rowNumber: number) => `${columnName(colIndex)}${rowNumber}`;

const setCell = (sheet: XLSX.WorkSheet, colIndex: number, rowNumber: number, value: unknown, format?: string) => {
  const ref = cellRef(colIndex, rowNumber);
  const cell: XLSX.CellObject = typeof value === 'number'
    ? { t: 'n', v: value }
    : typeof value === 'boolean'
      ? { t: 'b', v: value }
      : { t: 's', v: String(value ?? '') };
  if (format) cell.z = format;
  sheet[ref] = cell;
};

const setFormula = (sheet: XLSX.WorkSheet, colIndex: number, rowNumber: number, formula: string, format?: string) => {
  const cell: XLSX.CellObject = { t: 'n', f: formula };
  if (format) cell.z = format;
  sheet[cellRef(colIndex, rowNumber)] = cell;
};

const finalizeSheet = (sheet: XLSX.WorkSheet, rows: number, cols: number) => {
  sheet['!ref'] = XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: Math.max(cols - 1, 0), r: Math.max(rows - 1, 0) } });
};

const buildItemMap = (items: ItemRow[]) => new Map(items.map((item) => [String(item.id), item]));

const buildBlockDetailRows = (itemIds: string[], itemMap: Map<string, ItemRow>, costRows: CostRow[], language: ExportLanguage) =>
  itemIds.flatMap((itemId) => {
    const item = itemMap.get(String(itemId));
    const quantity = Math.max(1, num(item?.quantity || 1));
    return costRows
      .filter((row) => String(row.offer_item_id || '') === String(itemId))
      .map((row) => {
        const effortBase = num(row.hours) || num(row.days) || num(row.quantity) || quantity;
        const effort = effortBase * (num(row.hours) || num(row.days) || num(row.quantity) ? quantity : 1);
        const unitCost = num(row.unit_cost) || num(row.hourly_rate);
        return {
          family: categoryLabel(String(row.category || ''), language),
          line: text(row.line_item) || itemLabel(item || {}),
          effort,
          unitCost,
          totalCost: num(row.total_cost) * quantity,
          row,
        };
      });
  });

const summarizeItemIds = (itemIds: string[], items: ItemRow[], costRows: CostRow[], policy: OfferCostPolicy) =>
  summarizePackageCostWithPolicy({
    id: 'export-block',
    name: 'Export block',
    type: 'core',
    itemIds,
    executiveSummary: '',
    commercialPrice: 0,
    sortOrder: 1,
  }, items, costRows, policy);

const buildExportBlocks = (input: OfferCostExportInput, language: ExportLanguage) => {
  const items = input.items as ItemRow[];
  const costRows = input.costRows as CostRow[];
  const policy = input.pricingPolicy || DEFAULT_INGECART_POLICY;
  const itemMap = buildItemMap(items);
  const packages = (input.packages || []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
  const assignedItemIds = new Set(packages.flatMap((pkg) => pkg.itemIds.map((itemId) => String(itemId))));
  const principalItemIds = items.map((item) => String(item.id)).filter((itemId) => !assignedItemIds.has(itemId));
  const principalSummary = summarizeItemIds(principalItemIds, items, costRows, policy);
  const additionalPrice = packages.reduce((sum, pkg) => sum + num(pkg.commercialPrice), 0);
  const offerPrice = num(input.offer.offer_total_price || input.offer.contract_value);
  const storedPrincipalPrice = input.offer.principal_package_price_override ?? input.offer.principal_package_price;
  const principalPrice = storedPrincipalPrice !== null && storedPrincipalPrice !== undefined && String(storedPrincipalPrice) !== ''
    ? num(storedPrincipalPrice)
    : Math.max(0, offerPrice - additionalPrice);
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const blocks: ExportBlock[] = [];

  if (principalItemIds.length > 0 || principalPrice > 0 || packages.length === 0) {
    blocks.push({
      code: letters[0],
      label: language === 'es' ? 'Bloque principal' : 'Principal package',
      included: 1,
      directCost: principalSummary.directCost,
      price: principalPrice,
      note: language === 'es' ? 'Base configurada' : 'Configured base',
      categoryTotals: principalSummary.categoryTotals,
      itemIds: principalItemIds,
      itemNames: principalItemIds.map((itemId) => itemLabel(itemMap.get(itemId) || {})).filter(Boolean),
      detailRows: buildBlockDetailRows(principalItemIds, itemMap, costRows, language),
    });
  }

  packages.forEach((pkg, index) => {
    const summary = summarizePackageCostWithPolicy(pkg, items, costRows, policy);
    const included = pkg.type === 'optional' ? 0 : 1;
    blocks.push({
      code: letters[blocks.length] || `P${index + 1}`,
      label: text(pkg.name) || (language === 'es' ? `Paquete ${index + 1}` : `Package ${index + 1}`),
      included,
      directCost: summary.directCost,
      price: num(pkg.commercialPrice),
      note: pkg.type === 'optional'
        ? (language === 'es' ? 'Opcional (activar con 1)' : 'Optional (set to 1 to include)')
        : (language === 'es' ? 'Incluido' : 'Included'),
      categoryTotals: summary.categoryTotals,
      itemIds: pkg.itemIds.map(String),
      itemNames: pkg.itemIds.map((itemId) => itemLabel(itemMap.get(String(itemId)) || {})).filter(Boolean),
      detailRows: buildBlockDetailRows(pkg.itemIds.map(String), itemMap, costRows, language),
    });
  });

  return blocks;
};

const buildSummarySheet = (blocks: ExportBlock[], input: OfferCostExportInput, language: ExportLanguage) => {
  const isEs = language === 'es';
  const sheet: XLSX.WorkSheet = {};
  const offerName = text(input.offer.offer_number) || text(input.offer.title) || 'Offer';
  const exportDate = new Date().toISOString().slice(0, 16).replace('T', ' ');
  setCell(sheet, 0, 1, isEs ? 'Oferta' : 'Offer');
  setCell(sheet, 1, 1, offerName);
  setCell(sheet, 0, 2, isEs ? 'Cliente' : 'Customer');
  setCell(sheet, 1, 2, text(input.offer.customer_name));
  setCell(sheet, 0, 3, isEs ? 'Moneda' : 'Currency');
  setCell(sheet, 1, 3, text(input.offer.currency) || 'EUR');
  setCell(sheet, 0, 4, isEs ? 'Fecha exportacion' : 'Export date');
  setCell(sheet, 1, 4, exportDate);

  const headerRow = 6;
  ['Bloque', isEs ? 'Incluido (1/0)' : 'Included (1/0)', isEs ? 'Coste directo (EUR)' : 'Direct cost (EUR)', isEs ? 'Precio oferta (EUR)' : 'Offer price (EUR)', 'Notas', 'Materials', 'Engineering', 'Subcontracting'].forEach((value, index) => setCell(sheet, index, headerRow, value));

  const dataStart = headerRow + 1;
  blocks.forEach((block, index) => {
    const row = dataStart + index;
    setCell(sheet, 0, row, `${block.code}. ${block.label}`);
    setCell(sheet, 1, row, block.included);
    setCell(sheet, 2, row, block.directCost, '#,##0.00');
    setCell(sheet, 3, row, block.price, '#,##0.00');
    setCell(sheet, 4, row, block.note);
    setCell(sheet, 5, row, num(block.categoryTotals.materials), '#,##0.00');
    setCell(sheet, 6, row, num(block.categoryTotals.engineering), '#,##0.00');
    setCell(sheet, 7, row, num(block.categoryTotals.subcontracting), '#,##0.00');
  });

  const totalRow = dataStart + blocks.length;
  setCell(sheet, 0, totalRow, isEs ? 'TOTAL GENERAL (segun incluidos)' : 'TOTAL GENERAL (by included rows)');
  setFormula(sheet, 2, totalRow, `SUMPRODUCT((B${dataStart}:B${totalRow - 1}=1)*(C${dataStart}:C${totalRow - 1}))`, '#,##0.00');
  setFormula(sheet, 3, totalRow, `SUMPRODUCT((B${dataStart}:B${totalRow - 1}=1)*(D${dataStart}:D${totalRow - 1}))`, '#,##0.00');

  sheet['!cols'] = [
    { wch: 34 },
    { wch: 14 },
    { wch: 18 },
    { wch: 18 },
    { wch: 28 },
    { wch: 14, hidden: true },
    { wch: 14, hidden: true },
    { wch: 16, hidden: true },
  ];
  finalizeSheet(sheet, totalRow, 8);
  return { sheet, totalRow, dataStart };
};

const buildDetailSheet = (block: ExportBlock, language: ExportLanguage) => {
  const isEs = language === 'es';
  const sheet: XLSX.WorkSheet = {};
  const headerRow = 1;
  [isEs ? 'Familia' : 'Family', isEs ? 'Linea' : 'Line', isEs ? 'Cantidad/Esfuerzo' : 'Quantity/Effort', isEs ? 'Coste unitario (EUR)' : 'Unit cost (EUR)', isEs ? 'Coste total (EUR)' : 'Total cost (EUR)'].forEach((value, index) => setCell(sheet, index, headerRow, value));
  const dataStart = 2;
  block.detailRows.forEach((row, index) => {
    const targetRow = dataStart + index;
    setCell(sheet, 0, targetRow, row.family);
    setCell(sheet, 1, targetRow, row.line);
    setCell(sheet, 2, targetRow, row.effort, '#,##0.00');
    setCell(sheet, 3, targetRow, row.unitCost, '#,##0.00');
    setCell(sheet, 4, targetRow, row.totalCost, '#,##0.00');
  });
  const totalRow = dataStart + block.detailRows.length;
  setCell(sheet, 0, totalRow, isEs ? 'TOTAL' : 'TOTAL');
  setFormula(sheet, 4, totalRow, `SUM(E${dataStart}:E${Math.max(totalRow - 1, dataStart)})`, '#,##0.00');
  sheet['!cols'] = [{ wch: 18 }, { wch: 62 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
  finalizeSheet(sheet, totalRow, 5);
  return sheet;
};

const buildServicesSheet = (blocks: ExportBlock[], language: ExportLanguage, summaryDataStart: number) => {
  const isEs = language === 'es';
  const serviceRows = blocks.flatMap((block, index) => block.detailRows
    .filter((row) => ['installation', 'transport'].includes(String(row.row.category || '')))
    .map((row) => ({ block, row, summaryRow: summaryDataStart + index })));
  const sheet: XLSX.WorkSheet = {};
  [isEs ? 'Bloque' : 'Block', isEs ? 'Incluido (1/0)' : 'Included (1/0)', isEs ? 'Familia servicio' : 'Service family', isEs ? 'Descripcion' : 'Description', 'Base', isEs ? 'Total (EUR)' : 'Total (EUR)'].forEach((value, index) => setCell(sheet, index, 1, value));
  serviceRows.forEach((entry, index) => {
    const row = index + 2;
    setCell(sheet, 0, row, `${entry.block.code}. ${entry.block.label}`);
    setFormula(sheet, 1, row, `Resumen!B${entry.summaryRow}`, '0');
    setCell(sheet, 2, row, entry.row.family);
    setCell(sheet, 3, row, entry.row.line);
    const baseText = num(entry.row.row.days) > 0
      ? `${num(entry.row.row.days)} d / ${Math.max(1, num(entry.row.row.resources) || 1)} ${isEs ? 'tec' : 'tech'}`
      : `${num(entry.row.row.quantity) || 1}`;
    setCell(sheet, 4, row, baseText);
    setCell(sheet, 5, row, entry.row.totalCost, '#,##0.00');
  });
  const totalRow = serviceRows.length + 2;
  setCell(sheet, 0, totalRow, isEs ? 'TOTAL SERVICIOS' : 'TOTAL SERVICES');
  setFormula(sheet, 5, totalRow, serviceRows.length > 0 ? `SUMPRODUCT((B2:B${totalRow - 1}=1)*(F2:F${totalRow - 1}))` : '0', '#,##0.00');
  sheet['!cols'] = [{ wch: 30 }, { wch: 14 }, { wch: 18 }, { wch: 46 }, { wch: 16 }, { wch: 18 }];
  finalizeSheet(sheet, totalRow, 6);
  return sheet;
};

const buildPoliciesSheet = (input: OfferCostExportInput, summaryTotalRow: number, summaryDataStart: number, blocks: ExportBlock[], language: ExportLanguage) => {
  const isEs = language === 'es';
  const policy = input.pricingPolicy || DEFAULT_INGECART_POLICY;
  const endRow = summaryDataStart + blocks.length - 1;
  const sheet: XLSX.WorkSheet = {};
  [isEs ? 'Politica' : 'Policy', isEs ? 'Aplicado sobre' : 'Applied on', '%', isEs ? 'Base editable (EUR)' : 'Editable base (EUR)', isEs ? 'Importe (EUR)' : 'Amount (EUR)', isEs ? 'Importe configurado original (EUR)' : 'Configured original amount (EUR)'].forEach((value, index) => setCell(sheet, index, 1, value));

  const warrantyBaseFormula = `SUMPRODUCT((Resumen!B${summaryDataStart}:B${endRow}=1)*((Resumen!F${summaryDataStart}:F${endRow})+(Resumen!G${summaryDataStart}:G${endRow})+(Resumen!H${summaryDataStart}:H${endRow})))`;
  const materialsBaseFormula = `SUMPRODUCT((Resumen!B${summaryDataStart}:B${endRow}=1)*(Resumen!F${summaryDataStart}:F${endRow}))`;
  const directBaseFormula = `Resumen!C${summaryTotalRow}`;
  const configuredWarrantyBase = blocks.reduce((sum, block) => sum + num(block.categoryTotals.materials) + num(block.categoryTotals.engineering) + num(block.categoryTotals.subcontracting), 0);
  const configuredMaterialsBase = blocks.reduce((sum, block) => sum + num(block.categoryTotals.materials), 0);
  const directCostOriginal = blocks.reduce((sum, block) => sum + block.directCost, 0);
  const policyOriginal = estimatePolicyChargesFromCost({ materials: configuredMaterialsBase, engineering: blocks.reduce((sum, block) => sum + num(block.categoryTotals.engineering), 0), subcontracting: blocks.reduce((sum, block) => sum + num(block.categoryTotals.subcontracting), 0) }, directCostOriginal, policy);

  const rows = [
    [isEs ? 'Garantia' : 'Warranty', isEs ? 'Comercio + Engineering + Subcontratas' : 'Materials + Engineering + Subcontracting', pct(policy.warrantyPct), warrantyBaseFormula, 'C2*D2', policyOriginal.warranty],
    [isEs ? 'Estructura material' : 'Material structure', isEs ? 'Comercio' : 'Materials', pct(policy.materialStructurePct), materialsBaseFormula, 'C3*D3', policyOriginal.materialStructure],
    ['Finance', isEs ? 'Coste directo' : 'Direct cost', pct(policy.financialPct), directBaseFormula, 'C4*D4', policyOriginal.financial],
    [isEs ? 'Gestion comercial' : 'Commercial management', isEs ? 'Coste directo' : 'Direct cost', pct(policy.commercialMgmtPct), directBaseFormula, 'C5*D5', policyOriginal.commercialMgmt],
  ];

  rows.forEach((values, index) => {
    const row = index + 2;
    setCell(sheet, 0, row, values[0]);
    setCell(sheet, 1, row, values[1]);
    setCell(sheet, 2, row, values[2], '0.00%');
    setFormula(sheet, 3, row, String(values[3]), '#,##0.00');
    setFormula(sheet, 4, row, String(values[4]), '#,##0.00');
    setCell(sheet, 5, row, values[5], '#,##0.00');
  });
  const totalRow = 6;
  setCell(sheet, 0, totalRow, isEs ? 'TOTAL CARGAS POLITICA' : 'TOTAL POLICY CHARGES');
  setFormula(sheet, 4, totalRow, 'SUM(E2:E5)', '#,##0.00');
  setFormula(sheet, 5, totalRow, 'SUM(F2:F5)', '#,##0.00');
  sheet['!cols'] = [{ wch: 24 }, { wch: 38 }, { wch: 10 }, { wch: 18 }, { wch: 18 }, { wch: 24 }];
  finalizeSheet(sheet, totalRow, 6);
  return sheet;
};

const buildPriceSheet = (summaryTotalRow: number, language: ExportLanguage) => {
  const isEs = language === 'es';
  const sheet: XLSX.WorkSheet = {};
  [isEs ? 'Concepto' : 'Concept', isEs ? 'Valor (EUR)' : 'Value (EUR)'].forEach((value, index) => setCell(sheet, index, 1, value));
  const rows = [
    [isEs ? 'Coste directo seleccionado' : 'Selected direct cost', `Resumen!C${summaryTotalRow}`],
    [isEs ? 'Precio oferta seleccionado' : 'Selected offer price', `Resumen!D${summaryTotalRow}`],
    [isEs ? 'Cargas politica (calculadas)' : 'Policy charges (calculated)', 'Politicas!E6'],
    [isEs ? 'Margen bruto estimado' : 'Estimated gross margin', 'B3-B2'],
    [isEs ? 'Margen % sobre precio' : 'Margin % over price', 'IF(B3=0,0,B5/B3)'],
  ];
  rows.forEach((values, index) => {
    const row = index + 2;
    setCell(sheet, 0, row, values[0]);
    setFormula(sheet, 1, row, values[1], index === 4 ? '0.00%' : '#,##0.00');
  });
  sheet['!cols'] = [{ wch: 32 }, { wch: 18 }];
  finalizeSheet(sheet, 6, 2);
  return sheet;
};

export function buildOfferCostWorkbook(input: OfferCostExportInput): XLSX.WorkBook {
  const language = input.language || 'es';
  const workbook = XLSX.utils.book_new();
  const blocks = buildExportBlocks(input, language);
  const { sheet: summarySheet, totalRow, dataStart } = buildSummarySheet(blocks, input, language);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen');
  blocks.forEach((block) => {
    const suffix = fileSafe(block.label).slice(0, 18);
    XLSX.utils.book_append_sheet(workbook, buildDetailSheet(block, language), sheetNameSafe(`Costes_${block.code}_${suffix || 'Bloque'}`));
  });
  XLSX.utils.book_append_sheet(workbook, buildServicesSheet(blocks, language, dataStart), 'Servicios');
  XLSX.utils.book_append_sheet(workbook, buildPoliciesSheet(input, totalRow, dataStart, blocks, language), 'Politicas');
  XLSX.utils.book_append_sheet(workbook, buildPriceSheet(totalRow, language), language === 'es' ? 'Calculo_Precio' : 'Price_Calculation');
  return workbook;
}

export function buildOfferCostFileName(offer: Row, language: ExportLanguage = 'es') {
  const prefix = fileSafe(text(offer.offer_number) || 'offer');
  const customer = fileSafe(text(offer.customer_name) || 'customer');
  const title = fileSafe(text(offer.title) || 'costs');
  const suffix = language === 'es' ? 'COSTES_ES' : 'COSTS_EN';
  return `${prefix}_${customer}_${title}_${suffix}.xlsx`;
}

export type OfferCostDownloadResult = { fileName: string };

export async function downloadOfferCostWorkbook(input: OfferCostExportInput): Promise<OfferCostDownloadResult> {
  const workbook = buildOfferCostWorkbook({
    ...input,
    pricingPolicy: input.pricingPolicy || DEFAULT_INGECART_POLICY,
    commercialTerms: input.commercialTerms || buildDefaultCommercialTerms(),
  });
  const fileName = buildOfferCostFileName(input.offer, input.language || 'es');
  const content = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([content], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const link = window.document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
  return { fileName };
}
