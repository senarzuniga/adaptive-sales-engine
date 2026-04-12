CREATE TABLE public.marketing_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  summary TEXT DEFAULT '',
  content_type TEXT NOT NULL DEFAULT 'update',
  platform TEXT NOT NULL DEFAULT 'linkedin',
  hashtags TEXT[] DEFAULT '{}',
  call_to_action TEXT DEFAULT '',
  suggested_image_description TEXT DEFAULT '',
  alternative_versions JSONB DEFAULT '[]'::jsonb,
  intelligence_sources JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  scheduled_at TIMESTAMP WITH TIME ZONE,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to marketing_content"
ON public.marketing_content
FOR ALL
USING (true)
WITH CHECK (true);

CREATE INDEX idx_marketing_content_company ON public.marketing_content(company_id);
CREATE INDEX idx_marketing_content_status ON public.marketing_content(status);
CREATE INDEX idx_marketing_content_scheduled ON public.marketing_content(scheduled_at);

CREATE TRIGGER update_marketing_content_updated_at
BEFORE UPDATE ON public.marketing_content
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();