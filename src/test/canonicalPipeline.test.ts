import { describe, expect, it } from 'vitest';
import {
  buildConfidenceScore,
  enrichValidatedRecords,
  extractSectionScopedRecords,
  validateExtractedRecords,
} from '../../supabase/functions/_shared/canonicalPipeline';

describe('canonical document pipeline', () => {
  it('keeps extraction isolated to the upload section schema', () => {
    const records = extractSectionScopedRecords({
      category: 'offers',
      documentId: 'doc-1',
      uploadSection: 'Offers & Proposals',
      rows: [
        {
          offer_number: 'OFF-001',
          customer_name: 'Acme Corp',
          total_value: '120000',
          currency: 'eur',
          contact_name: 'Jane Smith',
          email: 'jane@acme.com',
        },
      ],
    });

    expect(records).toHaveLength(1);
    expect(records[0].section).toBe('offers');
    expect(records[0].extracted_fields).toMatchObject({
      offer_number: 'OFF-001',
      customer_name: 'Acme Corp',
      total_value: 120000,
      currency: 'EUR',
    });
    expect(records[0].extracted_fields).not.toHaveProperty('email');
    expect(records[0].extracted_fields).not.toHaveProperty('contact_name');
  });

  it('rejects low-confidence or logically invalid records before canonical storage', () => {
    const result = validateExtractedRecords('orders', [
      {
        source_document_id: 'doc-2',
        uploaded_section: 'Sales Data',
        extraction_timestamp: '2026-04-20T10:00:00.000Z',
        confidence_score: 0.92,
        extracted_fields: {
          po_date: '2026-03-01',
          customer_name: 'Acme Corp',
          selling_price: 1000,
          margin: 1200,
          currency: 'EUR',
        },
      },
      {
        source_document_id: 'doc-2',
        uploaded_section: 'Sales Data',
        extraction_timestamp: '2026-04-20T10:00:00.000Z',
        confidence_score: 0.6,
        extracted_fields: {
          po_date: '2026-03-01',
          customer_name: 'Low Confidence Ltd',
          selling_price: 500,
          margin: 50,
          currency: 'EUR',
        },
      },
    ]);

    expect(result.validated).toHaveLength(0);
    expect(result.rejected).toHaveLength(2);
    expect(result.rejected[0].validation_status).toBe('rejected');
    expect(result.rejected[0].validation_issues.join(' ')).toMatch(/margin/i);
    expect(result.rejected[1].validation_issues.join(' ')).toMatch(/confidence/i);
  });

  it('enriches validated records with derived metrics and canonical confidence', () => {
    const enriched = enrichValidatedRecords('offers', [
      {
        id: 'offer-1',
        source_document_id: 'doc-3',
        source_type: 'document_upload',
        extraction_timestamp: '2026-04-20T10:00:00.000Z',
        uploaded_section: 'Offers & Proposals',
        confidence_score: 0.82,
        completeness_score: 0.8,
        consistency_score: 0.9,
        validation_status: 'validated',
        version: 1,
        extracted_fields: {
          offer_number: 'OFF-9',
          customer_name: 'Acme Corp',
          total_value: 200000,
          margin: 50000,
          currency: 'eur',
        },
      },
    ]);

    expect(enriched.records).toHaveLength(1);
    expect(enriched.records[0].data_maturity).toBe('enriched');
    expect(enriched.records[0].derived_metrics).toMatchObject({
      margin_percentage: 25,
    });
    expect(enriched.records[0].confidence_score).toBeGreaterThanOrEqual(0.8);
    expect(enriched.logs).toHaveLength(1);
  });

  it('calculates confidence from the required weighted formula', () => {
    expect(buildConfidenceScore({
      completeness: 0.8,
      consistency: 0.9,
      sourceQuality: 1,
      crossValidation: 0.7,
    })).toBe(0.85);
  });
});
