import { StrictMode } from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataProvider, useData } from '@/store/DataStore';
import { readWorkspaceRows } from '@/lib/workspaceStorage';
import { toast } from '@/hooks/use-toast';
import rawPack from '../../public/company-packs/Ingecart/ingecart_pack.json?raw';

vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));

const pack = JSON.parse(rawPack);
let state: ReturnType<typeof useData>;
function Probe() {
  state = useData();
  return <output data-testid="startup">{state.loadedCompanyId || 'unselected'}</output>;
}
const start = () => render(<StrictMode><DataProvider><Probe /></DataProvider></StrictMode>);
const response = (value = pack) => ({ ok: true, json: async () => value });
const savedCompanies = () => JSON.parse(localStorage.getItem('acs_companies') || '[]');

describe('real local DataProvider startup', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response()));
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); localStorage.clear(); });

  it('imports the canonical profile and S138 once in a fresh StrictMode profile, including concurrent providers', async () => {
    let resolve!: (value: ReturnType<typeof response>) => void;
    vi.mocked(fetch).mockReturnValue(new Promise(resolveFetch => { resolve = resolveFetch; }) as Promise<Response>);
    const first = start();
    start();
    expect(fetch).toHaveBeenCalledTimes(1);
    await act(async () => { resolve(response()); });
    await waitFor(() => expect(screen.getAllByTestId('startup').every(node => node.textContent !== 'unselected')).toBe(true));
    expect(savedCompanies()).toHaveLength(1);
    const [company] = savedCompanies();
    expect(company).toEqual({ ...pack.companyProfile, id: company.id });
    expect(state.activeCompanyId).toBe(company.id);
    expect(localStorage.getItem('acs_active_company')).toBe(company.id);
    const offers = readWorkspaceRows<any>('offers', company.id);
    expect(offers.filter(row => row.offer_number === 'OFF-2026-S138')).toMatchObject([{ company_id: company.id, contract_value: 5450 }]);
    expect(state.data.orders).toHaveLength(pack.orders.length);
    expect(fetch).toHaveBeenCalledTimes(1);
    first.unmount();
    start();
    await waitFor(() => expect(state.loadedCompanyId).toBe(company.id));
    expect(savedCompanies()).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('preserves an intentionally empty company list without fetching', async () => {
    localStorage.setItem('acs_companies', '[]');
    start();
    await act(async () => {});
    expect(savedCompanies()).toEqual([]);
    expect(state.activeCompanyId).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('auto-selects the sole existing other company without importing or modifying its empty datasets', async () => {
    const company = { ...pack.companyProfile, id: 'existing-other', company_name: 'Other business' };
    localStorage.setItem('acs_companies', JSON.stringify([company]));
    localStorage.setItem('acs_orders_existing-other', '[]');
    localStorage.setItem('acs_workspace_offers_existing-other', '[]');
    start();
    await waitFor(() => expect(state.loadedCompanyId).toBe(company.id));
    expect(state.activeCompanyId).toBe(company.id);
    expect(state.data.companyProfile).toEqual(company);
    expect(savedCompanies()).toEqual([company]);
    expect(localStorage.getItem('acs_orders_existing-other')).toBe('[]');
    expect(localStorage.getItem('acs_workspace_offers_existing-other')).toBe('[]');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps an existing Ingecart workspace explicitly cleared by the user empty', async () => {
    const company = { ...pack.companyProfile, id: 'cleared-ingecart' };
    localStorage.setItem('acs_companies', JSON.stringify([company]));
    // clearAll records this opt-out for the existing recovery/configuration flows.
    localStorage.setItem(`acs_ingecart_recovery_disabled_${company.id}`, 'true');
    for (const suffix of ['orders', 'opps', 'products', 'strategy', 'leads', 'contacts', 'tasks']) {
      localStorage.setItem(`acs_${suffix}_${company.id}`, '[]');
    }
    localStorage.setItem(`acs_workspace_offers_${company.id}`, '[]');
    start();
    await waitFor(() => expect(state.loadedCompanyId).toBe(company.id));
    expect(savedCompanies()).toEqual([company]);
    expect(readWorkspaceRows('offers', company.id)).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps an existing active selection when multiple other companies are stored', async () => {
    const companies = ['one', 'two'].map(id => ({ ...pack.companyProfile, id, company_name: id }));
    localStorage.setItem('acs_companies', JSON.stringify(companies));
    localStorage.setItem('acs_active_company', 'two');
    start();
    await waitFor(() => expect(state.loadedCompanyId).toBe('two'));
    expect(state.activeCompanyId).toBe('two');
    expect(savedCompanies()).toEqual(companies);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not choose or add a company when multiple companies are stored without a selection', async () => {
    const companies = ['one', 'two'].map(id => ({ ...pack.companyProfile, id, company_name: id }));
    localStorage.setItem('acs_companies', JSON.stringify(companies));
    start();
    await waitFor(() => expect(state.companies).toHaveLength(2));
    expect(state.activeCompanyId).toBeNull();
    expect(savedCompanies()).toEqual(companies);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(['[]', JSON.stringify([{ ...pack.companyProfile, id: 'new-company', company_name: 'Created during fetch' }])])(
    'honors a company-list write during the pending bootstrap fetch (%s)', async (stored) => {
      let resolve!: (value: ReturnType<typeof response>) => void;
      vi.mocked(fetch).mockReturnValue(new Promise(resolveFetch => { resolve = resolveFetch; }) as Promise<Response>);
      start();
      localStorage.setItem('acs_companies', stored);
      await act(async () => { resolve(response()); });
      expect(localStorage.getItem('acs_companies')).toBe(stored);
      expect(localStorage.getItem('acs_workspace_offers_ingecart-pack')).toBeNull();
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );

  it('does not resurrect a company deleted after bootstrap on the next mount', async () => {
    const view = start();
    await waitFor(() => expect(state.loadedCompanyId).not.toBeNull());
    await act(async () => { await state.deleteCompany(state.activeCompanyId!); });
    view.unmount();
    start();
    await act(async () => {});
    expect(savedCompanies()).toEqual([]);
    expect(state.activeCompanyId).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each(['http', 'invalid', 'network'])('reports %s failures without creating a fallback company and permits a later retry', async (failure) => {
    if (failure === 'http') vi.mocked(fetch).mockResolvedValue({ ok: false, status: 404 } as Response);
    else if (failure === 'invalid') vi.mocked(fetch).mockResolvedValue(response({ ...pack, companyProfile: { company_name: 'Not Ingecart' } }) as Response);
    else vi.mocked(fetch).mockRejectedValue(new Error('Offline'));
    const view = start();
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Snapshot Ingecart no disponible', variant: 'destructive' })));
    expect(localStorage.getItem('acs_companies')).toBeNull();
    expect(state.activeCompanyId).toBeNull();
    view.unmount();
    vi.mocked(fetch).mockResolvedValue(response() as Response);
    start();
    await waitFor(() => expect(state.loadedCompanyId).not.toBeNull());
    expect(savedCompanies()).toHaveLength(1);
  });
});