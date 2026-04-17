import { describe, expect, it } from 'vitest';
import { buildPipelineMetrics, getProbabilityGuidance, normalizeOpportunityStatus, parseFlexibleNumber } from '@/lib/salesData';

describe('sales data normalization', () => {
  it('parses European-formatted revenue safely', () => {
    expect(parseFlexibleNumber('30.000.000,00 €')).toBe(30000000);
    expect(parseFlexibleNumber('1,250,500.75')).toBe(1250500.75);
    expect(parseFlexibleNumber('85%')).toBe(85);
  });

  it('normalizes sold and neglected statuses consistently', () => {
    expect(normalizeOpportunityStatus('GANADO')).toBe('won');
    expect(normalizeOpportunityStatus('SOLD')).toBe('won');
    expect(normalizeOpportunityStatus('Desatendido')).toBe('neglected');
    expect(normalizeOpportunityStatus('In Progress')).toBe('open');
  });

  it('counts sold deals from the offer pipeline without double-counting booked orders', () => {
    const metrics = buildPipelineMetrics({
      orders: [
        { oppNumber: 'OPP-1', customerName: 'Acme', productFamily: 'Board', region: 'Spain', sellingPrice: 100000 },
      ],
      opportunities: [
        { oppNumber: 'OPP-1', customerName: 'Acme', productFamily: 'Board', region: 'Spain', estRevenue: 100000, status: 'SOLD', contractProb: 100 },
        { oppNumber: 'OPP-2', customerName: 'Beta', productFamily: 'Service', region: 'France', estRevenue: 250000, status: 'sold', contractProb: 100 },
        { oppNumber: 'OPP-3', customerName: 'Gamma', productFamily: 'Upgrade', region: 'Italy', estRevenue: 200000, status: 'open', contractProb: 50 },
        { oppNumber: 'OPP-4', customerName: 'Delta', productFamily: 'Support', region: 'Germany', estRevenue: 100000, status: 'open', contractProb: 80 },
      ],
    });

    expect(metrics.soldRevenue).toBe(350000);
    expect(metrics.weightedOpenRevenue).toBe(180000);
    expect(metrics.weightedPipeline).toBe(530000);
  });

  it('prefers confirmed order revenue when the matching opportunity estimate differs', () => {
    const metrics = buildPipelineMetrics({
      orders: [
        { oppNumber: 'ASE-77', customerName: 'Ingecart', productFamily: 'Line Upgrade', region: 'Spain', sellingPrice: 98000 },
      ],
      opportunities: [
        { oppNumber: 'ASE-77', customerName: 'Ingecart', productFamily: 'Line Upgrade', region: 'Spain', estRevenue: 120000, status: 'Order received', contractProb: 100 },
        { oppNumber: 'ASE-88', customerName: 'Nova', productFamily: 'Retrofit', region: 'France', estRevenue: 50000, status: 'Open', contractProb: 60 },
      ],
    });

    expect(metrics.soldRevenue).toBe(98000);
    expect(metrics.openPipeline).toBe(50000);
    expect(metrics.weightedOpenRevenue).toBe(30000);
  });

  it('removes already-booked deals from the pipeline even if the opportunity remains marked open', () => {
    const metrics = buildPipelineMetrics({
      orders: [
        { oppNumber: 'OPP-9', customerName: 'Helios', productFamily: 'Service Pack', region: 'Germany', sellingPrice: 150000 },
      ],
      opportunities: [
        { oppNumber: 'OPP-9', customerName: 'Helios', productFamily: 'Service Pack', region: 'Germany', estRevenue: 150000, status: 'Open', contractProb: 95 },
        { oppNumber: 'OPP-10', customerName: 'Orion', productFamily: 'Retrofit', region: 'Italy', estRevenue: 40000, status: 'In progress', contractProb: 50 },
      ],
    });

    expect(metrics.soldRevenue).toBe(150000);
    expect(metrics.openPipeline).toBe(40000);
    expect(metrics.weightedOpenRevenue).toBe(20000);
  });

  it('treats probabilities below 75% as weak and 75% or more as confidence follow-up deals', () => {
    const weak = getProbabilityGuidance(74);
    const strong = getProbabilityGuidance(75);

    expect(weak.band).toBe('weak');
    expect(weak.actionFocus).toContain('improve');
    expect(strong.band).toBe('strong');
    expect(strong.actionFocus).toContain('confidence');
  });
});
