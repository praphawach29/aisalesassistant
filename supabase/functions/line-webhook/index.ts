import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-line-signature",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

interface ProductVariant {
  name: string;
  options: string[];
}

interface Product {
  id: string;
  name: string;
  price: number;
  promotion_price?: number;
  description?: string;
  image_url?: string;
  category?: string;
  stock: number;
  variants?: ProductVariant[] | null;
}

async function verifySignature(body: string, signature: string, channelSecret: string): Promise<boolean> {
  if (!channelSecret) return false;
  
  const hmac = createHmac("sha256", channelSecret);
  hmac.update(body);
  const digest = hmac.digest("base64");
  return digest === signature;
}

function createProductFlexMessage(products: Product[]) {
  const bubbles = products.slice(0, 10).map(product => {
    const price = product.promotion_price || product.price;
    const originalPrice = product.promotion_price ? product.price : null;
    
    return {
      type: "bubble",
      hero: product.image_url ? {
        type: "image",
        url: product.image_url,
        size: "full",
        aspectRatio: "4:3",
        aspectMode: "cover"
      } : undefined,
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: product.name,
            weight: "bold",
            size: "lg",
            wrap: true
          },
          {
            type: "box",
            layout: "baseline",
            margin: "md",
            contents: [
              {
                type: "text",
                text: `฿${price.toLocaleString()}`,
                size: "xl",
                color: "#FF5551",
                weight: "bold"
              },
              ...(originalPrice ? [{
                type: "text",
                text: `฿${originalPrice.toLocaleString()}`,
                size: "sm",
                color: "#aaaaaa",
                decoration: "line-through",
                margin: "sm"
              }] : [])
            ]
          },
          ...(product.description ? [{
            type: "text",
            text: product.description.slice(0, 60) + (product.description.length > 60 ? "..." : ""),
            size: "sm",
            color: "#999999",
            margin: "md",
            wrap: true
          }] : []),
          {
            type: "text",
            text: product.stock > 0 ? `มีสินค้า ${product.stock} ชิ้น` : "สินค้าหมด",
            size: "xs",
            color: product.stock > 0 ? "#00B900" : "#FF0000",
            margin: "md"
          }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "primary",
            action: {
              type: "message",
              label: "สั่งซื้อ",
              text: `สั่งซื้อ ${product.name}`
            },
            color: "#00B900"
          }
        ]
      }
    };
  });

  // Filter out undefined hero images
  const cleanBubbles = bubbles.map(bubble => {
    if (!bubble.hero) {
      const { hero, ...rest } = bubble;
      return rest;
    }
    return bubble;
  });

  return {
    type: "flex",
    altText: "รายการสินค้า",
    contents: {
      type: "carousel",
      contents: cleanBubbles
    }
  };
}

