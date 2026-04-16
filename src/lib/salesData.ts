type OpportunityLike = {
  oppNumber?: string;
  customerName?: string;
  productFamily?: string;
  region?: string;
  estRevenue?: number;
  contractProb?: number;
  status?: string;
  kam?: string;
};

type OrderLike = {
  oppNumber?: string;
  customerName?: string;
  productFamily?: string;
  region?: string;
  sellingPrice?: number;
  poDate?: string;
  kam?: string;
};

const cleanText = (value: unknown) => String(value ?? '').trim();
export const WEAK_PROBABILITY_THRESHOLD = 75;

export function parseFlexibleNumber(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  let raw = cleanText(value);
  if (!raw) return 0;

  const negative = raw.includes('(') && raw.includes(')') || raw.startsWith('-');
  raw = raw
    .replace(/[()]/g, '')
    .replace(/^[+-]/, '')
    .replace(/\s+/g, '')
    .replace(/[€$£¥]/g, '')
    .replace(/%/g, '');

  const commaCount = (raw.match(/,/g) || []).length;
  const dotCount = (raw.match(/\./g) || []).length;

  if (commaCount > 0 && dotCount > 0) {
    if (raw.lastIndexOf(',') > raw.lastIndexOf('.')) {
      raw = raw.replace(/\./g, '').replace(',', '.');
    } else {
      raw = raw.replace(/,/g, '');
    }
  } else if (commaCount > 1) {
    raw = raw.replace(/,/g, '');
  } else if (dotCount > 1) {
    raw = raw.replace(/\./g, '');
  } else if (commaCount === 1) {
    const [left, right] = raw.split(',');
    raw = left !== '0' && right?.length === 3 ? `${left}${right}` : `${left}.${right ?? ''}`;
  } else if (dotCount === 1) {
    const [left, right] = raw.split('.');
    if (left !== '0' && right?.length === 3) {
      raw = `${left}${right}`;
    }
  }

  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) return 0;
  return negative ? -parsed : parsed;
}

export function normalizeOpportunityStatus(value: unknown): 'won' | 'lost' | 'neglected' | 'open' {
  const status = cleanText(value).toLowerCase();
  if (!status) return 'open';

  if ([
    'won', 'ganado', 'sold', 'vendido', 'closed won', 'closedwon', 'booked', 'order received', 'awarded',
  ].some(token => status.includes(token))) {
    return 'won';
  }

  if ([
    'lost', 'perdido', 'closed lost', 'closedlost', 'cancel', 'cancelled', 'canceled', 'rejected', 'declined',
  ].some(token => status.includes(token))) {
    return 'lost';
  }

  if ([
    'desatendido', 'neglected', 'unattended', 'stalled', 'abandoned', 'sin seguimiento', 'no follow', 'dormant',
  ].some(token => status.includes(token))) {
    return 'neglected';
  }

  return 'open';
}

export const isWonStatus = (value: unknown) => normalizeOpportunityStatus(value) === 'won';
export const isLostStatus = (value: unknown) => normalizeOpportunityStatus(value) === 'lost';
export const isNeglectedStatus = (value: unknown) => normalizeOpportunityStatus(value) === 'neglected';
export const isOpenOpportunityStatus = (value: unknown) => normalizeOpportunityStatus(value) === 'open';

export function getProbabilityGuidance(value: unknown) {
  const probability = Math.max(0, Math.min(100, parseFlexibleNumber(value)));

  if (probability < WEAK_PROBABILITY_THRESHOLD) {
    return {
      probability,
      band: 'weak' as const,
      actionFocus: 'improve success probability with stronger value case, qualification, and objection handling',
    };
  }

  return {
    probability,
    band: 'strong' as const,
    actionFocus: 'protect confidence with customer relationship, disciplined follow-up, and deal assurance',
  };
}

