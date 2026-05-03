import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Upload, Sparkles } from 'lucide-react';
import { ProductAttachmentParser, type ParsedProductAttachment } from '@/lib/productAttachmentParser';

export interface CatalogProduct {
  id: string;
  name: string;
  sku: string;
  category: string;
  description?: string;
  currency?: string;
  quoteReference?: string;
  poReference?: string;
  attachmentInfo?: ParsedProductAttachment;
  attributes?: Record<string, unknown>;
  type: string;
  averageValue: number;
  sellingPrice: number;
  unitCost: number;
  stockQuantity: number;
  status: string;
  comments: string;
}

interface ProductFormProps {
  onAddProduct: (product: CatalogProduct) => void;
}

export function ProductForm({ onAddProduct }: ProductFormProps) {
  const attachmentParser = new ProductAttachmentParser();
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('');
  const [averageValue, setAverageValue] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [quoteReference, setQuoteReference] = useState('');
  const [poReference, setPoReference] = useState('');
  const [stockQuantity, setStockQuantity] = useState('');
  const [status, setStatus] = useState('active');
  const [comments, setComments] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [attachmentData, setAttachmentData] = useState<ParsedProductAttachment | null>(null);
  const [isParsingAttachment, setIsParsingAttachment] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  const supportedExtensions = ['pdf', 'xlsx', 'xls', 'docx', 'doc', 'txt', 'eml', 'msg'];

  const autoFillFromAttachment = (data: ParsedProductAttachment) => {
    if (data.product_name) setName(data.product_name);
    if (data.supplier && !category) setCategory(data.supplier);
    if (data.description) setDescription(data.description);
    if (data.pricing.unit_price != null) {
      setSellingPrice(String(data.pricing.unit_price));
      if (!averageValue) {
        setAverageValue(String(data.pricing.unit_price));
      }
    }
    if (data.pricing.currency) setCurrency(data.pricing.currency);
    if (data.reference_numbers.quote) setQuoteReference(data.reference_numbers.quote);
    if (data.reference_numbers.po) setPoReference(data.reference_numbers.po);
    if (data.cost_breakdown.length > 0 && !unitCost) {
      const costTotal = data.cost_breakdown.reduce((sum, item) => sum + (item.cost || 0), 0);
      if (costTotal > 0) {
        setUnitCost(String(costTotal));
      }
    }
    if (data.quantities.offered != null) setStockQuantity(String(Math.round(data.quantities.offered)));
  };

  const handleAttachmentUpload = async (file: File) => {
    setAttachmentError(null);
    setAttachmentData(null);
    setUploadedFileName(file.name);
    setIsParsingAttachment(true);

    const extension = (file.name.split('.').pop() || '').toLowerCase();
    if (!supportedExtensions.includes(extension)) {
      setIsParsingAttachment(false);
      setAttachmentError('Unsupported file format. Please upload EML/MSG, PDF, Excel, Word, or TXT.');
      return;
    }

    try {
      const parsed = await attachmentParser.parse(file);
      setAttachmentData(parsed);
      if ((parsed.confidence_score || 0) <= 0) {
        setAttachmentError('No clear product information was detected. You can continue with manual entry.');
      }
    } catch (error) {
      console.error('Attachment parsing failed', error);
      setAttachmentError('Attachment could not be parsed. You can continue with manual entry.');
    } finally {
      setIsParsingAttachment(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onAddProduct({
      id: crypto.randomUUID(),
      name: name.trim(),
      sku: sku.trim(),
      category: category.trim(),
      description: description.trim(),
      currency,
      quoteReference: quoteReference.trim(),
      poReference: poReference.trim(),
      attachmentInfo: attachmentData || undefined,
      attributes: attachmentData ? {
        attachment_info: attachmentData,
        source_document: uploadedFileName || attachmentData.source_file,
        extraction_confidence: attachmentData.confidence_score,
        reference_numbers: attachmentData.reference_numbers,
        supplier_contact: attachmentData.supplier_contact,
        dates: attachmentData.dates,
        cost_breakdown: attachmentData.cost_breakdown,
        raw_text_summary: attachmentData.raw_text_summary,
      } : undefined,
      type: type || 'Core',
      averageValue: parseFloat(averageValue) || 0,
      sellingPrice: parseFloat(sellingPrice) || 0,
      unitCost: parseFloat(unitCost) || 0,
      stockQuantity: parseFloat(stockQuantity) || 0,
      status,
      comments: comments.trim(),
    });

    setName('');
    setSku('');
    setCategory('');
    setDescription('');
    setType('');
    setAverageValue('');
    setSellingPrice('');
    setUnitCost('');
    setCurrency('EUR');
    setQuoteReference('');
    setPoReference('');
    setStockQuantity('');
    setStatus('active');
    setComments('');
    setUploadedFileName('');
    setAttachmentData(null);
    setAttachmentError(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Plus className="h-4 w-4 text-primary" /> Add Product to Catalog
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 rounded-md border border-dashed p-3 space-y-2 bg-muted/20">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Upload className="h-4 w-4 text-primary" />
            Attach Document (Optional)
          </div>
          <p className="text-xs text-muted-foreground">
            Upload email, PDF, Excel, Word, or TXT. The form can auto-extract product and cost details.
          </p>
          <Input
            type="file"
            accept=".pdf,.xlsx,.xls,.docx,.doc,.txt,.eml,.msg"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                void handleAttachmentUpload(file);
              }
            }}
          />
          {isParsingAttachment && <p className="text-xs text-primary">Extracting product information from attachment...</p>}
          {attachmentError && <p className="text-xs text-amber-700">{attachmentError}</p>}
          {attachmentData && (
            <div className="rounded-md border bg-background p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <p className="font-medium">Extracted Data Preview</p>
                <p className="text-muted-foreground">
                  Confidence: {(attachmentData.confidence_score * 100).toFixed(0)}%
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                <p>Product: {attachmentData.product_name || '—'}</p>
                <p>Supplier: {attachmentData.supplier || '—'}</p>
                <p>Unit price: {attachmentData.pricing.unit_price ?? '—'} {attachmentData.pricing.currency || ''}</p>
                <p>Total offer: {attachmentData.pricing.total_offer ?? '—'} {attachmentData.pricing.currency || ''}</p>
                <p>Quote ref: {attachmentData.reference_numbers.quote || '—'}</p>
                <p>PO ref: {attachmentData.reference_numbers.po || '—'}</p>
              </div>
              {attachmentData.cost_breakdown.length > 0 && (
                <div className="text-muted-foreground">
                  <p className="font-medium text-foreground">Cost breakdown</p>
                  {attachmentData.cost_breakdown.slice(0, 5).map((item, index) => (
                    <p key={`${item.item}_${index}`}>
                      {item.item}: {item.cost} {item.currency || attachmentData.pricing.currency || 'EUR'}
                    </p>
                  ))}
                </div>
              )}
              <Button type="button" size="sm" className="gap-1" onClick={() => autoFillFromAttachment(attachmentData)}>
                <Sparkles className="h-3.5 w-3.5" /> Auto-fill Product Form
              </Button>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Product name *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Industrial HVAC Solution" required />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">SKU</label>
            <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="e.g. ING-001" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Category</label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Ingetrans" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Currency</label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger><SelectValue placeholder="Select currency" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="GBP">GBP</SelectItem>
                <SelectItem value="CHF">CHF</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Type / Lifecycle</label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Innovation">Innovation</SelectItem>
                <SelectItem value="Growth">Growth</SelectItem>
                <SelectItem value="Core">Core</SelectItem>
                <SelectItem value="Commodity">Commodity</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Average deal value</label>
            <Input type="number" value={averageValue} onChange={(e) => setAverageValue(e.target.value)} placeholder="e.g. 25000" min={0} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Selling price</label>
            <Input type="number" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} placeholder="e.g. 21000" min={0} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Unit cost</label>
            <Input type="number" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} placeholder="e.g. 15000" min={0} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Stock quantity</label>
            <Input type="number" value={stockQuantity} onChange={(e) => setStockQuantity(e.target.value)} placeholder="e.g. 12" min={0} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Quote reference</label>
            <Input value={quoteReference} onChange={(e) => setQuoteReference(e.target.value)} placeholder="e.g. Q-2026-0142" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">PO reference</label>
            <Input value={poReference} onChange={(e) => setPoReference(e.target.value)} placeholder="e.g. PO-5689" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="retired">Retired</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Product summary or extracted details." rows={3} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Comments / Positioning notes</label>
            <Textarea value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Describe the product value proposition or market positioning notes." rows={3} />
          </div>
          <div className="md:col-span-2">
            <Button type="submit" disabled={!name.trim()}>Add product</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
