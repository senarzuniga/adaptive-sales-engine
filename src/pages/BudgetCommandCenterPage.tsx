import { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { useData } from '@/store/DataStore';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle, TrendingDown, TrendingUp, DollarSign, Target,
  ShieldAlert, ArrowRight, BarChart3, Wrench, FolderKanban,
  CheckCircle2, XCircle, Clock, Zap, RefreshCw
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface GapItem {
  id: string;
  module: 'sales' | 'after-sales' | 'projects';
  type: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  detail: string;
  impact: number;
  action: string;
  metric?: string;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--destructive))', 'hsl(220, 70%, 50%)', 'hsl(45, 90%, 50%)', 'hsl(160, 60%, 45%)'];

export default function BudgetCommandCenterPage() {
  const { t } = useLanguage();
  const { selectedCompanyId } = useDataStore();
  const [loading, setLoading] = useState(true);
  const [salesData, setSalesData] = useState<{ orders: any[]; opportunities: any[] }>({ orders: [], opportunities: [] });
  const [projectsData, setProjectsData] = useState<{ projects: any[]; costs: any[]; changeOrders: any[] }>({ projects: [], costs: [], changeOrders: [] });
  const [afterSalesData, setAfterSalesData] = useState<{ contracts: any[]; opportunities: any[]; parts: any[] }>({ contracts: [], opportunities: [], parts: [] });

  useEffect(() => {
    if (!selectedCompanyId) return;
    loadAllData();
  }, [selectedCompanyId]);

  const loadAllData = async () => {
    if (!selectedCompanyId) return;
    setLoading(true);
    try {
      const [ordersRes, oppsRes, projectsRes, costsRes, changeOrdersRes, contractsRes, asOppsRes, partsRes] = await Promise.all([
        supabase.from('orders').select('*').eq('company_id', selectedCompanyId),
        supabase.from('opportunities').select('*').eq('company_id', selectedCompanyId),
        supabase.from('projects').select('*').eq('company_id', selectedCompanyId),
        supabase.from('project_costs').select('*'),
        supabase.from('change_orders').select('*'),
        supabase.from('service_contracts').select('*').eq('company_id', selectedCompanyId),
        supabase.from('after_sales_opportunities').select('*').eq('company_id', selectedCompanyId),
        supabase.from('spare_parts').select('*').eq('company_id', selectedCompanyId),
      ]);

      const projectIds = (projectsRes.data || []).map(p => p.id);
      const filteredCosts = (costsRes.data || []).filter(c => projectIds.includes(c.project_id));
      const filteredCOs = (changeOrdersRes.data || []).filter(c => projectIds.includes(c.project_id));

      setSalesData({ orders: ordersRes.data || [], opportunities: oppsRes.data || [] });
      setProjectsData({ projects: projectsRes.data || [], costs: filteredCosts, changeOrders: filteredCOs });
      setAfterSalesData({ contracts: contractsRes.data || [], opportunities: asOppsRes.data || [], parts: partsRes.data || [] });
    } finally {
      setLoading(false);
    }
  };

  const gaps = useMemo<GapItem[]>(() => {
    const items: GapItem[] = [];

    // === SALES GAPS ===
    const totalPipeline = salesData.opportunities.reduce((s, o) => s + (o.est_revenue || 0), 0);
    const weightedPipeline = salesData.opportunities.reduce((s, o) => s + (o.est_revenue || 0) * ((o.contract_prob || 0) / 100), 0);
    const pipelineGap = totalPipeline - weightedPipeline;
    if (pipelineGap > 0) {
      items.push({
        id: 'sales-pipeline-risk', module: 'sales', type: 'Pipeline Risk',
        severity: pipelineGap > totalPipeline * 0.5 ? 'critical' : 'warning',
        title: 'Pipeline Weighted Gap',
        detail: `Unweighted pipeline: €${(totalPipeline / 1000).toFixed(0)}K vs weighted: €${(weightedPipeline / 1000).toFixed(0)}K`,
        impact: pipelineGap, action: 'Focus on high-probability opportunities to close the weighted gap',
        metric: `€${(pipelineGap / 1000).toFixed(0)}K at risk`
      });
    }

    const lowProbOpps = salesData.opportunities.filter(o => (o.contract_prob || 0) < 30 && (o.est_revenue || 0) > 50000);
    if (lowProbOpps.length > 0) {
      const totalAtRisk = lowProbOpps.reduce((s, o) => s + (o.est_revenue || 0), 0);
      items.push({
        id: 'sales-low-prob', module: 'sales', type: 'Low Conversion',
        severity: 'warning',
        title: `${lowProbOpps.length} High-Value / Low-Probability Deals`,
        detail: `Deals >€50K with <30% probability need attention`,
        impact: totalAtRisk, action: 'Review qualification criteria and assign senior KAMs',
        metric: `€${(totalAtRisk / 1000).toFixed(0)}K uncertain`
      });
    }

    const lowMarginOrders = salesData.orders.filter(o => (o.margin || 0) > 0 && (o.margin || 0) < 15);
    if (lowMarginOrders.length > 0) {
      items.push({
        id: 'sales-margin', module: 'sales', type: 'Margin Erosion',
        severity: lowMarginOrders.length > 3 ? 'critical' : 'warning',
        title: `${lowMarginOrders.length} Orders Below 15% Margin`,
        detail: `Orders with thin margins eroding profitability`,
        impact: lowMarginOrders.reduce((s, o) => s + (o.selling_price || 0), 0),
        action: 'Audit pricing strategy and negotiate better terms on renewals',
        metric: `Avg ${(lowMarginOrders.reduce((s, o) => s + (o.margin || 0), 0) / lowMarginOrders.length).toFixed(1)}% margin`
      });
    }

    // === PROJECT GAPS ===
    projectsData.projects.forEach(project => {
      const costs = projectsData.costs.filter(c => c.project_id === project.id);
      const totalBudget = costs.reduce((s, c) => s + (c.budget_amount || 0), 0) || (project.total_budget || 0);
      const totalActual = costs.reduce((s, c) => s + (c.actual_amount || 0), 0) || (project.total_actual_cost || 0);

      if (totalBudget > 0 && totalActual > totalBudget * 1.05) {
        const overrun = totalActual - totalBudget;
        const overrunPct = ((overrun / totalBudget) * 100).toFixed(1);
        items.push({
          id: `proj-overrun-${project.id}`, module: 'projects', type: 'Cost Overrun',
          severity: totalActual > totalBudget * 1.1 ? 'critical' : 'warning',
          title: `${project.title || project.project_number}: Budget Overrun`,
          detail: `Actual €${(totalActual / 1000).toFixed(0)}K vs Budget €${(totalBudget / 1000).toFixed(0)}K (+${overrunPct}%)`,
          impact: overrun, action: 'Freeze non-critical spending and audit cost drivers',
          metric: `+${overrunPct}% over budget`
        });
      }

      if ((project.margin_target || 0) > 0 && (project.margin_actual || 0) < (project.margin_target || 0) * 0.9) {
        items.push({
          id: `proj-margin-${project.id}`, module: 'projects', type: 'Margin Deviation',
          severity: 'warning',
          title: `${project.title || project.project_number}: Margin Below Target`,
          detail: `Actual ${project.margin_actual}% vs Target ${project.margin_target}%`,
          impact: (project.contract_value || 0) * ((project.margin_target - project.margin_actual) / 100),
          action: 'Review change orders and negotiate scope adjustments',
          metric: `${((project.margin_target || 0) - (project.margin_actual || 0)).toFixed(1)}pp gap`
        });
      }

      if ((project.health_score || 0) > 0 && (project.health_score || 0) < 60) {
        items.push({
          id: `proj-health-${project.id}`, module: 'projects', type: 'Health Alert',
          severity: (project.health_score || 0) < 40 ? 'critical' : 'warning',
          title: `${project.title || project.project_number}: Low Health Score`,
          detail: `Project health at ${project.health_score}/100`,
          impact: project.contract_value || 0, action: 'Conduct project review and escalate risks',
          metric: `Score: ${project.health_score}/100`
        });
      }
    });

    const pendingCOs = projectsData.changeOrders.filter(co => co.status === 'pending');
    if (pendingCOs.length > 0) {
      const totalCOImpact = pendingCOs.reduce((s, co) => s + Math.abs(co.cost_impact || 0), 0);
      items.push({
        id: 'proj-change-orders', module: 'projects', type: 'Pending Changes',
        severity: totalCOImpact > 50000 ? 'critical' : 'warning',
        title: `${pendingCOs.length} Pending Change Orders`,
        detail: `Unresolved scope changes with cumulative cost impact`,
        impact: totalCOImpact, action: 'Prioritize approval of high-impact change orders',
        metric: `€${(totalCOImpact / 1000).toFixed(0)}K pending`
      });
    }

    // === AFTER-SALES GAPS ===
    const uncapturedOpps = afterSalesData.opportunities.filter(o => o.status === 'identified');
    if (uncapturedOpps.length > 0) {
      const uncapturedValue = uncapturedOpps.reduce((s, o) => s + (o.estimated_value || 0), 0);
      items.push({
        id: 'as-uncaptured', module: 'after-sales', type: 'Uncaptured Revenue',
        severity: uncapturedValue > 100000 ? 'critical' : 'warning',
        title: `${uncapturedOpps.length} Uncaptured After-Sales Opportunities`,
        detail: `Identified but not yet acted upon`,
        impact: uncapturedValue, action: 'Assign KAMs and create follow-up tasks for top opportunities',
        metric: `€${(uncapturedValue / 1000).toFixed(0)}K potential`
      });
    }

    const expiringContracts = afterSalesData.contracts.filter(c => {
      if (!c.end_date) return false;
      const daysToExpiry = (new Date(c.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      return daysToExpiry > 0 && daysToExpiry < 90;
    });
    if (expiringContracts.length > 0) {
      const atRiskValue = expiringContracts.reduce((s, c) => s + (c.annual_value || 0), 0);
      items.push({
        id: 'as-expiring', module: 'after-sales', type: 'Contract Expiry',
        severity: 'warning',
        title: `${expiringContracts.length} Service Contracts Expiring in 90 Days`,
        detail: `Recurring revenue at risk if not renewed`,
        impact: atRiskValue, action: 'Initiate renewal conversations and prepare upgrade proposals',
        metric: `€${(atRiskValue / 1000).toFixed(0)}K/yr at risk`
      });
    }

    const lowStockCritical = afterSalesData.parts.filter(p => p.criticality === 'critical' && p.stock_quantity <= p.reorder_point);
    if (lowStockCritical.length > 0) {
      items.push({
        id: 'as-stock', module: 'after-sales', type: 'Stock Alert',
        severity: 'critical',
        title: `${lowStockCritical.length} Critical Parts Below Reorder Point`,
        detail: `Service delivery at risk due to stock shortages`,
        impact: lowStockCritical.reduce((s, p) => s + (p.selling_price || 0) * (p.reorder_quantity || 0), 0),
        action: 'Place emergency orders and review safety stock levels',
        metric: `${lowStockCritical.length} parts`
      });
    }

    return items.sort((a, b) => {
      const sev = { critical: 0, warning: 1, info: 2 };
      return (sev[a.severity] - sev[b.severity]) || (b.impact - a.impact);
    });
  }, [salesData, projectsData, afterSalesData]);

  const kpis = useMemo(() => {
    const criticalCount = gaps.filter(g => g.severity === 'critical').length;
    const warningCount = gaps.filter(g => g.severity === 'warning').length;
    const totalExposure = gaps.reduce((s, g) => s + g.impact, 0);
    const byModule = {
      sales: gaps.filter(g => g.module === 'sales').reduce((s, g) => s + g.impact, 0),
      projects: gaps.filter(g => g.module === 'projects').reduce((s, g) => s + g.impact, 0),
      afterSales: gaps.filter(g => g.module === 'after-sales').reduce((s, g) => s + g.impact, 0),
    };
    return { criticalCount, warningCount, totalExposure, byModule };
  }, [gaps]);

  const moduleChartData = useMemo(() => [
    { name: 'Sales', value: kpis.byModule.sales, fill: COLORS[0] },
    { name: 'Projects', value: kpis.byModule.projects, fill: COLORS[1] },
    { name: 'After-Sales', value: kpis.byModule.afterSales, fill: COLORS[2] },
  ].filter(d => d.value > 0), [kpis]);

  const severityIcon = (sev: string) => {
    if (sev === 'critical') return <XCircle className="h-4 w-4 text-destructive" />;
    if (sev === 'warning') return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    return <CheckCircle2 className="h-4 w-4 text-primary" />;
  };

  const moduleIcon = (mod: string) => {
    if (mod === 'sales') return <BarChart3 className="h-4 w-4" />;
    if (mod === 'projects') return <FolderKanban className="h-4 w-4" />;
    return <Wrench className="h-4 w-4" />;
  };

  if (!selectedCompanyId) {
    return (
      <div className="p-6">
        <Alert><AlertTriangle className="h-4 w-4" /><AlertTitle>No Company Selected</AlertTitle>
          <AlertDescription>Please select a company to view the Budget Command Center.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Budget Command Center</h1>
          <p className="text-muted-foreground">Unified financial gap analysis across all modules</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadAllData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-destructive/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              <span className="text-sm font-medium">Critical Gaps</span>
            </div>
            <p className="text-3xl font-bold mt-2 text-foreground">{kpis.criticalCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Require immediate action</p>
          </CardContent>
        </Card>
        <Card className="border-yellow-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-yellow-600">
              <AlertTriangle className="h-5 w-5" />
              <span className="text-sm font-medium">Warnings</span>
            </div>
            <p className="text-3xl font-bold mt-2 text-foreground">{kpis.warningCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Monitor closely</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-destructive">
              <DollarSign className="h-5 w-5" />
              <span className="text-sm font-medium">Total Exposure</span>
            </div>
            <p className="text-3xl font-bold mt-2 text-foreground">€{(kpis.totalExposure / 1000).toFixed(0)}K</p>
            <p className="text-xs text-muted-foreground mt-1">Cumulative financial risk</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-primary">
              <Target className="h-5 w-5" />
              <span className="text-sm font-medium">Action Items</span>
            </div>
            <p className="text-3xl font-bold mt-2 text-foreground">{gaps.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Across all modules</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Gaps ({gaps.length})</TabsTrigger>
          <TabsTrigger value="sales">Sales ({gaps.filter(g => g.module === 'sales').length})</TabsTrigger>
          <TabsTrigger value="projects">Projects ({gaps.filter(g => g.module === 'projects').length})</TabsTrigger>
          <TabsTrigger value="after-sales">After-Sales ({gaps.filter(g => g.module === 'after-sales').length})</TabsTrigger>
          <TabsTrigger value="chart">Analytics</TabsTrigger>
        </TabsList>

        {['all', 'sales', 'projects', 'after-sales'].map(tab => (
          <TabsContent key={tab} value={tab} className="space-y-3">
            {gaps.filter(g => tab === 'all' || g.module === tab).length === 0 ? (
              <Card><CardContent className="p-8 text-center text-muted-foreground">
                <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-primary" />
                <p className="font-medium">No gaps detected</p>
                <p className="text-sm">All metrics within acceptable thresholds</p>
              </CardContent></Card>
            ) : (
              <div className="space-y-3">
                {gaps.filter(g => tab === 'all' || g.module === tab).map(gap => (
                  <Card key={gap.id} className={`border-l-4 ${gap.severity === 'critical' ? 'border-l-destructive' : gap.severity === 'warning' ? 'border-l-yellow-500' : 'border-l-primary'}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {severityIcon(gap.severity)}
                            {moduleIcon(gap.module)}
                            <Badge variant={gap.severity === 'critical' ? 'destructive' : 'secondary'} className="text-xs">
                              {gap.type}
                            </Badge>
                            <Badge variant="outline" className="text-xs capitalize">{gap.module}</Badge>
                          </div>
                          <h3 className="font-semibold text-foreground">{gap.title}</h3>
                          <p className="text-sm text-muted-foreground mt-0.5">{gap.detail}</p>
                          <div className="flex items-center gap-2 mt-2 text-sm">
                            <Zap className="h-3.5 w-3.5 text-primary" />
                            <span className="text-primary font-medium">Action:</span>
                            <span className="text-muted-foreground">{gap.action}</span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          {gap.metric && (
                            <span className={`text-sm font-bold ${gap.severity === 'critical' ? 'text-destructive' : 'text-yellow-600'}`}>
                              {gap.metric}
                            </span>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            Impact: €{(gap.impact / 1000).toFixed(0)}K
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}

        <TabsContent value="chart" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-lg">Exposure by Module</CardTitle></CardHeader>
              <CardContent>
                {moduleChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={moduleChartData} cx="50%" cy="50%" outerRadius={100} dataKey="value"
                        label={({ name, value }) => `${name}: €${(value / 1000).toFixed(0)}K`}>
                        {moduleChartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => `€${(v / 1000).toFixed(0)}K`} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <p className="text-center text-muted-foreground py-12">No exposure data</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-lg">Gap Severity Distribution</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={[
                    { name: 'Critical', count: kpis.criticalCount, fill: 'hsl(var(--destructive))' },
                    { name: 'Warning', count: kpis.warningCount, fill: 'hsl(45, 90%, 50%)' },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
                      {[0, 1].map(i => <Cell key={i} fill={i === 0 ? 'hsl(var(--destructive))' : 'hsl(45, 90%, 50%)'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Summary Table */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Module Health Summary</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Module</TableHead>
                    <TableHead>Critical</TableHead>
                    <TableHead>Warnings</TableHead>
                    <TableHead>Total Exposure</TableHead>
                    <TableHead>Top Priority</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(['sales', 'projects', 'after-sales'] as const).map(mod => {
                    const modGaps = gaps.filter(g => g.module === mod);
                    const topGap = modGaps[0];
                    return (
                      <TableRow key={mod}>
                        <TableCell className="font-medium capitalize flex items-center gap-2">
                          {moduleIcon(mod)} {mod === 'after-sales' ? 'After-Sales' : mod.charAt(0).toUpperCase() + mod.slice(1)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={modGaps.filter(g => g.severity === 'critical').length > 0 ? 'destructive' : 'secondary'}>
                            {modGaps.filter(g => g.severity === 'critical').length}
                          </Badge>
                        </TableCell>
                        <TableCell>{modGaps.filter(g => g.severity === 'warning').length}</TableCell>
                        <TableCell className="font-medium">€{(modGaps.reduce((s, g) => s + g.impact, 0) / 1000).toFixed(0)}K</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{topGap?.title || 'No gaps'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
