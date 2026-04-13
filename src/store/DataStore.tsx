import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

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
    id: r.id, poDate: r.po_date || '', firstOfferDate: r.first_offer_date || '',
    oppNumber: r.opp_number || '', region: r.region || '', country: r.country || '',
    customerName: r.customer_name || '', scope: r.scope || '', productFamily: r.product_family || '',
    segment: r.segment || '', purchasingYear: r.purchasing_year || '',
    purchasingQuarter: r.purchasing_quarter || '', purchasingMonth: r.purchasing_month || '',
    sellingPrice: Number(r.selling_price) || 0, margin: Number(r.margin) || 0, kam: r.kam || '',
  };
}

function dbToOpportunity(r: any): OpportunityRecord {
  return {
    oppNumber: r.opp_number || '', status: r.status || '', region: r.region || '',
    country: r.country || '', customerName: r.customer_name || '', scope: r.scope || '',
    productFamily: r.product_family || '', segment: r.segment || '',
    estPurchasingYear: r.est_purchasing_year || '', estPurchasingQuarter: r.est_purchasing_quarter || '',
    estRevenue: Number(r.est_revenue) || 0, contractProb: Number(r.contract_prob) || 0,
    margin: Number(r.margin) || 0, contact: r.contact || '', kam: r.kam || '',
  };
}

function dbToProduct(r: any): ProductRecord {
  return { name: r.name || '', averageValue: Number(r.average_value) || 0, type: r.type || '', comments: r.comments || '' };
}

