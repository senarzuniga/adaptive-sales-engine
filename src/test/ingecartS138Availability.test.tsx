import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LanguageProvider } from '@/i18n/LanguageContext';
import { DataProvider } from '@/store/DataStore';
import OfferPricingPage from '@/pages/OfferPricingPage';
import { readWorkspaceRows } from '@/lib/workspaceStorage';
import rawPack from '../../public/company-packs/Ingecart/ingecart_pack.json?raw';

const pack = JSON.parse(rawPack);
const companyId = 'ingecart-s138-ui';
const number = 'OFF-2026-S138';
const renderPage = () => render(
  <QueryClientProvider client={new QueryClient()}>
    <LanguageProvider><DataProvider><TooltipProvider>
      <MemoryRouter initialEntries={[`/offer-pricing?offer=${number}`]}><OfferPricingPage /></MemoryRouter>
    </TooltipProvider></DataProvider></LanguageProvider>
  </QueryClientProvider>,
);

describe('S138 availability through the real DataStore and offer history', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('acs_companies', JSON.stringify([{ ...pack.companyProfile, id: companyId }]));
    localStorage.setItem('acs_active_company', companyId);
    for (const suffix of ['orders', 'opps', 'products', 'strategy', 'leads', 'contacts', 'tasks']) localStorage.setItem(`acs_${suffix}_${companyId}`, '[]');
    localStorage.setItem(`acs_workspace_offers_${companyId}`, JSON.stringify([{ id: 'existing', offer_number: 'OFF-2026-120', title: 'Unrelated user edit', created_at: '2026-01-01', contract_value: 999 }]));
    localStorage.setItem(`acs_workspace_offer_items_${companyId}`, JSON.stringify([{ id: 'existing-item', offer_id: 'existing' }]));
    localStorage.setItem(`acs_workspace_cost_breakdowns_${companyId}`, JSON.stringify([{ id: 'existing-cost', offer_item_id: 'existing-item', total_cost: 123 }]));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => pack }));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); localStorage.clear(); });

  it('makes S138 and its supplied document available in a genuinely fresh browser profile', async () => {
    localStorage.clear();
    renderPage();
    await screen.findByRole('link', { name: 'Download supplied OFF-2026-S138 Rev3 DOCX' });
    const stored = JSON.parse(localStorage.getItem('acs_companies') || '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].company_name).toBe(pack.companyProfile.company_name);
    expect(localStorage.getItem('acs_active_company')).toBe(stored[0].id);
    expect(readWorkspaceRows<any>('offers', stored[0].id).filter(row => row.offer_number === number)).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: `Edit offer ${number}` }));
    await waitFor(() => expect(screen.getByDisplayValue(number)).toBeInTheDocument());
  }, 30000);

  it('recovers into an existing workspace, exposes a downloadable Rev3, reopens and loads the fixed-price draft', async () => {
    const first = renderPage();
    const link = await screen.findByRole('link', { name: 'Download supplied OFF-2026-S138 Rev3 DOCX' });
    expect(link).toHaveAttribute('href', '/offer-documents/OFF-2026-S138_SAICA_Reposicion_PC_Industrial_Rev3.docx');
    expect(link).toHaveAttribute('download', 'OFF-2026-S138_SAICA_Reposicion_PC_Industrial_Rev3.docx');
    expect(readWorkspaceRows<any>('offers', companyId).find((row) => row.id === 'existing').contract_value).toBe(999);
    first.unmount();
    renderPage();
    await screen.findByRole('link', { name: 'Download supplied OFF-2026-S138 Rev3 DOCX' });
    expect(readWorkspaceRows<any>('offers', companyId).filter((row) => row.offer_number === number)).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: `Edit offer ${number}` }));
    await waitFor(() => expect(screen.getByDisplayValue(number)).toBeInTheDocument());
    await waitFor(() => {
      const draft = JSON.parse(localStorage.getItem(`acs_offer_pricing_draft_${companyId}`) || '{}');
      expect(draft).toMatchObject({ offerKind: 'service', offerTotalPriceOverride: 5450, documentLanguage: 'es' });
      expect(draft.commercialTerms.paymentMilestones).toEqual([]);
      expect(draft.commercialTerms.deliveryMonths).toBe(0);
      expect(draft.commercialTerms.deliveryNotes).toMatch(/2 a 3 semanas/);
      expect(draft.items[0].costLines.find((line: any) => line.category === 'engineering')).toMatchObject({ hours: 40, hourlyRate: 65, totalCost: 2600 });
    });
  }, 30000);

  it('preserves the known existing browser entry while offering the supplied revised document separately', async () => {
    const edited = { id: 'local_5fafac4d-16e3-48b0-b46b-180bd892940e', offer_number: number, title: 'Existing local edits', contract_value: 7502, status: 'draft', created_at: '2026-11-09' };
    localStorage.setItem(`acs_workspace_offers_${companyId}`, JSON.stringify([edited]));
    renderPage();
    await screen.findByRole('link', { name: 'Download supplied OFF-2026-S138 Rev3 DOCX' });
    expect(readWorkspaceRows<any>('offers', companyId).filter((row) => row.offer_number === number)).toEqual([edited]);
    expect(screen.getByText('Existing local edits')).toBeInTheDocument();
  }, 30000);
});