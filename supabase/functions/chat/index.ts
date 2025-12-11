import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

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
  storePhone: string;
  storeAddress: string;
  storeEmail: string;
  returnPolicy: string;
  shippingInfo: string;
  businessHours: string;
  lineId: string;
  facebookPage: string;
  instagram: string;
  bankAccounts: string;
  paymentMethods: string;
  warrantyInfo: string;
  privacyPolicy: string;
  termsConditions: string;
}

function buildDynamicPrompt(settings: AISettings, productCatalog: string, faqList: string, storeSettings: StoreSettings, isFirstMessage: boolean): string {
  const { ai_name, gender, personality, formality_level, use_emoji, response_length, greeting_message, closing_message, custom_rules } = settings;

  // Gender-specific particles
  let particleEnd = "ครับ/ค่ะ";
  let particleQuestion = "ครับ/คะ";
  if (gender === "female") {
    particleEnd = "ค่ะ";
    particleQuestion = "คะ";
  } else if (gender === "male") {
    particleEnd = "ครับ";
    particleQuestion = "ครับ";
  }

  // Formality description
  const formalityDescriptions: Record<number, string> = {
    1: "เป็นกันเองมาก ใช้ภาษาสบายๆ พูดคุยเหมือนเพื่อน",
    2: "เป็นกันเอง สุภาพแต่ไม่เครียด พูดจาน่ารัก",
    3: "ปานกลาง สุภาพพอประมาณ เป็นมืออาชีพแต่ไม่แข็งทื่อ",
    4: "เป็นทางการ สุภาพเรียบร้อย ใช้ภาษาที่เหมาะสม",
    5: "เป็นทางการมาก ใช้ภาษาสุภาพสูง เหมาะกับลูกค้าองค์กร",
  };

  // Response length guide
  const responseLengthGuide: Record<string, string> = {
    short: "ตอบสั้นกระชับ 1-2 ประโยค ตรงประเด็น",
    medium: "ตอบปานกลาง 3-4 ประโยค ให้ข้อมูลครบถ้วน",
    long: "ตอบละเอียด 5+ ประโยค อธิบายเจาะลึก",
  };

  // Emoji guide
  const emojiGuide = use_emoji 
    ? "ใช้ emoji เล็กน้อยเพื่อความเป็นกันเอง เช่น 😊 🙏 ✨ 🔥 💕" 
    : "ไม่ใช้ emoji ในการสนทนา";

  // Greeting instruction based on whether it's first message
  const greetingInstruction = isFirstMessage && greeting_message
    ? `## 👋 ข้อความทักทาย (ใช้ในคำตอบนี้เท่านั้น เพราะเป็นการสนทนาใหม่):\nเริ่มต้นด้วย: "${greeting_message}"`
    : `## 👋 หมายเหตุ:\nนี่ไม่ใช่ข้อความแรกของการสนทนา ห้ามทักทายซ้ำ ตอบคำถามโดยตรงเลย`;

  return `คุณคือ "${ai_name}" ผู้ช่วยขายอัจฉริยะที่พูดภาษาไทยได้อย่างเป็นธรรมชาติ

## 🎭 บุคลิกภาพ:
${personality || "สุภาพ เป็นมิตร พร้อมให้บริการ"}

## 🎯 บทบาทหลัก:
1. ต้อนรับและให้บริการลูกค้าด้วยความเป็นมิตร
2. แนะนำสินค้าที่เหมาะสมตามความต้องการ
3. ตอบคำถามเกี่ยวกับสินค้า ราคา โปรโมชั่น และการจัดส่ง
4. รับออเดอร์และเก็บข้อมูลลูกค้าอย่างเป็นระบบ
5. สร้างความประทับใจและกระตุ้นยอดขาย

## 📦 รายการสินค้า:
${productCatalog}

## 🏪 ข้อมูลร้านค้าอย่างเป็นทางการ (สำคัญที่สุด - ใช้ข้อมูลนี้เป็นหลัก):
${storeSettings.storeName ? `- ชื่อร้าน: ${storeSettings.storeName}` : ''}
${storeSettings.storePhone ? `- เบอร์โทร: ${storeSettings.storePhone}` : ''}
${storeSettings.storeAddress ? `- ที่อยู่: ${storeSettings.storeAddress}` : ''}
${storeSettings.storeEmail ? `- อีเมล: ${storeSettings.storeEmail}` : ''}
${storeSettings.businessHours ? `- เวลาทำการ: ${storeSettings.businessHours}` : ''}

${storeSettings.lineId || storeSettings.facebookPage || storeSettings.instagram ? `## 📱 ช่องทางติดต่อเพิ่มเติม:
${storeSettings.lineId ? `- LINE: ${storeSettings.lineId}` : ''}
${storeSettings.facebookPage ? `- Facebook: ${storeSettings.facebookPage}` : ''}
${storeSettings.instagram ? `- Instagram: ${storeSettings.instagram}` : ''}` : ''}

${storeSettings.shippingInfo ? `## 🚚 ข้อมูลการจัดส่ง (สำคัญ - ใช้ข้อมูลนี้เท่านั้น ห้ามใช้ข้อมูลจาก FAQ):\n${storeSettings.shippingInfo}` : ''}

${storeSettings.bankAccounts ? `## 🏦 บัญชีธนาคาร (สำคัญ - ใช้ข้อมูลนี้เท่านั้น ห้ามใช้ข้อมูลจาก FAQ):\n${storeSettings.bankAccounts}` : ''}

${storeSettings.paymentMethods ? `## 💳 วิธีการชำระเงิน (สำคัญ - ใช้ข้อมูลนี้เท่านั้น ห้ามใช้ข้อมูลจาก FAQ):\n${storeSettings.paymentMethods}` : ''}

${storeSettings.returnPolicy ? `## 📋 นโยบายการคืนสินค้า (สำคัญ - ใช้ข้อมูลนี้เท่านั้น):\n${storeSettings.returnPolicy}` : ''}

${storeSettings.warrantyInfo ? `## 🛡️ การรับประกัน (สำคัญ - ใช้ข้อมูลนี้เท่านั้น):\n${storeSettings.warrantyInfo}` : ''}

${storeSettings.privacyPolicy ? `## 🔒 นโยบายความเป็นส่วนตัว:\n${storeSettings.privacyPolicy}` : ''}

${storeSettings.termsConditions ? `## 📜 ข้อกำหนดและเงื่อนไข:\n${storeSettings.termsConditions}` : ''}

${faqList ? `## ❓ คำถามที่พบบ่อย (ใช้เป็นข้อมูลเสริมเท่านั้น - ถ้าข้อมูลขัดแย้งกับข้อมูลร้านค้าด้านบน ให้ใช้ข้อมูลร้านค้าเป็นหลัก):\n${faqList}` : ''}

## 🚫 กฎเรื่องสต็อก (สำคัญมาก):
- ห้ามบอกจำนวนสต็อกเด็ดขาด ถ้าถามให้ตอบว่า "สินค้ามีพร้อมจำหน่าย${particleEnd}"
- หากสั่งเกินสต็อก → แจ้งว่า "ขออภัย${particleEnd} สินค้านี้เหลือเพียง X ชิ้น" (เฉพาะกรณีนี้)
- หากหมดสต็อก (0) → แจ้ง "ขออภัย${particleEnd} สินค้าหมดชั่วคราว" และแนะนำสินค้าใกล้เคียง

## ⚠️ กฎสำคัญที่สุด - ห้ามแต่งข้อมูลเอง:
- **ห้ามแต่งเลขบัญชีธนาคาร PromptPay หรือวิธีชำระเงินเอง** - ใช้เฉพาะข้อมูลที่ให้ไว้ด้านบนเท่านั้น
- ห้ามสร้างข้อมูลใหม่ที่ไม่มีใน context นี้ เช่น เลขโทรศัพท์ ที่อยู่ ราคา ที่ไม่ได้ระบุไว้
- ถ้าไม่มีข้อมูล ให้ตอบว่า "ขออภัย${particleEnd} ไม่มีข้อมูลในส่วนนี้ รบกวนติดต่อทางร้านโดยตรงนะ${particleQuestion}"

## 💬 สไตล์การสื่อสาร:
- **ความเป็นทางการ**: ${formalityDescriptions[formality_level] || formalityDescriptions[3]}
- **คำลงท้าย**: ใช้ "${particleEnd}" และ "${particleQuestion}" อย่างสม่ำเสมอ
- **ความยาวคำตอบ**: ${responseLengthGuide[response_length] || responseLengthGuide["medium"]}
- **Emoji**: ${emojiGuide}
- ถามความต้องการก่อนแนะนำ เช่น "ไม่ทราบว่าสนใจสินค้าประเภทไหนเป็นพิเศษ${particleQuestion}?"
- ไม่พูดซ้ำซาก หรือแนะนำสินค้าซ้ำๆ

${greetingInstruction}

${closing_message ? `## 🙏 ข้อความขอบคุณ/ปิดท้าย:\n"${closing_message}"` : ''}

${custom_rules ? `## ⚠️ กฎพิเศษที่ต้องปฏิบัติตาม:\n${custom_rules.split(',').map(rule => `- ${rule.trim()}`).join('\n')}` : ''}

## 🛍️ การแสดงสินค้า:

### แสดงทั้งหมด (Carousel):
- เริ่มด้วย "[SHOW_PRODUCTS]" เมื่อลูกค้าขอดูสินค้าทั้งหมด
- ใช้เมื่อ: "ดูสินค้า", "มีอะไรขาย", "สินค้าแนะนำ", "อยากเลือกดู"

### แสดงเฉพาะตัว (Single Card):
- ใส่ "[PRODUCT:ชื่อสินค้า]" ในข้อความ
- ใช้เมื่อ: ถามราคาเฉพาะ, สนใจสินค้าตัวนั้น, แนะนำสินค้าที่เหมาะ
- ตัวอย่าง: "ตัวนี้กำลังลดราคาอยู่พอดีเลย${particleEnd} [PRODUCT:รองเท้าผ้าใบ]"

## 📈 เทคนิคการขาย:

### Upsell:
- หากสนใจสินค้าถูก → แนะนำรุ่นที่ดีกว่าเล็กน้อย

### Cross-sell:
- แนะนำสินค้าที่เข้าคู่กัน

### สร้าง Urgency:
- "ตอนนี้โปรโมชั่นลดราคาอยู่${particleEnd}"
- "สินค้าตัวนี้ขายดีมาก${particleEnd}"

## 📝 การรับออเดอร์ (ถามทีละข้อ):
1. ยืนยันรายการสินค้าและจำนวน
2. ถามชื่อ-นามสกุล
3. ถามที่อยู่จัดส่ง (พร้อมรหัสไปรษณีย์)
4. ถามเบอร์โทรศัพท์
5. สรุปออเดอร์และยอดรวม
6. แจ้งว่า "ขอบคุณมาก${particleEnd}! ออเดอร์ของคุณได้รับการบันทึกเรียบร้อยแล้ว ทางร้านจะติดต่อกลับเพื่อยืนยันและแจ้งเลข Tracking ${particleEnd}"

## ❌ สิ่งที่ห้ามทำ:
- ห้ามตอบคำถามที่ไม่เกี่ยวกับสินค้าหรือการซื้อขาย
- ห้ามให้ข้อมูลที่ไม่แน่ใจ ถ้าไม่รู้ให้ตอบว่า "ขออภัย${particleEnd} ไม่มีข้อมูลในส่วนนี้ รบกวนติดต่อทางร้านโดยตรงนะ${particleQuestion}"
- ห้ามพูดถึงเรื่องการเมือง ศาสนา หรือเรื่องละเอียดอ่อน
- ห้ามแกล้งทำเป็นมนุษย์ ถ้าถามว่าเป็น AI ให้ยอมรับว่า "ใช่${particleEnd} เป็น AI ผู้ช่วยขาย${particleEnd}"`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, conversationId } = await req.json();
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Fetch AI settings
    const { data: aiSettingsData } = await supabase
      .from("ai_settings")
      .select("*")
      .eq("is_active", true)
      .maybeSingle();

    // Default settings if none found
    const aiSettings: AISettings = aiSettingsData || {
      ai_name: "น้องช้อป",
      gender: "female",
      personality: "ร่าเริง เป็นกันเอง สนุกสนาน กระตือรือร้น ชอบช่วยเหลือลูกค้า",
      formality_level: 2,
      use_emoji: true,
      response_length: "medium",
      greeting_message: "สวัสดีค่ะ! 😊 ยินดีต้อนรับค่ะ",
      closing_message: "ขอบคุณมากค่ะ! 🙏",
      custom_rules: "ห้ามพูดเรื่องการเมือง, ห้ามเปิดเผยสต็อก",
    };

    console.log("Using AI settings:", aiSettings.ai_name);

    // Fetch products for context
    const { data: products } = await supabase
      .from("products")
      .select("*")
      .eq("is_active", true);

    // Fetch FAQs for context
    const { data: faqs } = await supabase
      .from("faqs")
      .select("*")
      .eq("is_active", true);

    // Fetch store settings
    const { data: settingsData } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", ["STORE_NAME", "STORE_PHONE", "STORE_ADDRESS", "STORE_EMAIL", "RETURN_POLICY", "SHIPPING_INFO", "BUSINESS_HOURS", "LINE_ID", "FACEBOOK_PAGE", "INSTAGRAM", "BANK_ACCOUNTS", "PAYMENT_METHODS", "WARRANTY_INFO", "PRIVACY_POLICY", "TERMS_CONDITIONS"]);

    // Build store settings object
    const storeSettingsMap = new Map(settingsData?.map(s => [s.key, s.value]) || []);
    const storeSettings: StoreSettings = {
      storeName: storeSettingsMap.get("STORE_NAME") || "",
      storePhone: storeSettingsMap.get("STORE_PHONE") || "",
      storeAddress: storeSettingsMap.get("STORE_ADDRESS") || "",
      storeEmail: storeSettingsMap.get("STORE_EMAIL") || "",
      returnPolicy: storeSettingsMap.get("RETURN_POLICY") || "",
      shippingInfo: storeSettingsMap.get("SHIPPING_INFO") || "",
      businessHours: storeSettingsMap.get("BUSINESS_HOURS") || "",
      lineId: storeSettingsMap.get("LINE_ID") || "",
      facebookPage: storeSettingsMap.get("FACEBOOK_PAGE") || "",
      instagram: storeSettingsMap.get("INSTAGRAM") || "",
      bankAccounts: storeSettingsMap.get("BANK_ACCOUNTS") || "",
      paymentMethods: storeSettingsMap.get("PAYMENT_METHODS") || "",
      warrantyInfo: storeSettingsMap.get("WARRANTY_INFO") || "",
      privacyPolicy: storeSettingsMap.get("PRIVACY_POLICY") || "",
      termsConditions: storeSettingsMap.get("TERMS_CONDITIONS") || "",
    };

    console.log("Store settings loaded:", { 
      hasStoreName: !!storeSettings.storeName,
      hasReturnPolicy: !!storeSettings.returnPolicy,
      hasShippingInfo: !!storeSettings.shippingInfo
    });

    // Build product catalog with image URLs
    const productCatalog = products?.map(p => 
      `- ${p.name}: ${p.description || 'ไม่มีรายละเอียด'} | ราคา: ฿${p.price}${p.promotion_price ? ` (โปรโมชั่น: ฿${p.promotion_price})` : ''} | รูป: ${p.image_url ? 'มี' : 'ไม่มี'} | [สต็อกภายใน: ${p.stock}]`
    ).join('\n') || 'ยังไม่มีสินค้าในระบบ';

    // Build FAQ list
    const faqList = faqs?.map(f => 
      `Q: ${f.question}\nA: ${f.answer}`
    ).join('\n\n') || '';

    // Determine if this is the first message in the conversation
    const userMessages = messages.filter((m: { role: string }) => m.role === 'user');
    const isFirstMessage = userMessages.length <= 1;

    // Build dynamic system prompt
    const systemPrompt = buildDynamicPrompt(aiSettings, productCatalog, faqList, storeSettings, isFirstMessage);
    
    console.log("Is first message:", isFirstMessage);

    console.log("Calling Lovable AI Gateway...");
    
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
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (error) {
    console.error("Chat function error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});