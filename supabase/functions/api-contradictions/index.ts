import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'PATCH, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'PATCH') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    );

    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/functions\/v1\//, '');
    const match = path.match(/api\/contradictions\/([^/]+)\/resolve$/);
    const contradictionId = match?.[1];

    if (!contradictionId) {
      return new Response(JSON.stringify({ error: 'Invalid contradiction path' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const resolvedValue = String(body?.resolvedValue || '').trim();
    const resolvedByUserId = String(body?.resolvedByUserId || '').trim();

    if (!resolvedValue) {
      return new Response(JSON.stringify({ error: 'resolvedValue is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error } = await supabase
      .from('ingestion_contradictions')
      .update({
        status: 'resolved',
        resolved_value: resolvedValue,
        resolved_by_user_id: resolvedByUserId || null,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', contradictionId);

    if (error) throw new Error(error.message);

    return new Response(JSON.stringify({ success: true, id: contradictionId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
