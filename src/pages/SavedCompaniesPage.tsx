import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData, CompanyProfile } from '@/store/DataStore';
import { useLanguage } from '@/i18n/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Building2,
  Plus,
  Trash2,
  Download,
  Upload,
  Loader2,
  Sparkles,
  Globe,
  Linkedin,
  Search,
  CheckCircle2,
  MapPin,
  Users,
  DollarSign,
  Package,
  FolderOpen,
  XCircle,
  Briefcase,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

type EnrichmentFilter = 'all' | 'completed' | 'pending' | 'enriching' | 'failed';

function getProfileCompleteness(c: CompanyProfile) {
  const checks = [
    !!c.industry,
    !!c.headquarters,
    !!c.annual_revenue,
    !!c.main_products,
    !!c.strategic_goals,
    !!c.business_description,
    !!(c.website_url || c.linkedin_url),
  ];
  const score = checks.filter(Boolean).length;
  return { score, total: checks.length, pct: Math.round((score / checks.length) * 100) };
}

function EnrichmentBadge({ status }: { status: string | null | undefined }) {
  switch (status) {
    case 'completed':
      return (
        <Badge className="bg-green-100 text-green-800 border-green-200 gap-1 text-xs">
          <Sparkles className="h-3 w-3" /> AI Enriched
        </Badge>
      );
    case 'enriching':
      return (
        <Badge className="bg-blue-100 text-blue-800 border-blue-200 gap-1 text-xs">
          <Loader2 className="h-3 w-3 animate-spin" /> Enriching…
        </Badge>
      );
    case 'failed':
      return (
        <Badge variant="destructive" className="gap-1 text-xs">
          <XCircle className="h-3 w-3" /> Failed
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="gap-1 text-xs text-muted-foreground">
          Pending enrichment
        </Badge>
      );
  }
}

