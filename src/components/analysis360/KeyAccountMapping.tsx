import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ScatterChart, Scatter, ZAxis } from 'recharts';
import { OrderRecord, OpportunityRecord } from '@/store/DataStore';
import { groupBy, fmt, COLORS } from './AnalysisUtils';
import { useMemo } from 'react';

interface Props {
  orders: OrderRecord[];
  opportunities: OpportunityRecord[];
}

export const KeyAccountMapping = ({ orders, opportunities }: Props) => {
  const totalRevenue = useMemo(() => orders.reduce((s, o) => s + o.sellingPrice, 0), [orders]);

  // KAM performance
  const kamData = useMemo(() => {
    const groups = groupBy(orders, o => o.kam);
    return Object.entries(groups).map(([kam, items]) => {
      const revenue = items.reduce((s, i) => s + i.sellingPrice, 0);
      const margin = items.reduce((s, i) => s + i.margin, 0);
      const customers = new Set(items.map(i => i.customerName)).size;
      const products = new Set(items.map(i => i.productFamily)).size;
      const regions = new Set(items.map(i => i.region)).size;
      const avgDealSize = items.length > 0 ? revenue / items.length : 0;
      const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;
      const share = totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0;
      return { kam, revenue, margin, marginPct, customers, products, regions, orders: items.length, avgDealSize, share };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [orders, totalRevenue]);

  // KAM pipeline (opportunities)
  const kamPipeline = useMemo(() => {
    const groups = groupBy(opportunities, o => o.kam);
    return Object.entries(groups).map(([kam, items]) => ({
      kam,
      pipeline: items.reduce((s, i) => s + i.estRevenue, 0),
      oppCount: items.length,
      avgProb: items.length > 0 ? items.reduce((s, i) => s + i.contractProb, 0) / items.length : 0,
    }));
  }, [opportunities]);

  // Combined view
  const combined = useMemo(() => {
    return kamData.map(k => {
      const pipe = kamPipeline.find(p => p.kam === k.kam);
      return {
        ...k,
        pipeline: pipe?.pipeline || 0,
        oppCount: pipe?.oppCount || 0,
        avgProb: pipe?.avgProb || 0,
      };
    });
  }, [kamData, kamPipeline]);

  // Customer-KAM matrix
  const customerKamMatrix = useMemo(() => {
    const byCustomer = groupBy(orders, o => o.customerName);
    return Object.entries(byCustomer).map(([customer, items]) => {
      const revenue = items.reduce((s, i) => s + i.sellingPrice, 0);
      const kams = [...new Set(items.map(i => i.kam))];
      return { customer, revenue, kams: kams.join(', '), kamCount: kams.length };
    }).sort((a, b) => b.revenue - a.revenue).slice(0, 20);
  }, [orders]);

  return (
    <div className="space-y-6">
      {/* KAM KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card><CardContent className="pt-5 pb-4">
          <p className="text-xs text-muted-foreground mb-1">Active KAMs</p>
          <p className="text-2xl font-bold text-foreground">{kamData.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5 pb-4">
          <p className="text-xs text-muted-foreground mb-1">Avg Revenue per KAM</p>
          <p className="text-2xl font-bold text-foreground">{fmt(totalRevenue / Math.max(kamData.length, 1))}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5 pb-4">
          <p className="text-xs text-muted-foreground mb-1">Top KAM Share</p>
          <p className="text-2xl font-bold text-foreground">{kamData[0]?.share.toFixed(0) || 0}%</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5 pb-4">
          <p className="text-xs text-muted-foreground mb-1">Total Pipeline</p>
          <p className="text-2xl font-bold text-foreground">{fmt(kamPipeline.reduce((s, k) => s + k.pipeline, 0))}</p>
        </CardContent></Card>
      </div>

      {/* KAM Revenue Chart */}
      <Card>
        <CardHeader><CardTitle className="text-base">Revenue & Pipeline by KAM</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={combined} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tickFormatter={fmt} stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis dataKey="kam" type="category" width={120} stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Legend />
              <Bar dataKey="revenue" fill="hsl(var(--primary))" name="Booked Revenue" radius={[0, 4, 4, 0]} />
              <Bar dataKey="pipeline" fill="hsl(35,90%,55%)" name="Pipeline" radius={[0, 4, 4, 0]} opacity={0.6} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* KAM Detail Table */}
      <Card>
        <CardHeader><CardTitle className="text-base">KAM Performance Matrix</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="text-xs">KAM</TableHead>
                <TableHead className="text-xs text-right">Revenue</TableHead>
                <TableHead className="text-xs text-right">Share</TableHead>
                <TableHead className="text-xs text-right">Margin %</TableHead>
                <TableHead className="text-xs text-right">Customers</TableHead>
                <TableHead className="text-xs text-right">Orders</TableHead>
                <TableHead className="text-xs text-right">Avg Deal</TableHead>
                <TableHead className="text-xs text-right">Products</TableHead>
                <TableHead className="text-xs text-right">Pipeline</TableHead>
                <TableHead className="text-xs">Rating</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {combined.map(k => {
                  const score = (k.marginPct > 30 ? 2 : k.marginPct > 15 ? 1 : 0) +
                    (k.customers > 5 ? 2 : k.customers > 2 ? 1 : 0) +
                    (k.pipeline > 0 ? 1 : 0);
                  return (
                    <TableRow key={k.kam}>
                      <TableCell className="text-xs font-medium">{k.kam}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{fmt(k.revenue)}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{k.share.toFixed(1)}%</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{k.marginPct.toFixed(1)}%</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{k.customers}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{k.orders}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{fmt(k.avgDealSize)}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{k.products}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{fmt(k.pipeline)}</TableCell>
                      <TableCell>
                        <Badge variant={score >= 4 ? 'default' : score >= 2 ? 'secondary' : 'destructive'} className="text-[10px]">
                          {score >= 4 ? 'Strong' : score >= 2 ? 'Average' : 'Weak'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Top Customer-KAM mapping */}
      <Card>
        <CardHeader><CardTitle className="text-base">Customer → KAM Assignment</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="text-xs">Customer</TableHead>
                <TableHead className="text-xs text-right">Revenue</TableHead>
                <TableHead className="text-xs">Assigned KAM(s)</TableHead>
                <TableHead className="text-xs text-center">Multi-KAM</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {customerKamMatrix.map(c => (
                  <TableRow key={c.customer}>
                    <TableCell className="text-xs font-medium">{c.customer}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums">{fmt(c.revenue)}</TableCell>
                    <TableCell className="text-xs">{c.kams}</TableCell>
                    <TableCell className="text-xs text-center">
                      {c.kamCount > 1 && <Badge variant="secondary" className="text-[10px]">{c.kamCount} KAMs</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
