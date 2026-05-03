import { supabase } from '@/integrations/supabase/client';

export interface OfferDraftInput {
  companyId: string;
  title: string;
  clientEntityId?: string | null;
  clientEntityHash?: string | null;
  customerName?: string;
  templateType: 'machine_selling' | 'service_selling';
  validUntil?: string | null;
  currency?: string;
  offerData?: Record<string, unknown>;
  totalAmount?: number;
  createdBy?: string | null;
}

export interface OfferRecord {
  id: string;
  serial_number: string;
  version: number;
  version_group_id: string;
  status: string;
}

export class OfferSerialNumberService {
  private emit(event: string, detail: Record<string, unknown>) {
    window.dispatchEvent(new CustomEvent(event, { detail }));
  }

  async getNextSerial() {
    const { data, error } = await supabase.functions.invoke('offers-api', {
      body: { action: 'offers.generate-serial' },
    });

    if (error) throw new Error(error.message);
    if (!data?.serial) throw new Error('Could not generate serial number.');
    return String(data.serial);
  }

  async createOffer(input: OfferDraftInput) {
    const { data, error } = await supabase.functions.invoke('offers-api', {
      body: {
        action: 'offers.create',
        payload: {
          company_id: input.companyId,
          title: input.title,
          client_entity_id: input.clientEntityId || null,
          client_entity_hash: input.clientEntityHash || null,
          customer_name: input.customerName || null,
          template_type: input.templateType,
          valid_until: input.validUntil || null,
          currency: input.currency || 'EUR',
          offer_data: input.offerData || {},
          total_amount: Number(input.totalAmount || 0),
          created_by: input.createdBy || null,
          last_modified_by: input.createdBy || null,
        },
      },
    });

    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(String(data.error));
    this.emit('offer.created', { offerId: data.offerId, serialNumber: data.serialNumber });
    return data as { offerId: string; serialNumber: string; offer: OfferRecord };
  }

  async finalizeOffer(offerId: string) {
    const { data, error } = await supabase.functions.invoke('offers-api', {
      body: { action: 'offers.finalize', offerId },
    });

    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(String(data.error));
    this.emit('offer.finalized', { offerId, finalizedAt: data.finalizedAt });
    return data as { finalizedAt: string };
  }
}
