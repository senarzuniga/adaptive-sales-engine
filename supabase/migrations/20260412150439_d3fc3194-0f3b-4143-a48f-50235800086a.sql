
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
