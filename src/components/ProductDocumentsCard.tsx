import { useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isSupabaseConfigured } from '@/store/DataStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { ExternalLink, FileText, Link2, Loader2, Trash2, Upload } from 'lucide-react';

const STORAGE_BUCKET = 'company-documents';
const STORAGE_PREFIX = `supabase://${STORAGE_BUCKET}/`;
const MAX_FILE_SIZE = 25 * 1024 * 1024;

type ProductDocumentReference = {
  raw: string;
  label: string;
  kind: 'storage' | 'url' | 'text';
  storagePath?: string;
};

const sanitizeFileName = (name: string) => name
  .normalize('NFKD')
  .replace(/[^\u0020-\u007E]/g, '')
  .replace(/[^a-zA-Z0-9._-]+/g, '_')
  .replace(/_+/g, '_');

const slugify = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'product';

const buildStorageReference = (path: string) => `${STORAGE_PREFIX}${path}`;

const parseProductDocumentReference = (raw: string): ProductDocumentReference => {
  const value = raw.trim();
  if (value.startsWith(STORAGE_PREFIX)) {
    const storagePath = value.slice(STORAGE_PREFIX.length);
    const fileName = storagePath.split('/').pop() || storagePath;
    return { raw, kind: 'storage', storagePath, label: fileName.replace(/^\d{10,}_/, '') };
  }
  if (/^https?:\/\//i.test(value)) return { raw, kind: 'url', label: value };
  return { raw, kind: 'text', label: value };
};

type Props = {
  productName: string;
  companyId: string | null;
  references: string[];
  isEditing: boolean;
  onChange: (references: string[]) => void;
};

export function ProductDocumentsCard({ productName, companyId, references, isEditing, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [openingPath, setOpeningPath] = useState<string | null>(null);
  const [manualReference, setManualReference] = useState('');
  const parsed = references.map(parseProductDocumentReference).filter((item) => item.label);

  const addReferences = (next: string[]) => {
    const merged = Array.from(new Set([...references.map((item) => item.trim()).filter(Boolean), ...next]));
    onChange(merged);
  };

  const addManualReference = () => {
    const value = manualReference.trim();
    if (!value) return;
    addReferences([value]);
    setManualReference('');
  };

  const uploadFile = async (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      toast({ title: 'File too large', description: `${file.name} exceeds the 25 MB limit.`, variant: 'destructive' });
      return null;
    }
    if (!isSupabaseConfigured || !companyId) {
      // Local-only mode: keep the reference so the ficha stays traceable, but binary storage is unavailable.
      toast({ title: 'Reference registered locally', description: `${file.name} was linked by name. Configure Supabase to store the file itself.` });
      return `${file.name} (local reference, not uploaded)`;
    }
    const filePath = `${companyId}/products/${slugify(productName)}/${Date.now()}_${sanitizeFileName(file.name)}`;
    const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(filePath, file, { upsert: true });
    if (uploadError) throw uploadError;
    const { error: rowError } = await supabase.from('company_documents').insert({
      company_id: companyId,
      category: 'products',
      file_name: file.name,
      file_path: filePath,
      file_size: file.size,
      mime_type: file.type || 'application/octet-stream',
    });
    if (rowError) console.error('company_documents insert failed', rowError.message);
    return buildStorageReference(filePath);
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const added: string[] = [];
    try {
      for (const file of Array.from(files)) {
        const reference = await uploadFile(file);
        if (reference) added.push(reference);
      }
      if (added.length > 0) {
        addReferences(added);
        toast({ title: 'Documentation attached', description: `${added.length} file reference(s) added. Save the catalog to persist them.` });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unexpected upload error';
      toast({ title: 'Upload failed', description: message, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const openStorageDocument = async (storagePath: string) => {
    setOpeningPath(storagePath);
    try {
      const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(storagePath, 60 * 60);
      if (error || !data?.signedUrl) throw error || new Error('No signed URL returned');
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to open document';
      toast({ title: 'Could not open document', description: message, variant: 'destructive' });
    } finally {
      setOpeningPath(null);
    }
  };

  const removeReference = (raw: string) => onChange(references.filter((item) => item !== raw));

  return (
    <Card className="bg-muted/30">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Documentation and reports</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Datasheets, technical reports, offers and evidence linked to this ficha.</p>
        </div>
        {isEditing ? (
          <>
            <input ref={inputRef} type="file" className="hidden" multiple onChange={(event) => void handleFiles(event.target.files)} />
            <Button variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
              {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
              Upload files
            </Button>
          </>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-2">
        {isEditing ? (
          <div className="flex gap-2">
            <Input
              value={manualReference}
              onChange={(event) => setManualReference(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addManualReference(); } }}
              placeholder="Paste a report URL or a repository path, then press Enter"
            />
            <Button variant="outline" size="sm" className="h-10" onClick={addManualReference} disabled={!manualReference.trim()}><Link2 className="h-4 w-4 mr-1" />Add link</Button>
          </div>
        ) : null}
        {parsed.length === 0 ? <p className="text-sm text-muted-foreground">No documentation attached yet.</p> : null}
        {parsed.map((item) => (
          <div key={item.raw} className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2 text-sm">
            <div className="min-w-0 flex items-center gap-2">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate" title={item.label}>{item.label}</span>
              <Badge variant="outline" className="text-[10px] shrink-0">{item.kind === 'storage' ? 'file' : item.kind === 'url' ? 'link' : 'reference'}</Badge>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {item.kind === 'storage' && item.storagePath ? (
                <Button variant="ghost" size="sm" disabled={openingPath === item.storagePath} onClick={() => void openStorageDocument(item.storagePath as string)}>
                  {openingPath === item.storagePath ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                </Button>
              ) : null}
              {item.kind === 'url' ? (
                <Button variant="ghost" size="sm" asChild><a href={item.raw.trim()} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a></Button>
              ) : null}
              {isEditing ? <Button variant="ghost" size="sm" onClick={() => removeReference(item.raw)}><Trash2 className="h-4 w-4" /></Button> : null}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}