import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ENCRYPTION_KEY = Deno.env.get("ENCRYPTION_KEY") || "";

async function getKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(ENCRYPTION_KEY.padEnd(32, "0").slice(0, 32));
  return await crypto.subtle.importKey("raw", keyData, { name: "AES-GCM" }, false, ["decrypt"]);
}

async function decrypt(encryptedText: string): Promise<string> {
  if (!encryptedText) return "";
  try {
    const key = await getKey();
    const combined = Uint8Array.from(atob(encryptedText), (c) => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted);
    return new TextDecoder().decode(decrypted);
  } catch {
    return encryptedText;
  }
}

async function getDecryptedSetting(supabase: any, key: string): Promise<string | null> {
  const { data } = await supabase.from("settings").select("value").eq("key", key).maybeSingle();
  if (!data?.value) return null;
  return await decrypt(data.value);
}

async function sendLineMessage(userId: string, messages: any[], accessToken: string): Promise<boolean> {
  try {
    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ to: userId, messages }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function sendFacebookMessage(userId: string, message: string, accessToken: string): Promise<boolean> {
  try {
    const res = await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${accessToken}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipient: { id: userId }, message: { text: message } }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const lineAccessToken = await getDecryptedSetting(supabase, "LINE_CHANNEL_ACCESS_TOKEN");
    const facebookAccessToken = await getDecryptedSetting(supabase, "FACEBOOK_PAGE_ACCESS_TOKEN");

    let abandonedCartCount = 0;
    let pendingOrderCount = 0;

    // === 1. Abandoned Cart Follow-up ===
    // Carts older than 2 hours with no order
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: abandonedCarts } = await supabase
      .from("shopping_carts")
      .select("platform_user_id, product_name, price, quantity, conversation_id")
      .lt("updated_at", twoHoursAgo)
      .gt("updated_at", oneDayAgo);

    if (abandonedCarts && abandonedCarts.length > 0) {
      // Group by user
      const userCarts = new Map<string, { products: string[]; total: number }>();
      for (const item of abandonedCarts) {
        const uid = item.platform_user_id;
        if (!userCarts.has(uid)) {
          userCarts.set(uid, { products: [], total: 0 });
        }
        const cart = userCarts.get(uid)!;
        cart.products.push(item.product_name);
        cart.total += item.price * item.quantity;
      }

      for (const [userId, cart] of userCarts) {
        const productList = cart.products.slice(0, 3).join(", ");
        const msg = `🛒 สินค้าของคุณยังอยู่ในตะกร้านะคะ!\n\n${productList}${cart.products.length > 3 ? ` และอีก ${cart.products.length - 3} รายการ` : ""}\nรวม ฿${cart.total.toLocaleString()}\n\nพิมพ์ "ดูตะกร้า" เพื่อดำเนินการสั่งซื้อต่อค่ะ 💕`;

        // Determine platform from conversation
        const { data: conv } = await supabase
          .from("chat_conversations")
          .select("platform")
          .eq("platform_user_id", userId)
          .order("last_message_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const platform = conv?.platform || "line";

        if (platform === "line" && lineAccessToken) {
          await sendLineMessage(userId, [{ type: "text", text: msg }], lineAccessToken);
          abandonedCartCount++;
        } else if (platform === "facebook" && facebookAccessToken) {
          await sendFacebookMessage(userId, msg, facebookAccessToken);
          abandonedCartCount++;
        }

        await new Promise((r) => setTimeout(r, 100));
      }
    }

    // === 2. Pending Order Reminder ===
    // Send once around 6-hour mark (6-8 hours old) to avoid duplicate reminders every cron run
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const eightHoursAgo = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString();

    const { data: pendingOrders } = await supabase
      .from("orders")
      .select("id, order_number, customer_name, customer_line_id, customer_facebook_id, total_amount, platform")
      .eq("status", "pending")
      .lt("created_at", sixHoursAgo)
      .gt("created_at", eightHoursAgo);

    if (pendingOrders) {
      for (const order of pendingOrders) {
        // Check if payment slip exists
        const { data: slips } = await supabase
          .from("payment_slips")
          .select("id")
          .eq("order_id", order.id)
          .limit(1);

        if (slips && slips.length > 0) continue; // Already has payment slip

        const msg = `📦 ออเดอร์ ${order.order_number}\n\nสวัสดีค่ะ คุณ${order.customer_name} ออเดอร์ของคุณยอดรวม ฿${order.total_amount.toLocaleString()} ยังรอการชำระเงินอยู่นะคะ\n\nส่งสลิปโอนเงินมาได้เลยค่ะ เราจะตรวจสอบให้ทันที ✨`;

        if (order.customer_line_id && lineAccessToken) {
          await sendLineMessage(order.customer_line_id, [{ type: "text", text: msg }], lineAccessToken);
          pendingOrderCount++;
        } else if (order.customer_facebook_id && facebookAccessToken) {
          await sendFacebookMessage(order.customer_facebook_id, msg, facebookAccessToken);
          pendingOrderCount++;
        }

        await new Promise((r) => setTimeout(r, 100));
      }
    }

    console.log(`Auto follow-up: ${abandonedCartCount} abandoned carts, ${pendingOrderCount} pending orders`);

    return new Response(
      JSON.stringify({
        success: true,
        abandoned_cart_reminders: abandonedCartCount,
        pending_order_reminders: pendingOrderCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Auto follow-up error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
