import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

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
  type: string; // commodity/innovation/decline
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

interface DataState {
  orders: OrderRecord[];
  opportunities: OpportunityRecord[];
  products: ProductRecord[];
  strategy: StrategyRecord[];
}

interface DataContextType {
  data: DataState;
  setOrders: (records: OrderRecord[]) => void;
  setOpportunities: (records: OpportunityRecord[]) => void;
  setProducts: (records: ProductRecord[]) => void;
  setStrategy: (records: StrategyRecord[]) => void;
  hasData: boolean;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DataState>({ orders: [], opportunities: [], products: [], strategy: [] });

  const setOrders = useCallback((records: OrderRecord[]) => setData(prev => ({ ...prev, orders: records })), []);
  const setOpportunities = useCallback((records: OpportunityRecord[]) => setData(prev => ({ ...prev, opportunities: records })), []);
  const setProducts = useCallback((records: ProductRecord[]) => setData(prev => ({ ...prev, products: records })), []);
  const setStrategy = useCallback((records: StrategyRecord[]) => setData(prev => ({ ...prev, strategy: records })), []);

  const hasData = data.orders.length > 0 || data.opportunities.length > 0;

  return (
    <DataContext.Provider value={{ data, setOrders, setOpportunities, setProducts, setStrategy, hasData }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
