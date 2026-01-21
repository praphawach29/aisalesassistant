import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { productId } = await req.json();

    if (!productId) {
      return new Response(
        JSON.stringify({ error: 'Product ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch product with specifications
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, name, description, price, promotion_price, category, specifications, stock')
      .eq('id', productId)
      .single();

    if (productError || !product) {
      return new Response(
        JSON.stringify({ error: 'Product not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if product has enough data to generate FAQs
    if (!product.description && !product.specifications) {
      return new Response(
        JSON.stringify({ error: 'Product needs description or specifications to generate FAQs' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build product context for AI
    const productContext = `
ชื่อสินค้า: ${product.name}
หมวดหมู่: ${product.category || 'ไม่ระบุ'}
ราคา: ${product.promotion_price || product.price} บาท${product.promotion_price ? ` (ปกติ ${product.price} บาท)` : ''}
รายละเอียด: ${product.description || 'ไม่มี'}
รายละเอียดเพิ่มเติม (Specifications): ${product.specifications || 'ไม่มี'}
สต็อก: ${product.stock > 0 ? `มีสินค้า ${product.stock} ชิ้น` : 'สินค้าหมด'}
`.trim();

    // Call Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: `คุณเป็นผู้เชี่ยวชาญด้านการขายสินค้าออนไลน์ หน้าที่ของคุณคือสร้างคำถาม-คำตอบที่พบบ่อย (FAQ) สำหรับสินค้า
            
กฎการสร้าง FAQ:
1. สร้าง 3-5 คำถามที่ลูกค้ามักถามเกี่ยวกับสินค้านี้
2. คำถามต้องเกี่ยวข้องกับข้อมูลสินค้าจริง
3. คำตอบต้องชัดเจน กระชับ และเป็นประโยชน์
4. ใช้ภาษาไทยที่สุภาพและเป็นมิตร
5. หากมี specifications ให้เน้นสร้างคำถามเกี่ยวกับวัสดุ ขนาด การดูแลรักษา
6. หากมีราคาโปรโมชั่น ให้สร้างคำถามเกี่ยวกับโปรโมชั่น

ตอบกลับในรูปแบบ JSON array เท่านั้น:
[
  {"question": "คำถาม", "answer": "คำตอบ"},
  ...
]`
          },
          {
            role: 'user',
            content: `สร้าง FAQ สำหรับสินค้านี้:\n\n${productContext}`
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI Gateway error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded, please try again later' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required, please add credits' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error('AI Gateway request failed');
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in AI response');
    }

    // Parse JSON from AI response (handle markdown code blocks)
    let faqs: Array<{ question: string; answer: string }>;
    try {
      let jsonStr = content.trim();
      // Remove markdown code blocks if present
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      faqs = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      throw new Error('Invalid AI response format');
    }

    if (!Array.isArray(faqs) || faqs.length === 0) {
      throw new Error('No FAQs generated');
    }

    // Get current max sort_order for this product
    const { data: existingFaqs } = await supabase
      .from('product_faqs')
      .select('sort_order')
      .eq('product_id', productId)
      .order('sort_order', { ascending: false })
      .limit(1);

    let sortOrder = (existingFaqs?.[0]?.sort_order ?? -1) + 1;

    // Insert generated FAQs
    const faqsToInsert = faqs.map((faq, index) => ({
      product_id: productId,
      question: faq.question,
      answer: faq.answer,
      sort_order: sortOrder + index,
      is_active: true,
    }));

    const { data: insertedFaqs, error: insertError } = await supabase
      .from('product_faqs')
      .insert(faqsToInsert)
      .select();

    if (insertError) {
      console.error('Insert error:', insertError);
      throw new Error('Failed to save generated FAQs');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        faqs: insertedFaqs,
        count: insertedFaqs?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Generate FAQ error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
