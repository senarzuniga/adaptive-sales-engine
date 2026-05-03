import { PaymentMilestoneService } from '../../src/services/payments/PaymentMilestoneService';
import type { ApiRequest, ApiResponse } from './offers.routes';

const service = new PaymentMilestoneService();

export async function getCashFlowRoute(req: ApiRequest): Promise<ApiResponse> {
  const offerId = String(req.params?.id || '');
  const contractStartDate = req.body?.contractStartDate as string | undefined;
  const data = await service.generateCashFlow(offerId, contractStartDate);
  return { status: 200, data };
}

export async function optimizeCashFlowRoute(req: ApiRequest): Promise<ApiResponse> {
  const offerId = String(req.params?.id || '');
  const contractStartDate = req.body?.contractStartDate as string | undefined;
  const scenarios = await service.optimizeCashFlow(offerId, contractStartDate);
  return { status: 200, data: { scenarios } };
}

export async function applyCashFlowScenarioRoute(req: ApiRequest): Promise<ApiResponse> {
  const offerId = String(req.params?.id || '');
  const scenarioId = String(req.body?.scenarioId || '');
  const result = await service.applyScenario(offerId, scenarioId);
  return { status: 200, data: result };
}

export async function exportCashFlowRoute(req: ApiRequest): Promise<ApiResponse> {
  const offerId = String(req.params?.id || '');
  const contractStartDate = req.body?.contractStartDate as string | undefined;
  const csv = await service.exportCashFlowCsv(offerId, contractStartDate);
  return { status: 200, data: { format: 'csv', content: csv } };
}

export async function validatePaymentTermsRoute(req: ApiRequest): Promise<ApiResponse> {
  const offerId = String(req.params?.id || '');
  const validation = await service.validatePaymentTerms(offerId);
  return { status: 200, data: validation };
}
