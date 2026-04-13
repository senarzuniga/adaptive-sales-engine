import { useLanguage } from '@/i18n/LanguageContext';
import { useData } from '@/store/DataStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { Upload, AlertTriangle, TrendingUp, Users, MapPin, Package, DollarSign, Target, BarChart3, Shield, Layers, Eye, CheckCircle2, Clock, AlertCircle, Activity } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
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

  const rawOrders = data.orders;
  const strategy = data.strategy;
  const opportunities = data.opportunities;
  const products = data.products;
  const company = data.companyProfile;
  const tasks = data.tasks;

  // Fallback: use opportunities as synthetic orders when no orders exist
  const useOpportunitiesFallback = rawOrders.length === 0 && opportunities.length > 0;
  const orders = useMemo(() => {
    if (!useOpportunitiesFallback) return rawOrders;
    return opportunities.map(o => ({
      id: undefined, poDate: '', firstOfferDate: '', oppNumber: o.oppNumber,
      region: o.region, country: o.country, customerName: o.customerName,
      scope: o.scope, productFamily: o.productFamily, segment: o.segment,
      purchasingYear: o.estPurchasingYear || String(new Date().getFullYear()),
      purchasingQuarter: o.estPurchasingQuarter, purchasingMonth: '',
      sellingPrice: o.estRevenue, margin: o.margin, kam: o.kam,
    }));
  }, [rawOrders, opportunities, useOpportunitiesFallback]);

  const years = useMemo(() => [...new Set(orders.map(o => o.purchasingYear).filter(Boolean))].sort(), [orders]);

  const filtered = useMemo(() => {
    if (periodFilter === 'all') return orders;
    return orders.filter(o => o.purchasingYear === periodFilter);
  }, [orders, periodFilter]);

  const totalRevenue = useMemo(() => filtered.reduce((s, o) => s + o.sellingPrice, 0), [filtered]);
  const totalMargin = useMemo(() => filtered.reduce((s, o) => s + o.margin, 0), [filtered]);
  const avgMarginPct = totalRevenue > 0 ? (totalMargin / totalRevenue * 100) : 0;

  // Parse consultant-entered revenue from company profile (most reliable source)
  const consultantRevenue = useMemo(() => {
    // Try to extract numeric revenue from additional_notes first (e.g., "average revenue: 2,5 Million Euro")
    const notes = company?.additional_notes || '';
    const desc = company?.business_description || '';
    const annualRev = company?.annual_revenue || '';

    // Parse "average revenue: X,X Million" pattern from additional_notes
    const avgRevMatch = notes.match(/average\s+revenue[:\s]*([0-9.,]+)\s*(million|mln|m)\s*(euro|eur|€)?/i);
    if (avgRevMatch) {
      const val = parseFloat(avgRevMatch[1].replace(',', '.'));
      return { value: val * 1_000_000, source: 'Company Profile (Additional Notes)', isAverage: true };
    }

    // Parse from annual_revenue field (e.g., "€2.0M (current)")
    const annualMatch = annualRev.match(/€?\s*([0-9.,]+)\s*(m|million|mln)/i);
    if (annualMatch) {
      const val = parseFloat(annualMatch[1].replace(',', '.'));
      return { value: val * 1_000_000, source: 'Company Profile (Annual Revenue)', isAverage: false };
    }

    // Parse from business_description (e.g., "Revenue: €2.0M")
    const descMatch = desc.match(/revenue[:\s]*€?\s*([0-9.,]+)\s*(m|million|mln)/i);
    if (descMatch) {
      const val = parseFloat(descMatch[1].replace(',', '.'));
      return { value: val * 1_000_000, source: 'Company Profile (Description)', isAverage: false };
    }

    return null;
  }, [company]);

  // Yearly average revenue: use consultant data if available, otherwise compute from orders
  const { yearlyAvgRevenue, currentYearRevenue, yearCount, revenueSource } = useMemo(() => {
    const currentYear = String(new Date().getFullYear());
    const byYear: Record<string, number> = {};
    filtered.forEach(o => {
      const yr = o.purchasingYear || 'Unknown';
      byYear[yr] = (byYear[yr] || 0) + o.sellingPrice;
    });
    const curYearRev = byYear[currentYear] || 0;

    // If consultant provided revenue, use it as the authoritative source
    if (consultantRevenue) {
      return {
        yearlyAvgRevenue: consultantRevenue.value,
        currentYearRevenue: curYearRev,
        yearCount: 1,
        revenueSource: consultantRevenue.source,
      };
    }

    // Otherwise compute from historical order data
    const historicalYears = Object.entries(byYear).filter(([yr]) => yr !== currentYear && yr !== 'Unknown');
    const histTotal = historicalYears.reduce((s, [, v]) => s + v, 0);
    const histCount = historicalYears.length;
    return {
      yearlyAvgRevenue: histCount > 0 ? histTotal / histCount : totalRevenue,
      currentYearRevenue: curYearRev,
      yearCount: histCount || 1,
      revenueSource: histCount > 0 ? 'Historical Orders' : 'Pipeline Data',
    };
  }, [filtered, totalRevenue, consultantRevenue]);

  const byCustomer = useMemo(() => {
    const groups = groupBy(filtered, o => o.customerName);
    return Object.entries(groups).map(([name, items]) => ({
      name, revenue: items.reduce((s, i) => s + i.sellingPrice, 0),
    })).sort((a, b) => b.revenue - a.revenue);
  }, [filtered]);

  // Strategy achievement: use consultant target if available, deduplicate strategy rows
  const { strategyTarget, weightedPipeline, soldRevenue, strategyAchievement, strategySource } = useMemo(() => {
    // Parse consultant's target from company profile (e.g. "targeting €3.5M within 3 years")
    const desc = company?.business_description || '';
    const annualRev = company?.annual_revenue || '';
    const notes = company?.additional_notes || '';
    
    let consultantTarget = 0;
    // Try "targeting €X.XM" pattern
    const targetMatch = (annualRev + ' ' + desc + ' ' + notes).match(/target(?:ing)?\s*[~€]?\s*([0-9.,]+)\s*(m|million|mln)/i);
    if (targetMatch) {
      consultantTarget = parseFloat(targetMatch[1].replace(',', '.')) * 1_000_000;
    }

    // Deduplicate strategy rows by product_family (take unique families, sum once)
    const uniqueFamilies = new Map<string, number>();
    strategy.forEach(s => {
      const key = s.productFamily.trim().toLowerCase();
      if (!uniqueFamilies.has(key)) {
        uniqueFamilies.set(key, s.estRevenue);
      }
    });
    const deduplicatedStrategyTotal = Array.from(uniqueFamilies.values()).reduce((s, v) => s + v, 0);

    // Use consultant target if available, otherwise deduplicated strategy
    const finalTarget = consultantTarget > 0 ? consultantTarget : deduplicatedStrategyTotal;
    const source = consultantTarget > 0 ? 'Company Profile Target' : 'Strategy Data';

    // Calculate actual achievement: SOLD opportunities + weighted open pipeline
    const sold = opportunities.filter(o => o.status === 'SOLD').reduce((s, o) => s + o.estRevenue, 0);
    const openWeighted = opportunities
      .filter(o => o.status !== 'SOLD' && o.status !== 'DESATENDIDO')
      .reduce((s, o) => s + o.estRevenue * (o.contractProb / 100), 0);
    const weighted = sold + openWeighted;

    const achievement = finalTarget > 0 ? (weighted / finalTarget * 100) : 0;

    return {
      strategyTarget: finalTarget,
      weightedPipeline: weighted,
      soldRevenue: sold,
      strategyAchievement: achievement,
      strategySource: source,
    };
  }, [strategy, opportunities, company]);

  // Task accomplishment KPIs
  const taskStats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter(t => t.status === 'done').length;
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const todo = tasks.filter(t => t.status === 'todo').length;
    const overdue = tasks.filter(t => {
      if (t.status === 'done') return false;
      if (!t.dueDate) return false;
      return new Date(t.dueDate) < new Date();
    }).length;
    const completionRate = total > 0 ? (done / total * 100) : 0;
    return { total, done, inProgress, todo, overdue, completionRate };
  }, [tasks]);

  // Performance risk assessment
  const performanceRisks = useMemo(() => {
    const risks: Array<{ level: 'critical' | 'warning' | 'info'; title: string; description: string }> = [];

    // Strategy gap risk
    if (strategyTarget > 0 && strategyAchievement < 50) {
      risks.push({
        level: 'critical',
        title: 'Strategy Achievement Critical',
        description: `Weighted pipeline covers only ${strategyAchievement.toFixed(0)}% of the ${fmt(strategyTarget)} target. Gap: ${fmt(strategyTarget - weightedPipeline)}. Urgent pipeline building needed.`,
      });
    } else if (strategyTarget > 0 && strategyAchievement < 75) {
      risks.push({
        level: 'warning',
        title: 'Strategy Achievement Below Target',
        description: `Weighted pipeline at ${strategyAchievement.toFixed(0)}% of target. Gap of ${fmt(strategyTarget - weightedPipeline)} requires attention.`,
      });
    }

    // Pipeline quality risk — too many low-probability deals
    const lowProbDeals = opportunities.filter(o => o.contractProb < 0.3 && o.status !== 'SOLD' && o.status !== 'DESATENDIDO');
    if (lowProbDeals.length > opportunities.length * 0.5 && opportunities.length > 5) {
      risks.push({
        level: 'warning',
        title: 'Pipeline Quality Concern',
        description: `${lowProbDeals.length} of ${opportunities.length} opportunities (${(lowProbDeals.length / opportunities.length * 100).toFixed(0)}%) have <30% probability. Pipeline may be inflated.`,
      });
    }

    // Neglected opportunities
    const neglected = opportunities.filter(o => o.status === 'DESATENDIDO');
    if (neglected.length > 0) {
      const neglectedValue = neglected.reduce((s, o) => s + o.estRevenue, 0);
      risks.push({
        level: 'warning',
        title: `${neglected.length} Neglected Opportunities`,
        description: `${fmt(neglectedValue)} in pipeline marked as "DESATENDIDO". Review and either reactivate or close these deals.`,
      });
    }

    // Task execution risk
    if (taskStats.overdue > 0) {
      risks.push({
        level: taskStats.overdue > 3 ? 'critical' : 'warning',
        title: `${taskStats.overdue} Overdue Action${taskStats.overdue > 1 ? 's' : ''}`,
        description: `Overdue actions reduce commercial momentum. Complete or reschedule to maintain pipeline velocity.`,
      });
    }

    if (taskStats.total > 0 && taskStats.completionRate < 30) {
      risks.push({
        level: 'warning',
        title: 'Low Action Completion Rate',
        description: `Only ${taskStats.completionRate.toFixed(0)}% of actions completed. This pace risks budget achievement.`,
      });
    }

    return risks;
  }, [strategyTarget, strategyAchievement, weightedPipeline, opportunities, taskStats]);

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

  const hasAnyAnalysisData = orders.length > 0 || opportunities.length > 0 || strategy.length > 0 || products.length > 0;

  if (!hasAnyAnalysisData) {
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

      {useOpportunitiesFallback && (
        <Card className="mb-6 border-l-4 border-l-primary">
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <Target className="h-5 w-5 text-primary flex-shrink-0" />
            <div>
              <p className="font-semibold text-foreground text-sm">Showing Pipeline Data</p>
              <p className="text-xs text-muted-foreground">No closed orders found. Analysis is based on {opportunities.length} opportunities from the pipeline.</p>
            </div>
          </CardContent>
        </Card>
      )}


      {/* KPI Summary - Row 1: Revenue & Pipeline */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-1"><DollarSign className="h-4 w-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">Avg Yearly Revenue</span></div>
          <p className="text-2xl font-bold text-foreground">{fmt(yearlyAvgRevenue)}</p>
          <p className="text-xs text-muted-foreground mt-1">Source: {revenueSource}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-1"><TrendingUp className="h-4 w-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">Weighted Pipeline</span></div>
          <p className="text-2xl font-bold text-foreground">{fmt(weightedPipeline)}</p>
          <p className="text-xs text-muted-foreground mt-1">Sold: {fmt(soldRevenue)} + Weighted open</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-1"><Target className="h-4 w-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">Strategy Achievement</span></div>
          <p className={`text-2xl font-bold ${strategyAchievement >= 100 ? 'text-success' : strategyAchievement >= 70 ? 'text-warning' : 'text-destructive'}`}>
            {strategyTarget > 0 ? `${strategyAchievement.toFixed(0)}%` : '—'}
          </p>
          <div className="mt-1">
            <Progress value={Math.min(strategyAchievement, 100)} className="h-1.5" />
            <p className="text-xs text-muted-foreground mt-1">Target: {fmt(strategyTarget)} · {strategySource}</p>
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-1"><Users className="h-4 w-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">Pipeline Overview</span></div>
          <p className="text-2xl font-bold text-foreground">{opportunities.length} deals</p>
          <p className="text-xs text-muted-foreground mt-1">{byCustomer.length} customers · {filtered.length} {useOpportunitiesFallback ? 'opportunities' : 'orders'}</p>
        </CardContent></Card>
      </div>

      {/* KPI Summary - Row 2: Actions & Performance */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-1"><CheckCircle2 className="h-4 w-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">Action Completion</span></div>
          <p className={`text-2xl font-bold ${taskStats.completionRate >= 70 ? 'text-success' : taskStats.completionRate >= 40 ? 'text-warning' : taskStats.total === 0 ? 'text-muted-foreground' : 'text-destructive'}`}>
            {taskStats.total > 0 ? `${taskStats.completionRate.toFixed(0)}%` : '—'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{taskStats.done}/{taskStats.total} actions completed</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-1"><Activity className="h-4 w-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">Actions In Progress</span></div>
          <p className="text-2xl font-bold text-foreground">{taskStats.inProgress}</p>
          <p className="text-xs text-muted-foreground mt-1">{taskStats.todo} pending · {taskStats.inProgress} active</p>
        </CardContent></Card>
        <Card className={taskStats.overdue > 0 ? 'border-destructive/50' : ''}><CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-1"><Clock className={`h-4 w-4 ${taskStats.overdue > 0 ? 'text-destructive' : 'text-muted-foreground'}`} /><span className="text-sm text-muted-foreground">Overdue Actions</span></div>
          <p className={`text-2xl font-bold ${taskStats.overdue > 0 ? 'text-destructive' : 'text-success'}`}>{taskStats.overdue}</p>
          <p className="text-xs text-muted-foreground mt-1">{taskStats.overdue > 0 ? 'Requires immediate attention' : 'On track'}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-1"><Shield className="h-4 w-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">Risk Alerts</span></div>
          <p className={`text-2xl font-bold ${performanceRisks.filter(r => r.level === 'critical').length > 0 ? 'text-destructive' : performanceRisks.length > 0 ? 'text-warning' : 'text-success'}`}>
            {performanceRisks.length}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {performanceRisks.filter(r => r.level === 'critical').length} critical · {performanceRisks.filter(r => r.level === 'warning').length} warnings
          </p>
        </CardContent></Card>
      </div>

      {/* Performance Risk Alerts */}
      {performanceRisks.length > 0 && (
        <div className="space-y-3 mb-6">
          {performanceRisks.map((risk, i) => (
            <Card key={i} className={`border-l-4 ${risk.level === 'critical' ? 'border-l-destructive bg-destructive/5' : 'border-l-warning bg-warning/5'}`}>
              <CardContent className="pt-4 pb-3 flex items-start gap-3">
                <AlertCircle className={`h-5 w-5 flex-shrink-0 mt-0.5 ${risk.level === 'critical' ? 'text-destructive' : 'text-warning'}`} />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-foreground text-sm">{risk.title}</p>
                    <Badge variant={risk.level === 'critical' ? 'destructive' : 'secondary'} className="text-[10px]">
                      {risk.level === 'critical' ? '🔴 CRITICAL' : '🟡 WARNING'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{risk.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
          <FiveYearResults orders={orders} strategy={strategy} isPipelineData={useOpportunitiesFallback} company={company} />
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
