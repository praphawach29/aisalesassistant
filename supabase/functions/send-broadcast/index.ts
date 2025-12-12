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

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const supabaseAuth = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Check admin role
    const { data: roleData } = await supabaseAuth
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), { 
        status: 403, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const body = await req.json();
    const { broadcast_id, message, image_url, target_audience = 'all' } = body;

    if (!broadcast_id || !message) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Get LINE access token
    const lineAccessToken = await getDecryptedSetting(supabase, 'LINE_CHANNEL_ACCESS_TOKEN');
    if (!lineAccessToken) {
      await supabase.from('broadcast_messages').update({ 
        status: 'failed',
        completed_at: new Date().toISOString()
      }).eq('id', broadcast_id);

      return new Response(JSON.stringify({ error: 'LINE token not configured' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Update broadcast status to sending
    await supabase.from('broadcast_messages').update({ 
      status: 'sending' 
    }).eq('id', broadcast_id);

    // Get all LINE users based on target audience
    let query = supabase
      .from('chat_conversations')
      .select('platform_user_id')
      .eq('platform', 'line')
      .not('platform_user_id', 'is', null);

    if (target_audience === 'with_orders') {
      // Get users who have made orders
      const { data: orderUsers } = await supabase
        .from('orders')
        .select('customer_line_id')
        .not('customer_line_id', 'is', null);
      
      const lineIds = [...new Set(orderUsers?.map(o => o.customer_line_id).filter(Boolean))];
      if (lineIds.length > 0) {
        query = query.in('platform_user_id', lineIds);
      }
    } else if (target_audience === 'recent') {
      // Get users active in last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      query = query.gte('last_message_at', thirtyDaysAgo.toISOString());
    }

    const { data: users, error: usersError } = await query;

    if (usersError) {
      console.error('Error fetching users:', usersError);
      await supabase.from('broadcast_messages').update({ 
        status: 'failed',
        completed_at: new Date().toISOString()
      }).eq('id', broadcast_id);

      return new Response(JSON.stringify({ error: 'Failed to fetch users' }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const uniqueUserIds = [...new Set(users?.map(u => u.platform_user_id).filter(Boolean))];
    console.log(`Sending broadcast to ${uniqueUserIds.length} LINE users`);

    let successCount = 0;
    let failedCount = 0;

    // Send message to each user
    for (const userId of uniqueUserIds) {
      try {
        const messages: any[] = [];
        
        // Add text message
        messages.push({ type: 'text', text: message });
        
        // Add image if provided
        if (image_url) {
          messages.push({
            type: 'image',
            originalContentUrl: image_url,
            previewImageUrl: image_url
          });
        }

        const response = await fetch('https://api.line.me/v2/bot/message/push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${lineAccessToken}`
          },
          body: JSON.stringify({
            to: userId,
            messages: messages
          })
        });

        if (response.ok) {
          successCount++;
        } else {
          const errorText = await response.text();
          console.error(`Failed to send to ${userId}:`, errorText);
          failedCount++;
        }
      } catch (error) {
        console.error(`Error sending to ${userId}:`, error);
        failedCount++;
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Update broadcast record
    await supabase.from('broadcast_messages').update({
      status: 'completed',
      sent_count: uniqueUserIds.length,
      success_count: successCount,
      failed_count: failedCount,
      completed_at: new Date().toISOString()
    }).eq('id', broadcast_id);

    return new Response(JSON.stringify({
      success: true,
      sent_count: uniqueUserIds.length,
      success_count: successCount,
      failed_count: failedCount
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Broadcast error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});