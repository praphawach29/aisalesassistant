import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders } from "../_shared/cors.ts";

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

interface Booking {
  id: string;
  booking_number: string;
  customer_name: string;
  customer_phone: string;
  platform: string;
  booking_date: string;
  booking_time: string;
  service_name: string;
  status: string;
  reminder_sent: boolean;
}

async function sendLineReminder(
  accessToken: string,
  customerId: string,
  booking: Booking
): Promise<boolean> {
  const timeStr = booking.booking_time.substring(0, 5); // HH:MM
  const message = `📅 แจ้งเตือนการนัดหมาย\n\nสวัสดีคุณ ${booking.customer_name}\n\nคุณมีนัดหมาย:\n🔖 เลขที่: ${booking.booking_number}\n💼 บริการ: ${booking.service_name}\n📅 วันที่: ${booking.booking_date}\n⏰ เวลา: ${timeStr} น.\n\nกรุณามาตรงเวลาครับ/ค่ะ\nหากต้องการยกเลิกหรือเปลี่ยนแปลง กรุณาติดต่อเราโดยตรง`;

  try {
    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        to: customerId,
        messages: [{ type: "text", text: message }],
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get hours_ahead param (default: send reminders for bookings in next 24h)
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const hoursAhead: number = body.hours_ahead || 24;

    // Fetch booking settings to check if enabled
    const { data: bookingSettings } = await supabase
      .from("booking_settings")
      .select("is_enabled")
      .limit(1)
      .maybeSingle();

    if (!bookingSettings?.is_enabled) {
      return new Response(
        JSON.stringify({ success: true, message: "Booking system is disabled", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get upcoming bookings that haven't received a reminder
    const { data: upcomingBookings } = await supabase.rpc("get_upcoming_bookings", {
      p_hours_ahead: hoursAhead,
    });

    if (!upcomingBookings || upcomingBookings.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No upcoming bookings to remind", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch LINE access token
    const { data: tokenRow } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "LINE_ACCESS_TOKEN")
      .maybeSingle();

    const lineToken = tokenRow?.value ? await decrypt(tokenRow.value) : null;

    let sentCount = 0;
    const results: Array<{ booking_id: string; sent: boolean; error?: string }> = [];

    for (const booking of upcomingBookings as Booking[]) {
      let sent = false;
      let errorMsg: string | undefined;

      try {
        // Send LINE reminder if customer is on LINE platform
        if (booking.platform === "line" && lineToken && booking.customer_phone) {
          sent = await sendLineReminder(lineToken, booking.customer_phone, booking);
        }

        // Mark as reminder sent regardless of delivery success (to avoid spam)
        await supabase.rpc("mark_booking_reminder_sent", { p_booking_id: booking.id });

        // Create admin notification
        await supabase.rpc("create_admin_notification", {
          p_type: "booking_reminder",
          p_title: "📅 ส่งแจ้งเตือนนัดหมายแล้ว",
          p_message: `ส่งแจ้งเตือนให้ ${booking.customer_name} - ${booking.service_name} วันที่ ${booking.booking_date} เวลา ${booking.booking_time}`,
          p_data: {
            booking_id: booking.id,
            booking_number: booking.booking_number,
            customer_name: booking.customer_name,
            booking_date: booking.booking_date,
            booking_time: booking.booking_time,
          },
        });

        if (sent) sentCount++;
        results.push({ booking_id: booking.id, sent });
      } catch (err) {
        errorMsg = err instanceof Error ? err.message : String(err);
        results.push({ booking_id: booking.id, sent: false, error: errorMsg });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_processed: upcomingBookings.length,
        sent: sentCount,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("booking-reminder error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
