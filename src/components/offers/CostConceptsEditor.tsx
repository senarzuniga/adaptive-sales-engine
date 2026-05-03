import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { SupplierPayment } from '@/services/payments/CashFlowGenerator';
import type { CostConcept } from '@/services/payments/PaymentMilestoneService';

interface CostConceptsEditorProps {
  offerTotal: number;
  value?: CostConcept[];
  onCostsChange: (concepts: CostConcept[]) => void;
}

function defaultConcepts(): CostConcept[] {
  return [
    {
      id: crypto.randomUUID(),
      concept_name: 'Materials & Equipment',
      total_cost: 50000,
      cost_type: 'direct',
      notes: '',
      supplier_payments: [
        { id: crypto.randomUUID(), milestone_number: 1, milestone_title: 'Purchase Order', percentage_of_concept: 50, amount: 25000, expected_days_after_contract: 0, supplier_name: '' },
        { id: crypto.randomUUID(), milestone_number: 2, milestone_title: 'Before Shipment', percentage_of_concept: 40, amount: 20000, expected_days_after_contract: 25, supplier_name: '' },
        { id: crypto.randomUUID(), milestone_number: 3, milestone_title: 'On Delivery', percentage_of_concept: 10, amount: 5000, expected_days_after_contract: 30, supplier_name: '' },
      ],
    },
  ];
}

function recalculateConceptAmounts(concept: CostConcept): CostConcept {
  return {
    ...concept,
    supplier_payments: concept.supplier_payments.map((payment) => ({
      ...payment,
      amount: Number((Number(concept.total_cost || 0) * Number(payment.percentage_of_concept || 0) / 100).toFixed(2)),
    })),
  };
}

