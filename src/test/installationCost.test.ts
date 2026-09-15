import { describe, expect, it } from 'vitest';
import { computeInstallationCost, createInstallationPlan } from '@/lib/installationCost';
import { DEFAULT_INGECART_POLICY } from '@/lib/utils';
import { presetLineTotal } from '@/lib/productKnowledge';

describe('installation cost engine', () => {
  it('splits labour (hours + supplement + per diem) from travel expenses for a car trip in Spain', () => {
    const plan = createInstallationPlan({ days: 5, resources: 2, destination: 'spain', travelMode: 'car', distanceKm: 600, trips: 1, vehicles: 1, hotelNights: 4 });
    const result = computeInstallationCost(plan, DEFAULT_INGECART_POLICY);
    // labour: 5d x 2 tech x (10h x 65 + 80 supplement + 20 diet) = 10 x 750
    expect(result.labor).toBe(7500);
    expect(result.laborPerResourceDay).toBe(750);
    // travel: 600 km x 0.7 + 4 nights x 2 tech x 120 hotel
    expect(result.travel).toBe(420 + 960);
    expect(result.total).toBe(7500 + 1380);
  });

  it('uses international per diem, USA hotel and flights per technician when flying', () => {
    const plan = createInstallationPlan({ days: 10, resources: 3, destination: 'usa', travelMode: 'plane', trips: 2, rentalCarDays: 10, otherExpenses: 500, festiveDays: 2 });
    const result = computeInstallationCost(plan, DEFAULT_INGECART_POLICY);
    const dailyLabour = 10 * 65 + 80 + 60;
    expect(result.labor).toBe(10 * 3 * dailyLabour + 2 * 3 * 160);
    const flights = 2 * 3 * 2000;
    const hotel = 10 * 3 * 140;
    const rental = 10 * 60;
    expect(result.travel).toBe(flights + hotel + rental + 500);
  });

  it('honours explicit overrides and "other" transport', () => {
    const plan = createInstallationPlan({ days: 2, resources: 1, destination: 'europe', travelMode: 'other', otherTravelCost: 300, trips: 1, hourlyRate: 50, hoursPerDay: 8, laborSupplementPerDay: 0, dietPerDay: 25, hotelNights: 0 });
    const result = computeInstallationCost(plan, DEFAULT_INGECART_POLICY);
    expect(result.labor).toBe(2 * (8 * 50 + 25));
    expect(result.travel).toBe(300);
  });

  it('keeps legacy days x resources x unit cost when no detailed plan is attached', () => {
    expect(presetLineTotal({ category: 'installation', lineItem: 'Install', mode: 'installation', days: 8, resources: 2, unitCost: 550 })).toBe(8800);
    const plan = createInstallationPlan({ days: 8, resources: 2, travelMode: 'none', hotelNights: 0 });
    expect(presetLineTotal({ category: 'installation', lineItem: 'Install', mode: 'installation', installation: plan })).toBe(8 * 2 * (650 + 80 + 20));
  });
});
