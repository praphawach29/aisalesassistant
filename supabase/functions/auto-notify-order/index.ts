import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ENCRYPTION_KEY = Deno.env.get('ENCRYPTION_KEY') || '';

async function getKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
  return await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
}

async function decrypt(encryptedText: string): Promise<string> {
  if (!encryptedText) return '';
  
  try {
    const key = await getKey();
    const combined = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));
    
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );
    
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    return encryptedText;
  }
}

async function getDecryptedSetting(supabase: any, key: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  
  if (error || !data?.value) return null;
  
  return await decrypt(data.value);
}

const statusMessages: Record<string, { text: string; emoji: string; color: string }> = {
  pending: { text: 'รอดำเนินการ', emoji: '⏳', color: '#FFA500' },
  confirmed: { text: 'ยืนยันแล้ว', emoji: '✅', color: '#00B900' },
  shipped: { text: 'จัดส่งแล้ว', emoji: '🚚', color: '#1E90FF' },
  delivered: { text: 'ส่งสำเร็จ', emoji: '📦', color: '#32CD32' },
  cancelled: { text: 'ยกเลิก', emoji: '❌', color: '#FF0000' },
};

// Create LINE Flex Message for status update
function createStatusUpdateFlexMessage(order: any, statusInfo: { text: string; emoji: string; color: string }) {
  const contents: any[] = [
    {
      type: "text",
      text: `${statusInfo.emoji} อัปเดตสถานะออเดอร์`,
      weight: "bold",
      size: "lg",
      color: "#333333"
    },
    {
      type: "separator",
      margin: "lg"
    },
    {
      type: "box",
      layout: "vertical",
      margin: "lg",
      spacing: "sm",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          contents: [
            { type: "text", text: "หมายเลข:", size: "sm", color: "#666666", flex: 3 },
            { type: "text", text: order.order_number, size: "sm", color: "#333333", weight: "bold", flex: 7, align: "end" }
          ]
        },
        {
          type: "box",
          layout: "horizontal",
          contents: [
            { type: "text", text: "สถานะ:", size: "sm", color: "#666666", flex: 3 },
            { type: "text", text: statusInfo.text, size: "sm", color: statusInfo.color, weight: "bold", flex: 7, align: "end" }
          ]
        }
      ]
    }
  ];

  // Add tracking number if shipped
  if (order.status === 'shipped' && order.tracking_number) {
    contents.push({
      type: "box",
      layout: "horizontal",
      margin: "sm",
      contents: [
        { type: "text", text: "เลขพัสดุ:", size: "sm", color: "#666666", flex: 3 },
        { type: "text", text: order.tracking_number, size: "sm", color: "#1E90FF", weight: "bold", flex: 7, align: "end" }
      ]
    });
  }

  contents.push({
    type: "text",
    text: "ขอบคุณที่ใช้บริการค่ะ 🙏",
    size: "sm",
    color: "#00B900",
    margin: "lg",
    align: "center"
  });

  return {
    type: "flex",
    altText: `อัปเดตสถานะ ${order.order_number}: ${statusInfo.text}`,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents
      }
    }
  };
}

// Create LINE Flex Message for tracking update
function createTrackingUpdateFlexMessage(order: any) {
  return {
    type: "flex",
    altText: `เลขพัสดุออเดอร์ ${order.order_number}: ${order.tracking_number}`,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "🚚 อัปเดตการจัดส่ง!",
            weight: "bold",
            size: "lg",
            color: "#1E90FF"
          },
          {
            type: "separator",
            margin: "lg"
          },
          {
            type: "box",
            layout: "vertical",
            margin: "lg",
            spacing: "sm",
            contents: [
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "หมายเลขออเดอร์:", size: "sm", color: "#666666", flex: 5 },
                  { type: "text", text: order.order_number, size: "sm", color: "#333333", weight: "bold", flex: 5, align: "end" }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "เลขพัสดุ:", size: "sm", color: "#666666", flex: 5 },
                  { type: "text", text: order.tracking_number, size: "md", color: "#1E90FF", weight: "bold", flex: 5, align: "end" }
                ]
              }
            ]
          },
          {
            type: "separator",
            margin: "lg"
          },
          {
            type: "text",
            text: "📍 สามารถติดตามพัสดุได้แล้วค่ะ",
            size: "sm",
            color: "#00B900",
            margin: "lg",
            align: "center",
            wrap: true
          }
        ]
      }
    }
  };
}

async function sendToLine(accessToken: string, userId: string, message: any): Promise<boolean> {
  try {
    console.log(`[AUTO-NOTIFY] Sending LINE notification to ${userId}`);
    
    const messages = Array.isArray(message) ? message : [message];
    
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        to: userId,
        messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AUTO-NOTIFY] LINE API error:', errorText);
      return false;
    }

    console.log('[AUTO-NOTIFY] LINE notification sent successfully');
    return true;
  } catch (error) {
    console.error('[AUTO-NOTIFY] Error sending LINE notification:', error);
    return false;
  }
}