export function CostConceptsEditor({ offerTotal, value, onCostsChange }: CostConceptsEditorProps) {
  const [concepts, setConcepts] = useState<CostConcept[]>(value && value.length > 0 ? value : defaultConcepts());

  useEffect(() => {
    if (value && value.length > 0) {
      setConcepts(value.map((concept) => recalculateConceptAmounts(concept)));
    }
  }, [value]);

  useEffect(() => {
    onCostsChange(concepts.map((concept) => recalculateConceptAmounts(concept)));
  }, [concepts, onCostsChange]);

  const totalCost = useMemo(() => concepts.reduce((sum, concept) => sum + Number(concept.total_cost || 0), 0), [concepts]);
  const marginPct = useMemo(() => {
    if (!offerTotal || offerTotal <= 0) return 0;
    return Number((((offerTotal - totalCost) / offerTotal) * 100).toFixed(2));
  }, [offerTotal, totalCost]);

  const updateConcept = (conceptId: string, field: keyof CostConcept, rawValue: string) => {
    setConcepts((prev) => prev.map((concept) => {
      if (concept.id !== conceptId) return concept;
      const next = {
        ...concept,
        [field]: field === 'total_cost' ? Number(rawValue || 0) : rawValue,
      } as CostConcept;
      return recalculateConceptAmounts(next);
    }));
  };

  const addConcept = () => {
    setConcepts((prev) => ([
      ...prev,
      {
        id: crypto.randomUUID(),
        concept_name: `Cost Concept ${prev.length + 1}`,
        total_cost: 0,
        cost_type: 'direct',
        notes: '',
        supplier_payments: [
          {
            id: crypto.randomUUID(),
            milestone_number: 1,
            milestone_title: 'Initial Payment',
            percentage_of_concept: 100,
            amount: 0,
            expected_days_after_contract: 0,
            supplier_name: '',
          },
        ],
      },
    ]));
  };

  const removeConcept = (conceptId: string) => {
    setConcepts((prev) => prev.filter((concept) => concept.id !== conceptId));
  };

  const updatePayment = (conceptId: string, paymentId: string, field: keyof SupplierPayment, rawValue: string) => {
    setConcepts((prev) => prev.map((concept) => {
      if (concept.id !== conceptId) return concept;
      const nextPayments = concept.supplier_payments.map((payment) => {
        if (payment.id !== paymentId) return payment;
        return {
          ...payment,
          [field]: field === 'percentage_of_concept' || field === 'expected_days_after_contract' || field === 'milestone_number'
            ? Number(rawValue || 0)
            : rawValue,
        } as SupplierPayment;
      });
      return recalculateConceptAmounts({ ...concept, supplier_payments: nextPayments });
    }));
  };

  const addPaymentMilestone = (conceptId: string) => {
    setConcepts((prev) => prev.map((concept) => {
      if (concept.id !== conceptId) return concept;
      const nextNumber = concept.supplier_payments.length + 1;
      return {
        ...concept,
        supplier_payments: [
          ...concept.supplier_payments,
          {
            id: crypto.randomUUID(),
            milestone_number: nextNumber,
            milestone_title: `Payment ${nextNumber}`,
            percentage_of_concept: 0,
            amount: 0,
            expected_days_after_contract: nextNumber * 15,
            supplier_name: '',
          },
        ],
      };
    }));
  };

  const removePayment = (conceptId: string, paymentId: string) => {
    setConcepts((prev) => prev.map((concept) => {
      if (concept.id !== conceptId) return concept;
      const payments = concept.supplier_payments
        .filter((payment) => payment.id !== paymentId)
        .map((payment, index) => ({ ...payment, milestone_number: index + 1 }));
      return recalculateConceptAmounts({ ...concept, supplier_payments: payments });
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Cost Concepts & Supplier Payments (P1...Pn)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {concepts.map((concept) => (
          <div key={concept.id} className="border rounded-md p-3 space-y-3">
            <div className="grid md:grid-cols-5 gap-2 items-end">
              <div className="md:col-span-2 space-y-1">
                <Label>Concept name</Label>
                <Input value={concept.concept_name} onChange={(event) => updateConcept(concept.id, 'concept_name', event.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Total cost</Label>
                <Input type="number" value={concept.total_cost} onChange={(event) => updateConcept(concept.id, 'total_cost', event.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Cost type</Label>
                <Input value={concept.cost_type || 'direct'} onChange={(event) => updateConcept(concept.id, 'cost_type', event.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={addConcept}>+ Concept</Button>
                <Button size="sm" variant="destructive" onClick={() => removeConcept(concept.id)} disabled={concepts.length === 1}>-</Button>
              </div>
            </div>

            <div className="overflow-x-auto border rounded-md">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="bg-muted/60 border-b">
                    <th className="p-2 text-left">Code</th>
                    <th className="p-2 text-left">Milestone title</th>
                    <th className="p-2 text-left">% of concept</th>
                    <th className="p-2 text-left">Amount</th>
                    <th className="p-2 text-left">Expected day</th>
                    <th className="p-2 text-left">Supplier</th>
                    <th className="p-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {concept.supplier_payments.map((payment) => (
                    <tr key={payment.id} className="border-b last:border-b-0">
                      <td className="p-2 font-medium">P{payment.milestone_number}</td>
                      <td className="p-2">
                        <Input value={payment.milestone_title} onChange={(event) => updatePayment(concept.id, payment.id, 'milestone_title', event.target.value)} />
                      </td>
                      <td className="p-2">
                        <Input type="number" step="0.01" value={payment.percentage_of_concept} onChange={(event) => updatePayment(concept.id, payment.id, 'percentage_of_concept', event.target.value)} />
                      </td>
                      <td className="p-2 font-medium">{payment.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                      <td className="p-2">
                        <Input type="number" value={payment.expected_days_after_contract} onChange={(event) => updatePayment(concept.id, payment.id, 'expected_days_after_contract', event.target.value)} />
                      </td>
                      <td className="p-2">
                        <Input value={payment.supplier_name || ''} onChange={(event) => updatePayment(concept.id, payment.id, 'supplier_name', event.target.value)} />
                      </td>
                      <td className="p-2">
                        <Button size="sm" variant="destructive" onClick={() => removePayment(concept.id, payment.id)}>Delete</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="p-2" colSpan={7}>
                      <Button size="sm" variant="outline" onClick={() => addPaymentMilestone(concept.id)}>+ Add payment milestone</Button>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        ))}

        <div className="rounded-md bg-muted/30 p-3 flex flex-wrap items-center justify-between gap-2 text-sm">
          <strong>Total Project Cost: {totalCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
          <span className={marginPct >= 30 ? 'text-emerald-600 font-semibold' : 'text-amber-600 font-semibold'}>Margin: {marginPct}%</span>
        </div>
      </CardContent>
    </Card>
  );
}
