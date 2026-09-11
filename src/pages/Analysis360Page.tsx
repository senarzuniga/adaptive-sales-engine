import { useLanguage } from '@/i18n/LanguageContext';
import { useData } from '@/store/DataStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { Upload, AlertTriangle, TrendingUp, Users, DollarSign, Target, BarChart3, Shield, Layers, Eye, CheckCircle2, Clock, AlertCircle, Activity, BriefcaseBusiness, FileText, Radar } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState, useMemo } from 'react';
import { groupBy, fmt, COLORS } from '@/components/analysis360/AnalysisUtils';
import { FiveYearResults } from '@/components/analysis360/FiveYearResults';
import { PortfolioRisk } from '@/components/analysis360/PortfolioRisk';
import { KeyAccountMapping } from '@/components/analysis360/KeyAccountMapping';
import { ProductPortfolioAnalysis } from '@/components/analysis360/ProductPortfolioAnalysis';
import { BrandingVsStrategy } from '@/components/analysis360/BrandingVsStrategy';
import { ExecutiveInsights } from '@/components/analysis360/ExecutiveInsights';
import { CommercialIntelligencePanel } from '@/components/analysis360/CommercialIntelligencePanel';
import { buildPipelineMetrics, getProbabilityGuidance, isNeglectedStatus, isOpenOpportunityStatus, normalizeOpportunityStatus } from '@/lib/salesData';
import { readWorkspaceRows, isWorkspaceSupabaseConfigured } from '@/lib/workspaceStorage';
import { supabase } from '@/integrations/supabase/client';

interface WorkspaceOfferRecord extends Record<string, any> {
  offer_number?: string;
  status?: string;
  contract_value?: number;
  probability?: number;
  global_score?: number;
  score?: number;
  customer_name?: string;
  title?: string;
  next_action?: string;
  context?: string;
  document_paths?: string[];
  project_folder?: string;
  submitted_at?: string;
  decision_date?: string;
  updated_at?: string;
  site?: string;
  country?: string;
  region?: string;
  kam?: string;
}

interface WorkspaceProjectRecord extends Record<string, any> {
  project_number?: string;
  title?: string;
  customer_name?: string;
  status?: string;
  contract_value?: number;
  health_score?: number;
  planned_end?: string;
  updated_at?: string;
}

interface WorkspaceReportRecord extends Record<string, any> {
  report_type?: string;
  executive_summary?: string;
  created_at?: string;
  updated_at?: string;
  target_company_name?: string;
  recommendations?: string[];
}

interface WorkspaceSnapshot {
  offers: WorkspaceOfferRecord[];
  projects: WorkspaceProjectRecord[];
  reports: WorkspaceReportRecord[];
}

const isIsoDate = (value: string | undefined | null) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));

const getQuarterFromIsoDate = (value: string) => {
  if (!isIsoDate(value)) return 'TBD';
  const month = Number(value.slice(5, 7));
  return `Q${Math.max(1, Math.min(4, Math.ceil(month / 3)))}`;
};

const getMonthFromIsoDate = (value: string) => {
  if (!isIsoDate(value)) return '';
  return new Date(`${value}T00:00:00`).toLocaleString('en-US', { month: 'long' });
};

const extractYear = (value: string | undefined | null) => {
  const textValue = String(value || '');
  if (isIsoDate(textValue)) return textValue.slice(0, 4);
  const match = textValue.match(/\b(20\d{2})\b/);
  return match ? match[1] : '';
};

const normalizeOfferStatus = (value: unknown) => {
  const status = String(value || '').trim().toLowerCase();
  if (['won', 'sold', 'accepted', 'approved', 'closed', 'converted', 'signed'].includes(status)) return 'won';
  if (['lost', 'cancelled', 'canceled', 'declined', 'postponed', 'paused', 'dead', 'stalled'].includes(status)) return 'lost';
  return 'follow_up';
};

const isActiveProjectStatus = (value: unknown) => !['completed', 'done', 'cancelled', 'canceled', 'archived', 'closed'].includes(String(value || '').trim().toLowerCase());

