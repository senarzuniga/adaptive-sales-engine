import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { OptimizationScenario } from '@/services/payments/CashFlowOptimizationAgent';

interface AIOptimizationScenariosProps {
  scenarios: OptimizationScenario[];
  onApply: (scenarioId: string) => Promise<void>;
  applyingScenarioId?: string;
}

export function AIOptimizationScenarios({ scenarios, onApply, applyingScenarioId }: AIOptimizationScenariosProps) {
  if (scenarios.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">AI-generated optimization scenarios</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {scenarios.map((scenario) => (
          <div key={scenario.id} className="rounded-md border p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium flex items-center gap-2">
                <span>{scenario.icon}</span>
                <span>{scenario.name}</span>
              </div>
              <Badge variant={scenario.impact === 'positive' ? 'default' : 'secondary'}>
                {scenario.impact === 'positive' ? 'Improves cash flow' : 'Trade-off'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{scenario.description}</p>
            <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
              {scenario.changes.map((change) => <li key={change}>{change}</li>)}
            </ul>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <div className="text-muted-foreground">Peak Negative</div>
                <div className="font-semibold">{scenario.projected_peak_negative.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Break-even</div>
                <div className="font-semibold">Day {scenario.projected_break_even}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Financing Saved</div>
                <div className="font-semibold">{scenario.financing_saved.toLocaleString()}</div>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => onApply(scenario.id)}
              disabled={applyingScenarioId === scenario.id}
            >
              {applyingScenarioId === scenario.id ? 'Applying...' : 'Apply scenario'}
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
