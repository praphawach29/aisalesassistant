import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ENCRYPTION_KEY = Deno.env.get('ENCRYPTION_KEY') || '';

// Decryption utilities
async function getKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
  return await crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM' }, false, ['decrypt']);
}

async function decrypt(encryptedText: string): Promise<string> {
  if (!encryptedText) return '';
  try {
    const key = await getKey();
    const combined = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    return encryptedText;
  }
}

async function getDecryptedSetting(supabase: any, key: string): Promise<string | null> {
  const { data, error } = await supabase.from('settings').select('value').eq('key', key).maybeSingle();
  if (error || !data?.value) return null;
  return await decrypt(data.value);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

  try {
    const { conversationId } = await req.json();

    // Get conversations without names
    let query = supabase
      .from('chat_conversations')
      .select('*')
      .is('customer_name', null);

    if (conversationId) {
      query = query.eq('id', conversationId);
    }

    const { data: conversations, error: convError } = await query;

    if (convError) {
      throw new Error(`Error fetching conversations: ${convError.message}`);
    }

    if (!conversations || conversations.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No conversations to update', updated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get API tokens
    const lineAccessToken = await getDecryptedSetting(supabase, 'LINE_CHANNEL_ACCESS_TOKEN');
    const fbPageAccessToken = await getDecryptedSetting(supabase, 'FB_PAGE_ACCESS_TOKEN');

    let updatedCount = 0;
    const errors: string[] = [];

    for (const conv of conversations) {
      try {
        let customerName: string | null = null;

        if (conv.platform === 'line' && lineAccessToken && conv.platform_user_id) {
          // Fetch from LINE Profile API
          const profileResponse = await fetch(`https://api.line.me/v2/bot/profile/${conv.platform_user_id}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${lineAccessToken}` }
          });

          if (profileResponse.ok) {
            const profile = await profileResponse.json();
            customerName = profile.displayName || null;
            console.log(`[LINE] Got profile for ${conv.platform_user_id}: ${customerName}`);
          } else {
            console.log(`[LINE] Failed to get profile for ${conv.platform_user_id}: ${profileResponse.status}`);
          }
        } else if (conv.platform === 'facebook' && fbPageAccessToken && conv.platform_user_id) {
          // Fetch from Facebook Graph API
          const profileResponse = await fetch(
            `https://graph.facebook.com/${conv.platform_user_id}?fields=first_name,last_name,name&access_token=${fbPageAccessToken}`
          );

          if (profileResponse.ok) {
            const profile = await profileResponse.json();
            customerName = profile.name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || null;
            console.log(`[FB] Got profile for ${conv.platform_user_id}: ${customerName}`);
          } else {
            console.log(`[FB] Failed to get profile for ${conv.platform_user_id}: ${profileResponse.status}`);
          }
        }

        if (customerName) {
          const { error: updateError } = await supabase
            .from('chat_conversations')
            .update({ customer_name: customerName })
            .eq('id', conv.id);

          if (updateError) {
            errors.push(`Failed to update ${conv.id}: ${updateError.message}`);
          } else {
            updatedCount++;
          }
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`Error processing ${conv.id}: ${errorMsg}`);
        console.error(`Error processing conversation ${conv.id}:`, err);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Updated ${updatedCount} of ${conversations.length} conversations`,
        updated: updatedCount,
        total: conversations.length,
        errors: errors.length > 0 ? errors : undefined
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('Error in update-customer-names:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
