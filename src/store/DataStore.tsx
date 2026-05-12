import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { buildCommercialIntelligence, harmonizeCommercialRecords } from '@/lib/commercialIntelligence';
import { dedupeOpportunities, dedupeOrders, normalizeOpportunityStatus, parseFlexibleNumber } from '@/lib/salesData';
import { inferProductCategory, parseProductComments, serializeProductComments, type ProductCategory } from '@/lib/productCatalog';

// ─── Offline / localStorage mode when Supabase is not configured ───
const isSupabaseConfigured =
  !!import.meta.env.VITE_SUPABASE_URL &&
  import.meta.env.VITE_SUPABASE_URL !== 'https://placeholder.supabase.co';

const LS = {
  get: <T,>(key: string, fallback: T): T => {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  },
  set: <T,>(key: string, val: T) => {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* storage full */ }
  },
  del: (key: string) => localStorage.removeItem(key),
};

type WorkspaceTableName =
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
  | 'after_sales_opportunities'
  | 'spare_parts';

type WorkspacePack = Partial<Record<WorkspaceTableName, any[]>>;

const WORKSPACE_TABLES: WorkspaceTableName[] = [
  'company_contacts',
  'social_media_accounts',
  'marketing_content',
  'business_intelligence_reports',
  'cost_rates',
  'offers',
  'offer_items',
  'cost_breakdowns',
  'offer_scenarios',
  'offer_scores',
  'installed_base_assets',
  'service_contracts',
  'after_sales_opportunities',
  'spare_parts',
];

const lsWorkspaceKey = (table: WorkspaceTableName, companyId: string) => `acs_workspace_${table}_${companyId}`;

const readLocalWorkspacePack = (companyId: string): WorkspacePack =>
  WORKSPACE_TABLES.reduce<WorkspacePack>((acc, table) => {
    const rows = LS.get<any[]>(lsWorkspaceKey(table, companyId), []);
    if (rows.length > 0) acc[table] = rows;
    return acc;
  }, {});

const writeLocalWorkspacePack = (companyId: string, workspace: WorkspacePack = {}) => {
  WORKSPACE_TABLES.forEach((table) => {
    const rows = workspace[table] || [];
    if (rows.length > 0) {
      LS.set(lsWorkspaceKey(table, companyId), rows);
    } else {
      LS.del(lsWorkspaceKey(table, companyId));
    }
  });
};

// ─── Types ───
export interface CompanyProfile {
  id?: string;
  company_name: string;
  industry: string;
  sub_sector: string;
  headquarters: string;
  operating_regions: string;
  employee_count: string;
  annual_revenue: string;
  main_products: string;
  main_customer_segments: string;
  main_competitors: string;
  sales_team_size: string;
  kam_count: string;
  sales_channels: string;
  current_challenges: string;
  strategic_goals: string;
  additional_notes: string;
  website_url: string;
  linkedin_url: string;
  business_description: string;
  objectives: string;
  strategy_context: string;
  market_context: string;
  enrichment_status: string;
}

export interface OrderRecord {
  id?: string;
  truthSource?: string;
  poDate: string;
  firstOfferDate: string;
  oppNumber: string;
  region: string;
  country: string;
  customerName: string;
  scope: string;
  productFamily: string;
  segment: string;
  purchasingYear: string;
  purchasingQuarter: string;
  purchasingMonth: string;
  sellingPrice: number;
  margin: number;
  kam: string;
}

export interface OpportunityRecord {
  truthSource?: string;
  oppNumber: string;
  status: string;
  region: string;
  country: string;
  customerName: string;
  scope: string;
  productFamily: string;
  segment: string;
  estPurchasingYear: string;
  estPurchasingQuarter: string;
  estRevenue: number;
  contractProb: number;
  margin: number;
  contact: string;
  kam: string;
}

export interface ProductRecord {
  name: string;
  averageValue: number;
  type: string;
  comments: string;
  category?: ProductCategory;
  characteristics?: string[];
  estimatedCost?: number;
  repositories?: string[];
  validated?: boolean;
  source?: 'manual' | 'generated';
}

export interface StrategyRecord {
  productFamily: string;
  numberOfSegment: string;
  region: string;
  estPurchasingQuarter: string;
  estRevenue: number;
  margin: number;
  kam: string;
}

export interface LeadRecord {
  leadName: string;
  companyName: string;
  email: string;
  phone: string;
  region: string;
  country: string;
  sector: string;
  status: string;
  source: string;
  owner: string;
  estimatedValue: number;
  notes: string;
}

export interface ContactRecord {
  name: string;
  email: string;
  phone: string;
  role: string;
  department: string;
  companyName: string;
  region: string;
  country: string;
  kam: string;
  notes: string;
}

export type TaskPillar = 'p0' | 'p1' | 'p2' | 'p3' | 'p4' | 'p5' | 'p6' | 'general';
export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type TaskCategory = 'analysis' | 'follow_up' | 'loyalty' | 'cross_sell' | 'strategy' | 'data' | 'meeting' | 'report';

export interface ActionContent {
  goal: string;
  callScript: string;
  emailTemplate: string;
  presentationNotes: string;
}

export interface ActionResult {
  outcome: string;
  timestamp: string;
  aiAnalysis: string;
  alignmentScore: number;
  recommendations: string[];
}

export interface MonitoringTask {
  id: string;
  title: string;
  description: string;
  pillar: TaskPillar;
  status: TaskStatus;
  priority: TaskPriority;
  category: TaskCategory;
  assignee: string;
  dueDate: string;
  createdAt: string;
  completedAt?: string;
  notes: string[];
  actionContent: ActionContent;
  actionResult?: ActionResult;
}

export interface UploadLogEntry {
  id: string;
  fileName: string;
  detectedType: string;
  rowCount: number;
  status: 'validated' | 'error';
  errors: string[];
  timestamp: string;
}

// ─── DB ↔ App mappers ───
function dbToOrder(r: any): OrderRecord {
  return {
    id: r.id, truthSource: r.truth_source || 'sales_document', poDate: r.po_date || '', firstOfferDate: r.first_offer_date || '',
    oppNumber: r.opp_number || '', region: r.region || '', country: r.country || '',
    customerName: r.customer_name || '', scope: r.scope || '', productFamily: r.product_family || '',
    segment: r.segment || '', purchasingYear: r.purchasing_year || '',
    purchasingQuarter: r.purchasing_quarter || '', purchasingMonth: r.purchasing_month || '',
    sellingPrice: parseFlexibleNumber(r.selling_price), margin: parseFlexibleNumber(r.margin), kam: r.kam || '',
  };
}

