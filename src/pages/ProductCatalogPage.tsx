import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProductForm, type CatalogProduct } from '@/components/ProductForm';
import { ProductList } from '@/components/ProductList';
import { toast } from '@/hooks/use-toast';
import { runProductCatalogAgent } from '@/agents/productCatalogAgent';
import { supabase } from '@/integrations/supabase/client';
import {
  parseProductsFromWorkbookWithDiagnostics,
  type WorkbookSheetDiagnostics,
} from '@/lib/productDocumentParser';
import { buildProductCatalog, describeProductCatalog } from '@/lib/productCatalog';
import { useData, type ProductRecord } from '@/store/DataStore';

const toCatalogProduct = (record: ProductRecord, index: number): CatalogProduct => ({
  id: `uploaded_${index}_${record.name}`,
  name: record.name,
  sku: record.sku || '',
  category: record.category || '',
  description: record.description || '',
  currency: record.currency || 'EUR',
  quoteReference: String((record.attributes as Record<string, unknown> | undefined)?.ref_quote || ''),
  poReference: String((record.attributes as Record<string, unknown> | undefined)?.ref_po || ''),
  attachmentInfo: ((record.attributes as Record<string, unknown> | undefined)?.attachment_info as any) || undefined,
  attributes: record.attributes,
  type: record.type,
  averageValue: record.averageValue,
  sellingPrice: record.sellingPrice ?? record.averageValue,
  unitCost: record.unitCost ?? 0,
  stockQuantity: record.stockQuantity ?? 0,
  status: record.status || 'active',
  comments: record.comments,
});

const toProductRecord = (product: CatalogProduct): ProductRecord => {
  const mergedAttributes: Record<string, unknown> = { ...(product.attributes || {}) };
  if (product.attachmentInfo) {
    mergedAttributes.attachment_info = product.attachmentInfo;
    mergedAttributes.cost_breakdown = product.attachmentInfo.cost_breakdown || [];
    mergedAttributes.reference_numbers = product.attachmentInfo.reference_numbers || {};
    mergedAttributes.supplier_contact = product.attachmentInfo.supplier_contact || {};
    mergedAttributes.dates = product.attachmentInfo.dates || {};
    mergedAttributes.raw_text_summary = product.attachmentInfo.raw_text_summary || '';
  }
  if (product.quoteReference) mergedAttributes.ref_quote = product.quoteReference;
  if (product.poReference) mergedAttributes.ref_po = product.poReference;

  return {
    name: product.name,
    sku: product.sku,
    category: product.category,
    description: product.description || '',
    currency: product.currency || 'EUR',
    attributes: mergedAttributes,
    sourceDocument: product.attachmentInfo?.source_file,
    confidence: product.attachmentInfo?.confidence_score,
    type: product.type,
    averageValue: product.averageValue,
    sellingPrice: product.sellingPrice,
    unitCost: product.unitCost,
    stockQuantity: product.stockQuantity,
    status: product.status,
    comments: product.comments,
  };
};

