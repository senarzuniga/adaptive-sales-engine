import { StrictMode } from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from } }));
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); localStorage.clear(); });

it('does not bootstrap an empty Supabase account or write local companies in remote mode', async () => {
  localStorage.clear();
  vi.stubEnv('VITE_SUPABASE_URL', 'https://configured.supabase.co');
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  from.mockReturnValue({ select: () => ({ order: async () => ({ data: [] }) }) });
  const { DataProvider, useData, isSupabaseConfigured } = await import('@/store/DataStore');
  expect(isSupabaseConfigured).toBe(true);
  let state: ReturnType<typeof useData>;
  function Probe() { state = useData(); return null; }
  render(<StrictMode><DataProvider><Probe /></DataProvider></StrictMode>);
  await waitFor(() => expect(from).toHaveBeenCalledWith('companies'));
  expect(from.mock.calls.every(([table]) => table === 'companies')).toBe(true);
  expect(fetch).not.toHaveBeenCalled();
  expect(localStorage.getItem('acs_companies')).toBeNull();
  expect(localStorage.getItem('acs_active_company')).toBeNull();
  expect(state!.activeCompanyId).toBeNull();
});