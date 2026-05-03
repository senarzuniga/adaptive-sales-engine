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
