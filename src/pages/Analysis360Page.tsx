import { useLanguage } from '@/i18n/LanguageContext';
import { useData } from '@/store/DataStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { Upload, AlertTriangle, TrendingUp, Users, MapPin, Package, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState, useMemo } from 'react';

const COLORS = ['hsl(215,80%,55%)', 'hsl(150,60%,45%)', 'hsl(35,90%,55%)', 'hsl(0,70%,55%)', 'hsl(280,60%,55%)', 'hsl(180,50%,45%)', 'hsl(60,70%,50%)', 'hsl(330,60%,55%)'];

function groupBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const key = keyFn(item) || 'Unknown';
    (acc[key] = acc[key] || []).push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

const Analysis360Page = () => {
  const { t } = useLanguage();
  const { data, hasData } = useData();
  const navigate = useNavigate();
  const [periodFilter, setPeriodFilter] = useState<string>('all');

  const orders = data.orders;
  const years = useMemo(() => [...new Set(orders.map(o => o.purchasingYear).filter(Boolean))].sort(), [orders]);

  const filtered = useMemo(() => {
    if (periodFilter === 'all') return orders;
    return orders.filter(o => o.purchasingYear === periodFilter);
  }, [orders, periodFilter]);

  const totalRevenue = useMemo(() => filtered.reduce((s, o) => s + o.sellingPrice, 0), [filtered]);
  const totalMargin = useMemo(() => filtered.reduce((s, o) => s + o.margin, 0), [filtered]);
  const avgMarginPct = totalRevenue > 0 ? (totalMargin / totalRevenue * 100) : 0;

  // Sales by KAM
  const byKam = useMemo(() => {
    const groups = groupBy(filtered, o => o.kam);
    return Object.entries(groups).map(([kam, items]) => ({
      name: kam, revenue: items.reduce((s, i) => s + i.sellingPrice, 0), orders: items.length,
    })).sort((a, b) => b.revenue - a.revenue);
  }, [filtered]);

  // Sales by Region
  const byRegion = useMemo(() => {
    const groups = groupBy(filtered, o => o.region);
    return Object.entries(groups).map(([region, items]) => ({
      name: region, revenue: items.reduce((s, i) => s + i.sellingPrice, 0),
    })).sort((a, b) => b.revenue - a.revenue);
  }, [filtered]);

  // Sales by Customer
  const byCustomer = useMemo(() => {
    const groups = groupBy(filtered, o => o.customerName);
    return Object.entries(groups).map(([name, items]) => ({
      name, revenue: items.reduce((s, i) => s + i.sellingPrice, 0),
    })).sort((a, b) => b.revenue - a.revenue);
  }, [filtered]);

  // Sales by Product Family
  const byProduct = useMemo(() => {
    const groups = groupBy(filtered, o => o.productFamily);
    return Object.entries(groups).map(([name, items]) => ({
      name, revenue: items.reduce((s, i) => s + i.sellingPrice, 0),
    })).sort((a, b) => b.revenue - a.revenue);
  }, [filtered]);

  // Sales by Year (trend)
  const byYear = useMemo(() => {
    const groups = groupBy(orders, o => o.purchasingYear);
    return Object.entries(groups).map(([year, items]) => ({
      name: year, revenue: items.reduce((s, i) => s + i.sellingPrice, 0),
      margin: items.reduce((s, i) => s + i.margin, 0),
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [orders]);

  // Portfolio Risk (Pareto)
  const paretoData = useMemo(() => {
    const sorted = [...byCustomer];
    let cumulative = 0;
    return sorted.map(c => {
      cumulative += c.revenue;
      return { name: c.name, revenue: c.revenue, cumulativePct: totalRevenue > 0 ? (cumulative / totalRevenue * 100) : 0 };
    });
  }, [byCustomer, totalRevenue]);

  const customersFor80Pct = useMemo(() => {
    const idx = paretoData.findIndex(p => p.cumulativePct >= 80);
    return idx >= 0 ? idx + 1 : paretoData.length;
  }, [paretoData]);

  const riskLevel = customersFor80Pct <= 3 ? 'high' : customersFor80Pct <= 6 ? 'medium' : 'low';

  // Lead Time calculation
  const avgLeadTime = useMemo(() => {
    const valid = filtered.filter(o => o.poDate && o.firstOfferDate);
    if (valid.length === 0) return null;
    const totalDays = valid.reduce((sum, o) => {
      const po = new Date(o.poDate);
      const offer = new Date(o.firstOfferDate);
      return sum + Math.max(0, (po.getTime() - offer.getTime()) / (1000 * 60 * 60 * 24));
    }, 0);
    return Math.round(totalDays / valid.length);
  }, [filtered]);

  if (!hasData || orders.length === 0) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded">{t.dashboard.pillar} 0</span>
          </div>
          <h2 className="text-2xl font-semibold text-foreground mb-2">{t.pillars.p0.title}</h2>
          <p className="text-muted-foreground">{t.pillars.p0.desc}</p>
        </div>
        <Card>
          <CardContent className="py-16 text-center">
            <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">{t.dashboard.noDataYet}</h3>
            <p className="text-muted-foreground text-sm mb-4">{t.dashboard.uploadPrompt}</p>
            <Button onClick={() => navigate('/upload')} className="gap-2">
              <Upload className="h-4 w-4" /> {t.dashboard.uploadData}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const fmt = (n: number) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(0)}K` : n.toFixed(0);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded">{t.dashboard.pillar} 0</span>
          </div>
          <h2 className="text-2xl font-semibold text-foreground">{t.pillars.p0.title}</h2>
        </div>
        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Periods" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Periods</SelectItem>
            {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-1"><DollarSign className="h-4 w-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">Total Revenue</span></div>
          <p className="text-2xl font-bold text-foreground">{fmt(totalRevenue)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-1"><TrendingUp className="h-4 w-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">Avg Margin</span></div>
          <p className="text-2xl font-bold text-foreground">{avgMarginPct.toFixed(1)}%</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-1"><Users className="h-4 w-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">Customers</span></div>
          <p className="text-2xl font-bold text-foreground">{byCustomer.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-1"><Package className="h-4 w-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">Orders</span></div>
          <p className="text-2xl font-bold text-foreground">{filtered.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-1"><MapPin className="h-4 w-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">Avg Lead Time</span></div>
          <p className="text-2xl font-bold text-foreground">{avgLeadTime != null ? `${avgLeadTime}d` : '—'}</p>
        </CardContent></Card>
      </div>

      {/* Portfolio Risk Alert */}
      {riskLevel !== 'low' && (
        <Card className={`mb-6 border-l-4 ${riskLevel === 'high' ? 'border-l-destructive' : 'border-l-warning'}`}>
          <CardContent className="pt-6 flex items-start gap-3">
            <AlertTriangle className={`h-5 w-5 flex-shrink-0 ${riskLevel === 'high' ? 'text-destructive' : 'text-warning'}`} />
            <div>
              <p className="font-semibold text-foreground">Portfolio Risk: {riskLevel === 'high' ? 'HIGH' : 'MEDIUM'}</p>
              <p className="text-sm text-muted-foreground">
                Only {customersFor80Pct} customer{customersFor80Pct !== 1 ? 's' : ''} represent 80% of total sales.
                {riskLevel === 'high' ? ' This indicates a highly concentrated and risky portfolio.' : ' Consider diversifying your customer base.'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="kam">By KAM</TabsTrigger>
          <TabsTrigger value="region">By Region</TabsTrigger>
          <TabsTrigger value="customer">By Customer</TabsTrigger>
          <TabsTrigger value="product">By Product</TabsTrigger>
          <TabsTrigger value="pareto">Portfolio Risk</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card><CardHeader><CardTitle className="text-base">Revenue Trend</CardTitle></CardHeader>
              <CardContent><ResponsiveContainer width="100%" height={300}>
                <LineChart data={byYear}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={fmt} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} name="Revenue" />
                  <Line type="monotone" dataKey="margin" stroke="hsl(150,60%,45%)" strokeWidth={2} name="Margin" />
                </LineChart>
              </ResponsiveContainer></CardContent>
            </Card>
            <Card><CardHeader><CardTitle className="text-base">Sales by Region</CardTitle></CardHeader>
              <CardContent><ResponsiveContainer width="100%" height={300}>
                <PieChart><Pie data={byRegion} cx="50%" cy="50%" outerRadius={100} dataKey="revenue" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {byRegion.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie><Tooltip formatter={(v: number) => fmt(v)} /></PieChart>
              </ResponsiveContainer></CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="kam">
          <Card><CardHeader><CardTitle className="text-base">Revenue by KAM</CardTitle></CardHeader>
            <CardContent><ResponsiveContainer width="100%" height={400}>
              <BarChart data={byKam} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tickFormatter={fmt} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis dataKey="name" type="category" width={120} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="region">
          <Card><CardHeader><CardTitle className="text-base">Revenue by Region</CardTitle></CardHeader>
            <CardContent><ResponsiveContainer width="100%" height={400}>
              <BarChart data={byRegion}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis tickFormatter={fmt} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="revenue" fill="hsl(215,80%,55%)" radius={[4, 4, 0, 0]}>
                  {byRegion.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customer">
          <Card><CardHeader><CardTitle className="text-base">Top Customers by Revenue</CardTitle></CardHeader>
            <CardContent><ResponsiveContainer width="100%" height={400}>
              <BarChart data={byCustomer.slice(0, 15)} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tickFormatter={fmt} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis dataKey="name" type="category" width={150} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="revenue" fill="hsl(150,60%,45%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="product">
          <Card><CardHeader><CardTitle className="text-base">Revenue by Product Family</CardTitle></CardHeader>
            <CardContent><ResponsiveContainer width="100%" height={400}>
              <BarChart data={byProduct}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis tickFormatter={fmt} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="revenue" fill="hsl(35,90%,55%)" radius={[4, 4, 0, 0]}>
                  {byProduct.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pareto">
          <Card><CardHeader><CardTitle className="text-base">Portfolio Risk — Pareto Analysis</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {customersFor80Pct} of {byCustomer.length} customers represent 80% of total revenue.
                Risk level: <span className={`font-semibold ${riskLevel === 'high' ? 'text-destructive' : riskLevel === 'medium' ? 'text-warning' : 'text-success'}`}>
                  {riskLevel.toUpperCase()}
                </span>
              </p>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={paretoData.slice(0, 20)}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} angle={-30} textAnchor="end" height={80} />
                  <YAxis yAxisId="revenue" tickFormatter={fmt} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis yAxisId="pct" orientation="right" domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={12} unit="%" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="revenue" dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Revenue" />
                  <Line yAxisId="pct" type="monotone" dataKey="cumulativePct" stroke="hsl(0,70%,55%)" strokeWidth={2} name="Cumulative %" dot={false} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Analysis360Page;
