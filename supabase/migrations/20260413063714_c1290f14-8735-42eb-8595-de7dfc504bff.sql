
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
