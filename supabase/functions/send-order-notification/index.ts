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

interface NotificationRequest {
  order_id: string;
  notification_type: 'status_update' | 'tracking_update' | 'custom' | 'payment_confirmed' | 'payment_rejected';
  custom_message?: string;
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

// Create LINE Flex Message for payment confirmation
function createPaymentConfirmedFlexMessage(order: any) {
  return {
    type: "flex",
    altText: `✅ ยืนยันการชำระเงินออเดอร์ ${order.order_number}`,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "✅ ยืนยันการชำระเงินสำเร็จ!",
            weight: "bold",
            size: "lg",
            color: "#00B900"
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
                  { type: "text", text: "ยอดรวม:", size: "sm", color: "#666666", flex: 5 },
                  { type: "text", text: `฿${Number(order.total_amount).toLocaleString()}`, size: "sm", color: "#00B900", weight: "bold", flex: 5, align: "end" }
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
            text: "🎉 เราได้รับชำระเงินแล้ว กำลังเตรียมจัดส่งค่ะ",
            size: "sm",
            color: "#333333",
            margin: "lg",
            wrap: true
          },
          {
            type: "text",
            text: "ขอบคุณที่ใช้บริการค่ะ 🙏",
            size: "sm",
            color: "#00B900",
            margin: "md",
            align: "center"
          }
        ]
      }
    }
  };
}

// Create LINE Flex Message for payment rejection
function createPaymentRejectedFlexMessage(order: any, reason?: string) {
  const contents: any[] = [
    {
      type: "text",
      text: "❌ สลิปไม่ผ่านการตรวจสอบ",
      weight: "bold",
      size: "lg",
      color: "#FF0000"
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
            { type: "text", text: "ยอดที่ต้องชำระ:", size: "sm", color: "#666666", flex: 5 },
            { type: "text", text: `฿${Number(order.total_amount).toLocaleString()}`, size: "sm", color: "#FF0000", weight: "bold", flex: 5, align: "end" }
          ]
        }
      ]
    }
  ];

  if (reason) {
    contents.push({
      type: "box",
      layout: "vertical",
      margin: "lg",
      backgroundColor: "#FFF0F0",
      cornerRadius: "md",
      paddingAll: "md",
      contents: [
        {
          type: "text",
          text: "⚠️ เหตุผล:",
          size: "xs",
          color: "#666666"
        },
        {
          type: "text",
          text: reason,
          size: "sm",
          color: "#FF0000",
          wrap: true
        }
      ]
    });
  }

  contents.push({
    type: "text",
    text: "📸 กรุณาส่งสลิปใหม่อีกครั้งค่ะ",
    size: "sm",
    color: "#666666",
    margin: "lg",
    align: "center",
    wrap: true
  });

  return {
    type: "flex",
    altText: `❌ สลิปออเดอร์ ${order.order_number} ไม่ผ่าน: ${reason || 'กรุณาส่งใหม่'}`,
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
    console.log(`Sending LINE notification to ${userId}`);
    
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
      console.error('LINE API error:', errorText);
      return false;
    }

    console.log('LINE notification sent successfully');
    return true;
  } catch (error) {
    console.error('Error sending LINE notification:', error);
    return false;
  }
}

