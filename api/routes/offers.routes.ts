import { OfferSerialNumberService } from '../../src/services/offer/OfferSerialNumberService';
import { OfferVersionService } from '../../src/services/offer/OfferVersionService';
import { ContentLibraryService } from '../../src/services/offer/ContentLibraryService';
import { OfferDocumentGenerator } from '../../src/services/offer/OfferDocumentGenerator';
import { PaymentMilestoneService } from '../../src/services/payments/PaymentMilestoneService';

const serialService = new OfferSerialNumberService();
const versionService = new OfferVersionService();
const contentService = new ContentLibraryService();
const documentGenerator = new OfferDocumentGenerator();
const paymentService = new PaymentMilestoneService();

export interface ApiRequest {
  method: string;
  body?: any;
  params?: Record<string, string>;
}

export interface ApiResponse {
  status: number;
  data: unknown;
}

export async function generateSerialRoute(): Promise<ApiResponse> {
  const serial = await serialService.getNextSerial();
  return { status: 200, data: { serial } };
}

export async function createOfferRoute(req: ApiRequest): Promise<ApiResponse> {
  const payload = req.body || {};
  const created = await serialService.createOffer(payload);
  return { status: 200, data: created };
}

export async function getVersionsRoute(req: ApiRequest): Promise<ApiResponse> {
  const offerId = String(req.params?.id || '');
  const versions = await versionService.getVersions(offerId);
  return { status: 200, data: { versions } };
}

export async function createVersionRoute(req: ApiRequest): Promise<ApiResponse> {
  const body = req.body || {};
  const created = await versionService.createNewVersion(body.offer, body.editedData, body.changedBy);
  return { status: 200, data: created };
}

export async function overwriteRoute(req: ApiRequest): Promise<ApiResponse> {
  const offerId = String(req.params?.id || '');
  const body = req.body || {};
  const result = await versionService.overwriteOffer(offerId, body.editedData || {}, body.changedBy);
  return { status: 200, data: result };
}

export async function finalizeRoute(req: ApiRequest): Promise<ApiResponse> {
  const offerId = String(req.params?.id || '');
  const result = await serialService.finalizeOffer(offerId);
  return { status: 200, data: result };
}

export async function getTemplateRoute(req: ApiRequest): Promise<ApiResponse> {
  const type = String(req.params?.type || 'machine_selling');
  const templates = await contentService.getTemplates(type as any);
  return { status: 200, data: { structure: templates[0]?.structure || {} } };
}

export async function getContentBlocksRoute(): Promise<ApiResponse> {
  const blocks = await contentService.getContentBlocks();
  return { status: 200, data: { blocks } };
}

export async function createContentBlockRoute(req: ApiRequest): Promise<ApiResponse> {
  const block = await contentService.createContentBlock(req.body || {});
  return { status: 200, data: { blockId: block.id } };
}

export async function getConditionsLibraryRoute(): Promise<ApiResponse> {
  const conditions = await contentService.getConditionsLibrary();
  return { status: 200, data: { conditions } };
}

export async function generateDocumentRoute(req: ApiRequest): Promise<ApiResponse> {
  const offer = req.body?.offer;
  if (!offer?.id) return { status: 400, data: { error: 'offer.id is required' } };

  const selectedSectionIds: string[] = Array.isArray(req.body?.selectedSectionIds) ? req.body.selectedSectionIds : [];
  const assignments = new Map<string, string>(Object.entries(req.body?.assignments || {}));

  const [clientMilestones, costConcepts] = await Promise.all([
    paymentService.getClientMilestones(offer.id),
    paymentService.getCostConcepts(offer.id),
  ]);

  const buffer = await documentGenerator.generateWord(offer, selectedSectionIds, assignments, {
    clientMilestones,
    costConcepts,
  });

  return { status: 200, data: { base64: Buffer.from(buffer).toString('base64') } };
}