const ProductCatalogPage = () => {
  const { data, activeCompanyId, setProducts } = useData();
  const [manualProducts, setManualProducts] = useState<CatalogProduct[]>([]);
  const [workbookDiagnostics, setWorkbookDiagnostics] = useState<WorkbookSheetDiagnostics[]>([]);

  useEffect(() => {
    const uploaded = data.products.map((record, index) => toCatalogProduct(record, index));
    setManualProducts(uploaded);
  }, [data.products]);

  useEffect(() => {
    const hydrateFromLatestProductDocument = async () => {
      if (!activeCompanyId || data.products.length > 0) return;

      const { data: docs, error } = await supabase
        .from('company_documents')
        .select('id, file_name, file_path, category, processing_status')
        .eq('company_id', activeCompanyId)
        .eq('category', 'products')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error || !docs || docs.length === 0) return;
      const latestDoc = docs[0];
      if (!latestDoc.file_path) return;

      const { data: fileBlob, error: downloadError } = await supabase
        .storage
        .from('company-documents')
        .download(latestDoc.file_path);

      if (downloadError || !fileBlob) return;

      const parsed = await parseProductsFromWorkbookWithDiagnostics(fileBlob, latestDoc.file_name || 'uploaded_product_document');
      const recoveredProducts = parsed.products;
      setWorkbookDiagnostics(parsed.diagnostics);
      if (recoveredProducts.length === 0) return;

      await setProducts(recoveredProducts);

      parsed.diagnostics.forEach((diag) => {
        console.info(
          `[ProductWorkbook] Sheet '${diag.sheetName}' -> ${diag.rowCount} rows x ${diag.columnCount} cols | inferred product '${diag.inferredProductName}'${diag.skipped ? ` | skipped: ${diag.reason}` : ''}`,
        );
      });

      toast({
        title: 'Catalog recovered from document',
        description: `${recoveredProducts.length} products were parsed from ${latestDoc.file_name} across ${parsed.diagnostics.length} sheets.`,
      });
    };

    void hydrateFromLatestProductDocument();
  }, [activeCompanyId, data.products, setProducts]);

  const catalog = useMemo(
    () => buildProductCatalog(data.products, manualProducts),
    [data.products, manualProducts],
  );

  const agentResult = useMemo(
    () => runProductCatalogAgent({ products: data.products, catalogProducts: manualProducts }),
    [data.products, manualProducts],
  );

  const summary = useMemo(() => describeProductCatalog(catalog), [catalog]);

  const addProduct = (product: CatalogProduct) => {
    const merged = buildProductCatalog(data.products, [...manualProducts, product]);
    setManualProducts(merged);
  };

  const updateProduct = (updatedProduct: CatalogProduct) => {
    setManualProducts((prev) => prev.map((product) => (
      product.id === updatedProduct.id ? updatedProduct : product
    )));
  };

  const persistCatalog = async () => {
    if (!activeCompanyId) {
      toast({
        title: 'Select a company first',
        description: 'Please choose an active company to save the product catalog.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await setProducts(catalog.map(toProductRecord));
      toast({
        title: 'Product catalog saved',
        description: `${catalog.length} products were saved for the active company.`,
      });
    } catch (error) {
      console.error('Unable to save product catalog', error);
      toast({
        title: 'Save failed',
        description: 'The catalog could not be saved. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded">Pillar 6</span>
          <Badge variant="outline">Product Catalog Manager</Badge>
        </div>
        <h1 className="text-2xl font-semibold">Product Management Module</h1>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Add, edit, and persist your product catalog. This module also classifies lifecycle mix so strategy and pricing pages can use consistent product data.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground">Products</p><p className="text-2xl font-bold">{agentResult.totalProducts}</p></CardContent></Card>
        <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground">Innovation</p><p className="text-2xl font-bold text-primary">{agentResult.byLifecycle.Innovation || 0}</p></CardContent></Card>
        <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground">Growth</p><p className="text-2xl font-bold">{agentResult.byLifecycle.Growth || 0}</p></CardContent></Card>
        <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground">Commodity</p><p className="text-2xl font-bold text-amber-600">{agentResult.byLifecycle.Commodity || 0}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Catalog Insights</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>{summary}</p>
          <p>{agentResult.summary}</p>
        </CardContent>
      </Card>

      {workbookDiagnostics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Workbook Verification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {workbookDiagnostics.map((diag) => (
              <div key={diag.sheetName} className="border rounded-md p-3 text-xs space-y-1">
                <p className="font-semibold text-foreground">Sheet: {diag.sheetName}</p>
                <p className="text-muted-foreground">Rows: {diag.rowCount} · Columns: {diag.columnCount} · Inferred product: {diag.inferredProductName}</p>
                {diag.headers.length > 0 && <p className="text-muted-foreground">Headers: {diag.headers.join(' | ')}</p>}
                {diag.skipped && <p className="text-amber-700">Skipped: {diag.reason || 'No extractable product data'}</p>}
                {diag.previewRows.length > 0 && (
                  <div className="text-muted-foreground">
                    <p>First rows:</p>
                    {diag.previewRows.map((row, rowIdx) => (
                      <p key={`${diag.sheetName}_${rowIdx}`}>{row.join(' | ')}</p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-5 gap-6 items-start">
        <div className="lg:col-span-2">
          <ProductForm onAddProduct={addProduct} />
        </div>
        <div className="lg:col-span-3 space-y-4">
          <ProductList products={catalog} onUpdateProduct={updateProduct} />
          <div className="flex justify-end">
            <Button onClick={persistCatalog}>Save Product Catalog</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductCatalogPage;
