
-- Create company_documents table
CREATE TABLE public.company_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'general',
  file_name TEXT NOT NULL DEFAULT '',
  file_path TEXT NOT NULL DEFAULT '',
  file_size INTEGER NOT NULL DEFAULT 0,
  mime_type TEXT NOT NULL DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.company_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to company_documents"
ON public.company_documents FOR ALL
USING (true) WITH CHECK (true);

CREATE TRIGGER update_company_documents_updated_at
BEFORE UPDATE ON public.company_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('company-documents', 'company-documents', true);

CREATE POLICY "Allow public read company documents" ON storage.objects FOR SELECT USING (bucket_id = 'company-documents');
CREATE POLICY "Allow public upload company documents" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'company-documents');
CREATE POLICY "Allow public delete company documents" ON storage.objects FOR DELETE USING (bucket_id = 'company-documents');
