import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CashFlowChart } from '@/components/offers/CashFlowChart';
import { AIOptimizationScenarios } from '@/components/offers/AIOptimizationScenarios';
import { PaymentMilestoneService } from '@/services/payments/PaymentMilestoneService';
import type { CashFlowData } from '@/services/payments/CashFlowGenerator';
import type { OptimizationScenario } from '@/services/payments/CashFlowOptimizationAgent';

interface CashFlowDashboardProps {
  offerId: string;
  contractStartDate?: string;
  onScenarioApplied?: () => Promise<void> | void;
}

export function CashFlowDashboard({ offerId, contractStartDate, onScenarioApplied }: CashFlowDashboardProps) {
  const service = useMemo(() => new PaymentMilestoneService(), []);
  const [cashFlowData, setCashFlowData] = useState<CashFlowData | null>(null);
  const [scenarios, setScenarios] = useState<OptimizationScenario[]>([]);
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('chart');
  const [loading, setLoading] = useState(false);
  const [applyingScenarioId, setApplyingScenarioId] = useState('');

  const loadCashFlowData = async () => {
    if (!offerId) return;
    setLoading(true);
    try {
      const [data, aiScenarios] = await Promise.all([
        service.generateCashFlow(offerId, contractStartDate),
        service.optimizeCashFlow(offerId, contractStartDate),
      ]);
      setCashFlowData(data);
      setScenarios(aiScenarios);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCashFlowData();
  }, [offerId, contractStartDate]);

  const applyScenario = async (scenarioId: string) => {
    if (!offerId) return;
    setApplyingScenarioId(scenarioId);
    try {
      await service.applyScenario(offerId, scenarioId);
      await loadCashFlowData();
      await onScenarioApplied?.();
    } finally {
      setApplyingScenarioId('');
    }
  };

  const exportCsv = async () => {
    if (!offerId) return;
    const csv = await service.exportCashFlowCsv(offerId, contractStartDate);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `cash_flow_${offerId}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">Loading cash flow intelligence...</CardContent>
      </Card>
    );
  }

  if (!cashFlowData) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">No cash flow data available.</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Project Cash Flow Forecast</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={viewMode === 'chart' ? 'default' : 'outline'} onClick={() => setViewMode('chart')}>Chart view</Button>
            <Button size="sm" variant={viewMode === 'table' ? 'default' : 'outline'} onClick={() => setViewMode('table')}>Table view</Button>
            <Button size="sm" variant="outline" onClick={exportCsv}>Export CSV</Button>
          </div>

          {viewMode === 'chart' ? (
            <CashFlowChart data={cashFlowData} />
          ) : (
            <div className="overflow-x-auto border rounded-md">
              <table className="w-full min-w-[780px] text-sm">
                <thead>
                  <tr className="bg-muted/60 border-b">
                    <th className="p-2 text-left">Day</th>
                    <th className="p-2 text-left">Client Inflow</th>
                    <th className="p-2 text-left">Supplier Outflow</th>
                    <th className="p-2 text-left">Net Cash Flow</th>
                    <th className="p-2 text-left">Cash Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {cashFlowData.cashFlow.filter((_, index) => index % 7 === 0).map((item) => (
                    <tr key={item.date} className="border-b last:border-b-0">
                      <td className="p-2">{item.day_index}</td>
                      <td className="p-2 text-emerald-700">{item.client_inflow.toLocaleString()}</td>
                      <td className="p-2 text-amber-700">{item.supplier_outflow.toLocaleString()}</td>
                      <td className={`p-2 ${item.net_cash_flow >= 0 ? 'text-emerald-700' : 'text-destructive'}`}>{item.net_cash_flow.toLocaleString()}</td>
                      <td className={`p-2 ${item.cash_balance >= 0 ? 'text-emerald-700' : 'text-destructive'} font-medium`}>{item.cash_balance.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-3 text-sm">
            <div className="rounded-md border border-amber-300 bg-amber-50/50 p-3">
              <div className="text-muted-foreground">Maximum Financing Needed</div>
              <div className="font-semibold">{cashFlowData.metrics.max_financing_needed.toLocaleString()}</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-muted-foreground">Break-even Day</div>
              <div className="font-semibold">{cashFlowData.metrics.break_even_day}</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-muted-foreground">Estimated Financing Cost (8%)</div>
              <div className="font-semibold">{cashFlowData.metrics.total_financing_cost.toLocaleString()}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <AIOptimizationScenarios
        scenarios={scenarios}
        applyingScenarioId={applyingScenarioId}
        onApply={applyScenario}
      />
    </div>
  );
}
