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