const mergeUniqueRows = <T extends Record<string, any>>(rows: T[], identity: (row: T) => string): T[] => {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = identity(row);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const loadBundledWorkspaceSnapshot = async (companyName: string): Promise<WorkspaceSnapshot> => {
  if (!companyName.toLowerCase().includes('ingecart')) {
    return { offers: [], projects: [], reports: [] };
  }

  try {
    const response = await fetch('/company-packs/Ingecart/ingecart_pack.json');
    if (!response.ok) return { offers: [], projects: [], reports: [] };
    const pack = await response.json();
    const workspace = pack?.workspace || {};
    return {
      offers: Array.isArray(workspace.offers) ? workspace.offers : [],
      projects: Array.isArray(workspace.projects) ? workspace.projects : [],
      reports: Array.isArray(workspace.business_intelligence_reports) ? workspace.business_intelligence_reports : [],
    };
  } catch {
    return { offers: [], projects: [], reports: [] };
  }
};

const summarizeReport = (report: WorkspaceReportRecord) => {
  const raw = String(report.executive_summary || report.market_analysis?.summary || report.report_type || '').replace(/\s+/g, ' ').trim();
  return raw.length > 180 ? `${raw.slice(0, 177)}...` : raw;
};

const Analysis360Page = () => {
  const { t } = useLanguage();
  const { data, activeCompanyId } = useData();
  const navigate = useNavigate();
  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [workspaceSnapshot, setWorkspaceSnapshot] = useState<WorkspaceSnapshot>({ offers: [], projects: [], reports: [] });

  const rawOrders = data.orders;
  const strategy = data.strategy;
  const opportunities = data.opportunities;
  const products = data.products;
  const company = data.companyProfile;
  const tasks = data.tasks;
  const leads = data.leads;

  useEffect(() => {
    let isMounted = true;

    const loadWorkspaceSnapshot = async () => {
      const localOffers = activeCompanyId ? readWorkspaceRows<WorkspaceOfferRecord>('offers', activeCompanyId) : [];
      const localProjects = activeCompanyId ? readWorkspaceRows<WorkspaceProjectRecord>('projects', activeCompanyId) : [];
      const localReports = activeCompanyId ? readWorkspaceRows<WorkspaceReportRecord>('business_intelligence_reports', activeCompanyId) : [];
      const bundled = await loadBundledWorkspaceSnapshot(String(company.company_name || ''));

      if (!activeCompanyId || !isWorkspaceSupabaseConfigured) {
        if (isMounted) {
          setWorkspaceSnapshot({
            offers: mergeUniqueRows([...localOffers, ...bundled.offers], (row) => String(row.id || row.offer_number || `${row.customer_name}|${row.title}`)),
            projects: mergeUniqueRows([...localProjects, ...bundled.projects], (row) => String(row.id || row.project_number || `${row.customer_name}|${row.title}`)),
            reports: mergeUniqueRows([...localReports, ...bundled.reports], (row) => String(row.id || `${row.report_type}|${row.created_at}|${row.target_company_name}`)),
          });
        }
        return;
      }

      try {
        const [offersRes, projectsRes, reportsRes] = await Promise.all([
          supabase.from('offers').select('*').eq('company_id', activeCompanyId).order('updated_at', { ascending: false }).limit(250),
          supabase.from('projects').select('*').eq('company_id', activeCompanyId).order('updated_at', { ascending: false }).limit(120),
          supabase.from('business_intelligence_reports').select('*').eq('company_id', activeCompanyId).order('updated_at', { ascending: false }).limit(120),
        ]);

        if (!isMounted) return;

        setWorkspaceSnapshot({
          offers: mergeUniqueRows([...(offersRes.data || []), ...localOffers, ...bundled.offers], (row) => String(row.id || row.offer_number || `${row.customer_name}|${row.title}`)),
          projects: mergeUniqueRows([...(projectsRes.data || []), ...localProjects, ...bundled.projects], (row) => String(row.id || row.project_number || `${row.customer_name}|${row.title}`)),
          reports: mergeUniqueRows([...(reportsRes.data || []), ...localReports, ...bundled.reports], (row) => String(row.id || `${row.report_type}|${row.created_at}|${row.target_company_name}`)),
        });
      } catch {
        if (!isMounted) return;
        setWorkspaceSnapshot({
          offers: mergeUniqueRows([...localOffers, ...bundled.offers], (row) => String(row.id || row.offer_number || `${row.customer_name}|${row.title}`)),
          projects: mergeUniqueRows([...localProjects, ...bundled.projects], (row) => String(row.id || row.project_number || `${row.customer_name}|${row.title}`)),
          reports: mergeUniqueRows([...localReports, ...bundled.reports], (row) => String(row.id || `${row.report_type}|${row.created_at}|${row.target_company_name}`)),
        });
      }
    };

    loadWorkspaceSnapshot();
    return () => {
      isMounted = false;
    };
  }, [activeCompanyId, company.company_name]);

  const soldOfferIndex = useMemo(() => {
    const map = new Map<string, WorkspaceOfferRecord>();
    workspaceSnapshot.offers
      .filter((offer) => normalizeOfferStatus(offer.status) === 'won')
      .forEach((offer) => {
        const key = String(offer.offer_number || '').trim();
        if (key) map.set(key, offer);
      });
    return map;
  }, [workspaceSnapshot.offers]);

  const useOpportunitiesFallback = rawOrders.length === 0 && opportunities.length > 0;
  const orders = useMemo(() => {
    if (useOpportunitiesFallback) {
      return opportunities.map((opportunity) => ({
        id: undefined,
        poDate: '',
        firstOfferDate: '',
        oppNumber: opportunity.oppNumber,
        region: opportunity.region,
        country: opportunity.country,
        customerName: opportunity.customerName,
        scope: opportunity.scope,
        productFamily: opportunity.productFamily,
        segment: opportunity.segment,
        purchasingYear: extractYear(opportunity.estPurchasingYear) || String(new Date().getFullYear()),
        purchasingQuarter: opportunity.estPurchasingQuarter,
        purchasingMonth: '',
        sellingPrice: opportunity.estRevenue,
        margin: opportunity.margin,
        kam: opportunity.kam,
      }));
    }

    return rawOrders.map((order) => {
      const linkedOffer = soldOfferIndex.get(String(order.oppNumber || '').trim());
      const effectiveDate = isIsoDate(order.poDate)
        ? order.poDate
        : isIsoDate(order.firstOfferDate)
          ? order.firstOfferDate
          : isIsoDate(String(linkedOffer?.submitted_at || ''))
            ? String(linkedOffer?.submitted_at)
            : '';
      const purchasingYear = /^\d{4}$/.test(String(order.purchasingYear || ''))
        ? String(order.purchasingYear)
        : (extractYear(effectiveDate) || extractYear(order.firstOfferDate) || extractYear(String(linkedOffer?.submitted_at || '')));

      return {
        ...order,
        poDate: isIsoDate(order.poDate) ? order.poDate : effectiveDate,
        purchasingYear,
        purchasingQuarter: order.purchasingQuarter && order.purchasingQuarter !== 'TBD' ? order.purchasingQuarter : getQuarterFromIsoDate(effectiveDate),
        purchasingMonth: order.purchasingMonth || getMonthFromIsoDate(effectiveDate),
      };
    });
  }, [opportunities, rawOrders, soldOfferIndex, useOpportunitiesFallback]);

  const derivedOffers = useMemo<WorkspaceOfferRecord[]>(() => {
    const fromOrders = orders.map((order) => ({
      offer_number: order.oppNumber,
      title: `${order.customerName} - ${order.productFamily}`,
      customer_name: order.customerName,
      company_name: company.company_name,
      project_description: order.scope,
      contract_value: order.sellingPrice,
      currency: 'EUR',
      probability: 100,
      score: 78,
      global_score: 78,
      status: 'won',
      region: order.region,
      country: order.country,
      site: '',
      kam: order.kam,
      submitted_at: order.firstOfferDate,
      decision_date: order.poDate,
      updated_at: order.firstOfferDate ? `${order.firstOfferDate}T09:00:00` : '',
      next_action: 'Move the sold offer into project execution governance.',
      context: 'Derived from confirmed sales data because no explicit offer workspace rows were available.',
      document_paths: [],
      project_folder: '',
      source: 'orders',
    }));

    const fromOpportunities = opportunities.map((opportunity) => ({
      offer_number: opportunity.oppNumber,
      title: `${opportunity.customerName} - ${opportunity.productFamily}`,
      customer_name: opportunity.customerName,
      company_name: company.company_name,
      project_description: opportunity.scope,
      contract_value: opportunity.estRevenue,
      currency: 'EUR',
      probability: opportunity.contractProb,
      score: opportunity.contractProb,
      global_score: opportunity.contractProb,
      status: normalizeOpportunityStatus(opportunity.status) === 'won' ? 'won' : 'follow_up',
      region: opportunity.region,
      country: opportunity.country,
      site: '',
      kam: opportunity.kam,
      submitted_at: '',
      decision_date: '',
      updated_at: '',
      next_action: 'Protect the next commercial step and update the opportunity truth state.',
      context: 'Derived from the opportunity register because no explicit offer workspace rows were available.',
      document_paths: [],
      project_folder: '',
      source: 'opportunities',
    }));

    return mergeUniqueRows([...fromOrders, ...fromOpportunities], (row) => String(row.offer_number || `${row.customer_name}|${row.title}`));
  }, [company.company_name, opportunities, orders]);

  const offerRows = useMemo(() => (workspaceSnapshot.offers.length > 0 ? workspaceSnapshot.offers : derivedOffers), [derivedOffers, workspaceSnapshot.offers]);
  const openOffers = useMemo(() => offerRows.filter((offer) => normalizeOfferStatus(offer.status) === 'follow_up'), [offerRows]);
  const soldOffers = useMemo(() => offerRows.filter((offer) => normalizeOfferStatus(offer.status) === 'won'), [offerRows]);
  const activeProjects = useMemo(() => workspaceSnapshot.projects.filter((project) => isActiveProjectStatus(project.status)), [workspaceSnapshot.projects]);
  const sortedProjects = useMemo(() => [...workspaceSnapshot.projects].sort((left, right) => Number(right.contract_value || 0) - Number(left.contract_value || 0)), [workspaceSnapshot.projects]);
  const topOpenOffers = useMemo(() => [...openOffers].sort((left, right) => Number(right.contract_value || right.global_score || right.score || 0) - Number(left.contract_value || left.global_score || left.score || 0)).slice(0, 10), [openOffers]);
  const topReports = useMemo(() => [...workspaceSnapshot.reports].sort((left, right) => String(right.updated_at || right.created_at || '').localeCompare(String(left.updated_at || left.created_at || ''))).slice(0, 5), [workspaceSnapshot.reports]);

  const years = useMemo(() => [...new Set(orders.map((order) => order.purchasingYear).filter((year) => /^\d{4}$/.test(String(year))))].sort(), [orders]);

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

    const pipelineMetrics = buildPipelineMetrics({ opportunities, orders: rawOrders });
    const sold = pipelineMetrics.soldRevenue;
    const openWeighted = pipelineMetrics.weightedOpenRevenue;
    const weighted = pipelineMetrics.weightedPipeline;

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

  const situationMetrics = useMemo(() => {
    const openValue = openOffers.reduce((sum, offer) => sum + Number(offer.contract_value || 0), 0);
    const soldValue = soldOffers.reduce((sum, offer) => sum + Number(offer.contract_value || 0), 0);
    const openWithDocs = openOffers.filter((offer) => Array.isArray(offer.document_paths) && offer.document_paths.length > 0).length;
    const soldWithDocs = soldOffers.filter((offer) => Array.isArray(offer.document_paths) && offer.document_paths.length > 0).length;
    const soldCoveredByProjects = soldOffers.filter((offer) => String(offer.project_folder || '').trim()).length;
    const weakOpenOffers = openOffers.filter((offer) => getProbabilityGuidance(Number(offer.probability || 0)).band === 'weak');
    const intelligenceThemes = topReports.map((report) => ({
      title: String(report.target_company_name || report.report_type || 'Market report'),
      type: String(report.report_type || 'knowledge').replace(/_/g, ' '),
      summary: summarizeReport(report),
    }));

    const strengths: string[] = [];
    const watchouts: string[] = [];
    const focusAreas: string[] = [];

    if (soldOffers.length > 0) {
      strengths.push(`${soldOffers.length} sold offers are visible with ${fmt(soldValue)} of commercial value traced in the 360 workspace.`);
    }
    if (workspaceSnapshot.reports.length > 0) {
      strengths.push(`${workspaceSnapshot.reports.length} validated intelligence reports are available to enrich strategic interpretation.`);
    }
    if (activeProjects.length > 0) {
      strengths.push(`${activeProjects.length} active projects give execution context beyond pipeline-only reporting.`);
    }

    if (openOffers.length > 0 && openWithDocs < openOffers.length * 0.6) {
      watchouts.push(`Only ${openWithDocs}/${openOffers.length} open offers currently carry linked evidence documents. Document coverage should be increased.`);
    }
    if (soldOffers.length > 0 && soldCoveredByProjects < soldOffers.length) {
      watchouts.push(`${soldOffers.length - soldCoveredByProjects} sold offers still need a clearer project execution anchor in the 360 view.`);
    }
    if (weakOpenOffers.length > 0) {
      watchouts.push(`${weakOpenOffers.length} live offers sit below the 75% confidence threshold and need stronger next-step control.`);
    }
    if (workspaceSnapshot.reports.length === 0) {
      watchouts.push('No market intelligence reports are currently available in the 360 workspace fallback.');
    }

    if (topOpenOffers.length > 0) {
      const highestOpen = topOpenOffers[0];
      focusAreas.push(`Protect ${highestOpen.customer_name || highestOpen.title} as the top live commercial priority.`);
    }
    if (activeProjects.length > 0) {
      focusAreas.push('Use active project execution signals to open lifecycle and after-sales opportunities in key accounts.');
    }
    if (products.length > 0) {
      focusAreas.push('Compare sold product families against the active pipeline to identify white-space cross-sell gaps.');
    }

    return {
      openValue,
      soldValue,
      openWithDocs,
      soldWithDocs,
      soldCoveredByProjects,
      weakOpenOffers,
      intelligenceThemes,
      strengths,
      watchouts,
      focusAreas,
      docCoveragePct: openOffers.length > 0 ? (openWithDocs / openOffers.length) * 100 : 100,
      projectCoveragePct: soldOffers.length > 0 ? (soldCoveredByProjects / soldOffers.length) * 100 : 100,
    };
  }, [activeProjects.length, openOffers, products.length, soldOffers, topOpenOffers, topReports, workspaceSnapshot.reports.length]);

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

    // Pipeline quality risk — offers below 75% are considered weak and need actions
    const weakDeals = opportunities.filter(o => isOpenOpportunityStatus(o.status) && getProbabilityGuidance(o.contractProb).band === 'weak');
    if (weakDeals.length > 0) {
      const weakOpenCount = opportunities.filter(o => isOpenOpportunityStatus(o.status)).length || 1;
      risks.push({
        level: weakDeals.length > weakOpenCount * 0.5 ? 'warning' : 'info',
        title: 'Weak Pipeline Coverage',
        description: `${weakDeals.length} open opportunities are below 75% success probability and need actions to improve the chance of winning. Deals above 75% should focus on confidence, relationship strength, and disciplined follow-up.`,
      });
    }

    // Neglected opportunities
    const neglected = opportunities.filter(o => isNeglectedStatus(o.status));
    if (neglected.length > 0) {
      const neglectedValue = neglected.reduce((s, o) => s + o.estRevenue, 0);
      risks.push({
        level: 'warning',
        title: `${neglected.length} Neglected Opportunities`,
        description: `${fmt(neglectedValue)} in pipeline marked as neglected or unattended. Review and either reactivate or close these deals.`,
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

    if (situationMetrics.docCoveragePct < 60) {
      risks.push({
        level: 'warning',
        title: 'Offer Document Coverage Gap',
        description: `Only ${situationMetrics.docCoveragePct.toFixed(0)}% of live offers have linked documentation in the 360 workspace.`,
      });
    }

    return risks;
  }, [strategyTarget, strategyAchievement, weightedPipeline, opportunities, taskStats, situationMetrics.docCoveragePct]);

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

  const hasAnyAnalysisData = orders.length > 0 || opportunities.length > 0 || strategy.length > 0 || products.length > 0 || offerRows.length > 0 || workspaceSnapshot.projects.length > 0 || workspaceSnapshot.reports.length > 0;

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
          <p className="text-xs text-muted-foreground mt-1">Confirmed sold: {fmt(soldRevenue)} + weighted open offers</p>
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

      <Tabs defaultValue="situation" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="situation" className="gap-1 text-xs"><Radar className="h-3 w-3" /> Situation</TabsTrigger>
          <TabsTrigger value="5year" className="gap-1 text-xs"><BarChart3 className="h-3 w-3" /> 5-Year Results</TabsTrigger>
          <TabsTrigger value="portfolio-risk" className="gap-1 text-xs"><Shield className="h-3 w-3" /> Portfolio Risk</TabsTrigger>
          <TabsTrigger value="kam" className="gap-1 text-xs"><Users className="h-3 w-3" /> Key Account Mapping</TabsTrigger>
          <TabsTrigger value="product-analysis" className="gap-1 text-xs"><Layers className="h-3 w-3" /> Product Portfolio</TabsTrigger>
          <TabsTrigger value="branding" className="gap-1 text-xs"><Eye className="h-3 w-3" /> Branding vs Strategy</TabsTrigger>
          <TabsTrigger value="intelligence" className="gap-1 text-xs"><Activity className="h-3 w-3" /> Commercial Intelligence</TabsTrigger>
        </TabsList>

        <TabsContent value="situation">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-2 mb-1"><BriefcaseBusiness className="h-4 w-4 text-primary" /><span className="text-xs text-muted-foreground">Live offers</span></div>
                  <p className="text-2xl font-bold text-foreground">{openOffers.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">{fmt(situationMetrics.openValue)} tracked pipeline value</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-2 mb-1"><DollarSign className="h-4 w-4 text-primary" /><span className="text-xs text-muted-foreground">Sold offers</span></div>
                  <p className="text-2xl font-bold text-foreground">{soldOffers.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">{fmt(situationMetrics.soldValue)} visible closed value</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-2 mb-1"><Activity className="h-4 w-4 text-primary" /><span className="text-xs text-muted-foreground">Active projects</span></div>
                  <p className="text-2xl font-bold text-foreground">{activeProjects.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">{workspaceSnapshot.projects.length} projects loaded in execution context</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-2 mb-1"><FileText className="h-4 w-4 text-primary" /><span className="text-xs text-muted-foreground">Market intelligence</span></div>
                  <p className="text-2xl font-bold text-foreground">{workspaceSnapshot.reports.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">{leads.length} leads/prospects connected to analysis context</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <Card className="xl:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">360 Situation Diagnosis</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    This diagnosis combines company context, open offers, sold business, project execution visibility, and validated intelligence sources.
                    Current margin reference for the selected period is <span className="font-medium text-foreground">{avgMarginPct.toFixed(1)}%</span>, current-year booked revenue is <span className="font-medium text-foreground">{fmt(currentYearRevenue)}</span>, and the analysis window spans <span className="font-medium text-foreground">{Math.max(yearCount, years.length || 1)}</span> year reference points.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">Offer docs coverage {situationMetrics.docCoveragePct.toFixed(0)}%</Badge>
                    <Badge variant="outline">Sold-to-project coverage {situationMetrics.projectCoveragePct.toFixed(0)}%</Badge>
                    <Badge variant="outline">Weak live offers {situationMetrics.weakOpenOffers.length}</Badge>
                    <Badge variant="outline">Products loaded {products.length}</Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Strengths detected</p>
                      {situationMetrics.strengths.length > 0 ? situationMetrics.strengths.map((item) => (
                        <div key={item} className="rounded-lg border bg-primary/5 p-3 text-sm text-foreground">{item}</div>
                      )) : <p className="text-sm text-muted-foreground">No strengths could be inferred yet from the loaded data.</p>}
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Watchouts</p>
                      {situationMetrics.watchouts.length > 0 ? situationMetrics.watchouts.map((item) => (
                        <div key={item} className="rounded-lg border bg-warning/10 p-3 text-sm text-foreground">{item}</div>
                      )) : <p className="text-sm text-muted-foreground">No immediate watchouts detected from the current workspace snapshot.</p>}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Recommended focus</p>
                    <div className="space-y-2">
                      {situationMetrics.focusAreas.map((item) => (
                        <div key={item} className="rounded-lg border p-3 text-sm text-foreground">{item}</div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Intelligence context</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {situationMetrics.intelligenceThemes.length > 0 ? situationMetrics.intelligenceThemes.map((theme) => (
                    <div key={`${theme.title}-${theme.type}`} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-sm font-medium text-foreground">{theme.title}</p>
                        <Badge variant="outline" className="text-[10px] capitalize">{theme.type}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{theme.summary || 'Summary not available.'}</p>
                    </div>
                  )) : (
                    <p className="text-sm text-muted-foreground">No validated intelligence summaries are available yet for this company.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Priority live offer watchlist</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs text-muted-foreground">
                          <th className="py-2 pr-3">Offer</th>
                          <th className="py-2 pr-3">Customer</th>
                          <th className="py-2 pr-3 text-right">Value</th>
                          <th className="py-2 pr-3 text-right">Prob.</th>
                          <th className="py-2 pr-3 text-right">Docs</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topOpenOffers.map((offer) => (
                          <tr key={`${offer.offer_number}-${offer.customer_name}-${offer.title}`} className="border-b align-top last:border-0">
                            <td className="py-3 pr-3">
                              <p className="font-medium text-foreground">{offer.offer_number || 'N/A'}</p>
                              <p className="text-xs text-muted-foreground mt-1">{offer.title || offer.project_description || 'Untitled offer'}</p>
                            </td>
                            <td className="py-3 pr-3">
                              <p className="text-foreground">{offer.customer_name || 'Unknown customer'}</p>
                              <p className="text-xs text-muted-foreground mt-1">{offer.site || offer.country || offer.region || 'Location pending'}</p>
                            </td>
                            <td className="py-3 pr-3 text-right tabular-nums">{Number(offer.contract_value || 0) > 0 ? fmt(Number(offer.contract_value || 0)) : '?'}</td>
                            <td className="py-3 pr-3 text-right tabular-nums">{Number(offer.probability || 0).toFixed(0)}%</td>
                            <td className="py-3 pr-3 text-right tabular-nums">{Array.isArray(offer.document_paths) ? offer.document_paths.length : 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Project execution visibility</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {sortedProjects.slice(0, 8).map((project) => (
                      <div key={String(project.id || project.project_number || project.title)} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="font-medium text-sm text-foreground">{project.project_number || 'Project'} - {project.title || 'Untitled project'}</p>
                            <p className="text-xs text-muted-foreground mt-1">{project.customer_name || 'Unknown customer'} - status {String(project.status || 'unknown').replace(/_/g, ' ')}</p>
                          </div>
                          <Badge variant={Number(project.health_score || 0) >= 80 ? 'default' : Number(project.health_score || 0) >= 60 ? 'secondary' : 'destructive'}>
                            {Number(project.health_score || 0) > 0 ? `Health ${project.health_score}` : 'No score'}
                          </Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span>Value: {Number(project.contract_value || 0) > 0 ? fmt(Number(project.contract_value || 0)) : '?'}</span>
                          <span>Planned end: {String(project.planned_end || 'n/a')}</span>
                          <span>Updated: {String(project.updated_at || 'n/a')}</span>
                        </div>
                      </div>
                    ))}
                    {sortedProjects.length === 0 && <p className="text-sm text-muted-foreground">No project execution rows are currently loaded for this company.</p>}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

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

        <TabsContent value="intelligence">
          <CommercialIntelligencePanel
            company={company}
            orders={filtered}
            opportunities={opportunities}
            products={products}
            strategy={strategy}
            leads={leads}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Analysis360Page;
