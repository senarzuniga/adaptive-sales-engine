import { Line, LineChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import type { CashFlowData } from '@/services/payments/CashFlowGenerator';

interface CashFlowChartProps {
  data: CashFlowData;
}

export function CashFlowChart({ data }: CashFlowChartProps) {
  return (
    <div className="rounded-md border p-3">
      <ChartContainer
        className="h-[320px] w-full"
        config={{
          cash_balance: { label: 'Cash Balance', color: '#22c55e' },
          cumulative_inflow: { label: 'Cumulative Inflow', color: '#3b82f6' },
          cumulative_outflow: { label: 'Cumulative Outflow', color: '#f97316' },
        }}
      >
        <LineChart data={data.cashFlow} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="day_index" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis tickLine={false} axisLine={false} tickMargin={8} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Line type="monotone" dataKey="cash_balance" stroke="var(--color-cash_balance)" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="cumulative_inflow" stroke="var(--color-cumulative_inflow)" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="cumulative_outflow" stroke="var(--color-cumulative_outflow)" strokeWidth={2} dot={false} />
        </LineChart>
      </ChartContainer>
    </div>
  );
}