function createSingleProductCard(product: Product) {
  const price = product.promotion_price || product.price;
  const originalPrice = product.promotion_price ? product.price : null;

  // Check if product has variants
  const hasVariants = product.variants && product.variants.length > 0;

  // Build variant info text
  let variantInfoText = "";
  if (hasVariants) {
    variantInfoText = product.variants!.map(v => 
      `${v.name}: ${v.options.join(", ")}`
    ).join("\n");
  }

  const bubble: any = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: product.name,
          weight: "bold",
          size: "xl",
          wrap: true
        },
        {
          type: "box",
          layout: "baseline",
          margin: "md",
          contents: [
            {
              type: "text",
              text: `฿${price.toLocaleString()}`,
              size: "xxl",
              color: "#FF5551",
              weight: "bold"
            },
            ...(originalPrice ? [{
              type: "text",
              text: `฿${originalPrice.toLocaleString()}`,
              size: "md",
              color: "#aaaaaa",
              decoration: "line-through",
              margin: "sm"
            }] : [])
          ]
        },
        ...(product.description ? [{
          type: "text",
          text: product.description,
          size: "sm",
          color: "#666666",
          margin: "lg",
          wrap: true
        }] : []),
        ...(hasVariants ? [{
          type: "separator",
          margin: "lg"
        },
        {
          type: "text",
          text: "ตัวเลือกสินค้า:",
          size: "sm",
          color: "#333333",
          weight: "bold",
          margin: "md"
        },
        {
          type: "text",
          text: variantInfoText,
          size: "sm",
          color: "#666666",
          margin: "sm",
          wrap: true
        }] : []),
        {
          type: "separator",
          margin: "lg"
        },
        {
          type: "box",
          layout: "horizontal",
          margin: "md",
          contents: [
            {
              type: "text",
              text: "สถานะ:",
              size: "sm",
              color: "#999999"
            },
            {
              type: "text",
              text: product.stock > 0 ? `มีสินค้า ${product.stock} ชิ้น` : "สินค้าหมด",
              size: "sm",
              color: product.stock > 0 ? "#00B900" : "#FF0000",
              align: "end"
            }
          ]
        }
      ]
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "button",
          style: "primary",
          action: {
            type: "message",
            label: "สั่งซื้อเลย",
            text: `สั่งซื้อ ${product.name}`
          },
          color: "#00B900"
        }
      ]
    }
  };

  if (product.image_url) {
    bubble.hero = {
      type: "image",
      url: product.image_url,
      size: "full",
      aspectRatio: "4:3",
      aspectMode: "cover"
    };
  }

  return {
    type: "flex",
    altText: `สินค้า: ${product.name}`,
    contents: bubble
  };
}

// Create variant selection card with Quick Reply buttons
function createVariantSelectionCard(product: Product, variantType: string, options: string[]) {
  const price = product.promotion_price || product.price;

  const optionButtons = options.slice(0, 4).map(option => ({
    type: "button",
    style: "secondary",
    action: {
      type: "message",
      label: option,
      text: `เลือก ${variantType}: ${option} สำหรับ ${product.name}`
    },
    height: "sm"
  }));

  const bubble: any = {
    type: "bubble",
    size: "kilo",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: `🎨 เลือก${variantType}`,
          weight: "bold",
          size: "lg",
          color: "#333333"
        },
        {
          type: "text",
          text: product.name,
          size: "md",
          color: "#666666",
          margin: "sm"
        },
        {
          type: "text",
          text: `ราคา ฿${price.toLocaleString()}`,
          size: "sm",
          color: "#FF5551",
          margin: "sm"
        },
        {
          type: "separator",
          margin: "lg"
        },
        {
          type: "text",
          text: `กรุณาเลือก${variantType}:`,
          size: "sm",
          color: "#333333",
          margin: "md"
        }
      ]
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: optionButtons
    }
  };

  return {
    type: "flex",
    altText: `เลือก${variantType}สำหรับ ${product.name}`,
    contents: bubble
  };
}

// Create order confirmation card
function createOrderConfirmationCard(orderNumber: string, productName: string, quantity: number, totalAmount: number, customerName: string, customerAddress: string, variants?: string) {
  const bubble: any = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "✅ ยืนยันการสั่งซื้อสำเร็จ!",
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
                { type: "text", text: "หมายเลขออเดอร์:", size: "sm", color: "#666666", flex: 4 },
                { type: "text", text: orderNumber, size: "sm", color: "#333333", weight: "bold", flex: 5, align: "end" }
              ]
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                { type: "text", text: "สินค้า:", size: "sm", color: "#666666", flex: 4 },
                { type: "text", text: productName, size: "sm", color: "#333333", flex: 5, align: "end", wrap: true }
              ]
            },
            ...(variants ? [{
              type: "box",
              layout: "horizontal",
              contents: [
                { type: "text", text: "ตัวเลือก:", size: "sm", color: "#666666", flex: 4 },
                { type: "text", text: variants, size: "sm", color: "#333333", flex: 5, align: "end" }
              ]
            }] : []),
            {
              type: "box",
              layout: "horizontal",
              contents: [
                { type: "text", text: "จำนวน:", size: "sm", color: "#666666", flex: 4 },
                { type: "text", text: `${quantity} ชิ้น`, size: "sm", color: "#333333", flex: 5, align: "end" }
              ]
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                { type: "text", text: "ยอดรวม:", size: "sm", color: "#666666", flex: 4 },
                { type: "text", text: `฿${totalAmount.toLocaleString()}`, size: "sm", color: "#FF5551", weight: "bold", flex: 5, align: "end" }
              ]
            }
          ]
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
              type: "text",
              text: "📦 ข้อมูลการจัดส่ง",
              size: "sm",
              color: "#333333",
              weight: "bold"
            },
            {
              type: "text",
              text: `ชื่อ: ${customerName}`,
              size: "sm",
              color: "#666666",
              margin: "sm"
            },
            {
              type: "text",
              text: `ที่อยู่: ${customerAddress}`,
              size: "sm",
              color: "#666666",
              wrap: true
            }
          ]
        },
        {
          type: "text",
          text: "ขอบคุณที่ใช้บริการค่ะ 🙏",
          size: "sm",
          color: "#00B900",
          margin: "lg",
          align: "center"
        }
      ]
    }
  };

  return {
    type: "flex",
    altText: `ยืนยันออเดอร์ ${orderNumber}`,
    contents: bubble
  };
}

