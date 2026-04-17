import { describe, expect, it } from 'vitest';
import { runDataManagementAgent } from '@/agents/dataManagementAgent';
import { runCustomerEnrichmentAgent } from '@/agents/customerEnrichmentAgent';

describe('Data management and enrichment agents', () => {
  it('deduplicates companies across datasets and links contacts', () => {
    const management = runDataManagementAgent({
      orders: [
        {
          poDate: '2026-01-01',
          firstOfferDate: '',
          oppNumber: 'O-1',
          region: 'EMEA',
          country: 'ES',
          customerName: 'Acme Corp',
          scope: '',
          productFamily: 'Automation',
          segment: '',
          purchasingYear: '2026',
          purchasingQuarter: 'Q1',
          purchasingMonth: '01',
          sellingPrice: 100000,
          margin: 25,
          kam: 'Ana',
        },
      ],
      opportunities: [],
      products: [],
      strategy: [],
      leads: [
        {
          leadName: 'John Smith',
          companyName: 'ACME CORP',
          email: 'john@acme.com',
          phone: '',
          region: 'EMEA',
          country: 'ES',
          sector: 'Industrial',
          status: 'Open',
          source: 'Web',
          owner: 'Ana',
          estimatedValue: 50000,
          notes: '',
        },
      ],
      contacts: [],
    });

    expect(Object.keys(management.registries.companies)).toHaveLength(1);
    const company = Object.values(management.registries.companies)[0];
    expect(company.name).toBe('Acme Corp');
    expect(company.sector).toBe('Industrial');
    expect(company.linkedContactIds.length).toBeGreaterThan(0);
  });

  it('builds enriched profile with score and completeness', () => {
    const management = runDataManagementAgent({
      orders: [
        {
          poDate: '2026-01-01',
          firstOfferDate: '',
          oppNumber: 'O-1',
          region: 'EMEA',
          country: 'ES',
          customerName: 'Acme Corp',
          scope: '',
          productFamily: 'Automation',
          segment: '',
          purchasingYear: '2026',
          purchasingQuarter: 'Q1',
          purchasingMonth: '01',
          sellingPrice: 100000,
          margin: 20,
          kam: 'Ana',
        },
      ],
      opportunities: [
        {
          oppNumber: 'P-1',
          status: 'Open',
          region: 'EMEA',
          country: 'ES',
          customerName: 'Acme Corp',
          scope: '',
          productFamily: 'Services',
          segment: '',
          estPurchasingYear: '2026',
          estPurchasingQuarter: 'Q3',
          estRevenue: 80000,
          contractProb: 60,
          margin: 22,
          contact: 'John Smith',
          kam: 'Ana',
        },
      ],
      products: [],
      strategy: [],
      leads: [],
      contacts: [
        {
          name: 'John Smith',
          email: 'john@acme.com',
          phone: '',
          role: 'Director',
          department: 'Operations',
          companyName: 'Acme Corp',
          region: 'EMEA',
          country: 'ES',
          kam: 'Ana',
          notes: '',
        },
      ],
    });

    const enrichment = runCustomerEnrichmentAgent({
      orders: [
        {
          poDate: '2026-01-01',
          firstOfferDate: '',
          oppNumber: 'O-1',
          region: 'EMEA',
          country: 'ES',
          customerName: 'Acme Corp',
          scope: '',
          productFamily: 'Automation',
          segment: '',
          purchasingYear: '2026',
          purchasingQuarter: 'Q1',
          purchasingMonth: '01',
          sellingPrice: 100000,
          margin: 20,
          kam: 'Ana',
        },
      ],
      opportunities: [
        {
          oppNumber: 'P-1',
          status: 'Open',
          region: 'EMEA',
          country: 'ES',
          customerName: 'Acme Corp',
          scope: '',
          productFamily: 'Services',
          segment: '',
          estPurchasingYear: '2026',
          estPurchasingQuarter: 'Q3',
          estRevenue: 80000,
          contractProb: 60,
          margin: 22,
          contact: 'John Smith',
          kam: 'Ana',
        },
      ],
      products: [],
      strategy: [],
      leads: [],
      contacts: [
        {
          name: 'John Smith',
          email: 'john@acme.com',
          phone: '',
          role: 'Director',
          department: 'Operations',
          companyName: 'Acme Corp',
          region: 'EMEA',
          country: 'ES',
          kam: 'Ana',
          notes: '',
        },
      ],
      registries: management.registries,
    });

    expect(enrichment.profiles).toHaveLength(1);
    expect(enrichment.profiles[0].companyName).toBe('Acme Corp');
    expect(enrichment.profiles[0].totalRevenue).toBe(100000);
    expect(enrichment.profiles[0].pipelineValue).toBe(80000);
    expect(enrichment.profiles[0].enrichmentScore).toBeGreaterThan(40);
  });
});
