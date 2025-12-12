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

// Send LINE message
async function sendLineMessage(userId: string, messages: any[], accessToken: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ to: userId, messages })
    });
    return response.ok;
  } catch (error) {
    console.error('LINE send error:', error);
    return false;
  }
}

// Send Facebook message
async function sendFacebookMessage(userId: string, message: string, imageUrl: string | null, accessToken: string): Promise<boolean> {
  try {
    const textResponse = await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${accessToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: userId },
        message: { text: message }
      })
    });
    
    if (!textResponse.ok) return false;
    
    if (imageUrl) {
      await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${accessToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: userId },
          message: {
            attachment: {
              type: 'image',
              payload: { url: imageUrl, is_reusable: true }
            }
          }
        })
      });
    }
    
    return true;
  } catch (error) {
    console.error('Facebook send error:', error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Find scheduled broadcasts that are due
    const now = new Date().toISOString();
    const { data: broadcasts, error: fetchError } = await supabase
      .from('broadcast_messages')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_at', now)
      .order('scheduled_at', { ascending: true })
      .limit(10);

    if (fetchError) {
      console.error('Error fetching scheduled broadcasts:', fetchError);
      return new Response(JSON.stringify({ error: 'Failed to fetch broadcasts' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!broadcasts || broadcasts.length === 0) {
      console.log('No scheduled broadcasts to process');
      return new Response(JSON.stringify({ message: 'No broadcasts to process', processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Processing ${broadcasts.length} scheduled broadcasts`);

    // Get access tokens
    const lineAccessToken = await getDecryptedSetting(supabase, 'LINE_CHANNEL_ACCESS_TOKEN');
    const facebookAccessToken = await getDecryptedSetting(supabase, 'FACEBOOK_PAGE_ACCESS_TOKEN');

    let processedCount = 0;

    for (const broadcast of broadcasts) {
      const { id, content: message, image_url, target_audience, platform } = broadcast;

      console.log(`Processing broadcast ${id} for platform ${platform}`);

      // Update status to sending
      await supabase.from('broadcast_messages').update({ status: 'sending' }).eq('id', id);

      // Get users based on platform and target audience
      const platformsToSend = platform === 'all' ? ['line', 'facebook'] : [platform];
      let allUsers: { platform: string; platform_user_id: string }[] = [];

      for (const p of platformsToSend) {
        let query = supabase
          .from('chat_conversations')
          .select('platform, platform_user_id')
          .eq('platform', p)
          .not('platform_user_id', 'is', null);

        if (target_audience === 'with_orders') {
          const orderField = p === 'line' ? 'customer_line_id' : 'customer_facebook_id';
          const { data: orderUsers } = await supabase
            .from('orders')
            .select(orderField)
            .not(orderField, 'is', null);
          
          const ids = [...new Set(orderUsers?.map((o: any) => o[orderField]).filter(Boolean))];
          if (ids.length > 0) {
            query = query.in('platform_user_id', ids);
          }
        } else if (target_audience === 'recent') {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          query = query.gte('last_message_at', thirtyDaysAgo.toISOString());
        }

        const { data: users } = await query;
        if (users) {
          allUsers = [...allUsers, ...users.filter(u => u.platform_user_id)];
        }
      }

      // Remove duplicates
      const uniqueUsers = Array.from(new Map(allUsers.map(u => [`${u.platform}-${u.platform_user_id}`, u])).values());
      console.log(`Sending broadcast ${id} to ${uniqueUsers.length} users`);

      let successCount = 0;
      let failedCount = 0;

      for (const userInfo of uniqueUsers) {
        try {
          let success = false;

          if (userInfo.platform === 'line' && lineAccessToken) {
            const messages: any[] = [{ type: 'text', text: message }];
            if (image_url) {
              messages.push({ type: 'image', originalContentUrl: image_url, previewImageUrl: image_url });
            }
            success = await sendLineMessage(userInfo.platform_user_id, messages, lineAccessToken);
          } else if (userInfo.platform === 'facebook' && facebookAccessToken) {
            success = await sendFacebookMessage(userInfo.platform_user_id, message, image_url, facebookAccessToken);
          }

          if (success) {
            successCount++;
          } else {
            failedCount++;
          }
        } catch (error) {
          console.error(`Error sending to ${userInfo.platform_user_id}:`, error);
          failedCount++;
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Update broadcast record
      await supabase.from('broadcast_messages').update({
        status: 'completed',
        sent_count: uniqueUsers.length,
        success_count: successCount,
        failed_count: failedCount,
        completed_at: new Date().toISOString()
      }).eq('id', id);

      processedCount++;
      console.log(`Broadcast ${id} completed: ${successCount} success, ${failedCount} failed`);
    }

    return new Response(JSON.stringify({
      success: true,
      processed: processedCount
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Process scheduled broadcasts error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
