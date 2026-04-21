import { useLanguage } from '@/i18n/LanguageContext';
import { useData } from '@/store/DataStore';
import { parseExcelFile } from '@/lib/excelParser';
import { DataPreviewTables } from '@/components/DataPreviewTables';
import { ConceptDocumentUpload } from '@/components/ConceptDocumentUpload';
import { DataPipelineStatusPanel } from '@/components/DataPipelineStatusPanel';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Download, FileSpreadsheet, CheckCircle, AlertCircle, Loader2, Database, Trash2, FolderOpen } from 'lucide-react';
import { useState, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import type { UploadLogEntry } from '@/store/DataStore';
import { runDataManagementAgent } from '@/agents/dataManagementAgent';
import { runCustomerEnrichmentAgent } from '@/agents/customerEnrichmentAgent';

const DataUploadPage = () => {
  const { t } = useLanguage();
  const {
    data,
    setOrders,
    setOpportunities,
    setProducts,
    setStrategy,
    setLeads,
    setContacts,
    setDataManagementResults,
    setEnrichedProfiles,
    addUploadLog,
    clearDataset,
    clearAll,
  } = useData();
  const [processing, setProcessing] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const templates = [
    { key: 'orders', title: t.upload.templates.orders, desc: t.upload.templates.ordersDesc },
    { key: 'opportunities', title: t.upload.templates.opportunities, desc: t.upload.templates.opportunitiesDesc },
    { key: 'products', title: t.upload.templates.products, desc: t.upload.templates.productsDesc },
    { key: 'strategy', title: t.upload.templates.strategy, desc: t.upload.templates.strategyDesc },
    { key: 'leads', title: 'Leads', desc: 'Leads and potential accounts with commercial qualification fields.' },
    { key: 'contacts', title: 'Contacts', desc: 'Contact directory linked to companies, regions, and ownership.' },
  ];

  const processFile = useCallback(async (file: File) => {
    setProcessing(prev => [...prev, file.name]);
    try {
      const result = await parseExcelFile(file);
      const logEntry: UploadLogEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        fileName: file.name,
        detectedType: result.type,
        rowCount: result.rowCount,
        status: result.type === 'unknown' ? 'error' : 'validated',
        errors: result.errors,
        timestamp: new Date().toISOString(),
      };
      addUploadLog(logEntry);

      if (result.type === 'orders' && result.orders) setOrders(result.orders);
      if (result.type === 'opportunities' && result.opportunities) setOpportunities(result.opportunities);
      if (result.type === 'products' && result.products) setProducts(result.products);
      if (result.type === 'strategy' && result.strategy) setStrategy(result.strategy);
      if (result.type === 'leads' && result.leads) setLeads(result.leads);
      if (result.type === 'contacts' && result.contacts) setContacts(result.contacts);

      if (result.type !== 'unknown') {
        const snapshot = {
          orders: result.type === 'orders' ? (result.orders || []) : data.orders,
          opportunities: result.type === 'opportunities' ? (result.opportunities || []) : data.opportunities,
          products: result.type === 'products' ? (result.products || []) : data.products,
          strategy: result.type === 'strategy' ? (result.strategy || []) : data.strategy,
          leads: result.type === 'leads' ? (result.leads || []) : data.leads,
          contacts: result.type === 'contacts' ? (result.contacts || []) : data.contacts,
        };
        const management = runDataManagementAgent(snapshot);
        const enrichment = runCustomerEnrichmentAgent({ ...snapshot, registries: management.registries });
        setDataManagementResults(management.registries, management.quality);
        setEnrichedProfiles(enrichment.profiles);
      }

      if (result.type !== 'unknown') {
        toast({ title: `✅ ${file.name}`, description: `Detected as ${result.type} — ${result.rowCount} rows loaded and saved locally.` });
      } else {
        toast({ title: `⚠️ ${file.name}`, description: result.errors.join('. '), variant: 'destructive' });
      }
    } catch {
      addUploadLog({
        id: `${Date.now()}`, fileName: file.name, detectedType: 'unknown',
        rowCount: 0, status: 'error', errors: ['Failed to parse file'], timestamp: new Date().toISOString(),
      });
      toast({ title: `❌ ${file.name}`, description: 'Failed to parse file.', variant: 'destructive' });
    } finally {
      setProcessing(prev => prev.filter(n => n !== file.name));
    }
  }, [setOrders, setOpportunities, setProducts, setStrategy, setLeads, setContacts, setDataManagementResults, setEnrichedProfiles, addUploadLog, data]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    Array.from(e.dataTransfer.files).forEach(processFile);
  }, [processFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files || []).forEach(processFile);
    e.target.value = '';
  }, [processFile]);

  const downloadTemplate = (templateKey: string) => {
    const headers: Record<string, string[]> = {
      orders: ['PO Date', 'First Offer Date', 'Opp Internal Number', 'Geographical Area', 'Customer Country', 'Customer Name', 'Scope', 'Product Family', 'Segment', 'Purchasing Year', 'Purchasing Quarter', 'Purchasing Month', 'Selling Price', 'Margin', 'KAM'],
      opportunities: ['Opp/Offer Number', 'Status', 'Geographical Area', 'Customer Country', 'Customer Name', 'Scope', 'Product Family', 'Segment', 'Est. Purchasing Year', 'Est. Purchasing Quarter', 'Est. Revenue', 'Contract Prob. %', 'Margin', 'Contact', 'KAM'],
      products: ['Name', 'Average Value', 'Commodity/Innovation', 'Category', 'Characteristics', 'Estimated Cost', 'Repositories', 'Comments'],
      strategy: ['Product Family', 'Number of Segment', 'Geographical Area', 'Est. Purchasing Quarter', 'Est. Revenue', 'Margin', 'KAM'],
      leads: ['Lead Name', 'Company', 'Email', 'Phone', 'Region', 'Country', 'Sector', 'Status', 'Source', 'Owner', 'Estimated Value', 'Notes'],
      contacts: ['Contact Name', 'Company', 'Email', 'Phone', 'Role', 'Department', 'Region', 'Country', 'KAM', 'Notes'],
    };
    const csvContent = headers[templateKey]?.join(',') || '';
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template_${templateKey}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const typeLabels: Record<string, string> = { orders: 'Orders', opportunities: 'Opportunities', products: 'Products', strategy: 'Strategy', leads: 'Leads', contacts: 'Contacts' };
  const datasets = [
    { key: 'orders' as const, label: 'Orders', count: data.orders.length },
    { key: 'opportunities' as const, label: 'Opportunities', count: data.opportunities.length },
    { key: 'products' as const, label: 'Products', count: data.products.length },
    { key: 'strategy' as const, label: 'Strategy', count: data.strategy.length },
    { key: 'leads' as const, label: 'Leads', count: data.leads.length },
    { key: 'contacts' as const, label: 'Contacts', count: data.contacts.length },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-foreground mb-2">{t.upload.title}</h2>
          <p className="text-muted-foreground">{t.upload.subtitle}</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1 text-destructive hover:text-destructive" onClick={() => { clearAll(); toast({ title: 'All local data cleared' }); }}>
          <Trash2 className="h-3 w-3" /> Clear All
        </Button>
      </div>

      <Tabs defaultValue="documents" className="space-y-6">
        <TabsList>
          <TabsTrigger value="documents" className="gap-1.5">
            <FolderOpen className="h-4 w-4" /> Document Library
          </TabsTrigger>
          <TabsTrigger value="pipeline" className="gap-1.5">
            <Database className="h-4 w-4" /> Pipeline Status
          </TabsTrigger>
          <TabsTrigger value="structured" className="gap-1.5">
            <FileSpreadsheet className="h-4 w-4" /> Structured Data
          </TabsTrigger>
        </TabsList>

        {/* ── Document Library Tab ── */}
        <TabsContent value="documents">
          <ConceptDocumentUpload />
        </TabsContent>

        {/* ── Pipeline Status Tab ── */}
        <TabsContent value="pipeline">
          <DataPipelineStatusPanel />
        </TabsContent>

        {/* ── Structured Data Tab ── */}
        <TabsContent value="structured" className="space-y-6">
          {/* Data Status */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {datasets.map(ds => (
              <Card key={ds.key}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Database className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-lg font-bold text-foreground">{ds.count}</p>
                        <p className="text-xs text-muted-foreground">{ds.label}</p>
                      </div>
                    </div>
                    {ds.count > 0 && (
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => { clearDataset(ds.key); toast({ title: `${ds.label} data cleared` }); }}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Upload Zone */}
          <Card>
            <CardContent className="pt-6">
              <div onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
                <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                <p className="text-foreground font-medium mb-1">{t.upload.dragDrop}</p>
                <p className="text-xs text-muted-foreground mb-1">{t.upload.maxSize}</p>
                <p className="text-xs text-muted-foreground mb-4">Auto-detects: Orders, Opportunities, Products, Strategy, Leads, Contacts</p>
                <label>
                  <input type="file" className="hidden" accept=".xlsx,.xls,.csv" multiple onChange={handleFileInput} />
                  <Button variant="outline" className="cursor-pointer" asChild><span>{t.upload.browse}</span></Button>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Processing */}
          {processing.length > 0 && (
            <Card>
              <CardContent className="pt-4 pb-4">
                {processing.map(name => (
                  <div key={name} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Processing {name}...
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Data Preview */}
          <DataPreviewTables />

          {(data.qualityReports.length > 0 || data.enrichedProfiles.length > 0) && (
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-6 space-y-2">
                  <h3 className="font-semibold text-foreground">Data Management Quality Report</h3>
                  {data.qualityReports.map((report) => (
                    <div key={report.dataset} className="text-xs border rounded-md p-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium uppercase">{report.dataset}</span>
                        <span>{report.rowCount} rows · {report.nullPercentage}% nulls</span>
                      </div>
                      {report.issues.length > 0 && <p className="text-muted-foreground mt-1">{report.issues.join(' · ')}</p>}
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6 space-y-2">
                  <h3 className="font-semibold text-foreground">Entity Extraction & Enrichment</h3>
                  <p className="text-xs text-muted-foreground">
                    Companies: {Object.keys(data.entityRegistries.companies).length} · Customers: {Object.keys(data.entityRegistries.customers).length} · Products: {Object.keys(data.entityRegistries.products).length} · Contacts: {Object.keys(data.entityRegistries.contacts).length}
                  </p>
                  {data.enrichedProfiles.slice(0, 5).map((profile) => (
                    <div key={profile.id} className="text-xs border rounded-md p-2 flex items-center justify-between">
                      <span className="font-medium">{profile.companyName}</span>
                      <span>Score {profile.enrichmentScore} ({profile.completeness})</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Templates */}
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-4">Excel Templates</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map((tmpl) => (
                <Card key={tmpl.key}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <FileSpreadsheet className="h-5 w-5 text-primary" />
                          <h4 className="font-semibold text-foreground">{tmpl.title}</h4>
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">{tmpl.desc}</p>
                      </div>
                      <Button size="sm" variant="outline" className="gap-1 flex-shrink-0" onClick={() => downloadTemplate(tmpl.key)}>
                        <Download className="h-3 w-3" /> {t.upload.downloadTemplate}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Upload History */}
          {data.uploadLog.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">{t.upload.recentUploads}</h3>
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    {data.uploadLog.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                        <div className="flex items-center gap-3">
                          <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <span className="text-sm font-medium text-foreground">{entry.fileName}</span>
                            {entry.detectedType !== 'unknown' && (
                              <span className="ml-2 text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                {typeLabels[entry.detectedType] || entry.detectedType} — {entry.rowCount} rows
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">{new Date(entry.timestamp).toLocaleDateString()}</span>
                          {entry.status === 'validated' ? (
                            <span className="flex items-center gap-1 text-xs text-success"><CheckCircle className="h-3 w-3" /> {t.upload.validated}</span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-destructive"><AlertCircle className="h-3 w-3" /> {entry.errors[0]}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DataUploadPage;
