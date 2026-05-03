import type { GoaDataSnapshot, GoaPanelContext, GoaProposedChange } from '@/agents/goa/types';

export interface CorrectionAgentResult {
  updatedData: GoaDataSnapshot;
  changes: GoaProposedChange[];
  confidence: number;
}

const cloneSnapshot = (snapshot: GoaDataSnapshot): GoaDataSnapshot => ({
  orders: snapshot.orders.map((order) => ({ ...order })),
  opportunities: snapshot.opportunities.map((opportunity) => ({ ...opportunity })),
  products: snapshot.products.map((product) => ({ ...product })),
  strategy: snapshot.strategy.map((strategy) => ({ ...strategy })),
  leads: snapshot.leads.map((lead) => ({ ...lead })),
  contacts: snapshot.contacts.map((contact) => ({ ...contact })),
  companyProfile: { ...snapshot.companyProfile },
});

const average = (values: number[]) => {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

export function runDataCorrectionAgent(input: {
  context: GoaPanelContext;
  prompt: string;
  data: GoaDataSnapshot;
}): CorrectionAgentResult {
  const updatedData = cloneSnapshot(input.data);
  const changes: GoaProposedChange[] = [];

  const wantsMarginFix = /margin|margen|profit/i.test(input.prompt);
  const wantsMissingFix = /missing|null|empty|vac[ii]o|faltante|incomplete/i.test(input.prompt);

  if (wantsMarginFix || wantsMissingFix) {
    const baselineOrderMargin = average(updatedData.orders.map((order) => order.margin).filter((margin) => margin > 0 && margin <= 100));
    updatedData.orders = updatedData.orders.map((order, index) => {
      if ((order.margin === 0 || Number.isNaN(order.margin as number)) && baselineOrderMargin > 0) {
        const corrected = { ...order, margin: Number(baselineOrderMargin.toFixed(2)) };
        changes.push({
          dataset: 'orders',
          description: `Filled missing order margin on row ${index + 1}.`,
          before: { margin: order.margin, customerName: order.customerName },
          after: { margin: corrected.margin, customerName: corrected.customerName },
        });
        return corrected;
      }
      return order;
    });

    const baselineOppMargin = average(updatedData.opportunities.map((opportunity) => opportunity.margin).filter((margin) => margin > 0 && margin <= 100));
    updatedData.opportunities = updatedData.opportunities.map((opportunity, index) => {
      let next = { ...opportunity };

      if ((next.margin === 0 || Number.isNaN(next.margin as number)) && baselineOppMargin > 0) {
        next = { ...next, margin: Number(baselineOppMargin.toFixed(2)) };
        changes.push({
          dataset: 'opportunities',
          description: `Filled missing opportunity margin on row ${index + 1}.`,
          before: { margin: opportunity.margin, oppNumber: opportunity.oppNumber },
          after: { margin: next.margin, oppNumber: next.oppNumber },
        });
      }

      if ((next.contractProb === 0 || !Number.isFinite(next.contractProb)) && wantsMissingFix) {
        next = { ...next, contractProb: 50 };
        changes.push({
          dataset: 'opportunities',
          description: `Set default probability to 50 on opportunity row ${index + 1}.`,
          before: { contractProb: opportunity.contractProb, oppNumber: opportunity.oppNumber },
          after: { contractProb: next.contractProb, oppNumber: next.oppNumber },
        });
      }

      if (!next.status?.trim() && wantsMissingFix) {
        next = { ...next, status: 'open' };
        changes.push({
          dataset: 'opportunities',
          description: `Set default status to open on opportunity row ${index + 1}.`,
          before: { status: opportunity.status, oppNumber: opportunity.oppNumber },
          after: { status: next.status, oppNumber: next.oppNumber },
        });
      }

      return next;
    });

    updatedData.products = updatedData.products.map((product, index) => {
      let next = { ...product };
      if (!next.type?.trim() && wantsMissingFix) {
        next = { ...next, type: 'Core' };
        changes.push({
          dataset: 'products',
          description: `Set default product type on row ${index + 1}.`,
          before: { type: product.type, name: product.name },
          after: { type: next.type, name: next.name },
        });
      }
      return next;
    });
  }

  const confidence = changes.length > 0 ? 0.82 : 0.62;
  return { updatedData, changes, confidence };
}
