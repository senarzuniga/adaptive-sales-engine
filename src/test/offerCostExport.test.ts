import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { buildOfferCostFileName, buildOfferCostWorkbook } from '@/lib/offerCostExport';
import { DEFAULT_INGECART_POLICY } from '@/lib/utils';

describe('offer cost export', () => {
  const workbook = buildOfferCostWorkbook({
    offer: {
      id: 'offer-1',
      offer_number: 'OFF-2026-138',
      title: 'Sigmaq Guatemala FFG MID LINE PALLETIZER',
      customer_name: 'Sigmaq Guatemala',
      currency: 'EUR',
      offer_total_price: 461701.68,
      contract_value: 461701.68,
      principal_package_price: 391396.21,
    },
    items: [
      { id: 'item-b', item_name: 'FFG MID LINE Palletizer 1U+', quantity: 1, description: 'Main block' },
      { id: 'item-c', item_name: 'MESAS CONVEYOR', quantity: 1, description: 'Conveyor tables' },
      { id: 'item-d', item_name: 'MESA 90 GRADOS', quantity: 1, description: 'Optional 90-degree table' },
    ],
    costRows: [
      { id: 'b1', offer_item_id: 'item-b', category: 'subcontracting', line_item: 'SIFISE - llave en mano, programacion y puesta en marcha', quantity: 1, unit_cost: 184428, total_cost: 191805.12 },
      { id: 'b2', offer_item_id: 'item-b', category: 'materials', line_item: 'KUKA - robot paletizado', quantity: 1, unit_cost: 35871.56, total_cost: 37306.36 },
      { id: 'b3', offer_item_id: 'item-b', category: 'engineering', line_item: 'Direccion ingenieria', hours: 70, total_cost: 3920 },
      { id: 'b4', offer_item_id: 'item-b', category: 'engineering', line_item: 'Ingenieria', hours: 100, total_cost: 4200 },
      { id: 'b5', offer_item_id: 'item-b', category: 'engineering', line_item: 'Direccion ingenieria electrica', hours: 60, total_cost: 3360 },
      { id: 'b6', offer_item_id: 'item-b', category: 'engineering', line_item: 'Gestion de proyecto', hours: 80, total_cost: 6000 },
      { id: 'b7', offer_item_id: 'item-b', category: 'installation', line_item: 'INSTALACION', days: 20, resources: 1, unit_cost: 814, total_cost: 16280 },
      { id: 'b8', offer_item_id: 'item-b', category: 'transport', line_item: 'INSTALACION - travel & expenses', quantity: 1, unit_cost: 5480, total_cost: 5480 },
      { id: 'c1', offer_item_id: 'item-c', category: 'materials', line_item: 'MESA', quantity: 5, unit_cost: 3000, total_cost: 15600 },
      { id: 'c2', offer_item_id: 'item-c', category: 'materials', line_item: 'HORAS FABRICACION', quantity: 24, unit_cost: 70, total_cost: 1680 },
      { id: 'c3', offer_item_id: 'item-c', category: 'materials', line_item: 'HORAS MONTAJE', quantity: 20, unit_cost: 60, total_cost: 1200 },
      { id: 'c4', offer_item_id: 'item-c', category: 'materials', line_item: 'MONTAJE ELECTRICO', quantity: 30, unit_cost: 70, total_cost: 2100 },
      { id: 'd1', offer_item_id: 'item-d', category: 'materials', line_item: 'MESA 90?', quantity: 1, unit_cost: 35000, total_cost: 36400 },
      { id: 'd2', offer_item_id: 'item-d', category: 'materials', line_item: 'HORAS FABRICACION', quantity: 70, unit_cost: 70, total_cost: 4900 },
      { id: 'd3', offer_item_id: 'item-d', category: 'materials', line_item: 'HORAS MONTAJE', quantity: 60, unit_cost: 60, total_cost: 3600 },
      { id: 'd4', offer_item_id: 'item-d', category: 'materials', line_item: 'HORAS ELECTRICO', quantity: 100, unit_cost: 70, total_cost: 7000 },
    ],
    packages: [
      { id: 'pkg-c', name: 'MESAS CONVEYOR', type: 'core', itemIds: ['item-c'], executiveSummary: '', commercialPrice: 27878.35, sortOrder: 1 },
      { id: 'pkg-d', name: 'MESA 90 GRADOS', type: 'optional', itemIds: ['item-d'], executiveSummary: '', commercialPrice: 70305.47, sortOrder: 2 },
    ],
    pricingPolicy: { ...DEFAULT_INGECART_POLICY, materialStructurePct: 0 },
    language: 'es',
  });

  it('builds the expected workbook tabs and formulas', () => {
    expect(workbook.SheetNames).toEqual([
      'Resumen',
      'Costes_A_Bloque_principal',
      'Costes_B_MESAS_CONVEYOR',
      'Costes_C_MESA_90_GRADOS',
      'Servicios',
      'Politicas',
      'Calculo_Precio',
    ]);

    const summary = workbook.Sheets.Resumen;
    expect(summary.A7.v).toBe('A. Bloque principal');
    expect(summary.B9.v).toBe(0);
    expect(summary.C9.v).toBe(51900);
    expect(summary.D9.v).toBe(70305.47);
    expect(summary.C10.f).toContain('SUMPRODUCT');

    const price = workbook.Sheets.Calculo_Precio;
    expect(price.B6.f).toBe('IF(B3=0,0,B5/B3)');
  });

  it('generates a sanitized xlsx filename', () => {
    expect(buildOfferCostFileName({
      offer_number: 'OFF/2026:138',
      customer_name: 'Sigmaq Guatemala',
      title: 'FFG MID LINE PALLETIZER',
    }, 'es')).toBe('OFF_2026_138_Sigmaq_Guatemala_FFG_MID_LINE_PALLETIZER_COSTES_ES.xlsx');
  });

  it('serializes to a valid xlsx buffer', () => {
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
    expect(buffer.byteLength).toBeGreaterThan(2000);
  });
});
