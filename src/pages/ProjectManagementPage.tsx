import { useCallback, useEffect, useMemo, useState } from 'react';
import { useData } from '@/store/DataStore';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { isWorkspaceSupabaseConfigured, readWorkspaceRows, writeWorkspaceRows } from '@/lib/workspaceStorage';
import { getIngecartBundledProjectWorkspace } from '@/lib/ingecartProjectSeed';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertTriangle,
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Factory,
  FileText,
  GanttChartSquare,
  Package,
  Plus,
  ShieldCheck,
  ShipWheel,
  Truck,
  Wrench,
  Zap,
} from 'lucide-react';
import {
  buildCustomerPendingPoints,
  buildProjectManagementPoints,
  createManualProjectPoint,
  downloadProjectDecisionWorkbook,
  normalizeProjectPoints,
  PROJECT_POINT_PRIORITIES,
  PROJECT_POINT_STATUSES,
  type ProjectPointPanel,
  type ProjectPointPriority,
  type ProjectPointRecord,
  type ProjectPointStatus,
} from '@/lib/projectDecisionLog';

type ProjectRow = any;
type PhaseRow = any;
type MilestoneRow = any;
type RiskRow = any;
type GateRow = any;
type CostRow = any;

const PROJECT_POINT_TABLES = {
  customer_pending: 'project_pending_points',
  project_management: 'project_management_points',
} as const;

const buildPhaseTemplate = (projectName: string) => [
  {
    phase_number: 1,
    phase_name: 'Order activation',
    description: 'Commercial confirmation, PO release and kickoff pack.',
    status: 'in_progress',
    responsible: 'PM',
    completion_pct: 30,
    planned_start: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString().slice(0, 10),
    planned_end: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString().slice(0, 10),
    budget: 12000,
    key_tasks: ['PO confirmation', 'Kickoff meeting', 'Project charter'],
    control_points: ['Customer approval', 'Technical baseline'],
    risks: ['Scope freeze pending'],
  },
  {
    phase_number: 2,
    phase_name: 'Engineering & design',
    description: 'Design release, calculations, layouts and engineering approvals.',
    status: 'pending',
    responsible: 'Engineering',
    completion_pct: 0,
    planned_start: new Date(Date.now() + 1000 * 60 * 60 * 24 * 6).toISOString().slice(0, 10),
    planned_end: new Date(Date.now() + 1000 * 60 * 60 * 24 * 16).toISOString().slice(0, 10),
    budget: 25000,
    key_tasks: ['Layout approval', 'Design review', 'Bill of materials'],
    control_points: ['Customer sign-off'],
    risks: ['Long lead items'],
  },
  {
    phase_number: 3,
    phase_name: 'Procurement',
    description: 'Buy critical components, verify suppliers and release long- lead items.',
    status: 'pending',
    responsible: 'Procurement',
    completion_pct: 0,
    planned_start: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10).toISOString().slice(0, 10),
    planned_end: new Date(Date.now() + 1000 * 60 * 60 * 24 * 20).toISOString().slice(0, 10),
    budget: 32000,
    key_tasks: ['RFQ', 'PO issuance', 'Supplier validation'],
    control_points: ['Material readiness'],
    risks: ['Shipment delays'],
  },
  {
    phase_number: 4,
    phase_name: 'Manufacturing',
    description: 'Production, assembly and quality control before FAT.',
    status: 'pending',
    responsible: 'Workshop',
    completion_pct: 0,
    planned_start: new Date(Date.now() + 1000 * 60 * 60 * 24 * 18).toISOString().slice(0, 10),
    planned_end: new Date(Date.now() + 1000 * 60 * 60 * 24 * 35).toISOString().slice(0, 10),
    budget: 65000,
    key_tasks: ['Assembly', 'QC', 'Factory test preparation'],
    control_points: ['FAT package'],
    risks: ['Testing bottleneck'],
  },
  {
    phase_number: 5,
    phase_name: 'Shipping & installation',
    description: 'Logistics, customs, site readiness and final installation.',
    status: 'pending',
    responsible: 'Logistics',
    completion_pct: 0,
    planned_start: new Date(Date.now() + 1000 * 60 * 60 * 24 * 33).toISOString().slice(0, 10),
    planned_end: new Date(Date.now() + 1000 * 60 * 60 * 24 * 50).toISOString().slice(0, 10),
    budget: 43000,
    key_tasks: ['Shipping', 'Site prep', 'Installation team mobilization'],
    control_points: ['Installation readiness'],
    risks: ['Site access'],
  },
  {
    phase_number: 6,
    phase_name: 'FAT and commissioning',
    description: 'Factory acceptance, commissioning, training and close-out.',
    status: 'pending',
    responsible: 'Commissioning',
    completion_pct: 0,
    planned_start: new Date(Date.now() + 1000 * 60 * 60 * 24 * 45).toISOString().slice(0, 10),
    planned_end: new Date(Date.now() + 1000 * 60 * 60 * 24 * 60).toISOString().slice(0, 10),
    budget: 24000,
    key_tasks: ['FAT', 'Training', 'Snag list closure'],
    control_points: ['Final acceptance'],
    risks: ['Punch list'] ,
  },
];

