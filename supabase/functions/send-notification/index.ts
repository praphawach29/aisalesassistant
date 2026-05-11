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

interface NotificationPayload {
  type: "order_status" | "booking_reminder" | "low_stock" | "broadcast" | "custom";
  channel: "line" | "webhook" | "admin_line" | "all";
  recipient_id?: string;
  platform?: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

async function sendLineMessage(
  accessToken: string,
  userId: string,
  message: string
): Promise<boolean> {
  try {
    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        to: userId,
        messages: [{ type: "text", text: message }],
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function sendWebhookNotification(
  webhookUrl: string,
  payload: Record<string, unknown>
): Promise<boolean> {
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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
    const payload: NotificationPayload = await req.json();

    const { type, channel, recipient_id, platform, title, message, data } = payload;
    const results: Record<string, boolean> = {};

    // Fetch settings for integrations
    const { data: settingsRows } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", ["LINE_ACCESS_TOKEN", "LINE_ADMIN_USER_ID", "WEBHOOK_URL"]);

    const settings: Record<string, string> = {};
    for (const row of settingsRows || []) {
      if (row.value) {
        settings[row.key] = await decrypt(row.value);
      }
    }

    // Create admin notification in DB
    await supabase.rpc("create_admin_notification", {
      p_type: type,
      p_title: title,
      p_message: message,
      p_data: data || {},
    });

    // Send LINE message to customer
    if ((channel === "line" || channel === "all") && recipient_id && platform === "line") {
      const lineToken = settings["LINE_ACCESS_TOKEN"];
      if (lineToken) {
        results.line = await sendLineMessage(lineToken, recipient_id, message);
      }
    }

    // Send LINE notification to admin
    if (channel === "admin_line" || channel === "all") {
      const adminLineToken = settings["LINE_ACCESS_TOKEN"];
      const adminUserId = settings["LINE_ADMIN_USER_ID"];
      if (adminLineToken && adminUserId) {
        const adminMsg = `🔔 ${title}\n\n${message}`;
        results.admin_line = await sendLineMessage(adminLineToken, adminUserId, adminMsg);
      }
    }

    // Send webhook notification
    if (channel === "webhook" || channel === "all") {
      const webhookUrl = settings["WEBHOOK_URL"];
      if (webhookUrl) {
        results.webhook = await sendWebhookNotification(webhookUrl, {
          type,
          title,
          message,
          data,
          sent_at: new Date().toISOString(),
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-notification error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
