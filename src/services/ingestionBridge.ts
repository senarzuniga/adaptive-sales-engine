import { supabase } from '@/integrations/supabase/client';

export type IntelligenceType =
  | 'pricing_alert'
  | 'competitor_movement'
  | 'market_trend'
  | 'sales_opportunity';

export interface IntelligenceOutput {
  type: IntelligenceType;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  suggested_action: string;
  source_url: string;
  created_at: string;
}

class IngestionBridge {
  async getLatestIntelligence(limit = 10): Promise<IntelligenceOutput[]> {
    const { data, error } = await (supabase as any)
      .from('intelligence_outputs')
      .select('type,title,description,impact,suggested_action,source_url,created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.warn('[ingestionBridge] getLatestIntelligence failed:', error.message);
      return [];
    }
    return (data || []) as IntelligenceOutput[];
  }

  async getCompetitivePricing(productCategory: string) {
    const { data, error } = await (supabase as any)
      .from('competitive_intelligence')
      .select('competitor,price,specs,last_updated')
      .eq('product_category', productCategory);

    if (error) {
      console.warn('[ingestionBridge] getCompetitivePricing failed:', error.message);
      return [];
    }
    return data || [];
  }

  async triggerManualExtraction(url: string, dataType: string) {
    const { data, error } = await supabase.functions.invoke('trigger-ingestion', {
      body: {
        url,
        data_type: dataType,
        triggered_by: 'manual',
      },
    });
    return { data, error };
  }

  async createActionFromIntelligence(intelligence: IntelligenceOutput) {
    if (intelligence.impact === 'low') {
      return { created: false };
    }

    const { error } = await (supabase as any).from('actions').insert({
      name: intelligence.title,
      goal: intelligence.description,
      description: intelligence.suggested_action,
      department: 'Commercial',
      status: 'open',
      comments: '',
      importance_score: intelligence.impact === 'high' ? 90 : 75,
      strategy_alignment: 85,
      estimated_hours: 2,
      supportive_content: {
        source_url: intelligence.source_url,
        suggested_next_step: intelligence.suggested_action,
      },
    });

    if (error) {
      return { created: false, error };
    }
    return { created: true };
  }
}

export const ingestionBridge = new IngestionBridge();
