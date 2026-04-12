import { useState, useRef } from 'react';
import { useData } from '@/store/DataStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Plus, Trash2, Download, Upload, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export function CompanySelector() {
  const { companies, activeCompanyId, setActiveCompany, createCompany, deleteCompany, exportCompanyPack, importCompanyPack, loading } = useData();
  const [newName, setNewName] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const id = await createCompany(newName.trim());
    if (id) {
      setActiveCompany(id);
      setNewName('');
      setDialogOpen(false);
      toast({ title: `Company "${newName.trim()}" created` });
    }
  };

  const handleExport = async () => {
    const json = await exportCompanyPack();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const company = companies.find(c => c.id === activeCompanyId);
    a.download = `${(company?.company_name || 'company').replace(/\s+/g, '_')}_pack.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Company pack exported' });
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      await importCompanyPack(text);
    } catch {
      toast({ title: 'Invalid pack file', variant: 'destructive' });
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const activeCompany = companies.find(c => c.id === activeCompanyId);

  return (
    <div className="flex items-center gap-2">
      <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      
      {companies.length === 0 ? (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1 text-xs">
              <Plus className="h-3 w-3" /> Add Company
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Create New Company</DialogTitle></DialogHeader>
            <div className="space-y-3 mt-2">
              <Input placeholder="Company name" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreate()} />
              <div className="flex gap-2">
                <Button onClick={handleCreate} className="flex-1">Create</Button>
                <Button variant="outline" onClick={() => fileRef.current?.click()} className="gap-1">
                  <Upload className="h-3 w-3" /> Import
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      ) : (
        <Select value={activeCompanyId || ''} onValueChange={v => v === '__new__' ? setDialogOpen(true) : setActiveCompany(v)}>
          <SelectTrigger className="h-8 text-xs w-[180px]">
            <SelectValue placeholder="Select company" />
          </SelectTrigger>
          <SelectContent>
            {companies.map(c => (
              <SelectItem key={c.id} value={c.id!}>
                {c.company_name}
              </SelectItem>
            ))}
            <SelectItem value="__new__">
              <span className="flex items-center gap-1 text-primary"><Plus className="h-3 w-3" /> New company</span>
            </SelectItem>
          </SelectContent>
        </Select>
      )}

      {activeCompanyId && (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleExport} title="Export company pack">
            <Download className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => fileRef.current?.click()} title="Import company pack">
            {importing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" title="Delete company"
            onClick={async () => { if (confirm(`Delete "${activeCompany?.company_name}"? All data will be lost.`)) { await deleteCompany(activeCompanyId); toast({ title: 'Company deleted' }); } }}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}

      {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}

      {/* New company dialog */}
      <Dialog open={dialogOpen && companies.length > 0} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Create New Company</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <Input placeholder="Company name" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreate()} />
            <Button onClick={handleCreate} className="w-full">Create</Button>
          </div>
        </DialogContent>
      </Dialog>

      <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
    </div>
  );
}
