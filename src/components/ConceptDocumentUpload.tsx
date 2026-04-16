import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useData } from '@/store/DataStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { classifyProcessingError } from '@/lib/documentProcessing';
import { buildFallbackExtraction } from '@/lib/documentFallback';
import {
  Upload, FileText, Trash2, Users, Target, ShoppingCart, Briefcase,
  Package, FileBarChart, Building2, UserCheck, DollarSign,
  Globe, Handshake, TrendingUp, Settings, BookOpen, Truck, Shield,
  Landmark, Layers, ClipboardList, Brain, CheckCircle, AlertCircle, Loader2
} from 'lucide-react';

const DOCUMENT_CATEGORIES = [
  { key: 'contacts', label: 'Contacts', icon: Users, color: 'bg-blue-500/10 text-blue-600' },
  { key: 'leads', label: 'Leads & Prospects', icon: Target, color: 'bg-green-500/10 text-green-600' },
  { key: 'customers', label: 'Customers & Accounts', icon: Briefcase, color: 'bg-purple-500/10 text-purple-600' },
  { key: 'sales', label: 'Sales Data', icon: ShoppingCart, color: 'bg-orange-500/10 text-orange-600' },
  { key: 'offers', label: 'Offers & Proposals', icon: ClipboardList, color: 'bg-cyan-500/10 text-cyan-600' },
  { key: 'strategy', label: 'Strategy & Plans', icon: TrendingUp, color: 'bg-indigo-500/10 text-indigo-600' },
  { key: 'products', label: 'Products & Services', icon: Package, color: 'bg-pink-500/10 text-pink-600' },
  { key: 'reports', label: 'Reports & Analysis', icon: FileBarChart, color: 'bg-amber-500/10 text-amber-600' },
  { key: 'hierarchy', label: 'Company Hierarchy', icon: Building2, color: 'bg-slate-500/10 text-slate-600' },
  { key: 'employees', label: 'Employees & Org Chart', icon: UserCheck, color: 'bg-teal-500/10 text-teal-600' },
  { key: 'finance', label: 'Finance & Accounting', icon: DollarSign, color: 'bg-emerald-500/10 text-emerald-600' },
  { key: 'market', label: 'Market Intelligence', icon: Globe, color: 'bg-violet-500/10 text-violet-600' },
  { key: 'competitors', label: 'Competitors', icon: Handshake, color: 'bg-red-500/10 text-red-600' },
  { key: 'operations', label: 'Operations & Processes', icon: Settings, color: 'bg-gray-500/10 text-gray-600' },
  { key: 'contracts', label: 'Contracts & Agreements', icon: BookOpen, color: 'bg-yellow-500/10 text-yellow-600' },
  { key: 'logistics', label: 'Logistics & Supply Chain', icon: Truck, color: 'bg-lime-500/10 text-lime-600' },
  { key: 'compliance', label: 'Compliance & Legal', icon: Shield, color: 'bg-rose-500/10 text-rose-600' },
  { key: 'investments', label: 'Investments & Assets', icon: Landmark, color: 'bg-sky-500/10 text-sky-600' },
  { key: 'general', label: 'General / Other', icon: Layers, color: 'bg-muted text-muted-foreground' },
];

interface DocFile {
  id: string;
  company_id?: string;
  category: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  file_path: string;
  created_at: string;
  processing_status: string;
  extracted_data: any;
}

const statusConfig: Record<string, { icon: typeof CheckCircle; className: string; label: string }> = {
  pending: { icon: Brain, className: 'text-muted-foreground', label: 'Pending' },
  processing: { icon: Loader2, className: 'text-primary animate-spin', label: 'AI Processing...' },
  completed: { icon: CheckCircle, className: 'text-green-600', label: 'Processed' },
  failed: { icon: AlertCircle, className: 'text-destructive', label: 'Failed' },
};

const isTransientNetworkError = (msg: string) => {
  const lower = (msg || '').toLowerCase();
  return lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('load failed');
};

