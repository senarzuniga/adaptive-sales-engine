import type {
  CompanyProfile,
  ContactRecord,
  LeadRecord,
  OpportunityRecord,
  OrderRecord,
  ProductRecord,
  StrategyRecord,
} from '@/store/DataStore';

export type GoaIntent =
  | 'data_correction'
  | 'data_enrichment'
  | 'data_query'
  | 'structural_change'
  | 'hierarchy_correction'
  | 'insight_request'
  | 'clarification_required';

export interface GoaPanelContext {
  panel: string;
  panelKey: string;
  route: string;
  company_id: string;
  visible_data: Record<string, unknown>;
  historical_data: Record<string, unknown>;
  user_prompt: string;
}

export interface GoaDataSnapshot {
  orders: OrderRecord[];
  opportunities: OpportunityRecord[];
  products: ProductRecord[];
  strategy: StrategyRecord[];
  leads: LeadRecord[];
  contacts: ContactRecord[];
  companyProfile: CompanyProfile;
}

export interface GoaMutators {
  setOrders: (records: OrderRecord[]) => Promise<void> | void;
  setOpportunities: (records: OpportunityRecord[]) => Promise<void> | void;
  setProducts: (records: ProductRecord[]) => Promise<void> | void;
  setStrategy: (records: StrategyRecord[]) => Promise<void> | void;
  setLeads: (records: LeadRecord[]) => Promise<void> | void;
  setContacts: (records: ContactRecord[]) => Promise<void> | void;
}

export interface GoaProposedChange {
  dataset: 'orders' | 'opportunities' | 'products' | 'strategy' | 'leads' | 'contacts' | 'external';
  description: string;
  before?: unknown;
  after?: unknown;
}

export interface GoaExecutionResult {
  intents: GoaIntent[];
  safeMode: boolean;
  confidence: number;
  changesApplied: GoaProposedChange[];
  suggestions: string[];
  clarificationQuestion?: string;
  executionSummary: string;
}

export interface GoaMemoryRecord {
  id?: string;
  company_id: string;
  panel_key: string;
  prompt_key: string;
  prompt: string;
  intent: string;
  action_taken: string;
  context: Record<string, unknown>;
  result: Record<string, unknown>;
  feedback?: string | null;
  confidence: number;
  auto_apply: boolean;
  created_at?: string;
}

export interface GoaChangeLogRecord {
  id?: string;
  company_id: string;
  panel: string;
  panel_key: string;
  prompt: string;
  change: string;
  before_state: Record<string, unknown>;
  after_state: Record<string, unknown>;
  agent_confidence: number;
  created_at?: string;
}
