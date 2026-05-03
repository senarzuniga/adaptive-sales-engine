export interface ClientMilestone {
  id: string;
  milestone_number: number;
  milestone_title: string;
  percentage: number;
  expected_days_after_contract: number;
  description?: string;
}

export interface SupplierPayment {
  id: string;
  cost_concept_id?: string;
  milestone_number: number;
  milestone_title: string;
  percentage_of_concept: number;
  amount: number;
  expected_days_after_contract: number;
  supplier_name?: string;
  payment_terms?: string;
}

export interface CashFlowPoint {
  date: string;
  day_index: number;
  client_inflow: number;
  supplier_outflow: number;
  net_cash_flow: number;
  cumulative_inflow: number;
  cumulative_outflow: number;
  cash_balance: number;
}

export interface CashFlowMetrics {
  max_negative_balance: number;
  max_financing_needed: number;
  break_even_day: number;
  total_financing_cost: number;
  peak_negative_day: string;
}

export interface CashFlowData {
  cashFlow: CashFlowPoint[];
  metrics: CashFlowMetrics;
}

const MS_IN_DAY = 24 * 60 * 60 * 1000;

function toDateAtStart(date: Date | string) {
  const parsed = typeof date === 'string' ? new Date(date) : date;
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

function addDays(base: Date, days: number) {
  return new Date(base.getTime() + Math.max(0, days) * MS_IN_DAY);
}

function sameUtcDay(a: Date, b: Date) {
  return a.getUTCFullYear() === b.getUTCFullYear()
    && a.getUTCMonth() === b.getUTCMonth()
    && a.getUTCDate() === b.getUTCDate();
}

export class CashFlowGenerator {
  generateProjectCashFlow(
    clientMilestones: ClientMilestone[],
    supplierPayments: SupplierPayment[],
    offerTotal: number,
    contractStartDate: Date | string,
  ): CashFlowData {
    const startDate = toDateAtStart(contractStartDate);
    const timeline = Array.from({ length: 181 }, (_, index) => addDays(startDate, index));

    const inflowMilestones = clientMilestones.map((milestone) => ({
      day: Math.max(0, Number(milestone.expected_days_after_contract || 0)),
      amount: Number(((offerTotal * Number(milestone.percentage || 0)) / 100).toFixed(2)),
    }));

    const outflowMilestones = supplierPayments.map((payment) => ({
      day: Math.max(0, Number(payment.expected_days_after_contract || 0)),
      amount: Number(Number(payment.amount || 0).toFixed(2)),
    }));

    let cumulativeInflow = 0;
    let cumulativeOutflow = 0;
    let cashBalance = 0;

    const cashFlow = timeline.map((dayDate) => {
      let dailyInflow = 0;
      let dailyOutflow = 0;

      inflowMilestones.forEach((milestone) => {
        if (sameUtcDay(dayDate, addDays(startDate, milestone.day))) {
          dailyInflow += milestone.amount;
        }
      });

      outflowMilestones.forEach((payment) => {
        if (sameUtcDay(dayDate, addDays(startDate, payment.day))) {
          dailyOutflow += payment.amount;
        }
      });

      const dailyNet = dailyInflow - dailyOutflow;
      cumulativeInflow += dailyInflow;
      cumulativeOutflow += dailyOutflow;
      cashBalance += dailyNet;

      return {
        date: dayDate.toISOString(),
        day_index: Math.round((dayDate.getTime() - startDate.getTime()) / MS_IN_DAY),
        client_inflow: Number(dailyInflow.toFixed(2)),
        supplier_outflow: Number(dailyOutflow.toFixed(2)),
        net_cash_flow: Number(dailyNet.toFixed(2)),
        cumulative_inflow: Number(cumulativeInflow.toFixed(2)),
        cumulative_outflow: Number(cumulativeOutflow.toFixed(2)),
        cash_balance: Number(cashBalance.toFixed(2)),
      };
    });

    const minPoint = cashFlow.reduce((worst, point) => point.cash_balance < worst.cash_balance ? point : worst, cashFlow[0]);
    const breakEven = cashFlow.find((point) => point.cash_balance >= 0 && point.day_index > 0);
    const financingNeeded = Math.abs(minPoint.cash_balance);

    return {
      cashFlow,
      metrics: {
        max_negative_balance: Number(minPoint.cash_balance.toFixed(2)),
        max_financing_needed: Number(financingNeeded.toFixed(2)),
        break_even_day: breakEven ? breakEven.day_index : -1,
        total_financing_cost: Number(((financingNeeded * 0.08 * 180) / 365).toFixed(2)),
        peak_negative_day: minPoint.date,
      },
    };
  }
}