const sanitizeFileName = (name: string) =>
  name
    .normalize('NFKD')
    .replace(/[^\u0020-\u007E]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_');

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const MAX_PROCESS_RETRIES = 3;
const categoryTableMapping: Record<string, string> = {
  contacts: 'company_contacts',
  leads: 'company_contacts',
  customers: 'company_contacts',
  sales: 'orders',
  offers: 'opportunities',
  strategy: 'strategy',
  products: 'products',
  employees: 'company_contacts',
};

export function ConceptDocumentUpload() {
  const { activeCompanyId } = useData();
  const [documents, setDocuments] = useState<DocFile[]>([]);
  const [dragOverCategory, setDragOverCategory] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const loadDocuments = useCallback(async () => {
    if (!activeCompanyId) return;
    try {
      const { data, error } = await supabase
        .from('company_documents')
        .select('*')
        .eq('company_id', activeCompanyId)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('loadDocuments error:', error.message);
        return;
      }
      if (data) setDocuments(data as DocFile[]);
    } catch (err) {
      console.error('loadDocuments request failed:', err);
    }
  }, [activeCompanyId]);

  useEffect(() => {
    if (activeCompanyId) loadDocuments();
  }, [activeCompanyId, loadDocuments]);

  // Poll for processing status updates
  useEffect(() => {
    if (processingIds.size === 0) return;
    const interval = setInterval(async () => {
      await loadDocuments();
      setProcessingIds(prev => {
        const next = new Set(prev);
        documents.forEach(d => {
          if (next.has(d.id) && (d.processing_status === 'completed' || d.processing_status === 'failed')) {
            next.delete(d.id);
            if (d.processing_status === 'completed') {
              const ext = (d.extracted_data as any);
              const semanticCounts = ext?.semantic_counts;
              const semanticDetail = semanticCounts
                ? `, ${semanticCounts.entities || 0} entities / ${semanticCounts.relationships || 0} relationships`
                : '';
              toast({
                title: `âœ… ${d.file_name} processed`,
                description: `${ext?.summary || 'Data extracted'} (${ext?.record_count || 0} records${semanticDetail}, confidence: ${ext?.confidence_score || 'N/A'}%)`,
              });
            } else {
              toast({ title: `âŒ ${d.file_name} processing failed`, variant: 'destructive' });
            }
          }
        });
        return next;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [processingIds, documents, loadDocuments]);

  const ensureDocumentRow = useCallback(async (filePath: string, file: File, category: string) => {
    if (!activeCompanyId) return null;

    const { data: existing, error: existingError } = await supabase
      .from('company_documents')
      .select('*')
      .eq('company_id', activeCompanyId)
      .eq('file_path', filePath)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing) return existing;

    const { data: created, error: dbError } = await supabase.from('company_documents').insert({
      company_id: activeCompanyId,
      category,
      file_name: file.name,
      file_path: filePath,
      file_size: file.size,
      mime_type: file.type || 'application/octet-stream',
    }).select().single();

    if (dbError) throw dbError;
    return created;
  }, [activeCompanyId]);

  const recoverUpload = useCallback(async (filePath: string, file: File, category: string) => {
    if (!activeCompanyId) return null;

    const folder = `${activeCompanyId}/${category}`;
    const storageName = filePath.split('/').pop() || '';

    const { data: objects, error } = await supabase.storage
      .from('company-documents')
      .list(folder, { limit: 100 });

    if (error) throw error;

    const existsInStorage = (objects || []).some((obj: any) => obj.name === storageName);
    if (!existsInStorage) return null;

    return await ensureDocumentRow(filePath, file, category);
  }, [activeCompanyId, ensureDocumentRow]);

  const readFunctionError = useCallback(async (error: any) => {
    const status = error?.context?.status ?? error?.status;
    let message = error?.message || 'Unexpected processing error';

    try {
      const payload = await error?.context?.json?.();
      if (payload?.error) {
        message = payload.error;
      }
    } catch {
      // Keep the original error message when no JSON body is available.
    }

    return { message, status };
  }, []);

  const applyLocalFallback = useCallback(async (docId: string, reason: string) => {
    const existingDoc = documents.find((doc) => doc.id === docId);
    const doc = existingDoc ?? await (async () => {
      const { data } = await supabase.from('company_documents').select('*').eq('id', docId).maybeSingle();
      return data as DocFile | null;
    })();

    if (!doc) return false;

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('company-documents')
      .download(doc.file_path);

    if (downloadError || !fileData) {
      console.error('Local fallback download failed:', downloadError);
      return false;
    }

    const isTextFile = doc.mime_type?.includes('text') || /\.(csv|txt|json|md)$/i.test(doc.file_name);
    const content = isTextFile ? await fileData.text() : await fileData.arrayBuffer();
    const targetTable = categoryTableMapping[doc.category] || 'none';
    const fallbackData = buildFallbackExtraction(
      { category: doc.category, fileName: doc.file_name, targetTable },
      content,
    );

    fallbackData.data_quality_notes = [...(fallbackData.data_quality_notes || []), reason];

    const { error: updateError } = await supabase
      .from('company_documents')
      .update({ processing_status: 'completed', extracted_data: fallbackData as any })
      .eq('id', doc.id);

    if (updateError) {
      console.error('Local fallback update failed:', updateError);
      return false;
    }

    const companyId = doc.company_id || activeCompanyId;
    if (companyId && fallbackData.extracted_records?.length > 0 && targetTable !== 'none') {
      const payload = fallbackData.extracted_records.map((row: any) => ({ ...row, company_id: companyId }));
      const uniquePayload = payload.filter((row: any, index: number, items: any[]) => {
        const key = JSON.stringify(row);
        return items.findIndex((candidate) => JSON.stringify(candidate) === key) === index;
      });

      const { error: insertError } = await supabase.from(targetTable).insert(uniquePayload as any);
      if (insertError) {
        console.error('Local fallback insert failed:', insertError.message);
      }
    }

    await loadDocuments();
    toast({
      title: fallbackData.record_count > 0 ? 'Basic extraction complete' : 'Document saved for manual review',
      description: fallbackData.summary,
    });
    return true;
  }, [activeCompanyId, documents, loadDocuments]);

  const processDocument = useCallback(async (docId: string) => {
    setProcessingIds(prev => new Set(prev).add(docId));
    try {
      for (let attempt = 1; attempt <= MAX_PROCESS_RETRIES; attempt++) {
        const { data, error } = await supabase.functions.invoke('process-document', {
          body: { documentId: docId },
        });

        if (!error) {
          await loadDocuments();
          if (data?.success) {
            toast({
              title: 'AI Data Extraction Complete',
              description: `${data.summary} â€” ${data.recordCount} records saved (confidence: ${data.confidence}%)`,
            });
          }
          return;
        }

        const details = classifyProcessingError(await readFunctionError(error));
        if (details.retryable && attempt < MAX_PROCESS_RETRIES) {
          toast({
            title: 'Retrying AI processing...',
            description: `${details.description} Retry ${attempt}/${MAX_PROCESS_RETRIES}.`,
          });
          await wait(1500 * attempt);
          continue;
        }

        if (!details.retryable && await applyLocalFallback(docId, details.description)) {
          return;
        }

        toast({
          title: details.title,
          description: details.description,
          variant: details.retryable ? 'default' : 'destructive',
        });
        return;
      }
    } catch (err: any) {
      const details = classifyProcessingError(await readFunctionError(err));
      if (!details.retryable && await applyLocalFallback(docId, details.description)) {
        return;
      }
      toast({
        title: details.title,
        description: details.description,
        variant: details.retryable ? 'default' : 'destructive',
      });
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(docId);
        return next;
      });
      await loadDocuments();
    }
  }, [applyLocalFallback, loadDocuments, readFunctionError]);

  const uploadFile = useCallback(async (file: File, category: string) => {
    if (!activeCompanyId) return;
    setUploading(category);
    let uploadSaved = false;
    const safeFileName = sanitizeFileName(file.name);
    const filePath = `${activeCompanyId}/${category}/${Date.now()}_${safeFileName}`;

    try {
      let inserted: any = null;
      let lastError: any = null;

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const { error: uploadError } = await supabase.storage
            .from('company-documents')
            .upload(filePath, file, { upsert: true });
          if (uploadError) throw uploadError;

          uploadSaved = true;
          inserted = await ensureDocumentRow(filePath, file, category);
          break;
        } catch (err: any) {
          lastError = err;
          const msg = err?.message || 'Unexpected error';
          if (attempt < 3 && isTransientNetworkError(msg)) {
            toast({
              title: 'Retrying upload...',
              description: `${file.name} hit a temporary connection issue. Retrying automatically (${attempt}/3).`,
            });
            await wait(1000 * attempt);
            continue;
          }
          throw err;
        }
      }

      if (!inserted && lastError) throw lastError;

      toast({ title: `ðŸ“„ ${file.name}`, description: `Uploaded â†’ AI agent will now process it...` });
      await loadDocuments();

      if (inserted) {
        await processDocument(inserted.id);
      }
    } catch (err: any) {
      const msg: string = err?.message || 'Unexpected error';
      const isNetworkError = isTransientNetworkError(msg);

      if (isNetworkError) {
        try {
          const recovered = await recoverUpload(filePath, file, category);
          if (recovered) {
            toast({
              title: 'File uploaded successfully',
              description: 'The connection briefly failed, but the file was recovered and saved.',
            });
            await loadDocuments();
            await processDocument(recovered.id);
            return;
          }
        } catch (recoveryErr) {
          console.error('Upload recovery failed:', recoveryErr);
        }
      }

      toast({
        title: uploadSaved ? 'File uploaded â€” refresh delayed' : isNetworkError ? 'Connection issue during upload' : 'Upload failed',
        description: uploadSaved
          ? 'The file appears to be saved already. Refresh the page and check the document list in a moment.'
          : isNetworkError
            ? 'The file could not finish uploading after automatic retries. Please try once more.'
            : msg,
        variant: uploadSaved ? 'default' : 'destructive'
      });
    } finally {
      setUploading(null);
    }
  }, [activeCompanyId, ensureDocumentRow, loadDocuments, processDocument, recoverUpload]);

  const deleteDocument = useCallback(async (doc: DocFile) => {
    await supabase.storage.from('company-documents').remove([doc.file_path]);
    await supabase.from('company_documents').delete().eq('id', doc.id);
    toast({ title: 'Document removed' });
    await loadDocuments();
  }, [loadDocuments]);

  const handleDrop = useCallback(async (e: React.DragEvent, category: string) => {
    e.preventDefault();
    setDragOverCategory(null);
    for (const f of Array.from(e.dataTransfer.files)) {
      await uploadFile(f, category);
    }
  }, [uploadFile]);

  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>, category: string) => {
    for (const f of Array.from(e.target.files || [])) {
      await uploadFile(f, category);
    }
    e.target.value = '';
  }, [uploadFile]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  if (!activeCompanyId) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          Select a company to upload concept documents
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          AI Document Library
        </h3>
        <p className="text-sm text-muted-foreground">
          Drop any file into a category box. The AI Data Agent automatically interprets, extracts, and saves structured data to the company database.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {DOCUMENT_CATEGORIES.map(cat => {
          const catDocs = documents.filter(d => d.category === cat.key);
          const Icon = cat.icon;
          const isDragOver = dragOverCategory === cat.key;
          const isUploading = uploading === cat.key;

          return (
            <Card
              key={cat.key}
              className={`transition-all ${isDragOver ? 'ring-2 ring-primary border-primary bg-primary/5' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragOverCategory(cat.key); }}
              onDragLeave={() => setDragOverCategory(null)}
              onDrop={e => handleDrop(e, cat.key)}
            >
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`p-1.5 rounded ${cat.color}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-sm font-medium text-foreground flex-1">{cat.label}</span>
                  {catDocs.length > 0 && (
                    <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground font-medium">
                      {catDocs.length}
                    </span>
                  )}
                </div>

                <label className="block cursor-pointer">
                  <input type="file" className="hidden" multiple onChange={e => handleFileInput(e, cat.key)} />
                  <div className={`border border-dashed rounded-lg p-3 text-center transition-colors hover:border-primary/50 hover:bg-muted/30 ${isDragOver ? 'border-primary bg-primary/5' : 'border-border'}`}>
                    {isUploading ? (
                      <p className="text-xs text-muted-foreground animate-pulse">Uploading...</p>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                        <p className="text-[11px] text-muted-foreground">Drop files or click</p>
                      </>
                    )}
                  </div>
                </label>

                {catDocs.length > 0 && (
                  <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
                    {catDocs.map(doc => {
                      const status = statusConfig[doc.processing_status] || statusConfig.pending;
                      const StatusIcon = status.icon;
                      const isProcessing = processingIds.has(doc.id) || doc.processing_status === 'processing';
                      const extracted = doc.extracted_data as any;
                      const recordCount = extracted?.record_count || extracted?.extracted_records?.length || 0;

                      return (
                        <div key={doc.id} className="flex items-center gap-1.5 group text-xs">
                          <StatusIcon className={`h-3 w-3 flex-shrink-0 ${isProcessing ? 'text-primary animate-spin' : status.className}`} />
                          <span className="truncate flex-1 text-foreground" title={doc.file_name}>
                            {doc.file_name}
                          </span>
                          {doc.processing_status === 'completed' && recordCount > 0 && (
                            <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                              {recordCount} rec
                            </Badge>
                          )}
                          <span className="text-[10px] text-muted-foreground flex-shrink-0">
                            {formatSize(doc.file_size)}
                          </span>
                          {doc.processing_status === 'failed' && (
                            <Button
                              variant="ghost" size="sm"
                              className="h-4 px-1 text-[9px] text-primary"
                              onClick={() => processDocument(doc.id)}
                            >
                              Retry
                            </Button>
                          )}
                          <Button
                            variant="ghost" size="sm"
                            className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteDocument(doc)}
                          >
                            <Trash2 className="h-2.5 w-2.5" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
