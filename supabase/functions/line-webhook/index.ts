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

interface Product {
  id: string;
  name: string;
  price: number;
  promotion_price?: number;
  description?: string;
  image_url?: string;
  category?: string;
  stock: number;
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

async function getAIResponse(
  messages: Array<{ role: string; content: string }>, 
  supabase: any,
  customerContext: { isReturning: boolean; customerName?: string; messageCount: number; lastVisit?: string }
): Promise<{ text: string; showProducts?: boolean; specificProduct?: string; detectedName?: string; startOrder?: string }> {
  if (!LOVABLE_API_KEY) {
    return { text: "ขออภัยครับ ระบบยังไม่พร้อมให้บริการ" };
  }

  // Fetch products for context
  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true);

  const productCatalog = products?.map((p: any) => 
    `- ${p.name}: ฿${p.price}${p.promotion_price ? ` (โปรโมชั่น: ฿${p.promotion_price})` : ''} [หมวด: ${p.category || 'ทั่วไป'}]`
  ).join('\n') || 'ยังไม่มีสินค้า';

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

**สำคัญมาก - การสั่งซื้อ:**
- ถ้าลูกค้าพิมพ์ "สั่งซื้อ ชื่อสินค้า" หรือ "เอา ชื่อสินค้า" หรือต้องการสั่งซื้อสินค้า → ตอบยืนยันราคาและถามจำนวน ชื่อ ที่อยู่ เบอร์โทร สำหรับจัดส่ง (ไม่ต้องใส่ [SHOW_PRODUCT])
- ห้ามส่งการ์ดสินค้าซ้ำเมื่อลูกค้าต้องการสั่งซื้อแล้ว
- ห้ามบอกจำนวนสต็อกโดยตรง ยกเว้นลูกค้าจะสั่งเกินจำนวน

ตัวอย่าง:
- ลูกค้า: "สั่งซื้อ เสื้อยืดคอกลม" → ตอบ "ได้เลยค่ะ เสื้อยืดคอกลม ราคา ฿249 นะคะ รับกี่ตัวดีคะ 😊 และรบกวนขอชื่อ ที่อยู่ และเบอร์โทร สำหรับจัดส่งด้วยนะคะ"
- ลูกค้า: "มีสินค้าอะไรบ้าง" → ตอบแนะนำสั้นๆ แล้วลงท้าย [SHOW_PRODUCTS]
- ลูกค้า: "ขอดูกระเป๋า" → ตอบ "นี่คือกระเป๋าที่มีค่ะ [SHOW_PRODUCT:กระเป๋า]"`;

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

    // Clean up the response
    content = content
      .replace(/\[SHOW_PRODUCTS\]/g, '')
      .replace(/\[SHOW_PRODUCT:[^\]]+\]/g, '')
      .replace(/\[NAME:[^\]]+\]/g, '')
      .trim();

    return {
      text: content,
      showProducts: !!showProductsMatch,
      specificProduct: specificProductMatch ? specificProductMatch[1] : undefined,
      detectedName: nameMatch ? nameMatch[1].trim() : undefined
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
