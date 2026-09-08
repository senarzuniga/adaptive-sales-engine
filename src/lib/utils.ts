import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export type OfferCostPolicy = {
  warrantyPct: number;
  financialPct: number;
  commercialMgmtPct: number;
  materialStructurePct: number;
  hotelEurope: number;
  hotelUsa: number;
  flightEurope: number;
  flightUsa: number;
  rentalCarPerDay: number;
  kmRate: number;
  installationLaborRate: number;
  laborSupplement: number;
  festiveSupplement: number;
  dietSpain: number;
  dietInternational: number;
  workingHoursPerDay: number;
  saturdayHours: number;
  serviceBlocks: Array<{ name: string; days: number; technicians: number }>;
};

export const DEFAULT_INGECART_POLICY: OfferCostPolicy = {
  warrantyPct: 4,
  financialPct: 2,
  commercialMgmtPct: 3.5,
  materialStructurePct: 15,
  hotelEurope: 120,
  hotelUsa: 140,
  flightEurope: 800,
  flightUsa: 2000,
  rentalCarPerDay: 60,
  kmRate: 0.7,
  installationLaborRate: 65,
  laborSupplement: 80,
  festiveSupplement: 160,
  dietSpain: 20,
  dietInternational: 60,
  workingHoursPerDay: 10,
  saturdayHours: 6,
  serviceBlocks: [
    { name: 'Mechanical Assembly', days: 2, technicians: 3 },
    { name: 'Commissioning', days: 3, technicians: 2 },
    { name: 'Startup & Training', days: 1, technicians: 2 },
    { name: 'Rails', days: 2, technicians: 2 },
    { name: 'INST5', days: 1, technicians: 2 },
    { name: 'INST6', days: 1, technicians: 2 },
  ],
};

export const buildIngecartOfferTemplate = (companyName = 'Ingecart 2018 SL', projectName = 'Industrial automation and installation project') => ({
  companyName,
  projectName,
  theme: 'blue-prime',
  sections: [
    'Executive summary',
    'Scope and deliverables',
    'Commercial conditions',
    'Technical assumptions',
    'Cost breakdown',
    'Commercial offer and next steps',
  ],
  summary: `Professional offer structure aligned to the ${companyName} commercial model. It includes a technical rationale, cost logic, risk controls and actionable next steps.`,
  footer: 'Prepared for a blue-branded, execution-ready commercial proposal aligned with the engineering and installation business model.',
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
