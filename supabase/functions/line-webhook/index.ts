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
const ENCRYPTION_KEY = Deno.env.get('ENCRYPTION_KEY') || '';

// ============= Decryption Utilities =============
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
    return encryptedText; // Return as-is if decryption fails
  }
}

async function getDecryptedSetting(supabase: any, key: string): Promise<string | null> {
  const { data, error } = await supabase.from('settings').select('value').eq('key', key).maybeSingle();
  if (error || !data?.value) return null;
  return await decrypt(data.value);
}

// ============= Interfaces =============
interface AISettings {
  ai_name: string;
  gender: string;
  personality: string | null;
  formality_level: number;
  use_emoji: boolean;
  response_length: string;
  greeting_message: string | null;
  closing_message: string | null;
  custom_rules: string | null;
}

interface StoreSettings {
  storeName: string;
  shippingInfo: string;
  bankAccounts: string;
  paymentMethods: string;
  returnPolicy: string;
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
}

// ============= Build System Prompt (Same as Web Chat) =============
function buildSystemPrompt(
  settings: AISettings,
  productCatalog: string,
  faqList: string,
  storeSettings: StoreSettings,
  isFirstMessage: boolean
): string {
  const { ai_name, gender, personality, formality_level, use_emoji, response_length, greeting_message, custom_rules } = settings;

  // Gender-specific particles
  let particleEnd = "ครับ/ค่ะ";
  if (gender === "female") particleEnd = "ค่ะ";
  else if (gender === "male") particleEnd = "ครับ";

  // Formality descriptions
  const formalityDescriptions: Record<number, string> = {
    1: "เป็นกันเองมาก ใช้ภาษาสบายๆ",
    2: "เป็นกันเอง สุภาพแต่ไม่เครียด",
    3: "ปานกลาง สุภาพพอประมาณ",
    4: "เป็นทางการ สุภาพเรียบร้อย",
    5: "เป็นทางการมาก ใช้ภาษาสุภาพสูง",
  };

  const responseLengthGuide: Record<string, string> = {
    short: "ตอบสั้นกระชับ 1-2 ประโยค",
    medium: "ตอบปานกลาง 3-4 ประโยค",
    long: "ตอบละเอียด 5+ ประโยค",
  };

  const emojiGuide = use_emoji ? "ใช้ emoji เล็กน้อย เช่น 😊 🙏 ✨" : "ไม่ใช้ emoji";

  const greetingInstruction = isFirstMessage && greeting_message
    ? `เริ่มต้นด้วย: "${greeting_message}"`
    : `นี่ไม่ใช่ข้อความแรก ห้ามทักทายซ้ำ`;

  return `คุณคือ "${ai_name}" ผู้ช่วยขายภาษาไทย

## บุคลิกภาพ:
${personality || "สุภาพ เป็นมิตร พร้อมให้บริการ"}

## สไตล์:
- ${formalityDescriptions[formality_level] || formalityDescriptions[3]}
- ลงท้ายด้วย "${particleEnd}"
- ${responseLengthGuide[response_length] || responseLengthGuide["medium"]}
- ${emojiGuide}

## การทักทาย:
${greetingInstruction}

## สินค้าในร้าน:
${productCatalog}

## ข้อมูลร้าน:
${storeSettings.storeName ? `- ร้าน: ${storeSettings.storeName}` : ''}
${storeSettings.shippingInfo ? `- การจัดส่ง: ${storeSettings.shippingInfo}` : ''}
${storeSettings.bankAccounts ? `- บัญชีธนาคาร: ${storeSettings.bankAccounts}` : ''}
${storeSettings.paymentMethods ? `- ชำระเงิน: ${storeSettings.paymentMethods}` : ''}
${storeSettings.returnPolicy ? `- คืนสินค้า: ${storeSettings.returnPolicy}` : ''}

${faqList ? `## FAQ:\n${faqList}` : ''}

## กฎการแสดงสินค้า:
- ถ้าลูกค้าถามหาสินค้าที่มี → ตอบอธิบายก่อน แล้วใส่ [PRODUCT:ชื่อสินค้า] ต่อท้าย
- ถ้าลูกค้าอยากดูทั้งหมด → ใส่ [SHOW_PRODUCTS] ต่อท้าย
- ถ้าลูกค้าถามโปรโมชั่น/ลดราคา → ตอบสั้นๆ แล้วใส่ [SHOW_PROMOTIONS] ต่อท้าย (ระบบจะแสดง Flex Carousel อัตโนมัติ)
- ถ้าสินค้าไม่มี → บอกว่าไม่มี แนะนำสินค้าอื่น

## ห้าม:
- ห้ามบอกจำนวนสต็อก
- ห้ามตอบแค่คำสั่งโดดๆ ต้องมีข้อความด้วยเสมอ
- ห้ามแต่งข้อมูลที่ไม่มี
- ห้ามตอบรายการโปรโมชั่นยาวๆ เป็นข้อความ ให้ใช้ [SHOW_PROMOTIONS] แทน

${custom_rules ? `## กฎพิเศษ:\n${custom_rules}` : ''}`;
}

// ============= LINE Message Builders =============
function buildProductFlexMessage(product: Product) {
  const displayPrice = product.promotion_price || product.price;
  const hasPromotion = product.promotion_price && product.promotion_price < product.price;
  const discountPercent = hasPromotion 
    ? Math.round(((product.price - product.promotion_price!) / product.price) * 100) 
    : 0;

  const bodyContents: any[] = [
    { type: "text", text: product.name, weight: "bold", size: "lg", wrap: true }
  ];

  // Add discount badge if promotion exists
  if (hasPromotion) {
    bodyContents.push({
      type: "box",
      layout: "horizontal",
      contents: [
        {
          type: "text",
          text: `ลด ${discountPercent}%`,
          size: "xs",
          color: "#FFFFFF",
          weight: "bold"
        }
      ],
      backgroundColor: "#E74C3C",
      cornerRadius: "md",
      paddingAll: "xs",
      width: "60px",
      justifyContent: "center",
      margin: "sm"
    });
  }

  // Add description
  if (product.description) {
    bodyContents.push({ 
      type: "text", 
      text: product.description, 
      size: "sm", 
      color: "#666666", 
      wrap: true,
      maxLines: 2,
      margin: "sm"
    });
  }

  // Add price section
  const priceContents: any[] = [
    { type: "text", text: `฿${displayPrice.toLocaleString()}`, weight: "bold", size: "xl", color: "#E74C3C" }
  ];
  if (hasPromotion) {
    priceContents.push({ 
      type: "text", 
      text: `฿${product.price.toLocaleString()}`, 
      size: "sm", 
      color: "#999999", 
      decoration: "line-through", 
      align: "end",
      gravity: "bottom"
    });
  }
  bodyContents.push({
    type: "box",
    layout: "horizontal",
    contents: priceContents,
    margin: "md"
  });

  return {
    type: "bubble",
    size: "micro",
    hero: product.image_url ? {
      type: "image",
      url: product.image_url,
      size: "full",
      aspectRatio: "1:1",
      aspectMode: "cover"
    } : undefined,
    body: {
      type: "box",
      layout: "vertical",
      contents: bodyContents,
      spacing: "none"
    },
    footer: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "button",
          action: {
            type: "message",
            label: "สั่งซื้อ",
            text: `สั่งซื้อ ${product.name}`
          },
          style: "primary",
          color: "#E74C3C",
          height: "sm"
        },
        {
          type: "button",
          action: {
            type: "message",
            label: "ดูรายละเอียด",
            text: `ขอดูรายละเอียด ${product.name}`
          },
          style: "secondary",
          height: "sm",
          margin: "sm"
        }
      ],
      spacing: "none"
    }
  };
}

function buildProductCarousel(products: Product[]) {
  const bubbles = products.slice(0, 10).map(p => buildProductFlexMessage(p));
  return {
    type: "flex",
    altText: "รายการสินค้า",
    contents: { type: "carousel", contents: bubbles }
  };
}

// ============= AI Response Parser =============
function parseAIResponse(content: string, products: Product[]) {
  const showProducts = content.includes('[SHOW_PRODUCTS]');
  const showPromotions = content.includes('[SHOW_PROMOTIONS]');
  const productMatch = content.match(/\[PRODUCT:([^\]]+)\]/);
  
  // Clean the text
  let text = content
    .replace(/\[SHOW_PRODUCTS\]/g, '')
    .replace(/\[SHOW_PROMOTIONS\]/g, '')
    .replace(/\[PRODUCT:[^\]]+\]/g, '')
    .trim();

  // Find specific product
  let specificProduct: Product | undefined;
  if (productMatch) {
    const productName = productMatch[1].trim();
    specificProduct = products.find(p => 
      p.name.toLowerCase().includes(productName.toLowerCase()) ||
      productName.toLowerCase().includes(p.name.toLowerCase())
    );
  }

  // Get promotion products
  const promotionProducts = products.filter(p => p.promotion_price && p.promotion_price < p.price);

  return { text, showProducts, showPromotions, specificProduct, promotionProducts };
}

// ============= Main Handler =============
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

  try {
    // Get LINE tokens from database
    const lineAccessToken = await getDecryptedSetting(supabase, 'LINE_CHANNEL_ACCESS_TOKEN');
    const lineChannelSecret = await getDecryptedSetting(supabase, 'LINE_CHANNEL_SECRET');

    if (!lineAccessToken || !lineChannelSecret) {
      console.error("LINE tokens not configured");
      return new Response(JSON.stringify({ error: "LINE not configured" }), { status: 500, headers: corsHeaders });
    }

    // Verify LINE signature
    const body = await req.text();
    const signature = req.headers.get("x-line-signature");
    
    if (signature) {
      const hmac = createHmac("sha256", lineChannelSecret);
      hmac.update(body);
      const expectedSignature = hmac.digest("base64");
      if (signature !== expectedSignature) {
        console.error("Invalid LINE signature");
        return new Response("Invalid signature", { status: 401, headers: corsHeaders });
      }
    }

    const webhook = JSON.parse(body);
    console.log("LINE webhook received");

    // Process each event
    for (const event of webhook.events || []) {
      if (event.type !== "message" || event.message?.type !== "text") continue;

      const userId = event.source?.userId;
      const userMessage = event.message.text;
      const replyToken = event.replyToken;

      if (!userId || !userMessage || !replyToken) continue;

      console.log(`Message from ${userId}: ${userMessage}`);

      // Get or create conversation
      let { data: conversation } = await supabase
        .from('chat_conversations')
        .select('*')
        .eq('platform', 'line')
        .eq('platform_user_id', userId)
        .maybeSingle();

      if (!conversation) {
        const { data: newConv } = await supabase
          .from('chat_conversations')
          .insert({ platform: 'line', platform_user_id: userId })
          .select()
          .single();
        conversation = newConv;
      }

      // Get conversation history FIRST (before saving new message)
      const { data: historyMessages } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true })
        .limit(20);

      const isFirstMessage = !historyMessages || historyMessages.length === 0;

      // Save user message BEFORE calling AI
      await supabase.from('chat_messages').insert({
        conversation_id: conversation.id,
        role: 'user',
        content: userMessage
      });

      // Fetch AI settings
      const { data: aiSettingsData } = await supabase
        .from("ai_settings")
        .select("*")
        .eq("is_active", true)
        .maybeSingle();

      const aiSettings: AISettings = aiSettingsData || {
        ai_name: "น้องช้อป",
        gender: "female",
        personality: "ร่าเริง เป็นกันเอง ชอบช่วยเหลือลูกค้า",
        formality_level: 2,
        use_emoji: true,
        response_length: "medium",
        greeting_message: "สวัสดีค่ะ! 😊 ยินดีต้อนรับค่ะ",
        closing_message: null,
        custom_rules: null,
      };

      // Fetch products
      const { data: products } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true);

      const productList = products || [];
      const productCatalog = productList.map(p => 
        `- ${p.name}: ฿${p.price}${p.promotion_price ? ` (ลด: ฿${p.promotion_price})` : ''} - ${p.description || ''}`
      ).join('\n') || 'ยังไม่มีสินค้า';

      // Fetch FAQs
      const { data: faqs } = await supabase.from("faqs").select("*").eq("is_active", true);
      const faqList = faqs?.map(f => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n') || '';

      // Fetch store settings
      const { data: settingsData } = await supabase
        .from("settings")
        .select("key, value")
        .in("key", ["STORE_NAME", "SHIPPING_INFO", "BANK_ACCOUNTS", "PAYMENT_METHODS", "RETURN_POLICY"]);

      const settingsMap = new Map(settingsData?.map(s => [s.key, s.value]) || []);
      const storeSettings: StoreSettings = {
        storeName: settingsMap.get("STORE_NAME") || "",
        shippingInfo: settingsMap.get("SHIPPING_INFO") || "",
        bankAccounts: settingsMap.get("BANK_ACCOUNTS") || "",
        paymentMethods: settingsMap.get("PAYMENT_METHODS") || "",
        returnPolicy: settingsMap.get("RETURN_POLICY") || "",
      };

      // Build system prompt
      const systemPrompt = buildSystemPrompt(aiSettings, productCatalog, faqList, storeSettings, isFirstMessage);

      // Build messages for AI - include FULL conversation history
      // historyMessages contains previous messages, plus we add current user message
      const aiMessages: { role: string; content: string }[] = [];
      
      // Add all previous messages from history
      if (historyMessages && historyMessages.length > 0) {
        for (const m of historyMessages) {
          aiMessages.push({ role: m.role, content: m.content });
        }
      }
      
      // Add current user message
      aiMessages.push({ role: "user", content: userMessage });
      
      console.log(`Sending ${aiMessages.length} messages to AI (including current)`);

      // Call AI
      console.log("Calling Lovable AI...");
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            ...aiMessages,
          ],
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error("AI error:", errorText);
        
        // Send error message to user
        await fetch("https://api.line.me/v2/bot/message/reply", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${lineAccessToken}`,
          },
          body: JSON.stringify({
            replyToken,
            messages: [{ type: "text", text: "ขออภัยค่ะ ระบบมีปัญหาชั่วคราว กรุณาลองใหม่อีกครั้งนะคะ" }]
          }),
        });
        continue;
      }

      const aiData = await aiResponse.json();
      const aiContent = aiData.choices?.[0]?.message?.content || "ขออภัยค่ะ ไม่สามารถตอบได้";

      console.log("AI response:", aiContent);

      // Parse AI response
      const { text, showProducts, showPromotions, specificProduct, promotionProducts } = parseAIResponse(aiContent, productList);

      // Build LINE messages
      const lineMessages: any[] = [];

      // Always add text message first if there's text
      if (text) {
        lineMessages.push({ type: "text", text });
      }

      // Add product display if needed
      if (specificProduct) {
        lineMessages.push({
          type: "flex",
          altText: specificProduct.name,
          contents: buildProductFlexMessage(specificProduct)
        });
      } else if (showPromotions && promotionProducts.length > 0) {
        // Show promotion products carousel
        lineMessages.push(buildProductCarousel(promotionProducts));
      } else if (showProducts && productList.length > 0) {
        lineMessages.push(buildProductCarousel(productList));
      }

      // Ensure at least one message
      if (lineMessages.length === 0) {
        lineMessages.push({ type: "text", text: aiContent });
      }

      // Save assistant response
      await supabase.from('chat_messages').insert({
        conversation_id: conversation.id,
        role: 'assistant',
        content: text || aiContent
      });

      // Update conversation
      await supabase
        .from('chat_conversations')
        .update({
          last_message: text || aiContent,
          last_message_at: new Date().toISOString(),
          customer_name: conversation.customer_name
        })
        .eq('id', conversation.id);

      // Send reply to LINE
      console.log("Sending LINE reply...");
      const replyResponse = await fetch("https://api.line.me/v2/bot/message/reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lineAccessToken}`,
        },
        body: JSON.stringify({
          replyToken,
          messages: lineMessages.slice(0, 5) // LINE allows max 5 messages
        }),
      });

      if (!replyResponse.ok) {
        console.error("LINE reply error:", await replyResponse.text());
      } else {
        console.log("LINE reply sent successfully");
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("LINE webhook error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
