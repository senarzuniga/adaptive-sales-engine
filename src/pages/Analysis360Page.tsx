import { useLanguage } from '@/i18n/LanguageContext';
import { useData } from '@/store/DataStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { Upload, AlertTriangle, TrendingUp, Users, MapPin, Package, DollarSign, Target, BarChart3, Shield, Layers, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { groupBy, fmt, COLORS } from '@/components/analysis360/AnalysisUtils';
import { FiveYearResults } from '@/components/analysis360/FiveYearResults';
import { PortfolioRisk } from '@/components/analysis360/PortfolioRisk';
import { KeyAccountMapping } from '@/components/analysis360/KeyAccountMapping';
import { ProductPortfolioAnalysis } from '@/components/analysis360/ProductPortfolioAnalysis';
import { BrandingVsStrategy } from '@/components/analysis360/BrandingVsStrategy';
import { ExecutiveInsights } from '@/components/analysis360/ExecutiveInsights';

const Analysis360Page = () => {
  const { t } = useLanguage();
  const { data, hasData } = useData();
  const navigate = useNavigate();
  const [periodFilter, setPeriodFilter] = useState<string>('all');

  const orders = data.orders;
  const strategy = data.strategy;
  const opportunities = data.opportunities;
  const products = data.products;
  const company = data.companyProfile;
  const years = useMemo(() => [...new Set(orders.map(o => o.purchasingYear).filter(Boolean))].sort(), [orders]);

  const filtered = useMemo(() => {
    if (periodFilter === 'all') return orders;
    return orders.filter(o => o.purchasingYear === periodFilter);
  }, [orders, periodFilter]);

  const totalRevenue = useMemo(() => filtered.reduce((s, o) => s + o.sellingPrice, 0), [filtered]);
  const totalMargin = useMemo(() => filtered.reduce((s, o) => s + o.margin, 0), [filtered]);
  const avgMarginPct = totalRevenue > 0 ? (totalMargin / totalRevenue * 100) : 0;

  const byCustomer = useMemo(() => {
    const groups = groupBy(filtered, o => o.customerName);
    return Object.entries(groups).map(([name, items]) => ({
      name, revenue: items.reduce((s, i) => s + i.sellingPrice, 0),
    })).sort((a, b) => b.revenue - a.revenue);
  }, [filtered]);

  const totalPlanned = strategy.reduce((s, r) => s + r.estRevenue, 0);
  const overallAchievement = totalPlanned > 0 ? (totalRevenue / totalPlanned * 100) : 0;

  // Pareto risk
  const paretoData = useMemo(() => {
    let cumulative = 0;
    return byCustomer.map(c => {
      cumulative += c.revenue;
      return { ...c, cumulativePct: totalRevenue > 0 ? (cumulative / totalRevenue * 100) : 0 };
    });
  }, [byCustomer, totalRevenue]);
  const customersFor80Pct = useMemo(() => {
    const idx = paretoData.findIndex(p => p.cumulativePct >= 80);
    return idx >= 0 ? idx + 1 : paretoData.length;
  }, [paretoData]);
  const riskLevel = customersFor80Pct <= 3 ? 'high' : customersFor80Pct <= 6 ? 'medium' : 'low';

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
            <Button onClick={() => navigate('/upload')} className="gap-2"><Upload className="h-4 w-4" /> {t.dashboard.uploadData}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded">{t.dashboard.pillar} 0</span>
          </div>
          <h2 className="text-2xl font-semibold text-foreground">360º Analysis</h2>
          <p className="text-sm text-muted-foreground mt-1">Complete company overview with patterns, portfolio risk, and strategic alignment</p>
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
          <div className="flex items-center gap-2 mb-1"><Target className="h-4 w-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">Strategy Achievement</span></div>
          <p className={`text-2xl font-bold ${overallAchievement >= 100 ? 'text-success' : overallAchievement >= 70 ? 'text-warning' : 'text-destructive'}`}>
            {totalPlanned > 0 ? `${overallAchievement.toFixed(0)}%` : '—'}
          </p>
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

      {/* AI Executive Insights */}
      <div className="mb-6">
        <ExecutiveInsights
          orders={filtered}
          opportunities={opportunities}
          products={products}
          strategy={strategy}
          company={company}
        />
      </div>

      <Tabs defaultValue="5year" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="5year" className="gap-1 text-xs"><BarChart3 className="h-3 w-3" /> 5-Year Results</TabsTrigger>
          <TabsTrigger value="portfolio-risk" className="gap-1 text-xs"><Shield className="h-3 w-3" /> Portfolio Risk</TabsTrigger>
          <TabsTrigger value="kam" className="gap-1 text-xs"><Users className="h-3 w-3" /> Key Account Mapping</TabsTrigger>
          <TabsTrigger value="product-analysis" className="gap-1 text-xs"><Layers className="h-3 w-3" /> Product Portfolio</TabsTrigger>
          <TabsTrigger value="branding" className="gap-1 text-xs"><Eye className="h-3 w-3" /> Branding vs Strategy</TabsTrigger>
        </TabsList>

        <TabsContent value="5year">
          <FiveYearResults orders={orders} strategy={strategy} />
        </TabsContent>

        <TabsContent value="portfolio-risk">
          <PortfolioRisk orders={filtered} />
        </TabsContent>

        <TabsContent value="kam">
          <KeyAccountMapping orders={filtered} opportunities={opportunities} />
        </TabsContent>

        <TabsContent value="product-analysis">
          <ProductPortfolioAnalysis orders={filtered} strategy={strategy} products={products} company={company} />
        </TabsContent>

        <TabsContent value="branding">
          <BrandingVsStrategy orders={filtered} strategy={strategy} company={company} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Analysis360Page;
