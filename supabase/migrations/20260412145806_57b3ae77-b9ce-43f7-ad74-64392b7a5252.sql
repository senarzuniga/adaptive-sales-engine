
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
