
-- Create companies table
CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT NOT NULL,
  industry TEXT DEFAULT '',
  sub_sector TEXT DEFAULT '',
  headquarters TEXT DEFAULT '',
  operating_regions TEXT DEFAULT '',
  employee_count TEXT DEFAULT '',
  annual_revenue TEXT DEFAULT '',
  main_products TEXT DEFAULT '',
  main_customer_segments TEXT DEFAULT '',
  main_competitors TEXT DEFAULT '',
  sales_team_size TEXT DEFAULT '',
  kam_count TEXT DEFAULT '',
  sales_channels TEXT DEFAULT '',
  current_challenges TEXT DEFAULT '',
  strategic_goals TEXT DEFAULT '',
  additional_notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create orders table
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  po_date TEXT DEFAULT '',
  first_offer_date TEXT DEFAULT '',
  opp_number TEXT DEFAULT '',
  region TEXT DEFAULT '',
  country TEXT DEFAULT '',
  customer_name TEXT DEFAULT '',
  scope TEXT DEFAULT '',
  product_family TEXT DEFAULT '',
  segment TEXT DEFAULT '',
  purchasing_year TEXT DEFAULT '',
  purchasing_quarter TEXT DEFAULT '',
  purchasing_month TEXT DEFAULT '',
  selling_price NUMERIC DEFAULT 0,
  margin NUMERIC DEFAULT 0,
  kam TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create opportunities table
CREATE TABLE public.opportunities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  opp_number TEXT DEFAULT '',
  status TEXT DEFAULT '',
  region TEXT DEFAULT '',
  country TEXT DEFAULT '',
  customer_name TEXT DEFAULT '',
  scope TEXT DEFAULT '',
  product_family TEXT DEFAULT '',
  segment TEXT DEFAULT '',
  est_purchasing_year TEXT DEFAULT '',
  est_purchasing_quarter TEXT DEFAULT '',
  est_revenue NUMERIC DEFAULT 0,
  contract_prob NUMERIC DEFAULT 0,
  margin NUMERIC DEFAULT 0,
  contact TEXT DEFAULT '',
  kam TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create products table
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT DEFAULT '',
  average_value NUMERIC DEFAULT 0,
  type TEXT DEFAULT '',
  comments TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create strategy table
