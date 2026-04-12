import { useLanguage } from '@/i18n/LanguageContext';
import { useData } from '@/store/DataStore';
import { parseExcelFile } from '@/lib/excelParser';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Download, FileSpreadsheet, CheckCircle, AlertCircle, Loader2, Database } from 'lucide-react';
import { useState, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';

interface UploadedFile {
  name: string;
  type: string;
  detectedType: string;
  status: 'processing' | 'validated' | 'error';
  rowCount: number;
  errors: string[];
  timestamp: Date;
}

const DataUploadPage = () => {
  const { t } = useLanguage();
  const { data, setOrders, setOpportunities, setProducts, setStrategy } = useData();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const templates = [
    { key: 'orders', title: t.upload.templates.orders, desc: t.upload.templates.ordersDesc, color: 'bg-primary/10 text-primary' },
    { key: 'opportunities', title: t.upload.templates.opportunities, desc: t.upload.templates.opportunitiesDesc, color: 'bg-success/10 text-success' },
    { key: 'products', title: t.upload.templates.products, desc: t.upload.templates.productsDesc, color: 'bg-warning/10 text-warning' },
    { key: 'strategy', title: t.upload.templates.strategy, desc: t.upload.templates.strategyDesc, color: 'bg-chart-5/10 text-foreground' },
  ];

  const processFile = useCallback(async (file: File) => {
    const entry: UploadedFile = {
      name: file.name, type: file.type, detectedType: '...', status: 'processing',
      rowCount: 0, errors: [], timestamp: new Date(),
    };
    setUploadedFiles(prev => [entry, ...prev]);

    try {
      const result = await parseExcelFile(file);
      const updatedEntry: UploadedFile = {
        ...entry,
        detectedType: result.type,
        status: result.type === 'unknown' ? 'error' : 'validated',
        rowCount: result.rowCount,
        errors: result.errors,
      };

      if (result.type === 'orders' && result.orders) setOrders(result.orders);
      if (result.type === 'opportunities' && result.opportunities) setOpportunities(result.opportunities);
      if (result.type === 'products' && result.products) setProducts(result.products);
      if (result.type === 'strategy' && result.strategy) setStrategy(result.strategy);

      setUploadedFiles(prev => prev.map(f => f.name === file.name && f.status === 'processing' ? updatedEntry : f));
      
      if (result.type !== 'unknown') {
        toast({ title: `✅ ${file.name}`, description: `Detected as ${result.type} — ${result.rowCount} rows loaded.` });
      } else {
        toast({ title: `⚠️ ${file.name}`, description: result.errors.join('. '), variant: 'destructive' });
      }
    } catch (err) {
      setUploadedFiles(prev => prev.map(f => f.name === file.name && f.status === 'processing'
        ? { ...f, status: 'error' as const, errors: ['Failed to parse file'] } : f));
      toast({ title: `❌ ${file.name}`, description: 'Failed to parse file.', variant: 'destructive' });
    }
  }, [setOrders, setOpportunities, setProducts, setStrategy]);

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
      products: ['Name', 'Average Value', 'Commodity/Innovation', 'Comments'],
      strategy: ['Product Family', 'Number of Segment', 'Geographical Area', 'Est. Purchasing Quarter', 'Est. Revenue', 'Margin', 'KAM'],
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

  const typeLabels: Record<string, string> = { orders: 'Orders', opportunities: 'Opportunities', products: 'Products', strategy: 'Strategy' };

  const dataSummary = [
    { label: 'Orders', count: data.orders.length },
    { label: 'Opportunities', count: data.opportunities.length },
    { label: 'Products', count: data.products.length },
    { label: 'Strategy', count: data.strategy.length },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-foreground mb-2">{t.upload.title}</h2>
        <p className="text-muted-foreground">{t.upload.subtitle}</p>
      </div>

      {/* Data Status */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {dataSummary.map(ds => (
          <Card key={ds.label}>
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <Database className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-lg font-bold text-foreground">{ds.count}</p>
                <p className="text-xs text-muted-foreground">{ds.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Upload Zone */}
      <Card className="mb-8">
        <CardContent className="pt-6">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
              dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}
          >
            <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
            <p className="text-foreground font-medium mb-1">{t.upload.dragDrop}</p>
            <p className="text-xs text-muted-foreground mb-4">{t.upload.maxSize}</p>
            <label>
              <input type="file" className="hidden" accept=".xlsx,.xls,.csv" multiple onChange={handleFileInput} />
              <Button variant="outline" className="cursor-pointer" asChild><span>{t.upload.browse}</span></Button>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Templates */}
      <h3 className="text-lg font-semibold text-foreground mb-4">Excel Templates</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
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

      {/* Recent Uploads */}
      {uploadedFiles.length > 0 && (
        <>
          <h3 className="text-lg font-semibold text-foreground mb-4">{t.upload.recentUploads}</h3>
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3">
                {uploadedFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <span className="text-sm font-medium text-foreground">{file.name}</span>
                        {file.detectedType !== '...' && file.detectedType !== 'unknown' && (
                          <span className="ml-2 text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                            {typeLabels[file.detectedType] || file.detectedType} — {file.rowCount} rows
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {file.status === 'processing' && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" /> {t.upload.processing}
                        </span>
                      )}
                      {file.status === 'validated' && (
                        <span className="flex items-center gap-1 text-xs text-success">
                          <CheckCircle className="h-3 w-3" /> {t.upload.validated}
                        </span>
                      )}
                      {file.status === 'error' && (
                        <span className="flex items-center gap-1 text-xs text-destructive">
                          <AlertCircle className="h-3 w-3" /> {file.errors[0] || t.upload.errors}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default DataUploadPage;
