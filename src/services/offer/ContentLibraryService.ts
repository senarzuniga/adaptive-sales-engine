import { supabase } from '@/integrations/supabase/client';
import type { OfferTemplateType } from '@/services/offer/offerTemplates';

export interface OfferContentBlock {
  id: string;
  template_type: string;
  section_id: string;
  block_type: string;
  title: string;
  content: string;
  variables: Record<string, string>;
  usage_count: number;
  is_default: boolean;
  created_at: string;
  last_used_at: string | null;
}

export interface OfferContentTemplate {
  id: string;
  template_name: string;
  template_type: string;
  structure: Record<string, unknown>;
  is_active: boolean;
  version: number;
}

export class ContentLibraryService {
  async getContentBlocks(templateType?: OfferTemplateType | 'common') {
    let query = supabase
      .from('offer_content_blocks')
      .select('*')
      .order('is_default', { ascending: false })
      .order('usage_count', { ascending: false });

    if (templateType) {
      query = query.in('template_type', [templateType, 'common']);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data || []) as OfferContentBlock[];
  }

  async createContentBlock(payload: Partial<OfferContentBlock>) {
    const { data, error } = await supabase
      .from('offer_content_blocks')
      .insert({
        template_type: payload.template_type || 'common',
        section_id: payload.section_id || 'general',
        block_type: payload.block_type || 'text',
        title: payload.title || 'Untitled block',
        content: payload.content || '',
        variables: payload.variables || {},
        is_default: Boolean(payload.is_default),
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return data as OfferContentBlock;
  }

  async updateContentBlock(id: string, payload: Partial<OfferContentBlock>) {
    const { data, error } = await supabase
      .from('offer_content_blocks')
      .update({ ...payload, last_used_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return data as OfferContentBlock;
  }

  async deleteContentBlock(id: string) {
    const { error } = await supabase.from('offer_content_blocks').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  async markBlockUsed(id: string) {
    const { error } = await supabase.rpc('increment_offer_content_usage', { p_block_id: id });
    if (error) {
      await supabase
        .from('offer_content_blocks')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', id);
    }
  }

  async getTemplates(type?: OfferTemplateType) {
    let query = supabase
      .from('offer_content_templates')
      .select('*')
      .eq('is_active', true)
      .order('version', { ascending: false });

    if (type) query = query.eq('template_type', type);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data || []) as OfferContentTemplate[];
  }

  async getConditionsLibrary() {
    const { data, error } = await supabase
      .from('offer_content_blocks')
      .select('*')
      .eq('section_id', 'legal_conditions')
      .order('is_default', { ascending: false })
      .order('title');

    if (error) throw new Error(error.message);
    return (data || []) as OfferContentBlock[];
  }
}
