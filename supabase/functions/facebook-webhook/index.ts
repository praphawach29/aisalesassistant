import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const statusMap: Record<string, { text: string; emoji: string }> = {
  'pending': { text: 'รอยืนยัน', emoji: '⏳' },
  'confirmed': { text: 'ยืนยันแล้ว', emoji: '✅' },
  'shipped': { text: 'จัดส่งแล้ว', emoji: '🚚' },
  'delivered': { text: 'ได้รับแล้ว', emoji: '📦' },
  'cancelled': { text: 'ยกเลิก', emoji: '❌' }
};

// Format order status message
function formatOrderStatusMessage(order: any, orderItems: any[]): string {
  const statusInfo = statusMap[order.status] || statusMap['pending'];
  
  let message = `${statusInfo.emoji} สถานะออเดอร์\n`;
  message += `━━━━━━━━━━━━━━━\n`;
  message += `📋 ${order.order_number}\n`;
  message += `สถานะ: ${statusInfo.text}\n`;
  
  if (order.tracking_number) {
    message += `🚚 เลขพัสดุ: ${order.tracking_number}\n`;
  }
  
  message += `\n📦 รายการสินค้า:\n`;
  for (const item of orderItems) {
    message += `• ${item.product_name} x${item.quantity} = ฿${(item.price * item.quantity).toLocaleString()}\n`;
  }
  
  message += `\n💰 ยอดรวม: ฿${Number(order.total_amount).toLocaleString()}\n`;
  message += `🕐 สั่งเมื่อ: ${new Date(order.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  
  return message;
}

// Format order history message
function formatOrderHistoryMessage(orders: any[]): string {
  let message = `📋 ประวัติออเดอร์ของคุณ (${orders.length} รายการล่าสุด)\n`;
  message += `━━━━━━━━━━━━━━━\n\n`;
  
  for (const order of orders) {
    const statusInfo = statusMap[order.status] || statusMap['pending'];
    message += `${statusInfo.emoji} ${order.order_number}\n`;
    message += `   สถานะ: ${statusInfo.text}\n`;
    message += `   ยอดรวม: ฿${Number(order.total_amount).toLocaleString()}\n`;
    if (order.tracking_number) {
      message += `   เลขพัสดุ: ${order.tracking_number}\n`;
    }
    message += `   วันที่: ${new Date(order.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}\n\n`;
  }
  
  message += `💡 พิมพ์เลขออเดอร์เพื่อดูรายละเอียดค่ะ`;
  return message;
}

async function sendToFacebook(recipientId: string, message: string, accessToken: string) {
  if (!accessToken) {
    console.error("FB_PAGE_ACCESS_TOKEN not configured");
    return;
  }

  const response = await fetch(
    `https://graph.facebook.com/v18.0/me/messages?access_token=${accessToken}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: message },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("Facebook send error:", error);
  }
}

async function getAIResponse(messages: Array<{ role: string; content: string }>, supabase: any): Promise<string> {
  if (!LOVABLE_API_KEY) {
    return "ขออภัยครับ ระบบยังไม่พร้อมให้บริการ";
  }

  // Fetch products for context
  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true);

  const productCatalog = products?.map((p: any) => 
    `- ${p.name}: ฿${p.price}${p.promotion_price ? ` (โปรโมชั่น: ฿${p.promotion_price})` : ''}`
  ).join('\n') || 'ยังไม่มีสินค้า';

  const systemPrompt = `คุณคือผู้ช่วยขายอัจฉริยะทาง Facebook Messenger พูดภาษาไทยสุภาพ ตอบสั้นกระชับ

สินค้าที่มี:
${productCatalog}

หลักการ:
- ตอบสั้น ได้ใจความ
- ช่วยแนะนำสินค้าและรับออเดอร์
- ถ้าลูกค้าสั่งซื้อ ให้เก็บข้อมูล: ชื่อ, ที่อยู่, เบอร์โทร
- ถ้าลูกค้าถามเรื่องออเดอร์ แนะนำให้พิมพ์ "ประวัติออเดอร์" หรือพิมพ์เลขออเดอร์โดยตรง`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
      }),
    });

    if (!response.ok) {
      console.error("AI error:", await response.text());
      return "ขออภัยครับ ระบบมีปัญหาชั่วคราว กรุณาลองใหม่อีกครั้ง";
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "ขออภัยครับ ไม่สามารถประมวลผลได้";

  } catch (error) {
    console.error("AI call error:", error);
    return "ขออภัยครับ ระบบมีปัญหา กรุณาลองใหม่ภายหลัง";
  }
}

