import { useData } from '@/store/DataStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PAGE_SIZE = 10;

function fmt(n: number) {
  return n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toFixed(0);
}

export function DataPreviewTables() {
  const { data } = useData();
  const [page, setPage] = useState<Record<string, number>>({ orders: 0, opportunities: 0, products: 0, strategy: 0, leads: 0, contacts: 0 });

  const hasAny = data.orders.length > 0 || data.opportunities.length > 0 || data.products.length > 0 || data.strategy.length > 0 || data.leads.length > 0 || data.contacts.length > 0;
  if (!hasAny) return null;

  const defaultTab = data.orders.length > 0
    ? 'orders'
    : data.opportunities.length > 0
      ? 'opportunities'
      : data.products.length > 0
        ? 'products'
        : data.strategy.length > 0
          ? 'strategy'
          : data.leads.length > 0
            ? 'leads'
            : 'contacts';

  const paginate = <T,>(arr: T[], key: string) => {
    const p = page[key] || 0;
    const start = p * PAGE_SIZE;
    return { rows: arr.slice(start, start + PAGE_SIZE), total: arr.length, page: p, totalPages: Math.ceil(arr.length / PAGE_SIZE) };
  };

  const PaginationControls = ({ dataKey, total, currentPage, totalPages }: { dataKey: string; total: number; currentPage: number; totalPages: number }) => (
    <div className="flex items-center justify-between pt-3 border-t border-border">
      <span className="text-xs text-muted-foreground">{total} rows total</span>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" disabled={currentPage === 0} onClick={() => setPage(p => ({ ...p, [dataKey]: currentPage - 1 }))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground">{currentPage + 1} / {totalPages}</span>
        <Button variant="ghost" size="sm" disabled={currentPage >= totalPages - 1} onClick={() => setPage(p => ({ ...p, [dataKey]: currentPage + 1 }))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  const orders = paginate(data.orders, 'orders');
  const opps = paginate(data.opportunities, 'opportunities');
  const prods = paginate(data.products, 'products');
  const strat = paginate(data.strategy, 'strategy');
  const leads = paginate(data.leads, 'leads');
  const contacts = paginate(data.contacts, 'contacts');

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Data Preview</CardTitle></CardHeader>
      <CardContent>
        <Tabs defaultValue={defaultTab}>
          <TabsList className="mb-4">
            {data.orders.length > 0 && <TabsTrigger value="orders">Orders <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">{data.orders.length}</Badge></TabsTrigger>}
            {data.opportunities.length > 0 && <TabsTrigger value="opportunities">Opportunities <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">{data.opportunities.length}</Badge></TabsTrigger>}
            {data.products.length > 0 && <TabsTrigger value="products">Products <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">{data.products.length}</Badge></TabsTrigger>}
            {data.strategy.length > 0 && <TabsTrigger value="strategy">Strategy <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">{data.strategy.length}</Badge></TabsTrigger>}
            {data.leads.length > 0 && <TabsTrigger value="leads">Leads <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">{data.leads.length}</Badge></TabsTrigger>}
            {data.contacts.length > 0 && <TabsTrigger value="contacts">Contacts <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">{data.contacts.length}</Badge></TabsTrigger>}
          </TabsList>

          {data.orders.length > 0 && (
            <TabsContent value="orders">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="text-xs">Customer</TableHead>
                    <TableHead className="text-xs">Region</TableHead>
                    <TableHead className="text-xs">Product Family</TableHead>
                    <TableHead className="text-xs">Year</TableHead>
                    <TableHead className="text-xs">Quarter</TableHead>
                    <TableHead className="text-xs text-right">Revenue</TableHead>
                    <TableHead className="text-xs text-right">Margin</TableHead>
                    <TableHead className="text-xs">KAM</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {orders.rows.map((o, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs font-medium">{o.customerName || '—'}</TableCell>
                        <TableCell className="text-xs">{o.region || '—'}</TableCell>
                        <TableCell className="text-xs">{o.productFamily || '—'}</TableCell>
                        <TableCell className="text-xs">{o.purchasingYear || '—'}</TableCell>
                        <TableCell className="text-xs">{o.purchasingQuarter || '—'}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{fmt(o.sellingPrice)}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{fmt(o.margin)}</TableCell>
                        <TableCell className="text-xs">{o.kam || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <PaginationControls dataKey="orders" total={orders.total} currentPage={orders.page} totalPages={orders.totalPages} />
            </TabsContent>
          )}

          {data.opportunities.length > 0 && (
            <TabsContent value="opportunities">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="text-xs">Opp #</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Customer</TableHead>
                    <TableHead className="text-xs">Region</TableHead>
                    <TableHead className="text-xs">Product Family</TableHead>
                    <TableHead className="text-xs text-right">Est. Revenue</TableHead>
                    <TableHead className="text-xs text-right">Prob %</TableHead>
                    <TableHead className="text-xs">KAM</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {opps.rows.map((o, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs font-medium">{o.oppNumber || '—'}</TableCell>
                        <TableCell className="text-xs">
                          <Badge variant={o.status.toLowerCase().includes('won') ? 'default' : o.status.toLowerCase().includes('lost') ? 'destructive' : 'secondary'} className="text-[10px]">
                            {o.status || '—'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{o.customerName || '—'}</TableCell>
                        <TableCell className="text-xs">{o.region || '—'}</TableCell>
                        <TableCell className="text-xs">{o.productFamily || '—'}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{fmt(o.estRevenue)}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{o.contractProb}%</TableCell>
                        <TableCell className="text-xs">{o.kam || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <PaginationControls dataKey="opportunities" total={opps.total} currentPage={opps.page} totalPages={opps.totalPages} />
            </TabsContent>
          )}

          {data.products.length > 0 && (
            <TabsContent value="products">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="text-xs">Name</TableHead>
                    <TableHead className="text-xs text-right">Avg Value</TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs">Comments</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {prods.rows.map((p, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs font-medium">{p.name || '—'}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{fmt(p.averageValue)}</TableCell>
                        <TableCell className="text-xs">
                          <Badge variant={p.type.toLowerCase().includes('innov') ? 'default' : p.type.toLowerCase().includes('decline') ? 'destructive' : 'secondary'} className="text-[10px]">
                            {p.type || '—'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{p.comments || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <PaginationControls dataKey="products" total={prods.total} currentPage={prods.page} totalPages={prods.totalPages} />
            </TabsContent>
          )}

          {data.strategy.length > 0 && (
            <TabsContent value="strategy">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="text-xs">Product Family</TableHead>
                    <TableHead className="text-xs">Region</TableHead>
                    <TableHead className="text-xs">Segment</TableHead>
                    <TableHead className="text-xs">Quarter</TableHead>
                    <TableHead className="text-xs text-right">Est. Revenue</TableHead>
                    <TableHead className="text-xs text-right">Margin</TableHead>
                    <TableHead className="text-xs">KAM</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {strat.rows.map((s, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs font-medium">{s.productFamily || '—'}</TableCell>
                        <TableCell className="text-xs">{s.region || '—'}</TableCell>
                        <TableCell className="text-xs">{s.numberOfSegment || '—'}</TableCell>
                        <TableCell className="text-xs">{s.estPurchasingQuarter || '—'}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{fmt(s.estRevenue)}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{fmt(s.margin)}</TableCell>
                        <TableCell className="text-xs">{s.kam || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <PaginationControls dataKey="strategy" total={strat.total} currentPage={strat.page} totalPages={strat.totalPages} />
            </TabsContent>
          )}

          {data.leads.length > 0 && (
            <TabsContent value="leads">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="text-xs">Lead</TableHead>
                    <TableHead className="text-xs">Company</TableHead>
                    <TableHead className="text-xs">Email</TableHead>
                    <TableHead className="text-xs">Sector</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Owner</TableHead>
                    <TableHead className="text-xs text-right">Est. Value</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {leads.rows.map((lead, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs font-medium">{lead.leadName || '—'}</TableCell>
                        <TableCell className="text-xs">{lead.companyName || '—'}</TableCell>
                        <TableCell className="text-xs">{lead.email || '—'}</TableCell>
                        <TableCell className="text-xs">{lead.sector || '—'}</TableCell>
                        <TableCell className="text-xs">{lead.status || '—'}</TableCell>
                        <TableCell className="text-xs">{lead.owner || '—'}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{fmt(lead.estimatedValue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <PaginationControls dataKey="leads" total={leads.total} currentPage={leads.page} totalPages={leads.totalPages} />
            </TabsContent>
          )}

          {data.contacts.length > 0 && (
            <TabsContent value="contacts">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="text-xs">Name</TableHead>
                    <TableHead className="text-xs">Company</TableHead>
                    <TableHead className="text-xs">Email</TableHead>
                    <TableHead className="text-xs">Role</TableHead>
                    <TableHead className="text-xs">Department</TableHead>
                    <TableHead className="text-xs">KAM</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {contacts.rows.map((contact, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs font-medium">{contact.name || '—'}</TableCell>
                        <TableCell className="text-xs">{contact.companyName || '—'}</TableCell>
                        <TableCell className="text-xs">{contact.email || '—'}</TableCell>
                        <TableCell className="text-xs">{contact.role || '—'}</TableCell>
                        <TableCell className="text-xs">{contact.department || '—'}</TableCell>
                        <TableCell className="text-xs">{contact.kam || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <PaginationControls dataKey="contacts" total={contacts.total} currentPage={contacts.page} totalPages={contacts.totalPages} />
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
}
