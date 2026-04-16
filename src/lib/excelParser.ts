import * as XLSX from 'xlsx';
import type { OrderRecord, OpportunityRecord, ProductRecord, StrategyRecord } from '@/store/DataStore';
import { normalizeOpportunityStatus, parseFlexibleNumber } from '@/lib/salesData';

function normalizeHeader(h: string): string {
  return (h || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function safeNumber(val: any): number {
  return parseFlexibleNumber(val);
}

function safeString(val: any): string {
  return val != null ? String(val).trim() : '';
}

type DetectedType = 'orders' | 'opportunities' | 'products' | 'strategy' | 'unknown';

const ORDER_MARKERS = ['podate', 'sellingprice', 'purchasingyear', 'purchasingquarter'];
const OPP_MARKERS = ['status', 'contractprob', 'estrevenue', 'estimatedpurchasingyear'];
const PRODUCT_MARKERS = ['averagevalue', 'commodityinnovation', 'commodity'];
const STRATEGY_MARKERS = ['numberofsegment', 'estrevenue', 'productfamily'];

function detectType(headers: string[]): DetectedType {
  const normalized = headers.map(normalizeHeader);
  const matchCount = (markers: string[]) => markers.filter(m => normalized.some(h => h.includes(m))).length;
  
  const scores: [DetectedType, number][] = [
    ['orders', matchCount(ORDER_MARKERS)],
    ['opportunities', matchCount(OPP_MARKERS)],
    ['products', matchCount(PRODUCT_MARKERS)],
    ['strategy', matchCount(STRATEGY_MARKERS)],
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
  rowCount: number;
  errors: string[];
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const raw: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        if (raw.length < 2) { resolve({ type: 'unknown', rowCount: 0, errors: ['File is empty or has no data rows'] }); return; }

        const headers = raw[0].map(String);
        const type = detectType(headers);
        const dataRows = raw.slice(1).filter(r => r.some(cell => cell != null && cell !== ''));
        const errors: string[] = [];

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
          resolve({ type, strategy, rowCount: strategy.length, errors });
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
