import { supabase } from '@/integrations/supabase/client';

export interface OfferVersion {
  id: string;
  offer_id: string;
  version_number: number;
  changes_summary: string | null;
  created_at: string;
  created_by: string | null;
}

export interface OfferForEdit {
  id: string;
  serial_number: string;
  version: number;
  version_group_id: string;
  status: string;
  offer_data: Record<string, unknown>;
}

export class OfferVersionService {
  private emit(event: string, detail: Record<string, unknown>) {
    window.dispatchEvent(new CustomEvent(event, { detail }));
  }

  async getVersions(offerId: string) {
    const { data, error } = await supabase.functions.invoke('offers-api', {
      body: { action: 'offers.versions', offerId },
    });

    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(String(data.error));
    return (data?.versions || []) as OfferVersion[];
  }

  async overwriteOffer(offerId: string, editedData: Record<string, unknown>, changedBy?: string | null) {
    const { data, error } = await supabase.functions.invoke('offers-api', {
      body: {
        action: 'offers.overwrite',
        offerId,
        editedData,
        changedBy: changedBy || null,
      },
    });

    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(String(data.error));
    this.emit('offer.updated', { offerId });
    return data as { success: true; offerId: string };
  }

  async createNewVersion(offer: OfferForEdit, editedData: Record<string, unknown>, changedBy?: string | null) {
    const nextVersion = Number(offer.version || 1) + 1;
    if (nextVersion > 20) {
      throw new Error('Maximum 20 versions reached. Archive old versions first.');
    }

    const serial = `${offer.serial_number}-V${nextVersion}`;

    const { data, error } = await supabase.functions.invoke('offers-api', {
      body: {
        action: 'offers.create-version',
        offerId: offer.id,
        versionNumber: nextVersion,
        serialNumber: serial,
        editedData,
        changedBy: changedBy || null,
      },
    });

    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(String(data.error));
    this.emit('offer.versioned', { offerId: data.newVersionId, version: data.version });
    return data as { newVersionId: string; serialNumber: string; version: number };
  }
}
