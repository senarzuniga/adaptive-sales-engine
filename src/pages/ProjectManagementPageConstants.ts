export const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
export const fmtPct = (n: number) => `${n.toFixed(1)}%`;

export const PROJECT_TYPES = ['machine', 'line', 'service', 'retrofit', 'software'];
export const COMPLEXITY_LEVELS = ['low', 'medium', 'high'];
export const RISK_LEVELS = ['low', 'medium', 'high'];
export const DURATION_CATS = ['short', 'medium', 'long'];
export const PROJECT_STATUSES = ['planning', 'active', 'on-hold', 'completed', 'cancelled'];
export const PHASE_STATUSES = ['pending', 'in-progress', 'completed', 'blocked'];
export const COST_CATEGORIES = ['engineering', 'procurement', 'labor', 'travel', 'subcontracting', 'overhead', 'contingency'];
export const GATE_DEFINITIONS = [
  { number: 'G0', name: 'Contract Validation' },
  { number: 'G1', name: 'Engineering Approval' },
  { number: 'G2', name: 'Procurement Readiness' },
  { number: 'G3', name: 'FAT Readiness' },
  { number: 'G4', name: 'Shipment Approval' },
  { number: 'G5', name: 'SAT / Acceptance' },
  { number: 'G6', name: 'Financial Closure' },
];

export const HEALTH_COLOR = (s: number) => s >= 80 ? 'text-primary' : s >= 60 ? 'text-yellow-600' : s >= 40 ? 'text-orange-500' : 'text-destructive';
export const STATUS_VARIANT = (s: string) => {
  switch (s) {
    case 'completed': return 'default';
    case 'in-progress': case 'active': return 'secondary';
    case 'blocked': case 'on-hold': return 'destructive';
    default: return 'outline';
  }
};
