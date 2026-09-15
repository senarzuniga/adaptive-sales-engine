import { DEFAULT_INGECART_POLICY, type OfferCostPolicy } from '@/lib/utils';

export type InstallationTravelMode = 'none' | 'car' | 'plane' | 'other';
export type InstallationDestination = 'spain' | 'europe' | 'usa' | 'international';

/**
 * Detailed installation plan attached to an installation cost line.
 * Every rate is optional: when omitted the company cost policy value is applied.
 */
export interface InstallationPlan {
  days: number;
  resources: number;
  hoursPerDay?: number;
  hourlyRate?: number;
  laborSupplementPerDay?: number;
  festiveDays?: number;
  festiveSupplementPerDay?: number;
  destination: InstallationDestination;
  dietPerDay?: number;
  travelMode: InstallationTravelMode;
  trips?: number;
  distanceKm?: number;
  kmRate?: number;
  vehicles?: number;
  flightCost?: number;
  otherTravelCost?: number;
  hotelNights?: number;
  hotelRate?: number;
  rentalCarDays?: number;
  rentalCarRate?: number;
  otherExpenses?: number;
}

export interface InstallationCostBreakdownLine {
  key: string;
  label: string;
  formula: string;
  amount: number;
  group: 'labor' | 'travel';
}

export interface InstallationCostResult {
  labor: number;
  travel: number;
  total: number;
  laborPerResourceDay: number;
  breakdown: InstallationCostBreakdownLine[];
}

const num = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const createInstallationPlan = (overrides: Partial<InstallationPlan> = {}): InstallationPlan => ({
  days: 0,
  resources: 1,
  destination: 'spain',
  travelMode: 'car',
  trips: 1,
  vehicles: 1,
  ...overrides,
});

export const resolveDietRate = (plan: InstallationPlan, policy: OfferCostPolicy) =>
  plan.dietPerDay !== undefined ? num(plan.dietPerDay) : plan.destination === 'spain' ? policy.dietSpain : policy.dietInternational;

export const resolveHotelRate = (plan: InstallationPlan, policy: OfferCostPolicy) =>
  plan.hotelRate !== undefined ? num(plan.hotelRate) : plan.destination === 'usa' || plan.destination === 'international' ? policy.hotelUsa : policy.hotelEurope;

export const resolveFlightCost = (plan: InstallationPlan, policy: OfferCostPolicy) =>
  plan.flightCost !== undefined ? num(plan.flightCost) : plan.destination === 'usa' || plan.destination === 'international' ? policy.flightUsa : policy.flightEurope;

