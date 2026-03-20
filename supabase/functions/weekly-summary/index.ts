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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get LINE access token and admin user ID
    const lineAccessToken = await getDecryptedSetting(supabase, "LINE_CHANNEL_ACCESS_TOKEN");
    const { data: adminLineIdSetting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "ADMIN_LINE_USER_ID")
      .maybeSingle();

    const adminLineUserId = adminLineIdSetting?.value;

    if (!lineAccessToken || !adminLineUserId) {
      console.log("Missing LINE access token or admin LINE user ID");
      return new Response(
        JSON.stringify({ success: false, error: "Missing LINE config" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate date range (last 7 days)
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekAgoISO = weekAgo.toISOString();

    // === Gather stats ===

    // 1. Orders this week
    const { data: weekOrders } = await supabase
      .from("orders")
      .select("id, total_amount, status, discount_amount")
      .gte("created_at", weekAgoISO);

    const totalOrders = weekOrders?.length || 0;
    const totalRevenue = weekOrders?.reduce((sum: number, o: any) => sum + (Number(o.total_amount) || 0), 0) || 0;
    const totalDiscount = weekOrders?.reduce((sum: number, o: any) => sum + (Number(o.discount_amount) || 0), 0) || 0;
    const confirmedOrders = weekOrders?.filter((o: any) => ['confirmed', 'payment_confirmed', 'shipped', 'delivered'].includes(o.status)).length || 0;
    const pendingOrders = weekOrders?.filter((o: any) => o.status === 'pending').length || 0;
    const cancelledOrders = weekOrders?.filter((o: any) => o.status === 'cancelled').length || 0;
    const shippedOrders = weekOrders?.filter((o: any) => ['shipped', 'delivered'].includes(o.status)).length || 0;

    // 2. Top selling products
    const { data: topProducts } = await supabase
      .from("order_items")
      .select("product_name, quantity, price")
      .gte("created_at", weekAgoISO);

    const productSales = new Map<string, { qty: number; revenue: number }>();
    if (topProducts) {
      for (const item of topProducts) {
        const key = item.product_name;
        if (!productSales.has(key)) {
          productSales.set(key, { qty: 0, revenue: 0 });
        }
        const ps = productSales.get(key)!;
        ps.qty += item.quantity;
        ps.revenue += item.price * item.quantity;
      }
    }

    const sortedProducts = Array.from(productSales.entries())
      .sort((a, b) => b[1].qty - a[1].qty)
      .slice(0, 5);

    // 3. New customers (conversations) this week
    const { data: newConversations, count: newCustomerCount } = await supabase
      .from("chat_conversations")
      .select("id", { count: "exact", head: true })
      .gte("created_at", weekAgoISO)
      .in("platform", ["line", "facebook"]);

    // 4. Total messages this week
    const { count: messageCount } = await supabase
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .gte("created_at", weekAgoISO);

    // 5. Bookings this week
    const { data: weekBookings } = await supabase
      .from("bookings")
      .select("id, status")
      .gte("created_at", weekAgoISO);

    const totalBookings = weekBookings?.length || 0;
    const confirmedBookings = weekBookings?.filter((b: any) => b.status === 'confirmed').length || 0;

    // 6. Low stock products
    const { data: lowStockProducts } = await supabase
      .from("products")
      .select("name, stock")
      .eq("is_active", true)
      .lte("stock", 5)
      .gt("stock", 0)
      .order("stock", { ascending: true })
      .limit(5);

    const { data: outOfStockProducts, count: outOfStockCount } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("stock", 0);

    // === Build Flex Message ===
    const dateFormat = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
    const periodText = `${dateFormat(weekAgo)} - ${dateFormat(now)}`;

    // Top products text
    const topProductsText = sortedProducts.length > 0
      ? sortedProducts.map((p, i) => `${i + 1}. ${p[0]} (${p[1].qty} ชิ้น / ฿${p[1].revenue.toLocaleString()})`).join("\n")
      : "ยังไม่มียอดขายในสัปดาห์นี้";

    // Low stock text
    const lowStockText = lowStockProducts && lowStockProducts.length > 0
      ? lowStockProducts.map((p: any) => `⚠️ ${p.name}: เหลือ ${p.stock} ชิ้น`).join("\n")
      : "✅ สต็อกปกติทุกรายการ";

    const flexMessage = {
      type: "flex",
      altText: `📊 สรุปยอดประจำสัปดาห์ ${periodText}`,
      contents: {
        type: "bubble",
        size: "giga",
        header: {
          type: "box",
          layout: "vertical",
          backgroundColor: "#1DB446",
          paddingAll: "20px",
          contents: [
            {
              type: "text",
              text: "📊 Weekly Summary",
              color: "#FFFFFF",
              size: "lg",
              weight: "bold"
            },
            {
              type: "text",
              text: periodText,
              color: "#FFFFFFCC",
              size: "sm",
              margin: "sm"
            }
          ]
        },
        body: {
          type: "box",
          layout: "vertical",
          spacing: "lg",
          paddingAll: "20px",
          contents: [
            // Revenue Section
            {
              type: "box",
              layout: "vertical",
              spacing: "sm",
              contents: [
                { type: "text", text: "💰 ยอดขาย", weight: "bold", size: "md", color: "#1DB446" },
                {
                  type: "box", layout: "horizontal", contents: [
                    { type: "text", text: "รายได้รวม", size: "sm", color: "#666666", flex: 3 },
                    { type: "text", text: `฿${totalRevenue.toLocaleString()}`, size: "sm", weight: "bold", align: "end", flex: 2 }
                  ]
                },
                ...(totalDiscount > 0 ? [{
                  type: "box" as const, layout: "horizontal" as const, contents: [
                    { type: "text" as const, text: "ส่วนลดรวม", size: "sm" as const, color: "#FF6B6B", flex: 3 },
                    { type: "text" as const, text: `-฿${totalDiscount.toLocaleString()}`, size: "sm" as const, color: "#FF6B6B", align: "end" as const, flex: 2 }
                  ]
                }] : []),
              ]
            },
            { type: "separator" },
            // Orders Section
            {
              type: "box",
              layout: "vertical",
              spacing: "sm",
              contents: [
                { type: "text", text: "📦 ออเดอร์", weight: "bold", size: "md", color: "#1DB446" },
                {
                  type: "box", layout: "horizontal", contents: [
                    { type: "text", text: "ออเดอร์ทั้งหมด", size: "sm", color: "#666666", flex: 3 },
                    { type: "text", text: `${totalOrders} รายการ`, size: "sm", weight: "bold", align: "end", flex: 2 }
                  ]
                },
                {
                  type: "box", layout: "horizontal", contents: [
                    { type: "text", text: "✅ ยืนยัน/จ่ายแล้ว", size: "xs", color: "#1DB446", flex: 3 },
                    { type: "text", text: `${confirmedOrders}`, size: "xs", align: "end", flex: 2 }
                  ]
                },
                {
                  type: "box", layout: "horizontal", contents: [
                    { type: "text", text: "⏳ รอชำระ", size: "xs", color: "#FF9800", flex: 3 },
                    { type: "text", text: `${pendingOrders}`, size: "xs", align: "end", flex: 2 }
                  ]
                },
                {
                  type: "box", layout: "horizontal", contents: [
                    { type: "text", text: "🚚 จัดส่งแล้ว", size: "xs", color: "#2196F3", flex: 3 },
                    { type: "text", text: `${shippedOrders}`, size: "xs", align: "end", flex: 2 }
                  ]
                },
                ...(cancelledOrders > 0 ? [{
                  type: "box" as const, layout: "horizontal" as const, contents: [
                    { type: "text" as const, text: "❌ ยกเลิก", size: "xs" as const, color: "#FF6B6B", flex: 3 },
                    { type: "text" as const, text: `${cancelledOrders}`, size: "xs" as const, align: "end" as const, flex: 2 }
                  ]
                }] : []),
              ]
            },
            { type: "separator" },
            // Top Products
            {
              type: "box",
              layout: "vertical",
              spacing: "sm",
              contents: [
                { type: "text", text: "🏆 สินค้าขายดี Top 5", weight: "bold", size: "md", color: "#1DB446" },
                { type: "text", text: topProductsText, size: "xs", color: "#666666", wrap: true }
              ]
            },
            { type: "separator" },
            // Engagement
            {
              type: "box",
              layout: "vertical",
              spacing: "sm",
              contents: [
                { type: "text", text: "👥 ลูกค้า & แชท", weight: "bold", size: "md", color: "#1DB446" },
                {
                  type: "box", layout: "horizontal", contents: [
                    { type: "text", text: "ลูกค้าใหม่", size: "sm", color: "#666666", flex: 3 },
                    { type: "text", text: `${newCustomerCount || 0} คน`, size: "sm", weight: "bold", align: "end", flex: 2 }
                  ]
                },
                {
                  type: "box", layout: "horizontal", contents: [
                    { type: "text", text: "ข้อความทั้งหมด", size: "sm", color: "#666666", flex: 3 },
                    { type: "text", text: `${messageCount || 0} ข้อความ`, size: "sm", weight: "bold", align: "end", flex: 2 }
                  ]
                },
                ...(totalBookings > 0 ? [{
                  type: "box" as const, layout: "horizontal" as const, contents: [
                    { type: "text" as const, text: "📅 จองคิว", size: "sm" as const, color: "#666666", flex: 3 },
                    { type: "text" as const, text: `${totalBookings} (ยืนยัน ${confirmedBookings})`, size: "sm" as const, weight: "bold" as const, align: "end" as const, flex: 2 }
                  ]
                }] : []),
              ]
            },
            { type: "separator" },
            // Stock Alert
            {
              type: "box",
              layout: "vertical",
              spacing: "sm",
              contents: [
                { type: "text", text: "📦 สถานะสต็อก", weight: "bold", size: "md", color: "#1DB446" },
                { type: "text", text: lowStockText, size: "xs", color: "#666666", wrap: true },
                ...(outOfStockCount && outOfStockCount > 0 ? [
                  { type: "text" as const, text: `❌ สินค้าหมดสต็อก: ${outOfStockCount} รายการ`, size: "xs" as const, color: "#FF6B6B", wrap: true }
                ] : []),
              ]
            },
          ]
        },
        footer: {
          type: "box",
          layout: "vertical",
          paddingAll: "15px",
          contents: [
            {
              type: "text",
              text: "🤖 สร้างโดย SellMate AI อัตโนมัติ",
              size: "xxs",
              color: "#AAAAAA",
              align: "center"
            }
          ]
        }
      }
    };

    // Send to admin LINE
    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lineAccessToken}`,
      },
      body: JSON.stringify({
        to: adminLineUserId,
        messages: [flexMessage],
      }),
    });

    const success = res.ok;
    if (!success) {
      const errText = await res.text();
      console.error("Failed to send weekly summary:", errText);
    }

    // Save summary as admin notification
    await supabase.from("admin_notifications").insert({
      type: "weekly_summary",
      title: "📊 สรุปยอดประจำสัปดาห์",
      message: `รายได้ ฿${totalRevenue.toLocaleString()} | ออเดอร์ ${totalOrders} รายการ | ลูกค้าใหม่ ${newCustomerCount || 0} คน`,
      data: {
        period: periodText,
        total_revenue: totalRevenue,
        total_orders: totalOrders,
        confirmed_orders: confirmedOrders,
        pending_orders: pendingOrders,
        cancelled_orders: cancelledOrders,
        new_customers: newCustomerCount || 0,
        total_messages: messageCount || 0,
        total_bookings: totalBookings,
        top_products: sortedProducts.map(([name, data]) => ({ name, qty: data.qty, revenue: data.revenue })),
      },
    });

    console.log(`Weekly summary sent: revenue ฿${totalRevenue}, orders ${totalOrders}, customers ${newCustomerCount || 0}`);

    return new Response(
      JSON.stringify({
        success,
        period: periodText,
        total_revenue: totalRevenue,
        total_orders: totalOrders,
        top_products: sortedProducts.length,
        line_sent: success,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Weekly summary error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