CREATE TABLE public.strategy (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_family TEXT DEFAULT '',
  number_of_segment TEXT DEFAULT '',
  region TEXT DEFAULT '',
  est_purchasing_quarter TEXT DEFAULT '',
  est_revenue NUMERIC DEFAULT 0,
  margin NUMERIC DEFAULT 0,
  kam TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create tasks table
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  pillar TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'todo',
  priority TEXT NOT NULL DEFAULT 'medium',
  category TEXT NOT NULL DEFAULT 'follow_up',
  assignee TEXT DEFAULT '',
  due_date TEXT DEFAULT '',
  completed_at TEXT,
  notes JSONB DEFAULT '[]'::jsonb,
  action_content JSONB DEFAULT '{"goal":"","callScript":"","emailTemplate":"","presentationNotes":""}'::jsonb,
  action_result JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create upload_log table
CREATE TABLE public.upload_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  detected_type TEXT NOT NULL,
  row_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'validated',
  errors JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upload_log ENABLE ROW LEVEL SECURITY;

-- Permissive policies (single-user consultant app)
CREATE POLICY "Allow all access to companies" ON public.companies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to orders" ON public.orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to opportunities" ON public.opportunities FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to products" ON public.products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to strategy" ON public.strategy FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to tasks" ON public.tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to upload_log" ON public.upload_log FOR ALL USING (true) WITH CHECK (true);

-- Create indexes for company_id lookups
CREATE INDEX idx_orders_company ON public.orders(company_id);
CREATE INDEX idx_opportunities_company ON public.opportunities(company_id);
CREATE INDEX idx_products_company ON public.products(company_id);
CREATE INDEX idx_strategy_company ON public.strategy(company_id);
CREATE INDEX idx_tasks_company ON public.tasks(company_id);
CREATE INDEX idx_upload_log_company ON public.upload_log(company_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add updated_at triggers
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.company_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  is_default_handler BOOLEAN NOT NULL DEFAULT false,
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.company_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to company_contacts"
ON public.company_contacts
FOR ALL
USING (true)
WITH CHECK (true);

CREATE TRIGGER update_company_contacts_updated_at
BEFORE UPDATE ON public.company_contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
CREATE TABLE public.social_media_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  platform text NOT NULL DEFAULT '',
  profile_url text NOT NULL DEFAULT '',
  account_name text NOT NULL DEFAULT '',
  is_enabled boolean NOT NULL DEFAULT false,
  api_credentials jsonb DEFAULT '{}'::jsonb,
  posting_preferences jsonb DEFAULT '{"auto_post": false, "content_types": ["article", "update"], "frequency": "manual"}'::jsonb,
  notes text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.social_media_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to social_media_accounts"
  ON public.social_media_accounts
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_social_media_accounts_updated_at
  BEFORE UPDATE ON public.social_media_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
CREATE TABLE public.marketing_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  summary TEXT DEFAULT '',
  content_type TEXT NOT NULL DEFAULT 'update',
  platform TEXT NOT NULL DEFAULT 'linkedin',
  hashtags TEXT[] DEFAULT '{}',
  call_to_action TEXT DEFAULT '',
  suggested_image_description TEXT DEFAULT '',
  alternative_versions JSONB DEFAULT '[]'::jsonb,
  intelligence_sources JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  scheduled_at TIMESTAMP WITH TIME ZONE,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to marketing_content"
ON public.marketing_content
FOR ALL
USING (true)
WITH CHECK (true);

CREATE INDEX idx_marketing_content_company ON public.marketing_content(company_id);
CREATE INDEX idx_marketing_content_status ON public.marketing_content(status);
CREATE INDEX idx_marketing_content_scheduled ON public.marketing_content(scheduled_at);

CREATE TRIGGER update_marketing_content_updated_at
BEFORE UPDATE ON public.marketing_content
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Offers table
CREATE TABLE public.offers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  offer_number TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  customer_name TEXT NOT NULL DEFAULT '',
  project_description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  currency TEXT NOT NULL DEFAULT 'EUR',
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to offers" ON public.offers FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_offers_company ON public.offers(company_id);
CREATE TRIGGER update_offers_updated_at BEFORE UPDATE ON public.offers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Offer items (products/services composing an offer)
CREATE TABLE public.offer_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_id UUID NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL DEFAULT '',
  item_type TEXT NOT NULL DEFAULT 'product',
  quantity INTEGER NOT NULL DEFAULT 1,
  description TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.offer_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to offer_items" ON public.offer_items FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_offer_items_offer ON public.offer_items(offer_id);
CREATE TRIGGER update_offer_items_updated_at BEFORE UPDATE ON public.offer_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Cost breakdowns per item
CREATE TABLE public.cost_breakdowns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_item_id UUID NOT NULL REFERENCES public.offer_items(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'materials',
  line_item TEXT NOT NULL DEFAULT '',
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  surcharge_pct NUMERIC DEFAULT 0,
  hours NUMERIC DEFAULT 0,
  hourly_rate NUMERIC DEFAULT 0,
  days NUMERIC DEFAULT 0,
  resources INTEGER DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cost_breakdowns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to cost_breakdowns" ON public.cost_breakdowns FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_cost_breakdowns_item ON public.cost_breakdowns(offer_item_id);

-- Offer scenarios (conservative/base/optimized)
CREATE TABLE public.offer_scenarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_id UUID NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  scenario_type TEXT NOT NULL DEFAULT 'base',
  total_cost NUMERIC NOT NULL DEFAULT 0,
  selling_price NUMERIC NOT NULL DEFAULT 0,
  margin_amount NUMERIC NOT NULL DEFAULT 0,
  margin_pct NUMERIC NOT NULL DEFAULT 0,
  risk_level TEXT DEFAULT 'medium',
  ai_analysis JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.offer_scenarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to offer_scenarios" ON public.offer_scenarios FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_offer_scenarios_offer ON public.offer_scenarios(offer_id);
CREATE TRIGGER update_offer_scenarios_updated_at BEFORE UPDATE ON public.offer_scenarios FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Offer scores (margin, risk, global)
CREATE TABLE public.offer_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_id UUID NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  margin_score TEXT DEFAULT 'medium',
  risk_score TEXT DEFAULT 'medium',
  global_score NUMERIC DEFAULT 0,
  risk_factors JSONB DEFAULT '[]'::jsonb,
  recommendations JSONB DEFAULT '[]'::jsonb,
  ai_explanation TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.offer_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to offer_scores" ON public.offer_scores FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_offer_scores_offer ON public.offer_scores(offer_id);
CREATE TRIGGER update_offer_scores_updated_at BEFORE UPDATE ON public.offer_scores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Installed base assets
CREATE TABLE public.installed_base_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  serial_number TEXT NOT NULL DEFAULT '',
  asset_name TEXT NOT NULL DEFAULT '',
  asset_type TEXT DEFAULT 'machine',
  customer_name TEXT DEFAULT '',
  location TEXT DEFAULT '',
  country TEXT DEFAULT '',
  region TEXT DEFAULT '',
  installation_date DATE,
  warranty_expiry DATE,
  lifecycle_stage TEXT NOT NULL DEFAULT 'active',
  connection_status TEXT NOT NULL DEFAULT 'registered',
  usage_intensity TEXT DEFAULT 'normal',
  configuration JSONB DEFAULT '{}'::jsonb,
  last_service_date DATE,
  next_service_due DATE,
  customer_value_segment TEXT DEFAULT 'standard',
  risk_level TEXT DEFAULT 'medium',
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.installed_base_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to installed_base_assets" ON public.installed_base_assets FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_installed_base_company ON public.installed_base_assets(company_id);
CREATE INDEX idx_installed_base_lifecycle ON public.installed_base_assets(lifecycle_stage);
CREATE TRIGGER update_installed_base_updated_at BEFORE UPDATE ON public.installed_base_assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Service contracts
CREATE TABLE public.service_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES public.installed_base_assets(id) ON DELETE SET NULL,
  contract_type TEXT NOT NULL DEFAULT 'basic',
  contract_name TEXT NOT NULL DEFAULT '',
  customer_name TEXT DEFAULT '',
  start_date DATE,
  end_date DATE,
  annual_value NUMERIC DEFAULT 0,
  recurring_revenue_type TEXT DEFAULT 'subscription',
  status TEXT NOT NULL DEFAULT 'active',
  sla_response_hours INTEGER DEFAULT 24,
  includes_parts BOOLEAN DEFAULT false,
  includes_remote BOOLEAN DEFAULT false,
  includes_predictive BOOLEAN DEFAULT false,
  kpis JSONB DEFAULT '{}'::jsonb,
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.service_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to service_contracts" ON public.service_contracts FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_service_contracts_company ON public.service_contracts(company_id);
CREATE INDEX idx_service_contracts_status ON public.service_contracts(status);
CREATE TRIGGER update_service_contracts_updated_at BEFORE UPDATE ON public.service_contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Service interventions
CREATE TABLE public.service_interventions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES public.installed_base_assets(id) ON DELETE SET NULL,
  intervention_type TEXT NOT NULL DEFAULT 'reactive',
  description TEXT DEFAULT '',
  technician TEXT DEFAULT '',
  duration_hours NUMERIC DEFAULT 0,
  parts_used JSONB DEFAULT '[]'::jsonb,
  cost NUMERIC DEFAULT 0,
  resolution TEXT DEFAULT '',
  scheduled_date DATE,
  completed_date DATE,
  was_remote BOOLEAN DEFAULT false,
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.service_interventions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to service_interventions" ON public.service_interventions FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_service_interventions_company ON public.service_interventions(company_id);
CREATE INDEX idx_service_interventions_asset ON public.service_interventions(asset_id);

-- After-sales opportunities
CREATE TABLE public.after_sales_opportunities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES public.installed_base_assets(id) ON DELETE SET NULL,
  opportunity_type TEXT NOT NULL DEFAULT 'upsell',
  title TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  customer_name TEXT DEFAULT '',
  estimated_value NUMERIC DEFAULT 0,
  probability NUMERIC DEFAULT 50,
  trigger_signal TEXT DEFAULT '',
  recommended_action TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'identified',
  ai_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.after_sales_opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to after_sales_opportunities" ON public.after_sales_opportunities FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_after_sales_opps_company ON public.after_sales_opportunities(company_id);
CREATE TRIGGER update_after_sales_opps_updated_at BEFORE UPDATE ON public.after_sales_opportunities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.spare_parts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  part_number TEXT NOT NULL DEFAULT '',
  part_name TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'component',
  asset_type TEXT DEFAULT '',
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  selling_price NUMERIC NOT NULL DEFAULT 0,
  dynamic_price NUMERIC DEFAULT 0,
  margin_pct NUMERIC DEFAULT 0,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  min_stock_level INTEGER NOT NULL DEFAULT 0,
  reorder_point INTEGER NOT NULL DEFAULT 0,
  reorder_quantity INTEGER NOT NULL DEFAULT 0,
  lead_time_days INTEGER DEFAULT 0,
  supplier TEXT DEFAULT '',
  predicted_demand_monthly NUMERIC DEFAULT 0,
  demand_trend TEXT DEFAULT 'stable',
  criticality TEXT DEFAULT 'normal',
  last_ordered_at TIMESTAMP WITH TIME ZONE,
  total_units_sold INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.spare_parts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to spare_parts"
ON public.spare_parts FOR ALL
USING (true) WITH CHECK (true);

CREATE TRIGGER update_spare_parts_updated_at
BEFORE UPDATE ON public.spare_parts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.service_contract_parts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES public.service_contracts(id) ON DELETE CASCADE,
  part_id UUID NOT NULL REFERENCES public.spare_parts(id) ON DELETE CASCADE,
  included_qty_annual INTEGER NOT NULL DEFAULT 0,
  is_included BOOLEAN NOT NULL DEFAULT true,
  unit_price_override NUMERIC DEFAULT 0,
  predicted_consumption_annual NUMERIC DEFAULT 0,
  actual_consumption_ytd INTEGER DEFAULT 0,
  consumption_forecast JSONB DEFAULT '{}'::jsonb,
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(contract_id, part_id)
);

ALTER TABLE public.service_contract_parts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to service_contract_parts"
ON public.service_contract_parts FOR ALL
USING (true) WITH CHECK (true);

CREATE TRIGGER update_service_contract_parts_updated_at
BEFORE UPDATE ON public.service_contract_parts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add parts budget columns to service_contracts
ALTER TABLE public.service_contracts
  ADD COLUMN IF NOT EXISTS estimated_parts_cost NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parts_budget_annual NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_contract_value NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parts_consumption_forecast JSONB DEFAULT '{}'::jsonb;
-- Projects table
CREATE TABLE public.projects (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL,
  project_number text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  customer_name text DEFAULT '',
  project_type text NOT NULL DEFAULT 'machine',
  complexity text NOT NULL DEFAULT 'medium',
  risk_level text NOT NULL DEFAULT 'medium',
  duration_category text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'planning',
  health_score integer DEFAULT 0,
  scope_of_supply text DEFAULT '',
  deliverables text DEFAULT '',
  exclusions text DEFAULT '',
  contract_value numeric DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  payment_terms text DEFAULT '',
  incoterms text DEFAULT '',
  warranty_terms text DEFAULT '',
  penalties_lds text DEFAULT '',
  customization_level text DEFAULT 'standard',
  engineering_complexity text DEFAULT 'medium',
  delivery_deadline date,
  customer_requirements text DEFAULT '',
  site_constraints text DEFAULT '',
  dependencies text DEFAULT '',
  planned_start date,
  planned_end date,
  actual_start date,
  actual_end date,
  total_budget numeric DEFAULT 0,
  total_actual_cost numeric DEFAULT 0,
  total_invoiced numeric DEFAULT 0,
  total_paid numeric DEFAULT 0,
  margin_target numeric DEFAULT 0,
  margin_actual numeric DEFAULT 0,
  ai_analysis jsonb DEFAULT '{}'::jsonb,
  notes text DEFAULT '',
  offer_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to projects" ON public.projects FOR ALL USING (true) WITH CHECK (true);

-- Project phases
CREATE TABLE public.project_phases (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  phase_number integer NOT NULL DEFAULT 0,
  phase_name text NOT NULL DEFAULT '',
  description text DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  responsible text DEFAULT '',
  planned_start date,
  planned_end date,
  actual_start date,
  actual_end date,
  budget numeric DEFAULT 0,
  actual_cost numeric DEFAULT 0,
  completion_pct numeric DEFAULT 0,
  key_tasks jsonb DEFAULT '[]'::jsonb,
  control_points jsonb DEFAULT '[]'::jsonb,
  risks jsonb DEFAULT '[]'::jsonb,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_phases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to project_phases" ON public.project_phases FOR ALL USING (true) WITH CHECK (true);

-- Project milestones
CREATE TABLE public.project_milestones (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  milestone_type text NOT NULL DEFAULT 'contract',
  title text NOT NULL DEFAULT '',
  description text DEFAULT '',
  planned_date date,
  actual_date date,
  status text NOT NULL DEFAULT 'pending',
  linked_phase_id uuid REFERENCES public.project_phases(id) ON DELETE SET NULL,
  payment_amount numeric DEFAULT 0,
  payment_pct numeric DEFAULT 0,
  is_invoiced boolean DEFAULT false,
  is_paid boolean DEFAULT false,
  dependencies text DEFAULT '',
  gate_id text DEFAULT '',
  required_documents jsonb DEFAULT '[]'::jsonb,
  responsible text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to project_milestones" ON public.project_milestones FOR ALL USING (true) WITH CHECK (true);

-- Project risks
CREATE TABLE public.project_risks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  risk_title text NOT NULL DEFAULT '',
  description text DEFAULT '',
  category text DEFAULT 'operational',
  probability text NOT NULL DEFAULT 'medium',
  impact text NOT NULL DEFAULT 'medium',
  risk_score numeric DEFAULT 0,
  mitigation_action text DEFAULT '',
  contingency_plan text DEFAULT '',
  owner text DEFAULT '',
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_risks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to project_risks" ON public.project_risks FOR ALL USING (true) WITH CHECK (true);

-- Project costs
CREATE TABLE public.project_costs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'engineering',
  line_item text NOT NULL DEFAULT '',
  description text DEFAULT '',
  budget_amount numeric DEFAULT 0,
  actual_amount numeric DEFAULT 0,
  committed_amount numeric DEFAULT 0,
  variance numeric DEFAULT 0,
  variance_pct numeric DEFAULT 0,
  supplier text DEFAULT '',
  po_number text DEFAULT '',
  status text NOT NULL DEFAULT 'planned',
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to project_costs" ON public.project_costs FOR ALL USING (true) WITH CHECK (true);

-- Project gates
CREATE TABLE public.project_gates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  gate_number text NOT NULL DEFAULT 'G0',
  gate_name text NOT NULL DEFAULT '',
  description text DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  required_inputs jsonb DEFAULT '[]'::jsonb,
  required_outputs jsonb DEFAULT '[]'::jsonb,
  responsible text DEFAULT '',
  planned_date date,
  actual_date date,
  risks_if_not_passed text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_gates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to project_gates" ON public.project_gates FOR ALL USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX idx_projects_company ON public.projects(company_id);
CREATE INDEX idx_project_phases_project ON public.project_phases(project_id);
CREATE INDEX idx_project_milestones_project ON public.project_milestones(project_id);
CREATE INDEX idx_project_risks_project ON public.project_risks(project_id);
CREATE INDEX idx_project_costs_project ON public.project_costs(project_id);
CREATE INDEX idx_project_gates_project ON public.project_gates(project_id);

CREATE TABLE public.change_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  change_order_number TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'scope',
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'pending',
  requested_by TEXT DEFAULT '',
  request_date DATE DEFAULT CURRENT_DATE,
  cost_impact NUMERIC DEFAULT 0,
  schedule_impact_days INTEGER DEFAULT 0,
  margin_impact_pct NUMERIC DEFAULT 0,
  risk_impact TEXT DEFAULT 'none',
  approved_by TEXT DEFAULT '',
  approved_date DATE,
  implementation_notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.change_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to change_orders"
ON public.change_orders
FOR ALL
USING (true)
WITH CHECK (true);

CREATE TRIGGER update_change_orders_updated_at
BEFORE UPDATE ON public.change_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.cost_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  rate_type TEXT NOT NULL DEFAULT 'labour',
  rate_name TEXT NOT NULL DEFAULT '',
  rate_value NUMERIC NOT NULL DEFAULT 0,
  rate_unit TEXT NOT NULL DEFAULT 'eur_per_hour',
  department TEXT NULL DEFAULT '',
  project_type TEXT NULL DEFAULT '',
  geography TEXT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  valid_from DATE NULL DEFAULT CURRENT_DATE,
  valid_until DATE NULL DEFAULT NULL,
  notes TEXT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cost_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to cost_rates"
ON public.cost_rates
FOR ALL
USING (true)
WITH CHECK (true);

CREATE INDEX idx_cost_rates_company ON public.cost_rates(company_id);
CREATE INDEX idx_cost_rates_type ON public.cost_rates(rate_type);

CREATE TABLE public.business_intelligence_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  target_company_name TEXT NOT NULL DEFAULT '',
  target_company_website TEXT DEFAULT '',
  report_type TEXT NOT NULL DEFAULT 'full',
  status TEXT NOT NULL DEFAULT 'pending',
  executive_summary TEXT DEFAULT '',
  company_profile JSONB DEFAULT '{}'::jsonb,
  financial_analysis JSONB DEFAULT '{}'::jsonb,
  product_analysis JSONB DEFAULT '{}'::jsonb,
  market_analysis JSONB DEFAULT '{}'::jsonb,
  competitive_analysis JSONB DEFAULT '{}'::jsonb,
  strategic_analysis JSONB DEFAULT '{}'::jsonb,
  valuation JSONB DEFAULT '{}'::jsonb,
  sale_propensity JSONB DEFAULT '{}'::jsonb,
  future_scenarios JSONB DEFAULT '{}'::jsonb,
  recommendations JSONB DEFAULT '[]'::jsonb,
  data_sources JSONB DEFAULT '[]'::jsonb,
  hypothesis_log JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.business_intelligence_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to business_intelligence_reports"
  ON public.business_intelligence_reports
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_business_intelligence_reports_updated_at
  BEFORE UPDATE ON public.business_intelligence_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS website_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS linkedin_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS business_description text DEFAULT '',
  ADD COLUMN IF NOT EXISTS objectives text DEFAULT '',
  ADD COLUMN IF NOT EXISTS strategy_context text DEFAULT '',
  ADD COLUMN IF NOT EXISTS market_context text DEFAULT '',
  ADD COLUMN IF NOT EXISTS enrichment_status text DEFAULT 'pending';

-- Create company_documents table
CREATE TABLE public.company_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'general',
  file_name TEXT NOT NULL DEFAULT '',
  file_path TEXT NOT NULL DEFAULT '',
  file_size INTEGER NOT NULL DEFAULT 0,
  mime_type TEXT NOT NULL DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.company_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to company_documents"
ON public.company_documents FOR ALL
USING (true) WITH CHECK (true);

CREATE TRIGGER update_company_documents_updated_at
BEFORE UPDATE ON public.company_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('company-documents', 'company-documents', true);

CREATE POLICY "Allow public read company documents" ON storage.objects FOR SELECT USING (bucket_id = 'company-documents');
CREATE POLICY "Allow public upload company documents" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'company-documents');
CREATE POLICY "Allow public delete company documents" ON storage.objects FOR DELETE USING (bucket_id = 'company-documents');

ALTER TABLE public.company_documents 
  ADD COLUMN processing_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN extracted_data JSONB DEFAULT '{}'::jsonb;

-- Contradiction pipeline upgrade
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS contradictions_resolved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS contradiction_archive JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.ingestion_contradictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  entity_hash TEXT NOT NULL,
  entity_name TEXT NOT NULL DEFAULT '',
  field_name TEXT NOT NULL,
  value_a TEXT NOT NULL,
  value_b TEXT NOT NULL,
  source_a TEXT NOT NULL DEFAULT '',
  source_b TEXT NOT NULL DEFAULT '',
  source_doc_ids TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
  resolved_value TEXT,
  resolved_by_user_id TEXT,
  low_confidence BOOLEAN NOT NULL DEFAULT false,
  confidence_score NUMERIC,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_ingestion_contradictions_company_status
  ON public.ingestion_contradictions(company_id, status);
CREATE INDEX IF NOT EXISTS idx_ingestion_contradictions_entity
  ON public.ingestion_contradictions(entity_hash);

CREATE TABLE IF NOT EXISTS public.field_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  resolved_by TEXT,
  source_contradiction_id UUID REFERENCES public.ingestion_contradictions(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_field_history_entity ON public.field_history(entity_id);

CREATE TABLE IF NOT EXISTS public.contradiction_resolution_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  contradiction_id UUID NOT NULL REFERENCES public.ingestion_contradictions(id) ON DELETE CASCADE,
  entity_hash TEXT NOT NULL,
  field_name TEXT NOT NULL,
  value_a TEXT NOT NULL,
  value_b TEXT NOT NULL,
  resolved_value TEXT NOT NULL,
  chosen_side TEXT NOT NULL CHECK (chosen_side IN ('A', 'B', 'custom')),
  resolved_by_user_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contradiction_resolution_analytics_company
  ON public.contradiction_resolution_analytics(company_id, created_at DESC);

ALTER TABLE public.ingestion_contradictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.field_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contradiction_resolution_analytics ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ingestion_contradictions' AND policyname = 'Allow all access to ingestion contradictions'
  ) THEN
    CREATE POLICY "Allow all access to ingestion contradictions"
      ON public.ingestion_contradictions FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'field_history' AND policyname = 'Allow all access to field history'
  ) THEN
    CREATE POLICY "Allow all access to field history"
      ON public.field_history FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'contradiction_resolution_analytics' AND policyname = 'Allow all access to contradiction analytics'
  ) THEN
    CREATE POLICY "Allow all access to contradiction analytics"
      ON public.contradiction_resolution_analytics FOR ALL USING (true) WITH CHECK (true);
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.append_company_contradiction_archive(
  p_company_id UUID,
  p_entity_hash TEXT,
  p_field_name TEXT,
  p_values JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  archive_key TEXT;
BEGIN
  archive_key := concat(p_entity_hash, ':', p_field_name, ':', extract(epoch FROM now())::BIGINT::TEXT);

  UPDATE public.companies
  SET contradiction_archive = COALESCE(contradiction_archive, '{}'::jsonb) || jsonb_build_object(archive_key, p_values),
      contradictions_resolved_at = now()
  WHERE id = p_company_id;
END;
$$;
