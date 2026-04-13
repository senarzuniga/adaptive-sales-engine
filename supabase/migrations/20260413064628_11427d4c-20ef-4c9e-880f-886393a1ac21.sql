
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
