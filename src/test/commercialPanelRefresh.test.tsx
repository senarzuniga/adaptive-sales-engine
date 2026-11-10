import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { DataProvider } from '@/store/DataStore';
import CommercialActionsRepositoryPage from '@/pages/CommercialActionsRepositoryPage';
import { writeWorkspaceRows, readWorkspaceRows } from '@/lib/workspaceStorage';
import rawPack from '../../public/company-packs/Ingecart/ingecart_pack.json?raw';

const pack = JSON.parse(rawPack);
const companyId = 'ingecart-refresh-test';
const openTab = (name: string) => {
  const tab = screen.getByRole('tab', { name });
  fireEvent.mouseDown(tab, { button: 0 }); fireEvent.click(tab);
};

describe('Ingecart commercial panel uses actual data and refreshes after saves', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('acs_companies', JSON.stringify([{ ...pack.companyProfile, id: companyId }]));
    localStorage.setItem('acs_active_company', companyId);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => pack }));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); localStorage.clear(); });

  it('loads the full shipped company datasets and shows a nonzero unfiltered pipeline', async () => {
    render(<MemoryRouter><DataProvider><CommercialActionsRepositoryPage /></DataProvider></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/Oportunidades: 40/)).toBeTruthy());
    expect(screen.getByText(/Leads: 310/)).toBeTruthy();
    expect(screen.getByText(/Contactos: 437/)).toBeTruthy();
    openTab('Pipeline');
    await waitFor(() => expect(Number(screen.getByTestId('pipeline-total-count').textContent)).toBeGreaterThan(0));
    expect(screen.getByText('Todos los KAM')).toBeTruthy();
    expect(screen.getByText('Todas las regiones')).toBeTruthy();
    const drafts = readWorkspaceRows<any>('offers', companyId).filter((row) => row.status === 'draft');
    expect(drafts.some((row) => row.offer_number === 'OFF-2026-153')).toBe(true);
    expect(JSON.parse(localStorage.getItem(`acs_tasks_${companyId}`)!)).toHaveLength(pack.tasks.length + 1);
  });

  it('updates the visible offers list after same-tab and cross-tab saves without remounting', async () => {
    render(<MemoryRouter><DataProvider><CommercialActionsRepositoryPage /></DataProvider></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/Oportunidades: 40/)).toBeTruthy());
    openTab('Ofertas');
    const updated = { id: 'live-update', company_id: companyId, offer_number: 'OFF-2026-LIVE-TEST', title: 'Visible saved update', customer_name: 'Verified test account', status: 'follow_up', contract_value: 123456, probability: 70, kam: 'Ingecart', region: 'Spain' };
    await act(async () => { writeWorkspaceRows('offers', companyId, [...readWorkspaceRows('offers', companyId), updated]); });
    await waitFor(() => expect(screen.getByText('Visible saved update')).toBeTruthy());
    localStorage.setItem(`acs_workspace_offers_${companyId}`, JSON.stringify([...readWorkspaceRows<any>('offers', companyId).filter((row) => row.id !== updated.id), { ...updated, title: 'Cross-tab updated title', contract_value: 654321 }]));
    await act(async () => { window.dispatchEvent(new StorageEvent('storage', { key: `acs_workspace_offers_${companyId}` })); });
    await waitFor(() => expect(screen.getByText('Cross-tab updated title')).toBeTruthy());
    expect(screen.queryByText('Visible saved update')).toBeNull();
  });
});