const buildMilestones = (projectId: string) => [
  { project_id: projectId, milestone_type: 'contract', title: 'Order confirmed', status: 'completed', planned_date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString().slice(0, 10), payment_amount: 0, payment_pct: 10, is_invoiced: true, is_paid: true, responsible: 'Sales' },
  { project_id: projectId, milestone_type: 'design', title: 'Design freeze', status: 'pending', planned_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10).toISOString().slice(0, 10), payment_amount: 25000, payment_pct: 25, is_invoiced: false, is_paid: false, responsible: 'Engineering' },
  { project_id: projectId, milestone_type: 'procurement', title: 'Materials ready', status: 'pending', planned_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 20).toISOString().slice(0, 10), payment_amount: 30000, payment_pct: 35, is_invoiced: false, is_paid: false, responsible: 'Procurement' },
  { project_id: projectId, milestone_type: 'factory', title: 'FAT complete', status: 'pending', planned_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 40).toISOString().slice(0, 10), payment_amount: 20000, payment_pct: 50, is_invoiced: false, is_paid: false, responsible: 'QA' },
  { project_id: projectId, milestone_type: 'installation', title: 'Installation & commissioning', status: 'pending', planned_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 52).toISOString().slice(0, 10), payment_amount: 15000, payment_pct: 70, is_invoiced: false, is_paid: false, responsible: 'Field service' },
  { project_id: projectId, milestone_type: 'final', title: 'Final handover', status: 'pending', planned_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 60).toISOString().slice(0, 10), payment_amount: 30000, payment_pct: 100, is_invoiced: false, is_paid: false, responsible: 'PM' },
];

const buildGates = (projectId: string) => [
  { project_id: projectId, gate_number: 'G1', gate_name: 'Order Kickoff', status: 'passed', planned_date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString().slice(0, 10), description: 'PO received and kickoff signed', responsible: 'PM' },
  { project_id: projectId, gate_number: 'G2', gate_name: 'Engineering release', status: 'pending', planned_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10).toISOString().slice(0, 10), description: 'Design freeze and customer approval', responsible: 'Engineering' },
  { project_id: projectId, gate_number: 'G3', gate_name: 'Procurement release', status: 'pending', planned_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 22).toISOString().slice(0, 10), description: 'All long lead items approved and in transit', responsible: 'Procurement' },
  { project_id: projectId, gate_number: 'G4', gate_name: 'FAT approval', status: 'pending', planned_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 40).toISOString().slice(0, 10), description: 'Factory acceptance test signed off', responsible: 'QA' },
  { project_id: projectId, gate_number: 'G5', gate_name: 'Site acceptance', status: 'pending', planned_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 58).toISOString().slice(0, 10), description: 'Installation complete and training delivered', responsible: 'Field service' },
];

const buildRisks = (projectId: string) => [
  { project_id: projectId, risk_title: 'Supplier lead time', description: 'Critical parts may extend delivery if not released in time.', category: 'procurement', probability: 'medium', impact: 'high', risk_score: 72, mitigation_action: 'Negotiate expediting and reserve stock', owner: 'Procurement', status: 'open' },
  { project_id: projectId, risk_title: 'Site access constraints', description: 'Installation may be blocked by access or civil works readiness.', category: 'site', probability: 'medium', impact: 'high', risk_score: 68, mitigation_action: 'Validate access plan and civil schedule', owner: 'PM', status: 'monitoring' },
  { project_id: projectId, risk_title: 'Technical change requests', description: 'New requests can affect engineering duration and margin.', category: 'engineering', probability: 'medium', impact: 'medium', risk_score: 54, mitigation_action: 'Keep a change-control log and approval gate', owner: 'Engineering', status: 'open' },
];

const fmtCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value || 0);
const pct = (value: number) => `${Math.min(100, Math.max(0, value || 0)).toFixed(0)}%`;

