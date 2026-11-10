import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LanguageProvider } from '@/i18n/LanguageContext';
import { DataProvider } from '@/store/DataStore';
import OfferPricingPage from '@/pages/OfferPricingPage';

const companyId = 'local_offerco';

const seed = () => {
  localStorage.setItem('acs_companies', JSON.stringify([{ id: companyId, company_name: 'OfferCo', enrichment_status: 'pending' }]));
  localStorage.setItem('acs_active_company', companyId);
  localStorage.setItem(`acs_orders_${companyId}`, JSON.stringify([{ oppNumber: 'OFF-2026-080', customerName: 'Cascades', sellingPrice: 1052000, poDate: '2026-02-01', productFamily: 'Palletizer' }]));
  localStorage.setItem(`acs_opps_${companyId}`, JSON.stringify([{ oppNumber: 'OFF-2026-137', customerName: 'Saica', status: 'open', estRevenue: 50000, contractProb: 40 }]));
};

const renderPage = (route = '/offer-pricing') => render(
  <QueryClientProvider client={new QueryClient()}>
    <LanguageProvider>
      <DataProvider>
        <TooltipProvider>
          <MemoryRouter initialEntries={[route]}>
            <OfferPricingPage />
          </MemoryRouter>
        </TooltipProvider>
      </DataProvider>
    </LanguageProvider>
  </QueryClientProvider>,
);

