
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
