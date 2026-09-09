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
  | 'change_orders';

export const isWorkspaceSupabaseConfigured =
  !!import.meta.env.VITE_SUPABASE_URL &&
  import.meta.env.VITE_SUPABASE_URL !== 'https://placeholder.supabase.co';

export const getWorkspaceStorageKey = (table: WorkspaceTableName, companyId: string) =>
  `acs_workspace_${table}_${companyId}`;

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
  if (rows.length === 0) {
    localStorage.removeItem(getWorkspaceStorageKey(table, companyId));
    return;
  }
  localStorage.setItem(getWorkspaceStorageKey(table, companyId), JSON.stringify(rows));
}
