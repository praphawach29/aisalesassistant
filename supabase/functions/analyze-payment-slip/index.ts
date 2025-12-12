import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

interface AnalysisResult {
  success: boolean;
  analyzed_amount: number | null;
  analyzed_date: string | null;
  analyzed_bank: string | null;
  analyzed_account: string | null;
  confidence_score: number;
  raw_text?: string;
  error?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image_url, expected_amount, payment_slip_id, order_id } = await req.json();

    if (!image_url) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing image_url" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Analyzing payment slip: ${image_url}`);
    console.log(`Expected amount: ${expected_amount}`);

    // Call Lovable AI (Google Gemini) for image analysis
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `คุณเป็น AI สำหรับอ่านและวิเคราะห์สลิปการโอนเงินจากธนาคารไทย

กรุณาวิเคราะห์รูปสลิปและตอบเป็น JSON format เท่านั้น:
{
  "amount": <จำนวนเงินเป็นตัวเลข หรือ null ถ้าอ่านไม่ได้>,
  "date": "<วันที่ในรูปแบบ DD/MM/YYYY หรือ null>",
  "time": "<เวลาในรูปแบบ HH:MM หรือ null>",
  "bank": "<ชื่อธนาคาร เช่น กสิกร, กรุงเทพ, ไทยพาณิชย์, กรุงไทย, ทีเอ็มบี, ธ.ก.ส., ออมสิน, กรุงศรี หรือ null>",
  "account_last_digits": "<เลขบัญชี 4 หลักท้าย หรือ null>",
  "confidence": <ความมั่นใจ 0-100>,
  "notes": "<หมายเหตุเพิ่มเติม เช่น รูปไม่ชัด, ไม่ใช่สลิปโอนเงิน>"
}

กฎการอ่านสลิป:
1. จำนวนเงินต้องเป็นตัวเลขเท่านั้น ไม่รวมสัญลักษณ์ ฿ หรือ บาท
2. ถ้าเห็นจำนวนเงินหลายรายการ ให้เลือกจำนวนเงินที่โอน (ไม่ใช่ค่าธรรมเนียม)
3. ถ้ารูปไม่ชัดหรือไม่ใช่สลิปโอนเงิน ให้ confidence = 0
4. ธนาคารหลักในไทย: กสิกร (KBANK), กรุงเทพ (BBL), ไทยพาณิชย์ (SCB), กรุงไทย (KTB), ทีเอ็มบีธนชาต (ttb), กรุงศรี (BAY), ออมสิน (GSB), ธ.ก.ส. (BAAC)
5. ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่น`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "กรุณาวิเคราะห์สลิปโอนเงินนี้"
              },
              {
                type: "image_url",
                image_url: {
                  url: image_url
                }
              }
            ]
          }
        ],
        max_tokens: 500,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "AI analysis failed",
          analyzed_amount: null,
          analyzed_date: null,
          analyzed_bank: null,
          analyzed_account: null,
          confidence_score: 0
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const aiMessage = aiData.choices?.[0]?.message?.content || "";
    
    console.log("AI raw response:", aiMessage);

    // Parse JSON from AI response
    let parsed: any = null;
    try {
      // Extract JSON from response (might have markdown code blocks)
      const jsonMatch = aiMessage.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error("Failed to parse AI response as JSON:", e);
    }

    const result: AnalysisResult = {
      success: parsed !== null,
      analyzed_amount: parsed?.amount ?? null,
      analyzed_date: parsed?.date ? `${parsed.date}${parsed?.time ? ` ${parsed.time}` : ''}` : null,
      analyzed_bank: parsed?.bank ?? null,
      analyzed_account: parsed?.account_last_digits ?? null,
      confidence_score: parsed?.confidence ?? 0,
      raw_text: aiMessage,
    };

    console.log("Analysis result:", result);

    // If we have payment_slip_id, update the database
    if (payment_slip_id && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // Update payment_slips with analysis results
      const updateData: any = {
        analyzed_amount: result.analyzed_amount,
        analyzed_date: result.analyzed_date,
        analyzed_bank: result.analyzed_bank,
        analyzed_account: result.analyzed_account,
        confidence_score: result.confidence_score,
      };

      // Auto-verify if confidence is high and amount matches within tolerance (±5%)
      if (expected_amount && result.analyzed_amount && result.confidence_score >= 80) {
        const tolerance = expected_amount * 0.05; // 5% tolerance
        const amountDiff = Math.abs(result.analyzed_amount - expected_amount);
        
        if (amountDiff <= tolerance) {
          updateData.auto_verified = true;
          updateData.status = 'confirmed';
          updateData.confirmed_at = new Date().toISOString();
          updateData.admin_notes = `ยืนยันอัตโนมัติ: AI อ่านยอด ฿${result.analyzed_amount?.toLocaleString()} (คาดหวัง ฿${expected_amount?.toLocaleString()}) ความมั่นใจ ${result.confidence_score}%`;
          
          console.log(`Auto-verified: analyzed=${result.analyzed_amount}, expected=${expected_amount}, diff=${amountDiff}`);
          
          // Also update order status if order_id is provided
          if (order_id) {
            await supabase
              .from('orders')
              .update({ status: 'confirmed' })
              .eq('id', order_id);
            console.log(`Order ${order_id} status updated to confirmed`);
          }
        }
      }

      const { error: updateError } = await supabase
        .from('payment_slips')
        .update(updateData)
        .eq('id', payment_slip_id);

      if (updateError) {
        console.error("Error updating payment slip:", updateError);
      } else {
        console.log(`Payment slip ${payment_slip_id} updated with analysis results`);
      }

      // Return additional info about auto-verification
      (result as any).auto_verified = updateData.auto_verified || false;
      (result as any).amount_matches = updateData.auto_verified;
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in analyze-payment-slip:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error",
        analyzed_amount: null,
        analyzed_date: null,
        analyzed_bank: null,
        analyzed_account: null,
        confidence_score: 0
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
