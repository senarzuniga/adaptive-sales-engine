import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { fmt } from '@/components/analysis360/AnalysisUtils';
import { BarChart3, Clock, DollarSign, LineChart, Sparkles, Target } from 'lucide-react';
import type { CompanyProfile, LeadRecord, OpportunityRecord, OrderRecord, StrategyRecord } from '@/store/DataStore';

export interface ForecastDashboardProps {
  companyId?: string | null;
  company: CompanyProfile;
  orders: OrderRecord[];
  opportunities: OpportunityRecord[];
  offers: ForecastSourceRecord[];
  reports: Array<Record<string, unknown>>;
  leads: LeadRecord[];
  strategy: StrategyRecord[];
}

type BusinessLineKey = 'equipment' | 'afterSales';
type PeriodKey = 'quarter' | 'semester' | 'year';

type ForecastCell = { auto: number; manual: number | null };

type ForecastState = {
  excludedCandidates: string[];
  growthRatePct: number;
  oppConversionPct: number;
  offerConversionPct: number;
  leadConversionPct: number;
  hypotheses: string;
  bundleAdjustments: Record<PeriodKey, number>;
  overrides: Record<string, number | null>;
};

type ForecastCandidate = {
  id: string;
  source: 'Offer' | 'Opportunity' | 'Lead';
  name: string;
  line: BusinessLineKey;
  value: number;
  probability: number;
  period: PeriodKey;
  date: Date | null;
};

const STORAGE_PREFIX = 'acs_forecast_360_';
const PERIODS: Array<{ key: PeriodKey; label: string }> = [
  { key: 'quarter', label: 'Quarter' },
  { key: 'semester', label: 'Semester' },
  { key: 'year', label: 'Year' },
];
const BUSINESS_LINES: Array<{ key: BusinessLineKey; label: string; help: string }> = [
  { key: 'equipment', label: 'Venta de Equipos', help: 'Equipment sales, machinery and line supply' },
  { key: 'afterSales', label: 'Postventa y Servicios', help: 'After-sales, services, spare parts and support' },
];

const defaultState = (): ForecastState => ({
  excludedCandidates: [],
  growthRatePct: 8,
  oppConversionPct: 35,
  offerConversionPct: 70,
  leadConversionPct: 10,
  hypotheses: '',
  bundleAdjustments: { quarter: 0, semester: 0, year: 0 },
  overrides: {},
});

const storageKey = (companyId?: string | null) => `${STORAGE_PREFIX}${companyId || 'global'}`;
const normalizeText = (value: unknown) => String(value || '').toLowerCase();
const parseDate = (value: unknown) => {
  const text = String(value || '').trim();
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
};
const daysFromNow = (date: Date | null) => (date ? (date.getTime() - Date.now()) / 86400000 : null);
const sum = (values: number[]) => values.reduce((acc, value) => acc + value, 0);

const businessLineForText = (value: unknown): BusinessLineKey => {
  const text = normalizeText(value);
  if (/(after sales|after-sales|postventa|service|services|spare|maintenance|commissioning|sat|retrofit|training|support|warranty)/i.test(text)) {
    return 'afterSales';
  }
  return 'equipment';
};

const classifyCandidateLine = (candidate: { title: string; customer: string; scope: string; family: string; source: string }) =>
  businessLineForText([candidate.title, candidate.customer, candidate.scope, candidate.family, candidate.source].join(' '));

interface OpportunityDateRecord { decision_date?: string; expected_close_date?: string; updated_at?: string; }
const getOpportunityDate = (opp: OpportunityRecord & OpportunityDateRecord) => parseDate(opp.decision_date || opp.expected_close_date || opp.updated_at);
const getOfferDate = (offer: ForecastSourceRecord) => parseDate(offer.decision_date || offer.submitted_at || offer.updated_at);

const formatPct = (value: number) => `${value.toFixed(0)}%`;

