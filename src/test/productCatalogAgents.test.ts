import { describe, expect, it } from 'vitest';
import { runProductAnalysisAgent, runProductSearchAgent } from '@/agents/productCatalogAgents';
import { parseProductComments, serializeProductComments } from '@/lib/productCatalog';
import { buildSeedProductCatalog } from '@/lib/productKnowledge';
import { CANONICAL_DOSSIER_COUNT, getCanonicalProductDossier } from '@/lib/productTechnicalDossiers';

describe('product catalog agents', () => {
  it('builds strategic signals from product metadata', () => {
    const signal = runProductAnalysisAgent({
      name: 'Predictive Service Suite',
      type: 'innovation',
      comments: 'digital maintenance solution',
      category: 'service',
      characteristics: ['AI diagnostics', 'lifecycle contract'],
    });

    expect(signal.lifecycleSignal).toBe('innovative');
    expect(signal.offerModel).toBe('integrated solutions');
    expect(signal.scenario).toMatch(/consultative/i);
  });

  it('generates catalog suggestions from commercial history', () => {
    const suggestions = runProductSearchAgent({
      products: [],
      orders: [{ productFamily: 'Assembly Cell', sellingPrice: 250000, margin: 20, region: '' }],
      opportunities: [{ productFamily: 'Lifecycle Service', estRevenue: 90000, contractProb: 60, status: 'open', region: '' }],
    });

    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some((item) => item.category === 'service')).toBe(true);
  });

  it('serializes and parses product metadata in comments', () => {
    const encoded = serializeProductComments('base note', {
      category: 'service',
      characteristics: ['Remote monitoring'],
      estimatedCost: 12000,
      repositories: ['Service KB'],
      validated: true,
      source: 'generated',
      technicalDossier: {
        dossierId: 'TEST-01',
        revision: '1.0',
        updatedAt: '2026-09-11',
        valueProposition: 'Verified product value.',
        applications: ['Packaging'],
        technicalSpecifications: [{ parameter: 'Capacity', value: '10 units/h', status: 'verified' }],
        performanceKpis: ['Good units/hour'],
        roiFramework: ['Realizable labor'],
        risksAndLimits: ['SKU dependent'],
        acceptanceCriteria: ['Eight-hour run-off'],
        sourceReferences: ['Technical offer'],
      },
    });

    const parsed = parseProductComments(encoded);
    expect(parsed.notes).toBe('base note');
    expect(parsed.meta.category).toBe('service');
    expect(parsed.meta.repositories).toContain('Service KB');
    expect(parsed.meta.technicalDossier?.dossierId).toBe('TEST-01');
    expect(parsed.meta.technicalDossier?.technicalSpecifications[0].status).toBe('verified');
  });

  it('loads evidence-controlled dossiers for all canonical Ingecart products', () => {
    const products = buildSeedProductCatalog([]);
    const productsWithDossiers = products.filter((product) => product.technicalDossier);

    expect(CANONICAL_DOSSIER_COUNT).toBe(11);
    expect(productsWithDossiers).toHaveLength(11);
    expect(getCanonicalProductDossier('HD PALLETIZER')?.dossierId).toBe('ING-P06');
    expect(getCanonicalProductDossier('TRUCK LOADING SYSTEM')?.technicalSpecifications.some((item) => item.status === 'pending')).toBe(true);
    expect(productsWithDossiers.every((product) => product.technicalDossier?.performanceKpis.length)).toBe(true);
  });
});