function dbToOpportunity(r: any): OpportunityRecord {
  const contractProb = parseFlexibleNumber(r.contract_prob);
  return {
    truthSource: r.truth_source || 'sales_document',
    oppNumber: r.opp_number || '', status: contractProb >= 100 ? 'won' : normalizeOpportunityStatus(r.status), region: r.region || '',
    country: r.country || '', customerName: r.customer_name || '', scope: r.scope || '',
    productFamily: r.product_family || '', segment: r.segment || '',
    estPurchasingYear: r.est_purchasing_year || '', estPurchasingQuarter: r.est_purchasing_quarter || '',
    estRevenue: parseFlexibleNumber(r.est_revenue), contractProb: parseFlexibleNumber(r.contract_prob),
    margin: parseFlexibleNumber(r.margin), contact: r.contact || '', kam: r.kam || '',
  };
}

function dbToProduct(r: any): ProductRecord {
  const parsed = parseProductComments(r.comments || '');
  return {
    name: r.name || '',
    averageValue: parseFlexibleNumber(r.average_value),
    type: r.type || '',
    comments: parsed.notes,
    category: inferProductCategory(r.type, parsed.meta.category),
    characteristics: parsed.meta.characteristics || [],
    estimatedCost: parseFlexibleNumber(parsed.meta.estimatedCost),
    repositories: parsed.meta.repositories || [],
    validated: Boolean(parsed.meta.validated),
    source: parsed.meta.source || 'manual',
  };
}

function dbToStrategy(r: any): StrategyRecord {
  return {
    productFamily: r.product_family || '', numberOfSegment: r.number_of_segment || '',
    region: r.region || '', estPurchasingQuarter: r.est_purchasing_quarter || '',
    estRevenue: parseFlexibleNumber(r.est_revenue), margin: parseFlexibleNumber(r.margin), kam: r.kam || '',
  };
}

function dbToTask(r: any): MonitoringTask {
  const ac = r.action_content as any || {};
  const ar = r.action_result as any;
  return {
    id: r.id, title: r.title, description: r.description || '',
    pillar: r.pillar as TaskPillar, status: r.status as TaskStatus,
    priority: r.priority as TaskPriority, category: r.category as TaskCategory,
    assignee: r.assignee || '', dueDate: r.due_date || '', createdAt: r.created_at,
    completedAt: r.completed_at || undefined, notes: (r.notes as string[]) || [],
    actionContent: { goal: ac.goal || '', callScript: ac.callScript || '', emailTemplate: ac.emailTemplate || '', presentationNotes: ac.presentationNotes || '' },
    actionResult: ar ? { outcome: ar.outcome, timestamp: ar.timestamp, aiAnalysis: ar.aiAnalysis, alignmentScore: ar.alignmentScore, recommendations: ar.recommendations || [] } : undefined,
  };
}

async function fetchWorkspacePack(companyId: string): Promise<WorkspacePack> {
  if (!isSupabaseConfigured) {
    return readLocalWorkspacePack(companyId);
  }

  const [
    companyContactsRes,
    socialAccountsRes,
    marketingContentRes,
    businessReportsRes,
    costRatesRes,
    offersRes,
    installedAssetsRes,
    serviceContractsRes,
    afterSalesOppsRes,
    sparePartsRes,
  ] = await Promise.all([
    supabase.from('company_contacts').select('*').eq('company_id', companyId).order('department', { ascending: true }),
    supabase.from('social_media_accounts').select('*').eq('company_id', companyId).order('platform', { ascending: true }),
    supabase.from('marketing_content').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
    supabase.from('business_intelligence_reports').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
    supabase.from('cost_rates').select('*').eq('company_id', companyId).order('rate_name', { ascending: true }),
    supabase.from('offers').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
    supabase.from('installed_base_assets').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
    supabase.from('service_contracts').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
    supabase.from('after_sales_opportunities').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
    supabase.from('spare_parts').select('*').eq('company_id', companyId).order('part_name', { ascending: true }),
  ]);

  const offers = (offersRes.data || []) as any[];
  const offerIds = offers.map((offer) => offer.id).filter(Boolean);
  const offerItemsRes = offerIds.length > 0
    ? await supabase.from('offer_items').select('*').in('offer_id', offerIds)
    : { data: [] };
  const offerItemIds = ((offerItemsRes.data || []) as any[]).map((item) => item.id).filter(Boolean);
  const [costBreakdownsRes, offerScenariosRes, offerScoresRes] = await Promise.all([
    offerItemIds.length > 0
      ? supabase.from('cost_breakdowns').select('*').in('offer_item_id', offerItemIds)
      : Promise.resolve({ data: [] }),
    offerIds.length > 0
      ? supabase.from('offer_scenarios').select('*').in('offer_id', offerIds)
      : Promise.resolve({ data: [] }),
    offerIds.length > 0
      ? supabase.from('offer_scores').select('*').in('offer_id', offerIds)
      : Promise.resolve({ data: [] }),
  ]);

  return {
    company_contacts: (companyContactsRes.data || []) as any[],
    social_media_accounts: (socialAccountsRes.data || []) as any[],
    marketing_content: (marketingContentRes.data || []) as any[],
    business_intelligence_reports: (businessReportsRes.data || []) as any[],
    cost_rates: (costRatesRes.data || []) as any[],
    offers,
    offer_items: (offerItemsRes.data || []) as any[],
    cost_breakdowns: (costBreakdownsRes.data || []) as any[],
    offer_scenarios: (offerScenariosRes.data || []) as any[],
    offer_scores: (offerScoresRes.data || []) as any[],
    installed_base_assets: (installedAssetsRes.data || []) as any[],
    service_contracts: (serviceContractsRes.data || []) as any[],
    after_sales_opportunities: (afterSalesOppsRes.data || []) as any[],
    spare_parts: (sparePartsRes.data || []) as any[],
  };
}