export function computeInstallationCost(plan: InstallationPlan, policy: OfferCostPolicy = DEFAULT_INGECART_POLICY): InstallationCostResult {
  const days = Math.max(0, num(plan.days));
  const resources = Math.max(0, num(plan.resources));
  const hoursPerDay = plan.hoursPerDay !== undefined ? num(plan.hoursPerDay) : policy.workingHoursPerDay;
  const hourlyRate = plan.hourlyRate !== undefined ? num(plan.hourlyRate) : policy.installationLaborRate;
  const laborSupplement = plan.laborSupplementPerDay !== undefined ? num(plan.laborSupplementPerDay) : policy.laborSupplement;
  const diet = resolveDietRate(plan, policy);
  const festiveDays = Math.max(0, num(plan.festiveDays));
  const festiveSupplement = plan.festiveSupplementPerDay !== undefined ? num(plan.festiveSupplementPerDay) : policy.festiveSupplement;

  const breakdown: InstallationCostBreakdownLine[] = [];
  const push = (line: Omit<InstallationCostBreakdownLine, 'amount'> & { amount: number }) => {
    if (line.amount !== 0) breakdown.push(line);
  };

  const wages = days * resources * hoursPerDay * hourlyRate;
  push({ key: 'wages', group: 'labor', label: 'Labour hours', formula: `${days} d x ${resources} tech x ${hoursPerDay} h x ${hourlyRate} EUR/h`, amount: wages });
  const supplements = days * resources * laborSupplement;
  push({ key: 'supplement', group: 'labor', label: 'Displacement supplement', formula: `${days} d x ${resources} tech x ${laborSupplement} EUR/d`, amount: supplements });
  const diets = days * resources * diet;
  push({ key: 'diet', group: 'labor', label: 'Per diem (dietas)', formula: `${days} d x ${resources} tech x ${diet} EUR/d`, amount: diets });
  const festive = festiveDays * resources * festiveSupplement;
  push({ key: 'festive', group: 'labor', label: 'Festive / weekend supplement', formula: `${festiveDays} d x ${resources} tech x ${festiveSupplement} EUR/d`, amount: festive });
  const labor = wages + supplements + diets + festive;

  const trips = Math.max(0, plan.trips !== undefined ? num(plan.trips) : 1);
  let transport = 0;
  if (plan.travelMode === 'car') {
    const vehicles = Math.max(0, plan.vehicles !== undefined ? num(plan.vehicles) : 1);
    const km = Math.max(0, num(plan.distanceKm));
    const kmRate = plan.kmRate !== undefined ? num(plan.kmRate) : policy.kmRate;
    transport = trips * vehicles * km * kmRate;
    push({ key: 'car', group: 'travel', label: 'Car mileage', formula: `${trips} trips x ${vehicles} veh x ${km} km x ${kmRate} EUR/km`, amount: transport });
  } else if (plan.travelMode === 'plane') {
    const flight = resolveFlightCost(plan, policy);
    transport = trips * resources * flight;
    push({ key: 'plane', group: 'travel', label: 'Flights', formula: `${trips} trips x ${resources} tech x ${flight} EUR`, amount: transport });
  } else if (plan.travelMode === 'other') {
    transport = trips * Math.max(0, num(plan.otherTravelCost));
    push({ key: 'other-travel', group: 'travel', label: 'Other transport', formula: `${trips} trips x ${num(plan.otherTravelCost)} EUR`, amount: transport });
  }

  const hotelNights = Math.max(0, plan.hotelNights !== undefined ? num(plan.hotelNights) : days);
  const hotelRate = resolveHotelRate(plan, policy);
  const hotel = hotelNights * resources * hotelRate;
  push({ key: 'hotel', group: 'travel', label: 'Hotel nights', formula: `${hotelNights} nights x ${resources} tech x ${hotelRate} EUR`, amount: hotel });

  const rentalDays = Math.max(0, num(plan.rentalCarDays));
  const rentalRate = plan.rentalCarRate !== undefined ? num(plan.rentalCarRate) : policy.rentalCarPerDay;
  const rental = rentalDays * rentalRate;
  push({ key: 'rental', group: 'travel', label: 'Rental car', formula: `${rentalDays} d x ${rentalRate} EUR/d`, amount: rental });

  const other = Math.max(0, num(plan.otherExpenses));
  push({ key: 'other', group: 'travel', label: 'Other expenses', formula: 'flat', amount: other });

  const travel = transport + hotel + rental + other;
  const laborPerResourceDay = days > 0 && resources > 0 ? labor / (days * resources) : hoursPerDay * hourlyRate + laborSupplement + diet;

  return { labor, travel, total: labor + travel, laborPerResourceDay, breakdown };
}

export const describeInstallationPlan = (plan: InstallationPlan, result: InstallationCostResult) => {
  const travel = plan.travelMode === 'car'
    ? `car ${num(plan.distanceKm)} km`
    : plan.travelMode === 'plane'
      ? 'plane'
      : plan.travelMode === 'other'
        ? 'other transport'
        : 'no travel';
  return `${plan.days} days x ${plan.resources} technicians, ${plan.destination}, ${travel}; labour ${Math.round(result.labor)} EUR + travel & expenses ${Math.round(result.travel)} EUR`;
};
