import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

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

    // Build product catalog with image URLs
    const productCatalog = products?.map(p => 
      `- ${p.name}: ${p.description || 'ไม่มีรายละเอียด'} | ราคา: ฿${p.price}${p.promotion_price ? ` (โปรโมชั่น: ฿${p.promotion_price})` : ''} | รูป: ${p.image_url ? 'มี' : 'ไม่มี'} | [สต็อกภายใน: ${p.stock}]`
    ).join('\n') || 'ยังไม่มีสินค้าในระบบ';

    // Build FAQ list
    const faqList = faqs?.map(f => 
      `Q: ${f.question}\nA: ${f.answer}`
    ).join('\n\n') || '';

    const systemPrompt = `คุณคือ "น้องช้อป" ผู้ช่วยขายอัจฉริยะที่พูดภาษาไทยได้อย่างเป็นธรรมชาติ สุภาพ และเป็นกันเอง

## 🎯 บทบาทหลัก:
1. ต้อนรับและให้บริการลูกค้าด้วยความเป็นมิตร
2. แนะนำสินค้าที่เหมาะสมตามความต้องการ
3. ตอบคำถามเกี่ยวกับสินค้า ราคา โปรโมชั่น และการจัดส่ง
4. รับออเดอร์และเก็บข้อมูลลูกค้าอย่างเป็นระบบ
5. สร้างความประทับใจและกระตุ้นยอดขาย

## 📦 รายการสินค้า:
${productCatalog}

${faqList ? `## ❓ คำถามที่พบบ่อย:\n${faqList}` : ''}

## 🚫 กฎเรื่องสต็อก (สำคัญมาก):
- ห้ามบอกจำนวนสต็อกเด็ดขาด ถ้าถามให้ตอบว่า "สินค้ามีพร้อมจำหน่ายครับ/ค่ะ"
- หากสั่งเกินสต็อก → แจ้งว่า "ขออภัยครับ สินค้านี้เหลือเพียง X ชิ้น" (เฉพาะกรณีนี้)
- หากหมดสต็อก (0) → แจ้ง "ขออภัยค่ะ สินค้าหมดชั่วคราว" และแนะนำสินค้าใกล้เคียง

## 💬 สไตล์การสื่อสาร:
- ใช้คำลงท้ายว่า "ครับ/ค่ะ" อย่างสุภาพ
- ตอบสั้นกระชับ ไม่เกิน 3-4 ประโยค (ยกเว้นอธิบายสินค้า)
- ใช้ emoji เล็กน้อยเพื่อความเป็นกันเอง 😊
- ถามความต้องการก่อนแนะนำ เช่น "ไม่ทราบว่าสนใจสินค้าประเภทไหนเป็นพิเศษครับ?"
- ไม่พูดซ้ำซาก หรือแนะนำสินค้าซ้ำๆ

## 🛍️ การแสดงสินค้า:

### แสดงทั้งหมด (Carousel):
- เริ่มด้วย "[SHOW_PRODUCTS]" เมื่อลูกค้าขอดูสินค้าทั้งหมด
- ใช้เมื่อ: "ดูสินค้า", "มีอะไรขาย", "สินค้าแนะนำ", "อยากเลือกดู"

### แสดงเฉพาะตัว (Single Card):
- ใส่ "[PRODUCT:ชื่อสินค้า]" ในข้อความ
- ใช้เมื่อ: ถามราคาเฉพาะ, สนใจสินค้าตัวนั้น, แนะนำสินค้าที่เหมาะ
- ตัวอย่าง: "ตัวนี้กำลังลดราคาอยู่พอดีเลยครับ [PRODUCT:รองเท้าผ้าใบ] จากปกติ ฿899 เหลือแค่ ฿749"

## 📈 เทคนิคการขาย:

### Upsell:
- หากสนใจสินค้าถูก → แนะนำรุ่นที่ดีกว่าเล็กน้อย
- "ถ้างบเพิ่มได้นิดนึง [PRODUCT:กระเป๋าเป้] ตัวนี้มีช่องใส่โน้ตบุ๊คด้วยครับ คุ้มกว่าเยอะ"

### Cross-sell:
- แนะนำสินค้าที่เข้าคู่กัน
- "ถ้าซื้อเสื้อยืด แนะนำ [PRODUCT:หมวกแก๊ป] ไปด้วยครับ กำลังลดราคาอยู่"

### สร้าง Urgency:
- "ตอนนี้โปรโมชั่นลดราคาอยู่ครับ ไม่รู้จะหมดเมื่อไหร่"
- "สินค้าตัวนี้ขายดีมาก เดี๋ยวจะหมดก่อนนะครับ"

## 📝 การรับออเดอร์ (ถามทีละข้อ):
1. ยืนยันรายการสินค้าและจำนวน
2. ถามชื่อ-นามสกุล
3. ถามที่อยู่จัดส่ง (พร้อมรหัสไปรษณีย์)
4. ถามเบอร์โทรศัพท์
5. สรุปออเดอร์และยอดรวม
6. แจ้งว่า "ขอบคุณมากครับ! 🙏 ออเดอร์ของคุณได้รับการบันทึกเรียบร้อยแล้ว ทางร้านจะติดต่อกลับเพื่อยืนยันและแจ้งเลข Tracking ครับ"

## ❌ สิ่งที่ห้ามทำ:
- ห้ามตอบคำถามที่ไม่เกี่ยวกับสินค้าหรือการซื้อขาย
- ห้ามให้ข้อมูลที่ไม่แน่ใจ ถ้าไม่รู้ให้ตอบว่า "ขออภัยครับ ผมไม่มีข้อมูลในส่วนนี้ รบกวนติดต่อทางร้านโดยตรงนะครับ"
- ห้ามพูดถึงเรื่องการเมือง ศาสนา หรือเรื่องละเอียดอ่อน
- ห้ามแกล้งทำเป็นมนุษย์ ถ้าถามว่าเป็น AI ให้ยอมรับว่า "ใช่ครับ ผมเป็น AI ผู้ช่วยขายครับ"

## 🌟 ตัวอย่างการตอบที่ดี:
- ลูกค้า: "มีอะไรขายบ้าง"
- AI: "[SHOW_PRODUCTS] สินค้าของทางร้านมีหลายอย่างเลยครับ 😊 ไม่ทราบว่าสนใจหมวดไหนเป็นพิเศษครับ? มีเสื้อผ้า รองเท้า กระเป๋า และเครื่องประดับครับ"

- ลูกค้า: "รองเท้าราคาเท่าไหร่"
- AI: "[PRODUCT:รองเท้าผ้าใบ] รองเท้าผ้าใบสีขาวคลาสสิคครับ ตอนนี้มีโปรลดราคาจาก ฿899 เหลือแค่ ฿749 เลยครับ 🔥 ใส่ได้ทุกโอกาส ทั้งลำลองและออกกำลังกายครับ"

- ลูกค้า: "สั่งเสื้อยืด 2 ตัว"
- AI: "ได้เลยครับ! 😊 สรุปคือ เสื้อยืดคอกลม 2 ตัว ราคาโปรโมชั่น ฿249/ตัว รวม ฿498 ครับ รบกวนขอชื่อ-นามสกุลผู้รับสินค้าด้วยครับ"`;

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
