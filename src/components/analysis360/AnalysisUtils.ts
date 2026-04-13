export function groupBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const key = keyFn(item) || 'Unknown';
    (acc[key] = acc[key] || []).push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

export const fmt = (n: number) =>
  `€${n.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export const fmtAxis = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `€${(n / 1_000).toFixed(0)}K`;
  return `€${n}`;
};

export const COLORS = [
  'hsl(215,80%,55%)', 'hsl(150,60%,45%)', 'hsl(35,90%,55%)', 'hsl(0,70%,55%)',
  'hsl(280,60%,55%)', 'hsl(180,50%,45%)', 'hsl(60,70%,50%)', 'hsl(330,60%,55%)',
  'hsl(200,70%,50%)', 'hsl(120,50%,40%)', 'hsl(45,80%,50%)', 'hsl(10,80%,50%)',
];

export const pctColor = (pct: number) =>
  pct >= 100 ? 'text-success' : pct >= 70 ? 'text-warning' : 'text-destructive';

export const pctBadge = (pct: number) =>
  pct >= 100 ? 'On Track' : pct >= 70 ? 'At Risk' : 'Behind';
