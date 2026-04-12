import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { LocalStorage } from '@/lib/localStorage';

export interface OrderRecord {
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

export interface CompanyProfile {
  companyName: string;
  industry: string;
  subSector: string;
  headquarters: string;
  operatingRegions: string;
  employeeCount: string;
  annualRevenue: string;
  mainProducts: string;
  mainCustomerSegments: string;
  mainCompetitors: string;
  salesTeamSize: string;
  kamCount: string;
  salesChannels: string;
  currentChallenges: string;
  strategicGoals: string;
  additionalNotes: string;
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
  alignmentScore: number; // 0-100
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
  companyName: '', industry: '', subSector: '', headquarters: '',
  operatingRegions: '', employeeCount: '', annualRevenue: '', mainProducts: '',
  mainCustomerSegments: '', mainCompetitors: '', salesTeamSize: '', kamCount: '',
  salesChannels: '', currentChallenges: '', strategicGoals: '', additionalNotes: '',
};

function loadInitialState(): DataState {
  return {
    orders: LocalStorage.load<OrderRecord[]>('orders', []),
    opportunities: LocalStorage.load<OpportunityRecord[]>('opportunities', []),
    products: LocalStorage.load<ProductRecord[]>('products', []),
    strategy: LocalStorage.load<StrategyRecord[]>('strategy', []),
    companyProfile: LocalStorage.load<CompanyProfile>('company_profile', emptyProfile),
    uploadLog: LocalStorage.load<UploadLogEntry[]>('upload_log', []),
    tasks: LocalStorage.load<MonitoringTask[]>('tasks', []),
  };
}

interface DataContextType {
  data: DataState;
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
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DataState>(loadInitialState);

  useEffect(() => { LocalStorage.save('orders', data.orders); }, [data.orders]);
  useEffect(() => { LocalStorage.save('opportunities', data.opportunities); }, [data.opportunities]);
  useEffect(() => { LocalStorage.save('products', data.products); }, [data.products]);
  useEffect(() => { LocalStorage.save('strategy', data.strategy); }, [data.strategy]);
  useEffect(() => { LocalStorage.save('company_profile', data.companyProfile); }, [data.companyProfile]);
  useEffect(() => { LocalStorage.save('upload_log', data.uploadLog); }, [data.uploadLog]);
  useEffect(() => { LocalStorage.save('tasks', data.tasks); }, [data.tasks]);

  const setOrders = useCallback((records: OrderRecord[]) => setData(prev => ({ ...prev, orders: records })), []);
  const setOpportunities = useCallback((records: OpportunityRecord[]) => setData(prev => ({ ...prev, opportunities: records })), []);
  const setProducts = useCallback((records: ProductRecord[]) => setData(prev => ({ ...prev, products: records })), []);
  const setStrategy = useCallback((records: StrategyRecord[]) => setData(prev => ({ ...prev, strategy: records })), []);
  const setCompanyProfile = useCallback((profile: CompanyProfile) => setData(prev => ({ ...prev, companyProfile: profile })), []);
  const addUploadLog = useCallback((entry: UploadLogEntry) => setData(prev => ({ ...prev, uploadLog: [entry, ...prev.uploadLog].slice(0, 50) })), []);

  const addTask = useCallback((task: MonitoringTask) => setData(prev => ({ ...prev, tasks: [task, ...prev.tasks] })), []);
  const updateTask = useCallback((id: string, updates: Partial<MonitoringTask>) => {
    setData(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => t.id === id ? { ...t, ...updates } : t),
    }));
  }, []);
  const deleteTask = useCallback((id: string) => setData(prev => ({ ...prev, tasks: prev.tasks.filter(t => t.id !== id) })), []);

  const clearDataset = useCallback((key: 'orders' | 'opportunities' | 'products' | 'strategy') => {
    setData(prev => ({ ...prev, [key]: [] }));
    LocalStorage.remove(key);
  }, []);

  const clearAll = useCallback(() => {
    LocalStorage.clear();
    setData({ orders: [], opportunities: [], products: [], strategy: [], companyProfile: emptyProfile, uploadLog: [], tasks: [] });
  }, []);

  const hasData = data.orders.length > 0 || data.opportunities.length > 0;

  return (
    <DataContext.Provider value={{ data, setOrders, setOpportunities, setProducts, setStrategy, setCompanyProfile, addUploadLog, addTask, updateTask, deleteTask, clearDataset, clearAll, hasData }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