export default function ProjectManagementPage() {
  const { activeCompanyId, data } = useData();
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [phases, setPhases] = useState<PhaseRow[]>([]);
  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);
  const [risks, setRisks] = useState<RiskRow[]>([]);
  const [gates, setGates] = useState<GateRow[]>([]);
  const [costs, setCosts] = useState<CostRow[]>([]);
  const [customerPendingPoints, setCustomerPendingPoints] = useState<ProjectPointRecord[]>([]);
  const [projectManagementPoints, setProjectManagementPoints] = useState<ProjectPointRecord[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  const syncBundledProjectSeed = useCallback(async (companyId: string) => {
    if (!String(data.companyProfile.company_name || '').toLowerCase().includes('ingecart')) return;
    const bundled = getIngecartBundledProjectWorkspace();
    const incomingProjects = bundled.projects || [];
    if (incomingProjects.length === 0) return;
    const currentProjects = readWorkspaceRows<any>('projects', companyId);
    const incomingIds = new Set(incomingProjects.map((project) => project.id));
    const incomingNumbers = new Set(incomingProjects.map((project) => project.project_number));
    const mergedProjects = [
      ...currentProjects.filter((project) => !incomingIds.has(project.id) && !incomingNumbers.has(project.project_number)),
      ...incomingProjects,
    ].sort((left, right) => String(left.project_number || '').localeCompare(String(right.project_number || '')));
    writeWorkspaceRows('projects', companyId, mergedProjects);
    (['project_phases', 'project_milestones', 'project_risks', 'project_gates', 'project_costs', 'change_orders'] as const).forEach((table) => {
      const currentRows = readWorkspaceRows<any>(table, companyId);
      const incomingRows = bundled[table] || [];
      writeWorkspaceRows(table, companyId, [
        ...currentRows.filter((row) => !incomingIds.has(row.project_id)),
        ...incomingRows,
      ]);
    });
  }, [data.companyProfile.company_name]);

  const loadProjectData = useCallback(async () => {

    if (!activeCompanyId) return;
    setLoading(true);
    try {
      if (!isWorkspaceSupabaseConfigured) {
        await syncBundledProjectSeed(activeCompanyId);
        const localProjects = readWorkspaceRows('projects', activeCompanyId);
        setProjects(localProjects);
        if (!selectedProjectId && localProjects[0]) {
          setSelectedProjectId(localProjects[0].id);
        }
        setPhases(readWorkspaceRows('project_phases', activeCompanyId));
        setMilestones(readWorkspaceRows('project_milestones', activeCompanyId));
        setRisks(readWorkspaceRows('project_risks', activeCompanyId));
        setGates(readWorkspaceRows('project_gates', activeCompanyId));
        setCosts(readWorkspaceRows('project_costs', activeCompanyId));
        setCustomerPendingPoints(readWorkspaceRows('project_pending_points', activeCompanyId));
        setProjectManagementPoints(readWorkspaceRows('project_management_points', activeCompanyId));
        return;
      }

      const { data: projectsData } = await supabase.from('projects').select('*').eq('company_id', activeCompanyId).order('created_at', { ascending: false });
      const normalizedProjects = projectsData || [];
      setProjects(normalizedProjects);
      if (!selectedProjectId && normalizedProjects[0]) {
        setSelectedProjectId(normalizedProjects[0].id);
      }

      if (normalizedProjects.length === 0) {
        setPhases([]); setMilestones([]); setRisks([]); setGates([]); setCosts([]); setCustomerPendingPoints([]); setProjectManagementPoints([]); return;
      }

      const ids = normalizedProjects.map((project) => project.id);
      const [phasesRes, milestonesRes, risksRes, gatesRes, costsRes] = await Promise.all([
        supabase.from('project_phases').select('*').in('project_id', ids),
        supabase.from('project_milestones').select('*').in('project_id', ids),
        supabase.from('project_risks').select('*').in('project_id', ids),
        supabase.from('project_gates').select('*').in('project_id', ids),
        supabase.from('project_costs').select('*').in('project_id', ids),
      ]);

      setPhases(phasesRes.data || []);
      setMilestones(milestonesRes.data || []);
      setRisks(risksRes.data || []);
      setGates(gatesRes.data || []);
      setCosts(costsRes.data || []);
      setCustomerPendingPoints(readWorkspaceRows('project_pending_points', activeCompanyId));
      setProjectManagementPoints(readWorkspaceRows('project_management_points', activeCompanyId));
    } catch (error: any) {
      if (activeCompanyId) {
        setProjects(readWorkspaceRows('projects', activeCompanyId));
        setPhases(readWorkspaceRows('project_phases', activeCompanyId));
        setMilestones(readWorkspaceRows('project_milestones', activeCompanyId));
        setRisks(readWorkspaceRows('project_risks', activeCompanyId));
        setGates(readWorkspaceRows('project_gates', activeCompanyId));
        setCosts(readWorkspaceRows('project_costs', activeCompanyId));
        setCustomerPendingPoints(readWorkspaceRows('project_pending_points', activeCompanyId));
        setProjectManagementPoints(readWorkspaceRows('project_management_points', activeCompanyId));
      } else {
        toast({ title: 'Error', description: error.message || 'Unable to load project data', variant: 'destructive' });
      }
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId, selectedProjectId, syncBundledProjectSeed]);

  useEffect(() => {
    if (activeCompanyId) {
      loadProjectData();
    }
  }, [activeCompanyId, loadProjectData]);

  useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  const activeProject = useMemo(() => projects.find((project) => project.id === selectedProjectId) || projects[0] || null, [projects, selectedProjectId]);
  const activePhases = useMemo(() => phases.filter((phase) => phase.project_id === activeProject?.id), [phases, activeProject]);
  const activeMilestones = useMemo(() => milestones.filter((m) => m.project_id === activeProject?.id), [milestones, activeProject]);
  const activeRisks = useMemo(() => risks.filter((risk) => risk.project_id === activeProject?.id), [risks, activeProject]);
  const activeGates = useMemo(() => gates.filter((gate) => gate.project_id === activeProject?.id), [gates, activeProject]);
  const activeCosts = useMemo(() => costs.filter((cost) => cost.project_id === activeProject?.id), [costs, activeProject]);

  const stats = useMemo(() => {
    const projectBudget = Number(activeProject?.total_budget || 0);
    const projectContract = Number(activeProject?.contract_value || 0);
    const totalPaid = Number(activeProject?.total_paid || 0);
    const totalInvoiced = Number(activeProject?.total_invoiced || 0);
    const completion = activePhases.length > 0 ? activePhases.reduce((sum, phase) => sum + Number(phase.completion_pct || 0), 0) / activePhases.length : 0;
    const openIssues = activeRisks.filter((risk) => risk.status !== 'closed').length;
    const pendingPayments = activeMilestones.filter((m) => m.is_paid === false && m.payment_amount > 0).length;
    return { projectBudget, projectContract, totalPaid, totalInvoiced, completion, openIssues, pendingPayments };
  }, [activeProject, activePhases, activeRisks, activeMilestones]);

  const activeCustomerPendingPoints = useMemo(() => normalizeProjectPoints(customerPendingPoints.filter((point) => point.project_id === activeProject?.id)), [customerPendingPoints, activeProject]);
  const activeProjectManagementPoints = useMemo(() => normalizeProjectPoints(projectManagementPoints.filter((point) => point.project_id === activeProject?.id)), [projectManagementPoints, activeProject]);

  const persistProjectPoints = useCallback((panel: ProjectPointPanel, rows: ProjectPointRecord[]) => {
    if (!activeCompanyId) return;
    const normalizedRows = normalizeProjectPoints(rows.map((row) => ({
      ...row,
      panel,
      updated_at: new Date().toISOString(),
    })));
    writeWorkspaceRows(PROJECT_POINT_TABLES[panel], activeCompanyId, normalizedRows);
    if (panel === 'customer_pending') {
      setCustomerPendingPoints(normalizedRows);
      return;
    }
    setProjectManagementPoints(normalizedRows);
  }, [activeCompanyId]);

  const updateProjectPointCollection = (panel: ProjectPointPanel, updater: (rows: ProjectPointRecord[]) => ProjectPointRecord[]) => {
    const currentRows = panel === 'customer_pending' ? customerPendingPoints : projectManagementPoints;
    persistProjectPoints(panel, updater(currentRows));
  };

  const buildGeneratedProjectPoints = (panel: ProjectPointPanel) => {
    if (!activeProject) return [] as ProjectPointRecord[];
    return panel === 'customer_pending'
      ? buildCustomerPendingPoints(activeProject, activeMilestones, activeRisks, activeGates)
      : buildProjectManagementPoints(activeProject, activePhases, activeMilestones, activeRisks, activeGates, activeCosts);
  };

  useEffect(() => {
    if (!activeCompanyId || !activeProject) return;
    if (activeCustomerPendingPoints.length === 0) {
      const generated = buildCustomerPendingPoints(activeProject, activeMilestones, activeRisks, activeGates);
      if (generated.length > 0) {
        persistProjectPoints('customer_pending', [
          ...customerPendingPoints.filter((point) => point.project_id !== activeProject.id),
          ...generated,
        ]);
      }
    }
    if (activeProjectManagementPoints.length === 0) {
      const generated = buildProjectManagementPoints(activeProject, activePhases, activeMilestones, activeRisks, activeGates, activeCosts);
      if (generated.length > 0) {
        persistProjectPoints('project_management', [
          ...projectManagementPoints.filter((point) => point.project_id !== activeProject.id),
          ...generated,
        ]);
      }
    }
  }, [
    activeCompanyId,
    activeProject,
    activePhases,
    activeMilestones,
    activeRisks,
    activeGates,
    activeCosts,
    activeCustomerPendingPoints.length,
    activeProjectManagementPoints.length,
    customerPendingPoints,
    projectManagementPoints,
    persistProjectPoints,
  ]);

  const handleProjectPointChange = (panel: ProjectPointPanel, pointId: string, patch: Partial<ProjectPointRecord>) => {
    updateProjectPointCollection(panel, (rows) => rows.map((row) => row.id === pointId ? { ...row, ...patch, updated_at: new Date().toISOString() } : row));
  };

  const handleAddProjectPoint = (panel: ProjectPointPanel) => {
    if (!activeProject) return;
    updateProjectPointCollection(panel, (rows) => [
      ...rows,
      createManualProjectPoint(activeProject.id, panel),
    ]);
  };

  const handleRegenerateProjectPoints = (panel: ProjectPointPanel) => {
    if (!activeProject) return;
    const generated = buildGeneratedProjectPoints(panel);
    updateProjectPointCollection(panel, (rows) => {
      const untouched = rows.filter((row) => row.project_id !== activeProject.id);
      const manualRows = rows.filter((row) => row.project_id === activeProject.id && !row.ai_generated);
      return [...untouched, ...manualRows, ...generated];
    });
    toast({ title: 'Baseline updated', description: 'AI baseline points were recalculated for the active project.' });
  };

  const handleExportProjectPoints = async (panel: ProjectPointPanel, language: 'es' | 'en' = 'es') => {
    if (!activeProject) return;
    const points = panel === 'customer_pending' ? activeCustomerPendingPoints : activeProjectManagementPoints;
    const { fileName } = await downloadProjectDecisionWorkbook({ project: activeProject, points, panel, language });
    toast({ title: 'Excel generated', description: `${fileName} downloaded successfully.` });
  };

  const renderProjectPointPanel = (panel: ProjectPointPanel, title: string, description: string, points: ProjectPointRecord[]) => {
    const openCount = points.filter((point) => !['confirmed', 'closed'].includes(point.status)).length;
    const blockedCount = points.filter((point) => point.status === 'blocked').length;
    const criticalCount = points.filter((point) => !['confirmed', 'closed'].includes(point.status) && point.priority === 'critical').length;
    const avgScore = points.length > 0 ? Math.round(points.reduce((sum, point) => sum + Number(point.score || 0), 0) / points.length) : 0;

    return (
      <div className="space-y-4">
        <Card>
          <CardHeader className="gap-3">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => handleRegenerateProjectPoints(panel)}>
                  <Zap className="mr-2 h-4 w-4" />
                  Rebuild AI baseline
                </Button>
                <Button variant="outline" onClick={() => handleExportProjectPoints(panel, 'es')}>
                  <FileText className="mr-2 h-4 w-4" />
                  Export Excel
                </Button>
                <Button onClick={() => handleAddProjectPoint(panel)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add point
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-lg border bg-muted/20 p-3"><div className="text-xs uppercase text-muted-foreground">Open</div><div className="mt-1 text-2xl font-semibold">{openCount}</div></div>
              <div className="rounded-lg border bg-muted/20 p-3"><div className="text-xs uppercase text-muted-foreground">Blocked</div><div className="mt-1 text-2xl font-semibold">{blockedCount}</div></div>
              <div className="rounded-lg border bg-muted/20 p-3"><div className="text-xs uppercase text-muted-foreground">Critical</div><div className="mt-1 text-2xl font-semibold">{criticalCount}</div></div>
              <div className="rounded-lg border bg-muted/20 p-3"><div className="text-xs uppercase text-muted-foreground">Average score</div><div className="mt-1 text-2xl font-semibold">{avgScore}</div></div>
            </div>

            {points.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No control points yet. Rebuild the AI baseline or add a manual point.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[1280px] w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-2 pr-3">#</th>
                      <th className="py-2 pr-3">Point</th>
                      <th className="py-2 pr-3">Responsible / due</th>
                      <th className="py-2 pr-3">Status / priority</th>
                      <th className="py-2 pr-3">Prepared action</th>
                      <th className="py-2">Tracking notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {points.map((point) => (
                      <tr key={point.id} className="align-top border-b">
                        <td className="py-3 pr-3 font-medium">
                          <div>{point.number}</div>
                          <Badge variant={point.score >= 85 ? 'destructive' : point.score >= 65 ? 'secondary' : 'outline'} className="mt-2">Score {point.score}</Badge>
                        </td>
                        <td className="py-3 pr-3">
                          <div className="space-y-2">
                            <Input value={point.title} onChange={(event) => handleProjectPointChange(panel, point.id, { title: event.target.value })} />
                            <Textarea value={point.description} onChange={(event) => handleProjectPointChange(panel, point.id, { description: event.target.value })} className="min-h-[96px]" />
                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                              <Badge variant="outline">{point.ai_generated ? 'AI baseline' : 'Manual'}</Badge>
                              <Badge variant="outline">{point.source_type || 'manual'}</Badge>
                              {point.source_ref ? <Badge variant="outline">{point.source_ref}</Badge> : null}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 pr-3">
                          <div className="space-y-2">
                            <Input value={point.owner} onChange={(event) => handleProjectPointChange(panel, point.id, { owner: event.target.value })} placeholder="Owner" />
                            <Input type="date" value={point.due_date || ''} onChange={(event) => handleProjectPointChange(panel, point.id, { due_date: event.target.value })} />
                          </div>
                        </td>
                        <td className="py-3 pr-3">
                          <div className="space-y-2">
                            <Select value={point.status} onValueChange={(value) => handleProjectPointChange(panel, point.id, { status: value as ProjectPointStatus })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {PROJECT_POINT_STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Select value={point.priority} onValueChange={(value) => handleProjectPointChange(panel, point.id, { priority: value as ProjectPointPriority })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {PROJECT_POINT_PRIORITIES.map((priority) => <SelectItem key={priority} value={priority}>{priority}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </td>
                        <td className="py-3 pr-3">
                          <div className="space-y-2 rounded-md border bg-muted/20 p-3">
                            <div className="font-medium">{point.suggested_action}</div>
                            <div className="whitespace-pre-wrap text-muted-foreground">{point.suggested_content}</div>
                          </div>
                        </td>
                        <td className="py-3">
                          <Textarea value={point.action_taken} onChange={(event) => handleProjectPointChange(panel, point.id, { action_taken: event.target.value })} className="min-h-[160px]" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  const createProjectFromOffer = async () => {
    if (!activeCompanyId) return;
    setCreating(true);
    try {
      if (!isWorkspaceSupabaseConfigured) {
        const offers = readWorkspaceRows<any>('offers', activeCompanyId)
          .filter((offer) => ['won', 'sold', 'accepted', 'approved', 'closed', 'converted', 'signed'].includes(String(offer.status || '').toLowerCase()));
        const existingProjects = readWorkspaceRows<any>('projects', activeCompanyId);
        const sourceOffer = offers.find((offer) => !existingProjects.some((project) => project.offer_id === offer.id)) || offers[0];
        if (!sourceOffer) throw new Error('No sold offer is available to activate a project.');

        const projectId = crypto.randomUUID();
        const projectNumber = `PRJ-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`;
        const contractValue = Number(sourceOffer.contract_value || sourceOffer.total_amount || 0);
        const project = {
          id: projectId,
          company_id: activeCompanyId,
          offer_id: sourceOffer.id || null,
          project_number: projectNumber,
          title: sourceOffer.title || 'New commercial project',
          customer_name: sourceOffer.customer_name || 'Customer',
          project_type: 'machine',
          complexity: 'medium',
          risk_level: 'medium',
          status: 'planning',
          contract_value: contractValue,
          currency: sourceOffer.currency || 'EUR',
          total_budget: contractValue || 120000,
          margin_target: 20,
          scope_of_supply: sourceOffer.project_description || 'Project created from commercial offer',
          notes: 'Project created from offer and initialized with end-to-end execution plan.',
          delivery_deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 60).toISOString().slice(0, 10),
          created_at: new Date().toISOString(),
        };
        const phaseRows = buildPhaseTemplate(project.title).map((phase) => ({
          id: crypto.randomUUID(),
          project_id: projectId,
          phase_number: phase.phase_number,
          phase_name: phase.phase_name,
          description: phase.description,
          status: phase.status,
          responsible: phase.responsible,
          planned_start: phase.planned_start,
          planned_end: phase.planned_end,
          budget: phase.budget,
          completion_pct: phase.completion_pct,
          key_tasks: phase.key_tasks,
          control_points: phase.control_points,
          risks: phase.risks,
        }));
        const milestoneRows = buildMilestones(projectId).map((milestone) => ({ ...milestone, id: crypto.randomUUID() }));
        const gateRows = buildGates(projectId).map((gate) => ({ ...gate, id: crypto.randomUUID() }));
        const riskRows = buildRisks(projectId).map((risk) => ({ ...risk, id: crypto.randomUUID() }));
        const costRows = [
          { id: crypto.randomUUID(), project_id: projectId, category: 'engineering', line_item: 'Engineering', budget_amount: 25000, actual_amount: 0 },
          { id: crypto.randomUUID(), project_id: projectId, category: 'procurement', line_item: 'Materials and equipment', budget_amount: 32000, actual_amount: 0 },
          { id: crypto.randomUUID(), project_id: projectId, category: 'manufacturing', line_item: 'Manufacturing', budget_amount: 65000, actual_amount: 0 },
          { id: crypto.randomUUID(), project_id: projectId, category: 'shipping', line_item: 'Shipping and installation', budget_amount: 43000, actual_amount: 0 },
          { id: crypto.randomUUID(), project_id: projectId, category: 'commissioning', line_item: 'FAT & commissioning', budget_amount: 24000, actual_amount: 0 },
        ];

        writeWorkspaceRows('projects', activeCompanyId, [project, ...existingProjects]);
        writeWorkspaceRows('project_phases', activeCompanyId, [...phaseRows, ...readWorkspaceRows('project_phases', activeCompanyId)]);
        writeWorkspaceRows('project_milestones', activeCompanyId, [...milestoneRows, ...readWorkspaceRows('project_milestones', activeCompanyId)]);
        writeWorkspaceRows('project_gates', activeCompanyId, [...gateRows, ...readWorkspaceRows('project_gates', activeCompanyId)]);
        writeWorkspaceRows('project_risks', activeCompanyId, [...riskRows, ...readWorkspaceRows('project_risks', activeCompanyId)]);
        writeWorkspaceRows('project_costs', activeCompanyId, [...costRows, ...readWorkspaceRows('project_costs', activeCompanyId)]);

        setSelectedProjectId(projectId);
        await loadProjectData();
        toast({ title: 'Project created', description: `${project.title} ready for project management.`, variant: 'default' });
        return;
      }

      const { data: offers } = await supabase.from('offers').select('id,title,customer_name,currency,project_description').eq('company_id', activeCompanyId).eq('status', 'won').order('created_at', { ascending: false }).limit(1);
      const sourceOffer = offers?.[0];
      const projectNumber = `PRJ-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`;
      const projectPayload = {
        company_id: activeCompanyId,
        offer_id: sourceOffer?.id || null,
        project_number: projectNumber,
        title: sourceOffer?.title || 'New commercial project',
        customer_name: sourceOffer?.customer_name || 'Customer',
        project_type: 'machine',
        complexity: 'medium',
        risk_level: 'medium',
        contract_value: 0,
        currency: sourceOffer?.currency || 'EUR',
        status: 'planning',
        total_budget: 120000,
        margin_target: 20,
        scope_of_supply: sourceOffer?.project_description || 'Project created from commercial offer',
        notes: 'Project created from offer and initialized with end-to-end execution plan.',
        delivery_deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 60).toISOString().slice(0, 10),
      };

      const { data: project, error: projectError } = await supabase.from('projects').insert(projectPayload).select().single();
      if (projectError) throw projectError;

      const phaseRows = buildPhaseTemplate(project.title).map((phase) => ({
        project_id: project.id,
        phase_number: phase.phase_number,
        phase_name: phase.phase_name,
        description: phase.description,
        status: phase.status,
        responsible: phase.responsible,
        planned_start: phase.planned_start,
        planned_end: phase.planned_end,
        budget: phase.budget,
        completion_pct: phase.completion_pct,
        key_tasks: phase.key_tasks,
        control_points: phase.control_points,
        risks: phase.risks,
      }));

      const { error: phaseError } = await supabase.from('project_phases').insert(phaseRows);
      if (phaseError) throw phaseError;

      const milestoneRows = buildMilestones(project.id);
      const gateRows = buildGates(project.id);
      const riskRows = buildRisks(project.id);
      const costRows = [
        { project_id: project.id, category: 'engineering', line_item: 'Engineering', budget_amount: 25000, actual_amount: 0 },
        { project_id: project.id, category: 'procurement', line_item: 'Materials and equipment', budget_amount: 32000, actual_amount: 0 },
        { project_id: project.id, category: 'manufacturing', line_item: 'Manufacturing', budget_amount: 65000, actual_amount: 0 },
        { project_id: project.id, category: 'shipping', line_item: 'Shipping and installation', budget_amount: 43000, actual_amount: 0 },
        { project_id: project.id, category: 'commissioning', line_item: 'FAT & commissioning', budget_amount: 24000, actual_amount: 0 },
      ];

      await supabase.from('project_milestones').insert(milestoneRows);
      await supabase.from('project_gates').insert(gateRows);
      await supabase.from('project_risks').insert(riskRows);
      await supabase.from('project_costs').insert(costRows);

      setSelectedProjectId(project.id);
      await loadProjectData();
      toast({ title: 'Project created', description: `${project.title} ready for project management.`, variant: 'default' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Unable to create a project from the offer', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  if (!activeCompanyId) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Select a company to manage the project lifecycle.
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BriefcaseBusiness className="h-6 w-6 text-primary" />
            Project Management Control
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            End-to-end project execution from order activation to FAT, shipping, installation, acceptance and handover.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadProjectData} disabled={loading}>
            <Zap className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={createProjectFromOffer} disabled={creating}>
            <Plus className="h-4 w-4 mr-2" />
            {creating ? 'Creating...' : 'New project from offer'}
          </Button>
        </div>
      </div>

      {projects.length > 0 && activeProject && (
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1">
            <label className="text-xs font-medium text-muted-foreground">Project</label>
            <Select value={activeProject.id} onValueChange={setSelectedProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>{project.project_number}  {project.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {loading ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">Loading project data</CardContent>
        </Card>
      ) : !activeProject ? (
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground opacity-60" />
            <div>
              <h3 className="text-lg font-semibold">No project yet</h3>
              <p className="text-muted-foreground">Create a new project from a won offer or activate an existing project.</p>
            </div>
            <Button onClick={createProjectFromOffer} disabled={creating}>{creating ? 'Creating...' : 'Create project'}</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Contract value</CardTitle></CardHeader>
              <CardContent><div className="flex items-center justify-between"><CircleDollarSign className="h-5 w-5 text-primary" /><span className="text-xl font-bold">{fmtCurrency(stats.projectContract)}</span></div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Budget</CardTitle></CardHeader>
              <CardContent><div className="flex items-center justify-between"><Package className="h-5 w-5 text-primary" /><span className="text-xl font-bold">{fmtCurrency(stats.projectBudget)}</span></div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Paid</CardTitle></CardHeader>
              <CardContent><div className="flex items-center justify-between"><ShieldCheck className="h-5 w-5 text-primary" /><span className="text-xl font-bold">{fmtCurrency(stats.totalPaid)}</span></div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Progress</CardTitle></CardHeader>
              <CardContent><div className="flex items-center justify-between"><GanttChartSquare className="h-5 w-5 text-primary" /><span className="text-xl font-bold">{pct(stats.completion)}</span></div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Open issues</CardTitle></CardHeader>
              <CardContent><div className="flex items-center justify-between"><AlertTriangle className="h-5 w-5 text-primary" /><span className="text-xl font-bold">{stats.openIssues}</span></div></CardContent>
            </Card>
          </div>

          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="grid w-full grid-cols-7">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="execution">Execution</TabsTrigger>
              <TabsTrigger value="milestones">Milestones</TabsTrigger>
              <TabsTrigger value="customer-points">Customer points</TabsTrigger>
              <TabsTrigger value="project-points">Project control</TabsTrigger>
              <TabsTrigger value="issues">Pending issues</TabsTrigger>
              <TabsTrigger value="docs">Documents & gates</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <Card className="xl:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Factory className="h-4 w-4 text-primary" /> Project summary</CardTitle>
                    <CardDescription>{activeProject.title}  {activeProject.customer_name}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div><span className="text-muted-foreground">Project number:</span> <strong>{activeProject.project_number}</strong></div>
                      <div><span className="text-muted-foreground">Status:</span> <Badge variant="outline">{activeProject.status}</Badge></div>
                      <div><span className="text-muted-foreground">Planned start:</span> <strong>{activeProject.planned_start || 'TBD'}</strong></div>
                      <div><span className="text-muted-foreground">Delivery deadline:</span> <strong>{activeProject.delivery_deadline || 'TBD'}</strong></div>
                      <div><span className="text-muted-foreground">Project type:</span> <strong>{activeProject.project_type}</strong></div>
                      <div><span className="text-muted-foreground">Margin target:</span> <strong>{activeProject.margin_target || 0}%</strong></div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-sm mb-2"><span>Project completion</span><span>{pct(stats.completion)}</span></div>
                      <Progress value={Number(stats.completion)} />
                    </div>
                    <div className="rounded-lg border p-3 bg-muted/20 text-sm">
                      <div className="font-medium mb-1">Scope</div>
                      <div className="text-muted-foreground">{activeProject.scope_of_supply || 'No scope defined yet.'}</div>
                    </div>
                    <div className="grid gap-4 xl:grid-cols-2">
                      <div className="rounded-lg border p-3 bg-background text-sm space-y-3">
                        <div className="font-medium">Commercial and execution context</div>
                        <div><span className="text-muted-foreground">Payment terms:</span> <span>{activeProject.payment_terms || 'TBD'}</span></div>
                        <div><span className="text-muted-foreground">Incoterms:</span> <span>{activeProject.incoterms || 'TBD'}</span></div>
                        <div><span className="text-muted-foreground">Warranty:</span> <span>{activeProject.warranty_terms || 'TBD'}</span></div>
                        <div><span className="text-muted-foreground">Dependencies:</span> <span>{activeProject.dependencies || 'TBD'}</span></div>
                        <div>
                          <div className="text-muted-foreground mb-1">Customer requirements</div>
                          <div className="whitespace-pre-wrap">{activeProject.customer_requirements || 'No special requirements captured yet.'}</div>
                        </div>
                      </div>
                      <div className="rounded-lg border p-3 bg-background text-sm space-y-3">
                        <div className="font-medium">Evidence and cost control</div>
                        <div>
                          <div className="text-muted-foreground mb-1">Source references</div>
                          <div className="whitespace-pre-wrap break-all text-xs">{activeProject.site_constraints || 'No source references linked yet.'}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground mb-1">Project notes</div>
                          <div className="whitespace-pre-wrap">{activeProject.notes || 'No execution notes captured yet.'}</div>
                        </div>
                        <div className="space-y-2 border-t pt-3">
                          {(activeCosts.length > 0 ? activeCosts : []).map((cost) => (
                            <div key={cost.id} className="flex items-center justify-between gap-3">
                              <span className="text-muted-foreground">{cost.line_item}</span>
                              <span>{fmtCurrency(Number(cost.actual_amount || 0))} / {fmtCurrency(Number(cost.budget_amount || 0))}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Control checklist</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {['Commercial validation', 'Engineering release', 'Procurement ready', 'FAT signed', 'Installation done', 'Final handover'].map((item, index) => (
                      <div key={item} className="flex items-center justify-between rounded-md border p-2">
                        <span>{item}</span>
                        <Badge variant={index < 2 ? 'secondary' : 'outline'}>{index < 2 ? 'Ready' : 'Pending'}</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="execution" className="space-y-4">
              <div className="space-y-3">
                {activePhases.map((phase) => (
                  <Card key={phase.id}>
                    <CardHeader className="pb-2">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                        <div>
                          <CardTitle className="text-base">{phase.phase_number}. {phase.phase_name}</CardTitle>
                          <CardDescription>{phase.description}</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={phase.status === 'in_progress' ? 'secondary' : phase.status === 'completed' ? 'default' : 'outline'}>{phase.status}</Badge>
                          <span className="text-sm font-medium">{pct(Number(phase.completion_pct || 0))}</span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Progress value={Number(phase.completion_pct || 0)} />
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                        <div><span className="text-muted-foreground">Responsible:</span> <strong>{phase.responsible || 'TBD'}</strong></div>
                        <div><span className="text-muted-foreground">Planned:</span> <strong>{phase.planned_start || 'TBD'}  {phase.planned_end || 'TBD'}</strong></div>
                        <div><span className="text-muted-foreground">Budget:</span> <strong>{fmtCurrency(Number(phase.budget || 0))}</strong></div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div className="rounded-md border p-2"><div className="font-medium mb-1">Key tasks</div><ul className="list-disc pl-5 text-muted-foreground space-y-1">{(phase.key_tasks || []).map((task: string) => <li key={task}>{task}</li>)}</ul></div>
                        <div className="rounded-md border p-2"><div className="font-medium mb-1">Control points</div><ul className="list-disc pl-5 text-muted-foreground space-y-1">{(phase.control_points || []).map((point: string) => <li key={point}>{point}</li>)}</ul></div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="milestones" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><ArrowRight className="h-4 w-4 text-primary" /> Payment and milestone control</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left border-b">
                          <th className="py-2 pr-4">Milestone</th>
                          <th className="py-2 pr-4">Planned date</th>
                          <th className="py-2 pr-4">Payment</th>
                          <th className="py-2 pr-4">Status</th>
                          <th className="py-2 pr-4">Responsible</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeMilestones.map((milestone) => (
                          <tr key={milestone.id} className="border-b">
                            <td className="py-3 pr-4">{milestone.title}</td>
                            <td className="py-3 pr-4">{milestone.planned_date || 'TBD'}</td>
                            <td className="py-3 pr-4">{fmtCurrency(Number(milestone.payment_amount || 0))}  {milestone.payment_pct || 0}%</td>
                            <td className="py-3 pr-4"><Badge variant={milestone.is_paid ? 'default' : milestone.status === 'completed' ? 'secondary' : 'outline'}>{milestone.is_paid ? 'Paid' : milestone.status}</Badge></td>
                            <td className="py-3 pr-4">{milestone.responsible || 'TBD'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="customer-points" className="space-y-4">
              {renderProjectPointPanel(
                'customer_pending',
                'Customer-Ingecart pending points',
                'Follow-up list between customer and Ingecart with editable status, score, prepared action and ready-to-use management content.',
                activeCustomerPendingPoints,
              )}
            </TabsContent>

            <TabsContent value="project-points" className="space-y-4">
              {renderProjectPointPanel(
                'project_management',
                'Project management control points',
                'Internal control board for execution, dependencies, key dates, commissioning readiness and corrective actions.',
                activeProjectManagementPoints,
              )}
            </TabsContent>

            <TabsContent value="issues" className="space-y-4">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {activeRisks.map((risk) => (
                  <Card key={risk.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base">{risk.risk_title}</CardTitle>
                        <Badge variant={risk.status === 'closed' ? 'secondary' : 'destructive'}>{risk.status}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div>{risk.description}</div>
                      <div className="flex gap-2 flex-wrap">
                        <Badge variant="outline">{risk.category}</Badge>
                        <Badge variant="outline">Probability {risk.probability}</Badge>
                        <Badge variant="outline">Impact {risk.impact}</Badge>
                        <Badge variant="outline">Score {risk.risk_score}</Badge>
                      </div>
                      <div className="rounded-md border bg-muted/20 p-3">
                        <div className="font-medium mb-1">Mitigation</div>
                        <div className="text-muted-foreground">{risk.mitigation_action}</div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="docs" className="space-y-4">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Mandatory gate approvals</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {activeGates.map((gate) => (
                      <div key={gate.id} className="rounded-md border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{gate.gate_number}  {gate.gate_name}</span>
                          <Badge variant={gate.status === 'passed' ? 'default' : 'outline'}>{gate.status}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground mt-2">{gate.description}</div>
                        <div className="text-xs mt-2">Planned: {gate.planned_date || 'TBD'}  Owner: {gate.responsible || 'TBD'}</div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Wrench className="h-4 w-4 text-primary" /> Project support packages</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="rounded-md border p-3"><div className="font-medium mb-1">Engineering documents</div><div className="text-muted-foreground">Layouts, wiring diagrams, BOM, FAT procedure, installation manual.</div></div>
                    <div className="rounded-md border p-3"><div className="font-medium mb-1">Commercial package</div><div className="text-muted-foreground">PO, contract, payment milestones, warranty conditions and shipping plan.</div></div>
                    <div className="rounded-md border p-3"><div className="font-medium mb-1">Field execution package</div><div className="text-muted-foreground">Site access checklist, installation schedule, commissioning plan and punch-list register.</div></div>
                    <div className="rounded-md border p-3"><div className="font-medium mb-1">Procurement and shipping</div><div className="text-muted-foreground">Supplier confirmations, customs docs, freight traceability, delivery windows.</div></div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