const buildOpportunityKey = (record: OpportunityLike) => [
  cleanText(record.oppNumber) || cleanText(record.customerName),
  cleanText(record.customerName),
  cleanText(record.productFamily),
  cleanText(record.region),
  Math.round(parseFlexibleNumber(record.estRevenue ?? 0)),
].join('|').toLowerCase();

const buildOrderKey = (record: OrderLike) => [
  cleanText(record.oppNumber) || cleanText(record.customerName),
  cleanText(record.customerName),
  cleanText(record.productFamily),
  cleanText(record.region),
  Math.round(parseFlexibleNumber(record.sellingPrice ?? 0)),
].join('|').toLowerCase();

export function buildPipelineMetrics(input: { opportunities?: OpportunityLike[]; orders?: OrderLike[] } = {}) {
  const opportunities = input.opportunities || [];
  const orders = input.orders || [];

  const bookedOrderKeys = new Set<string>();
  let soldRevenue = 0;

  orders.forEach((order) => {
    soldRevenue += parseFlexibleNumber(order.sellingPrice ?? 0);
    bookedOrderKeys.add(buildOrderKey(order));
  });

  opportunities
    .filter((opportunity) => isWonStatus(opportunity.status))
    .forEach((opportunity) => {
      const key = buildOpportunityKey(opportunity);
      if (!bookedOrderKeys.has(key)) {
        soldRevenue += parseFlexibleNumber(opportunity.estRevenue ?? 0);
      }
    });

  const openOpportunities = opportunities.filter((opportunity) => isOpenOpportunityStatus(opportunity.status));
  const openPipeline = openOpportunities.reduce((sum, opportunity) => sum + parseFlexibleNumber(opportunity.estRevenue ?? 0), 0);
  const weightedOpenRevenue = openOpportunities.reduce((sum, opportunity) => {
    const revenue = parseFlexibleNumber(opportunity.estRevenue ?? 0);
    const probability = getProbabilityGuidance(opportunity.contractProb).probability;
    return sum + revenue * (probability / 100);
  }, 0);

  const weakOpenDeals = openOpportunities.filter((opportunity) => getProbabilityGuidance(opportunity.contractProb).band === 'weak');
  const strongOpenDeals = openOpportunities.filter((opportunity) => getProbabilityGuidance(opportunity.contractProb).band === 'strong');

  return {
    soldRevenue,
    openPipeline,
    weightedOpenRevenue,
    weightedPipeline: soldRevenue + weightedOpenRevenue,
    weakOpenCount: weakOpenDeals.length,
    weakOpenRevenue: weakOpenDeals.reduce((sum, opportunity) => sum + parseFlexibleNumber(opportunity.estRevenue ?? 0), 0),
    strongOpenCount: strongOpenDeals.length,
    strongOpenRevenue: strongOpenDeals.reduce((sum, opportunity) => sum + parseFlexibleNumber(opportunity.estRevenue ?? 0), 0),
  };
}

export function dedupeOpportunities<T extends OpportunityLike>(records: T[]): T[] {
  const seen = new Set<string>();
  return records.filter((record) => {
    const key = [
      cleanText(record.oppNumber) || cleanText(record.customerName),
      cleanText(record.customerName),
      cleanText(record.productFamily),
      cleanText(record.region),
      Math.round(parseFlexibleNumber(record.estRevenue ?? 0)),
      normalizeOpportunityStatus(record.status),
      cleanText(record.kam),
    ].join('|').toLowerCase();

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function dedupeOrders<T extends OrderLike>(records: T[]): T[] {
  const seen = new Set<string>();
  return records.filter((record) => {
    const key = [
      cleanText(record.oppNumber) || cleanText(record.customerName),
      cleanText(record.customerName),
      cleanText(record.productFamily),
      cleanText(record.region),
      Math.round(parseFlexibleNumber(record.sellingPrice ?? 0)),
      cleanText(record.poDate),
      cleanText(record.kam),
    ].join('|').toLowerCase();

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
