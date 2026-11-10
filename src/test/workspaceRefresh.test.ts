import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { publishWorkspaceChange, subscribeCompanyStorage, writeWorkspaceRows } from '@/lib/workspaceStorage';
import { recoverMissingIngecartData } from '@/lib/ingecartWorkspaceRecovery';

describe('Company storage synchronization', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

  it('coalesces committed writes, ignores another company and ignores unchanged values', async () => {
    const refreshed = vi.fn();
    const unsubscribe = subscribeCompanyStorage('company-a', refreshed);
    writeWorkspaceRows('offers', 'company-b', [{ id: 'foreign' }]);
    await Promise.resolve();
    expect(refreshed).not.toHaveBeenCalled();
    writeWorkspaceRows('offers', 'company-a', [{ id: 'saved' }]);
    writeWorkspaceRows('offer_items', 'company-a', [{ id: 'item' }]);
    await Promise.resolve();
    expect(refreshed).toHaveBeenCalledTimes(1);
    writeWorkspaceRows('offers', 'company-a', [{ id: 'saved' }]);
    await Promise.resolve();
    expect(refreshed).toHaveBeenCalledTimes(1);
    unsubscribe();
    publishWorkspaceChange('acs_workspace_offers_company-a');
    await Promise.resolve();
    expect(refreshed).toHaveBeenCalledTimes(1);
  });

  it('refreshes cross-tab changes and focus, and not another company key', async () => {
    const refreshed = vi.fn();
    const unsubscribe = subscribeCompanyStorage('company-a', refreshed);
    window.dispatchEvent(new StorageEvent('storage', { key: 'acs_tasks_company-b' }));
    await Promise.resolve();
    expect(refreshed).not.toHaveBeenCalled();
    window.dispatchEvent(new StorageEvent('storage', { key: 'acs_tasks_company-a' }));
    await Promise.resolve();
    window.dispatchEvent(new Event('focus'));
    await Promise.resolve();
    expect(refreshed).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it('restores missing source data but preserves saved edits and explicitly empty datasets', async () => {
    const pack = { companyProfile: { company_name: 'Ingecart 2018 SL' }, orders: [{ customerName: 'Imported' }], tasks: [{ id: 'source-task' }], workspace: { offers: [{ id: 'source-offer', company_id: 'pack-id' }] } };
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => pack });
    vi.stubGlobal('fetch', fetcher);
    localStorage.setItem('acs_orders_actual-id', JSON.stringify([{ customerName: 'User edited' }]));
    localStorage.setItem('acs_tasks_actual-id', '[]');
    await recoverMissingIngecartData('actual-id', 'Ingecart 2018 SL');
    expect(JSON.parse(localStorage.getItem('acs_orders_actual-id')!)[0].customerName).toBe('User edited');
    expect(localStorage.getItem('acs_tasks_actual-id')).toBe('[]');
    expect(JSON.parse(localStorage.getItem('acs_workspace_offers_actual-id')!)[0].company_id).toBe('actual-id');
    await recoverMissingIngecartData('other-id', 'Another company');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('acs_workspace_offers_other-id')).toBeNull();
  });

  it('fails visibly for an invalid snapshot rather than storing another company', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ companyProfile: { company_name: 'Other' }, workspace: { offers: [] } }) }));
    await expect(recoverMissingIngecartData('actual-id', 'Ingecart 2018 SL')).rejects.toThrow('no corresponde');
    expect(localStorage.getItem('acs_workspace_offers_actual-id')).toBeNull();
  });

  it('does not repopulate datasets explicitly cleared by the user', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    localStorage.setItem('acs_ingecart_recovery_disabled_actual-id', 'true');
    await recoverMissingIngecartData('actual-id', 'Ingecart 2018 SL');
    expect(fetcher).not.toHaveBeenCalled();
    expect(localStorage.getItem('acs_workspace_offers_actual-id')).toBeNull();
  });
});