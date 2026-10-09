import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import {
  buildCustomerPendingPoints,
  buildProjectDecisionWorkbook,
  buildProjectDecisionWorkbookFileName,
  buildProjectManagementPoints,
  normalizeDeliveryText,
} from '@/lib/projectDecisionLog';

describe('project decision log', () => {
  const project = {
    id: 'prj-1',
    project_number: 'PRJ-2026-101',
    title: 'Auxiliar conveyor upgrade',
    customer_name: 'Auxiliar',
    delivery_deadline: '2026-11-15',
    customer_requirements: 'Approve electrical layout. Confirm startup window.',
    dependencies: 'Civil works readiness. Customer access list.',
    project_manager: 'PM Ingecart',
  };

  const phases = [
    { id: 'ph-1', project_id: 'prj-1', phase_name: 'Engineering', description: 'Release layout and drawings', status: 'in_progress', planned_end: '2026-10-01', responsible: 'Engineering' },
  ];

  const milestones = [
    { id: 'ms-1', project_id: 'prj-1', title: 'Design freeze', status: 'pending', planned_date: '2026-10-05', payment_amount: 25000, payment_pct: 25, is_paid: false, responsible: 'PM' },
  ];

  const risks = [
    { id: 'rk-1', project_id: 'prj-1', risk_title: 'Site access', description: 'Need final customer access plan', mitigation_action: 'Validate access plan', impact: 'high', risk_score: 72, owner: 'PM', status: 'open', target_date: '2026-09-28' },
  ];

  const gates = [
    { id: 'gt-1', project_id: 'prj-1', gate_number: 'G4', gate_name: 'FAT approval', status: 'pending', planned_date: '2026-10-20', description: 'Customer FAT approval required', responsible: 'QA' },
  ];

  const costs = [
    { id: 'ct-1', project_id: 'prj-1', category: 'engineering', line_item: 'Engineering deviation', budget_amount: 15000, actual_amount: 18000, owner: 'PM / Finance' },
  ];

  it('generates customer and project control points with scoring', () => {
    const customerPoints = buildCustomerPendingPoints(project, milestones, risks, gates);
    const managementPoints = buildProjectManagementPoints(project, phases, milestones, risks, gates, costs);

    expect(customerPoints.length).toBeGreaterThanOrEqual(4);
    expect(customerPoints.some((point) => point.title.includes('Confirm FAT approval'))).toBe(true);
    expect(customerPoints.some((point) => point.priority === 'critical')).toBe(true);
    expect(customerPoints.every((point) => point.score >= 0 && point.score <= 100)).toBe(true);

    expect(managementPoints.length).toBeGreaterThanOrEqual(4);
    expect(managementPoints.some((point) => point.title.includes('Recover cost deviation'))).toBe(true);
    expect(managementPoints.some((point) => point.title.includes('Drive Engineering'))).toBe(true);
  });

  it('builds a workbook and sanitized filename for the pending-points export', () => {
    const points = buildCustomerPendingPoints(project, milestones, risks, gates);
    const workbook = buildProjectDecisionWorkbook({
      project,
      points,
      panel: 'customer_pending',
      language: 'es',
    });

    expect(workbook.SheetNames).toEqual(['Registro de decisiones']);
    expect(workbook.Sheets['Registro de decisiones'].E4.v).toBe('Registro de Decisiones');
    expect(workbook.Sheets['Registro de decisiones'].C12.v).toBe('Auxiliar conveyor upgrade');
    expect(workbook.Sheets['Registro de decisiones'].A17.v).toBe('#');
    expect(workbook.Sheets['Registro de decisiones'].A18.v).toBe('CONFIRMADAS');

    const fileName = buildProjectDecisionWorkbookFileName({
      title: 'Auxiliar / Site Upgrade',
    }, 'customer_pending', 'es');
    expect(fileName).toBe('Registro_Decisiones_Auxiliar___Site_Upgrade_INGECART_ES.xlsx');

    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
    expect(buffer.byteLength).toBeGreaterThan(1500);
  });

  it('keeps bilingual delivery text normalized and accent-safe', () => {
    expect(normalizeDeliveryText('  confirmar  la  línea  de  carga  del  camión  y  la  conexión  rápida  ', 'es')).toBe('Confirmar la línea de carga del camión y la conexión rápida');
    expect(normalizeDeliveryText('  final verification for the truck loading line  ', 'en')).toBe('Final verification for the truck loading line');
    expect(normalizeDeliveryText('  poner  deslizamiento  en  la  línea  de  carga  del  camión  para  evitar  problemas  con  los  palets  ', 'es')).toBe('Poner deslizamiento en la línea de carga del camión para evitar problemas con los palets');
  });
});