export default function SavedCompaniesPage() {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const {
    companies,
    activeCompanyId,
    setActiveCompany,
    createCompany,
    deleteCompany,
    exportCompanyPack,
    importCompanyPack,
    loadCompanies,
    triggerEnrichment,
    loading,
  } = useData();

  const [search, setSearch] = useState('');
  const [eFilter, setEFilter] = useState<EnrichmentFilter>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newWebsite, setNewWebsite] = useState('');
  const [newLinkedin, setNewLinkedin] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [loadingIngecart, setLoadingIngecart] = useState(false);
  // pendingExport tracks a company ID for which we want to export after switching
  const [pendingExport, setPendingExport] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  // After the active company changes and matches pendingExport, perform the download
  useEffect(() => {
    if (!pendingExport || pendingExport !== activeCompanyId) return;
    let cancelled = false;
    (async () => {
      const json = await exportCompanyPack();
      if (cancelled) return;
      const company = companies.find((c) => c.id === pendingExport);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(company?.company_name || 'company').replace(/\s+/g, '_')}_pack.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: `${company?.company_name ?? 'Company'} pack exported` });
      setPendingExport(null);
    })();
    return () => { cancelled = true; };
  }, [activeCompanyId, pendingExport, exportCompanyPack, companies]);

  const handleOpen = (id: string) => {
    setActiveCompany(id);
    navigate('/');
  };

  const handleExport = async (id: string) => {
    if (id === activeCompanyId) {
      // Already active — export straight away
      const json = await exportCompanyPack();
      const company = companies.find((c) => c.id === id);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(company?.company_name || 'company').replace(/\s+/g, '_')}_pack.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: `${company?.company_name ?? 'Company'} pack exported` });
    } else {
      // Switch company first; the useEffect handles the download once the switch completes
      toast({ title: 'Switching company for export…', description: 'Download will start automatically.' });
      setPendingExport(id);
      setActiveCompany(id);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? All associated data will be permanently lost.`)) return;
    await deleteCompany(id);
    toast({ title: `${name} deleted` });
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const id = await createCompany(
        newName.trim(),
        newWebsite.trim(),
        newLinkedin.trim(),
        newDescription.trim(),
      );
      if (id) {
        setNewName('');
        setNewWebsite('');
        setNewLinkedin('');
        setNewDescription('');
        setDialogOpen(false);
        toast({ title: `Company "${newName.trim()}" created` });
        if (newWebsite.trim() || newLinkedin.trim()) {
          triggerEnrichment(id);
        }
      }
    } finally {
      setCreating(false);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      await importCompanyPack(text);
      // Force a fresh reload of the companies list so the new card appears immediately
      await loadCompanies();
    } catch {
      toast({ title: 'Invalid or corrupt pack file', variant: 'destructive' });
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const handleLoadIngecartPack = async () => {
    setLoadingIngecart(true);
    try {
      const response = await fetch('/company-packs/Ingecart/ingecart_pack.json');
      if (!response.ok) {
        if (response.status === 404) throw new Error('Ingecart pack file not found');
        throw new Error(`Ingecart pack request failed (${response.status})`);
      }
      const text = await response.text();
      await importCompanyPack(text);
      await loadCompanies();
      toast({ title: 'Ingecart pack loaded successfully' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: 'Could not load Ingecart pack',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoadingIngecart(false);
    }
  };

  const sc = t.savedCompanies;

  const filtered = companies.filter((c) => {
    const matchName = c.company_name.toLowerCase().includes(search.toLowerCase());
    const status = c.enrichment_status || 'pending';
    const matchFilter =
      eFilter === 'all' ||
      status === eFilter ||
      (eFilter === 'pending' && !c.enrichment_status);
    return matchName && matchFilter;
  });

  const activeCompany = companies.find((c) => c.id === activeCompanyId);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Briefcase className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{sc.title}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{sc.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="secondary"
            size="sm"
            className="gap-1.5"
            onClick={handleLoadIngecartPack}
            disabled={loadingIngecart}
          >
            {loadingIngecart ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Briefcase className="h-4 w-4" />
            )}
            Load Ingecart Pack
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => importRef.current?.click()}
            disabled={importing}
          >
            {importing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {sc.import}
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            {sc.addCompany}
          </Button>
        </div>
      </div>

      {/* ── Search + Filter ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder={sc.searchPlaceholder}
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={eFilter} onValueChange={(v) => setEFilter(v as EnrichmentFilter)}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{sc.filterAll}</SelectItem>
            <SelectItem value="completed">{sc.filterEnriched}</SelectItem>
            <SelectItem value="enriching">{sc.filterEnriching}</SelectItem>
            <SelectItem value="pending">{sc.filterPending}</SelectItem>
            <SelectItem value="failed">{sc.filterFailed}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── Stats bar ── */}
      {companies.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span>
            {filtered.length} {filtered.length === 1 ? 'company' : 'companies'}
          </span>
          {activeCompany && (
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              {sc.activeLabel}:
              <span className="font-medium text-foreground">{activeCompany.company_name}</span>
            </span>
          )}
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        </div>
      )}

      {/* ── Empty state ── */}
      {companies.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Building2 className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <h2 className="text-lg font-semibold mb-2">{sc.emptyTitle}</h2>
          <p className="text-muted-foreground text-sm mb-6 max-w-sm leading-relaxed">
            {sc.emptySubtitle}
          </p>
          <div className="flex gap-2">
            <Button onClick={() => setDialogOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              {sc.addCompany}
            </Button>
            <Button
              variant="outline"
              onClick={() => importRef.current?.click()}
              className="gap-1.5"
            >
              <Upload className="h-4 w-4" />
              {sc.import}
            </Button>
          </div>
        </div>
      )}

      {/* ── No search results ── */}
      {companies.length > 0 && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Search className="h-8 w-8 text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">{sc.noResults}</p>
          <Button
            variant="link"
            size="sm"
            className="mt-2"
            onClick={() => { setSearch(''); setEFilter('all'); }}
          >
            Clear filters
          </Button>
        </div>
      )}

      {/* ── Company Cards Grid ── */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((company) => {
            const { pct } = getProfileCompleteness(company);
            const isActive = company.id === activeCompanyId;
            const isExporting = pendingExport === company.id;

            return (
              <Card
                key={company.id}
                className={`flex flex-col transition-all hover:shadow-md ${
                  isActive ? 'ring-2 ring-primary shadow-sm' : ''
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-base leading-tight truncate">
                          {company.company_name}
                        </CardTitle>
                        {company.industry && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {company.industry}
                            {company.sub_sector ? ` · ${company.sub_sector}` : ''}
                          </p>
                        )}
                      </div>
                    </div>
                    {isActive && (
                      <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 flex-shrink-0">
                        {sc.active}
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="flex-1 space-y-3 pt-0">
                  {/* Enrichment + location badges */}
                  <div className="flex flex-wrap gap-1.5">
                    <EnrichmentBadge status={company.enrichment_status} />
                    {company.headquarters && (
                      <Badge variant="outline" className="gap-1 text-xs">
                        <MapPin className="h-3 w-3" />
                        {company.headquarters}
                      </Badge>
                    )}
                  </div>

                  {/* Key stats */}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                    {company.annual_revenue && (
                      <div className="flex items-center gap-1.5">
                        <DollarSign className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate">{company.annual_revenue}</span>
                      </div>
                    )}
                    {company.employee_count && (
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate">{company.employee_count}</span>
                      </div>
                    )}
                    {company.main_products && (
                      <div className="flex items-center gap-1.5 col-span-2">
                        <Package className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate">{company.main_products}</span>
                      </div>
                    )}
                  </div>

                  {/* Profile completeness bar */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-muted-foreground">{sc.profileCompleteness}</span>
                      <span
                        className={`font-medium ${
                          pct >= 80
                            ? 'text-green-600'
                            : pct >= 50
                            ? 'text-yellow-600'
                            : 'text-red-500'
                        }`}
                      >
                        {pct}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          pct >= 80
                            ? 'bg-green-500'
                            : pct >= 50
                            ? 'bg-yellow-500'
                            : 'bg-red-400'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* External links */}
                  {(company.website_url || company.linkedin_url) && (
                    <div className="flex gap-3">
                      {company.website_url && (
                        <a
                          href={company.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                        >
                          <Globe className="h-3 w-3" />
                          Website
                        </a>
                      )}
                      {company.linkedin_url && (
                        <a
                          href={company.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                        >
                          <Linkedin className="h-3 w-3" />
                          LinkedIn
                        </a>
                      )}
                    </div>
                  )}
                </CardContent>

                <CardFooter className="pt-3 border-t gap-1.5">
                  {/* Open / Switch button */}
                  <Button
                    className="flex-1 gap-1.5 text-xs h-8"
                    size="sm"
                    variant={isActive ? 'secondary' : 'default'}
                    onClick={() => handleOpen(company.id!)}
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    {isActive ? sc.openActive : sc.openCompany}
                  </Button>

                  {/* Export button */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    title="Export company pack"
                    disabled={isExporting}
                    onClick={() => handleExport(company.id!)}
                  >
                    {isExporting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                  </Button>

                  {/* Enrichment trigger */}
                  {company.enrichment_status !== 'completed' &&
                    company.enrichment_status !== 'enriching' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0 text-primary hover:text-primary"
                        title="Run AI enrichment"
                        onClick={() => triggerEnrichment(company.id!)}
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                      </Button>
                    )}

                  {/* Delete */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    title="Delete company"
                    onClick={() => handleDelete(company.id!, company.company_name)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Create Company Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{sc.createTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label htmlFor="sc-name" className="text-sm font-medium">
                {sc.companyName} *
              </Label>
              <Input
                id="sc-name"
                placeholder="e.g. Siemens AG"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <div>
              <Label htmlFor="sc-website" className="text-sm font-medium flex items-center gap-1">
                <Globe className="h-3 w-3" /> Website URL
              </Label>
              <Input
                id="sc-website"
                placeholder="https://www.company.com"
                value={newWebsite}
                onChange={(e) => setNewWebsite(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="sc-linkedin" className="text-sm font-medium flex items-center gap-1">
                <Linkedin className="h-3 w-3" /> LinkedIn URL
              </Label>
              <Input
                id="sc-linkedin"
                placeholder="https://linkedin.com/company/..."
                value={newLinkedin}
                onChange={(e) => setNewLinkedin(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="sc-desc" className="text-sm font-medium">
                Business Description (optional)
              </Label>
              <Textarea
                id="sc-desc"
                placeholder="Brief description of the company, its products, market position…"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={3}
                className="text-sm"
              />
            </div>
            {(newWebsite.trim() || newLinkedin.trim()) && (
              <div className="flex items-center gap-2 text-xs text-primary bg-primary/10 rounded-md p-2">
                <Sparkles className="h-3 w-3 flex-shrink-0" />
                <span>
                  AI will automatically gather company intelligence from the provided URLs
                </span>
              </div>
            )}
            <Button
              onClick={handleCreate}
              className="w-full gap-1.5"
              disabled={creating || !newName.trim()}
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {sc.createAndAnalyze}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden file input for import */}
      <input
        ref={importRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleImportFile}
      />
    </div>
  );
}
