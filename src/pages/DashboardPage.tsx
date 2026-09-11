import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useLanguage } from '@/i18n/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { buildPipelineMetrics, getProbabilityGuidance, isOpenOpportunityStatus, normalizeOpportunityStatus, parseFlexibleNumber } from '@/lib/salesData';
import { isWorkspaceSupabaseConfigured, readWorkspaceRows } from '@/lib/workspaceStorage';
import { useData } from '@/store/DataStore';
import { Activity, AlertTriangle, ArrowRight, BarChart3, Bot, Brain, Building2, Calculator, CircleDollarSign, ClipboardList, FileText, FolderKanban, Layers, SearchCheck, ShieldAlert, Target, Upload, Users, Wrench } from 'lucide-react';

type Row = Record<string, any>;
interface WorkspaceSnapshot {
  offers: Row[];
  projects: Row[];
  milestones: Row[];
  risks: Row[];
  costs: Row[];
  afterSalesOpportunities: Row[];
  serviceContracts: Row[];
}

const EMPTY_SNAPSHOT: WorkspaceSnapshot = { offers: [], projects: [], milestones: [], risks: [], costs: [], afterSalesOpportunities: [], serviceContracts: [] };
const isIsoDate = (value: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
const asNumber = (value: unknown) => parseFlexibleNumber(value);
const now = new Date();
const currentYear = String(now.getFullYear());
const currentQuarter = `Q${Math.ceil((now.getMonth() + 1) / 3)}`;
const compactEuro = (value: number) => !Number.isFinite(value) || value <= 0 ? '€0' : value >= 1_000_000 ? `€${(value / 1_000_000).toFixed(1)}M` : value >= 1_000 ? `€${(value / 1_000).toFixed(0)}K` : `€${Math.round(value)}`;
const mergeUniqueRows = <T extends Row,>(rows: T[], identity: (row: T) => string) => {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = identity(row);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
const normalizeOfferBucket = (value: unknown) => {
  const status = String(value || '').trim().toLowerCase();
  if (['won', 'sold', 'accepted', 'approved', 'closed', 'converted', 'signed'].includes(status)) return 'won';
  if (['cancelled', 'canceled', 'postponed', 'declined', 'lost', 'dead', 'stalled', 'paused', 'on_hold'].includes(status)) return 'lost';
  return 'open';
};
const isActiveProjectStatus = (value: unknown) => !['completed', 'done', 'cancelled', 'canceled', 'archived', 'closed'].includes(String(value || '').trim().toLowerCase());
const daysUntil = (value: unknown) => {
  if (!isIsoDate(value)) return null;
  const target = new Date(`${String(value)}T00:00:00`);
  return Math.ceil((target.getTime() - new Date().setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24));
};
const toneClass = (level: 'critical' | 'warning' | 'good') => level === 'critical' ? 'bg-destructive/10 text-destructive border-destructive/20' : level === 'warning' ? 'bg-amber-500/10 text-amber-700 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20';
const loadBundledWorkspaceSnapshot = async (companyName: string): Promise<WorkspaceSnapshot> => {
  if (!companyName.toLowerCase().includes('ingecart')) return EMPTY_SNAPSHOT;
  try {
    const response = await fetch('/company-packs/Ingecart/ingecart_pack.json');
    if (!response.ok) return EMPTY_SNAPSHOT;
    const pack = await response.json();
    const workspace = pack?.workspace || {};
    return {
      offers: Array.isArray(workspace.offers) ? workspace.offers : [],
      projects: Array.isArray(workspace.projects) ? workspace.projects : [],
      milestones: Array.isArray(workspace.project_milestones) ? workspace.project_milestones : [],
      risks: Array.isArray(workspace.project_risks) ? workspace.project_risks : [],
      costs: Array.isArray(workspace.project_costs) ? workspace.project_costs : [],
      afterSalesOpportunities: Array.isArray(workspace.after_sales_opportunities) ? workspace.after_sales_opportunities : [],
      serviceContracts: Array.isArray(workspace.service_contracts) ? workspace.service_contracts : [],
    };
  } catch {
    return EMPTY_SNAPSHOT;
  }
};

const DashboardPage = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { data, hasData, activeCompanyId, companies, commercialSnapshot } = useData();
  const [workspaceSnapshot, setWorkspaceSnapshot] = useState<WorkspaceSnapshot>(EMPTY_SNAPSHOT);
  const activeCompany = useMemo(() => companies.find((company) => company.id === activeCompanyId) || data.companyProfile, [activeCompanyId, companies, data.companyProfile]);
  const labels = useMemo(() => language === 'es' ? {
    title: 'Daily Execution Console', subtitle: 'Cuadro de mando operativo para dirigir la empresa y conectar CRM, ofertas, proyectos y finanzas.', controlTitle: 'Commercial & Project Control', nextActions: 'Next Best Actions', offerControl: 'Offer Control Tower', projectControl: 'Project Portfolio', finance: 'Finance Control', aiBrief: 'AI Executive Brief', funnel: 'Customer Journey Funnel', workContexts: 'Work Contexts', noCompany: 'Selecciona una empresa para activar el cuadro de mando.', noData: 'Todavia no hay suficientes datos operativos para construir el cuadro de mando.', uploadData: 'Cargar datos', openOffers: 'Abrir ofertas', openProjects: 'Abrir proyectos', active: 'Activa', pipeline: 'Pipeline', weightedPipeline: 'Weighted pipeline', forecastQuarter: 'Forecast trimestre', forecastYear: 'Forecast ano', activeProjects: 'Proyectos activos', criticalProjects: 'Proyectos criticos', marginForecast: 'Margen previsto', riskAccumulated: 'Riesgo acumulado', pendingBilling: 'Facturacion pendiente', pendingCollections: 'Cobros pendientes', cashExposure: 'Cash exposure', maxFinancingNeed: 'Necesidad maxima de financiacion', revenueAtRisk: 'Revenue at Risk', offersAtRisk: 'Offers at risk', offersExpiring: 'Offers expiring', winRate: 'Win rate', viewContext: 'Ver contexto', prepareAction: 'Preparar accion', accountHealth: 'Customer Context', noActions: 'No hay acciones criticas detectadas.', noOffers: 'No hay ofertas vivas visibles.', noProjects: 'No hay proyectos activos visibles.'
  } : {
    title: 'Daily Execution Console', subtitle: 'Operational command center to direct the company and connect CRM, offers, projects, and finance.', controlTitle: 'Commercial & Project Control', nextActions: 'Next Best Actions', offerControl: 'Offer Control Tower', projectControl: 'Project Portfolio', finance: 'Finance Control', aiBrief: 'AI Executive Brief', funnel: 'Customer Journey Funnel', workContexts: 'Work Contexts', noCompany: 'Select a company to activate the control dashboard.', noData: 'There is not enough operational data yet to build the control dashboard.', uploadData: 'Upload data', openOffers: 'Open offers', openProjects: 'Open projects', active: 'Active', pipeline: 'Pipeline', weightedPipeline: 'Weighted pipeline', forecastQuarter: 'Quarter forecast', forecastYear: 'Year forecast', activeProjects: 'Active projects', criticalProjects: 'Critical projects', marginForecast: 'Forecast margin', riskAccumulated: 'Accumulated risk', pendingBilling: 'Pending billing', pendingCollections: 'Pending collections', cashExposure: 'Cash exposure', maxFinancingNeed: 'Max financing need', revenueAtRisk: 'Revenue at Risk', offersAtRisk: 'Offers at risk', offersExpiring: 'Offers expiring', winRate: 'Win rate', viewContext: 'View context', prepareAction: 'Prepare action', accountHealth: 'Customer Context', noActions: 'No critical actions were detected.', noOffers: 'No live offers are visible.', noProjects: 'No active projects are visible.'
  }, [language]);

  useEffect(() => {
    let mounted = true;
    const loadSnapshot = async () => {
      const bundled = await loadBundledWorkspaceSnapshot(String(activeCompany.company_name || ''));
      if (!activeCompanyId) {
        if (mounted) setWorkspaceSnapshot(bundled);
        return;
      }
      const localSnapshot: WorkspaceSnapshot = {
        offers: mergeUniqueRows([...readWorkspaceRows<Row>('offers', activeCompanyId), ...bundled.offers], (row) => String(row.id || row.offer_number || `${row.customer_name}|${row.title}`)),
        projects: mergeUniqueRows([...readWorkspaceRows<Row>('projects', activeCompanyId), ...bundled.projects], (row) => String(row.id || row.project_number || `${row.customer_name}|${row.title}`)),
        milestones: mergeUniqueRows([...readWorkspaceRows<Row>('project_milestones', activeCompanyId), ...bundled.milestones], (row) => String(row.id || `${row.project_id}|${row.title}|${row.planned_date}`)),
        risks: mergeUniqueRows([...readWorkspaceRows<Row>('project_risks', activeCompanyId), ...bundled.risks], (row) => String(row.id || `${row.project_id}|${row.risk_title}`)),
        costs: mergeUniqueRows([...readWorkspaceRows<Row>('project_costs', activeCompanyId), ...bundled.costs], (row) => String(row.id || `${row.project_id}|${row.category}|${row.line_item}`)),
        afterSalesOpportunities: mergeUniqueRows([...readWorkspaceRows<Row>('after_sales_opportunities', activeCompanyId), ...bundled.afterSalesOpportunities], (row) => String(row.id || `${row.customer_name}|${row.title}`)),
        serviceContracts: mergeUniqueRows([...readWorkspaceRows<Row>('service_contracts', activeCompanyId), ...bundled.serviceContracts], (row) => String(row.id || `${row.customer_name}|${row.contract_name}`)),
      };
      if (!isWorkspaceSupabaseConfigured) {
        if (mounted) setWorkspaceSnapshot(localSnapshot);
        return;
      }
      try {
        const [offersRes, projectsRes, contractsRes, afterSalesRes] = await Promise.all([
          supabase.from('offers').select('*').eq('company_id', activeCompanyId).order('updated_at', { ascending: false }).limit(250),
          supabase.from('projects').select('*').eq('company_id', activeCompanyId).order('updated_at', { ascending: false }).limit(120),
          supabase.from('service_contracts').select('*').eq('company_id', activeCompanyId).order('updated_at', { ascending: false }).limit(120),
          supabase.from('after_sales_opportunities').select('*').eq('company_id', activeCompanyId).order('updated_at', { ascending: false }).limit(120),
        ]);
        const projectIds = (projectsRes.data || []).map((project) => project.id);
        const [milestonesRes, risksRes, costsRes] = await Promise.all([
          supabase.from('project_milestones').select('*').limit(500),
          supabase.from('project_risks').select('*').limit(500),
          supabase.from('project_costs').select('*').limit(500),
        ]);
        if (!mounted) return;
        setWorkspaceSnapshot({
          offers: mergeUniqueRows([...(offersRes.data || []), ...localSnapshot.offers], (row) => String(row.id || row.offer_number || `${row.customer_name}|${row.title}`)),
          projects: mergeUniqueRows([...(projectsRes.data || []), ...localSnapshot.projects], (row) => String(row.id || row.project_number || `${row.customer_name}|${row.title}`)),
          milestones: mergeUniqueRows([...(milestonesRes.data || []).filter((row) => projectIds.includes(row.project_id)), ...localSnapshot.milestones], (row) => String(row.id || `${row.project_id}|${row.title}|${row.planned_date}`)),
          risks: mergeUniqueRows([...(risksRes.data || []).filter((row) => projectIds.includes(row.project_id)), ...localSnapshot.risks], (row) => String(row.id || `${row.project_id}|${row.risk_title}`)),
          costs: mergeUniqueRows([...(costsRes.data || []).filter((row) => projectIds.includes(row.project_id)), ...localSnapshot.costs], (row) => String(row.id || `${row.project_id}|${row.category}|${row.line_item}`)),
          afterSalesOpportunities: mergeUniqueRows([...(afterSalesRes.data || []), ...localSnapshot.afterSalesOpportunities], (row) => String(row.id || `${row.customer_name}|${row.title}`)),
          serviceContracts: mergeUniqueRows([...(contractsRes.data || []), ...localSnapshot.serviceContracts], (row) => String(row.id || `${row.customer_name}|${row.contract_name}`)),
        });
      } catch {
        if (mounted) setWorkspaceSnapshot(localSnapshot);
      }
    };
    loadSnapshot();
    return () => {
      mounted = false;
    };
  }, [activeCompany.company_name, activeCompanyId]);

  const derivedOffers = useMemo(() => mergeUniqueRows([
    ...data.orders.map((order) => ({ offer_number: order.oppNumber, title: `${order.customerName} - ${order.productFamily}`, customer_name: order.customerName, contract_value: order.sellingPrice, probability: 100, status: 'won', region: order.region, country: order.country, kam: order.kam, decision_date: order.poDate, submitted_at: order.firstOfferDate, next_action: 'Move the sold opportunity into project execution governance.', context: 'Derived from confirmed sales data.', document_paths: [] })),
    ...data.opportunities.map((opportunity) => ({ offer_number: opportunity.oppNumber, title: `${opportunity.customerName} - ${opportunity.productFamily}`, customer_name: opportunity.customerName, contract_value: opportunity.estRevenue, probability: opportunity.contractProb, status: normalizeOpportunityStatus(opportunity.status) === 'won' ? 'won' : normalizeOpportunityStatus(opportunity.status) === 'lost' ? 'lost' : 'open', region: opportunity.region, country: opportunity.country, kam: opportunity.kam, next_action: 'Protect the next commercial step and update the opportunity truth state.', context: 'Derived from the opportunity register.', document_paths: [] })),
  ], (row) => String(row.offer_number || `${row.customer_name}|${row.title}`)), [data.opportunities, data.orders]);

  const offerRows = useMemo(() => workspaceSnapshot.offers.length > 0 ? workspaceSnapshot.offers : derivedOffers, [derivedOffers, workspaceSnapshot.offers]);
  const openOffers = useMemo(() => offerRows.filter((offer) => normalizeOfferBucket(offer.status) === 'open'), [offerRows]);
  const soldOffers = useMemo(() => offerRows.filter((offer) => normalizeOfferBucket(offer.status) === 'won'), [offerRows]);
  const lostOffers = useMemo(() => offerRows.filter((offer) => normalizeOfferBucket(offer.status) === 'lost'), [offerRows]);
  const activeProjects = useMemo(() => workspaceSnapshot.projects.filter((project) => isActiveProjectStatus(project.status)), [workspaceSnapshot.projects]);
  const projectRiskMap = useMemo(() => workspaceSnapshot.risks.reduce((map, risk) => { const key = String(risk.project_id || ''); if (key) map.set(key, [...(map.get(key) || []), risk]); return map; }, new Map<string, Row[]>()), [workspaceSnapshot.risks]);
  const projectMilestoneMap = useMemo(() => workspaceSnapshot.milestones.reduce((map, milestone) => { const key = String(milestone.project_id || ''); if (key) map.set(key, [...(map.get(key) || []), milestone]); return map; }, new Map<string, Row[]>()), [workspaceSnapshot.milestones]);
  const projectCostMap = useMemo(() => workspaceSnapshot.costs.reduce((map, cost) => { const key = String(cost.project_id || ''); if (key) map.set(key, [...(map.get(key) || []), cost]); return map; }, new Map<string, Row[]>()), [workspaceSnapshot.costs]);

  const pipelineMetrics = useMemo(() => buildPipelineMetrics({ opportunities: data.opportunities, orders: data.orders }), [data.opportunities, data.orders]);
  const openPipelineValue = useMemo(() => openOffers.reduce((sum, offer) => sum + asNumber(offer.contract_value), 0), [openOffers]);
  const weightedPipelineValue = useMemo(() => openOffers.reduce((sum, offer) => sum + asNumber(offer.contract_value) * (Math.max(0, Math.min(100, asNumber(offer.probability))) / 100), 0), [openOffers]);
  const currentYearBookedRevenue = useMemo(() => data.orders.filter((order) => String(order.purchasingYear || '').includes(currentYear)).reduce((sum, order) => sum + asNumber(order.sellingPrice), 0), [data.orders]);
  const forecastQuarter = useMemo(() => {
    const soldQuarter = data.orders.filter((order) => String(order.purchasingYear) === currentYear && String(order.purchasingQuarter || '').toUpperCase() === currentQuarter).reduce((sum, order) => sum + asNumber(order.sellingPrice), 0);
    const openQuarter = openOffers.filter((offer) => {
      const dueYear = isIsoDate(offer.decision_date) ? String(offer.decision_date).slice(0, 4) : currentYear;
      const dueQuarter = isIsoDate(offer.decision_date) ? `Q${Math.ceil(Number(String(offer.decision_date).slice(5, 7)) / 3)}` : Math.max(0, Math.min(100, asNumber(offer.probability))) >= 80 ? currentQuarter : '';
      return dueYear === currentYear && dueQuarter === currentQuarter;
    }).reduce((sum, offer) => sum + asNumber(offer.contract_value) * (Math.max(0, Math.min(100, asNumber(offer.probability))) / 100), 0);
    return soldQuarter + openQuarter;
  }, [data.orders, openOffers]);
  const forecastYear = useMemo(() => currentYearBookedRevenue + openOffers.reduce((sum, offer) => {
    const dueYear = isIsoDate(offer.decision_date) ? String(offer.decision_date).slice(0, 4) : currentYear;
    return dueYear !== currentYear ? sum : sum + asNumber(offer.contract_value) * (Math.max(0, Math.min(100, asNumber(offer.probability))) / 100);
  }, 0), [currentYearBookedRevenue, openOffers]);

  const openOffersAtRisk = useMemo(() => openOffers.filter((offer) => {
    const probability = Math.max(0, Math.min(100, asNumber(offer.probability)));
    const expiry = daysUntil(offer.decision_date);
    return probability < 75 || (expiry !== null && expiry <= 14);
  }), [openOffers]);
  const offersExpiring = useMemo(() => openOffers.filter((offer) => {
    const expiry = daysUntil(offer.decision_date);
    return expiry !== null && expiry >= 0 && expiry <= 14;
  }), [openOffers]);
  const winRate = useMemo(() => {
    const denominator = soldOffers.length + lostOffers.length + openOffers.length;
    return denominator === 0 ? 0 : soldOffers.length / denominator * 100;
  }, [lostOffers.length, openOffers.length, soldOffers.length]);

  const projectCards = useMemo(() => activeProjects.map((project) => {
    const projectId = String(project.id || '');
    const risks = projectRiskMap.get(projectId) || [];
    const milestones = projectMilestoneMap.get(projectId) || [];
    const costs = projectCostMap.get(projectId) || [];
    const plannedEnd = String(project.planned_end || project.delivery_deadline || '');
    const overdue = isIsoDate(plannedEnd) && new Date(`${plannedEnd}T00:00:00`) < new Date();
    const highRisks = risks.filter((risk) => /critical|high|open/i.test(String(risk.severity || risk.level || risk.status || ''))).length;
    const budget = costs.reduce((sum, cost) => sum + asNumber(cost.budget_amount), 0);
    const actual = costs.reduce((sum, cost) => sum + asNumber(cost.actual_amount), 0);
    const uninvoiced = milestones.filter((milestone) => !milestone.is_invoiced).reduce((sum, milestone) => sum + asNumber(milestone.payment_amount), 0);
    const unpaid = milestones.filter((milestone) => milestone.is_invoiced && !milestone.is_paid).reduce((sum, milestone) => sum + asNumber(milestone.payment_amount), 0);
    const score = asNumber(project.health_score);
    const scheduleTone: 'critical' | 'warning' | 'good' = overdue || /delay|hold|blocked/i.test(String(project.status || '')) ? 'critical' : score > 0 && score < 70 ? 'warning' : 'good';
    const costTone: 'critical' | 'warning' | 'good' = actual > 0 && budget > 0 && actual > budget ? 'critical' : actual > 0 && budget > 0 && actual > budget * 0.85 ? 'warning' : 'good';
    const riskTone: 'critical' | 'warning' | 'good' = highRisks > 0 || /high|critical/i.test(String(project.risk_level || '')) ? 'critical' : risks.length > 0 ? 'warning' : 'good';
    const cashTone: 'critical' | 'warning' | 'good' = unpaid > 0 ? 'warning' : uninvoiced > 0 ? 'warning' : 'good';
    const overallTone: 'critical' | 'warning' | 'good' = [scheduleTone, costTone, riskTone, cashTone].includes('critical') ? 'critical' : [scheduleTone, costTone, riskTone, cashTone].includes('warning') ? 'warning' : 'good';
    return { id: projectId || String(project.project_number || project.title), title: String(project.title || 'Untitled project'), customerName: String(project.customer_name || 'Customer'), projectNumber: String(project.project_number || 'PRJ'), contractValue: asNumber(project.contract_value), scheduleTone, costTone, riskTone, cashTone, overallTone, highRisks, overdue };
  }), [activeProjects, projectCostMap, projectMilestoneMap, projectRiskMap]);

  const onTrackProjects = projectCards.filter((project) => project.overallTone === 'good');
  const attentionProjects = projectCards.filter((project) => project.overallTone === 'warning');
  const criticalProjects = projectCards.filter((project) => project.overallTone === 'critical');
  const projectMarginForecast = activeProjects.reduce((sum, project) => sum + asNumber(project.contract_value) * ((asNumber(project.margin_target) || 20) / 100), 0);
  const accumulatedRiskCount = workspaceSnapshot.risks.filter((risk) => !/closed|mitigated|done/i.test(String(risk.status || risk.mitigation_status || ''))).length + openOffersAtRisk.length;
  const pendingBilling = workspaceSnapshot.milestones.filter((milestone) => !milestone.is_invoiced).reduce((sum, milestone) => sum + asNumber(milestone.payment_amount), 0);
  const pendingCollections = workspaceSnapshot.milestones.filter((milestone) => milestone.is_invoiced && !milestone.is_paid).reduce((sum, milestone) => sum + asNumber(milestone.payment_amount), 0);
  const totalProjectBudget = workspaceSnapshot.costs.reduce((sum, cost) => sum + asNumber(cost.budget_amount), 0);
  const paidMilestones = workspaceSnapshot.milestones.filter((milestone) => milestone.is_paid).reduce((sum, milestone) => sum + asNumber(milestone.payment_amount), 0);
  const cashExposure = pendingCollections + criticalProjects.reduce((sum, project) => sum + project.contractValue * 0.15, 0);
  const maxFinancingNeed = Math.max(0, totalProjectBudget - paidMilestones);
  const revenueAtRisk = openOffersAtRisk.reduce((sum, offer) => sum + asNumber(offer.contract_value), 0) + criticalProjects.reduce((sum, project) => sum + project.contractValue * 0.35, 0) + pendingCollections;

  const nextBestActions = useMemo(() => {
    const actions: Array<{ id: string; priority: 'critical' | 'warning' | 'good'; title: string; subtitle: string; recommendation: string; route: string; secondaryRoute?: string; score: number; }> = [];
    openOffers.forEach((offer) => {
      const probability = Math.max(0, Math.min(100, asNumber(offer.probability)));
      const expiry = daysUntil(offer.decision_date);
      if (expiry !== null && expiry <= 7) {
        actions.push({ id: `offer-expiry-${offer.offer_number}`, priority: 'critical', title: String(offer.customer_name || offer.title || 'Offer follow-up'), subtitle: `${String(offer.offer_number || 'Offer')} - ${compactEuro(asNumber(offer.contract_value))} - expires in ${expiry} day${expiry === 1 ? '' : 's'}`, recommendation: String(offer.next_action || 'Call the customer and protect the commercial close.'), route: '/commercial-actions-repository', secondaryRoute: '/email-cobot', score: 100 - expiry });
      } else if (probability < 75 && asNumber(offer.contract_value) > 50000) {
        actions.push({ id: `offer-risk-${offer.offer_number}`, priority: 'warning', title: String(offer.customer_name || offer.title || 'Offer at risk'), subtitle: `${String(offer.offer_number || 'Offer')} - ${compactEuro(asNumber(offer.contract_value))} - ${probability.toFixed(0)}% probability`, recommendation: String(offer.next_action || getProbabilityGuidance(probability).actionFocus), route: '/commercial-actions-repository', secondaryRoute: '/ai-sales', score: Math.round(asNumber(offer.contract_value) / 1000 + probability) });
      }
    });
    projectCards.forEach((project) => {
      if (project.overallTone === 'critical') {
        actions.push({ id: `project-critical-${project.id}`, priority: 'critical', title: `${project.projectNumber} - ${project.title}`, subtitle: `${project.customerName} - schedule ${project.scheduleTone} - cash ${project.cashTone}`, recommendation: project.overdue ? 'Escalate the overdue project decision and recover the schedule.' : 'Review project risks, cash gates, and execution blockers immediately.', route: '/project-management', secondaryRoute: '/budget-command-center', score: 95 + project.highRisks });
      }
    });
    data.tasks.forEach((task) => {
      if (task.status === 'done' || !task.dueDate || !(new Date(task.dueDate) < new Date())) return;
      actions.push({ id: `task-${task.id}`, priority: task.priority === 'critical' || task.priority === 'high' ? 'critical' : 'warning', title: task.title, subtitle: `${task.assignee || 'ASE'} - overdue action`, recommendation: task.actionContent?.emailTemplate || task.description, route: '/weekly-planner', secondaryRoute: '/commercial-actions-repository', score: task.priority === 'critical' ? 93 : 82 });
    });
    if (pendingCollections > 0) actions.push({ id: 'collections-follow-up', priority: 'warning', title: 'Collections follow-up', subtitle: `${compactEuro(pendingCollections)} pending collection exposure`, recommendation: 'Review invoiced milestones, confirm the payment calendar, and escalate the highest-risk items.', route: '/budget-command-center', secondaryRoute: '/project-management', score: Math.round(pendingCollections / 5000) });
    commercialSnapshot.actions.slice(0, 4).forEach((action, index) => actions.push({ id: `ai-action-${index}-${action.title}`, priority: action.priority === 'critical' ? 'critical' : action.priority === 'high' ? 'warning' : 'good', title: action.title, subtitle: `${action.customer || activeCompany.company_name || 'Account'} - ${compactEuro(action.expectedImpact)}`, recommendation: action.rationale, route: '/ai-sales', secondaryRoute: '/commercial-actions-repository', score: 60 - index }));
    return actions.sort((left, right) => right.score - left.score).filter((action, index, array) => array.findIndex((item) => item.title === action.title && item.subtitle === action.subtitle) === index).slice(0, 6);
  }, [activeCompany.company_name, commercialSnapshot.actions, data.tasks, openOffers, pendingCollections, projectCards]);

  const funnelStages = useMemo(() => {
    const qualifiedLeads = data.leads.filter((lead) => /qual|target|active/i.test(String(lead.status || '')) || asNumber(lead.estimatedValue) > 0);
    const negotiationOffers = openOffers.filter((offer) => Math.max(0, Math.min(100, asNumber(offer.probability))) >= 75);
    const afterSalesValue = workspaceSnapshot.afterSalesOpportunities.reduce((sum, item) => sum + asNumber(item.estimated_value), 0) + workspaceSnapshot.serviceContracts.reduce((sum, item) => sum + asNumber(item.annual_value), 0);
    const loyaltyAccounts = new Set([...data.orders.map((order) => order.customerName), ...activeProjects.map((project) => String(project.customer_name || ''))].filter(Boolean));
    return [
      { label: 'Leads', count: data.leads.length, value: data.leads.reduce((sum, lead) => sum + asNumber(lead.estimatedValue), 0), probability: 25, nextStep: 'Qualify and enrich' },
      { label: 'Qualified', count: qualifiedLeads.length, value: qualifiedLeads.reduce((sum, lead) => sum + asNumber(lead.estimatedValue), 0), probability: 40, nextStep: 'Create opportunity' },
      { label: 'Opportunities', count: data.opportunities.filter((opportunity) => isOpenOpportunityStatus(opportunity.status)).length, value: pipelineMetrics.openPipeline, probability: pipelineMetrics.openPipeline > 0 ? Math.round((pipelineMetrics.weightedOpenRevenue / pipelineMetrics.openPipeline) * 100) : 0, nextStep: 'Advance scope and fit' },
      { label: 'Offers', count: openOffers.length, value: openPipelineValue, probability: openPipelineValue > 0 ? Math.round((weightedPipelineValue / openPipelineValue) * 100) : 0, nextStep: 'Protect follow-up' },
      { label: 'Negotiation', count: negotiationOffers.length, value: negotiationOffers.reduce((sum, offer) => sum + asNumber(offer.contract_value), 0), probability: negotiationOffers.length > 0 ? Math.round(negotiationOffers.reduce((sum, offer) => sum + asNumber(offer.probability), 0) / negotiationOffers.length) : 0, nextStep: 'Close and secure decision' },
      { label: 'Won', count: soldOffers.length, value: soldOffers.reduce((sum, offer) => sum + asNumber(offer.contract_value), 0), probability: 100, nextStep: 'Activate project' },
      { label: 'Project', count: activeProjects.length, value: activeProjects.reduce((sum, project) => sum + asNumber(project.contract_value), 0), probability: 100, nextStep: 'Drive delivery and cash' },
      { label: 'After Sales', count: workspaceSnapshot.afterSalesOpportunities.length + workspaceSnapshot.serviceContracts.length, value: afterSalesValue, probability: 70, nextStep: 'Service proposal and loyalty' },
      { label: 'Loyalty', count: loyaltyAccounts.size, value: 0, probability: 85, nextStep: 'Open next opportunity' },
    ];
  }, [activeProjects, data.leads, data.opportunities, data.orders, openOffers, openPipelineValue, pipelineMetrics.openPipeline, pipelineMetrics.weightedOpenRevenue, soldOffers, weightedPipelineValue, workspaceSnapshot.afterSalesOpportunities, workspaceSnapshot.serviceContracts]);

  const accountRows = useMemo(() => {
    const customers = new Map<string, { revenue: number; pipeline: number; offers: number; projects: number; actions: number }>();
    const ensure = (name: string) => {
      if (!name) return null;
      if (!customers.has(name)) customers.set(name, { revenue: 0, pipeline: 0, offers: 0, projects: 0, actions: 0 });
      return customers.get(name)!;
    };
    data.orders.forEach((order) => { const row = ensure(String(order.customerName || '')); if (row) row.revenue += asNumber(order.sellingPrice); });
    openOffers.forEach((offer) => { const row = ensure(String(offer.customer_name || '')); if (row) { row.pipeline += asNumber(offer.contract_value); row.offers += 1; } });
    activeProjects.forEach((project) => { const row = ensure(String(project.customer_name || '')); if (row) row.projects += 1; });
    nextBestActions.forEach((action) => { const row = ensure(String(action.title.split('·')[0] || '').trim()); if (row) row.actions += 1; });
    return Array.from(customers.entries()).map(([name, stats]) => ({ name, ...stats })).sort((left, right) => (right.revenue + right.pipeline + right.projects * 100000) - (left.revenue + left.pipeline + left.projects * 100000)).slice(0, 6);
  }, [activeProjects, data.orders, nextBestActions, openOffers]);

  const workContexts = useMemo(() => [
    { label: 'CRM', detail: `${accountRows.length} accounts`, route: '/commercial-actions-repository', icon: Users },
    { label: 'Sales', detail: `${compactEuro(weightedPipelineValue || pipelineMetrics.weightedOpenRevenue)} weighted`, route: '/360-analysis', icon: BarChart3 },
    { label: 'Offers', detail: `${openOffers.length} live`, route: '/commercial-actions-repository', icon: Layers },
    { label: 'Projects', detail: `${activeProjects.length} active`, route: '/project-management', icon: FolderKanban },
    { label: 'Finance', detail: `${compactEuro(revenueAtRisk)} at risk`, route: '/budget-command-center', icon: CircleDollarSign },
    { label: 'Customers', detail: `${new Set(data.orders.map((order) => order.customerName).filter(Boolean)).size} with revenue`, route: '/kam', icon: Building2 },
    { label: 'Products', detail: `${data.products.length} loaded`, route: '/product-strategy', icon: Target },
    { label: 'Knowledge', detail: `${commercialSnapshot.competitors.length} competitors`, route: '/business-intelligence', icon: SearchCheck },
    { label: 'Reports', detail: `${commercialSnapshot.actions.length} AI actions`, route: '/360-analysis', icon: FileText },
    { label: 'CGO', detail: `${nextBestActions.length} priorities`, route: '/ai-sales', icon: Brain },
    { label: 'After Sales', detail: `${workspaceSnapshot.afterSalesOpportunities.length + workspaceSnapshot.serviceContracts.length} service`, route: '/after-sales', icon: Wrench },
  ], [accountRows.length, activeProjects.length, commercialSnapshot.actions.length, commercialSnapshot.competitors.length, data.orders, data.products.length, nextBestActions.length, openOffers.length, revenueAtRisk, weightedPipelineValue, pipelineMetrics.weightedOpenRevenue, workspaceSnapshot.afterSalesOpportunities.length, workspaceSnapshot.serviceContracts.length]);

  if (!activeCompanyId) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <Card>
          <CardContent className="py-14 text-center space-y-4">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground" />
            <div>
              <h2 className="text-2xl font-semibold text-foreground">{labels.title}</h2>
              <p className="text-sm text-muted-foreground mt-2">{labels.noCompany}</p>
            </div>
            <Button onClick={() => navigate('/companies')}>Select company</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-background to-background">
        <CardContent className="pt-6">
          <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-xs">{labels.active}: {activeCompany.company_name || 'Company'}</Badge>
                <Badge variant="outline" className="text-xs">{nextBestActions.length} priorities</Badge>
                <Badge variant="outline" className="text-xs">{compactEuro(revenueAtRisk)} {labels.revenueAtRisk}</Badge>
              </div>
              <div>
                <h1 className="text-3xl font-semibold text-foreground tracking-tight">{labels.title}</h1>
                <p className="text-sm text-muted-foreground mt-2 max-w-4xl">{labels.subtitle}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => navigate('/upload')} className="gap-2"><Upload className="h-4 w-4" /> {labels.uploadData}</Button>
              <Button variant="outline" onClick={() => navigate('/commercial-actions-repository')} className="gap-2"><Layers className="h-4 w-4" /> {labels.openOffers}</Button>
              <Button variant="outline" onClick={() => navigate('/project-management')} className="gap-2"><FolderKanban className="h-4 w-4" /> {labels.openProjects}</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {!hasData && workspaceSnapshot.offers.length === 0 && workspaceSnapshot.projects.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
            <div>
              <h3 className="text-xl font-semibold text-foreground">{labels.noData}</h3>
              <p className="text-sm text-muted-foreground mt-2">{labels.subtitle}</p>
            </div>
            <Button onClick={() => navigate('/upload')} className="gap-2"><Upload className="h-4 w-4" /> {labels.uploadData}</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <Card className="xl:col-span-3">
          <CardHeader><CardTitle className="text-base">{labels.workContexts}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {workContexts.map((context) => (
              <button key={context.label} type="button" onClick={() => navigate(context.route)} className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/50">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <context.icon className="h-4 w-4 text-primary flex-shrink-0" />
                    <div className="min-w-0"><p className="text-sm font-medium text-foreground truncate">{context.label}</p><p className="text-xs text-muted-foreground truncate">{context.detail}</p></div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <div className="xl:col-span-9 space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">{labels.controlTitle}</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {[
                  { label: labels.pipeline, value: compactEuro(openPipelineValue), detail: `${openOffers.length} open offers`, icon: Layers },
                  { label: labels.weightedPipeline, value: compactEuro(weightedPipelineValue || pipelineMetrics.weightedOpenRevenue), detail: `${labels.winRate}: ${winRate.toFixed(0)}%`, icon: Target },
                  { label: labels.forecastQuarter, value: compactEuro(forecastQuarter), detail: `${labels.offersExpiring}: ${offersExpiring.length}`, icon: BarChart3 },
                  { label: labels.forecastYear, value: compactEuro(forecastYear), detail: `${labels.offersAtRisk}: ${openOffersAtRisk.length}`, icon: Activity },
                ].map((kpi) => (
                  <div key={kpi.label} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between gap-3 mb-2"><p className="text-xs text-muted-foreground uppercase tracking-wide">{kpi.label}</p><kpi.icon className="h-4 w-4 text-primary" /></div>
                    <p className="text-2xl font-semibold text-foreground">{kpi.value}</p>
                    <p className="text-xs text-muted-foreground mt-2">{kpi.detail}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border p-4 space-y-4">
                <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-foreground">{labels.nextActions}</h3><Badge variant="outline">{nextBestActions.length}</Badge></div>
                {nextBestActions.length === 0 && <p className="text-sm text-muted-foreground">{labels.noActions}</p>}
                <div className="space-y-3">
                  {nextBestActions.map((action) => (
                    <div key={action.id} className="rounded-lg border p-4">
                      <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap"><Badge variant="outline" className={toneClass(action.priority)}>{action.priority.toUpperCase()}</Badge><p className="text-sm font-semibold text-foreground">{action.title}</p></div>
                          <p className="text-xs text-muted-foreground">{action.subtitle}</p>
                          <p className="text-sm text-foreground/90">{action.recommendation}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => navigate(action.route)}>{labels.viewContext}</Button>
                          <Button size="sm" onClick={() => navigate(action.secondaryRoute || action.route)}>{labels.prepareAction}</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">{labels.funnel}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {funnelStages.map((stage) => (
                  <div key={stage.label} className="rounded-lg border p-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2"><div><p className="text-sm font-medium text-foreground">{stage.label}</p><p className="text-xs text-muted-foreground">{stage.count} items - {compactEuro(stage.value)}</p></div><Badge variant="outline">{stage.probability}%</Badge></div>
                    <Progress value={stage.probability} className="h-2 mb-2" />
                    <p className="text-xs text-muted-foreground">Next: {stage.nextStep}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">{labels.projectControl}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">On track</p><p className="text-2xl font-semibold text-foreground">{onTrackProjects.length}</p></div>
                  <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Attention</p><p className="text-2xl font-semibold text-foreground">{attentionProjects.length}</p></div>
                  <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Critical</p><p className="text-2xl font-semibold text-foreground">{criticalProjects.length}</p></div>
                </div>
                <div className="space-y-3">
                  {projectCards.slice(0, 6).map((project) => (
                    <div key={project.id} className="rounded-lg border p-3">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2"><div><p className="text-sm font-medium text-foreground">{project.projectNumber} - {project.title}</p><p className="text-xs text-muted-foreground mt-1">{project.customerName} - {compactEuro(project.contractValue)}</p></div><Badge variant="outline" className={toneClass(project.overallTone)}>{project.overallTone.toUpperCase()}</Badge></div>
                      <div className="mt-3 grid grid-cols-2 xl:grid-cols-4 gap-2 text-xs"><div className={`rounded-md border px-2 py-1 ${toneClass(project.scheduleTone)}`}>Schedule</div><div className={`rounded-md border px-2 py-1 ${toneClass(project.costTone)}`}>Cost</div><div className={`rounded-md border px-2 py-1 ${toneClass(project.riskTone)}`}>Risk</div><div className={`rounded-md border px-2 py-1 ${toneClass(project.cashTone)}`}>Cash</div></div>
                    </div>
                  ))}
                  {projectCards.length === 0 && <p className="text-sm text-muted-foreground">{labels.noProjects}</p>}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 2xl:grid-cols-3 gap-6">
            <Card className="2xl:col-span-2">
              <CardHeader><CardTitle className="text-base">{labels.offerControl}</CardTitle></CardHeader>
              <CardContent>
                {openOffers.length === 0 ? <p className="text-sm text-muted-foreground">{labels.noOffers}</p> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-2 pr-3">Customer</th><th className="py-2 pr-3">Offer</th><th className="py-2 pr-3 text-right">Value</th><th className="py-2 pr-3 text-right">Prob.</th><th className="py-2 pr-3">Status</th></tr></thead>
                      <tbody>
                        {[...openOffers].sort((left, right) => asNumber(right.contract_value) - asNumber(left.contract_value)).slice(0, 8).map((offer) => {
                          const probability = Math.max(0, Math.min(100, asNumber(offer.probability)));
                          const expiry = daysUntil(offer.decision_date);
                          const level: 'critical' | 'warning' | 'good' = probability < 60 || (expiry !== null && expiry <= 7) ? 'critical' : probability < 80 || (expiry !== null && expiry <= 14) ? 'warning' : 'good';
                          return (
                            <tr key={`${offer.offer_number}-${offer.customer_name}-${offer.title}`} className="border-b align-top last:border-0">
                              <td className="py-3 pr-3"><p className="font-medium text-foreground">{offer.customer_name || 'Customer'}</p><p className="text-xs text-muted-foreground mt-1">{offer.kam || offer.country || offer.region || 'ASE'}</p></td>
                              <td className="py-3 pr-3"><p className="text-foreground">{offer.offer_number || 'Offer'}</p><p className="text-xs text-muted-foreground mt-1">{offer.title || offer.project_description || 'Untitled offer'}</p></td>
                              <td className="py-3 pr-3 text-right tabular-nums">{compactEuro(asNumber(offer.contract_value))}</td>
                              <td className="py-3 pr-3 text-right tabular-nums">{probability.toFixed(0)}%</td>
                              <td className="py-3 pr-3"><Badge variant="outline" className={toneClass(level)}>{level.toUpperCase()}</Badge></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">{labels.aiBrief}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground"><Bot className="h-4 w-4 text-primary" /><span>{nextBestActions.length} situations require attention</span></div>
                {nextBestActions.slice(0, 3).map((action, index) => (
                  <div key={action.id} className="rounded-lg border p-3">
                    <div className="flex items-start gap-2"><AlertTriangle className={`h-4 w-4 mt-0.5 ${action.priority === 'critical' ? 'text-destructive' : action.priority === 'warning' ? 'text-amber-500' : 'text-emerald-600'}`} /><div><p className="text-sm font-medium text-foreground">{index + 1}. {action.title}</p><p className="text-xs text-muted-foreground mt-1">{action.subtitle}</p><p className="text-xs text-foreground/90 mt-2">{action.recommendation}</p></div></div>
                  </div>
                ))}
                <Button variant="outline" className="w-full" onClick={() => navigate('/ai-sales')}>Explain</Button>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">{labels.finance}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { label: labels.pendingBilling, value: compactEuro(pendingBilling), icon: ClipboardList },
                    { label: labels.pendingCollections, value: compactEuro(pendingCollections), icon: CircleDollarSign },
                    { label: labels.cashExposure, value: compactEuro(cashExposure), icon: ShieldAlert },
                    { label: labels.maxFinancingNeed, value: compactEuro(maxFinancingNeed), icon: Calculator },
                  ].map((metric) => (
                    <div key={metric.label} className="rounded-lg border p-4"><div className="flex items-center justify-between gap-3 mb-2"><p className="text-xs text-muted-foreground uppercase tracking-wide">{metric.label}</p><metric.icon className="h-4 w-4 text-primary" /></div><p className="text-xl font-semibold text-foreground">{metric.value}</p></div>
                  ))}
                </div>
                <div className="rounded-lg border p-4"><div className="flex items-center justify-between gap-3 mb-2"><p className="text-sm font-medium text-foreground">{labels.revenueAtRisk}</p><Badge variant="outline" className={toneClass(revenueAtRisk > 0 ? 'critical' : 'good')}>{compactEuro(revenueAtRisk)}</Badge></div><p className="text-xs text-muted-foreground">Built from open offers at risk, critical projects, and pending collections.</p></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">{labels.accountHealth}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {accountRows.map((account) => (
                  <div key={account.name} className="rounded-lg border p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-foreground">{account.name}</p><p className="text-xs text-muted-foreground mt-1">Revenue {compactEuro(account.revenue)} - Pipeline {compactEuro(account.pipeline)}</p></div><Badge variant="outline">{account.projects} projects</Badge></div><div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground"><span>{account.offers} offers</span><span>{account.actions} action triggers</span></div></div>
                ))}
                {accountRows.length === 0 && <p className="text-sm text-muted-foreground">No connected account context is visible yet.</p>}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              { label: labels.activeProjects, value: String(activeProjects.length), detail: `${onTrackProjects.length} on track`, icon: FolderKanban },
              { label: labels.criticalProjects, value: String(criticalProjects.length), detail: `${attentionProjects.length} under attention`, icon: AlertTriangle },
              { label: labels.marginForecast, value: compactEuro(projectMarginForecast), detail: 'Based on active project targets', icon: Target },
              { label: labels.riskAccumulated, value: String(accumulatedRiskCount), detail: `${openOffersAtRisk.length} offer risks + ${workspaceSnapshot.risks.length} project risks`, icon: Activity },
            ].map((kpi) => (
              <Card key={kpi.label}><CardContent className="pt-5 pb-4"><div className="flex items-center justify-between gap-3 mb-2"><p className="text-xs text-muted-foreground uppercase tracking-wide">{kpi.label}</p><kpi.icon className="h-4 w-4 text-primary" /></div><p className="text-2xl font-semibold text-foreground">{kpi.value}</p><p className="text-xs text-muted-foreground mt-2">{kpi.detail}</p></CardContent></Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;

