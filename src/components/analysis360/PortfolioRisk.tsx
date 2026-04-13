import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { OrderRecord } from '@/store/DataStore';
import { groupBy, fmt, COLORS } from './AnalysisUtils';
import { useMemo } from 'react';
import { AlertTriangle, ShieldCheck, ShieldAlert } from 'lucide-react';

interface Props {
  orders: OrderRecord[];
}

export const PortfolioRisk = ({ orders }: Props) => {
  const totalRevenue = useMemo(() => orders.reduce((s, o) => s + o.sellingPrice, 0), [orders]);

  // Customer concentration
  const byCustomer = useMemo(() => {
    const groups = groupBy(orders, o => o.customerName);
    return Object.entries(groups).map(([name, items]) => ({
      name,
      revenue: items.reduce((s, i) => s + i.sellingPrice, 0),
      margin: items.reduce((s, i) => s + i.margin, 0),
      orders: items.length,
      products: new Set(items.map(i => i.productFamily)).size,
      regions: new Set(items.map(i => i.region)).size,
    })).sort((a, b) => b.revenue - a.revenue);
  }, [orders]);

  // Pareto
  const paretoData = useMemo(() => {
    let cumulative = 0;
    return byCustomer.map(c => {
      cumulative += c.revenue;
      const pct = totalRevenue > 0 ? (c.revenue / totalRevenue) * 100 : 0;
      return { ...c, pct, cumulativePct: totalRevenue > 0 ? (cumulative / totalRevenue) * 100 : 0 };
    });
  }, [byCustomer, totalRevenue]);

  const customersFor80 = useMemo(() => {
    const idx = paretoData.findIndex(p => p.cumulativePct >= 80);
    return idx >= 0 ? idx + 1 : paretoData.length;
  }, [paretoData]);

  // Product concentration
  const byProduct = useMemo(() => {
    const groups = groupBy(orders, o => o.productFamily);
    return Object.entries(groups).map(([name, items]) => ({
      name,
      revenue: items.reduce((s, i) => s + i.sellingPrice, 0),
      pct: totalRevenue > 0 ? (items.reduce((s, i) => s + i.sellingPrice, 0) / totalRevenue) * 100 : 0,
    })).sort((a, b) => b.revenue - a.revenue);
  }, [orders, totalRevenue]);

  // Regional concentration
  const byRegion = useMemo(() => {
    const groups = groupBy(orders, o => o.region);
    return Object.entries(groups).map(([name, items]) => ({
      name,
      revenue: items.reduce((s, i) => s + i.sellingPrice, 0),
      pct: totalRevenue > 0 ? (items.reduce((s, i) => s + i.sellingPrice, 0) / totalRevenue) * 100 : 0,
    })).sort((a, b) => b.revenue - a.revenue);
  }, [orders, totalRevenue]);

  // HHI (Herfindahl-Hirschman Index)
  const customerHHI = useMemo(() =>
    byCustomer.reduce((s, c) => {
      const share = totalRevenue > 0 ? (c.revenue / totalRevenue) * 100 : 0;
      return s + share * share;
    }, 0), [byCustomer, totalRevenue]);

  const productHHI = useMemo(() =>
    byProduct.reduce((s, p) => s + p.pct * p.pct, 0), [byProduct]);

  const riskLevel = (hhi: number) => hhi > 2500 ? 'high' : hhi > 1500 ? 'medium' : 'low';
  const customerRisk = riskLevel(customerHHI);
  const productRisk = riskLevel(productHHI);

  const RiskIcon = ({ level }: { level: string }) =>
    level === 'high' ? <ShieldAlert className="h-5 w-5 text-destructive" /> :
    level === 'medium' ? <AlertTriangle className="h-5 w-5 text-warning" /> :
    <ShieldCheck className="h-5 w-5 text-success" />;

  return (
    <div className="space-y-6">
      {/* Risk Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className={`border-l-4 ${customerRisk === 'high' ? 'border-l-destructive' : customerRisk === 'medium' ? 'border-l-warning' : 'border-l-success'}`}>
          <CardContent className="pt-5 flex items-center gap-3">
            <RiskIcon level={customerRisk} />
            <div>
              <p className="text-xs text-muted-foreground">Customer Concentration</p>
              <p className="font-bold text-foreground">{customerRisk.toUpperCase()}</p>
              <p className="text-xs text-muted-foreground">{customersFor80} clients = 80% revenue</p>
            </div>
          </CardContent>
        </Card>
        <Card className={`border-l-4 ${productRisk === 'high' ? 'border-l-destructive' : productRisk === 'medium' ? 'border-l-warning' : 'border-l-success'}`}>
          <CardContent className="pt-5 flex items-center gap-3">
            <RiskIcon level={productRisk} />
            <div>
              <p className="text-xs text-muted-foreground">Product Concentration</p>
              <p className="font-bold text-foreground">{productRisk.toUpperCase()}</p>
              <p className="text-xs text-muted-foreground">Top product: {byProduct[0]?.pct.toFixed(0)}% of revenue</p>
            </div>
          </CardContent>
        </Card>
        <Card className={`border-l-4 ${byRegion.length <= 2 ? 'border-l-destructive' : byRegion.length <= 4 ? 'border-l-warning' : 'border-l-success'}`}>
          <CardContent className="pt-5 flex items-center gap-3">
            <RiskIcon level={byRegion.length <= 2 ? 'high' : byRegion.length <= 4 ? 'medium' : 'low'} />
            <div>
              <p className="text-xs text-muted-foreground">Geographic Diversification</p>
              <p className="font-bold text-foreground">{byRegion.length} regions</p>
              <p className="text-xs text-muted-foreground">Top region: {byRegion[0]?.pct.toFixed(0)}% of revenue</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pareto Chart */}
      <Card>
        <CardHeader><CardTitle className="text-base">Customer Pareto Analysis (80/20)</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={paretoData.slice(0, 20)}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} angle={-35} textAnchor="end" height={80} />
              <YAxis yAxisId="rev" tickFormatter={fmt} stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis yAxisId="pct" orientation="right" domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={12} unit="%" />
              <Tooltip />
              <Legend />
              <Bar yAxisId="rev" dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Revenue" />
              <Line yAxisId="pct" type="monotone" dataKey="cumulativePct" stroke="hsl(0,70%,55%)" strokeWidth={2} name="Cumulative %" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Concentration charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Product Concentration</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={byProduct} cx="50%" cy="50%" outerRadius={100} dataKey="revenue" nameKey="name"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {byProduct.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmt(v)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Regional Concentration</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={byRegion} cx="50%" cy="50%" outerRadius={100} dataKey="revenue" nameKey="name"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {byRegion.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmt(v)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top customers detail */}
      <Card>
        <CardHeader><CardTitle className="text-base">Customer Portfolio Detail</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="text-xs">#</TableHead>
                <TableHead className="text-xs">Customer</TableHead>
                <TableHead className="text-xs text-right">Revenue</TableHead>
                <TableHead className="text-xs text-right">Share %</TableHead>
                <TableHead className="text-xs text-right">Margin</TableHead>
                <TableHead className="text-xs text-right">Orders</TableHead>
                <TableHead className="text-xs text-right">Products</TableHead>
                <TableHead className="text-xs text-right">Regions</TableHead>
                <TableHead className="text-xs">Dependency</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {paretoData.slice(0, 15).map((c, i) => (
                  <TableRow key={c.name}>
                    <TableCell className="text-xs">{i + 1}</TableCell>
                    <TableCell className="text-xs font-medium">{c.name}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums">{fmt(c.revenue)}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums">{c.pct.toFixed(1)}%</TableCell>
                    <TableCell className="text-xs text-right tabular-nums">{fmt(c.margin)}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums">{c.orders}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums">{c.products}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums">{c.regions}</TableCell>
                    <TableCell>
                      <Badge variant={c.pct > 20 ? 'destructive' : c.pct > 10 ? 'secondary' : 'default'} className="text-[10px]">
                        {c.pct > 20 ? 'Critical' : c.pct > 10 ? 'High' : 'Normal'}
                      </Badge>
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