// ─── State ───
interface DataState {
  orders: OrderRecord[];
  opportunities: OpportunityRecord[];
  products: ProductRecord[];
  strategy: StrategyRecord[];
  leads: LeadRecord[];
  contacts: ContactRecord[];
  companyProfile: CompanyProfile;
  uploadLog: UploadLogEntry[];
  tasks: MonitoringTask[];
  entityRegistries: NormalizedEntityRegistries;
  qualityReports: DatasetQualityReport[];
  enrichedProfiles: EnrichedCompanyProfile[];
}

const emptyProfile: CompanyProfile = {
  company_name: '', industry: '', sub_sector: '', headquarters: '',
  operating_regions: '', employee_count: '', annual_revenue: '', main_products: '',
  main_customer_segments: '', main_competitors: '', sales_team_size: '', kam_count: '',
  sales_channels: '', current_challenges: '', strategic_goals: '', additional_notes: '',
  website_url: '', linkedin_url: '', business_description: '', objectives: '',
  strategy_context: '', market_context: '', enrichment_status: 'pending',
};

const emptyRegistries: NormalizedEntityRegistries = {
  companies: {},
  customers: {},
  products: {},
  contacts: {},
};

interface DataContextType {
  data: DataState;
  companies: CompanyProfile[];
  activeCompanyId: string | null;
  setActiveCompany: (id: string | null) => void;
  loadCompanies: () => Promise<void>;
  createCompany: (name: string, websiteUrl?: string, linkedinUrl?: string, businessDescription?: string) => Promise<string | null>;
  triggerEnrichment: (companyId: string) => Promise<void>;
  deleteCompany: (id: string) => Promise<void>;
  exportCompanyPack: () => Promise<string>;
  importCompanyPack: (json: string) => Promise<void>;
  setOrders: (records: OrderRecord[]) => void;
  setOpportunities: (records: OpportunityRecord[]) => void;
  setProducts: (records: ProductRecord[]) => void;
  setStrategy: (records: StrategyRecord[]) => void;
  setLeads: (records: LeadRecord[]) => void;
  setContacts: (records: ContactRecord[]) => void;
  setCompanyProfile: (profile: CompanyProfile) => void;
  setDataManagementResults: (registries: NormalizedEntityRegistries, qualityReports: DatasetQualityReport[]) => void;
  setEnrichedProfiles: (profiles: EnrichedCompanyProfile[]) => void;
  addUploadLog: (entry: UploadLogEntry) => void;
  addTask: (task: MonitoringTask) => void;
  updateTask: (id: string, updates: Partial<MonitoringTask>) => void;
  deleteTask: (id: string) => void;
  clearDataset: (key: 'orders' | 'opportunities' | 'products' | 'strategy' | 'leads' | 'contacts') => void;
  clearAll: () => void;
  hasData: boolean;
  loading: boolean;
  commercialSnapshot: ReturnType<typeof buildCommercialIntelligence>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DataState>({
    orders: [],
    opportunities: [],
    products: [],
    strategy: [],
    leads: [],
    contacts: [],
    companyProfile: emptyProfile,
    uploadLog: [],
    tasks: [],
    entityRegistries: emptyRegistries,
    qualityReports: [],
    enrichedProfiles: [],
  });
  const [companies, setCompanies] = useState<CompanyProfile[]>([]);
  const [activeCompanyId, setActiveCompanyIdState] = useState<string | null>(
    localStorage.getItem('acs_active_company') || null
  );
  const [loading, setLoading] = useState(false);

  const commercialSnapshot = useMemo(() => buildCommercialIntelligence({
    company: data.companyProfile,
    orders: data.orders,
    opportunities: data.opportunities,
    products: data.products,
    strategy: data.strategy,
  }), [data.companyProfile, data.orders, data.opportunities, data.products, data.strategy]);