async function sendToFacebook(accessToken: string, userId: string, message: string): Promise<boolean> {
  try {
    console.log(`Sending Facebook notification to ${userId}`);
    
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
      console.error('Facebook API error:', errorText);
      return false;
    }

    console.log('Facebook notification sent successfully');
    return true;
  } catch (error) {
    console.error('Error sending Facebook notification:', error);
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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Create client with anon key to verify user's JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    // Verify user is authenticated and is an admin
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has admin role using service role client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (roleError || !roleData) {
      console.log('User is not admin:', user.id);
      return new Response(
        JSON.stringify({ success: false, error: 'Forbidden - Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { order_id, notification_type, custom_message }: NotificationRequest = await req.json();

    console.log(`Processing notification for order: ${order_id}, type: ${notification_type}`);

    // Fetch order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      console.error('Order not found:', orderError);
      return new Response(
        JSON.stringify({ success: false, error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Read and decrypt API tokens from database
    const lineToken = await getDecryptedSetting(supabase, 'LINE_CHANNEL_ACCESS_TOKEN');
    const facebookToken = await getDecryptedSetting(supabase, 'FACEBOOK_PAGE_ACCESS_TOKEN');

    console.log('Tokens loaded from database:', {
      hasLineToken: !!lineToken,
      hasFacebookToken: !!facebookToken
    });

    let notificationSent = false;
    const results: { platform: string; success: boolean; error?: string }[] = [];

    // Send to LINE with Flex Messages
    if (order.platform === 'line' && order.customer_line_id) {
      if (!lineToken) {
        console.error('LINE access token not configured');
        results.push({ platform: 'line', success: false, error: 'Token not configured' });
      } else {
        let lineMessage: any;
        
        if (notification_type === 'custom' && custom_message) {
          lineMessage = { type: 'text', text: custom_message };
        } else if (notification_type === 'tracking_update' && order.tracking_number) {
          lineMessage = createTrackingUpdateFlexMessage(order);
        } else if (notification_type === 'payment_confirmed') {
          lineMessage = createPaymentConfirmedFlexMessage(order);
        } else if (notification_type === 'payment_rejected') {
          lineMessage = createPaymentRejectedFlexMessage(order, custom_message);
        } else if (notification_type === 'status_update') {
          const statusInfo = statusMessages[order.status] || statusMessages['pending'];
          lineMessage = createStatusUpdateFlexMessage(order, statusInfo);
        }

        if (lineMessage) {
          const success = await sendToLine(lineToken, order.customer_line_id, lineMessage);
          results.push({ platform: 'line', success });
          if (success) notificationSent = true;
        }
      }
    }

    // Send to Facebook with enhanced formatting
    if (order.platform === 'facebook' && order.customer_facebook_id) {
      if (!facebookToken) {
        console.error('Facebook access token not configured');
        results.push({ platform: 'facebook', success: false, error: 'Token not configured' });
      } else {
        let message = '';
        
        if (notification_type === 'custom' && custom_message) {
          message = custom_message;
        } else if (notification_type === 'tracking_update' && order.tracking_number) {
          message = `🚚 อัปเดตการจัดส่ง!\n`;
          message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
          message += `📋 หมายเลขออเดอร์: ${order.order_number}\n\n`;
          message += `📦 หมายเลขพัสดุ:\n`;
          message += `   ${order.tracking_number}\n\n`;
          message += `──────────────────\n`;
          message += `📍 สามารถติดตามพัสดุได้แล้วค่ะ\n`;
          message += `🔎 นำเลขพัสดุไปค้นหาที่เว็บขนส่ง\n\n`;
          message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
          message += `📝 พิมพ์ "ประวัติออเดอร์" เพื่อดูออเดอร์ทั้งหมด\n\n`;
          message += `ขอบคุณที่ใช้บริการค่ะ 🙏✨`;
        } else if (notification_type === 'payment_confirmed') {
          message = `✅ ยืนยันการชำระเงินสำเร็จ!\n`;
          message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
          message += `📋 หมายเลขออเดอร์: ${order.order_number}\n`;
          message += `💰 ยอดรวม: ฿${Number(order.total_amount).toLocaleString()}\n\n`;
          message += `──────────────────\n`;
          message += `🎉 เราได้รับชำระเงินแล้ว\n`;
          message += `⏳ กำลังเตรียมจัดส่งค่ะ\n\n`;
          message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
          message += `📝 พิมพ์ "ประวัติออเดอร์" เพื่อดูออเดอร์ทั้งหมด\n\n`;
          message += `ขอบคุณที่ใช้บริการค่ะ 🙏✨`;
        } else if (notification_type === 'payment_rejected') {
          message = `❌ สลิปไม่ผ่านการตรวจสอบ\n`;
          message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
          message += `📋 หมายเลขออเดอร์: ${order.order_number}\n`;
          message += `💰 ยอดที่ต้องชำระ: ฿${Number(order.total_amount).toLocaleString()}\n\n`;
          if (custom_message) {
            message += `⚠️ เหตุผล: ${custom_message}\n\n`;
          }
          message += `──────────────────\n`;
          message += `📸 กรุณาส่งสลิปใหม่อีกครั้งค่ะ\n\n`;
          message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
          message += `📝 พิมพ์ "ประวัติออเดอร์" เพื่อดูออเดอร์ทั้งหมด\n\n`;
          message += `หากมีข้อสงสัย สอบถามได้เลยค่ะ 🙏`;
        } else if (notification_type === 'status_update') {
          const statusInfo = statusMessages[order.status] || statusMessages['pending'];
          
          message = `${statusInfo.emoji} อัปเดตสถานะออเดอร์\n`;
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
          message += `📝 พิมพ์ "ประวัติออเดอร์" เพื่อดูออเดอร์ทั้งหมด\n\n`;
          message += `ขอบคุณที่ใช้บริการค่ะ 🙏✨`;
        }

        if (message) {
          const success = await sendToFacebook(facebookToken, order.customer_facebook_id, message);
          results.push({ platform: 'facebook', success });
          if (success) notificationSent = true;
        }
      }
    }

    // If web platform, we can't send push notifications
    if (order.platform === 'web') {
      console.log('Web platform - no push notification available');
      results.push({ platform: 'web', success: false, error: 'Push notification not available for web' });
    }

    return new Response(
      JSON.stringify({ 
        success: notificationSent, 
        results,
        message: notificationSent ? 'Notification sent' : 'No notification sent'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in send-order-notification:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
