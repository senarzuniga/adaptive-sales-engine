import { PaymentMilestoneService } from '../../src/services/payments/PaymentMilestoneService';
import type { ApiRequest, ApiResponse } from './offers.routes';

const service = new PaymentMilestoneService();

export async function getPaymentMilestonesRoute(req: ApiRequest): Promise<ApiResponse> {
  const offerId = String(req.params?.id || '');
  const milestones = await service.getClientMilestones(offerId);
  return { status: 200, data: { milestones } };
}

export async function createOrReplacePaymentMilestonesRoute(req: ApiRequest): Promise<ApiResponse> {
  const offerId = String(req.params?.id || '');
  const milestones = Array.isArray(req.body?.milestones) ? req.body.milestones : [];
  const saved = await service.upsertClientMilestones(offerId, milestones);
  return { status: 200, data: { milestones: saved } };
}

export async function updatePaymentMilestoneRoute(req: ApiRequest): Promise<ApiResponse> {
  const offerId = String(req.params?.id || '');
  const milestoneId = String(req.params?.mid || '');
  const milestone = await service.updateClientMilestone(offerId, milestoneId, req.body || {});
  return { status: 200, data: { milestone } };
}

export async function deletePaymentMilestoneRoute(req: ApiRequest): Promise<ApiResponse> {
  const offerId = String(req.params?.id || '');
  const milestoneId = String(req.params?.mid || '');
  await service.deleteClientMilestone(offerId, milestoneId);
  return { status: 200, data: { success: true } };
}

export async function getCostConceptsRoute(req: ApiRequest): Promise<ApiResponse> {
  const offerId = String(req.params?.id || '');
  const concepts = await service.getCostConcepts(offerId);
  return { status: 200, data: { concepts } };
}

export async function createCostConceptRoute(req: ApiRequest): Promise<ApiResponse> {
  const offerId = String(req.params?.id || '');
  const concept = await service.createCostConcept(offerId, req.body || {});
  return { status: 200, data: { concept } };
}

export async function updateCostConceptRoute(req: ApiRequest): Promise<ApiResponse> {
  const offerId = String(req.params?.id || '');
  const conceptId = String(req.params?.cid || '');
  const concept = await service.updateCostConcept(offerId, conceptId, req.body || {});
  return { status: 200, data: { concept } };
}

export async function deleteCostConceptRoute(req: ApiRequest): Promise<ApiResponse> {
  const offerId = String(req.params?.id || '');
  const conceptId = String(req.params?.cid || '');
  await service.deleteCostConcept(offerId, conceptId);
  return { status: 200, data: { success: true } };
}

export async function addSupplierPaymentRoute(req: ApiRequest): Promise<ApiResponse> {
  const offerId = String(req.params?.id || '');
  const conceptId = String(req.params?.cid || '');
  const payment = await service.addSupplierPayment(offerId, conceptId, req.body || {});
  return { status: 200, data: { payment } };
}
