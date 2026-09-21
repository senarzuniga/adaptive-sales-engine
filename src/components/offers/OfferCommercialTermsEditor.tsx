import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import type { OfferCommercialTerms } from '@/lib/offerPackages';
import { buildEquipmentIncotermText, buildPaymentTermsText, buildWarrantyTermsText, resizePaymentMilestones, sumPaymentMilestones } from '@/lib/offerPackages';

interface OfferCommercialTermsEditorProps {
  isEs: boolean;
  terms: OfferCommercialTerms;
  onChange: (terms: OfferCommercialTerms) => void;
}

const INCOTERMS = ['EXW', 'FCA', 'FOB', 'CFR', 'CIF', 'DAP', 'DDP'] as const;

export function OfferCommercialTermsEditor({ isEs, terms, onChange }: OfferCommercialTermsEditorProps) {
  const paymentTotal = sumPaymentMilestones(terms.paymentMilestones);

  const updateTerms = (patch: Partial<OfferCommercialTerms>) => onChange({ ...terms, ...patch });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{isEs ? 'Condiciones comerciales' : 'Commercial conditions'}</CardTitle>
        <CardDescription>
          {isEs ? 'Define pagos, shipping, entrega y garant�a para reutilizar el mismo cuadro en el Word.' : 'Define payment, shipping, delivery and warranty so the same matrix flows into the Word offer.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="text-sm font-medium text-foreground">Incoterm</label>
            <Select value={terms.equipmentIncoterm} onValueChange={(value) => updateTerms({ equipmentIncoterm: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {INCOTERMS.map((term) => <SelectItem key={term} value={term}>{term}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-foreground">{isEs ? 'Ubicaci�n Incoterm' : 'Incoterm location'}</label>
            <Input value={terms.incotermLocation} onChange={(event) => updateTerms({ incotermLocation: event.target.value })} placeholder="Barcelona, Spain" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">{isEs ? 'Validez (d�as)' : 'Validity (days)'}</label>
            <Input type="number" min={1} value={terms.validityDays} onChange={(event) => updateTerms({ validityDays: Number(event.target.value || 0) })} />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">{isEs ? 'Garant�a (meses)' : 'Warranty (months)'}</label>
            <Input type="number" min={1} value={terms.warrantyMonths} onChange={(event) => updateTerms({ warrantyMonths: Number(event.target.value || 0) })} />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">{isEs ? 'Delivery time (meses)' : 'Delivery time (months)'}</label>
            <Input type="number" min={1} value={terms.deliveryMonths} onChange={(event) => updateTerms({ deliveryMonths: Number(event.target.value || 0) })} />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-foreground">{isEs ? 'Notas de entrega' : 'Delivery notes'}</label>
            <Input value={terms.deliveryNotes} onChange={(event) => updateTerms({ deliveryNotes: event.target.value })} placeholder={isEs ? 'Fecha final confirmada tras kickoff y planificaci�n de proveedores.' : 'Final date confirmed after kick-off and supplier scheduling.'} />
          </div>
        </div>

        <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">{isEs ? 'Hitos de pago' : 'Payment milestones'}</p>
              <p className="text-xs text-muted-foreground">{isEs ? 'Cada hito define porcentaje y vencimiento o condici�n de cobro.' : 'Each milestone defines percentage and collection due point or condition.'}</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">{isEs ? 'N�mero de hitos' : 'Milestones'}</label>
              <Input className="h-8 w-20" type="number" min={1} value={terms.paymentMilestones.length} onChange={(event) => updateTerms({ paymentMilestones: resizePaymentMilestones(Number(event.target.value || 1), terms.paymentMilestones) })} />
              <Badge variant={paymentTotal === 100 ? 'default' : 'secondary'}>{paymentTotal.toFixed(1)}%</Badge>
            </div>
          </div>
          <div className="space-y-2">
            {terms.paymentMilestones.map((milestone, index) => (
              <div key={milestone.id} className="grid grid-cols-1 md:grid-cols-[120px_1fr_40px] gap-2 items-start">
                <div>
                  <label className="text-xs text-muted-foreground">{isEs ? `Hito ${index + 1} %` : `Milestone ${index + 1} %`}</label>
                  <Input type="number" step="0.5" min={0} value={milestone.percentage} onChange={(event) => updateTerms({ paymentMilestones: terms.paymentMilestones.map((entry) => entry.id === milestone.id ? { ...entry, percentage: Number(event.target.value || 0) } : entry) })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">{isEs ? 'Descripci�n / vencimiento' : 'Description / due point'}</label>
                  <Textarea rows={2} value={milestone.description} onChange={(event) => updateTerms({ paymentMilestones: terms.paymentMilestones.map((entry) => entry.id === milestone.id ? { ...entry, description: event.target.value } : entry) })} />
                </div>
                <div className="pt-5">
                  <Button variant="ghost" size="icon" disabled={terms.paymentMilestones.length <= 1} onClick={() => updateTerms({ paymentMilestones: terms.paymentMilestones.filter((entry) => entry.id !== milestone.id) })}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => updateTerms({ paymentMilestones: [...terms.paymentMilestones, { id: crypto.randomUUID(), percentage: 0, description: '' }] })}>
              <Plus className="h-4 w-4 mr-2" />
              {isEs ? 'A�adir hito' : 'Add milestone'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">{isEs ? 'Texto payment' : 'Payment wording'}</p>
            <p className="mt-1">{buildPaymentTermsText(terms)}</p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Incoterm</p>
            <p className="mt-1">{buildEquipmentIncotermText(terms)}</p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">{isEs ? 'Garant�a' : 'Warranty'}</p>
            <p className="mt-1">{buildWarrantyTermsText(terms)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
