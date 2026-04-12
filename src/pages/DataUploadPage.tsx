import { useLanguage } from '@/i18n/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Download, FileSpreadsheet, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useState, useCallback } from 'react';

interface UploadedFile {
  name: string;
  type: string;
  status: 'processing' | 'validated' | 'error';
  timestamp: Date;
}

const DataUploadPage = () => {
  const { t } = useLanguage();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const templates = [
    { key: 'orders', title: t.upload.templates.orders, desc: t.upload.templates.ordersDesc, color: 'bg-primary/10 text-primary' },
    { key: 'opportunities', title: t.upload.templates.opportunities, desc: t.upload.templates.opportunitiesDesc, color: 'bg-success/10 text-success' },
    { key: 'products', title: t.upload.templates.products, desc: t.upload.templates.productsDesc, color: 'bg-warning/10 text-warning' },
    { key: 'strategy', title: t.upload.templates.strategy, desc: t.upload.templates.strategyDesc, color: 'bg-chart-5/10 text-foreground' },
  ];

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    const newFiles: UploadedFile[] = files.map(f => ({
      name: f.name,
      type: f.type,
      status: 'processing' as const,
      timestamp: new Date(),
    }));
    setUploadedFiles(prev => [...newFiles, ...prev]);
    // Simulate processing
    setTimeout(() => {
      setUploadedFiles(prev =>
        prev.map(f => f.status === 'processing' ? { ...f, status: 'validated' } : f)
      );
    }, 2000);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newFiles: UploadedFile[] = files.map(f => ({
      name: f.name,
      type: f.type,
      status: 'processing' as const,
      timestamp: new Date(),
    }));
    setUploadedFiles(prev => [...newFiles, ...prev]);
    setTimeout(() => {
      setUploadedFiles(prev =>
        prev.map(f => f.status === 'processing' ? { ...f, status: 'validated' } : f)
      );
    }, 2000);
  }, []);

  const downloadTemplate = (templateKey: string) => {
    // In a real app, this would download actual Excel templates
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

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-foreground mb-2">{t.upload.title}</h2>
        <p className="text-muted-foreground">{t.upload.subtitle}</p>
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
              <input
                type="file"
                className="hidden"
                accept=".xlsx,.xls,.csv"
                multiple
                onChange={handleFileInput}
              />
              <Button variant="outline" className="cursor-pointer" asChild>
                <span>{t.upload.browse}</span>
              </Button>
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
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 flex-shrink-0"
                  onClick={() => downloadTemplate(tmpl.key)}
                >
                  <Download className="h-3 w-3" />
                  {t.upload.downloadTemplate}
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
                      <span className="text-sm font-medium text-foreground">{file.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {file.status === 'processing' && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          {t.upload.processing}
                        </span>
                      )}
                      {file.status === 'validated' && (
                        <span className="flex items-center gap-1 text-xs text-success">
                          <CheckCircle className="h-3 w-3" />
                          {t.upload.validated}
                        </span>
                      )}
                      {file.status === 'error' && (
                        <span className="flex items-center gap-1 text-xs text-destructive">
                          <AlertCircle className="h-3 w-3" />
                          {t.upload.errors}
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