serve(async (req) => {
  const url = new URL(req.url);

  // Handle webhook verification (GET request from Facebook)
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    console.log("Facebook verification:", { mode, token, challenge });

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    // Get verify token from settings
    const { data: settings } = await supabase
      .from("settings")
      .select("key, value")
      .eq("key", "FACEBOOK_VERIFY_TOKEN")
      .maybeSingle();

    const FB_VERIFY_TOKEN = settings?.value;

    if (mode === "subscribe" && token === FB_VERIFY_TOKEN) {
      console.log("Facebook webhook verified");
      return new Response(challenge, { status: 200 });
    }

    return new Response("Forbidden", { status: 403 });
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("Facebook webhook received:", JSON.stringify(body, null, 2));

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Fetch Facebook token from database settings
    const { data: settings } = await supabase
      .from("settings")
      .select("key, value")
      .eq("key", "FACEBOOK_PAGE_ACCESS_TOKEN")
      .maybeSingle();

    const FB_PAGE_ACCESS_TOKEN = settings?.value;

    if (!FB_PAGE_ACCESS_TOKEN) {
      console.error("FACEBOOK_PAGE_ACCESS_TOKEN not configured in settings");
      return new Response(JSON.stringify({ error: "Facebook token not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process messaging events
    for (const entry of body.entry || []) {
      for (const event of entry.messaging || []) {
        const senderId = event.sender?.id;
        const message = event.message;

        if (!senderId || !message?.text) continue;

        const userMessage = message.text;
        console.log(`Facebook message from ${senderId}: ${userMessage}`);

        // Find or create conversation
        let { data: conversation } = await supabase
          .from("chat_conversations")
          .select("*")
          .eq("platform", "facebook")
          .eq("platform_user_id", senderId)
          .maybeSingle();

        if (!conversation) {
          const { data: newConv } = await supabase
            .from("chat_conversations")
            .insert({
              platform: "facebook",
              platform_user_id: senderId,
            })
            .select()
            .single();
          conversation = newConv;
        }

        if (!conversation) {
          await sendToFacebook(senderId, "ขออภัยครับ เกิดข้อผิดพลาด", FB_PAGE_ACCESS_TOKEN);
          continue;
        }

        // Save user message
        await supabase.from("chat_messages").insert({
          conversation_id: conversation.id,
          role: "user",
          content: userMessage,
        });

        // Check for order number pattern to check order status
        const orderNumberMatch = userMessage.match(/ORD-\d{8}-\d{4}/i);
        if (orderNumberMatch) {
          const orderNumber = orderNumberMatch[0].toUpperCase();
          console.log("Order status check requested for:", orderNumber);

          // Find order by order number
          const { data: order } = await supabase
            .from("orders")
            .select("*")
            .eq("order_number", orderNumber)
            .maybeSingle();

          if (order) {
            // Get order items
            const { data: orderItems } = await supabase
              .from("order_items")
              .select("*")
              .eq("order_id", order.id);

            const statusMessage = formatOrderStatusMessage(order, orderItems || []);

            // Save bot response
            await supabase.from("chat_messages").insert({
              conversation_id: conversation.id,
              role: "assistant",
              content: `สถานะออเดอร์ ${orderNumber}: ${order.status}`,
            });

            // Update last message
            await supabase
              .from("chat_conversations")
              .update({
                last_message: `สถานะ: ${order.status}`,
                last_message_at: new Date().toISOString(),
              })
              .eq("id", conversation.id);

            await sendToFacebook(senderId, statusMessage, FB_PAGE_ACCESS_TOKEN);
            continue;
          } else {
            // Order not found
            await supabase.from("chat_messages").insert({
              conversation_id: conversation.id,
              role: "assistant",
              content: `ไม่พบออเดอร์หมายเลข ${orderNumber}`,
            });

            await sendToFacebook(
              senderId, 
              `ขออภัยค่ะ ไม่พบออเดอร์หมายเลข ${orderNumber} ในระบบ 😔\n\nกรุณาตรวจสอบหมายเลขออเดอร์อีกครั้ง หรือติดต่อเจ้าหน้าที่ค่ะ`,
              FB_PAGE_ACCESS_TOKEN
            );
            continue;
          }
        }

        // Check for order history request
        const orderHistoryKeywords = ['ประวัติออเดอร์', 'ประวัติคำสั่งซื้อ', 'ออเดอร์ทั้งหมด', 'ดูออเดอร์', 'รายการสั่งซื้อ'];
        const isOrderHistoryRequest = orderHistoryKeywords.some(keyword => 
          userMessage.toLowerCase().includes(keyword.toLowerCase())
        );

        if (isOrderHistoryRequest) {
          console.log("Order history requested for Facebook user:", senderId);

          // Find orders by customer Facebook ID
          const { data: orders } = await supabase
            .from("orders")
            .select("*")
            .eq("customer_facebook_id", senderId)
            .order("created_at", { ascending: false })
            .limit(10);

          if (orders && orders.length > 0) {
            const historyMessage = formatOrderHistoryMessage(orders);

            // Save bot response
            await supabase.from("chat_messages").insert({
              conversation_id: conversation.id,
              role: "assistant",
              content: `แสดงประวัติออเดอร์ ${orders.length} รายการ`,
            });

            // Update last message
            await supabase
              .from("chat_conversations")
              .update({
                last_message: `ประวัติออเดอร์ ${orders.length} รายการ`,
                last_message_at: new Date().toISOString(),
              })
              .eq("id", conversation.id);

            await sendToFacebook(senderId, historyMessage, FB_PAGE_ACCESS_TOKEN);
            continue;
          } else {
            // No orders found
            await supabase.from("chat_messages").insert({
              conversation_id: conversation.id,
              role: "assistant",
              content: "ไม่พบประวัติออเดอร์",
            });

            await sendToFacebook(
              senderId, 
              `📋 ยังไม่มีประวัติออเดอร์ค่ะ\n\nหากต้องการสั่งซื้อสินค้า พิมพ์ "ดูสินค้า" หรือสอบถามได้เลยค่ะ 😊`,
              FB_PAGE_ACCESS_TOKEN
            );
            continue;
          }
        }

        // Get conversation history
        const { data: history } = await supabase
          .from("chat_messages")
          .select("*")
          .eq("conversation_id", conversation.id)
          .order("created_at", { ascending: true })
          .limit(20);

        const messages = history?.map((m: any) => ({
          role: m.role,
          content: m.content,
        })) || [{ role: "user", content: userMessage }];

        // Get AI response
        const aiResponse = await getAIResponse(messages, supabase);

        // Save AI response
        await supabase.from("chat_messages").insert({
          conversation_id: conversation.id,
          role: "assistant",
          content: aiResponse,
        });

        // Update conversation
        await supabase
          .from("chat_conversations")
          .update({
            last_message: aiResponse.slice(0, 100),
            last_message_at: new Date().toISOString(),
          })
          .eq("id", conversation.id);

        // Send response to Facebook
        await sendToFacebook(senderId, aiResponse, FB_PAGE_ACCESS_TOKEN);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Facebook webhook error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
