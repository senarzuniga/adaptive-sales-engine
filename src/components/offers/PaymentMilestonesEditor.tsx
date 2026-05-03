import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ClientMilestone } from '@/services/payments/CashFlowGenerator';

interface PaymentMilestonesEditorProps {
  offerTotal: number;
  value?: ClientMilestone[];
  onMilestonesChange: (milestones: ClientMilestone[]) => void;
}

function createDefaultMilestones(): ClientMilestone[] {
  return [
    {
      id: crypto.randomUUID(),
      milestone_number: 1,
      milestone_title: 'Contract Signature',
      percentage: 20,
      expected_days_after_contract: 0,
      description: '',
    },
    {
      id: crypto.randomUUID(),
      milestone_number: 2,
      milestone_title: 'Material Delivery',
      percentage: 30,
      expected_days_after_contract: 30,
      description: '',
    },
    {
      id: crypto.randomUUID(),
      milestone_number: 3,
      milestone_title: 'Installation Completion',
      percentage: 30,
      expected_days_after_contract: 60,
      description: '',
    },
    {
      id: crypto.randomUUID(),
      milestone_number: 4,
      milestone_title: 'Final Acceptance',
      percentage: 20,
      expected_days_after_contract: 90,
      description: '',
    },
  ];
}

export function PaymentMilestonesEditor({ offerTotal, value, onMilestonesChange }: PaymentMilestonesEditorProps) {
  const [milestones, setMilestones] = useState<ClientMilestone[]>(value && value.length > 0 ? value : createDefaultMilestones());

  useEffect(() => {
    if (value && value.length > 0) {
      const normalized = value
        .slice()
        .sort((a, b) => a.milestone_number - b.milestone_number)
        .map((item, index) => ({ ...item, milestone_number: index + 1 }));
      setMilestones(normalized);
    }
  }, [value]);

  useEffect(() => {
    onMilestonesChange(milestones);
  }, [milestones, onMilestonesChange]);

  const totalPercentage = useMemo(() => milestones.reduce((sum, milestone) => sum + Number(milestone.percentage || 0), 0), [milestones]);

  const validationText = Math.abs(totalPercentage - 100) > 0.01
    ? `Warning: Total percentage is ${totalPercentage.toFixed(2)}%. Must equal 100%.`
    : 'Distribution is valid (100%).';

  const updateMilestone = (id: string, field: keyof ClientMilestone, rawValue: string) => {
    setMilestones((prev) => prev.map((milestone) => {
      if (milestone.id !== id) return milestone;
      if (field === 'percentage' || field === 'expected_days_after_contract') {
        return {
          ...milestone,
          [field]: Number(rawValue || 0),
        };
      }
      return {
        ...milestone,
        [field]: rawValue,
      };
    }));
  };

  const addMilestone = () => {
    setMilestones((prev) => ([
      ...prev,
      {
        id: crypto.randomUUID(),
        milestone_number: prev.length + 1,
        milestone_title: `Milestone ${prev.length + 1}`,
        percentage: 0,
        expected_days_after_contract: prev.length * 15,
        description: '',
      },
    ]));
  };

  const removeMilestone = (id: string) => {
    setMilestones((prev) => prev
      .filter((milestone) => milestone.id !== id)
      .map((milestone, index) => ({ ...milestone, milestone_number: index + 1 })));
  };

  return (
    <Card className="border-orange-200">
      <CardHeader>
        <CardTitle className="text-base">Client Payment Milestones (H1...Hn)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-2 text-sm">
          <Label className="font-medium">Payment terms are mandatory</Label>
          <span className={Math.abs(totalPercentage - 100) > 0.01 ? 'text-destructive' : 'text-emerald-600'}>{validationText}</span>
        </div>

        <div className="overflow-x-auto border rounded-md">
          <table className="w-full min-w-[920px] text-sm">
            <thead>
              <tr className="bg-muted/60 border-b">
                <th className="p-2 text-left">Code</th>
                <th className="p-2 text-left">Milestone title (copied to Word)</th>
                <th className="p-2 text-left">% of Total</th>
                <th className="p-2 text-left">Amount (EUR)</th>
                <th className="p-2 text-left">Expected day</th>
                <th className="p-2 text-left">Description</th>
                <th className="p-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {milestones.map((milestone) => (
                <tr key={milestone.id} className="border-b last:border-b-0">
                  <td className="p-2 font-medium">H{milestone.milestone_number}</td>
                  <td className="p-2">
                    <Input
                      value={milestone.milestone_title}
                      onChange={(event) => updateMilestone(milestone.id, 'milestone_title', event.target.value)}
                      placeholder="Advance Payment for Materials"
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      type="number"
                      step="0.01"
                      value={milestone.percentage}
                      onChange={(event) => updateMilestone(milestone.id, 'percentage', event.target.value)}
                    />
                  </td>
                  <td className="p-2 font-medium">
                    {((offerTotal * Number(milestone.percentage || 0)) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td className="p-2">
                    <Input
                      type="number"
                      value={milestone.expected_days_after_contract}
                      onChange={(event) => updateMilestone(milestone.id, 'expected_days_after_contract', event.target.value)}
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      value={milestone.description || ''}
                      onChange={(event) => updateMilestone(milestone.id, 'description', event.target.value)}
                      placeholder="Payment condition text for document"
                    />
                  </td>
                  <td className="p-2">
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={addMilestone}>+</Button>
                      <Button type="button" size="sm" variant="destructive" onClick={() => removeMilestone(milestone.id)} disabled={milestones.length === 1}>-</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/40">
                <td className="p-2 font-semibold" colSpan={2}>Total</td>
                <td className="p-2 font-semibold">{totalPercentage.toFixed(2)}%</td>
                <td className="p-2 font-semibold">{offerTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                <td className="p-2" colSpan={3}></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <p className="text-xs text-muted-foreground">Milestone text is copied literally into the offer document payment section.</p>
      </CardContent>
    </Card>
  );
}
