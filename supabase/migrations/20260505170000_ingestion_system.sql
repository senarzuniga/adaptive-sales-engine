-- =============================================================================
-- Ingestion System Tables
-- Multi-agent competitive intelligence pipeline for corrugated machinery sector
-- =============================================================================

-- --------------------------------------------------------------------------
-- 1. ingestion_raw_html  (raw scrape archive)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ingestion_raw_html (
    id              bigserial PRIMARY KEY,
    source_id       text        NOT NULL,
    source_name     text        NOT NULL,
    url             text        NOT NULL,
    html_content    text,
    content_hash    text        NOT NULL,
    captured_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ingestion_raw_html_source_id_idx  ON public.ingestion_raw_html (source_id);
CREATE INDEX IF NOT EXISTS ingestion_raw_html_captured_at_idx ON public.ingestion_raw_html (captured_at DESC);

-- --------------------------------------------------------------------------
-- 2. ingestion_errors  (scrape / extraction failure log)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ingestion_errors (
    id              bigserial PRIMARY KEY,
    source_id       text        NOT NULL,
    source_name     text        NOT NULL,
    url             text        NOT NULL,
    error_message   text,
    captured_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ingestion_errors_source_id_idx ON public.ingestion_errors (source_id);

-- --------------------------------------------------------------------------
-- 3. ingestion_structured_data  (normalised / deduplicated facts)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ingestion_structured_data (
    id                  bigserial PRIMARY KEY,
    source_id           text        NOT NULL,
    source_name         text        NOT NULL,
    url                 text        NOT NULL,
    data_type           text        NOT NULL,
    normalized_content  jsonb       NOT NULL DEFAULT '{}',
    confidence_score    numeric(4,3) CHECK (confidence_score BETWEEN 0 AND 1),
    dedupe_key          text        NOT NULL UNIQUE,
    normalized_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ingestion_structured_data_source_id_idx  ON public.ingestion_structured_data (source_id);
CREATE INDEX IF NOT EXISTS ingestion_structured_data_data_type_idx   ON public.ingestion_structured_data (data_type);
CREATE INDEX IF NOT EXISTS ingestion_structured_data_normalized_at_idx ON public.ingestion_structured_data (normalized_at DESC);

-- --------------------------------------------------------------------------
-- 4. intelligence_outputs  (derived pricing / competitive / trend signals)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.intelligence_outputs (
    id              bigserial PRIMARY KEY,
    type            text        NOT NULL,          -- pricing_alert | competitor_movement | market_trend | sales_opportunity
    title           text        NOT NULL,
    description     text,
    impact          text        NOT NULL CHECK (impact IN ('high','medium','low')),
    suggested_action text,
    source_url      text,
    source_id       text,
    payload         jsonb       NOT NULL DEFAULT '{}',
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS intelligence_outputs_type_idx       ON public.intelligence_outputs (type);
CREATE INDEX IF NOT EXISTS intelligence_outputs_impact_idx     ON public.intelligence_outputs (impact);
CREATE INDEX IF NOT EXISTS intelligence_outputs_created_at_idx ON public.intelligence_outputs (created_at DESC);

-- --------------------------------------------------------------------------
-- 5. competitive_intelligence  (per-product competitor price snapshot)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.competitive_intelligence (
    id               bigserial PRIMARY KEY,
    competitor       text        NOT NULL,
    product_category text        NOT NULL,
    price            numeric,
    currency         text        DEFAULT 'EUR',
    specs            jsonb       NOT NULL DEFAULT '{}',
    source_url       text,
    last_updated     timestamptz NOT NULL DEFAULT now(),
    UNIQUE (competitor, product_category, source_url)
);

CREATE INDEX IF NOT EXISTS competitive_intelligence_category_idx ON public.competitive_intelligence (product_category);
CREATE INDEX IF NOT EXISTS competitive_intelligence_competitor_idx ON public.competitive_intelligence (competitor);

-- --------------------------------------------------------------------------
-- RLS — service-role writes, anon reads only for intelligence_outputs
-- --------------------------------------------------------------------------
ALTER TABLE public.ingestion_raw_html          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingestion_errors            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingestion_structured_data   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intelligence_outputs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitive_intelligence    ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read intelligence and competitive data
DROP POLICY IF EXISTS "Authenticated users read intelligence" ON public.intelligence_outputs;
CREATE POLICY "Authenticated users read intelligence"
    ON public.intelligence_outputs FOR SELECT
    TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users read competitive intel" ON public.competitive_intelligence;
CREATE POLICY "Authenticated users read competitive intel"
    ON public.competitive_intelligence FOR SELECT
    TO authenticated USING (true);

-- Service role bypass (write from Python pipeline)
DROP POLICY IF EXISTS "Service role full access ingestion_raw_html" ON public.ingestion_raw_html;
CREATE POLICY "Service role full access ingestion_raw_html"
    ON public.ingestion_raw_html FOR ALL
    TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access ingestion_errors" ON public.ingestion_errors;
CREATE POLICY "Service role full access ingestion_errors"
    ON public.ingestion_errors FOR ALL
    TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access ingestion_structured_data" ON public.ingestion_structured_data;
CREATE POLICY "Service role full access ingestion_structured_data"
    ON public.ingestion_structured_data FOR ALL
    TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access intelligence_outputs" ON public.intelligence_outputs;
CREATE POLICY "Service role full access intelligence_outputs"
    ON public.intelligence_outputs FOR ALL
    TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access competitive_intelligence" ON public.competitive_intelligence;
CREATE POLICY "Service role full access competitive_intelligence"
    ON public.competitive_intelligence FOR ALL
    TO service_role USING (true) WITH CHECK (true);
