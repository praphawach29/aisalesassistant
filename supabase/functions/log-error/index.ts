import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    const body = await req.json();
    const {
      error_type = 'frontend',
      error_code,
      error_message,
      error_stack,
      context,
      source,
      url,
      session_id,
      severity = 'error'
    } = body;

    // Get client info
    const ip_address = req.headers.get('x-forwarded-for') || 
                       req.headers.get('cf-connecting-ip') || 
                       'unknown';
    const user_agent = req.headers.get('user-agent') || 'unknown';

    // Validate required fields
    if (!error_message) {
      return new Response(
        JSON.stringify({ error: 'error_message is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert error log
    const { data, error } = await supabase
      .from('error_logs')
      .insert({
        error_type,
        error_code,
        error_message,
        error_stack,
        context,
        source,
        url,
        session_id,
        ip_address,
        user_agent,
        severity
      })
      .select('id')
      .single();

    if (error) {
      console.error('Failed to log error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to log error', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Error Logged] ${severity.toUpperCase()}: ${error_message.substring(0, 100)}... (id: ${data.id})`);

    return new Response(
      JSON.stringify({ success: true, error_id: data.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('log-error function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
