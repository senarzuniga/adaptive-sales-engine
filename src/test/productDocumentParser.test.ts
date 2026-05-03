import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseProductsFromWorkbookWithDiagnostics } from '@/lib/productDocumentParser';

describe('product document parser', () => {
  it('extracts one product per sheet for key-value product workbooks', async () => {
    const wb = XLSX.utils.book_new();

    const amrSheet = XLSX.utils.aoa_to_sheet([
      ['Product Name', 'AMR Systems'],
      ['Description', 'Automated material routing solution'],
      ['Category', 'Innovation'],
      ['Unit Price', '200000'],
      ['Currency', 'EUR'],
      ['Cost Breakdown', ''],
      ['Robot arm', '85000'],
      ['Control system', '35000'],
      ['Subproducts', ''],
      ['Conveyor module', 'Included'],
      ['Safety package', 'Included'],
      ['Features', ''],
      ['Throughput', 'High'],
      ['Technical Specs', ''],
      ['Power', '380V'],
    ]);

    const retalSheet = XLSX.utils.aoa_to_sheet([
      ['Name', 'Retal'],
      ['Description', 'Scrap management'],
      ['Type', 'Commodity'],
      ['Price', '90000'],
      ['Comments', 'Fast ROI product'],
    ]);

    XLSX.utils.book_append_sheet(wb, amrSheet, 'AMR Systems');
    XLSX.utils.book_append_sheet(wb, retalSheet, 'Retal');

    const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const fileLike = { arrayBuffer: async () => bytes } as Blob;

    const parsed = await parseProductsFromWorkbookWithDiagnostics(fileLike, 'ingecart_products.xlsx');

    expect(parsed.products.length).toBe(2);
    expect(parsed.diagnostics.length).toBe(2);

    const amr = parsed.products.find((product) => product.sourceSheet === 'AMR Systems');
    const retal = parsed.products.find((product) => product.sourceSheet === 'Retal');

    expect(amr?.name).toBe('AMR Systems');
    expect(amr?.sellingPrice).toBe(200000);
    expect(Array.isArray((amr?.attributes as any)?.costBreakdown)).toBe(true);
    expect(Array.isArray((amr?.attributes as any)?.subproducts)).toBe(true);

    expect(retal?.name).toBe('Retal');
    expect(retal?.sellingPrice).toBe(90000);
  });

  it('captures sheet diagnostics with row/column and headers', async () => {
    const wb = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Product Name', 'Ingetrans'],
      ['Description', 'Strategic flagship'],
      ['Price', '1200000'],
      ['Currency', 'EUR'],
    ]);

    XLSX.utils.book_append_sheet(wb, sheet, 'Ingetrans');

    const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const fileLike = { arrayBuffer: async () => bytes } as Blob;

    const parsed = await parseProductsFromWorkbookWithDiagnostics(fileLike, 'ingecart_products.xlsx');
    expect(parsed.diagnostics[0].sheetName).toBe('Ingetrans');
    expect(parsed.diagnostics[0].rowCount).toBeGreaterThan(0);
    expect(parsed.diagnostics[0].columnCount).toBeGreaterThan(0);
    expect(parsed.diagnostics[0].headers.length).toBeGreaterThan(0);
    expect(parsed.diagnostics[0].previewRows.length).toBeGreaterThan(0);
  });
});
