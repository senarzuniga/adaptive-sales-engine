import * as XLSX from 'xlsx';

export type ProjectPointPanel = 'customer_pending' | 'project_management';
export type ProjectPointStatus = 'pending' | 'in_progress' | 'confirmed' | 'blocked' | 'closed';
export type ProjectPointPriority = 'critical' | 'high' | 'medium' | 'low' | 'na';

export interface ProjectPointRecord {
  id: string;
  project_id: string;
  panel: ProjectPointPanel;
  number: number;
  title: string;
  description: string;
  owner: string;
  due_date: string;
  status: ProjectPointStatus;
  priority: ProjectPointPriority;
  action_taken: string;
  suggested_action: string;
  suggested_content: string;
  score: number;
  source_type: string;
  source_ref: string;
  ai_generated: boolean;
  created_at: string;
  updated_at: string;
}

type GenericRow = Record<string, unknown>;

export const PROJECT_POINT_STATUSES: ProjectPointStatus[] = ['pending', 'in_progress', 'confirmed', 'blocked', 'closed'];
export const PROJECT_POINT_PRIORITIES: ProjectPointPriority[] = ['critical', 'high', 'medium', 'low', 'na'];

const text = (value: unknown) => String(value || '').trim();
const num = (value: unknown) => Number(value || 0);
const today = () => new Date().toISOString().slice(0, 10);
const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, Math.round(value)));
const safeFile = (value: string) => value.replace(/[<>:"/|?*]+/g, '_').replace(/\s+/g, '_').trim() || 'project';
const safeSheet = (value: string) => value.replace(/[/?*:]/g, ' ').replaceAll('[', ' ').replaceAll(']', ' ').replace(/\s+/g, ' ').trim().slice(0, 31) || 'Hoja';
const dateValue = (value: unknown) => {
  const normalized = text(value);
  if (!normalized) return '';
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? normalized : parsed.toISOString().slice(0, 10);
};

function scorePoint(priority: ProjectPointPriority, status: ProjectPointStatus, dueDate?: string) {
  let score = ({ critical: 90, high: 75, medium: 58, low: 40, na: 20 } as const)[priority] || 20;
  score += ({ pending: 10, in_progress: 6, blocked: 18, confirmed: -18, closed: -32 } as const)[status] || 0;
  const normalized = dateValue(dueDate);
  if (normalized) {
    const diffDays = Math.round((new Date(normalized).getTime() - new Date(today()).getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0 && !['confirmed', 'closed'].includes(status)) score += 18;
    else if (diffDays <= 3 && !['confirmed', 'closed'].includes(status)) score += 12;
    else if (diffDays <= 7 && !['confirmed', 'closed'].includes(status)) score += 6;
  }
  return clamp(score);
}

function statusFromSource(value: unknown): ProjectPointStatus {
  const normalized = text(value).toLowerCase();
  if (['completed', 'confirmed', 'passed', 'paid'].includes(normalized)) return 'confirmed';
  if (['blocked', 'on-hold', 'on hold'].includes(normalized)) return 'blocked';
  if (['in-progress', 'in progress', 'active'].includes(normalized)) return 'in_progress';
  if (['closed', 'cancelled', 'canceled'].includes(normalized)) return 'closed';
  return 'pending';
}

function priorityFromRisk(value: unknown): ProjectPointPriority {
  const normalized = text(value).toLowerCase();
  if (['critical', 'high'].includes(normalized)) return normalized as ProjectPointPriority;
  if (['medium', 'low'].includes(normalized)) return normalized as ProjectPointPriority;
  return 'medium';
}

function priorityLabel(priority: ProjectPointPriority, language: 'es' | 'en') {
  const es = { critical: 'CRITICA', high: 'ALTA', medium: 'MEDIA', low: 'BAJA', na: 'N/A' } as const;
  const en = { critical: 'CRITICAL', high: 'HIGH', medium: 'MEDIUM', low: 'LOW', na: 'N/A' } as const;
  return language === 'es' ? es[priority] : en[priority];
}

function statusLabel(status: ProjectPointStatus, language: 'es' | 'en') {
  const es = { pending: 'PENDIENTE', in_progress: 'EN CURSO', confirmed: 'CONFIRMADO', blocked: 'BLOQUEADO', closed: 'CERRADO' } as const;
  const en = { pending: 'PENDING', in_progress: 'IN PROGRESS', confirmed: 'CONFIRMED', blocked: 'BLOCKED', closed: 'CLOSED' } as const;
  return language === 'es' ? es[status] : en[status];
}

function buildActionTaken(panel: ProjectPointPanel, title: string, status: ProjectPointStatus, owner: string) {
  if (status === 'confirmed') return `CONFIRMADO POR ${text(owner || 'EQUIPO')}`;
  if (status === 'blocked') return panel === 'customer_pending' ? 'A ESPERA DE CONFIRMACION DEL CLIENTE' : 'RIESGO BLOQUEADO - ESCALAR INTERNAMENTE';
  if (status === 'in_progress') return panel === 'customer_pending' ? 'SEGUIMIENTO EN CURSO CON CLIENTE' : 'SEGUIMIENTO INTERNO CON RESPONSABLE';
  return panel === 'customer_pending'
    ? `SOLICITAR CONFIRMACION: ${title.toUpperCase()}`
    : `PREPARAR Y EJECUTAR: ${title.toUpperCase()}`;
}

function buildSuggestedAction(panel: ProjectPointPanel, title: string, _description: string, owner: string, dueDate: string) {
  const due = dateValue(dueDate) || 'TBD';
  if (panel === 'customer_pending') {
    return `Contact ${owner || 'customer + Ingecart owner'} and close the point "${title}" before ${due}. Prepare the exact question, expected evidence and required approval path.`;
  }
  return `Drive the internal project task "${title}" with ${owner || 'project owner'} before ${due}. Confirm dependencies, next deliverable and closure evidence.`;
}

function buildSuggestedContent(panel: ProjectPointPanel, title: string, description: string, owner: string) {
  if (panel === 'customer_pending') {
    return `Customer coordination:
- Point: ${title}
- Why it matters: ${description}
- Owner: ${owner || 'Customer / Ingecart'}
- Ask for the missing data, confirmation or approval and register the answer in the project log.`;
  }
  return `Project control:
- Task: ${title}
- Execution focus: ${description}
- Owner: ${owner || 'Project team'}
- Confirm readiness, blockers, next action and evidence of completion.`;
}

function sortPoints(points: ProjectPointRecord[]) {
  const priorityRank: Record<ProjectPointPriority, number> = { critical: 0, high: 1, medium: 2, low: 3, na: 4 };
  const statusRank: Record<ProjectPointStatus, number> = { confirmed: 0, closed: 0, blocked: 1, pending: 1, in_progress: 1 };
  return points
    .slice()
    .sort((a, b) => {
      const groupDiff = statusRank[a.status] - statusRank[b.status];
      if (groupDiff !== 0) return groupDiff;
      const prioDiff = priorityRank[a.priority] - priorityRank[b.priority];
      if (prioDiff !== 0) return prioDiff;
      const dateA = dateValue(a.due_date);
      const dateB = dateValue(b.due_date);
      if (dateA && dateB) return dateA.localeCompare(dateB);
      if (dateA) return -1;
      if (dateB) return 1;
      return text(a.title).localeCompare(text(b.title));
    })
    .map((point, index) => ({
      ...point,
      number: index + 1,
      score: scorePoint(point.priority, point.status, point.due_date),
      action_taken: text(point.action_taken) || buildActionTaken(point.panel, point.title, point.status, point.owner),
      suggested_action: text(point.suggested_action) || buildSuggestedAction(point.panel, point.title, point.description, point.owner, point.due_date),
      suggested_content: text(point.suggested_content) || buildSuggestedContent(point.panel, point.title, point.description, point.owner),
    }));
}

export function normalizeProjectPoints(points: ProjectPointRecord[]) {
  return sortPoints(points.map((point) => ({
    ...point,
    due_date: dateValue(point.due_date),
    status: PROJECT_POINT_STATUSES.includes(point.status) ? point.status : 'pending',
    priority: PROJECT_POINT_PRIORITIES.includes(point.priority) ? point.priority : 'medium',
    updated_at: text(point.updated_at) || new Date().toISOString(),
  })));
}

function createPoint(seed: Partial<ProjectPointRecord> & Pick<ProjectPointRecord, 'project_id' | 'panel' | 'title' | 'description'>): ProjectPointRecord {
  const now = new Date().toISOString();
  const status = seed.status || 'pending';
  const priority = seed.priority || 'medium';
  const owner = text(seed.owner) || 'TBD';
  const dueDate = dateValue(seed.due_date);
  const panel = seed.panel;
  const title = text(seed.title);
  const description = text(seed.description);
  return {
    id: seed.id || (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `point-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    project_id: seed.project_id,
    panel,
    number: 0,
    title,
    description,
    owner,
    due_date: dueDate,
    status,
    priority,
    action_taken: text(seed.action_taken) || buildActionTaken(panel, title, status, owner),
    suggested_action: text(seed.suggested_action) || buildSuggestedAction(panel, title, description, owner, dueDate),
    suggested_content: text(seed.suggested_content) || buildSuggestedContent(panel, title, description, owner),
    score: scorePoint(priority, status, dueDate),
    source_type: text(seed.source_type) || 'manual',
    source_ref: text(seed.source_ref),
    ai_generated: seed.ai_generated !== false,
    created_at: text(seed.created_at) || now,
    updated_at: text(seed.updated_at) || now,
  };
}

function uniquePoints(points: ProjectPointRecord[]) {
  const map = new Map<string, ProjectPointRecord>();
  points.forEach((point) => {
    const key = `${point.panel}::${text(point.title).toLowerCase()}::${text(point.source_ref).toLowerCase()}`;
    if (!map.has(key)) map.set(key, point);
  });
  return Array.from(map.values());
}

function requirementsToPoints(project: GenericRow, panel: ProjectPointPanel) {
  const raw = [text(project.customer_requirements), text(project.dependencies)].filter(Boolean).join('\n');
  return raw
    .split(/\r?\n|[.;]+/)
    .map((line) => text(line))
    .filter(Boolean)
    .slice(0, 6)
    .map((line, index) => createPoint({
      project_id: String(project.id),
      panel,
      title: panel === 'customer_pending' ? `Validate requirement ${index + 1}` : `Manage dependency ${index + 1}`,
      description: line,
      owner: panel === 'customer_pending' ? 'Customer / PM' : 'PM',
      due_date: dateValue(project.delivery_deadline),
      priority: 'high',
      source_type: 'project_context',
      source_ref: panel === 'customer_pending' ? 'customer_requirements' : 'dependencies',
    }));
}

export function buildCustomerPendingPoints(project: GenericRow, milestones: GenericRow[], risks: GenericRow[], gates: GenericRow[]) {
  const points: ProjectPointRecord[] = [];
  gates
    .filter((gate) => !['passed', 'completed'].includes(text(gate.status).toLowerCase()))
    .forEach((gate) => {
      points.push(createPoint({
        project_id: String(project.id),
        panel: 'customer_pending',
        title: `Confirm ${text(gate.gate_name || gate.gate_number || 'project gate')}`,
        description: text(gate.description) || 'Customer approval or confirmation pending for the current gate.',
        owner: text(gate.responsible) || 'PM',
        due_date: gate.planned_date,
        status: statusFromSource(gate.status),
        priority: ['G4', 'G5'].includes(text(gate.gate_number).toUpperCase()) ? 'critical' : 'high',
        source_type: 'project_gate',
        source_ref: text(gate.gate_number || gate.id),
      }));
    });
  milestones
    .filter((milestone) => !milestone.is_paid || text(milestone.status).toLowerCase() !== 'completed')
    .forEach((milestone) => {
      points.push(createPoint({
        project_id: String(project.id),
        panel: 'customer_pending',
        title: `Align milestone ${text(milestone.title)}`,
        description: `Customer-facing milestone pending. Planned date ${dateValue(milestone.planned_date) || 'TBD'} and payment ${num(milestone.payment_amount || 0)}.`.trim(),
        owner: text(milestone.responsible) || 'PM',
        due_date: milestone.planned_date,
        status: milestone.is_paid ? 'confirmed' : statusFromSource(milestone.status),
        priority: num(milestone.payment_amount || 0) > 0 ? 'high' : 'medium',
        source_type: 'project_milestone',
        source_ref: text(milestone.title || milestone.id),
      }));
    });
  risks
    .filter((risk) => text(risk.status).toLowerCase() !== 'closed')
    .forEach((risk) => {
      points.push(createPoint({
        project_id: String(project.id),
        panel: 'customer_pending',
        title: `Resolve customer dependency: ${text(risk.risk_title)}`,
        description: text(risk.description) || text(risk.mitigation_action) || 'Customer-side dependency requires confirmation.',
        owner: text(risk.owner || risk.responsible) || 'PM',
        due_date: risk.target_date || project.delivery_deadline,
        status: statusFromSource(risk.status),
        priority: priorityFromRisk(risk.impact || risk.priority || (num(risk.risk_score) > 70 ? 'high' : 'medium')), 
        source_type: 'project_risk',
        source_ref: text(risk.risk_title || risk.id),
      }));
    });
  points.push(...requirementsToPoints(project, 'customer_pending'));
  return normalizeProjectPoints(uniquePoints(points));
}

export function buildProjectManagementPoints(project: GenericRow, phases: GenericRow[], milestones: GenericRow[], risks: GenericRow[], gates: GenericRow[], costs: GenericRow[]) {
  const points: ProjectPointRecord[] = [];
  phases
    .filter((phase) => text(phase.status).toLowerCase() !== 'completed')
    .forEach((phase) => {
      points.push(createPoint({
        project_id: String(project.id),
        panel: 'project_management',
        title: `Drive ${text(phase.phase_name)}`,
        description: text(phase.description) || `Execute phase ${text(phase.phase_name)} and close the defined control points.`,
        owner: text(phase.responsible) || 'PM',
        due_date: phase.planned_end,
        status: statusFromSource(phase.status),
        priority: text(phase.status).toLowerCase() === 'in_progress' ? 'high' : 'medium',
        source_type: 'project_phase',
        source_ref: text(phase.phase_name || phase.id),
      }));
    });
  gates
    .filter((gate) => !['passed', 'completed'].includes(text(gate.status).toLowerCase()))
    .forEach((gate) => {
      points.push(createPoint({
        project_id: String(project.id),
        panel: 'project_management',
        title: `Prepare gate ${text(gate.gate_number || gate.gate_name)}`,
        description: text(gate.description) || 'Prepare internal evidence required to pass the next gate.',
        owner: text(gate.responsible) || 'PM',
        due_date: gate.planned_date,
        status: statusFromSource(gate.status),
        priority: 'high',
        source_type: 'project_gate',
        source_ref: text(gate.gate_number || gate.id),
      }));
    });
  milestones
    .filter((milestone) => text(milestone.status).toLowerCase() !== 'completed' || milestone.is_paid === false)
    .forEach((milestone) => {
      points.push(createPoint({
        project_id: String(project.id),
        panel: 'project_management',
        title: `Secure milestone ${text(milestone.title)}`,
        description: `Prepare deliverables and evidence for ${text(milestone.title)}. Responsible ${text(milestone.responsible) || 'TBD'}.`,
        owner: text(milestone.responsible) || 'PM',
        due_date: milestone.planned_date,
        status: milestone.is_paid ? 'confirmed' : statusFromSource(milestone.status),
        priority: num(milestone.payment_amount || 0) > 0 ? 'high' : 'medium',
        source_type: 'project_milestone',
        source_ref: text(milestone.title || milestone.id),
      }));
    });
  risks
    .filter((risk) => text(risk.status).toLowerCase() !== 'closed')
    .forEach((risk) => {
      points.push(createPoint({
        project_id: String(project.id),
        panel: 'project_management',
        title: `Mitigate ${text(risk.risk_title)}`,
        description: text(risk.mitigation_action) || text(risk.description) || 'Execute the mitigation plan and escalate blockers.',
        owner: text(risk.owner || risk.responsible) || 'PM',
        due_date: risk.target_date || project.delivery_deadline,
        status: statusFromSource(risk.status),
        priority: priorityFromRisk(risk.impact || risk.priority || 'high'),
        source_type: 'project_risk',
        source_ref: text(risk.risk_title || risk.id),
      }));
    });
  costs
    .filter((cost) => num(cost.actual_amount) > num(cost.budget_amount))
    .forEach((cost) => {
      points.push(createPoint({
        project_id: String(project.id),
        panel: 'project_management',
        title: `Recover cost deviation: ${text(cost.line_item || cost.category)}`,
        description: `Actual amount ${num(cost.actual_amount)} exceeds budget ${num(cost.budget_amount)}. Prepare corrective action.`,
        owner: text(cost.owner) || 'PM / Finance',
        due_date: project.delivery_deadline,
        status: 'pending',
        priority: 'critical',
        source_type: 'project_cost',
        source_ref: text(cost.line_item || cost.category || cost.id),
      }));
    });
  points.push(...requirementsToPoints(project, 'project_management'));
  return normalizeProjectPoints(uniquePoints(points));
}

export function createManualProjectPoint(projectId: string, panel: ProjectPointPanel) {
  return normalizeProjectPoints([createPoint({
    project_id: projectId,
    panel,
    title: panel === 'customer_pending' ? 'New customer pending point' : 'New project management point',
    description: panel === 'customer_pending' ? 'Describe the pending customer-Ingecart coordination point.' : 'Describe the internal project management control point.',
    owner: 'PM',
    due_date: '',
    priority: 'medium',
    ai_generated: false,
    source_type: 'manual',
    source_ref: 'manual',
  })])[0];
}

function setCell(sheet: XLSX.WorkSheet, ref: string, value: string | number, format?: string) {
  const cell: XLSX.CellObject = typeof value === 'number' ? { t: 'n', v: value } : { t: 's', v: value };
  if (format) cell.z = format;
  sheet[ref] = cell;
}

export function buildProjectDecisionWorkbook(input: { project: GenericRow; points: ProjectPointRecord[]; panel: ProjectPointPanel; language?: 'es' | 'en' }) {
  const language = input.language || 'es';
  const workbook = XLSX.utils.book_new();
  const sheet: XLSX.WorkSheet = {};
  const points = normalizeProjectPoints(input.points.filter((point) => point.panel === input.panel));
  const confirmed = points.filter((point) => ['confirmed', 'closed'].includes(point.status)).length;
  const blocked = points.filter((point) => point.status === 'blocked').length;
  const open = points.filter((point) => !['confirmed', 'closed'].includes(point.status)).length;
  const critical = points.filter((point) => !['confirmed', 'closed'].includes(point.status) && point.priority === 'critical').length;
  const title = input.panel === 'customer_pending'
    ? (language === 'es' ? 'Registro de Decisiones' : 'Decision Log')
    : (language === 'es' ? 'Registro de Gestion de Proyecto' : 'Project Management Log');
  const docLabel = input.panel === 'customer_pending'
    ? (language === 'es' ? 'Registro de decisiones del proyecto' : 'Project decision log')
    : (language === 'es' ? 'Registro de gestion del proyecto' : 'Project management log');

  setCell(sheet, 'A1', title);
  setCell(sheet, 'A3', language === 'es' ? 'Proyecto' : 'Project');
  setCell(sheet, 'B3', text(input.project.title || input.project.project_number));
  setCell(sheet, 'C3', language === 'es' ? 'Cliente' : 'Customer');
  setCell(sheet, 'D3', text(input.project.customer_name || '?'));
  setCell(sheet, 'A4', language === 'es' ? 'Documento' : 'Document');
  setCell(sheet, 'B4', docLabel);
  setCell(sheet, 'C4', language === 'es' ? 'Fecha' : 'Date');
  setCell(sheet, 'D4', today());
  setCell(sheet, 'A5', language === 'es' ? 'Responsable' : 'Owner');
  setCell(sheet, 'B5', text(input.project.project_manager || input.project.owner || 'Project team'));
  setCell(sheet, 'C5', 'Rev.');
  setCell(sheet, 'D5', '1');
  setCell(sheet, 'A6', language === 'es' ? 'Resumen' : 'Summary');
  setCell(sheet, 'B6', `${confirmed} ${language === 'es' ? 'confirmados' : 'confirmed'} | ${open} ${language === 'es' ? 'pendientes' : 'pending'} | ${blocked} ${language === 'es' ? 'bloqueados' : 'blocked'}`);
  setCell(sheet, 'C6', language === 'es' ? 'Abiertos' : 'Open');
  setCell(sheet, 'D6', `${open} ${language === 'es' ? 'abiertos' : 'open'} | ${critical} ${language === 'es' ? 'criticos' : 'critical'}`);

  const headers = language === 'es'
    ? ['#', 'Punto de decision', 'Descripcion', 'Responsable', 'Fecha limite / confirmacion', 'Estado', 'Prioridad', 'Accion realizada', 'Score', 'Accion preparada', 'Contenido preparado']
    : ['#', 'Decision point', 'Description', 'Owner', 'Due / confirmation date', 'Status', 'Priority', 'Action taken', 'Score', 'Prepared action', 'Prepared content'];
  headers.forEach((header, index) => setCell(sheet, `${XLSX.utils.encode_col(index)}8`, header));
  points.forEach((point, index) => {
    const row = index + 9;
    setCell(sheet, `A${row}`, point.number);
    setCell(sheet, `B${row}`, point.title);
    setCell(sheet, `C${row}`, point.description);
    setCell(sheet, `D${row}`, point.owner);
    setCell(sheet, `E${row}`, point.due_date || (language === 'es' ? 'Por definir' : 'TBD'));
    setCell(sheet, `F${row}`, statusLabel(point.status, language));
    setCell(sheet, `G${row}`, priorityLabel(point.priority, language));
    setCell(sheet, `H${row}`, point.action_taken.toUpperCase());
    setCell(sheet, `I${row}`, point.score, '0');
    setCell(sheet, `J${row}`, point.suggested_action);
    setCell(sheet, `K${row}`, point.suggested_content);
  });
  const lastRow = Math.max(points.length + 8, 9);
  sheet['!cols'] = [
    { wch: 6 }, { wch: 30 }, { wch: 50 }, { wch: 18 }, { wch: 18 }, { wch: 15 }, { wch: 13 }, { wch: 34 }, { wch: 8 }, { wch: 42 }, { wch: 46 },
  ];
  sheet['!ref'] = `A1:K${lastRow}`;
  XLSX.utils.book_append_sheet(workbook, sheet, safeSheet(language === 'es' ? 'Registro' : 'Decision Log'));
  return workbook;
}

export function buildProjectDecisionWorkbookFileName(project: GenericRow, panel: ProjectPointPanel, language: 'es' | 'en' = 'es') {
  const projectName = safeFile(text(project.title || project.project_number || 'Proyecto'));
  if (panel === 'customer_pending') {
    return language === 'es'
      ? `Registro_Decisiones_${projectName}_INGECART_ES.xlsx`
      : `Decision_Log_${projectName}_INGECART_EN.xlsx`;
  }
  return language === 'es'
    ? `Registro_Gestion_${projectName}_INGECART_ES.xlsx`
    : `Project_Management_Log_${projectName}_INGECART_EN.xlsx`;
}

export async function downloadProjectDecisionWorkbook(input: { project: GenericRow; points: ProjectPointRecord[]; panel: ProjectPointPanel; language?: 'es' | 'en' }) {
  const language = input.language || 'es';
  const workbook = buildProjectDecisionWorkbook({ ...input, language });
  const fileName = buildProjectDecisionWorkbookFileName(input.project, input.panel, language);
  const content = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([content], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const link = window.document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
  return { fileName };
}