  // ─── Load companies list ───
  const loadCompanies = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setCompanies(LS.get<CompanyProfile[]>('acs_companies', []));
      return;
    }
    const { data: rows } = await supabase.from('companies').select('*').order('company_name');
    if (rows) {
      setCompanies(rows.map(r => ({
        id: r.id, company_name: r.company_name, industry: r.industry || '', sub_sector: r.sub_sector || '',
        headquarters: r.headquarters || '', operating_regions: r.operating_regions || '',
        employee_count: r.employee_count || '', annual_revenue: r.annual_revenue || '',
        main_products: r.main_products || '', main_customer_segments: r.main_customer_segments || '',
        main_competitors: r.main_competitors || '', sales_team_size: r.sales_team_size || '',
        kam_count: r.kam_count || '', sales_channels: r.sales_channels || '',
        current_challenges: r.current_challenges || '', strategic_goals: r.strategic_goals || '',
        additional_notes: r.additional_notes || '',
        website_url: r.website_url || '', linkedin_url: r.linkedin_url || '',
        business_description: r.business_description || '', objectives: r.objectives || '',
        strategy_context: r.strategy_context || '', market_context: r.market_context || '',
        enrichment_status: r.enrichment_status || 'pending',
      })));
    }
  }, []);

  // ─── Load company data ───
  const loadCompanyData = useCallback(async (companyId: string) => {
    setLoading(true);
    try {
      if (!isSupabaseConfigured) {
        const companies = LS.get<CompanyProfile[]>('acs_companies', []);
        const profile = companies.find(c => c.id === companyId) || emptyProfile;
        setData({
          orders: dedupeOrders(LS.get(`acs_orders_${companyId}`, [])),
          opportunities: dedupeOpportunities(LS.get(`acs_opps_${companyId}`, [])),
          products: LS.get(`acs_products_${companyId}`, []),
          strategy: LS.get(`acs_strategy_${companyId}`, []),
          leads: LS.get(`acs_leads_${companyId}`, []),
          contacts: LS.get(`acs_contacts_${companyId}`, []),
          tasks: LS.get(`acs_tasks_${companyId}`, []),
          uploadLog: LS.get(`acs_log_${companyId}`, []),
          companyProfile: profile,
          entityRegistries: LS.get(`acs_registries_${companyId}`, emptyRegistries),
          qualityReports: LS.get(`acs_quality_${companyId}`, []),
          enrichedProfiles: LS.get(`acs_enriched_${companyId}`, []),
        });
        return;
      }
      const [ordersRes, oppsRes, prodsRes, stratRes, tasksRes, logRes, compRes] = await Promise.all([
        supabase.from('orders').select('*').eq('company_id', companyId),
        supabase.from('opportunities').select('*').eq('company_id', companyId),
        supabase.from('products').select('*').eq('company_id', companyId),
        supabase.from('strategy').select('*').eq('company_id', companyId),
        supabase.from('tasks').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
        supabase.from('upload_log').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).limit(50),
        supabase.from('companies').select('*').eq('id', companyId).single(),
      ]);

      setData({
        orders: dedupeOrders((ordersRes.data || []).map(dbToOrder)),
        opportunities: dedupeOpportunities((oppsRes.data || []).map(dbToOpportunity)),
        products: (prodsRes.data || []).map(dbToProduct),
        strategy: (stratRes.data || []).map(dbToStrategy),
        leads: [],
        contacts: [],
        tasks: (tasksRes.data || []).map(dbToTask),
        uploadLog: (logRes.data || []).map(r => ({
          id: r.id, fileName: r.file_name, detectedType: r.detected_type,
          rowCount: r.row_count || 0, status: r.status as 'validated' | 'error',
          errors: (r.errors as string[]) || [], timestamp: r.created_at,
        })),
        entityRegistries: emptyRegistries,
        qualityReports: [],
        enrichedProfiles: [],
        companyProfile: compRes.data ? {
          id: compRes.data.id, company_name: compRes.data.company_name,
          industry: compRes.data.industry || '', sub_sector: compRes.data.sub_sector || '',
          headquarters: compRes.data.headquarters || '', operating_regions: compRes.data.operating_regions || '',
          employee_count: compRes.data.employee_count || '', annual_revenue: compRes.data.annual_revenue || '',
          main_products: compRes.data.main_products || '', main_customer_segments: compRes.data.main_customer_segments || '',
          main_competitors: compRes.data.main_competitors || '', sales_team_size: compRes.data.sales_team_size || '',
          kam_count: compRes.data.kam_count || '', sales_channels: compRes.data.sales_channels || '',
          current_challenges: compRes.data.current_challenges || '', strategic_goals: compRes.data.strategic_goals || '',
          additional_notes: compRes.data.additional_notes || '',
          website_url: compRes.data.website_url || '', linkedin_url: compRes.data.linkedin_url || '',
          business_description: compRes.data.business_description || '', objectives: compRes.data.objectives || '',
          strategy_context: compRes.data.strategy_context || '', market_context: compRes.data.market_context || '',
          enrichment_status: compRes.data.enrichment_status || 'pending',
        } : emptyProfile,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Set active company ───
  const setActiveCompany = useCallback((id: string | null) => {
    setActiveCompanyIdState(id);
    if (id) {
      localStorage.setItem('acs_active_company', id);
      loadCompanyData(id);
    } else {
      localStorage.removeItem('acs_active_company');
      setData({
        orders: [],
        opportunities: [],
        products: [],
        strategy: [],
        leads: [],
        contacts: [],
        companyProfile: emptyProfile,
        uploadLog: [],
        tasks: [],
        entityRegistries: emptyRegistries,
        qualityReports: [],
        enrichedProfiles: [],
      });
    }
  }, [loadCompanyData]);

  // ─── Create company ───
  const createCompany = useCallback(async (name: string, websiteUrl?: string, linkedinUrl?: string, businessDescription?: string): Promise<string | null> => {
    if (!isSupabaseConfigured) {
      const newId = `local_${Date.now()}`;
      const newCompany: CompanyProfile = {
        ...emptyProfile, id: newId, company_name: name,
        website_url: websiteUrl || '', linkedin_url: linkedinUrl || '',
        business_description: businessDescription || '',
      };
      const existing = LS.get<CompanyProfile[]>('acs_companies', []);
      LS.set('acs_companies', [...existing, newCompany]);
      await loadCompanies();
      return newId;
    }
    const insertData: any = { company_name: name };
    if (websiteUrl) insertData.website_url = websiteUrl;
    if (linkedinUrl) insertData.linkedin_url = linkedinUrl;
    if (businessDescription) insertData.business_description = businessDescription;
    const { data: row, error } = await supabase.from('companies').insert(insertData).select().single();
    if (error) { toast({ title: 'Error creating company', description: error.message, variant: 'destructive' }); return null; }
    await loadCompanies();
    return row.id;
  }, [loadCompanies]);

  // ─── Trigger AI enrichment ───
  const triggerEnrichment = useCallback(async (companyId: string) => {
    try {
      await supabase.from('companies').update({ enrichment_status: 'enriching' }).eq('id', companyId);
      const { error } = await supabase.functions.invoke('enrich-company', { body: { companyId } });
      if (error) throw error;
      // Reload company data to reflect enrichment results
      await loadCompanyData(companyId);
      await loadCompanies();
      toast({ title: 'Company enrichment completed', description: 'AI has gathered and stored company intelligence.' });
    } catch (e: any) {
      await supabase.from('companies').update({ enrichment_status: 'failed' }).eq('id', companyId);
      toast({ title: 'Enrichment failed', description: e.message, variant: 'destructive' });
    }
  }, [loadCompanyData, loadCompanies]);

  // ─── Delete company ───
  const deleteCompany = useCallback(async (id: string) => {
    if (!isSupabaseConfigured) {
      const existing = LS.get<CompanyProfile[]>('acs_companies', []);
      LS.set('acs_companies', existing.filter(c => c.id !== id));
      ['orders', 'opps', 'products', 'strategy', 'leads', 'contacts', 'tasks', 'log', 'registries', 'quality', 'enriched'].forEach(k => LS.del(`acs_${k}_${id}`));
      writeLocalWorkspacePack(id, {});
      if (activeCompanyId === id) setActiveCompany(null);
      await loadCompanies();
      return;
    }
    await supabase.from('companies').delete().eq('id', id);
    if (activeCompanyId === id) setActiveCompany(null);
    await loadCompanies();
  }, [activeCompanyId, setActiveCompany, loadCompanies]);

  // ─── Export / Import ───
  const exportCompanyPack = useCallback(async (): Promise<string> => {
    const workspace = activeCompanyId ? await fetchWorkspacePack(activeCompanyId) : {};
    return JSON.stringify({
      companyProfile: data.companyProfile,
      orders: data.orders,
      opportunities: data.opportunities,
      products: data.products,
      strategy: data.strategy,
      leads: data.leads,
      contacts: data.contacts,
      tasks: data.tasks,
      entityRegistries: data.entityRegistries,
      qualityReports: data.qualityReports,
      enrichedProfiles: data.enrichedProfiles,
      workspace,
    }, null, 2);
  }, [activeCompanyId, data]);

  const importCompanyPack = useCallback(async (json: string) => {
    const pack = JSON.parse(json);
    const workspace: WorkspacePack = pack.workspace || {};
    const companyName = pack.companyProfile?.company_name || 'Imported Company';
    const id = await createCompany(companyName,
      pack.companyProfile?.website_url, pack.companyProfile?.linkedin_url,
      pack.companyProfile?.business_description);
    if (!id) return;

    if (!isSupabaseConfigured) {
      // Merge all profile fields into the newly created local company
      const existing = LS.get<CompanyProfile[]>('acs_companies', []);
      LS.set('acs_companies', existing.map(c => c.id === id ? { ...c, ...pack.companyProfile, id } : c));
      if (pack.orders?.length) LS.set(`acs_orders_${id}`, pack.orders);
      if (pack.opportunities?.length) LS.set(`acs_opps_${id}`, pack.opportunities);
      if (pack.products?.length) LS.set(`acs_products_${id}`, pack.products);
      if (pack.strategy?.length) LS.set(`acs_strategy_${id}`, pack.strategy);
      if (pack.leads?.length) LS.set(`acs_leads_${id}`, pack.leads);
      if (pack.contacts?.length) LS.set(`acs_contacts_${id}`, pack.contacts);
      if (pack.tasks?.length) LS.set(`acs_tasks_${id}`, pack.tasks);
      if (pack.entityRegistries) LS.set(`acs_registries_${id}`, pack.entityRegistries);
      if (pack.qualityReports?.length) LS.set(`acs_quality_${id}`, pack.qualityReports);
      if (pack.enrichedProfiles?.length) LS.set(`acs_enriched_${id}`, pack.enrichedProfiles);
      writeLocalWorkspacePack(id, workspace);
      // Reload companies list so the full merged profile appears in the UI
      await loadCompanies();
      setActiveCompany(id);
      toast({ title: 'Company pack imported successfully' });
      return;
    }

    // Save profile
    const p = pack.companyProfile || {};
    await supabase.from('companies').update({
      industry: p.industry || '', sub_sector: p.sub_sector || '', headquarters: p.headquarters || '',
      operating_regions: p.operating_regions || '', employee_count: p.employee_count || '',
      annual_revenue: p.annual_revenue || '', main_products: p.main_products || '',
      main_customer_segments: p.main_customer_segments || '', main_competitors: p.main_competitors || '',
      sales_team_size: p.sales_team_size || '', kam_count: p.kam_count || '',
      sales_channels: p.sales_channels || '', current_challenges: p.current_challenges || '',
      strategic_goals: p.strategic_goals || '', additional_notes: p.additional_notes || '',
    }).eq('id', id);

    // Bulk insert data
    if (pack.orders?.length) {
      await supabase.from('orders').insert(pack.orders.map((o: any) => ({
        company_id: id, po_date: o.poDate, first_offer_date: o.firstOfferDate, opp_number: o.oppNumber,
        region: o.region, country: o.country, customer_name: o.customerName, scope: o.scope,
        product_family: o.productFamily, segment: o.segment, purchasing_year: o.purchasingYear,
        purchasing_quarter: o.purchasingQuarter, purchasing_month: o.purchasingMonth,
        selling_price: o.sellingPrice, margin: o.margin, kam: o.kam,
      })));
    }
    if (pack.opportunities?.length) {
      await supabase.from('opportunities').insert(pack.opportunities.map((o: any) => ({
        company_id: id, opp_number: o.oppNumber, status: o.status, region: o.region,
        country: o.country, customer_name: o.customerName, scope: o.scope,
        product_family: o.productFamily, segment: o.segment, est_purchasing_year: o.estPurchasingYear,
        est_purchasing_quarter: o.estPurchasingQuarter, est_revenue: o.estRevenue,
        contract_prob: o.contractProb, margin: o.margin, contact: o.contact, kam: o.kam,
      })));
    }
    if (pack.products?.length) {
      await supabase.from('products').insert(pack.products.map((p: any) => ({
        company_id: id,
        name: p.name,
        average_value: p.averageValue,
        type: p.type,
        comments: serializeProductComments(p.comments || '', {
          category: p.category,
          characteristics: p.characteristics,
          estimatedCost: p.estimatedCost,
          repositories: p.repositories,
          validated: p.validated,
          source: p.source,
        }),
      })));
    }
    if (pack.strategy?.length) {
      await supabase.from('strategy').insert(pack.strategy.map((s: any) => ({
        company_id: id, product_family: s.productFamily, number_of_segment: s.numberOfSegment,
        region: s.region, est_purchasing_quarter: s.estPurchasingQuarter,
        est_revenue: s.estRevenue, margin: s.margin, kam: s.kam,
      })));
    }
    if (pack.tasks?.length) {
      await supabase.from('tasks').insert(pack.tasks.map((task: any) => ({
        id: task.id,
        company_id: id,
        title: task.title,
        description: task.description || '',
        pillar: task.pillar,
        status: task.status,
        priority: task.priority,
        category: task.category,
        assignee: task.assignee || '',
        due_date: task.dueDate || null,
        created_at: task.createdAt || undefined,
        completed_at: task.completedAt || null,
        notes: task.notes || [],
        action_content: task.actionContent || { goal: '', callScript: '', emailTemplate: '', presentationNotes: '' },
        action_result: task.actionResult || null,
      })));
    }
    if (workspace.company_contacts?.length) {
      await supabase.from('company_contacts').insert(workspace.company_contacts.map((contact: any) => ({
        ...contact,
        company_id: id,
      })));
    }
    if (workspace.social_media_accounts?.length) {
      await supabase.from('social_media_accounts').insert(workspace.social_media_accounts.map((account: any) => ({
        ...account,
        company_id: id,
      })));
    }
    if (workspace.marketing_content?.length) {
      await supabase.from('marketing_content').insert(workspace.marketing_content.map((content: any) => ({
        ...content,
        company_id: id,
      })));
    }
    if (workspace.business_intelligence_reports?.length) {
      await supabase.from('business_intelligence_reports').insert(workspace.business_intelligence_reports.map((report: any) => ({
        ...report,
        company_id: id,
      })));
    }
    if (workspace.cost_rates?.length) {
      await supabase.from('cost_rates').insert(workspace.cost_rates.map((rate: any) => ({
        ...rate,
        company_id: id,
      })));
    }
    if (workspace.offers?.length) {
      await supabase.from('offers').insert(workspace.offers.map((offer: any) => ({
        ...offer,
        company_id: id,
      })));
    }
    if (workspace.offer_items?.length) {
      await supabase.from('offer_items').insert(workspace.offer_items);
    }
    if (workspace.cost_breakdowns?.length) {
      await supabase.from('cost_breakdowns').insert(workspace.cost_breakdowns);
    }
    if (workspace.offer_scenarios?.length) {
      await supabase.from('offer_scenarios').insert(workspace.offer_scenarios);
    }
    if (workspace.offer_scores?.length) {
      await supabase.from('offer_scores').insert(workspace.offer_scores);
    }
    if (workspace.installed_base_assets?.length) {
      await supabase.from('installed_base_assets').insert(workspace.installed_base_assets.map((asset: any) => ({
        ...asset,
        company_id: id,
      })));
    }
    if (workspace.service_contracts?.length) {
      await supabase.from('service_contracts').insert(workspace.service_contracts.map((contract: any) => ({
        ...contract,
        company_id: id,
      })));
    }
    if (workspace.after_sales_opportunities?.length) {
      await supabase.from('after_sales_opportunities').insert(workspace.after_sales_opportunities.map((opportunity: any) => ({
        ...opportunity,
        company_id: id,
      })));
    }
    if (workspace.spare_parts?.length) {
      await supabase.from('spare_parts').insert(workspace.spare_parts.map((part: any) => ({
        ...part,
        company_id: id,
      })));
    }
    // Also update extended profile fields not handled in createCompany
    await supabase.from('companies').update({
      objectives: p.objectives || '',
      strategy_context: p.strategy_context || '',
      market_context: p.market_context || '',
      current_challenges: p.current_challenges || '',
      strategic_goals: p.strategic_goals || '',
      enrichment_status: p.enrichment_status || 'pending',
    }).eq('id', id);

    // Reload companies list so the new entry appears immediately in the UI
    await loadCompanies();
    setActiveCompany(id);
    toast({ title: 'Company pack imported successfully' });
  }, [createCompany, loadCompanies, setActiveCompany]);

  // ─── CRUD operations (persist to Supabase) ───
  const setOrders = useCallback(async (records: OrderRecord[]) => {
    if (!activeCompanyId) return;
    const harmonized = harmonizeCommercialRecords({ orders: records, opportunities: data.opportunities });
    const cleanRecords = dedupeOrders(harmonized.orders as OrderRecord[]);
    const syncedOpportunities = dedupeOpportunities(harmonized.opportunities as OpportunityRecord[]);

    if (!isSupabaseConfigured) {
      LS.set(`acs_orders_${activeCompanyId}`, cleanRecords);
      LS.set(`acs_opps_${activeCompanyId}`, syncedOpportunities);
      setData(prev => ({ ...prev, orders: cleanRecords, opportunities: syncedOpportunities }));
      return;
    }

    await supabase.from('orders').delete().eq('company_id', activeCompanyId);
    if (cleanRecords.length > 0) {
      await supabase.from('orders').insert(cleanRecords.map(o => ({
        company_id: activeCompanyId, po_date: o.poDate, first_offer_date: o.firstOfferDate,
        opp_number: o.oppNumber, region: o.region, country: o.country, customer_name: o.customerName,
        scope: o.scope, product_family: o.productFamily, segment: o.segment,
        purchasing_year: o.purchasingYear, purchasing_quarter: o.purchasingQuarter,
        purchasing_month: o.purchasingMonth, selling_price: o.sellingPrice, margin: o.margin, kam: o.kam,
        truth_source: o.truthSource || 'sales_document',
      })));
    }

    await supabase.from('opportunities').delete().eq('company_id', activeCompanyId);
    if (syncedOpportunities.length > 0) {
      await supabase.from('opportunities').insert(syncedOpportunities.map(o => ({
        company_id: activeCompanyId, opp_number: o.oppNumber, status: o.status, region: o.region,
        country: o.country, customer_name: o.customerName, scope: o.scope,
        product_family: o.productFamily, segment: o.segment, est_purchasing_year: o.estPurchasingYear,
        est_purchasing_quarter: o.estPurchasingQuarter, est_revenue: o.estRevenue,
        contract_prob: o.contractProb, margin: o.margin, contact: o.contact, kam: o.kam,
        truth_source: o.truthSource || 'sales_document',
      })));
    }

    setData(prev => ({ ...prev, orders: cleanRecords, opportunities: syncedOpportunities }));
  }, [activeCompanyId, data.opportunities]);

  const setOpportunities = useCallback(async (records: OpportunityRecord[]) => {
    if (!activeCompanyId) return;
    const harmonized = harmonizeCommercialRecords({ orders: data.orders, opportunities: records.map((record) => ({ ...record, status: normalizeOpportunityStatus(record.status) })) });
    const cleanRecords = dedupeOpportunities(harmonized.opportunities as OpportunityRecord[]);

    if (!isSupabaseConfigured) {
      LS.set(`acs_opps_${activeCompanyId}`, cleanRecords);
      setData(prev => ({ ...prev, opportunities: cleanRecords }));
      return;
    }
    await supabase.from('opportunities').delete().eq('company_id', activeCompanyId);
    if (cleanRecords.length > 0) {
      await supabase.from('opportunities').insert(cleanRecords.map(o => ({
        company_id: activeCompanyId, opp_number: o.oppNumber, status: o.status, region: o.region,
        country: o.country, customer_name: o.customerName, scope: o.scope,
        product_family: o.productFamily, segment: o.segment, est_purchasing_year: o.estPurchasingYear,
        est_purchasing_quarter: o.estPurchasingQuarter, est_revenue: o.estRevenue,
        contract_prob: o.contractProb, margin: o.margin, contact: o.contact, kam: o.kam,
        truth_source: o.truthSource || 'sales_document',
      })));
    }
    setData(prev => ({ ...prev, opportunities: cleanRecords }));
  }, [activeCompanyId, data.orders]);

  const setProducts = useCallback(async (records: ProductRecord[]) => {
    if (!activeCompanyId) return;
    if (!isSupabaseConfigured) {
      LS.set(`acs_products_${activeCompanyId}`, records);
      setData(prev => ({ ...prev, products: records }));
      return;
    }
    await supabase.from('products').delete().eq('company_id', activeCompanyId);
    if (records.length > 0) {
      await supabase.from('products').insert(records.map(p => ({
        company_id: activeCompanyId,
        name: p.name,
        average_value: p.averageValue,
        type: p.type,
        comments: serializeProductComments(p.comments || '', {
          category: p.category,
          characteristics: p.characteristics,
          estimatedCost: p.estimatedCost,
          repositories: p.repositories,
          validated: p.validated,
          source: p.source,
        }),
      })));
    }
    setData(prev => ({ ...prev, products: records }));
  }, [activeCompanyId]);

  const setStrategy = useCallback(async (records: StrategyRecord[]) => {
    if (!activeCompanyId) return;
    if (!isSupabaseConfigured) {
      LS.set(`acs_strategy_${activeCompanyId}`, records);
      setData(prev => ({ ...prev, strategy: records }));
      return;
    }
    await supabase.from('strategy').delete().eq('company_id', activeCompanyId);
    if (records.length > 0) {
      await supabase.from('strategy').insert(records.map(s => ({
        company_id: activeCompanyId, product_family: s.productFamily, number_of_segment: s.numberOfSegment,
        region: s.region, est_purchasing_quarter: s.estPurchasingQuarter,
        est_revenue: s.estRevenue, margin: s.margin, kam: s.kam,
      })));
    }
    setData(prev => ({ ...prev, strategy: records }));
  }, [activeCompanyId]);

  const setLeads = useCallback(async (records: LeadRecord[]) => {
    if (!activeCompanyId) return;
    if (!isSupabaseConfigured) {
      LS.set(`acs_leads_${activeCompanyId}`, records);
    }
    setData(prev => ({ ...prev, leads: records }));
  }, [activeCompanyId]);

  const setContacts = useCallback(async (records: ContactRecord[]) => {
    if (!activeCompanyId) return;
    if (!isSupabaseConfigured) {
      LS.set(`acs_contacts_${activeCompanyId}`, records);
    }
    setData(prev => ({ ...prev, contacts: records }));
  }, [activeCompanyId]);

  const setDataManagementResults = useCallback((registries: NormalizedEntityRegistries, qualityReports: DatasetQualityReport[]) => {
    if (activeCompanyId && !isSupabaseConfigured) {
      LS.set(`acs_registries_${activeCompanyId}`, registries);
      LS.set(`acs_quality_${activeCompanyId}`, qualityReports);
    }
    setData(prev => ({ ...prev, entityRegistries: registries, qualityReports }));
  }, [activeCompanyId]);

  const setEnrichedProfiles = useCallback((profiles: EnrichedCompanyProfile[]) => {
    if (activeCompanyId && !isSupabaseConfigured) {
      LS.set(`acs_enriched_${activeCompanyId}`, profiles);
    }
    setData(prev => ({ ...prev, enrichedProfiles: profiles }));
  }, [activeCompanyId]);

  const setCompanyProfile = useCallback(async (profile: CompanyProfile) => {
    if (!activeCompanyId) return;
    if (!isSupabaseConfigured) {
      const existing = LS.get<CompanyProfile[]>('acs_companies', []);
      LS.set('acs_companies', existing.map(c => c.id === activeCompanyId ? { ...c, ...profile } : c));
      setData(prev => ({ ...prev, companyProfile: profile }));
      await loadCompanies();
      return;
    }
    await supabase.from('companies').update({
      company_name: profile.company_name, industry: profile.industry, sub_sector: profile.sub_sector,
      headquarters: profile.headquarters, operating_regions: profile.operating_regions,
      employee_count: profile.employee_count, annual_revenue: profile.annual_revenue,
      main_products: profile.main_products, main_customer_segments: profile.main_customer_segments,
      main_competitors: profile.main_competitors, sales_team_size: profile.sales_team_size,
      kam_count: profile.kam_count, sales_channels: profile.sales_channels,
      current_challenges: profile.current_challenges, strategic_goals: profile.strategic_goals,
      additional_notes: profile.additional_notes,
      website_url: profile.website_url, linkedin_url: profile.linkedin_url,
      business_description: profile.business_description, objectives: profile.objectives,
      strategy_context: profile.strategy_context, market_context: profile.market_context,
    }).eq('id', activeCompanyId);
    setData(prev => ({ ...prev, companyProfile: profile }));
    await loadCompanies(); // refresh company list
  }, [activeCompanyId, loadCompanies]);

  const addUploadLog = useCallback(async (entry: UploadLogEntry) => {
    if (!activeCompanyId) return;
    if (!isSupabaseConfigured) {
      const next = [entry, ...LS.get<UploadLogEntry[]>(`acs_log_${activeCompanyId}`, [])].slice(0, 50);
      LS.set(`acs_log_${activeCompanyId}`, next);
      setData(prev => ({ ...prev, uploadLog: next }));
      return;
    }
    await supabase.from('upload_log').insert({
      id: entry.id, company_id: activeCompanyId, file_name: entry.fileName,
      detected_type: entry.detectedType, row_count: entry.rowCount,
      status: entry.status, errors: entry.errors as any,
    });
    setData(prev => ({ ...prev, uploadLog: [entry, ...prev.uploadLog].slice(0, 50) }));
  }, [activeCompanyId]);

  const addTask = useCallback(async (task: MonitoringTask) => {
    if (!activeCompanyId) return;
    if (!isSupabaseConfigured) {
      const next = [task, ...LS.get<MonitoringTask[]>(`acs_tasks_${activeCompanyId}`, [])];
      LS.set(`acs_tasks_${activeCompanyId}`, next);
      setData(prev => ({ ...prev, tasks: next }));
      return;
    }
    await supabase.from('tasks').insert({
      id: task.id, company_id: activeCompanyId, title: task.title, description: task.description,
      pillar: task.pillar, status: task.status, priority: task.priority, category: task.category,
      assignee: task.assignee, due_date: task.dueDate, notes: task.notes as any,
      action_content: task.actionContent as any,
    });
    setData(prev => ({ ...prev, tasks: [task, ...prev.tasks] }));
  }, [activeCompanyId]);

  const updateTask = useCallback(async (id: string, updates: Partial<MonitoringTask>) => {
    if (activeCompanyId && !isSupabaseConfigured) {
      const next = LS.get<MonitoringTask[]>(`acs_tasks_${activeCompanyId}`, []).map(t => t.id === id ? { ...t, ...updates } : t);
      LS.set(`acs_tasks_${activeCompanyId}`, next);
      setData(prev => ({ ...prev, tasks: next }));
      return;
    }
    const dbUpdates: any = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.pillar !== undefined) dbUpdates.pillar = updates.pillar;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.assignee !== undefined) dbUpdates.assignee = updates.assignee;
    if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate;
    if (updates.completedAt !== undefined) dbUpdates.completed_at = updates.completedAt || null;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    if (updates.actionContent !== undefined) dbUpdates.action_content = updates.actionContent;
    if (updates.actionResult !== undefined) dbUpdates.action_result = updates.actionResult;
    await supabase.from('tasks').update(dbUpdates).eq('id', id);
    setData(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id === id ? { ...t, ...updates } : t) }));
  }, [activeCompanyId]);

  const deleteTask = useCallback(async (id: string) => {
    if (activeCompanyId && !isSupabaseConfigured) {
      const next = LS.get<MonitoringTask[]>(`acs_tasks_${activeCompanyId}`, []).filter(t => t.id !== id);
      LS.set(`acs_tasks_${activeCompanyId}`, next);
      setData(prev => ({ ...prev, tasks: next }));
      return;
    }
    await supabase.from('tasks').delete().eq('id', id);
    setData(prev => ({ ...prev, tasks: prev.tasks.filter(t => t.id !== id) }));
  }, [activeCompanyId]);

  const clearDataset = useCallback(async (key: 'orders' | 'opportunities' | 'products' | 'strategy' | 'leads' | 'contacts') => {
    if (!activeCompanyId) return;
    if (!isSupabaseConfigured) {
      const localKeys: Record<typeof key, string> = {
        orders: `acs_orders_${activeCompanyId}`,
        opportunities: `acs_opps_${activeCompanyId}`,
        products: `acs_products_${activeCompanyId}`,
        strategy: `acs_strategy_${activeCompanyId}`,
        leads: `acs_leads_${activeCompanyId}`,
        contacts: `acs_contacts_${activeCompanyId}`,
      };
      LS.del(localKeys[key]);
      setData(prev => ({ ...prev, [key]: [] }));
      return;
    }
    if (key !== 'leads' && key !== 'contacts') {
      await supabase.from(key).delete().eq('company_id', activeCompanyId);
    }
    setData(prev => ({ ...prev, [key]: [] }));
  }, [activeCompanyId]);

  const clearAll = useCallback(async () => {
    if (!activeCompanyId) return;
    if (!isSupabaseConfigured) {
      [
        `acs_orders_${activeCompanyId}`,
        `acs_opps_${activeCompanyId}`,
        `acs_products_${activeCompanyId}`,
        `acs_strategy_${activeCompanyId}`,
        `acs_leads_${activeCompanyId}`,
        `acs_contacts_${activeCompanyId}`,
        `acs_tasks_${activeCompanyId}`,
        `acs_log_${activeCompanyId}`,
        `acs_registries_${activeCompanyId}`,
        `acs_quality_${activeCompanyId}`,
        `acs_enriched_${activeCompanyId}`,
      ].forEach((storageKey) => LS.del(storageKey));
      writeLocalWorkspacePack(activeCompanyId, {});
      setData(prev => ({
        orders: [],
        opportunities: [],
        products: [],
        strategy: [],
        leads: [],
        contacts: [],
        companyProfile: prev.companyProfile,
        uploadLog: [],
        tasks: [],
        entityRegistries: emptyRegistries,
        qualityReports: [],
        enrichedProfiles: [],
      }));
      return;
    }
    await Promise.all([
      supabase.from('orders').delete().eq('company_id', activeCompanyId),
      supabase.from('opportunities').delete().eq('company_id', activeCompanyId),
      supabase.from('products').delete().eq('company_id', activeCompanyId),
      supabase.from('strategy').delete().eq('company_id', activeCompanyId),
      supabase.from('tasks').delete().eq('company_id', activeCompanyId),
      supabase.from('upload_log').delete().eq('company_id', activeCompanyId),
      supabase.from('company_contacts').delete().eq('company_id', activeCompanyId),
      supabase.from('social_media_accounts').delete().eq('company_id', activeCompanyId),
      supabase.from('marketing_content').delete().eq('company_id', activeCompanyId),
      supabase.from('business_intelligence_reports').delete().eq('company_id', activeCompanyId),
      supabase.from('cost_rates').delete().eq('company_id', activeCompanyId),
      supabase.from('offers').delete().eq('company_id', activeCompanyId),
      supabase.from('installed_base_assets').delete().eq('company_id', activeCompanyId),
      supabase.from('service_contracts').delete().eq('company_id', activeCompanyId),
      supabase.from('after_sales_opportunities').delete().eq('company_id', activeCompanyId),
      supabase.from('spare_parts').delete().eq('company_id', activeCompanyId),
    ]);
    setData(prev => ({
      orders: [],
      opportunities: [],
      products: [],
      strategy: [],
      leads: [],
      contacts: [],
      companyProfile: prev.companyProfile,
      uploadLog: [],
      tasks: [],
      entityRegistries: emptyRegistries,
      qualityReports: [],
      enrichedProfiles: [],
    }));
  }, [activeCompanyId]);

  // ─── Initial load ───
  useEffect(() => {
    loadCompanies().then(() => {
      const saved = localStorage.getItem('acs_active_company');
      if (saved) loadCompanyData(saved);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const hasData =
    data.orders.length > 0 ||
    data.opportunities.length > 0 ||
    data.strategy.length > 0 ||
    data.products.length > 0 ||
    data.leads.length > 0 ||
    data.contacts.length > 0;

  return (
    <DataContext.Provider value={{
      data, companies, activeCompanyId, setActiveCompany, loadCompanies,
      createCompany, deleteCompany, exportCompanyPack, importCompanyPack, triggerEnrichment,
      setOrders, setOpportunities, setProducts, setStrategy, setLeads, setContacts, setCompanyProfile,
      setDataManagementResults, setEnrichedProfiles,
      addUploadLog, addTask, updateTask, deleteTask, clearDataset, clearAll, hasData, loading,
      commercialSnapshot,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
