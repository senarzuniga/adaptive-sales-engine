ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS website_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS linkedin_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS business_description text DEFAULT '',
  ADD COLUMN IF NOT EXISTS objectives text DEFAULT '',
  ADD COLUMN IF NOT EXISTS strategy_context text DEFAULT '',
  ADD COLUMN IF NOT EXISTS market_context text DEFAULT '',
  ADD COLUMN IF NOT EXISTS enrichment_status text DEFAULT 'pending';