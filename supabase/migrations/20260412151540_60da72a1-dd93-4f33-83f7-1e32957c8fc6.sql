
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
