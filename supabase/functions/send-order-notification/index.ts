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
  notification_type: 'status_update' | 'tracking_update' | 'custom' | 'payment_confirmed' | 'payment_rejected' | 'order_receipt';
  custom_message?: string;
}

interface OrderItem {
  product_name: string;
  quantity: number;
  price: number;
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

async function sendToFacebook(accessToken: string, userId: string, message: any): Promise<boolean> {
  try {
    console.log(`Sending Facebook notification to ${userId}`);
    
    const response = await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${accessToken}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipient: { id: userId },
        message: message,
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

// Create Facebook Generic Template for status update
function createFacebookStatusUpdateTemplate(order: any, statusInfo: { text: string; emoji: string; color: string }) {
  let subtitle = `📋 ${order.order_number}\n💰 ฿${Number(order.total_amount).toLocaleString()}\n📊 สถานะ: ${statusInfo.text}`;
  
  if (order.status === 'shipped' && order.tracking_number) {
    subtitle += `\n📦 เลขพัสดุ: ${order.tracking_number}`;
  }
  
  const buttons: any[] = [
    {
      type: "postback",
      title: "📜 ประวัติออเดอร์",
      payload: "CHECK_ORDER_HISTORY"
    }
  ];
  
  // Add tracking button if shipped
  if (order.status === 'shipped' && order.tracking_number) {
    buttons.unshift({
      type: "web_url",
      title: "🔍 ติดตามพัสดุ",
      url: `https://track.thailandpost.co.th/?trackNumber=${order.tracking_number}`,
      webview_height_ratio: "full"
    });
  }
  
  return {
    attachment: {
      type: "template",
      payload: {
        template_type: "generic",
        elements: [
          {
            title: `${statusInfo.emoji} อัปเดตสถานะออเดอร์`,
            subtitle: subtitle,
            buttons: buttons
          }
        ]
      }
    }
  };
}

// Create Facebook Generic Template for payment confirmation
function createFacebookPaymentConfirmedTemplate(order: any) {
  return {
    attachment: {
      type: "template",
      payload: {
        template_type: "generic",
        elements: [
          {
            title: "✅ ยืนยันการชำระเงินสำเร็จ!",
            subtitle: `📋 ${order.order_number}\n💰 ยอดรวม: ฿${Number(order.total_amount).toLocaleString()}\n\n🎉 กำลังเตรียมจัดส่งค่ะ`,
            buttons: [
              {
                type: "postback",
                title: "📜 ประวัติออเดอร์",
                payload: "CHECK_ORDER_HISTORY"
              }
            ]
          }
        ]
      }
    }
  };
}

// Create Facebook Generic Template for payment rejection
function createFacebookPaymentRejectedTemplate(order: any, reason?: string) {
  let subtitle = `📋 ${order.order_number}\n💰 ยอดที่ต้องชำระ: ฿${Number(order.total_amount).toLocaleString()}`;
  if (reason) {
    subtitle += `\n\n⚠️ เหตุผล: ${reason}`;
  }
  subtitle += `\n\n📸 กรุณาส่งสลิปใหม่อีกครั้งค่ะ`;
  
  return {
    attachment: {
      type: "template",
      payload: {
        template_type: "generic",
        elements: [
          {
            title: "❌ สลิปไม่ผ่านการตรวจสอบ",
            subtitle: subtitle,
            buttons: [
              {
                type: "postback",
                title: "📜 ดูรายละเอียดออเดอร์",
                payload: "CHECK_ORDER_HISTORY"
              }
            ]
          }
        ]
      }
    }
  };
}

// Create Facebook Generic Template for tracking update
function createFacebookTrackingUpdateTemplate(order: any) {
  return {
    attachment: {
      type: "template",
      payload: {
        template_type: "generic",
        elements: [
          {
            title: "🚚 อัปเดตการจัดส่ง!",
            subtitle: `📋 ${order.order_number}\n📦 เลขพัสดุ: ${order.tracking_number}\n\n📍 สามารถติดตามพัสดุได้แล้วค่ะ`,
            buttons: [
              {
                type: "web_url",
                title: "🔍 ติดตามพัสดุ",
                url: `https://track.thailandpost.co.th/?trackNumber=${order.tracking_number}`,
                webview_height_ratio: "full"
              },
              {
                type: "postback",
                title: "📜 ประวัติออเดอร์",
                payload: "CHECK_ORDER_HISTORY"
              }
            ]
          }
        ]
      }
    }
  };
}

// Create Facebook Receipt Template for order summary
function createFacebookReceiptTemplate(order: any, orderItems: OrderItem[]) {
  const elements = orderItems.map(item => ({
    title: item.product_name,
    subtitle: `จำนวน: ${item.quantity} ชิ้น`,
    quantity: item.quantity,
    price: item.price * item.quantity,
    currency: "THB"
  }));

  const subtotal = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const discount = order.discount_amount || 0;

  return {
    attachment: {
      type: "template",
      payload: {
        template_type: "receipt",
        recipient_name: order.customer_name,
        order_number: order.order_number,
        currency: "THB",
        payment_method: "โอนเงิน",
        order_url: "",
        timestamp: Math.floor(new Date(order.created_at).getTime() / 1000).toString(),
        address: {
          street_1: order.customer_address,
          city: "",
          postal_code: "",
          state: "",
          country: "TH"
        },
        summary: {
          subtotal: subtotal,
          shipping_cost: 0,
          total_tax: 0,
          total_cost: order.total_amount
        },
        elements: elements,
        adjustments: discount > 0 ? [
          {
            name: order.coupon_code ? `ส่วนลด (${order.coupon_code})` : "ส่วนลด",
            amount: -discount
          }
        ] : []
      }
    }
  };
}

// Create LINE Flex Message for order receipt
function createLineReceiptFlexMessage(order: any, orderItems: OrderItem[]) {
  const itemContents = orderItems.map(item => ({
    type: "box",
    layout: "horizontal",
    contents: [
      {
        type: "text",
        text: item.product_name,
        size: "sm",
        color: "#333333",
        flex: 6,
        wrap: true
      },
      {
        type: "text",
        text: `x${item.quantity}`,
        size: "sm",
        color: "#666666",
        flex: 1,
        align: "center"
      },
      {
        type: "text",
        text: `฿${(item.price * item.quantity).toLocaleString()}`,
        size: "sm",
        color: "#333333",
        flex: 3,
        align: "end"
      }
    ]
  }));

  const subtotal = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const discount = order.discount_amount || 0;

  const summaryContents: any[] = [
    {
      type: "separator",
      margin: "lg"
    },
    {
      type: "box",
      layout: "horizontal",
      margin: "lg",
      contents: [
        { type: "text", text: "รวม", size: "sm", color: "#666666", flex: 1 },
        { type: "text", text: `฿${subtotal.toLocaleString()}`, size: "sm", color: "#333333", flex: 1, align: "end" }
      ]
    }
  ];

  if (discount > 0) {
    summaryContents.push({
      type: "box",
      layout: "horizontal",
      contents: [
        { type: "text", text: order.coupon_code ? `ส่วนลด (${order.coupon_code})` : "ส่วนลด", size: "sm", color: "#00B900", flex: 1 },
        { type: "text", text: `-฿${discount.toLocaleString()}`, size: "sm", color: "#00B900", flex: 1, align: "end" }
      ]
    });
  }

  summaryContents.push(
    {
      type: "separator",
      margin: "lg"
    },
    {
      type: "box",
      layout: "horizontal",
      margin: "lg",
      contents: [
        { type: "text", text: "ยอดรวมสุทธิ", size: "md", color: "#333333", weight: "bold", flex: 1 },
        { type: "text", text: `฿${Number(order.total_amount).toLocaleString()}`, size: "lg", color: "#1E90FF", weight: "bold", flex: 1, align: "end" }
      ]
    }
  );

  return {
    type: "flex",
    altText: `ใบเสร็จออเดอร์ ${order.order_number}`,
    contents: {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "🧾 ใบเสร็จออเดอร์",
            weight: "bold",
            size: "xl",
            color: "#1E90FF"
          },
          {
            type: "text",
            text: order.order_number,
            size: "sm",
            color: "#666666",
            margin: "sm"
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
                  { type: "text", text: "ลูกค้า:", size: "sm", color: "#666666", flex: 3 },
                  { type: "text", text: order.customer_name, size: "sm", color: "#333333", flex: 7, align: "end" }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "โทร:", size: "sm", color: "#666666", flex: 3 },
                  { type: "text", text: order.customer_phone, size: "sm", color: "#333333", flex: 7, align: "end" }
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
            text: "รายการสินค้า",
            size: "sm",
            color: "#666666",
            margin: "lg"
          },
          {
            type: "box",
            layout: "vertical",
            margin: "sm",
            spacing: "sm",
            contents: itemContents
          },
          ...summaryContents,
          {
            type: "text",
            text: "ขอบคุณที่ใช้บริการค่ะ 🙏",
            size: "sm",
            color: "#00B900",
            margin: "xl",
            align: "center"
          }
        ]
      }
    }
  };
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

    // Fetch order items if needed for receipt
    let orderItems: OrderItem[] = [];
    if (notification_type === 'order_receipt') {
      const { data: items, error: itemsError } = await supabase
        .from('order_items')
        .select('product_name, quantity, price')
        .eq('order_id', order_id);
      
      if (itemsError) {
        console.error('Error fetching order items:', itemsError);
      } else {
        orderItems = items || [];
      }
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
        } else if (notification_type === 'order_receipt' && orderItems.length > 0) {
          lineMessage = createLineReceiptFlexMessage(order, orderItems);
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

    // Send to Facebook with beautiful Templates
    if (order.platform === 'facebook' && order.customer_facebook_id) {
      if (!facebookToken) {
        console.error('Facebook access token not configured');
        results.push({ platform: 'facebook', success: false, error: 'Token not configured' });
      } else {
        let fbMessage: any = null;
        
        if (notification_type === 'custom' && custom_message) {
          fbMessage = { text: custom_message };
        } else if (notification_type === 'tracking_update' && order.tracking_number) {
          fbMessage = createFacebookTrackingUpdateTemplate(order);
        } else if (notification_type === 'payment_confirmed') {
          fbMessage = createFacebookPaymentConfirmedTemplate(order);
        } else if (notification_type === 'payment_rejected') {
          fbMessage = createFacebookPaymentRejectedTemplate(order, custom_message);
        } else if (notification_type === 'order_receipt' && orderItems.length > 0) {
          fbMessage = createFacebookReceiptTemplate(order, orderItems);
        } else if (notification_type === 'status_update') {
          const statusInfo = statusMessages[order.status] || statusMessages['pending'];
          fbMessage = createFacebookStatusUpdateTemplate(order, statusInfo);
        }

        if (fbMessage) {
          const success = await sendToFacebook(facebookToken, order.customer_facebook_id, fbMessage);
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
