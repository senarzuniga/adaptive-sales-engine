
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
