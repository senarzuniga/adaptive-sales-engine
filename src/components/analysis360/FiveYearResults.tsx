import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, ComposedChart } from 'recharts';
import { OrderRecord, StrategyRecord, CompanyProfile } from '@/store/DataStore';
import { groupBy, fmt, fmtAxis, COLORS } from './AnalysisUtils';
import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface Props {
  orders: OrderRecord[];
  strategy: StrategyRecord[];
  isPipelineData?: boolean;
  company?: CompanyProfile;
}

export const FiveYearResults = ({ orders, strategy, isPipelineData = false, company }: Props) => {
  // Parse consultant's revenue for reference line
  const consultantYearlyRevenue = useMemo(() => {
    const notes = company?.additional_notes || '';
    const annualRev = company?.annual_revenue || '';
    const match = (notes + ' ' + annualRev).match(/(?:average\s+revenue|€)\s*[:\s]*([0-9.,]+)\s*(m|million|mln)/i);
    if (match) return parseFloat(match[1].replace(',', '.')) * 1_000_000;
    return 0;
  }, [company]);

  const byYear = useMemo(() => {
    const groups = groupBy(orders, o => o.purchasingYear);
    return Object.entries(groups)
      .filter(([year]) => year && year !== 'Unknown')
      .map(([year, items]) => {
        const revenue = items.reduce((s, i) => s + i.sellingPrice, 0);
        const margin = items.reduce((s, i) => s + i.margin, 0);
        const customers = new Set(items.map(i => i.customerName)).size;
        const orderCount = items.length;
        const avgOrderValue = orderCount > 0 ? revenue / orderCount : 0;
        const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;
        return { name: year, revenue, margin, customers, orderCount, avgOrderValue, marginPct };
      }).sort((a, b) => a.name.localeCompare(b.name));
  }, [orders]);

  // YoY growth
  const withGrowth = useMemo(() => {
    return byYear.map((y, i) => ({
      ...y,
      revenueGrowth: i > 0 && byYear[i - 1].revenue > 0
        ? ((y.revenue - byYear[i - 1].revenue) / byYear[i - 1].revenue) * 100
        : 0,
      marginGrowth: i > 0 && byYear[i - 1].margin > 0
        ? ((y.margin - byYear[i - 1].margin) / byYear[i - 1].margin) * 100
        : 0,
    }));
  }, [byYear]);

  // For pipeline data, show by customer (more useful than by year)
  const byCustomerForPipeline = useMemo(() => {
    if (!isPipelineData) return [];
    const groups = groupBy(orders, o => o.customerName);
    return Object.entries(groups)
      .map(([name, items]) => ({
        name: name.length > 20 ? name.substring(0, 18) + '…' : name,
        fullName: name,
        revenue: items.reduce((s, i) => s + i.sellingPrice, 0),
        margin: items.reduce((s, i) => s + i.margin, 0),
        deals: items.length,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 12);
  }, [orders, isPipelineData]);

  // By product family for pipeline
  const byProductForPipeline = useMemo(() => {
    if (!isPipelineData) return [];
    const groups = groupBy(orders, o => o.productFamily || 'Unclassified');
    return Object.entries(groups)
      .map(([name, items]) => ({
        name,
        revenue: items.reduce((s, i) => s + i.sellingPrice, 0),
        deals: items.length,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [orders, isPipelineData]);

  // Strategy vs Actuals per year
  const stratVsActual = useMemo(() => {
    const stratByYear = groupBy(strategy, s => {
      const q = s.estPurchasingQuarter || '';
      const match = q.match(/(\d{4})/);
      return match ? match[1] : '';
    });
    return byYear.map(y => {
      const planned = (stratByYear[y.name] || []).reduce((s, r) => s + r.estRevenue, 0);
      return { ...y, planned, achievement: planned > 0 ? (y.revenue / planned) * 100 : 0 };
    });
  }, [byYear, strategy]);

  // Product family over years (only for real order data)
  const productTrends = useMemo(() => {
    if (isPipelineData) return [];
    const families = [...new Set(orders.map(o => o.productFamily).filter(Boolean))];
    const years = [...new Set(orders.map(o => o.purchasingYear).filter(Boolean))].sort();
    return years.map(year => {
      const yearOrders = orders.filter(o => o.purchasingYear === year);
      const row: any = { year };
      families.forEach(f => {
        row[f] = yearOrders.filter(o => o.productFamily === f).reduce((s, o) => s + o.sellingPrice, 0);
      });
      return row;
    });
  }, [orders, isPipelineData]);

  const productFamilies = useMemo(() =>
    [...new Set(orders.map(o => o.productFamily).filter(Boolean))], [orders]);

  // Regional patterns
  const regionTrends = useMemo(() => {
    if (isPipelineData) return [];
    const regionsSet = [...new Set(orders.map(o => o.region).filter(Boolean))];
    const years = [...new Set(orders.map(o => o.purchasingYear).filter(Boolean))].sort();
    return years.map(year => {
      const yearOrders = orders.filter(o => o.purchasingYear === year);
      const row: any = { year };
      regionsSet.forEach(r => {
        row[r] = yearOrders.filter(o => o.region === r).reduce((s, o) => s + o.sellingPrice, 0);
      });
      return row;
    });
  }, [orders, isPipelineData]);

  const regions = useMemo(() =>
    [...new Set(orders.map(o => o.region).filter(Boolean))], [orders]);

  const GrowthIcon = ({ value }: { value: number }) =>
    value > 2 ? <TrendingUp className="h-3.5 w-3.5 text-success inline" /> :
    value < -2 ? <TrendingDown className="h-3.5 w-3.5 text-destructive inline" /> :
    <Minus className="h-3.5 w-3.5 text-muted-foreground inline" />;

  // Pipeline-specific view
  if (isPipelineData) {
    return (
      <div className="space-y-6">
        {/* Pipeline notice */}
        <Card className="border-l-4 border-l-primary bg-primary/5">
          <CardContent className="pt-4 pb-3 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-foreground text-sm">Pipeline Analysis (No Historical Orders)</p>
              <p className="text-xs text-muted-foreground">
                Charts below show pipeline opportunity distribution, not historical performance. 
                {consultantYearlyRevenue > 0 && ` Company avg yearly revenue: ${fmt(consultantYearlyRevenue)} (from company profile).`}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Pipeline by Customer */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Pipeline by Customer</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={byCustomerForPipeline} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tickFormatter={fmtAxis} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis type="category" dataKey="name" width={120} stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Pipeline Value" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Pipeline by Product Family */}
          <Card>
            <CardHeader><CardTitle className="text-base">Pipeline by Product Family</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={byProductForPipeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} angle={-20} textAnchor="end" height={60} />
                  <YAxis tickFormatter={fmtAxis} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Bar dataKey="revenue" fill="hsl(150,60%,45%)" radius={[4, 4, 0, 0]} name="Pipeline Value" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Pipeline Summary Table */}
        <Card>
          <CardHeader><CardTitle className="text-base">Pipeline Summary</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="text-xs">Customer</TableHead>
                  <TableHead className="text-xs text-right">Pipeline Value</TableHead>
                  <TableHead className="text-xs text-right">Deals</TableHead>
                  <TableHead className="text-xs text-right">Avg Deal Value</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {byCustomerForPipeline.map(c => (
                    <TableRow key={c.fullName}>
                      <TableCell className="text-xs font-medium">{c.fullName}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{fmt(c.revenue)}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{c.deals}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{fmt(c.deals > 0 ? c.revenue / c.deals : 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Historical order data view
  return (
    <div className="space-y-6">
      {/* Summary Table */}
      <Card>
        <CardHeader><CardTitle className="text-base">5-Year Performance Summary</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="text-xs">Year</TableHead>
                <TableHead className="text-xs text-right">Revenue</TableHead>
                <TableHead className="text-xs text-right">YoY %</TableHead>
                <TableHead className="text-xs text-right">Margin</TableHead>
                <TableHead className="text-xs text-right">Margin %</TableHead>
                <TableHead className="text-xs text-right">Orders</TableHead>
                <TableHead className="text-xs text-right">Avg Order</TableHead>
                <TableHead className="text-xs text-right">Customers</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {withGrowth.map(y => (
                  <TableRow key={y.name}>
                    <TableCell className="text-xs font-medium">{y.name}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums">{fmt(y.revenue)}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums">
                      <GrowthIcon value={y.revenueGrowth} /> {y.revenueGrowth !== 0 ? `${y.revenueGrowth > 0 ? '+' : ''}${y.revenueGrowth.toFixed(1)}%` : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-right tabular-nums">{fmt(y.margin)}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums">{y.marginPct.toFixed(1)}%</TableCell>
                    <TableCell className="text-xs text-right tabular-nums">{y.orderCount}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums">{fmt(y.avgOrderValue)}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums">{y.customers}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Revenue & Margin Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Revenue & Margin Trend</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={byYear}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis tickFormatter={fmtAxis} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Revenue" />
                <Line type="monotone" dataKey="margin" stroke="hsl(150,60%,45%)" strokeWidth={2} name="Margin" />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Strategy vs Actuals per year */}
        <Card>
          <CardHeader><CardTitle className="text-base">Patterns vs Strategy</CardTitle></CardHeader>
          <CardContent>
            {stratVsActual.some(s => s.planned > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stratVsActual}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis tickFormatter={fmtAxis} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Legend />
                  <Bar dataKey="planned" fill="hsl(var(--muted-foreground))" opacity={0.4} name="Strategy Target" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" name="Actual" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">No strategy data available for comparison</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Product Family Trends */}
      {productTrends.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Product Family Patterns Over Time</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={productTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis tickFormatter={fmtAxis} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend />
                {productFamilies.map((f, i) => (
                  <Bar key={f} dataKey={f} stackId="a" fill={COLORS[i % COLORS.length]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Regional Trends */}
      {regionTrends.length > 0 && regions.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Regional Revenue Patterns</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={regionTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis tickFormatter={fmtAxis} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend />
                {regions.map((r, i) => (
                  <Line key={r} type="monotone" dataKey={r} stroke={COLORS[i % COLORS.length]} strokeWidth={2} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
};