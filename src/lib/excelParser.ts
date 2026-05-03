import * as XLSX from 'xlsx';
import type {
  ContactRecord,
  LeadRecord,
  OpportunityRecord,
  OrderRecord,
  ProductRecord,
  StrategyRecord,
} from '@/store/DataStore';
import { normalizeOpportunityStatus, parseFlexibleNumber } from '@/lib/salesData';
import { parseProductsFromWorkbookWithDiagnostics } from '@/lib/productDocumentParser';

function normalizeHeader(h: string): string {
  return (h || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function safeNumber(val: any): number {
  return parseFlexibleNumber(val);
}

function safeString(val: any): string {
  return val != null ? String(val).trim() : '';
}

type DetectedType = 'orders' | 'opportunities' | 'products' | 'strategy' | 'leads' | 'contacts' | 'unknown';

const ORDER_MARKERS = ['podate', 'sellingprice', 'purchasingyear', 'purchasingquarter'];
const OPP_MARKERS = ['status', 'contractprob', 'estrevenue', 'estimatedpurchasingyear'];
const PRODUCT_MARKERS = ['averagevalue', 'commodityinnovation', 'commodity'];
const STRATEGY_MARKERS = ['numberofsegment', 'estrevenue', 'productfamily'];
const LEAD_MARKERS = ['leadname', 'company', 'source', 'owner', 'valorestimado', 'sector'];
const CONTACT_MARKERS = ['contactname', 'email', 'department', 'role', 'decisionmaker'];

function detectType(headers: string[]): DetectedType {
  const normalized = headers.map(normalizeHeader);
  const matchCount = (markers: string[]) => markers.filter(m => normalized.some(h => h.includes(m))).length;
  
  const scores: [DetectedType, number][] = [
    ['orders', matchCount(ORDER_MARKERS)],
    ['opportunities', matchCount(OPP_MARKERS)],
    ['products', matchCount(PRODUCT_MARKERS)],
    ['strategy', matchCount(STRATEGY_MARKERS)],
    ['leads', matchCount(LEAD_MARKERS)],
    ['contacts', matchCount(CONTACT_MARKERS)],
  ];
  scores.sort((a, b) => b[1] - a[1]);
  return scores[0][1] >= 2 ? scores[0][0] : 'unknown';
}

function findCol(headers: string[], ...candidates: string[]): number {
  const normalized = headers.map(normalizeHeader);
  for (const c of candidates) {
    const idx = normalized.findIndex(h => h.includes(normalizeHeader(c)));
    if (idx >= 0) return idx;
  }
  return -1;
}

function getVal(row: any[], idx: number): string {
  return idx >= 0 ? safeString(row[idx]) : '';
}

function getNum(row: any[], idx: number): number {
  return idx >= 0 ? safeNumber(row[idx]) : 0;
}

export function parseExcelFile(file: File): Promise<{
  type: DetectedType;
  orders?: OrderRecord[];
  opportunities?: OpportunityRecord[];
  products?: ProductRecord[];
  strategy?: StrategyRecord[];
  leads?: LeadRecord[];
  contacts?: ContactRecord[];
  rowCount: number;
  errors: string[];
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'array' });
        const sheetNames = wb.SheetNames || [];
        if (sheetNames.length === 0) {
          resolve({ type: 'unknown', rowCount: 0, errors: ['Workbook has no sheets'] });
          return;
        }

        const sheet = wb.Sheets[wb.SheetNames[0]];
        const raw: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        if (raw.length < 2) { resolve({ type: 'unknown', rowCount: 0, errors: ['File is empty or has no data rows'] }); return; }

        const headers = raw[0].map(String);
        const type = detectType(headers);
        const dataRows = raw.slice(1).filter(r => r.some(cell => cell != null && cell !== ''));
        const errors: string[] = [];

        // Multi-sheet product workbooks are common in this module: one product per sheet.
        if (type === 'products' || type === 'unknown') {
          const parsed = await parseProductsFromWorkbookWithDiagnostics(file, file.name);
          if (parsed.products.length > 0) {
            errors.push(`Workbook sheets: ${sheetNames.length}`);
            parsed.diagnostics.forEach((diag) => {
              const headerText = diag.headers.slice(0, 8).join(' | ');
              errors.push(
                `Sheet '${diag.sheetName}': ${diag.rowCount} rows x ${diag.columnCount} cols${diag.skipped ? ` (skipped: ${diag.reason || 'n/a'})` : ''}${headerText ? ` | headers: ${headerText}` : ''}`,
              );
            });
            parsed.errors.forEach((item) => errors.push(`Sheet '${item.sheetName}' parse error: ${item.message}`));
            resolve({ type: 'products', products: parsed.products, rowCount: parsed.products.length, errors });
            return;
          }
        }

        if (type === 'orders') {
          const cols = {
            poDate: findCol(headers, 'PO Date', 'PO date', 'podate'),
            firstOffer: findCol(headers, 'First Offer Date', 'first offer'),
            oppNum: findCol(headers, 'Opp internal Number', 'opp number', 'opp internal'),
            region: findCol(headers, 'Geographical Area', 'region', 'geo'),
            country: findCol(headers, 'Customer Country', 'country'),
            customer: findCol(headers, 'Customer Name', 'customer name', 'customer'),
            scope: findCol(headers, 'Scope'),
            productFamily: findCol(headers, 'Product Family', 'product'),
            segment: findCol(headers, 'Segment'),
            year: findCol(headers, 'Purchasing Year', 'year'),
            quarter: findCol(headers, 'Purchasing Quarter', 'quarter'),
            month: findCol(headers, 'Purchasing Month', 'month'),
            price: findCol(headers, 'Selling Price', 'selling price', 'price', 'revenue'),
            margin: findCol(headers, 'Margin'),
            kam: findCol(headers, 'KAM'),
          };
          const orders: OrderRecord[] = dataRows.map(r => ({
            poDate: getVal(r, cols.poDate), firstOfferDate: getVal(r, cols.firstOffer),
            oppNumber: getVal(r, cols.oppNum), region: getVal(r, cols.region),
            country: getVal(r, cols.country), customerName: getVal(r, cols.customer),
            scope: getVal(r, cols.scope), productFamily: getVal(r, cols.productFamily),
            segment: getVal(r, cols.segment), purchasingYear: getVal(r, cols.year),
            purchasingQuarter: getVal(r, cols.quarter), purchasingMonth: getVal(r, cols.month),
            sellingPrice: getNum(r, cols.price), margin: getNum(r, cols.margin),
            kam: getVal(r, cols.kam),
          }));
          resolve({ type, orders, rowCount: orders.length, errors });
        } else if (type === 'opportunities') {
          const cols = {
            oppNum: findCol(headers, 'Opp/offer Number', 'opp number'),
            status: findCol(headers, 'Status'),
            region: findCol(headers, 'Geographical Area', 'region'),
            country: findCol(headers, 'Customer Country', 'country'),
            customer: findCol(headers, 'Customer Name', 'customer'),
            scope: findCol(headers, 'Scope'),
            productFamily: findCol(headers, 'Product Family'),
            segment: findCol(headers, 'Segment'),
            year: findCol(headers, 'estimated Purchasing Year', 'est year', 'purchasing year'),
            quarter: findCol(headers, 'estimated Purchasing Quarter', 'est quarter'),
            revenue: findCol(headers, 'Est Revenue', 'revenue'),
            prob: findCol(headers, 'Contract. Prob', 'prob', 'probability'),
            margin: findCol(headers, 'Margin'),
            contact: findCol(headers, 'Contact'),
            kam: findCol(headers, 'KAM'),
          };
          const opportunities: OpportunityRecord[] = dataRows.map(r => ({
            oppNumber: getVal(r, cols.oppNum), status: normalizeOpportunityStatus(getVal(r, cols.status)),
            region: getVal(r, cols.region), country: getVal(r, cols.country),
            customerName: getVal(r, cols.customer), scope: getVal(r, cols.scope),
            productFamily: getVal(r, cols.productFamily), segment: getVal(r, cols.segment),
            estPurchasingYear: getVal(r, cols.year), estPurchasingQuarter: getVal(r, cols.quarter),
            estRevenue: getNum(r, cols.revenue), contractProb: getNum(r, cols.prob),
            margin: getNum(r, cols.margin), contact: getVal(r, cols.contact),
            kam: getVal(r, cols.kam),
          }));
          resolve({ type, opportunities, rowCount: opportunities.length, errors });
        } else if (type === 'products') {
          const cols = {
            name: findCol(headers, 'Name'),
            avgValue: findCol(headers, 'Average Value', 'average', 'value'),
            type: findCol(headers, 'commodity/innovation', 'commodity', 'type'),
            comments: findCol(headers, 'Comments', 'comment'),
          };
          const products: ProductRecord[] = dataRows.map(r => ({
            name: getVal(r, cols.name), averageValue: getNum(r, cols.avgValue),
            type: getVal(r, cols.type), comments: getVal(r, cols.comments),
          }));
          resolve({ type, products, rowCount: products.length, errors });
        } else if (type === 'strategy') {
          const cols = {
            productFamily: findCol(headers, 'Product Family', 'product'),
            segment: findCol(headers, 'Number of Segment', 'segment'),
            region: findCol(headers, 'Geographical Area', 'region'),
            quarter: findCol(headers, 'estimated Purchasing Quarter', 'est quarter', 'quarter'),
            revenue: findCol(headers, 'Est Revenue', 'revenue'),
            margin: findCol(headers, 'Margin'),
            kam: findCol(headers, 'KAM'),
          };
          const strategy: StrategyRecord[] = dataRows.map(r => ({
            productFamily: getVal(r, cols.productFamily), numberOfSegment: getVal(r, cols.segment),
            region: getVal(r, cols.region), estPurchasingQuarter: getVal(r, cols.quarter),
            estRevenue: getNum(r, cols.revenue), margin: getNum(r, cols.margin),
            kam: getVal(r, cols.kam),
          }));

          const revenueValues = strategy.map(row => row.estRevenue).filter(value => value > 0);
          const totalRevenue = revenueValues.reduce((sum, value) => sum + value, 0);
          const maxRevenue = revenueValues.length > 0 ? Math.max(...revenueValues) : 0;

          if (strategy.length > 4 && maxRevenue > 0 && totalRevenue > maxRevenue * 4) {
            errors.push('Output data check: strategy totals look duplicated or inflated. Please verify the goal rows and Est. Revenue column.');
          }

          if (revenueValues.some(value => value >= 100_000_000)) {
            errors.push('Output data check: at least one strategy revenue value is unusually high and should be reviewed.');
          }

          resolve({ type, strategy, rowCount: strategy.length, errors });
        } else if (type === 'leads') {
          const cols = {
            leadName: findCol(headers, 'Lead Name', 'Nombre Lead', 'Nombre', 'Contacto'),
            companyName: findCol(headers, 'Company', 'Company Name', 'Empresa'),
            email: findCol(headers, 'Email', 'Correo'),
            phone: findCol(headers, 'Phone', 'Telefono', 'Teléfono', 'Mobile'),
            region: findCol(headers, 'Region', 'Geographical Area', 'Zona', 'Area'),
            country: findCol(headers, 'Country', 'Pais', 'País'),
            sector: findCol(headers, 'Sector', 'Industry', 'Industria'),
            status: findCol(headers, 'Status', 'Estado'),
            source: findCol(headers, 'Source', 'Origen', 'Canal'),
            owner: findCol(headers, 'Owner', 'KAM', 'Responsable'),
            estimatedValue: findCol(headers, 'Estimated Value', 'Est Value', 'Valor Estimado'),
            notes: findCol(headers, 'Notes', 'Comentario', 'Comentarios'),
          };
          const leads: LeadRecord[] = dataRows.map(r => ({
            leadName: getVal(r, cols.leadName),
            companyName: getVal(r, cols.companyName),
            email: getVal(r, cols.email),
            phone: getVal(r, cols.phone),
            region: getVal(r, cols.region),
            country: getVal(r, cols.country),
            sector: getVal(r, cols.sector),
            status: getVal(r, cols.status),
            source: getVal(r, cols.source),
            owner: getVal(r, cols.owner),
            estimatedValue: getNum(r, cols.estimatedValue),
            notes: getVal(r, cols.notes),
          }));
          resolve({ type, leads, rowCount: leads.length, errors });
        } else if (type === 'contacts') {
          const cols = {
            name: findCol(headers, 'Contact Name', 'Name', 'Nombre'),
            email: findCol(headers, 'Email', 'Correo'),
            phone: findCol(headers, 'Phone', 'Telefono', 'Teléfono', 'Mobile'),
            role: findCol(headers, 'Role', 'Cargo', 'Title'),
            department: findCol(headers, 'Department', 'Departamento', 'Area'),
            companyName: findCol(headers, 'Company', 'Company Name', 'Empresa'),
            region: findCol(headers, 'Region', 'Geographical Area', 'Zona'),
            country: findCol(headers, 'Country', 'Pais', 'País'),
            kam: findCol(headers, 'KAM', 'Owner', 'Account Manager'),
            notes: findCol(headers, 'Notes', 'Comentario', 'Comentarios'),
          };
          const contacts: ContactRecord[] = dataRows.map(r => ({
            name: getVal(r, cols.name),
            email: getVal(r, cols.email),
            phone: getVal(r, cols.phone),
            role: getVal(r, cols.role),
            department: getVal(r, cols.department),
            companyName: getVal(r, cols.companyName),
            region: getVal(r, cols.region),
            country: getVal(r, cols.country),
            kam: getVal(r, cols.kam),
            notes: getVal(r, cols.notes),
          }));
          resolve({ type, contacts, rowCount: contacts.length, errors });
        } else {
          errors.push('Could not auto-detect file type. Please ensure headers match one of the templates.');
          resolve({ type: 'unknown', rowCount: 0, errors });
        }
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}
