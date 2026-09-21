import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REPOSITORY,
  PLAN_POSTVENTA_ACTION_COUNT,
  buildPlanPostventaImportedActions,
  cloneRepository,
  ensureSeededPlanPostventaActions,
  flattenActions,
} from '@/lib/commercialActionsRepository';

describe('commercial actions repository postventa import', () => {
  it('builds the seeded Plan Postventa actions from the Excel extract', () => {
    const actions = buildPlanPostventaImportedActions();

    expect(actions).toHaveLength(PLAN_POSTVENTA_ACTION_COUNT);
    expect(actions).toHaveLength(27);

    const lowPriorityBudget = actions.find((action) => action.id === 'PLAN_POSTVENTA_FONT_SISTEMA_CARGA_CAMIONES_4');
    expect(lowPriorityBudget?.importance_score).toBe(69);
    expect(lowPriorityBudget?.strategy_alignment).toBe(72);

    const highPriorityCompliance = actions.find((action) => action.id === 'PLAN_POSTVENTA_FONT_PALETIZADOR_MACARBOX_1');
    expect(highPriorityCompliance?.importance_score).toBe(91);
    expect(highPriorityCompliance?.strategy_alignment).toBe(97);
  });

  it('seeds missing Plan Postventa actions only once', () => {
    const seeded = ensureSeededPlanPostventaActions(cloneRepository(DEFAULT_REPOSITORY));
    const seededAgain = ensureSeededPlanPostventaActions(seeded);

    expect(flattenActions(seeded).length).toBe(flattenActions(DEFAULT_REPOSITORY).length + PLAN_POSTVENTA_ACTION_COUNT);
    expect(flattenActions(seededAgain).length).toBe(flattenActions(seeded).length);
    expect(seededAgain.version).toBe(seeded.version);
  });
});
