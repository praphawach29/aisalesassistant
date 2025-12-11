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

interface OrderData {
  productName: string;
  quantity: number;
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  variants?: string;
}

interface CartAction {
  action: 'add' | 'view' | 'clear' | 'checkout';
  productName?: string;
  quantity?: number;
  variants?: string;
  customerName?: string;
  customerAddress?: string;
  customerPhone?: string;
}

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

// Format cart summary message
function formatCartSummaryMessage(cartItems: Array<{product_name: string; quantity: number; price: number; variants?: string}>, totalAmount: number): string {
  if (cartItems.length === 0) {
    return `🛒 ตะกร้าว่างเปล่าค่ะ\n\nพิมพ์ "ดูสินค้า" เพื่อเลือกสินค้าได้เลยค่ะ 😊`;
  }

  let message = `🛒 ตะกร้าสินค้าของคุณ\n`;
  message += `━━━━━━━━━━━━━━━\n\n`;
  
  for (const item of cartItems) {
    message += `• ${item.product_name}`;
    if (item.variants) message += ` (${item.variants})`;
    message += ` x${item.quantity}\n`;
    message += `   ฿${(item.price * item.quantity).toLocaleString()}\n\n`;
  }
  
  message += `━━━━━━━━━━━━━━━\n`;
  message += `💰 รวมทั้งหมด: ฿${totalAmount.toLocaleString()}\n\n`;
  message += `📝 พิมพ์ "สั่งซื้อตะกร้า ชื่อ ที่อยู่ เบอร์โทร" เพื่อสั่งซื้อ\n`;
  message += `🗑️ พิมพ์ "ล้างตะกร้า" เพื่อล้างตะกร้า`;
  
  return message;
}

