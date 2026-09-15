import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

const renderPage = () => render(
  <QueryClientProvider client={new QueryClient()}>
    <LanguageProvider>
      <DataProvider>
        <TooltipProvider>
          <MemoryRouter initialEntries={['/offer-pricing']}>
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
    const qtyInputs = screen.getAllByRole('spinbutton');
    // First item, Comercio category: quantity input is followed by unit cost input.
    const comercioSection = screen.getAllByText('Comercio')[0].closest('div')?.parentElement as HTMLElement;
    const inputs = within(comercioSection).getAllByRole('spinbutton');
    fireEvent.change(inputs[1], { target: { value: '1000' } });
    expect(qtyInputs.length).toBeGreaterThan(0);

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
