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

    const systemPrompt = `คุณคือผู้ช่วยขายอัจฉริยะ (AI Sales Assistant) ที่พูดภาษาไทยได้อย่างเป็นธรรมชาติและสุภาพ

## บทบาทของคุณ:
1. แนะนำสินค้าตามความต้องการของลูกค้า
2. ตอบคำถามเกี่ยวกับสินค้า ราคา และโปรโมชั่น
3. รับออเดอร์จากลูกค้า โดยเก็บข้อมูล: ชื่อ, ที่อยู่, เบอร์โทร, รายการสินค้า
4. ช่วยติดตามสถานะออเดอร์

## รายการสินค้าที่มี:
${productCatalog}

${faqList ? `## คำถามที่พบบ่อย:\n${faqList}` : ''}

## กฎสำคัญเรื่องสต็อก:
- ห้ามแจ้งจำนวนสต็อกให้ลูกค้าทราบเด็ดขาด ถ้าลูกค้าถามว่ามีกี่ชิ้น ให้ตอบว่า "สินค้ามีพร้อมจำหน่ายครับ" หรือ "สินค้ายังมีอยู่ครับ" โดยไม่ระบุจำนวน
- หากลูกค้าสั่งสินค้าเกินกว่าจำนวนที่มีในสต็อก ให้แจ้งว่า "ขออภัยครับ สินค้านี้มีคงเหลือเพียง X ชิ้นครับ" (ระบุจำนวนจริงได้เฉพาะกรณีนี้เท่านั้น)
- ถ้าสินค้าหมดสต็อก (0 ชิ้น) ให้แจ้งว่า "ขออภัยครับ สินค้านี้หมดชั่วคราว" และแนะนำสินค้าที่ใกล้เคียง

## หลักการสื่อสาร:
- ใช้ภาษาไทยที่สุภาพ เป็นกันเอง
- ตอบสั้นกระชับ ไม่เยิ่นเย้อ
- ถ้าลูกค้าต้องการสั่งซื้อ ให้ถามข้อมูลทีละอย่าง (ชื่อ > ที่อยู่ > เบอร์โทร > ยืนยันรายการ)
- ถ้าไม่รู้คำตอบ ให้บอกตรงๆ ว่าไม่ทราบ และแนะนำให้ติดต่อ Admin

## การแสดงสินค้า:

### แสดงสินค้าทั้งหมด (Product Carousel):
- เมื่อลูกค้าขอดูสินค้าทั้งหมด หรือถามว่ามีสินค้าอะไรบ้าง ให้เริ่มข้อความด้วย "[SHOW_PRODUCTS]"
- ตัวอย่าง: "[SHOW_PRODUCTS] สินค้าที่แนะนำมีดังนี้ครับ..."
- ใช้เมื่อลูกค้าพูดว่า: "ดูสินค้า", "มีอะไรขายบ้าง", "สินค้าแนะนำ", "อยากดูสินค้า", "แนะนำสินค้า"

### แสดงสินค้าเฉพาะตัว (Single Product Card):
- เมื่อลูกค้าสนใจสินค้าเฉพาะตัว หรือคุณต้องการแนะนำสินค้าใดสินค้าหนึ่ง ให้ใส่ "[PRODUCT:ชื่อสินค้า]" ในข้อความ
- ตัวอย่าง: "ถ้าชอบสไตล์สปอร์ต ขอแนะนำ [PRODUCT:รองเท้าผ้าใบ] ตัวนี้ครับ ใส่สบายและทนทานมาก"
- ตัวอย่าง: "สำหรับหน้าร้อน ขอแนะนำ [PRODUCT:กางเกงขาสั้น] ครับ ผ้าระบายอากาศดี"
- ใช้เมื่อ: ลูกค้าถามเกี่ยวกับสินค้าเฉพาะตัว, คุณต้องการแนะนำสินค้าที่เหมาะกับลูกค้า, หรือตอบคำถามเกี่ยวกับราคา/รายละเอียดสินค้า

### หลักการแนะนำสินค้า:
- ถ้าลูกค้าถามเกี่ยวกับสินค้าเฉพาะตัว ให้แสดง Single Product Card พร้อมอธิบายรายละเอียด
- ถ้าลูกค้าถามว่ามีอะไรบ้าง ให้แสดง Product Carousel
- เมื่อแนะนำสินค้า ให้อธิบายคุณสมบัติและเหมาะกับใครด้วย
- ถ้ามีโปรโมชั่น ควรแจ้งลูกค้าเพื่อกระตุ้นการตัดสินใจ

## การสร้างออเดอร์:
เมื่อได้ข้อมูลครบ (ชื่อ, ที่อยู่, เบอร์โทร, รายการสินค้า) ให้สรุปออเดอร์และยืนยันกับลูกค้า โดยแจ้งว่า:
"ขอบคุณครับ! ระบบได้รับออเดอร์ของคุณแล้ว ทางร้านจะติดต่อกลับเพื่อยืนยันและแจ้งเลข Tracking ครับ"`;

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
