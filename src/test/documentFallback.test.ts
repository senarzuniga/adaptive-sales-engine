import { describe, expect, it } from 'vitest';
import { buildFallbackExtraction } from '@/lib/documentFallback';

describe('buildFallbackExtraction', () => {
  it('extracts basic contact records from CSV when AI is unavailable', () => {
    const result = buildFallbackExtraction(
      { category: 'contacts', fileName: 'contacts.csv', targetTable: 'company_contacts' },
      'name,email,role\nAna Ruiz,ana@example.com,CEO'
    );

    expect(result.record_count).toBe(1);
    expect(result.extracted_records[0].email).toBe('ana@example.com');
    expect(result.summary).toMatch(/basic/i);
  });

  it('normalizes offer revenue and status from document rows', () => {
    const result = buildFallbackExtraction(
      { category: 'offers', fileName: 'offers.csv', targetTable: 'opportunities' },
      'customer_name;status;est_revenue;region\nAcme;GANADO;30.000.000,00 €;Spain'
    );

    expect(result.record_count).toBe(1);
    expect(result.extracted_records[0].status).toBe('won');
    expect(result.extracted_records[0].est_revenue).toBe(30000000);
  });
});
