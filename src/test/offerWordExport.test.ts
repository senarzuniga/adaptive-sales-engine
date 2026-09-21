import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Packer } from 'docx';
import { describe, expect, it } from 'vitest';
import { buildOfferWordDocument, buildOfferWordFileName } from '@/lib/offerWordExport';
import type { CompanyProfile, ProductRecord } from '@/store/DataStore';
import { DEFAULT_INGECART_POLICY } from '@/lib/utils';

const company: CompanyProfile = {
  company_name: 'Ingecart Demo',
  industry: 'Automation',
  sub_sector: 'Intralogistics',
  headquarters: 'Madrid',
  operating_regions: 'Europe',
  employee_count: '50',
  annual_revenue: '10000000',
  main_products: 'Palletizers',
  main_customer_segments: 'Industrial',
  main_competitors: 'Global OEMs',
  sales_team_size: '5',
  kam_count: '2',
  sales_channels: 'Direct',
  current_challenges: 'Scale',
  strategic_goals: 'Growth',
  additional_notes: '',
  website_url: 'https://example.com',
  linkedin_url: 'https://linkedin.com/company/example',
  business_description: 'Demo company for offer export tests',
  objectives: 'Win projects',
  strategy_context: 'Key account expansion',
  market_context: 'Competitive market',
  enrichment_status: 'validated',
};

const products: ProductRecord[] = [{
  name: 'HD Palletizer',
  averageValue: 100000,
  type: 'product',
  comments: 'Heavy duty palletizer',
  category: 'product',
  validated: true,
  characteristics: ['Automatic pallet handling', 'Industrial duty execution'],
}];

const exportInput = {
  offer: {
    id: 'offer-1',
    offer_number: 'OFF-2026-001',
    title: 'HD Palletizer Cascade',
    customer_name: 'Sterner Global',
    currency: 'EUR',
    contract_value: 250000,
    project_description: 'Turnkey palletizer supply',
    created_at: '2026-09-14T00:00:00.000Z',
    updated_at: '2026-09-15T00:00:00.000Z',
  },
  items: [{
    id: 'item-1',
    item_name: 'HD Palletizer',
    description: 'Main supply block',
    quantity: 1,
  }],
  costRows: [
    { id: 'c1', offer_item_id: 'item-1', category: 'materials', line_item: 'Turnkey supply', quantity: 1, unit_cost: 180000, total_cost: 180000 },
    { id: 'c2', offer_item_id: 'item-1', category: 'engineering', line_item: 'Engineering', hours: 600, unit_cost: 65, total_cost: 39000 },
    { id: 'c3', offer_item_id: 'item-1', category: 'installation', line_item: 'Installation labour', days: 10, resources: 2, total_cost: 15000 },
    { id: 'c4', offer_item_id: 'item-1', category: 'transport', line_item: 'Travel and logistics', quantity: 1, total_cost: 5000 },
  ],
  scenarios: [{ scenario_type: 'base', selling_price: 275000 }],
  offerScore: { global_score: 82, ai_explanation: 'Balanced pricing and scope coverage.' },
  company,
  products,
  pricingPolicy: DEFAULT_INGECART_POLICY,
};

const loadAsset = (relativePath: string) => ({
  data: new Uint8Array(readFileSync(resolve(process.cwd(), relativePath))),
  type: relativePath.toLowerCase().endsWith('.png') ? 'png' : 'jpg',
} as const);

describe('offer Word export', () => {
  it('builds a non-empty docx buffer from offer data', async () => {
    const document = buildOfferWordDocument(exportInput);
    const buffer = await Packer.toBuffer(document);
    expect(buffer.byteLength).toBeGreaterThan(1000);
  });

  it('embeds the Ingecart header logo and cover image when provided', async () => {
    const baseBuffer = await Packer.toBuffer(buildOfferWordDocument(exportInput));
    const documentWithAssets = buildOfferWordDocument(exportInput, {
      headerLogo: loadAsset('public/offer-assets/ingecart/header-logo.png'),
      coverImage: loadAsset('public/offer-assets/ingecart/cover-reference.jpeg'),
    });
    const assetBuffer = await Packer.toBuffer(documentWithAssets);

    expect(assetBuffer.byteLength).toBeGreaterThan(baseBuffer.byteLength + 50000);
  });

  it('sanitizes the generated filename', () => {
    expect(buildOfferWordFileName({ offer_number: 'OFF/2026:001', customer_name: 'Sterner Global', title: 'Line A*Upgrade?' })).toBe('OFF_2026_001_Sterner_Global_Line_A_Upgrade__EN.docx');
  });

  it('appends the selected language to the generated filename', () => {
    expect(buildOfferWordFileName({ offer_number: 'OFF-2026-138', customer_name: 'Sigmaq Guatemala', title: 'FFG MID LINE PALLETIZER' }, 'es')).toBe('OFF-2026-138_Sigmaq_Guatemala_FFG_MID_LINE_PALLETIZER_ES.docx');
  });

  it('includes principal package row when additional packages are configured', () => {
    const document = buildOfferWordDocument({
      ...exportInput,
      packages: [{
        id: 'pkg-1',
        name: 'Optional package 1',
        type: 'optional',
        itemIds: ['item-1'],
        executiveSummary: 'Optional scope',
        commercialPrice: 90000,
        sortOrder: 1,
      }],
      scenarios: [{ scenario_type: 'base', selling_price: 140000 }],
    });

    const serialized = JSON.stringify(document);
    expect(serialized).toContain('Principal package');
    expect(serialized).toContain('Optional package 1');
  });

  it('renders the selected Spanish language labels', () => {
    const document = buildOfferWordDocument({
      ...exportInput,
      language: 'es',
    });
    const serialized = JSON.stringify(document);
    expect(serialized).toContain('CARTA DE OFERTA');
    expect(serialized).toContain('ALCANCE Y ESTRUCTURA COMERCIAL');
  });

  it('does not expose internal cost labels in the offer document', () => {
    const document = buildOfferWordDocument(exportInput);
    const serialized = JSON.stringify(document);
    expect(serialized).not.toContain('Direct cost');
    expect(serialized).not.toContain('Unit cost');
    expect(serialized).not.toContain('Applied internal policy charges');
  });
});