// Format order confirmation message
function formatOrderConfirmationMessage(orderNumber: string, items: Array<{product_name: string; quantity: number; price: number}>, totalAmount: number, customerName: string, customerAddress: string): string {
  let message = `✅ ยืนยันการสั่งซื้อสำเร็จ!\n`;
  message += `━━━━━━━━━━━━━━━\n\n`;
  message += `📋 หมายเลขออเดอร์: ${orderNumber}\n\n`;
  
  message += `📦 รายการสินค้า:\n`;
  for (const item of items) {
    message += `• ${item.product_name} x${item.quantity} = ฿${(item.price * item.quantity).toLocaleString()}\n`;
  }
  
  message += `\n💰 ยอดรวม: ฿${totalAmount.toLocaleString()}\n\n`;
  message += `🚚 ข้อมูลจัดส่ง:\n`;
  message += `   ชื่อ: ${customerName}\n`;
  message += `   ที่อยู่: ${customerAddress}\n\n`;
  message += `ขอบคุณที่ใช้บริการค่ะ 🙏`;
  
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

async function getAIResponse(
  messages: Array<{ role: string; content: string }>, 
  supabase: any,
  cartItemCount: number = 0
): Promise<{ text: string; createOrder?: OrderData; cartAction?: CartAction }> {
  if (!LOVABLE_API_KEY) {
    return { text: "ขออภัยครับ ระบบยังไม่พร้อมให้บริการ" };
  }

  // Fetch products for context
  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true);

  const productCatalog = products?.map((p: any) => {
    let variantInfo = "";
    if (p.variants && p.variants.length > 0) {
      variantInfo = ` [ตัวเลือก: ${p.variants.map((v: any) => `${v.name}(${v.options.join('/')})`).join(', ')}]`;
    }
    return `- ${p.name}: ฿${p.price}${p.promotion_price ? ` (โปรโมชั่น: ฿${p.promotion_price})` : ''}${variantInfo}`;
  }).join('\n') || 'ยังไม่มีสินค้า';

  const cartInfo = cartItemCount > 0 
    ? `\n\n🛒 ลูกค้ามีสินค้าในตะกร้า ${cartItemCount} รายการ`
    : '';

  const systemPrompt = `คุณคือผู้ช่วยขายอัจฉริยะทาง Facebook Messenger พูดภาษาไทยสุภาพ ตอบสั้นกระชับ${cartInfo}

สินค้าที่มี:
${productCatalog}

หลักการ:
- ตอบสั้น ได้ใจความ ไม่เกิน 200 ตัวอักษร
- ช่วยแนะนำสินค้าและรับออเดอร์

**🛒 ระบบตะกร้าสินค้า:**
- ถ้าลูกค้าต้องการ "เพิ่มลงตะกร้า" หรือ "ใส่ตะกร้า" → ตอบ [ADD_CART:ชื่อสินค้า|จำนวน|ตัวเลือก]
- ถ้าลูกค้าถาม "ดูตะกร้า" หรือ "ตะกร้าของฉัน" → ตอบ [VIEW_CART]
- ถ้าลูกค้าต้องการ "ล้างตะกร้า" → ตอบ [CLEAR_CART]
- ถ้าลูกค้าพิมพ์ "สั่งซื้อตะกร้า" หรือ "ยืนยันสั่งซื้อ" พร้อมข้อมูลครบ (ชื่อ ที่อยู่ เบอร์) → ตอบ [CHECKOUT_CART:ชื่อลูกค้า|ที่อยู่|เบอร์โทร]

**การสั่งซื้อตรง:**
- ถ้าลูกค้าให้ข้อมูลครบถ้วน (ชื่อสินค้า จำนวน ชื่อ ที่อยู่ เบอร์โทร) → ตอบ [CREATE_ORDER:ชื่อสินค้า|จำนวน|ชื่อลูกค้า|ที่อยู่|เบอร์โทร|ตัวเลือก]

ตัวอย่าง:
- "เพิ่มเสื้อ 2 ตัว ลงตะกร้า" → "เพิ่มลงตะกร้าแล้วค่ะ 😊 [ADD_CART:เสื้อ|2|]"
- "สั่งซื้อตะกร้า ชื่อสมชาย ที่อยู่ 123 ถ.สุขุมวิท เบอร์ 0812345678" → "รับออเดอร์แล้วค่ะ 😊 [CHECKOUT_CART:สมชาย|123 ถ.สุขุมวิท|0812345678]"`;

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
      return { text: "ขออภัยครับ ระบบมีปัญหาชั่วคราว กรุณาลองใหม่อีกครั้ง" };
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || "ขออภัยครับ ไม่สามารถประมวลผลได้";

    // Parse special commands
    const createOrderMatch = content.match(/\[CREATE_ORDER:([^\]]+)\]/);
    const addCartMatch = content.match(/\[ADD_CART:([^\]]+)\]/);
    const viewCartMatch = content.match(/\[VIEW_CART\]/);
    const clearCartMatch = content.match(/\[CLEAR_CART\]/);
    const checkoutCartMatch = content.match(/\[CHECKOUT_CART:([^\]]+)\]/);

    // Parse order data if present
    let createOrder: OrderData | undefined;
    if (createOrderMatch) {
      const orderParts = createOrderMatch[1].split('|');
      if (orderParts.length >= 5) {
        createOrder = {
          productName: orderParts[0].trim(),
          quantity: parseInt(orderParts[1].trim()) || 1,
          customerName: orderParts[2].trim(),
          customerAddress: orderParts[3].trim(),
          customerPhone: orderParts[4].trim(),
          variants: orderParts[5]?.trim() || undefined
        };
      }
    }

    // Parse cart action if present
    let cartAction: CartAction | undefined;
    if (addCartMatch) {
      const parts = addCartMatch[1].split('|');
      cartAction = {
        action: 'add',
        productName: parts[0]?.trim(),
        quantity: parseInt(parts[1]?.trim()) || 1,
        variants: parts[2]?.trim() || undefined
      };
    } else if (viewCartMatch) {
      cartAction = { action: 'view' };
    } else if (clearCartMatch) {
      cartAction = { action: 'clear' };
    } else if (checkoutCartMatch) {
      const parts = checkoutCartMatch[1].split('|');
      cartAction = {
        action: 'checkout',
        customerName: parts[0]?.trim(),
        customerAddress: parts[1]?.trim(),
        customerPhone: parts[2]?.trim()
      };
    }

    // Clean up the response
    content = content
      .replace(/\[CREATE_ORDER:[^\]]+\]/g, '')
      .replace(/\[ADD_CART:[^\]]+\]/g, '')
      .replace(/\[VIEW_CART\]/g, '')
      .replace(/\[CLEAR_CART\]/g, '')
      .replace(/\[CHECKOUT_CART:[^\]]+\]/g, '')
      .trim();

    return { text: content, createOrder, cartAction };

  } catch (error) {
    console.error("AI call error:", error);
    return { text: "ขออภัยครับ ระบบมีปัญหา กรุณาลองใหม่ภายหลัง" };
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

          const { data: order } = await supabase
            .from("orders")
            .select("*")
            .eq("order_number", orderNumber)
            .maybeSingle();

          if (order) {
            const { data: orderItems } = await supabase
              .from("order_items")
              .select("*")
              .eq("order_id", order.id);

            const statusMessage = formatOrderStatusMessage(order, orderItems || []);

            await supabase.from("chat_messages").insert({
              conversation_id: conversation.id,
              role: "assistant",
              content: `สถานะออเดอร์ ${orderNumber}: ${order.status}`,
            });

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
            await supabase.from("chat_messages").insert({
              conversation_id: conversation.id,
              role: "assistant",
              content: `ไม่พบออเดอร์หมายเลข ${orderNumber}`,
            });

            await sendToFacebook(
              senderId, 
              `ขออภัยค่ะ ไม่พบออเดอร์หมายเลข ${orderNumber} ในระบบ 😔\n\nกรุณาตรวจสอบหมายเลขออเดอร์อีกครั้งค่ะ`,
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

          const { data: orders } = await supabase
            .from("orders")
            .select("*")
            .eq("customer_facebook_id", senderId)
            .order("created_at", { ascending: false })
            .limit(10);

          if (orders && orders.length > 0) {
            const historyMessage = formatOrderHistoryMessage(orders);

            await supabase.from("chat_messages").insert({
              conversation_id: conversation.id,
              role: "assistant",
              content: `แสดงประวัติออเดอร์ ${orders.length} รายการ`,
            });

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
            await supabase.from("chat_messages").insert({
              conversation_id: conversation.id,
              role: "assistant",
              content: "ไม่พบประวัติออเดอร์",
            });

            await sendToFacebook(
              senderId, 
              `📋 ยังไม่มีประวัติออเดอร์ค่ะ\n\nพิมพ์ "ดูสินค้า" เพื่อเลือกสินค้าได้เลยค่ะ 😊`,
              FB_PAGE_ACCESS_TOKEN
            );
            continue;
          }
        }

        // Get cart items count
        const { count: cartItemCount } = await supabase
          .from("shopping_carts")
          .select("*", { count: "exact", head: true })
          .eq("conversation_id", conversation.id);

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
        const aiResult = await getAIResponse(messages, supabase, cartItemCount || 0);
        console.log("AI response generated:", aiResult);

        let responseMessage = aiResult.text;

        // Handle cart actions
        if (aiResult.cartAction) {
          const cartAction = aiResult.cartAction;
          console.log("Cart action:", cartAction);

          if (cartAction.action === 'add' && cartAction.productName) {
            // Find product
            const { data: products } = await supabase
              .from("products")
              .select("*")
              .eq("is_active", true)
              .ilike("name", `%${cartAction.productName}%`)
              .limit(1);

            if (products && products.length > 0) {
              const product = products[0];
              const price = product.promotion_price || product.price;

              // Check if item already in cart
              const { data: existingItem } = await supabase
                .from("shopping_carts")
                .select("*")
                .eq("conversation_id", conversation.id)
                .eq("product_id", product.id)
                .eq("variants", cartAction.variants || '')
                .maybeSingle();

              if (existingItem) {
                await supabase
                  .from("shopping_carts")
                  .update({ quantity: existingItem.quantity + (cartAction.quantity || 1) })
                  .eq("id", existingItem.id);
              } else {
                await supabase.from("shopping_carts").insert({
                  conversation_id: conversation.id,
                  platform_user_id: senderId,
                  product_id: product.id,
                  product_name: product.name,
                  quantity: cartAction.quantity || 1,
                  price: price,
                  variants: cartAction.variants || ''
                });
              }
            } else {
              responseMessage = "ขออภัยค่ะ ไม่พบสินค้าที่ต้องการ";
            }
          } else if (cartAction.action === 'view') {
            const { data: cartItems } = await supabase
              .from("shopping_carts")
              .select("*")
              .eq("conversation_id", conversation.id);

            const totalAmount = cartItems?.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0) || 0;
            responseMessage = formatCartSummaryMessage(cartItems || [], totalAmount);
          } else if (cartAction.action === 'clear') {
            await supabase
              .from("shopping_carts")
              .delete()
              .eq("conversation_id", conversation.id);

            responseMessage = "🗑️ ล้างตะกร้าเรียบร้อยแล้วค่ะ";
          } else if (cartAction.action === 'checkout' && cartAction.customerName && cartAction.customerAddress && cartAction.customerPhone) {
            const { data: cartItems } = await supabase
              .from("shopping_carts")
              .select("*, products(*)")
              .eq("conversation_id", conversation.id);

            if (cartItems && cartItems.length > 0) {
              const totalAmount = cartItems.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);

              // Create order
              const { data: order, error: orderError } = await supabase
                .from("orders")
                .insert({
                  customer_name: cartAction.customerName,
                  customer_address: cartAction.customerAddress,
                  customer_phone: cartAction.customerPhone,
                  customer_facebook_id: senderId,
                  platform: "facebook",
                  total_amount: totalAmount
                })
                .select()
                .single();

              if (order && !orderError) {
                // Create order items and update stock
                const orderItems = [];
                for (const cartItem of cartItems) {
                  await supabase.from("order_items").insert({
                    order_id: order.id,
                    product_id: cartItem.product_id,
                    product_name: cartItem.product_name + (cartItem.variants ? ` (${cartItem.variants})` : ''),
                    quantity: cartItem.quantity,
                    price: cartItem.price
                  });

                  orderItems.push({
                    product_name: cartItem.product_name + (cartItem.variants ? ` (${cartItem.variants})` : ''),
                    quantity: cartItem.quantity,
                    price: cartItem.price
                  });

                  // Update stock
                  if (cartItem.products) {
                    await supabase
                      .from("products")
                      .update({ stock: cartItem.products.stock - cartItem.quantity })
                      .eq("id", cartItem.product_id);
                  }
                }

                // Clear cart
                await supabase
                  .from("shopping_carts")
                  .delete()
                  .eq("conversation_id", conversation.id);

                // Update conversation
                await supabase
                  .from("chat_conversations")
                  .update({
                    customer_name: cartAction.customerName,
                    customer_phone: cartAction.customerPhone
                  })
                  .eq("id", conversation.id);

                console.log(`Facebook cart order created: ${order.order_number}`);

                responseMessage = formatOrderConfirmationMessage(
                  order.order_number,
                  orderItems,
                  totalAmount,
                  cartAction.customerName,
                  cartAction.customerAddress
                );
              } else {
                console.error("Error creating order:", orderError);
                responseMessage = "ขออภัยค่ะ เกิดข้อผิดพลาดในการสร้างออเดอร์ กรุณาลองใหม่อีกครั้ง";
              }
            } else {
              responseMessage = "🛒 ตะกร้าว่างเปล่าค่ะ กรุณาเพิ่มสินค้าก่อนสั่งซื้อ";
            }
          }
        }

        // Handle direct order creation
        if (aiResult.createOrder) {
          const orderData = aiResult.createOrder;
          console.log("Creating direct order:", orderData);

          // Find product
          const { data: products } = await supabase
            .from("products")
            .select("*")
            .eq("is_active", true)
            .ilike("name", `%${orderData.productName}%`)
            .limit(1);

          if (products && products.length > 0) {
            const product = products[0];
            const price = product.promotion_price || product.price;
            const totalAmount = price * orderData.quantity;

            // Create order
            const { data: order, error: orderError } = await supabase
              .from("orders")
              .insert({
                customer_name: orderData.customerName,
                customer_address: orderData.customerAddress,
                customer_phone: orderData.customerPhone,
                customer_facebook_id: senderId,
                platform: "facebook",
                total_amount: totalAmount
              })
              .select()
              .single();

            if (order && !orderError) {
              await supabase.from("order_items").insert({
                order_id: order.id,
                product_id: product.id,
                product_name: product.name + (orderData.variants ? ` (${orderData.variants})` : ''),
                quantity: orderData.quantity,
                price: price
              });

              // Update stock
              await supabase
                .from("products")
                .update({ stock: product.stock - orderData.quantity })
                .eq("id", product.id);

              // Update conversation
              await supabase
                .from("chat_conversations")
                .update({
                  customer_name: orderData.customerName,
                  customer_phone: orderData.customerPhone
                })
                .eq("id", conversation.id);

              console.log(`Facebook direct order created: ${order.order_number}`);

              responseMessage = formatOrderConfirmationMessage(
                order.order_number,
                [{
                  product_name: product.name + (orderData.variants ? ` (${orderData.variants})` : ''),
                  quantity: orderData.quantity,
                  price: price
                }],
                totalAmount,
                orderData.customerName,
                orderData.customerAddress
              );
            }
          } else {
            responseMessage = "ขออภัยค่ะ ไม่พบสินค้าที่ต้องการ";
          }
        }

        // Save AI response
        await supabase.from("chat_messages").insert({
          conversation_id: conversation.id,
          role: "assistant",
          content: responseMessage,
        });

        // Update conversation
        await supabase
          .from("chat_conversations")
          .update({
            last_message: responseMessage.slice(0, 100),
            last_message_at: new Date().toISOString(),
          })
          .eq("id", conversation.id);

        // Send response to Facebook
        await sendToFacebook(senderId, responseMessage, FB_PAGE_ACCESS_TOKEN);
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
