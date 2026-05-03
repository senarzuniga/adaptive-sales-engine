import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pencil, Check, X, Package2 } from 'lucide-react';
import type { CatalogProduct } from '@/components/ProductForm';

interface ProductListProps {
  products: CatalogProduct[];
  onUpdateProduct: (product: CatalogProduct) => void;
}

const lifecycleBadgeVariant = (type: string): 'default' | 'secondary' | 'outline' => {
  if (type === 'Innovation') return 'default';
  if (type === 'Commodity') return 'secondary';
  return 'outline';
};

export function ProductList({ products, onUpdateProduct }: ProductListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<CatalogProduct>>({});

  const renderCostTracking = (product: CatalogProduct) => {
    const attachmentInfo = product.attachmentInfo
      || (product.attributes?.attachment_info as CatalogProduct['attachmentInfo'] | undefined);
    const currency = product.currency || attachmentInfo?.pricing?.currency || 'EUR';
    const quantity = product.stockQuantity || 1;
    const unitPrice = product.sellingPrice || attachmentInfo?.pricing?.unit_price || 0;

    return (
      <div className="rounded-md border bg-muted/20 p-3 space-y-3">
        <h4 className="text-sm font-semibold">Cost Tracking</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
          <div className="rounded border bg-background p-2">
            <p className="text-muted-foreground">Unit Price</p>
            <p className="font-medium">{unitPrice.toLocaleString()} {currency}</p>
          </div>
          <div className="rounded border bg-background p-2">
            <p className="text-muted-foreground">Total</p>
            <p className="font-medium">{(unitPrice * quantity).toLocaleString()} {currency}</p>
          </div>
          <div className="rounded border bg-background p-2">
            <p className="text-muted-foreground">Currency</p>
            <p className="font-medium">{currency}</p>
          </div>
        </div>

        {attachmentInfo?.cost_breakdown && attachmentInfo.cost_breakdown.length > 0 && (
          <div className="space-y-1 text-xs">
            <p className="font-medium">Cost Breakdown (from attachment)</p>
            {attachmentInfo.cost_breakdown.slice(0, 12).map((item, index) => (
              <div key={`${item.item}_${index}`} className="flex justify-between rounded border bg-background px-2 py-1">
                <span>{item.item}</span>
                <span>{item.cost.toLocaleString()} {item.currency || currency}</span>
              </div>
            ))}
          </div>
        )}

        {attachmentInfo?.reference_numbers && Object.values(attachmentInfo.reference_numbers).some(Boolean) && (
          <div className="space-y-1 text-xs">
            <p className="font-medium">Reference Numbers</p>
            <div className="grid md:grid-cols-4 gap-2">
              {Object.entries(attachmentInfo.reference_numbers).map(([key, value]) => (
                value ? <p key={key}><span className="text-muted-foreground">{key.toUpperCase()}:</span> <span className="font-medium">{value}</span></p> : null
              ))}
            </div>
          </div>
        )}

        {attachmentInfo?.dates && Object.values(attachmentInfo.dates).some(Boolean) && (
          <div className="space-y-1 text-xs">
            <p className="font-medium">Key Dates</p>
            <div className="grid md:grid-cols-3 gap-2">
              {Object.entries(attachmentInfo.dates).map(([key, value]) => (
                value ? <p key={key}><span className="text-muted-foreground">{key.replace(/_/g, ' ')}:</span> <span className="font-medium">{value}</span></p> : null
              ))}
            </div>
          </div>
        )}

        {attachmentInfo?.source_file && (
          <p className="text-[11px] text-muted-foreground">
            Source: {attachmentInfo.source_file} • Confidence: {((attachmentInfo.confidence_score || 0) * 100).toFixed(0)}%
          </p>
        )}
      </div>
    );
  };

  if (products.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
          <Package2 className="h-8 w-8 opacity-30" />
          No products in local catalog yet. Use the form above to add products.
        </CardContent>
      </Card>
    );
  }

  const startEdit = (product: CatalogProduct) => {
    setEditingId(product.id);
    setEditValues({ ...product });
  };

  const cancelEdit = () => { setEditingId(null); setEditValues({}); };

  const saveEdit = () => {
    if (editingId) {
      if (editValues.name?.trim()) {
        onUpdateProduct({ ...editValues } as CatalogProduct);
      }
    }
    cancelEdit();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Package2 className="h-4 w-4 text-primary" /> Product Catalog ({products.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Name</TableHead>
              <TableHead className="text-xs">SKU</TableHead>
              <TableHead className="text-xs">Category</TableHead>
              <TableHead className="text-xs">Type</TableHead>
              <TableHead className="text-xs text-right">Avg Value</TableHead>
              <TableHead className="text-xs text-right">Sell</TableHead>
              <TableHead className="text-xs text-right">Cost</TableHead>
              <TableHead className="text-xs text-right">Stock</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs">Notes</TableHead>
              <TableHead className="text-xs">Cost Tracking</TableHead>
              <TableHead className="text-xs w-20">Edit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) =>
              editingId === product.id ? (
                <TableRow key={product.id}>
                  <TableCell>
                    <Input className="h-7 text-xs" value={editValues.name ?? ''} onChange={(e) => setEditValues((v) => ({ ...v, name: e.target.value }))} />
                  </TableCell>
                  <TableCell>
                    <Input className="h-7 text-xs" value={editValues.sku ?? ''} onChange={(e) => setEditValues((v) => ({ ...v, sku: e.target.value }))} />
                  </TableCell>
                  <TableCell>
                    <Input className="h-7 text-xs" value={editValues.category ?? ''} onChange={(e) => setEditValues((v) => ({ ...v, category: e.target.value }))} />
                  </TableCell>
                  <TableCell>
                    <Input className="h-7 text-xs" value={editValues.type ?? ''} onChange={(e) => setEditValues((v) => ({ ...v, type: e.target.value }))} />
                  </TableCell>
                  <TableCell>
                    <Input className="h-7 text-xs" type="number" value={editValues.averageValue ?? 0} onChange={(e) => setEditValues((v) => ({ ...v, averageValue: parseFloat(e.target.value) || 0 }))} />
                  </TableCell>
                  <TableCell>
                    <Input className="h-7 text-xs" type="number" value={editValues.sellingPrice ?? 0} onChange={(e) => setEditValues((v) => ({ ...v, sellingPrice: parseFloat(e.target.value) || 0 }))} />
                  </TableCell>
                  <TableCell>
                    <Input className="h-7 text-xs" type="number" value={editValues.unitCost ?? 0} onChange={(e) => setEditValues((v) => ({ ...v, unitCost: parseFloat(e.target.value) || 0 }))} />
                  </TableCell>
                  <TableCell>
                    <Input className="h-7 text-xs" type="number" value={editValues.stockQuantity ?? 0} onChange={(e) => setEditValues((v) => ({ ...v, stockQuantity: parseFloat(e.target.value) || 0 }))} />
                  </TableCell>
                  <TableCell>
                    <Input className="h-7 text-xs" value={editValues.status ?? 'active'} onChange={(e) => setEditValues((v) => ({ ...v, status: e.target.value }))} />
                  </TableCell>
                  <TableCell>
                    <Input className="h-7 text-xs" value={editValues.comments ?? ''} onChange={(e) => setEditValues((v) => ({ ...v, comments: e.target.value }))} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">-</TableCell>
                  <TableCell className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveEdit}><Check className="h-3.5 w-3.5 text-emerald-600" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEdit}><X className="h-3.5 w-3.5 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ) : (
                <React.Fragment key={product.id}>
                  <TableRow>
                    <TableCell className="text-xs font-medium">{product.name}</TableCell>
                    <TableCell className="text-xs">{product.sku || '—'}</TableCell>
                    <TableCell className="text-xs">{product.category || '—'}</TableCell>
                    <TableCell><Badge variant={lifecycleBadgeVariant(product.type)} className="text-xs">{product.type}</Badge></TableCell>
                    <TableCell className="text-xs text-right">{product.averageValue.toLocaleString()}</TableCell>
                    <TableCell className="text-xs text-right">{(product.sellingPrice || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-xs text-right">{(product.unitCost || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-xs text-right">{(product.stockQuantity || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-xs">{product.status || 'active'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{product.comments ?? '—'}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] px-2"
                        onClick={() => setExpandedId((current) => current === product.id ? null : product.id)}
                      >
                        {expandedId === product.id ? 'Hide' : 'View'}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(product)}><Pencil className="h-3.5 w-3.5" /></Button>
                    </TableCell>
                  </TableRow>
                  {expandedId === product.id && (
                    <TableRow>
                      <TableCell colSpan={12}>{renderCostTracking(product)}</TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              )
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}