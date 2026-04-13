
ALTER TABLE public.company_documents 
  ADD COLUMN processing_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN extracted_data JSONB DEFAULT '{}'::jsonb;