describe('Offer pricing save flow without Supabase', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.clear();
    seed();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
    localStorage.clear();
  });

  it('auto-numbers the offer after the highest existing sequence', async () => {
    renderPage();
    await waitFor(() => expect((screen.getByPlaceholderText('OFF-2026-001') as HTMLInputElement).value).toBe(`OFF-${new Date().getFullYear()}-138`));
  });

  it('creates a new customer with minimal fields and saves the offer into the local workspace', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByPlaceholderText('OFF-2026-001')).toBeTruthy());

    fireEvent.click(screen.getByTitle('Create new customer'));
    fireEvent.change(screen.getByLabelText('Customer name'), { target: { value: 'Pacific Southwest' } });
    fireEvent.change(screen.getByPlaceholderText('Country'), { target: { value: 'USA' } });
    fireEvent.click(screen.getByRole('button', { name: /create & use/i }));

    await waitFor(() => {
      const contacts = JSON.parse(localStorage.getItem(`acs_contacts_${companyId}`) || '[]');
      expect(contacts.some((c: any) => c.companyName === 'Pacific Southwest' && c.country === 'USA')).toBe(true);
    });

    // Add a material cost so the offer has value.
    const materialUnitCost = screen.getAllByLabelText(/unit cost materials/i)[0];
    fireEvent.change(materialUnitCost, { target: { value: '1000' } });
    expect(screen.getAllByRole('spinbutton').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      const offers = JSON.parse(localStorage.getItem(`acs_workspace_offers_${companyId}`) || '[]');
      expect(offers).toHaveLength(1);
      expect(offers[0].customer_name).toBe('Pacific Southwest');
      expect(offers[0].offer_number).toBe(`OFF-${new Date().getFullYear()}-138`);
      expect(offers[0].title).toContain('Pacific Southwest');
      expect(offers[0].total_cost).toBeGreaterThan(1000);
    }, { timeout: 15000 });
    const costRows = JSON.parse(localStorage.getItem(`acs_workspace_cost_breakdowns_${companyId}`) || '[]');
    expect(costRows.some((row: any) => row.category === 'materials' && row.total_cost === 1000)).toBe(true);
  }, 30000);

  it('restores the in-progress draft after reloading the page', async () => {
    const firstRender = renderPage();
    await waitFor(() => expect(screen.getByPlaceholderText('OFF-2026-001')).toBeTruthy());

    fireEvent.change(screen.getByPlaceholderText('E.g: Assembly line'), { target: { value: 'Draft that must survive reload' } });
    fireEvent.change(screen.getAllByLabelText(/unit cost materials/i)[0], { target: { value: '2450' } });

    await waitFor(() => {
      const draft = JSON.parse(localStorage.getItem('acs_offer_pricing_draft_' + companyId) || '{}');
      expect(draft.offerTitle).toBe('Draft that must survive reload');
      expect(draft.items?.[0]?.costLines?.some((line: any) => Number(line.unitCost || 0) === 2450)).toBe(true);
    });

    firstRender.unmount();
    renderPage();

    await waitFor(() => expect((screen.getByPlaceholderText('E.g: Assembly line') as HTMLInputElement).value).toBe('Draft that must survive reload'));
    expect((screen.getAllByLabelText(/unit cost materials/i)[0] as HTMLInputElement).value).toBe('2450');
  }, 30000);

  it('recovers Sigmaq OFF-2026-138 in the Ingecart history and filters it from search', async () => {
    localStorage.clear();
    localStorage.setItem('acs_companies', JSON.stringify([{ id: 'ingecart-demo', company_name: 'Ingecart Demo', enrichment_status: 'validated' }]));
    localStorage.setItem('acs_active_company', 'ingecart-demo');

    renderPage();

    const historyTab = await screen.findByRole('tab', { name: /history/i });
    fireEvent.mouseDown(historyTab, { button: 0 });
    fireEvent.click(historyTab);

    await waitFor(() => expect(screen.getByText('OFF-2026-138')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Search offers'), { target: { value: 'sigmaq guatemala' } });
    expect(screen.getByText('OFF-2026-138')).toBeTruthy();
    expect(screen.getByText('Sigmaq Guatemala FFG MID LINE PALLETIZER')).toBeTruthy();
  }, 30000);

  it('loads OFF-2026-153 into the real Ingecart history from an empty offers list and retains it after reload', async () => {
    localStorage.clear();
    const ingecartId = 'ingecart-2018-sl';
    localStorage.setItem('acs_companies', JSON.stringify([{ id: ingecartId, company_name: 'Ingecart 2018 SL', enrichment_status: 'validated' }]));
    localStorage.setItem('acs_active_company', ingecartId);
    const first = renderPage('/offer-pricing?offer=OFF-2026-153');
    await waitFor(() => expect(screen.getByText('OFF-2026-153')).toBeTruthy());
    expect((screen.getByLabelText('Search offers') as HTMLInputElement).value).toBe('OFF-2026-153');
    fireEvent.change(screen.getByLabelText('Search offers'), { target: { value: 'OFF-2026-153' } });
    expect(screen.getByText('SR1400 104 METROS + RAMPA + INSTALACIÓN')).toBeTruthy();
    const saved = JSON.parse(localStorage.getItem(`acs_workspace_offers_${ingecartId}`)!);
    expect(saved.find((row: any) => row.offer_number === 'OFF-2026-153')).toMatchObject({ contract_value: 165708, customer_name: '', status: 'draft' });
    const product = JSON.parse(localStorage.getItem(`acs_products_${ingecartId}`)!).find((row: any) => row.name === 'SR1400 104 METROS');
    expect(product.estimatedCost).toBe(66520.98);
    first.unmount();
    renderPage();
    const reloadedHistory = await screen.findByRole('tab', { name: /history/i });
    fireEvent.mouseDown(reloadedHistory, { button: 0 });
    fireEvent.click(reloadedHistory);
    await waitFor(() => expect(screen.getByText('OFF-2026-153')).toBeTruthy());
    expect(JSON.parse(localStorage.getItem(`acs_workspace_offers_${ingecartId}`)!).filter((row: any) => row.offer_number === 'OFF-2026-153')).toHaveLength(1);
  }, 30000);

  it('duplicates a cost block with reductions and stores it in repository', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByPlaceholderText('OFF-2026-001')).toBeTruthy());

    fireEvent.change(screen.getAllByLabelText(/unit cost materials/i)[0], { target: { value: '1000' } });
    fireEvent.change(screen.getByLabelText('Base cost reduction (%)'), { target: { value: '20' } });

    fireEvent.click(screen.getByLabelText(/Copy block/i));

    await waitFor(() => {
      const costs = screen
        .getAllByLabelText(/unit cost materials/i)
        .map((input) => Number((input as HTMLInputElement).value));
      expect(costs).toContain(1000);
      expect(costs).toContain(800);
    });

    await waitFor(() => {
      const repository = JSON.parse(localStorage.getItem('acs_offer_block_repository_' + companyId) || '[]');
      expect(repository.length).toBeGreaterThan(0);
      expect(String(repository[0].name)).toContain('(');
      expect(repository[0].item?.type).toBe('product');
    });

    fireEvent.mouseDown(screen.getByRole('tab', { name: /block repository/i }), { button: 0 });
    fireEvent.click(screen.getByRole('tab', { name: /block repository/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /load in builder/i })).toBeTruthy());
  }, 30000);
  it('re-opens a saved offer in the builder and updates it in place', async () => {
    const offerId = 'local-offer-1';
    localStorage.setItem(`acs_workspace_offers_${companyId}`, JSON.stringify([{ id: offerId, company_id: companyId, offer_number: 'OFF-2026-200', title: 'Cascades - Palletizer', customer_name: 'Cascades', currency: 'EUR', status: 'draft', target_margin: 25, created_at: '2026-01-01T00:00:00.000Z', storage: 'local' }]));
    localStorage.setItem(`acs_workspace_offer_items_${companyId}`, JSON.stringify([{ id: 'item-1', offer_id: offerId, item_name: 'HD Palletizer', item_type: 'product', quantity: 1, description: '' }]));
    localStorage.setItem(`acs_workspace_cost_breakdowns_${companyId}`, JSON.stringify([{ id: 'cost-1', offer_item_id: 'item-1', category: 'materials', line_item: 'KUKA robots', quantity: 2, unit_cost: 35871.5, total_cost: 71743, surcharge_pct: 0, structure_pct: 0 }]));
    renderPage();

    const historyTab = await screen.findByRole('tab', { name: /history/i });
    fireEvent.mouseDown(historyTab, { button: 0 });
    fireEvent.click(historyTab);
    fireEvent.click(await screen.findByLabelText('Edit offer OFF-2026-200'));

    await waitFor(() => expect((screen.getByPlaceholderText('OFF-2026-001') as HTMLInputElement).value).toBe('OFF-2026-200'));
    const lineItem = screen.getByDisplayValue('KUKA robots');
    expect(lineItem).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('E.g: Assembly line'), { target: { value: 'Cascades - Dual Palletizer' } });
    fireEvent.click(screen.getByRole('button', { name: /^update$/i }));

    await waitFor(() => {
      const offers = JSON.parse(localStorage.getItem(`acs_workspace_offers_${companyId}`) || '[]');
      expect(offers).toHaveLength(1);
      expect(offers[0].id).toBe(offerId);
      expect(offers[0].title).toBe('Cascades - Dual Palletizer');
      expect(offers[0].offer_number).toBe('OFF-2026-200');
    }, { timeout: 15000 });
    const costRows = JSON.parse(localStorage.getItem(`acs_workspace_cost_breakdowns_${companyId}`) || '[]');
    expect(costRows.filter((row: any) => row.line_item === 'KUKA robots')).toHaveLength(1);
  }, 30000);
});
