export type WorkspaceTableName =
  | 'company_contacts'
  | 'social_media_accounts'
  | 'marketing_content'
  | 'business_intelligence_reports'
  | 'cost_rates'
  | 'offers'
  | 'offer_items'
  | 'cost_breakdowns'
  | 'offer_scenarios'
  | 'offer_scores'
  | 'offer_packages'
  | 'offer_commercial_terms'
  | 'installed_base_assets'
  | 'service_contracts'
  | 'service_interventions'
  | 'after_sales_opportunities'
  | 'spare_parts'
  | 'projects'
  | 'project_phases'
  | 'project_milestones'
  | 'project_risks'
  | 'project_gates'
  | 'project_costs'
  | 'project_pending_points'
  | 'project_management_points'
  | 'change_orders';

export const isWorkspaceSupabaseConfigured =
  !!import.meta.env.VITE_SUPABASE_URL &&
  import.meta.env.VITE_SUPABASE_URL !== 'https://placeholder.supabase.co';

export const getWorkspaceStorageKey = (table: WorkspaceTableName, companyId: string) =>
  `acs_workspace_${table}_${companyId}`;

export const WORKSPACE_CHANGED_EVENT = 'ase-workspace-changed';

export function publishWorkspaceChange(key: string) {
  window.dispatchEvent(new CustomEvent(WORKSPACE_CHANGED_EVENT, { detail: { key } }));
}

/** Same-tab writes, other tabs and returning to the app share one refresh contract. */
export function subscribeCompanyStorage(companyId: string, refresh: () => void): () => void {
  let queued = false;
  let disposed = false;
  const schedule = () => {
    if (queued || disposed) return;
    queued = true;
    queueMicrotask(() => { queued = false; if (!disposed) refresh(); });
  };
  const changed = (event: Event) => {
    const key = event instanceof StorageEvent ? event.key : (event as CustomEvent<{ key: string }>).detail?.key;
    if (!key || key === 'acs_companies' || key.endsWith(`_${companyId}`)) schedule();
  };
  const visible = () => { if (document.visibilityState === 'visible') schedule(); };
  window.addEventListener(WORKSPACE_CHANGED_EVENT, changed);
  window.addEventListener('storage', changed);
  window.addEventListener('focus', schedule);
  document.addEventListener('visibilitychange', visible);
  // Remote mode also reconciles external database edits while the panel stays open.
  const reconciliation = isWorkspaceSupabaseConfigured ? window.setInterval(visible, 30000) : undefined;
  return () => {
    disposed = true;
    window.removeEventListener(WORKSPACE_CHANGED_EVENT, changed);
    window.removeEventListener('storage', changed);
    window.removeEventListener('focus', schedule);
    document.removeEventListener('visibilitychange', visible);
    if (reconciliation !== undefined) window.clearInterval(reconciliation);
  };
}

export function readWorkspaceRows<T = any>(table: WorkspaceTableName, companyId: string | null | undefined): T[] {
  if (!companyId) return [];
  try {
    const raw = localStorage.getItem(getWorkspaceStorageKey(table, companyId));
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

export function writeWorkspaceRows<T = any>(table: WorkspaceTableName, companyId: string | null | undefined, rows: T[]): void {
  if (!companyId) return;
  const key = getWorkspaceStorageKey(table, companyId);
  const value = rows.length ? JSON.stringify(rows) : null;
  if (localStorage.getItem(key) === value) return;
  if (rows.length === 0) {
    localStorage.removeItem(key);
  } else {
    localStorage.setItem(key, value!);
  }
  publishWorkspaceChange(key);
}