async function replyToLine(replyToken: string, messages: Array<any>, accessToken: string) {
  if (!accessToken) {
    console.error("LINE_CHANNEL_ACCESS_TOKEN not configured");
    return;
  }

  console.log("Sending LINE reply:", JSON.stringify(messages, null, 2));

  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      replyToken,
      messages,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("LINE reply error:", error);
  } else {
    console.log("LINE reply sent successfully");
  }
}

interface OrderData {
  productName: string;
  quantity: number;
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  variants?: string;
}

async function getAIResponse(
  messages: Array<{ role: string; content: string }>, 
  supabase: any,
  customerContext: { isReturning: boolean; customerName?: string; messageCount: number; lastVisit?: string }
): Promise<{ text: string; showProducts?: boolean; specificProduct?: string; detectedName?: string; selectVariant?: string; createOrder?: OrderData }> {
  if (!LOVABLE_API_KEY) {
    return { text: "ขออภัยครับ ระบบยังไม่พร้อมให้บริการ" };
  }

  // Fetch products for context with variants
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

  const customerGreeting = customerContext.isReturning 
    ? customerContext.customerName 
      ? `นี่คือลูกค้าเก่าชื่อ "${customerContext.customerName}" ที่กลับมาอีกครั้ง! ทักทายโดยเรียกชื่อลูกค้าอย่างเป็นกันเองและอบอุ่น`
      : `นี่คือลูกค้าเก่าที่กลับมาอีกครั้ง (เคยคุยกัน ${customerContext.messageCount} ข้อความ)! ทักทายอย่างเป็นกันเองและอบอุ่น`
    : 'นี่คือลูกค้าใหม่ ทักทายสุภาพและแนะนำตัว';

  const systemPrompt = `คุณคือ "น้องช้อป" ผู้ช่วยขายอัจฉริยะทาง LINE พูดภาษาไทยสุภาพ น่ารัก ใช้อิโมจิบ้าง

${customerGreeting}

สินค้าที่มี:
${productCatalog}

หลักการ:
- ตอบสั้น ได้ใจความ ไม่เกิน 200 ตัวอักษร
- ใช้ภาษาเป็นกันเอง แต่สุภาพ
- ช่วยแนะนำสินค้าและรับออเดอร์

การจัดการคำสั่ง:
- ถ้าลูกค้าถามเกี่ยวกับสินค้าหลายรายการ หรือขอดูสินค้า → ตอบ [SHOW_PRODUCTS]
- ถ้าลูกค้าถามข้อมูลสินค้าเฉพาะอย่าง (แต่ยังไม่สั่งซื้อ) → ตอบ [SHOW_PRODUCT:ชื่อสินค้า]
- ถ้าลูกค้าบอกชื่อตัวเอง → ตอบ [NAME:ชื่อลูกค้า]

**สำคัญมาก - การสั่งซื้อและตัวเลือกสินค้า:**
- ถ้าลูกค้าพิมพ์ "สั่งซื้อ ชื่อสินค้า" และสินค้านั้น**มีตัวเลือก** (สี/ไซส์) → ตอบ [SELECT_VARIANT:ชื่อสินค้า] พร้อมข้อความถามว่าต้องการตัวเลือกไหน
- ถ้าลูกค้าพิมพ์ "เลือก สี/ไซส์: ตัวเลือก สำหรับ ชื่อสินค้า" → บันทึกตัวเลือกและถามจำนวน ชื่อ ที่อยู่ เบอร์โทร สำหรับจัดส่ง
- ถ้าลูกค้าสั่งซื้อสินค้าที่**ไม่มีตัวเลือก** → ถามจำนวน ชื่อ ที่อยู่ เบอร์โทร เลย
- ห้ามส่งการ์ดสินค้าซ้ำเมื่อลูกค้าต้องการสั่งซื้อแล้ว
- ห้ามบอกจำนวนสต็อกโดยตรง ยกเว้นลูกค้าจะสั่งเกินจำนวน

**สำคัญที่สุด - สร้างออเดอร์อัตโนมัติ:**
เมื่อลูกค้าให้ข้อมูลครบถ้วน (ชื่อสินค้า จำนวน ชื่อ ที่อยู่ เบอร์โทร และตัวเลือก(ถ้ามี)) ให้สร้างคำสั่ง:
[CREATE_ORDER:ชื่อสินค้า|จำนวน|ชื่อลูกค้า|ที่อยู่|เบอร์โทร|ตัวเลือก]

ตัวอย่างการสร้างออเดอร์:
- ถ้าลูกค้าบอก "สั่งเสื้อเชิ้ต 2 ตัว สีขาว ไซส์ M ชื่อสมชาย ที่อยู่ 123 ถ.สุขุมวิท เบอร์ 0812345678"
→ ตอบ "รับออเดอร์เรียบร้อยค่ะ 😊 [CREATE_ORDER:เสื้อเชิ้ตแขนยาว|2|สมชาย|123 ถ.สุขุมวิท|0812345678|สี: ขาว, ไซส์: M]"

- ถ้าลูกค้าบอก "สั่งกางเกงยีนส์ 1 ตัว ชื่อมานี ที่อยู่ 456 ถ.พหลโยธิน เบอร์ 0898765432"
→ ตอบ "รับออเดอร์เรียบร้อยค่ะ 😊 [CREATE_ORDER:กางเกงยีนส์|1|มานี|456 ถ.พหลโยธิน|0898765432|]"

**หมายเหตุ:** ถ้าข้อมูลยังไม่ครบ ให้ถามข้อมูลที่ขาดก่อน อย่าสร้าง [CREATE_ORDER]`;

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
    const showProductsMatch = content.match(/\[SHOW_PRODUCTS\]/);
    const specificProductMatch = content.match(/\[SHOW_PRODUCT:([^\]]+)\]/);
    const nameMatch = content.match(/\[NAME:([^\]]+)\]/);
    const selectVariantMatch = content.match(/\[SELECT_VARIANT:([^\]]+)\]/);
    const createOrderMatch = content.match(/\[CREATE_ORDER:([^\]]+)\]/);

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

    // Clean up the response
    content = content
      .replace(/\[SHOW_PRODUCTS\]/g, '')
      .replace(/\[SHOW_PRODUCT:[^\]]+\]/g, '')
      .replace(/\[NAME:[^\]]+\]/g, '')
      .replace(/\[SELECT_VARIANT:[^\]]+\]/g, '')
      .replace(/\[CREATE_ORDER:[^\]]+\]/g, '')
      .trim();

    return {
      text: content,
      showProducts: !!showProductsMatch,
      specificProduct: specificProductMatch ? specificProductMatch[1] : undefined,
      detectedName: nameMatch ? nameMatch[1].trim() : undefined,
      selectVariant: selectVariantMatch ? selectVariantMatch[1].trim() : undefined,
      createOrder
    };

  } catch (error) {
    console.error("AI call error:", error);
    return { text: "ขออภัยครับ ระบบมีปัญหา กรุณาลองใหม่ภายหลัง" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.text();
    const signature = req.headers.get("x-line-signature");

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Fetch LINE tokens from database settings
    const { data: settings, error: settingsError } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", ["LINE_CHANNEL_ACCESS_TOKEN", "LINE_CHANNEL_SECRET"]);

    if (settingsError) {
      console.error("Error fetching LINE settings:", settingsError);
      return new Response(JSON.stringify({ error: "Failed to load settings" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LINE_CHANNEL_ACCESS_TOKEN = settings?.find(s => s.key === "LINE_CHANNEL_ACCESS_TOKEN")?.value;
    const LINE_CHANNEL_SECRET = settings?.find(s => s.key === "LINE_CHANNEL_SECRET")?.value;

    console.log("LINE tokens loaded from database:", {
      hasAccessToken: !!LINE_CHANNEL_ACCESS_TOKEN,
      hasChannelSecret: !!LINE_CHANNEL_SECRET
    });

    // Verify LINE signature
    if (signature && LINE_CHANNEL_SECRET) {
      const isValid = await verifySignature(body, signature, LINE_CHANNEL_SECRET);
      if (!isValid) {
        console.error("Invalid LINE signature");
        return new Response("Unauthorized", { status: 401 });
      }
      console.log("LINE signature verified successfully");
    }

    const data = JSON.parse(body);
    console.log("LINE webhook received:", JSON.stringify(data, null, 2));

    // Process each event
    for (const event of data.events || []) {
      if (event.type !== "message" || event.message?.type !== "text") {
        continue;
      }

      const userId = event.source?.userId;
      const userMessage = event.message?.text;
      const replyToken = event.replyToken;

      if (!userId || !userMessage || !replyToken) continue;

      console.log(`LINE message from ${userId}: ${userMessage}`);

      // Find or create conversation
      let { data: conversation } = await supabase
        .from("chat_conversations")
        .select("*")
        .eq("platform", "line")
        .eq("platform_user_id", userId)
        .maybeSingle();

      const isReturningCustomer = !!conversation;
      let messageCount = 0;

      if (!conversation) {
        const { data: newConv } = await supabase
          .from("chat_conversations")
          .insert({
            platform: "line",
            platform_user_id: userId,
          })
          .select()
          .single();
        conversation = newConv;
      } else {
        // Get message count for returning customers
        const { count } = await supabase
          .from("chat_messages")
          .select("*", { count: "exact", head: true })
          .eq("conversation_id", conversation.id);
        messageCount = count || 0;
      }

      if (!conversation) {
        console.error("Failed to create conversation");
        if (LINE_CHANNEL_ACCESS_TOKEN) {
          await replyToLine(replyToken, [{ type: "text", text: "ขออภัยครับ เกิดข้อผิดพลาด" }], LINE_CHANNEL_ACCESS_TOKEN);
        }
        continue;
      }

      // Save user message
      await supabase.from("chat_messages").insert({
        conversation_id: conversation.id,
        role: "user",
        content: userMessage,
      });

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

      // Get AI response with customer context
      const customerContext = {
        isReturning: isReturningCustomer,
        customerName: conversation.customer_name || undefined,
        messageCount: messageCount,
        lastVisit: conversation.last_message_at || undefined
      };

      const aiResult = await getAIResponse(messages, supabase, customerContext);
      console.log("AI response generated:", aiResult);

      // Prepare messages to send
      const messagesToSend: any[] = [];

      // Handle order creation if requested
      if (aiResult.createOrder) {
        const orderData = aiResult.createOrder;
        console.log("Creating order:", orderData);

        // Find product to get price
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
              customer_line_id: userId,
              platform: "line",
              total_amount: totalAmount,
              notes: orderData.variants ? `ตัวเลือก: ${orderData.variants}` : null
            })
            .select()
            .single();

          if (order && !orderError) {
            // Create order item
            await supabase.from("order_items").insert({
              order_id: order.id,
              product_id: product.id,
              product_name: product.name + (orderData.variants ? ` (${orderData.variants})` : ''),
              quantity: orderData.quantity,
              price: price
            });

            // Update product stock
            await supabase
              .from("products")
              .update({ stock: product.stock - orderData.quantity })
              .eq("id", product.id);

            // Update conversation with customer info
            await supabase
              .from("chat_conversations")
              .update({
                customer_name: orderData.customerName,
                customer_phone: orderData.customerPhone
              })
              .eq("id", conversation.id);

            console.log(`Order created: ${order.order_number}`);

            // Add text response
            if (aiResult.text) {
              messagesToSend.push({ type: "text", text: aiResult.text });
            }

            // Add order confirmation card
            messagesToSend.push(createOrderConfirmationCard(
              order.order_number,
              product.name,
              orderData.quantity,
              totalAmount,
              orderData.customerName,
              orderData.customerAddress,
              orderData.variants
            ));
          } else {
            console.error("Order creation error:", orderError);
            messagesToSend.push({ type: "text", text: "ขออภัยค่ะ ไม่สามารถสร้างออเดอร์ได้ กรุณาลองใหม่อีกครั้งนะคะ 🙏" });
          }
        } else {
          messagesToSend.push({ type: "text", text: "ขออภัยค่ะ ไม่พบสินค้าที่ต้องการ กรุณาตรวจสอบชื่อสินค้าอีกครั้งนะคะ" });
        }
      } else {
        // Add text response if there is one
        if (aiResult.text) {
          messagesToSend.push({ type: "text", text: aiResult.text });
        }

        // Add product cards if requested
        if (aiResult.showProducts) {
          const { data: products } = await supabase
            .from("products")
            .select("*")
            .eq("is_active", true)
            .gt("stock", 0)
            .limit(10);

          if (products && products.length > 0) {
            messagesToSend.push(createProductFlexMessage(products));
          }
        } else if (aiResult.selectVariant) {
          // Show variant selection card
          const { data: products } = await supabase
            .from("products")
            .select("*")
            .eq("is_active", true)
            .ilike("name", `%${aiResult.selectVariant}%`)
            .limit(1);

          if (products && products.length > 0) {
            const product = products[0] as Product;
            if (product.variants && product.variants.length > 0) {
              // Send variant selection cards for each variant type
              for (const variant of product.variants.slice(0, 2)) {
                messagesToSend.push(createVariantSelectionCard(product, variant.name, variant.options));
              }
            }
          }
        } else if (aiResult.specificProduct) {
          const { data: products } = await supabase
            .from("products")
            .select("*")
            .eq("is_active", true)
            .ilike("name", `%${aiResult.specificProduct}%`)
            .limit(1);

          if (products && products.length > 0) {
            messagesToSend.push(createSingleProductCard(products[0]));
          }
        }
      }

      // Save AI response
      await supabase.from("chat_messages").insert({
        conversation_id: conversation.id,
        role: "assistant",
        content: aiResult.text,
      });

      // Update conversation (including customer name if detected)
      const updateData: any = {
        last_message: aiResult.text.slice(0, 100),
        last_message_at: new Date().toISOString(),
      };

      if (aiResult.detectedName && !conversation.customer_name) {
        updateData.customer_name = aiResult.detectedName;
        console.log(`Saved customer name: ${aiResult.detectedName}`);
      }

      await supabase
        .from("chat_conversations")
        .update(updateData)
        .eq("id", conversation.id);

      // Reply to LINE
      if (LINE_CHANNEL_ACCESS_TOKEN && messagesToSend.length > 0) {
        console.log("Sending reply to LINE...");
        await replyToLine(replyToken, messagesToSend.slice(0, 5), LINE_CHANNEL_ACCESS_TOKEN);
      } else {
        console.error("Cannot reply - LINE_CHANNEL_ACCESS_TOKEN not configured or no messages");
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("LINE webhook error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
