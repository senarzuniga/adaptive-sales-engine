import type { GoaDataSnapshot } from '@/agents/goa/types';

export interface ValidationIssue {
  dataset: keyof GoaDataSnapshot | 'external';
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  confidence: number;
  issues: ValidationIssue[];
}

const min = (value: number, cap: number) => (value < cap ? value : cap);

export function validateGoaUpdate(input: {
  before: GoaDataSnapshot;
  after: GoaDataSnapshot;
  requestedIntents: string[];
}) : ValidationResult {
  const issues: ValidationIssue[] = [];

  input.after.orders.forEach((order, index) => {
    if (!Number.isFinite(order.sellingPrice)) {
      issues.push({ dataset: 'orders', message: `Order ${index + 1} has invalid selling price.` });
    }
  });

  input.after.opportunities.forEach((opportunity, index) => {
    if (!Number.isFinite(opportunity.estRevenue)) {
      issues.push({ dataset: 'opportunities', message: `Opportunity ${index + 1} has invalid estimated revenue.` });
    }
    if (Number.isFinite(opportunity.contractProb) && (opportunity.contractProb < 0 || opportunity.contractProb > 100)) {
      issues.push({ dataset: 'opportunities', message: `Opportunity ${index + 1} has probability outside 0-100.` });
    }
  });

  input.after.products.forEach((product, index) => {
    if (!Number.isFinite(product.averageValue)) {
      issues.push({ dataset: 'products', message: `Product ${index + 1} has invalid average value.` });
    }
  });

  const structuralIntent = input.requestedIntents.includes('structural_change');
  const deletedAllOrders = input.before.orders.length > 0 && input.after.orders.length === 0;
  const deletedAllOpportunities = input.before.opportunities.length > 0 && input.after.opportunities.length === 0;
  if (!structuralIntent && (deletedAllOrders || deletedAllOpportunities)) {
    issues.push({ dataset: 'external', message: 'High-risk change detected: complete dataset removal requested without structural intent.' });
  }

  const confidencePenalty = min(issues.length * 0.15, 0.8);
  const confidence = Number(Math.max(0.2, 0.95 - confidencePenalty).toFixed(2));

  return {
    valid: issues.length === 0,
    confidence,
    issues,
  };
}
