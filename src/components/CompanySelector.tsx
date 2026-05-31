import React, { useState, useRef } from 'react';
import { useData } from '@/store/DataStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Building2, Plus, Trash2, Download, Upload, Loader2, Sparkles, Globe, Linkedin } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const CompanySelectorComponent = () => {
  const { companies, activeCompanyId, setActiveCompany, createCompany, deleteCompany, exportCompanyPack, importCompanyPack, triggerEnrichment, loading } = useData();
  const [newName, setNewName] = useState('');
  const [newWebsite, setNewWebsite] = useState('');
  const [newLinkedin, setNewLinkedin] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [creating, setCreating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const id = await createCompany(newName.trim(), newWebsite.trim(), newLinkedin.trim(), newDescription.trim());
      if (id) {
        setActiveCompany(id);
        setNewName('');
        setNewWebsite('');
        setNewLinkedin('');
        setNewDescription('');
        setDialogOpen(false);
        toast({ title: `Company "${newName.trim()}" created` });
        
        // Auto-trigger enrichment if URL is provided
        if (newWebsite.trim() || newLinkedin.trim()) {
          triggerEnrichment(id);
        }
      }
    } finally {
      setCreating(false);
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

  const createForm = (
    <div className="space-y-4 mt-2">
      <div>
        <Label htmlFor="company-name" className="text-sm font-medium">Company Name *</Label>
        <Input id="company-name" placeholder="e.g. Siemens AG" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreate()} />
      </div>
      <div>
        <Label htmlFor="company-website" className="text-sm font-medium flex items-center gap-1">
          <Globe className="h-3 w-3" /> Website URL
        </Label>
        <Input id="company-website" placeholder="https://www.company.com" value={newWebsite} onChange={e => setNewWebsite(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="company-linkedin" className="text-sm font-medium flex items-center gap-1">
          <Linkedin className="h-3 w-3" /> LinkedIn URL
        </Label>
        <Input id="company-linkedin" placeholder="https://linkedin.com/company/..." value={newLinkedin} onChange={e => setNewLinkedin(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="company-desc" className="text-sm font-medium">Business Description (optional)</Label>
        <Textarea id="company-desc" placeholder="Brief description of the company, its products, market position..." value={newDescription} onChange={e => setNewDescription(e.target.value)} rows={3} className="text-sm" />
      </div>
      {(newWebsite.trim() || newLinkedin.trim()) && (
        <div className="flex items-center gap-2 text-xs text-primary bg-primary/10 rounded-md p-2">
          <Sparkles className="h-3 w-3 flex-shrink-0" />
          <span>AI will automatically gather company intelligence from the provided URLs</span>
        </div>
      )}
      <div className="flex gap-2">
        <Button onClick={handleCreate} className="flex-1 gap-1" disabled={creating || !newName.trim()}>
          {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          Create & Analyze
        </Button>
        {companies.length === 0 && (
          <Button variant="outline" onClick={() => fileRef.current?.click()} className="gap-1">
            <Upload className="h-3 w-3" /> Import
          </Button>
        )}
      </div>
    </div>
  );

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
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Create New Company</DialogTitle></DialogHeader>
            {createForm}
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
                <span className="flex items-center gap-1">
                  {c.company_name}
                  {c.enrichment_status === 'enriching' && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                  {c.enrichment_status === 'completed' && <Sparkles className="h-3 w-3 text-primary" />}
                </span>
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
          {activeCompany?.enrichment_status !== 'completed' && (
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-primary" 
              onClick={() => triggerEnrichment(activeCompanyId)} 
              title="Run AI enrichment"
              disabled={activeCompany?.enrichment_status === 'enriching'}>
              {activeCompany?.enrichment_status === 'enriching' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            </Button>
          )}
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
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Create New Company</DialogTitle></DialogHeader>
          {createForm}
        </DialogContent>
      </Dialog>

      <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
    </div>
  );
}

export const CompanySelector = React.memo(CompanySelectorComponent);
