import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  computeInstallationCost,
  resolveDietRate,
  resolveFlightCost,
  resolveHotelRate,
  type InstallationDestination,
  type InstallationPlan,
  type InstallationTravelMode,
} from '@/lib/installationCost';
import { DEFAULT_INGECART_POLICY, type OfferCostPolicy } from '@/lib/utils';

const DESTINATIONS: Array<{ value: InstallationDestination; label: string }> = [
  { value: 'spain', label: 'Spain' },
  { value: 'europe', label: 'Europe' },
  { value: 'usa', label: 'USA' },
  { value: 'international', label: 'Other international' },
];

const TRAVEL_MODES: Array<{ value: InstallationTravelMode; label: string }> = [
  { value: 'car', label: 'Car (mileage)' },
  { value: 'plane', label: 'Plane' },
  { value: 'other', label: 'Other transport' },
  { value: 'none', label: 'No travel' },
];

const fmt = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value || 0);

interface FieldProps {
  label: string;
  value: number | undefined;
  placeholder?: number;
  onChange: (value: number | undefined) => void;
  disabled?: boolean;
  step?: number;
}

/** Numeric field: empty input means "use policy default" (shown as placeholder). */
const NumberField = ({ label, value, placeholder, onChange, disabled, step }: FieldProps) => (
  <div>
    <label className="text-xs text-muted-foreground">{label}</label>
    <Input
      type="number"
      step={step}
      value={value === undefined ? '' : value}
      placeholder={placeholder !== undefined ? String(placeholder) : undefined}
      onChange={(event) => onChange(event.target.value === '' ? undefined : Number(event.target.value))}
      disabled={disabled}
    />
  </div>
);

interface InstallationPlannerProps {
  plan: InstallationPlan;
  onChange: (plan: InstallationPlan) => void;
  disabled?: boolean;
  policy?: OfferCostPolicy;
  idPrefix?: string;
}