export const ForecastDashboard = ({ companyId, company, orders, opportunities, offers, reports, leads, strategy }: ForecastDashboardProps) => {
  const [state, setState] = useState<ForecastState>(defaultState);

  useEffect(() => {
    if (!companyId) return;
    try {
      const raw = localStorage.getItem(storageKey(companyId));
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<ForecastState>;
      setState((prev) => ({
        ...prev,
        ...parsed,
        bundleAdjustments: { ...prev.bundleAdjustments, ...(parsed.bundleAdjustments || {}) },
        overrides: { ...prev.overrides, ...(parsed.overrides || {}) },
      }));
    } catch {
      setState(defaultState());
    }
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    localStorage.setItem(storageKey(companyId), JSON.stringify(state));
  }, [companyId, state]);

  const recentOrders = useMemo(() => orders.filter((order) => {
    const date = parseDate(order.poDate || order.firstOfferDate);
    if (!date) return true;
    return (Date.now() - date.getTime()) <= 365 * 86400000;
  }), [orders]);

  const historicalByLine = useMemo(() => {
    return BUSINESS_LINES.reduce<Record<BusinessLineKey, number>>((acc, line) => {
      acc[line.key] = recentOrders
        .filter((order) => businessLineForText([order.productFamily, order.scope, order.segment].join(' ')) === line.key)
        .reduce((total, order) => total + Number(order.sellingPrice || 0), 0);
      return acc;
    }, { equipment: 0, afterSales: 0 });
  }, [recentOrders]);

  const candidateRows = useMemo<ForecastCandidate[]>(() => {
    const offerCandidates = offers
      .filter((offer) => normalizeText(offer.status) !== 'won')
      .map((offer) => {
        const date = getOfferDate(offer);
        const dueInDays = daysFromNow(date);
        const period: PeriodKey = dueInDays != null && dueInDays <= 90 ? 'quarter' : dueInDays != null && dueInDays <= 180 ? 'semester' : 'year';
        return {
          id: `offer:${offer.id || offer.offer_number || offer.offerNumber}`,
          source: 'Offer' as const,
          name: `${offer.offer_number || offer.offerNumber || 'OFFER'} - ${offer.customer_name || offer.customerName || offer.title || 'Open offer'}`,
          line: classifyCandidateLine({
            title: String(offer.title || offer.project_description || ''),
            customer: String(offer.customer_name || offer.customerName || ''),
            scope: String(offer.project_description || offer.scope || ''),
            family: String(offer.product_family || offer.productFamily || ''),
            source: 'offer',
          }),
          value: Number(offer.contract_value || offer.contractValue || 0),
          probability: Number(offer.probability || 70),
          period,
          date,
        };
      });

    const oppCandidates = opportunities
      .filter((opp) => !['won', 'closed', 'lost', 'cancelled', 'canceled', 'declined'].includes(normalizeText(opp.status)))
      .map((opp) => {
        const date = getOpportunityDate(opp);
        const dueInDays = daysFromNow(date);
        const period: PeriodKey = dueInDays != null && dueInDays <= 90 ? 'quarter' : dueInDays != null && dueInDays <= 180 ? 'semester' : 'year';
        return {
          id: `opp:${opp.oppNumber}`,
          source: 'Opportunity' as const,
          name: `${opp.oppNumber} - ${opp.customerName || 'Opportunity'}`,
          line: classifyCandidateLine({
            title: `${opp.customerName || ''} ${opp.productFamily || ''}`,
            customer: String(opp.customerName || ''),
            scope: String(opp.scope || ''),
            family: String(opp.productFamily || ''),
            source: 'opportunity',
          }),
          value: Number(opp.estRevenue || 0),
          probability: Number(opp.contractProb || 50),
          period,
          date,
        };
      });

    const leadCandidates = leads
      .filter((lead) => Number(lead.estimatedValue || 0) > 0)
      .map((lead) => ({
        id: `lead:${lead.companyName}:${lead.email}`,
        source: 'Lead' as const,
        name: `${lead.companyName || lead.leadName || 'Lead'}`,
        line: businessLineForText([lead.notes, lead.sector, lead.companyName].join(' ')),
        value: Number(lead.estimatedValue || 0),
        probability: 10,
        period: 'year' as PeriodKey,
        date: null,
      }));

    return [...offerCandidates, ...oppCandidates, ...leadCandidates];
  }, [leads, opportunities, offers]);

  const includedCandidates = useMemo(() => candidateRows.filter((candidate) => !state.excludedCandidates.includes(candidate.id)), [candidateRows, state.excludedCandidates]);

  const weightedCandidateValue = (candidate: ForecastCandidate) => {
    const sourceFactor = candidate.source === 'Offer'
      ? state.offerConversionPct / 100
      : candidate.source === 'Opportunity'
        ? state.oppConversionPct / 100
        : state.leadConversionPct / 100;
    return candidate.value * (candidate.probability / 100) * sourceFactor;
  };

  const nearTermWeight = (limitDays: number) => includedCandidates
    .filter((candidate) => candidate.date && daysFromNow(candidate.date) != null && Number(daysFromNow(candidate.date)) <= limitDays)
    .reduce<Record<BusinessLineKey, number>>((acc, candidate) => {
      acc[candidate.line] += weightedCandidateValue(candidate);
      return acc;
    }, { equipment: 0, afterSales: 0 });

  const weights = useMemo(() => {
    const currentYearSold = BUSINESS_LINES.reduce<Record<BusinessLineKey, number>>((acc, line) => {
      acc[line.key] = recentOrders
        .filter((order) => businessLineForText([order.productFamily, order.scope, order.segment].join(' ')) === line.key)
        .reduce((total, order) => total + Number(order.sellingPrice || 0), 0);
      return acc;
    }, { equipment: 0, afterSales: 0 });

    const pipelineAnnual = includedCandidates.reduce<Record<BusinessLineKey, number>>((acc, candidate) => {
      acc[candidate.line] += weightedCandidateValue(candidate);
      return acc;
    }, { equipment: 0, afterSales: 0 });

    const growthFactor = 1 + (Number(state.growthRatePct || 0) / 100);
    const annualAuto = BUSINESS_LINES.reduce<Record<BusinessLineKey, number>>((acc, line) => {
      acc[line.key] = currentYearSold[line.key] * growthFactor + pipelineAnnual[line.key];
      return acc;
    }, { equipment: 0, afterSales: 0 });

    const quarterNearTerm = nearTermWeight(90);
    const semesterNearTerm = nearTermWeight(180);

    const forecast = BUSINESS_LINES.reduce<Record<BusinessLineKey, Record<PeriodKey, ForecastCell>>>((acc, line) => {
      const yearAuto = annualAuto[line.key];
      acc[line.key] = {
        quarter: { auto: yearAuto * 0.25 + quarterNearTerm[line.key] * 0.5, manual: state.overrides[`quarter:${line.key}`] ?? null },
        semester: { auto: yearAuto * 0.5 + semesterNearTerm[line.key] * 0.35, manual: state.overrides[`semester:${line.key}`] ?? null },
        year: { auto: yearAuto, manual: state.overrides[`year:${line.key}`] ?? null },
      };
      return acc;
    }, { equipment: {} as Record<PeriodKey, ForecastCell>, afterSales: {} as Record<PeriodKey, ForecastCell> });

    const totals = PERIODS.reduce<Record<PeriodKey, number>>((acc, period) => {
      const lineSum = BUSINESS_LINES.reduce((sumValue, line) => {
        const cell = forecast[line.key][period.key];
        return sumValue + (cell.manual ?? cell.auto);
      }, 0);
      acc[period.key] = lineSum + Number(state.bundleAdjustments[period.key] || 0);
      return acc;
    }, { quarter: 0, semester: 0, year: 0 });

    return { currentYearSold, pipelineAnnual, annualAuto, forecast, totals };
  }, [includedCandidates, recentOrders, state.bundleAdjustments, state.growthRatePct, state.oppConversionPct, state.offerConversionPct, state.leadConversionPct, state.overrides]);

  const updateManualValue = (period: PeriodKey, line: BusinessLineKey, value: string) => {
    setState((prev) => ({ ...prev, overrides: { ...prev.overrides, [`${period}:${line}`]: value === '' ? null : Number(value) } }));
  };

  const updateBundleAdjustment = (period: PeriodKey, value: string) => {
    setState((prev) => ({ ...prev, bundleAdjustments: { ...prev.bundleAdjustments, [period]: value === '' ? 0 : Number(value) } }));
  };

  const toggleCandidate = (candidateId: string) => {
    setState((prev) => ({
      ...prev,
      excludedCandidates: prev.excludedCandidates.includes(candidateId)
        ? prev.excludedCandidates.filter((id) => id !== candidateId)
        : [...prev.excludedCandidates, candidateId],
    }));
  };

  const autoHypotheses = useMemo(() => {
    const topCustomers = recentOrders
      .reduce<Record<string, number>>((acc, order) => {
        const key = order.customerName || 'Unknown customer';
        acc[key] = (acc[key] || 0) + Number(order.sellingPrice || 0);
        return acc;
      }, {});

    const topCustomerNames = Object.entries(topCustomers).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name]) => name);
    return [
      `Top customer concentration: ${topCustomerNames.join(', ') || 'no historical orders yet'}.`,
      `Open pipeline includes ${candidateRows.filter((candidate) => candidate.source === 'Offer').length} offers and ${candidateRows.filter((candidate) => candidate.source === 'Opportunity').length} opportunities that can be included or excluded.`,
      `Forecast uses ${state.growthRatePct.toFixed(0)}% annual growth plus source-specific conversion inputs.`,
      `Business split is based on the current mix between equipment sales and after-sales/services and can be edited manually.`,
    ];
  }, [candidateRows, recentOrders, state.growthRatePct]);

  const score = useMemo(() => {
    const annualTotal = weights.totals.year;
    const pipelineCoverage = annualTotal > 0 ? ((weights.pipelineAnnual.equipment + weights.pipelineAnnual.afterSales) / annualTotal) * 100 : 0;
    const balance = Math.max(0, 100 - Math.abs(weights.currentYearSold.equipment - weights.currentYearSold.afterSales) / Math.max(weights.currentYearSold.equipment + weights.currentYearSold.afterSales, 1) * 100);
    return Math.max(0, Math.min(100, (pipelineCoverage * 0.6) + (balance * 0.4)));
  }, [weights]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-1"><Target className="h-4 w-4 text-primary" /><span className="text-xs text-muted-foreground">Forecast score</span></div>
            <p className="text-2xl font-bold text-foreground">{score.toFixed(0)}/100</p>
            <Progress value={score} className="h-1.5 mt-2" />
          </CardContent>
        </Card>
        {PERIODS.map((period) => (
          <Card key={period.key}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2 mb-1"><DollarSign className="h-4 w-4 text-primary" /><span className="text-xs text-muted-foreground">{period.label} forecast</span></div>
              <p className="text-2xl font-bold text-foreground">{fmt(weights.totals[period.key])}</p>
              <p className="text-xs text-muted-foreground mt-1">Editable bundle total</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><LineChart className="h-4 w-4" /> Forecast dashboard</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Annual growth %</Label>
              <Input type="number" value={state.growthRatePct} onChange={(event) => setState((prev) => ({ ...prev, growthRatePct: Number(event.target.value || 0) }))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Opportunity conversion %</Label>
              <Input type="number" value={state.oppConversionPct} onChange={(event) => setState((prev) => ({ ...prev, oppConversionPct: Number(event.target.value || 0) }))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Offer conversion %</Label>
              <Input type="number" value={state.offerConversionPct} onChange={(event) => setState((prev) => ({ ...prev, offerConversionPct: Number(event.target.value || 0) }))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Lead conversion %</Label>
              <Input type="number" value={state.leadConversionPct} onChange={(event) => setState((prev) => ({ ...prev, leadConversionPct: Number(event.target.value || 0) }))} />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border rounded-lg overflow-hidden">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3">Business line</th>
                  {PERIODS.map((period) => <th key={period.key} className="text-right p-3">{period.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {BUSINESS_LINES.map((line) => (
                  <tr key={line.key} className="border-t">
                    <td className="p-3 align-top">
                      <p className="font-medium">{line.label}</p>
                      <p className="text-xs text-muted-foreground">{line.help}</p>
                    </td>
                    {PERIODS.map((period) => {
                      const cell = weights.forecast[line.key][period.key];
                      return (
                        <td key={period.key} className="p-3 text-right align-top">
                          <div className="space-y-1">
                            <Input
                              type="number"
                              value={cell.manual ?? Math.round(cell.auto)}
                              onChange={(event) => updateManualValue(period.key, line.key, event.target.value)}
                              className="text-right"
                            />
                            <p className="text-[11px] text-muted-foreground">Auto {fmt(cell.auto)}</p>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="border-t bg-muted/20">
                  <td className="p-3">
                    <p className="font-medium">General bundle adjustment</p>
                    <p className="text-xs text-muted-foreground">Use negative values for discounts on the full bundle.</p>
                  </td>
                  {PERIODS.map((period) => (
                    <td key={period.key} className="p-3 text-right">
                      <Input
                        type="number"
                        value={state.bundleAdjustments[period.key]}
                        onChange={(event) => updateBundleAdjustment(period.key, event.target.value)}
                        className="max-w-[220px] ml-auto text-right"
                      />
                    </td>
                  ))}
                </tr>
                <tr className="border-t bg-primary/5">
                  <td className="p-3 font-semibold">General total</td>
                  {PERIODS.map((period) => (
                    <td key={period.key} className="p-3 text-right font-semibold">{fmt(weights.totals[period.key])}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4" /> Hypotheses panel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {autoHypotheses.map((item) => <div key={item} className="rounded-lg border p-3 text-sm text-foreground">{item}</div>)}
            <Separator />
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Custom hypotheses / notes</Label>
              <Textarea value={state.hypotheses} onChange={(event) => setState((prev) => ({ ...prev, hypotheses: event.target.value }))} placeholder="Add your own forecast assumptions, exclusions or sales adjustments." />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" /> Editable candidate sales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 max-h-[620px] overflow-y-auto pr-1">
            {candidateRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No offers, opportunities or lead values found yet.</p>
            ) : candidateRows.map((candidate) => {
              const included = !state.excludedCandidates.includes(candidate.id);
              return (
                <label key={candidate.id} className={`flex items-start gap-3 rounded-lg border p-3 ${included ? 'bg-background' : 'bg-muted/30 opacity-70'}`}>
                  <Checkbox checked={included} onCheckedChange={() => toggleCandidate(candidate.id)} className="mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">{candidate.name}</p>
                        <p className="text-xs text-muted-foreground">{candidate.source} Â· {candidate.line === 'equipment' ? 'Equipment' : 'After-sales / Services'} Â· {candidate.period}</p>
                      </div>
                      <Badge variant={included ? 'secondary' : 'outline'}>{included ? 'Included' : 'Excluded'}</Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>Value {fmt(candidate.value)}</span>
                      <span>Prob {formatPct(candidate.probability)}</span>
                      {candidate.date ? <span>Date {candidate.date.toLocaleDateString()}</span> : null}
                    </div>
                  </div>
                </label>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Business split and evidence</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Historical equipment sales</p>
              <p className="text-xl font-bold">{fmt(historicalByLine.equipment)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Historical after-sales & services</p>
              <p className="text-xl font-bold">{fmt(historicalByLine.afterSales)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Visible evidence sources</p>
              <p className="text-xl font-bold">{orders.length + opportunities.length + offers.length + reports.length + leads.length}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">Orders {orders.length}</Badge>
            <Badge variant="outline">Opportunities {opportunities.length}</Badge>
            <Badge variant="outline">Offers {offers.length}</Badge>
            <Badge variant="outline">Reports {reports.length}</Badge>
            <Badge variant="outline">Leads {leads.length}</Badge>
            <Badge variant="outline">Strategy rows {strategy.length}</Badge>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
            The general account is the sum of both business lines. Adjust the line values or the bundle adjustments to model discounts, exclusions or upside.
          </div>
        </CardContent>
      </Card>
    </div>
  );
};



