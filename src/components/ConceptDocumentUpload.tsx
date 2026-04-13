import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useData } from '@/store/DataStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import {
  Upload, FileText, Trash2, Users, Target, ShoppingCart, Briefcase,
  BarChart3, Package, FileBarChart, Building2, UserCheck, DollarSign,
  Globe, Handshake, TrendingUp, Settings, BookOpen, Truck, Shield,
  Landmark, Layers, ClipboardList
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
  category: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  file_path: string;
  created_at: string;
}

export function ConceptDocumentUpload() {
  const { activeCompanyId } = useData();
  const [documents, setDocuments] = useState<DocFile[]>([]);
  const [dragOverCategory, setDragOverCategory] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const loadDocuments = useCallback(async () => {
    if (!activeCompanyId) return;
    const { data } = await supabase
      .from('company_documents')
      .select('*')
      .eq('company_id', activeCompanyId)
      .order('created_at', { ascending: false });
    if (data) setDocuments(data as DocFile[]);
    setLoaded(true);
  }, [activeCompanyId]);

  if (!loaded && activeCompanyId) loadDocuments();

  const uploadFile = useCallback(async (file: File, category: string) => {
    if (!activeCompanyId) return;
    setUploading(category);
    try {
      const filePath = `${activeCompanyId}/${category}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('company-documents')
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from('company_documents').insert({
        company_id: activeCompanyId,
        category,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type || 'application/octet-stream',
      });
      if (dbError) throw dbError;

      toast({ title: `📄 ${file.name}`, description: `Uploaded to ${DOCUMENT_CATEGORIES.find(c => c.key === category)?.label}` });
      await loadDocuments();
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(null);
    }
  }, [activeCompanyId, loadDocuments]);

  const deleteDocument = useCallback(async (doc: DocFile) => {
    await supabase.storage.from('company-documents').remove([doc.file_path]);
    await supabase.from('company_documents').delete().eq('id', doc.id);
    toast({ title: 'Document removed' });
    await loadDocuments();
  }, [loadDocuments]);

  const handleDrop = useCallback((e: React.DragEvent, category: string) => {
    e.preventDefault();
    setDragOverCategory(null);
    Array.from(e.dataTransfer.files).forEach(f => uploadFile(f, category));
  }, [uploadFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>, category: string) => {
    Array.from(e.target.files || []).forEach(f => uploadFile(f, category));
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
        <h3 className="text-lg font-semibold text-foreground">Document Library by Concept</h3>
        <p className="text-sm text-muted-foreground">
          Drop any file (PDF, Word, Excel, images, etc.) into the relevant category box. No specific format required.
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

                {/* Drop zone */}
                <label className="block cursor-pointer">
                  <input
                    type="file"
                    className="hidden"
                    multiple
                    onChange={e => handleFileInput(e, cat.key)}
                  />
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

                {/* File list */}
                {catDocs.length > 0 && (
                  <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                    {catDocs.map(doc => (
                      <div key={doc.id} className="flex items-center gap-1.5 group text-xs">
                        <FileText className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <span className="truncate flex-1 text-foreground" title={doc.file_name}>
                          {doc.file_name}
                        </span>
                        <span className="text-[10px] text-muted-foreground flex-shrink-0">
                          {formatSize(doc.file_size)}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteDocument(doc)}
                        >
                          <Trash2 className="h-2.5 w-2.5" />
                        </Button>
                      </div>
                    ))}
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