async function sendToFacebook(accessToken: string, userId: string, message: string): Promise<boolean> {
  try {
    console.log(`[AUTO-NOTIFY] Sending Facebook notification to ${userId}`);
    
    const response = await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${accessToken}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipient: { id: userId },
        message: { text: message },
        messaging_type: 'UPDATE',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AUTO-NOTIFY] Facebook API error:', errorText);
      return false;
    }

    console.log('[AUTO-NOTIFY] Facebook notification sent successfully');
    return true;
  } catch (error) {
    console.error('[AUTO-NOTIFY] Error sending Facebook notification:', error);
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { order_id, notification_type, old_status, new_status } = await req.json();

    console.log(`[AUTO-NOTIFY] Processing automatic notification for order: ${order_id}`);
    console.log(`[AUTO-NOTIFY] Status change: ${old_status} -> ${new_status}`);
    console.log(`[AUTO-NOTIFY] Notification type: ${notification_type}`);

    // Check if auto-notify is enabled
    const { data: autoNotifySetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'AUTO_NOTIFY_CUSTOMERS')
      .maybeSingle();

    const isAutoNotifyEnabled = autoNotifySetting?.value !== 'false'; // Default to true if not set

    if (!isAutoNotifyEnabled) {
      console.log('[AUTO-NOTIFY] Automatic notifications are disabled by admin');
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Automatic notifications are disabled',
          disabled: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      console.error('[AUTO-NOTIFY] Order not found:', orderError);
      return new Response(
        JSON.stringify({ success: false, error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[AUTO-NOTIFY] Order found: ${order.order_number}, platform: ${order.platform}`);

    // Read and decrypt API tokens from database
    const lineToken = await getDecryptedSetting(supabase, 'LINE_CHANNEL_ACCESS_TOKEN');
    const facebookToken = await getDecryptedSetting(supabase, 'FACEBOOK_PAGE_ACCESS_TOKEN');

    console.log('[AUTO-NOTIFY] Tokens loaded:', {
      hasLineToken: !!lineToken,
      hasFacebookToken: !!facebookToken
    });

    let notificationSent = false;
    const results: { platform: string; success: boolean; error?: string }[] = [];

    // Send to LINE
    if (order.platform === 'line' && order.customer_line_id) {
      if (!lineToken) {
        console.error('[AUTO-NOTIFY] LINE access token not configured');
        results.push({ platform: 'line', success: false, error: 'Token not configured' });
      } else {
        let lineMessage: any;
        
        if (notification_type === 'tracking_update' && order.tracking_number) {
          lineMessage = createTrackingUpdateFlexMessage(order);
        } else {
          const statusInfo = statusMessages[order.status] || statusMessages['pending'];
          lineMessage = createStatusUpdateFlexMessage(order, statusInfo);
        }

        const success = await sendToLine(lineToken, order.customer_line_id, lineMessage);
        results.push({ platform: 'line', success });
        if (success) notificationSent = true;
      }
    }

    // Send to Facebook
    if (order.platform === 'facebook' && order.customer_facebook_id) {
      if (!facebookToken) {
        console.error('[AUTO-NOTIFY] Facebook access token not configured');
        results.push({ platform: 'facebook', success: false, error: 'Token not configured' });
      } else {
        const statusInfo = statusMessages[order.status] || statusMessages['pending'];
        
        let message = `${statusInfo.emoji} อัปเดตสถานะออเดอร์\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        message += `📋 หมายเลขออเดอร์: ${order.order_number}\n\n`;
        message += `📊 สถานะ: ${statusInfo.text}\n`;
        
        // Add tracking number if shipped
        if (order.tracking_number && order.status === 'shipped') {
          message += `\n📦 หมายเลขพัสดุ:\n`;
          message += `   ${order.tracking_number}\n`;
          message += `\n📍 สามารถติดตามพัสดุได้แล้วค่ะ\n`;
        }
        
        // Status-specific messages
        if (order.status === 'confirmed') {
          message += `\n⏳ กำลังเตรียมสินค้าให้ค่ะ\n`;
        } else if (order.status === 'delivered') {
          message += `\n✅ สินค้าถึงมือแล้ว หากมีปัญหาแจ้งได้เลยค่ะ\n`;
        } else if (order.status === 'cancelled') {
          message += `\n❌ ออเดอร์ถูกยกเลิก หากมีข้อสงสัยแจ้งได้เลยค่ะ\n`;
        }
        
        message += `\n━━━━━━━━━━━━━━━━━━━━━━\n`;
        message += `ขอบคุณที่ใช้บริการค่ะ 🙏✨`;

        const success = await sendToFacebook(facebookToken, order.customer_facebook_id, message);
        results.push({ platform: 'facebook', success });
        if (success) notificationSent = true;
      }
    }

    // Log for web platform
    if (order.platform === 'web') {
      console.log('[AUTO-NOTIFY] Web platform - no push notification available');
      results.push({ platform: 'web', success: false, error: 'Push notification not available for web' });
    }

    console.log(`[AUTO-NOTIFY] Notification results:`, results);

    return new Response(
      JSON.stringify({ 
        success: notificationSent, 
        results,
        message: notificationSent ? 'Automatic notification sent' : 'No notification sent'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[AUTO-NOTIFY] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
