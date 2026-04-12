CREATE TABLE public.social_media_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  platform text NOT NULL DEFAULT '',
  profile_url text NOT NULL DEFAULT '',
  account_name text NOT NULL DEFAULT '',
  is_enabled boolean NOT NULL DEFAULT false,
  api_credentials jsonb DEFAULT '{}'::jsonb,
  posting_preferences jsonb DEFAULT '{"auto_post": false, "content_types": ["article", "update"], "frequency": "manual"}'::jsonb,
  notes text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.social_media_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to social_media_accounts"
  ON public.social_media_accounts
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_social_media_accounts_updated_at
  BEFORE UPDATE ON public.social_media_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();