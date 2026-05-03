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

const normalizeIdentityToken = (value: unknown) => cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const buildAccountReference = (record: OpportunityLike | OrderLike) => {
  const customer = normalizeIdentityToken(record.customerName);
  const productFamily = normalizeIdentityToken(record.productFamily);
  const region = normalizeIdentityToken(record.region);
  const parts = [customer, productFamily, region].filter(Boolean);
  return parts.length >= 2 ? `acct:${parts.join('|')}` : '';
};

const buildPrimaryReference = (record: OpportunityLike | OrderLike) => {
  const oppNumber = normalizeIdentityToken(record.oppNumber);
  if (oppNumber) return `opp:${oppNumber}`;
  return buildAccountReference(record);
};

const isComparableRevenue = (left: unknown, right: unknown) => {
  const leftValue = parseFlexibleNumber(left);
  const rightValue = parseFlexibleNumber(right);

  if (leftValue <= 0 || rightValue <= 0) return false;

  const delta = Math.abs(leftValue - rightValue);
  return delta <= Math.max(5_000, Math.max(leftValue, rightValue) * 0.35);
};

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

  const multiplierMatch = raw.match(/(million|mln|mn|[kmb])$/i);
  let multiplier = 1;
  if (multiplierMatch) {
    const suffix = multiplierMatch[1].toLowerCase();
    multiplier = suffix === 'k'
      ? 1_000
      : suffix === 'm' || suffix === 'mn' || suffix === 'mln' || suffix === 'million'
        ? 1_000_000
        : suffix === 'b'
          ? 1_000_000_000
          : 1;
    raw = raw.slice(0, raw.length - multiplierMatch[1].length).trim();
  }

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
  const scaled = parsed * multiplier;
  return negative ? -scaled : scaled;
}

export function normalizeOpportunityStatus(value: unknown): 'won' | 'lost' | 'neglected' | 'open' {
  const status = cleanText(value).toLowerCase();
  if (!status) return 'open';

  if ([
    'won', 'ganado', 'sold', 'vendido', 'closed won', 'closedwon', 'booked', 'order received', 'pedido recibido', 'po received', 'awarded', 'facturado', 'invoiced', 'confirmed sale', 'confirmed sold',
  ].some(token => status.includes(token))) {
    return 'won';
  }

  if ([
    'lost', 'perdido', 'closed lost', 'closedlost', 'cancel', 'cancelled', 'canceled', 'rejected', 'declined', 'no bid', 'not won', 'unsuccessful',
  ].some(token => status.includes(token))) {
    return 'lost';
  }

  if ([
    'desatendido', 'desatendida', 'neglected', 'unattended', 'stalled', 'abandoned', 'sin seguimiento', 'sin atencion', 'sin atención', 'no follow', 'dormant',
  ].some(token => status.includes(token))) {
    return 'neglected';
  }

  return 'open';
}

export const isWonStatus = (value: unknown) => normalizeOpportunityStatus(value) === 'won';
export const isLostStatus = (value: unknown) => normalizeOpportunityStatus(value) === 'lost';
export const isNeglectedStatus = (value: unknown) => normalizeOpportunityStatus(value) === 'neglected';
export const isOpenOpportunityStatus = (value: unknown) => normalizeOpportunityStatus(value) === 'open';
export const isSoldByTruthRule = (opportunity: OpportunityLike) => isWonStatus(opportunity.status) || parseFlexibleNumber(opportunity.contractProb) >= 100;

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

export function isOpportunityCoveredByOrder(opportunity: OpportunityLike, orders: OrderLike[] = []) {
  const opportunityPrimaryRef = buildPrimaryReference(opportunity);
  const opportunityAccountRef = buildAccountReference(opportunity);

  return orders.some((order) => {
    const orderPrimaryRef = buildPrimaryReference(order);
    if (opportunityPrimaryRef && orderPrimaryRef && opportunityPrimaryRef === orderPrimaryRef) {
      return true;
    }

    const orderAccountRef = buildAccountReference(order);
    if (!opportunityAccountRef || !orderAccountRef || opportunityAccountRef !== orderAccountRef) {
      return false;
    }

    return isComparableRevenue(order.sellingPrice ?? 0, opportunity.estRevenue ?? 0);
  });
}

export function getActivePipelineOpportunities<T extends OpportunityLike>(opportunities: T[], orders: OrderLike[] = []): T[] {
  return opportunities.filter((opportunity) => (
    isOpenOpportunityStatus(opportunity.status) && !isSoldByTruthRule(opportunity) && !isOpportunityCoveredByOrder(opportunity, orders)
  ));
}

export function buildPipelineMetrics(input: { opportunities?: OpportunityLike[]; orders?: OrderLike[] } = {}) {
  const opportunities = input.opportunities || [];
  const orders = input.orders || [];

  let soldRevenue = orders.reduce((sum, order) => sum + parseFlexibleNumber(order.sellingPrice ?? 0), 0);

  opportunities
    .filter((opportunity) => isSoldByTruthRule(opportunity) && !isOpportunityCoveredByOrder(opportunity, orders))
    .forEach((opportunity) => {
      soldRevenue += parseFlexibleNumber(opportunity.estRevenue ?? 0);
    });

  const openOpportunities = getActivePipelineOpportunities(opportunities, orders);
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
