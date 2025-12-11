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

async function verifySignature(body: string, signature: string, channelSecret: string): Promise<boolean> {
  if (!channelSecret) return false;
  
  const hmac = createHmac("sha256", channelSecret);
  hmac.update(body);
  const digest = hmac.digest("base64");
  return digest === signature;
}

async function replyToLine(replyToken: string, messages: Array<{ type: string; text?: string; template?: any }>, accessToken: string) {
  if (!accessToken) {
    console.error("LINE_CHANNEL_ACCESS_TOKEN not configured");
    return;
  }

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

  const systemPrompt = `คุณคือผู้ช่วยขายอัจฉริยะทาง LINE พูดภาษาไทยสุภาพ ตอบสั้นกระชับ

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

      // Get AI response
      const aiResponse = await getAIResponse(messages, supabase);
      console.log("AI response generated:", aiResponse.slice(0, 100));

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

      // Reply to LINE
      if (LINE_CHANNEL_ACCESS_TOKEN) {
        console.log("Sending reply to LINE...");
        await replyToLine(replyToken, [{ type: "text", text: aiResponse }], LINE_CHANNEL_ACCESS_TOKEN);
      } else {
        console.error("Cannot reply - LINE_CHANNEL_ACCESS_TOKEN not configured");
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