function dbToStrategy(r: any): StrategyRecord {
  return {
    productFamily: r.product_family || '', numberOfSegment: r.number_of_segment || '',
    region: r.region || '', estPurchasingQuarter: r.est_purchasing_quarter || '',
    estRevenue: Number(r.est_revenue) || 0, margin: Number(r.margin) || 0, kam: r.kam || '',
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

// ─── State ───
interface DataState {
  orders: OrderRecord[];
  opportunities: OpportunityRecord[];
  products: ProductRecord[];
  strategy: StrategyRecord[];
  companyProfile: CompanyProfile;
  uploadLog: UploadLogEntry[];
  tasks: MonitoringTask[];
}

const emptyProfile: CompanyProfile = {
  company_name: '', industry: '', sub_sector: '', headquarters: '',
  operating_regions: '', employee_count: '', annual_revenue: '', main_products: '',
  main_customer_segments: '', main_competitors: '', sales_team_size: '', kam_count: '',
  sales_channels: '', current_challenges: '', strategic_goals: '', additional_notes: '',
  website_url: '', linkedin_url: '', business_description: '', objectives: '',
  strategy_context: '', market_context: '', enrichment_status: 'pending',
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
  setCompanyProfile: (profile: CompanyProfile) => void;
  addUploadLog: (entry: UploadLogEntry) => void;
  addTask: (task: MonitoringTask) => void;
  updateTask: (id: string, updates: Partial<MonitoringTask>) => void;
  deleteTask: (id: string) => void;
  clearDataset: (key: 'orders' | 'opportunities' | 'products' | 'strategy') => void;
  clearAll: () => void;
  hasData: boolean;
  loading: boolean;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DataState>({
    orders: [], opportunities: [], products: [], strategy: [],
    companyProfile: emptyProfile, uploadLog: [], tasks: [],
  });
  const [companies, setCompanies] = useState<CompanyProfile[]>([]);
  const [activeCompanyId, setActiveCompanyIdState] = useState<string | null>(
    localStorage.getItem('acs_active_company') || null
  );
  const [loading, setLoading] = useState(false);

  // ─── Load companies list ───
  const loadCompanies = useCallback(async () => {
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
        orders: (ordersRes.data || []).map(dbToOrder),
        opportunities: (oppsRes.data || []).map(dbToOpportunity),
        products: (prodsRes.data || []).map(dbToProduct),
        strategy: (stratRes.data || []).map(dbToStrategy),
        tasks: (tasksRes.data || []).map(dbToTask),
        uploadLog: (logRes.data || []).map(r => ({
          id: r.id, fileName: r.file_name, detectedType: r.detected_type,
          rowCount: r.row_count || 0, status: r.status as 'validated' | 'error',
          errors: (r.errors as string[]) || [], timestamp: r.created_at,
        })),
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
      setData({ orders: [], opportunities: [], products: [], strategy: [], companyProfile: emptyProfile, uploadLog: [], tasks: [] });
    }
  }, [loadCompanyData]);

  // ─── Create company ───
  const createCompany = useCallback(async (name: string, websiteUrl?: string, linkedinUrl?: string, businessDescription?: string): Promise<string | null> => {
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
    await supabase.from('companies').delete().eq('id', id);
    if (activeCompanyId === id) setActiveCompany(null);
    await loadCompanies();
  }, [activeCompanyId, setActiveCompany, loadCompanies]);

  // ─── Export / Import ───
  const exportCompanyPack = useCallback(async (): Promise<string> => {
    return JSON.stringify({ companyProfile: data.companyProfile, orders: data.orders, opportunities: data.opportunities, products: data.products, strategy: data.strategy, tasks: data.tasks }, null, 2);
  }, [data]);

  const importCompanyPack = useCallback(async (json: string) => {
    const pack = JSON.parse(json);
    const companyName = pack.companyProfile?.company_name || 'Imported Company';
    const id = await createCompany(companyName);
    if (!id) return;

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
        company_id: id, name: p.name, average_value: p.averageValue, type: p.type, comments: p.comments,
      })));
    }
    if (pack.strategy?.length) {
      await supabase.from('strategy').insert(pack.strategy.map((s: any) => ({
        company_id: id, product_family: s.productFamily, number_of_segment: s.numberOfSegment,
        region: s.region, est_purchasing_quarter: s.estPurchasingQuarter,
        est_revenue: s.estRevenue, margin: s.margin, kam: s.kam,
      })));
    }

    setActiveCompany(id);
    toast({ title: 'Company pack imported successfully' });
  }, [createCompany, setActiveCompany]);

  // ─── CRUD operations (persist to Supabase) ───
  const setOrders = useCallback(async (records: OrderRecord[]) => {
    if (!activeCompanyId) return;
    // Replace all orders for this company
    await supabase.from('orders').delete().eq('company_id', activeCompanyId);
    if (records.length > 0) {
      await supabase.from('orders').insert(records.map(o => ({
        company_id: activeCompanyId, po_date: o.poDate, first_offer_date: o.firstOfferDate,
        opp_number: o.oppNumber, region: o.region, country: o.country, customer_name: o.customerName,
        scope: o.scope, product_family: o.productFamily, segment: o.segment,
        purchasing_year: o.purchasingYear, purchasing_quarter: o.purchasingQuarter,
        purchasing_month: o.purchasingMonth, selling_price: o.sellingPrice, margin: o.margin, kam: o.kam,
      })));
    }
    setData(prev => ({ ...prev, orders: records }));
  }, [activeCompanyId]);

  const setOpportunities = useCallback(async (records: OpportunityRecord[]) => {
    if (!activeCompanyId) return;
    await supabase.from('opportunities').delete().eq('company_id', activeCompanyId);
    if (records.length > 0) {
      await supabase.from('opportunities').insert(records.map(o => ({
        company_id: activeCompanyId, opp_number: o.oppNumber, status: o.status, region: o.region,
        country: o.country, customer_name: o.customerName, scope: o.scope,
        product_family: o.productFamily, segment: o.segment, est_purchasing_year: o.estPurchasingYear,
        est_purchasing_quarter: o.estPurchasingQuarter, est_revenue: o.estRevenue,
        contract_prob: o.contractProb, margin: o.margin, contact: o.contact, kam: o.kam,
      })));
    }
    setData(prev => ({ ...prev, opportunities: records }));
  }, [activeCompanyId]);

  const setProducts = useCallback(async (records: ProductRecord[]) => {
    if (!activeCompanyId) return;
    await supabase.from('products').delete().eq('company_id', activeCompanyId);
    if (records.length > 0) {
      await supabase.from('products').insert(records.map(p => ({
        company_id: activeCompanyId, name: p.name, average_value: p.averageValue, type: p.type, comments: p.comments,
      })));
    }
    setData(prev => ({ ...prev, products: records }));
  }, [activeCompanyId]);

  const setStrategy = useCallback(async (records: StrategyRecord[]) => {
    if (!activeCompanyId) return;
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

  const setCompanyProfile = useCallback(async (profile: CompanyProfile) => {
    if (!activeCompanyId) return;
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
    await supabase.from('upload_log').insert({
      id: entry.id, company_id: activeCompanyId, file_name: entry.fileName,
      detected_type: entry.detectedType, row_count: entry.rowCount,
      status: entry.status, errors: entry.errors as any,
    });
    setData(prev => ({ ...prev, uploadLog: [entry, ...prev.uploadLog].slice(0, 50) }));
  }, [activeCompanyId]);

  const addTask = useCallback(async (task: MonitoringTask) => {
    if (!activeCompanyId) return;
    await supabase.from('tasks').insert({
      id: task.id, company_id: activeCompanyId, title: task.title, description: task.description,
      pillar: task.pillar, status: task.status, priority: task.priority, category: task.category,
      assignee: task.assignee, due_date: task.dueDate, notes: task.notes as any,
      action_content: task.actionContent as any,
    });
    setData(prev => ({ ...prev, tasks: [task, ...prev.tasks] }));
  }, [activeCompanyId]);

  const updateTask = useCallback(async (id: string, updates: Partial<MonitoringTask>) => {
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
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    await supabase.from('tasks').delete().eq('id', id);
    setData(prev => ({ ...prev, tasks: prev.tasks.filter(t => t.id !== id) }));
  }, []);

  const clearDataset = useCallback(async (key: 'orders' | 'opportunities' | 'products' | 'strategy') => {
    if (!activeCompanyId) return;
    await supabase.from(key).delete().eq('company_id', activeCompanyId);
    setData(prev => ({ ...prev, [key]: [] }));
  }, [activeCompanyId]);

  const clearAll = useCallback(async () => {
    if (!activeCompanyId) return;
    await Promise.all([
      supabase.from('orders').delete().eq('company_id', activeCompanyId),
      supabase.from('opportunities').delete().eq('company_id', activeCompanyId),
      supabase.from('products').delete().eq('company_id', activeCompanyId),
      supabase.from('strategy').delete().eq('company_id', activeCompanyId),
      supabase.from('tasks').delete().eq('company_id', activeCompanyId),
      supabase.from('upload_log').delete().eq('company_id', activeCompanyId),
    ]);
    setData({ orders: [], opportunities: [], products: [], strategy: [], companyProfile: data.companyProfile, uploadLog: [], tasks: [] });
  }, [activeCompanyId, data.companyProfile]);

  // ─── Initial load ───
  useEffect(() => {
    loadCompanies().then(() => {
      const saved = localStorage.getItem('acs_active_company');
      if (saved) loadCompanyData(saved);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const hasData = data.orders.length > 0 || data.opportunities.length > 0;

  return (
    <DataContext.Provider value={{
      data, companies, activeCompanyId, setActiveCompany, loadCompanies,
      createCompany, deleteCompany, exportCompanyPack, importCompanyPack, triggerEnrichment,
      setOrders, setOpportunities, setProducts, setStrategy, setCompanyProfile,
      addUploadLog, addTask, updateTask, deleteTask, clearDataset, clearAll, hasData, loading,
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
