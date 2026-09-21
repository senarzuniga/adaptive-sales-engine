import type { CompanyProfile } from '@/store/DataStore';

export type OfferDocumentLanguage = 'en' | 'es';

export interface OfferDocumentRecord {
  id: string;
  offerId?: string;
  offerNumber: string;
  accountName: string;
  fileName: string;
  fileType: 'DOCX';
  owner: string;
  updatedAt: string;
  language: OfferDocumentLanguage;
  path?: string;
  projectFolder?: string;
  source: 'generated' | 'external-reference';
}

const normalizePathPart = (value: string) => value.replace(/[<>:"/\\|?*]+/g, ' ').replace(/\s+/g, ' ').trim();

export const normalizeAccountName = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

export const getOfferDocumentsStorageKey = (companyId: string) => `ase_offer_documents_${companyId}`;

export const readOfferDocuments = (companyId: string | null | undefined): OfferDocumentRecord[] => {
  if (!companyId) return [];
  try {
    const raw = localStorage.getItem(getOfferDocumentsStorageKey(companyId));
    return raw ? JSON.parse(raw) as OfferDocumentRecord[] : [];
  } catch {
    return [];
  }
};

export const writeOfferDocuments = (companyId: string | null | undefined, rows: OfferDocumentRecord[]) => {
  if (!companyId) return;
  if (rows.length === 0) {
    localStorage.removeItem(getOfferDocumentsStorageKey(companyId));
    return;
  }
  localStorage.setItem(getOfferDocumentsStorageKey(companyId), JSON.stringify(rows));
};

export const upsertOfferDocument = (companyId: string | null | undefined, row: OfferDocumentRecord) => {
  if (!companyId) return;
  const existing = readOfferDocuments(companyId);
  const next = [
    row,
    ...existing.filter((candidate) => candidate.id !== row.id && !(candidate.offerId && row.offerId && candidate.offerId === row.offerId && candidate.language === row.language)),
  ];
  writeOfferDocuments(companyId, next);
};

export const buildSuggestedOfferProjectFolder = (company: CompanyProfile, accountName: string) => {
  const safeAccount = normalizePathPart(accountName || 'Customer');
  const companyName = String(company.company_name || '').toLowerCase();
  if (companyName.includes('ingecart')) {
    return `C:\\Users\\isena\\Documents\\INGECART\\COMMERCIAL\\PROYECTOS\\${safeAccount}`;
  }
  const safeCompany = normalizePathPart(company.company_name || 'Company');
  return `C:\\Users\\isena\\Documents\\${safeCompany}\\COMMERCIAL\\PROJECTS\\${safeAccount}`;
};

export const buildOfferDocumentPath = (projectFolder: string | null | undefined, fileName: string) => {
  const safeFile = normalizePathPart(fileName);
  if (!projectFolder) return safeFile;
  return `${projectFolder}\\${safeFile}`;
};
export const listOfferDocuments = (companyId: string | null | undefined) => readOfferDocuments(companyId);
