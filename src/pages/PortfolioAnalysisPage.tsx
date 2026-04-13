import { useState, useMemo } from 'react';
import { useData } from '@/store/DataStore';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { VoiceTextInput } from '@/components/VoiceTextInput';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, Area, AreaChart,
} from 'recharts';
import {
  PieChart as PieChartIcon, BarChart3, TrendingUp, AlertTriangle, Globe, MapPin,
  Loader2, Brain, ShieldAlert, ShieldCheck, Shield, Users, Target, ArrowRight,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const COLORS = [
  'hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))',
  'hsl(var(--chart-4))', 'hsl(var(--chart-5))', '#8884d8', '#ffc658',
  '#ff7c43', '#a05195', '#2f4b7c', '#665191', '#d45087',
];

interface PortfolioAnalysis {
  riskLevel: string;
  riskScore: number;
  concentrationSummary: string;
  paretoInsight: string;
  segments: Array<{
    name: string; description: string; customerCount: number;
    revenueShare: string; riskLevel: string; trend: string;
    recommendations: string[];
  }>;
  globalCustomerInsights: Array<{
    customerName: string; regions: string[]; insight: string; opportunity: string;
  }>;
  localMarketInsights: Array<{
    country: string; keyDrivers: string; topCustomers: string[]; recommendation: string;
  }>;
  strategicRecommendations: string[];
  priorityActions: Array<{
    action: string; priority: string; impact: string; timeline: string;
  }>;
}

const PortfolioAnalysisPage = () => {
  const { activeCompanyId, data } = useData();
  const [periodFilter, setPeriodFilter] = useState<'1yr' | '3yr' | 'all'>('all');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<PortfolioAnalysis | null>(null);
  const [additionalNotes, setAdditionalNotes] = useState('');

  // Build unified records: use orders if available, fallback to opportunities
  const useOpportunitiesFallback = data.orders.length === 0 && data.opportunities.length > 0;
  const dataSourceLabel = useOpportunitiesFallback ? 'Pipeline (Opportunities)' : 'Orders';

  const baseRecords = useMemo(() => {
    if (!useOpportunitiesFallback) return data.orders;
    // Synthesize order-like records from opportunities
    return data.opportunities.map(o => ({
      id: undefined,
      poDate: '', firstOfferDate: '', oppNumber: o.oppNumber,
      region: o.region, country: o.country, customerName: o.customerName,
      scope: o.scope, productFamily: o.productFamily, segment: o.segment,
      purchasingYear: o.estPurchasingYear || String(new Date().getFullYear()),
      purchasingQuarter: o.estPurchasingQuarter, purchasingMonth: '',
      sellingPrice: o.estRevenue, margin: o.margin, kam: o.kam,
    }));
  }, [data.orders, data.opportunities, useOpportunitiesFallback]);

  // Filter by period
  const filteredOrders = useMemo(() => {
    if (periodFilter === 'all') return baseRecords;
    const currentYear = new Date().getFullYear();
    const cutoff = periodFilter === '1yr' ? currentYear - 1 : currentYear - 3;
    return baseRecords.filter(o => {
      const year = parseInt(o.purchasingYear);
      return !isNaN(year) && year >= cutoff;
    });
  }, [baseRecords, periodFilter]);

  // Pareto analysis
  const paretoData = useMemo(() => {
    const customerRevenue: Record<string, number> = {};
    filteredOrders.forEach(o => {
      const name = o.customerName || 'Unknown';
      customerRevenue[name] = (customerRevenue[name] || 0) + o.sellingPrice;
    });

    const sorted = Object.entries(customerRevenue)
      .sort(([, a], [, b]) => b - a)
      .map(([name, revenue]) => ({ name, revenue }));

    const totalRevenue = sorted.reduce((sum, c) => sum + c.revenue, 0);
    let cumulative = 0;

    return sorted.map((c, i) => {
      cumulative += c.revenue;
      return {
        ...c,
        share: totalRevenue > 0 ? (c.revenue / totalRevenue * 100) : 0,
        cumulative: totalRevenue > 0 ? (cumulative / totalRevenue * 100) : 0,
        rank: i + 1,
      };
    });
  }, [filteredOrders]);

  // Key metrics
  const metrics = useMemo(() => {
    const totalRevenue = paretoData.reduce((s, c) => s + c.revenue, 0);
    const totalCustomers = paretoData.length;
    const top80Index = paretoData.findIndex(c => c.cumulative >= 80);
    const customersFor80 = top80Index >= 0 ? top80Index + 1 : totalCustomers;
    const concentrationRatio = totalCustomers > 0 ? (customersFor80 / totalCustomers * 100) : 0;
    const riskLevel = concentrationRatio <= 15 ? 'critical' : concentrationRatio <= 30 ? 'high' : concentrationRatio <= 50 ? 'medium' : 'low';

    return { totalRevenue, totalCustomers, customersFor80, concentrationRatio, riskLevel };
  }, [paretoData]);

  // Region breakdown
  const regionData = useMemo(() => {
    const byRegion: Record<string, { revenue: number; customers: Set<string>; orders: number }> = {};
    filteredOrders.forEach(o => {
      const region = o.region || 'Unknown';
      if (!byRegion[region]) byRegion[region] = { revenue: 0, customers: new Set(), orders: 0 };
      byRegion[region].revenue += o.sellingPrice;
      byRegion[region].customers.add(o.customerName);
      byRegion[region].orders++;
    });
    return Object.entries(byRegion)
      .map(([region, d]) => ({ region, revenue: d.revenue, customers: d.customers.size, orders: d.orders }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filteredOrders]);

  // Country breakdown
  const countryData = useMemo(() => {
    const byCountry: Record<string, { revenue: number; customers: Set<string> }> = {};
    filteredOrders.forEach(o => {
      const country = o.country || 'Unknown';
      if (!byCountry[country]) byCountry[country] = { revenue: 0, customers: new Set() };
      byCountry[country].revenue += o.sellingPrice;
      byCountry[country].customers.add(o.customerName);
    });
    return Object.entries(byCountry)
      .map(([country, d]) => ({ country, revenue: d.revenue, customers: d.customers.size }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filteredOrders]);

  // Segment breakdown
  const segmentData = useMemo(() => {
    const bySegment: Record<string, { revenue: number; customers: Set<string> }> = {};
    filteredOrders.forEach(o => {
      const seg = o.segment || 'Unassigned';
      if (!bySegment[seg]) bySegment[seg] = { revenue: 0, customers: new Set() };
      bySegment[seg].revenue += o.sellingPrice;
      bySegment[seg].customers.add(o.customerName);
    });
    return Object.entries(bySegment)
      .map(([segment, d]) => ({ segment, revenue: d.revenue, customers: d.customers.size }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filteredOrders]);

  // Global vs Local customers
  const globalLocalData = useMemo(() => {
    const customerRegions: Record<string, Set<string>> = {};
    filteredOrders.forEach(o => {
      const name = o.customerName || 'Unknown';
      if (!customerRegions[name]) customerRegions[name] = new Set();
      if (o.region) customerRegions[name].add(o.region);
    });

    const customerRevenue: Record<string, number> = {};
    filteredOrders.forEach(o => {
      customerRevenue[o.customerName || 'Unknown'] = (customerRevenue[o.customerName || 'Unknown'] || 0) + o.sellingPrice;
    });

    const globals: Array<{ name: string; revenue: number; regions: string[] }> = [];
    const locals: Array<{ name: string; revenue: number; region: string }> = [];

    Object.entries(customerRegions).forEach(([name, regions]) => {
      const revenue = customerRevenue[name] || 0;
      if (regions.size > 1) {
        globals.push({ name, revenue, regions: Array.from(regions) });
      } else {
        locals.push({ name, revenue, region: Array.from(regions)[0] || 'Unknown' });
      }
    });

    globals.sort((a, b) => b.revenue - a.revenue);
    locals.sort((a, b) => b.revenue - a.revenue);

    return { globals, locals };
  }, [filteredOrders]);

  // Yearly trend
  const yearlyTrend = useMemo(() => {
    const byYear: Record<string, number> = {};
    filteredOrders.forEach(o => {
      const yr = o.purchasingYear || 'Unknown';
      byYear[yr] = (byYear[yr] || 0) + o.sellingPrice;
    });
    return Object.entries(byYear).sort(([a], [b]) => a.localeCompare(b))
      .map(([year, revenue]) => ({ year, revenue }));
  }, [filteredOrders]);

  const handleAIAnalysis = async (type: string) => {
    if (!activeCompanyId) return;
    setIsAnalyzing(true);
    try {
      const ordersInfo = filteredOrders.slice(0, 200).map(o =>
        `${o.customerName}|${o.region}|${o.country}|${o.segment}|${o.productFamily}|€${o.sellingPrice}|${o.purchasingYear}`
      ).join('\n');

      const oppsInfo = data.opportunities.slice(0, 100).map(o =>
        `${o.customerName}|${o.status}|${o.region}|${o.segment}|€${o.estRevenue}|${o.contractProb}%`
      ).join('\n');

      const stratInfo = data.strategy.map(s =>
        `${s.productFamily}|${s.region}|€${s.estRevenue}|${s.margin}%|${s.kam}`
      ).join('\n');

      const { data: result, error } = await supabase.functions.invoke('analyze-portfolio', {
        body: {
          companyProfile: data.companyProfile,
          ordersData: ordersInfo,
          opportunitiesData: oppsInfo,
          strategyData: stratInfo,
          analysisType: type,
        },
      });
      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      setAnalysis(result);
      toast({ title: '✅ Analysis complete' });
    } catch (e: any) {
      toast({ title: 'Analysis failed', description: e.message, variant: 'destructive' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const fmt = (n: number) => `€${n.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const RiskIcon = ({ level }: { level: string }) => {
    if (level === 'critical' || level === 'high') return <ShieldAlert className="h-5 w-5 text-destructive" />;
    if (level === 'medium') return <Shield className="h-5 w-5 text-amber-500" />;
    return <ShieldCheck className="h-5 w-5 text-green-500" />;
  };

  if (!activeCompanyId) {
    return (
      <div className="p-6 lg:p-8 max-w-4xl mx-auto text-center py-20">
        <PieChartIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">No company selected</h2>
        <p className="text-muted-foreground">Select a company to analyze its customer portfolio.</p>
      </div>
    );
  }

  if (baseRecords.length === 0 && data.strategy.length === 0) {
    return (
      <div className="p-6 lg:p-8 max-w-4xl mx-auto text-center py-20">
        <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">No data available</h2>
        <p className="text-muted-foreground">Upload orders, opportunities, or strategy data to enable portfolio analysis.</p>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          <PieChartIcon className="h-6 w-6 text-primary" /> Customer & Portfolio Analysis
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          Pareto concentration risk, customer segmentation, global vs local insights
        </p>
      </div>

      {useOpportunitiesFallback && (
        <Card className="mb-6 border-l-4 border-l-primary">
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <Target className="h-5 w-5 text-primary flex-shrink-0" />
            <div>
              <p className="font-semibold text-foreground text-sm">Showing Pipeline Data</p>
              <p className="text-xs text-muted-foreground">No closed orders found. Analysis is based on {data.opportunities.length} opportunities from the pipeline.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex gap-1 bg-muted/50 rounded-lg p-1">
          {(['1yr', '3yr', 'all'] as const).map(p => (
            <Button
              key={p}
              variant={periodFilter === p ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setPeriodFilter(p)}
            >
              {p === '1yr' ? 'Last Year' : p === '3yr' ? 'Last 3 Years' : 'All Time'}
            </Button>
          ))}
        </div>
        <div className="flex-1" />
        <Button onClick={() => handleAIAnalysis('risk')} disabled={isAnalyzing} variant="outline" className="gap-2">
          {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
          Risk Analysis
        </Button>
        <Button onClick={() => handleAIAnalysis('segmentation')} disabled={isAnalyzing} variant="outline" className="gap-2">
          {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
          AI Segmentation
        </Button>
        <Button onClick={() => handleAIAnalysis('insights')} disabled={isAnalyzing} className="gap-2">
          {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
          Full AI Analysis
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-xs text-muted-foreground">Total Revenue</p>
            <p className="text-xl font-bold text-foreground">{fmt(metrics.totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-xs text-muted-foreground">Total Customers</p>
            <p className="text-xl font-bold text-foreground">{metrics.totalCustomers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-xs text-muted-foreground">Customers for 80%</p>
            <p className="text-xl font-bold text-foreground">{metrics.customersFor80}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-xs text-muted-foreground">Concentration</p>
            <p className="text-xl font-bold text-foreground">{metrics.concentrationRatio.toFixed(0)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-xs text-muted-foreground">Risk Level</p>
            <div className="flex items-center justify-center gap-1.5">
              <RiskIcon level={metrics.riskLevel} />
              <span className={`text-lg font-bold capitalize ${
                metrics.riskLevel === 'critical' || metrics.riskLevel === 'high' ? 'text-destructive'
                : metrics.riskLevel === 'medium' ? 'text-amber-500' : 'text-green-500'
              }`}>{metrics.riskLevel}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pareto" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="pareto" className="gap-1 text-xs"><BarChart3 className="h-3.5 w-3.5" /> Pareto</TabsTrigger>
          <TabsTrigger value="segments" className="gap-1 text-xs"><PieChartIcon className="h-3.5 w-3.5" /> Segments</TabsTrigger>
          <TabsTrigger value="geo" className="gap-1 text-xs"><Globe className="h-3.5 w-3.5" /> Geo Analysis</TabsTrigger>
          <TabsTrigger value="ai" className="gap-1 text-xs"><Brain className="h-3.5 w-3.5" /> AI Insights</TabsTrigger>
        </TabsList>

        {/* PARETO TAB */}
        <TabsContent value="pareto" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Cumulative Chart */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Revenue Concentration (Pareto)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={paretoData.slice(0, 30)}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="rank" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} unit="%" />
                    <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                    <Area type="monotone" dataKey="cumulative" fill="hsl(var(--primary) / 0.2)" stroke="hsl(var(--primary))" name="Cumulative %" />
                    {/* 80% reference line */}
                    <Line type="monotone" dataKey={() => 80} stroke="hsl(var(--destructive))" strokeDasharray="5 5" dot={false} name="80% threshold" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Top Customers Bar */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Top 15 Customers by Revenue</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={paretoData.slice(0, 15)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => fmt(v)} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={120} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Customer Table */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Customer Revenue Ranking</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-auto max-h-[400px]">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-2 text-muted-foreground">#</th>
                      <th className="text-left py-2 px-2 text-muted-foreground">Customer</th>
                      <th className="text-right py-2 px-2 text-muted-foreground">Revenue</th>
                      <th className="text-right py-2 px-2 text-muted-foreground">Share</th>
                      <th className="text-right py-2 px-2 text-muted-foreground">Cumulative</th>
                      <th className="text-center py-2 px-2 text-muted-foreground">Zone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paretoData.map((c, i) => (
                      <tr key={c.name} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-1.5 px-2 text-muted-foreground">{i + 1}</td>
                        <td className="py-1.5 px-2 font-medium text-foreground">{c.name}</td>
                        <td className="py-1.5 px-2 text-right text-foreground">{fmt(c.revenue)}</td>
                        <td className="py-1.5 px-2 text-right text-muted-foreground">{c.share.toFixed(1)}%</td>
                        <td className="py-1.5 px-2 text-right text-muted-foreground">{c.cumulative.toFixed(1)}%</td>
                        <td className="py-1.5 px-2 text-center">
                          <Badge variant={c.cumulative <= 80 ? 'destructive' : c.cumulative <= 95 ? 'secondary' : 'outline'} className="text-[9px]">
                            {c.cumulative <= 80 ? 'A (80%)' : c.cumulative <= 95 ? 'B (95%)' : 'C (tail)'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SEGMENTS TAB */}
        <TabsContent value="segments" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Revenue by Segment</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={segmentData} dataKey="revenue" nameKey="segment" cx="50%" cy="50%" outerRadius={100} label={({ segment, percent }) => `${segment} (${(percent * 100).toFixed(0)}%)`} labelLine={{ stroke: 'hsl(var(--muted-foreground))' }}>
                      {segmentData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Revenue Trend by Year</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={yearlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="year" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={v => fmt(v)} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Segment Details */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Segment Breakdown</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {segmentData.map((s, i) => (
                  <div key={s.segment} className="p-3 rounded-lg border border-border">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-sm font-medium text-foreground">{s.segment}</span>
                    </div>
                    <p className="text-lg font-bold text-foreground">{fmt(s.revenue)}</p>
                    <p className="text-xs text-muted-foreground">{s.customers} customers</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* GEO TAB */}
        <TabsContent value="geo" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Region Chart */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Globe className="h-4 w-4 text-primary" /> Revenue by Region</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={regionData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="region" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={v => fmt(v)} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Country Chart */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> Top Countries</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={countryData.slice(0, 12)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => fmt(v)} />
                    <YAxis type="category" dataKey="country" tick={{ fontSize: 9 }} width={90} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Bar dataKey="revenue" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Global vs Local */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Globe className="h-4 w-4 text-primary" /> Global Customers ({globalLocalData.globals.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {globalLocalData.globals.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">No multi-region customers found</p>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-auto">
                    {globalLocalData.globals.slice(0, 20).map(c => (
                      <div key={c.name} className="p-2 rounded border border-border">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-foreground">{c.name}</span>
                          <span className="text-xs text-muted-foreground">{fmt(c.revenue)}</span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {c.regions.map(r => <Badge key={r} variant="outline" className="text-[9px]">{r}</Badge>)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> Local Customers ({globalLocalData.locals.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {globalLocalData.locals.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">No single-region customers found</p>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-auto">
                    {globalLocalData.locals.slice(0, 20).map(c => (
                      <div key={c.name} className="flex items-center justify-between p-2 rounded border border-border">
                        <div>
                          <span className="text-sm font-medium text-foreground">{c.name}</span>
                          <Badge variant="secondary" className="ml-2 text-[9px]">{c.region}</Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">{fmt(c.revenue)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* AI INSIGHTS TAB */}
        <TabsContent value="ai" className="space-y-4">
          {/* Additional Notes */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Additional Context for AI Analysis</CardTitle></CardHeader>
            <CardContent>
              <VoiceTextInput
                value={additionalNotes}
                onChange={setAdditionalNotes}
                placeholder="Add context about specific customers, market conditions, or strategic priorities..."
                rows={2}
              />
            </CardContent>
          </Card>

          {!analysis && !isAnalyzing && (
            <Card>
              <CardContent className="py-16 text-center">
                <Brain className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-sm text-muted-foreground">Click one of the AI analysis buttons above to generate strategic portfolio insights.</p>
              </CardContent>
            </Card>
          )}

          {isAnalyzing && (
            <Card>
              <CardContent className="py-16 text-center">
                <Loader2 className="h-10 w-10 text-primary mx-auto mb-3 animate-spin" />
                <p className="text-sm text-muted-foreground">Analyzing portfolio data...</p>
              </CardContent>
            </Card>
          )}

          {analysis && (
            <>
              {/* Risk Overview */}
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <RiskIcon level={analysis.riskLevel} />
                      <span className="text-lg font-bold capitalize text-foreground">{analysis.riskLevel} Risk</span>
                      <Badge variant="outline">{analysis.riskScore}/100</Badge>
                    </div>
                    <Separator orientation="vertical" className="h-6 hidden md:block" />
                    <p className="text-sm text-muted-foreground">{analysis.paretoInsight}</p>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">{analysis.concentrationSummary}</p>
                </CardContent>
              </Card>

              {/* AI Segments */}
              {analysis.segments.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Customer Segments</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {analysis.segments.map((seg, i) => (
                      <div key={i} className="p-3 rounded-lg border border-border">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-foreground">{seg.name}</span>
                          <div className="flex gap-1.5">
                            <Badge variant={seg.riskLevel === 'high' ? 'destructive' : seg.riskLevel === 'medium' ? 'secondary' : 'outline'} className="text-[9px]">{seg.riskLevel}</Badge>
                            <Badge variant="outline" className="text-[9px] gap-0.5">
                              <TrendingUp className="h-2.5 w-2.5" /> {seg.trend}
                            </Badge>
                            <Badge variant="outline" className="text-[9px]">{seg.revenueShare}</Badge>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{seg.description} · {seg.customerCount} customers</p>
                        {seg.recommendations.length > 0 && (
                          <div className="space-y-1">
                            {seg.recommendations.map((r, j) => (
                              <div key={j} className="flex items-start gap-1.5">
                                <ArrowRight className="h-3 w-3 text-primary mt-0.5 flex-shrink-0" />
                                <span className="text-xs text-muted-foreground">{r}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Global Insights */}
              {analysis.globalCustomerInsights.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Globe className="h-4 w-4 text-primary" /> Global Customer Insights</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {analysis.globalCustomerInsights.map((g, i) => (
                      <div key={i} className="p-2 rounded border border-border">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-foreground">{g.customerName}</span>
                          <div className="flex gap-1">{g.regions.map(r => <Badge key={r} variant="outline" className="text-[8px]">{r}</Badge>)}</div>
                        </div>
                        <p className="text-xs text-muted-foreground">{g.insight}</p>
                        <p className="text-xs text-primary mt-1">💡 {g.opportunity}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Local Market Insights */}
              {analysis.localMarketInsights.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> Local Market Insights</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {analysis.localMarketInsights.map((l, i) => (
                      <div key={i} className="p-2 rounded border border-border">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary" className="text-[10px]">{l.country}</Badge>
                          <span className="text-xs text-muted-foreground">Top: {l.topCustomers.join(', ')}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{l.keyDrivers}</p>
                        <p className="text-xs text-primary mt-1">→ {l.recommendation}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Priority Actions */}
              {analysis.priorityActions.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> Priority Actions</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {analysis.priorityActions.map((a, i) => (
                        <div key={i} className="flex items-start gap-3 p-2 rounded border border-border">
                          <Badge variant={a.priority === 'high' ? 'destructive' : a.priority === 'medium' ? 'secondary' : 'outline'} className="text-[9px] mt-0.5 flex-shrink-0">{a.priority}</Badge>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground">{a.action}</p>
                            <p className="text-xs text-muted-foreground">{a.impact} · {a.timeline}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Strategic Recommendations */}
              {analysis.strategicRecommendations.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Strategic Recommendations</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-1.5">
                      {analysis.strategicRecommendations.map((r, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-xs text-primary font-medium mt-0.5">{i + 1}.</span>
                          <p className="text-xs text-muted-foreground">{r}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PortfolioAnalysisPage;