export const InstallationPlanner = ({ plan, onChange, disabled, policy = DEFAULT_INGECART_POLICY, idPrefix = 'installation' }: InstallationPlannerProps) => {
  const result = useMemo(() => computeInstallationCost(plan, policy), [plan, policy]);
  const patch = (changes: Partial<InstallationPlan>) => onChange({ ...plan, ...changes });
  const isUsa = plan.destination === 'usa' || plan.destination === 'international';

  return (
    <div className="rounded-lg border border-dashed bg-muted/20 p-3 space-y-3" data-testid={`${idPrefix}-planner`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Installation planner</p>
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="secondary" data-testid={`${idPrefix}-labor`}>Labour {fmt(result.labor)}</Badge>
          <Badge variant="secondary" data-testid={`${idPrefix}-travel`}>Travel &amp; expenses {fmt(result.travel)}</Badge>
          <Badge data-testid={`${idPrefix}-total`}>Total {fmt(result.total)}</Badge>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <NumberField label="Days" value={plan.days} onChange={(value) => patch({ days: value ?? 0 })} disabled={disabled} />
        <NumberField label="Technicians" value={plan.resources} onChange={(value) => patch({ resources: value ?? 0 })} disabled={disabled} />
        <NumberField label="Hours / day" value={plan.hoursPerDay} placeholder={policy.workingHoursPerDay} onChange={(value) => patch({ hoursPerDay: value })} disabled={disabled} />
        <NumberField label="Hourly rate (EUR/h)" value={plan.hourlyRate} placeholder={policy.installationLaborRate} onChange={(value) => patch({ hourlyRate: value })} disabled={disabled} />
        <NumberField label="Supplement (EUR/day)" value={plan.laborSupplementPerDay} placeholder={policy.laborSupplement} onChange={(value) => patch({ laborSupplementPerDay: value })} disabled={disabled} />
        <div>
          <label className="text-xs text-muted-foreground">Destination</label>
          <Select value={plan.destination} onValueChange={(value) => patch({ destination: value as InstallationDestination })} disabled={disabled}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{DESTINATIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <NumberField label="Per diem (EUR/day)" value={plan.dietPerDay} placeholder={resolveDietRate({ ...plan, dietPerDay: undefined }, policy)} onChange={(value) => patch({ dietPerDay: value })} disabled={disabled} />
        <NumberField label="Festive days" value={plan.festiveDays} placeholder={0} onChange={(value) => patch({ festiveDays: value })} disabled={disabled} />
        <NumberField label="Festive supplement (EUR/day)" value={plan.festiveSupplementPerDay} placeholder={policy.festiveSupplement} onChange={(value) => patch({ festiveSupplementPerDay: value })} disabled={disabled} />
      </div>

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <div>
          <label className="text-xs text-muted-foreground">Travel mode</label>
          <Select value={plan.travelMode} onValueChange={(value) => patch({ travelMode: value as InstallationTravelMode })} disabled={disabled}>
            <SelectTrigger data-testid={`${idPrefix}-travel-mode`}><SelectValue /></SelectTrigger>
            <SelectContent>{TRAVEL_MODES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {plan.travelMode !== 'none' ? <NumberField label="Round trips" value={plan.trips} placeholder={1} onChange={(value) => patch({ trips: value })} disabled={disabled} /> : null}
        {plan.travelMode === 'car' ? (
          <>
            <NumberField label="Km per round trip" value={plan.distanceKm} placeholder={0} onChange={(value) => patch({ distanceKm: value })} disabled={disabled} />
            <NumberField label="EUR / km" value={plan.kmRate} placeholder={policy.kmRate} step={0.01} onChange={(value) => patch({ kmRate: value })} disabled={disabled} />
            <NumberField label="Vehicles" value={plan.vehicles} placeholder={1} onChange={(value) => patch({ vehicles: value })} disabled={disabled} />
          </>
        ) : null}
        {plan.travelMode === 'plane' ? (
          <NumberField label="Flight cost (EUR/person/trip)" value={plan.flightCost} placeholder={resolveFlightCost({ ...plan, flightCost: undefined }, policy)} onChange={(value) => patch({ flightCost: value })} disabled={disabled} />
        ) : null}
        {plan.travelMode === 'other' ? (
          <NumberField label="Other transport (EUR/trip)" value={plan.otherTravelCost} placeholder={0} onChange={(value) => patch({ otherTravelCost: value })} disabled={disabled} />
        ) : null}
        <NumberField label="Hotel nights / tech" value={plan.hotelNights} placeholder={plan.days} onChange={(value) => patch({ hotelNights: value })} disabled={disabled} />
        <NumberField label={`Hotel rate (${isUsa ? 'USA' : 'Europe'} default)`} value={plan.hotelRate} placeholder={resolveHotelRate({ ...plan, hotelRate: undefined }, policy)} onChange={(value) => patch({ hotelRate: value })} disabled={disabled} />
        <NumberField label="Rental car days" value={plan.rentalCarDays} placeholder={0} onChange={(value) => patch({ rentalCarDays: value })} disabled={disabled} />
        <NumberField label="Rental car (EUR/day)" value={plan.rentalCarRate} placeholder={policy.rentalCarPerDay} onChange={(value) => patch({ rentalCarRate: value })} disabled={disabled} />
        <NumberField label="Other expenses (EUR)" value={plan.otherExpenses} placeholder={0} onChange={(value) => patch({ otherExpenses: value })} disabled={disabled} />
      </div>

      <div className="grid gap-2 text-xs md:grid-cols-2">
        {result.breakdown.map((line) => (
          <div key={line.key} className="flex items-center justify-between rounded border bg-background px-2 py-1">
            <span className="text-muted-foreground">{line.group === 'labor' ? 'Labour' : 'Travel'} · {line.label} <span className="opacity-70">({line.formula})</span></span>
            <span className="font-medium">{fmt(line.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default InstallationPlanner;
