import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FB_PAGE_ACCESS_TOKEN = Deno.env.get("FB_PAGE_ACCESS_TOKEN");
const FB_VERIFY_TOKEN = Deno.env.get("FB_VERIFY_TOKEN");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

async function sendToFacebook(recipientId: string, message: string) {
  if (!FB_PAGE_ACCESS_TOKEN) {
    console.error("FB_PAGE_ACCESS_TOKEN not configured");
    return;
  }

  const response = await fetch(
    `https://graph.facebook.com/v18.0/me/messages?access_token=${FB_PAGE_ACCESS_TOKEN}`,
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
- ถ้าลูกค้าสั่งซื้อ ให้เก็บข้อมูล: ชื่อ, ที่อยู่, เบอร์โทร`;

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
          await sendToFacebook(senderId, "ขออภัยครับ เกิดข้อผิดพลาด");
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
        await sendToFacebook(senderId, aiResponse);
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
