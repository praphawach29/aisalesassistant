import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Tables that can be exported/imported
const EXPORTABLE_TABLES: Record<string, string[]> = {
  orders: ["orders", "order_items", "payment_slips"],
  products: ["products", "product_images", "product_faqs", "related_products"],
  chats: ["chat_conversations", "chat_messages", "shopping_carts", "customer_addresses"],
  ai_settings: ["ai_settings", "ai_personality_templates"],
  knowledge: ["faqs", "knowledge_base", "scraped_content", "category_expertise"],
  coupons: ["coupons"],
  broadcasts: ["broadcast_messages", "message_templates"],
  bookings: ["booking_settings", "booking_slots", "bookings"],
  notifications: ["admin_notifications"],
};

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin authorization
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { action, sections, backup_data } = await req.json();

    if (action === "export") {
      // Export selected sections
      const exportSections = sections || Object.keys(EXPORTABLE_TABLES);
      const result: Record<string, Record<string, unknown[]>> = {};
      const stats: Record<string, number> = {};

      for (const section of exportSections) {
        const tables = EXPORTABLE_TABLES[section];
        if (!tables) continue;

        result[section] = {};
        for (const table of tables) {
          const { data, error } = await supabase.from(table).select("*");
          if (error) {
            console.error(`Error exporting ${table}:`, error);
            result[section][table] = [];
          } else {
            result[section][table] = data || [];
            stats[table] = data?.length || 0;
          }
        }
      }

      const exportData = {
        version: "1.0",
        exported_at: new Date().toISOString(),
        sections: result,
        stats,
      };

      return new Response(JSON.stringify({ success: true, data: exportData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "import") {
      if (!backup_data) {
        return new Response(JSON.stringify({ error: "No backup data provided" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const importStats: Record<string, number> = {};
      const errors: string[] = [];

      for (const [section, tables] of Object.entries(backup_data.sections || {})) {
        for (const [table, rows] of Object.entries(tables as Record<string, unknown[]>)) {
          if (!Array.isArray(rows) || rows.length === 0) continue;

          try {
            const { error } = await supabase
              .from(table)
              .upsert(rows as Record<string, unknown>[], { onConflict: "id", ignoreDuplicates: false });

            if (error) {
              errors.push(`${table}: ${error.message}`);
            } else {
              importStats[table] = rows.length;
            }
          } catch (err) {
            errors.push(`${table}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }

      return new Response(
        JSON.stringify({ success: errors.length === 0, stats: importStats, errors }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "get_counts") {
      const counts: Record<string, number> = {};

      for (const tables of Object.values(EXPORTABLE_TABLES)) {
        for (const table of tables) {
          const { count } = await supabase
            .from(table)
            .select("*", { count: "exact", head: true });
          counts[table] = count || 0;
        }
      }

      return new Response(JSON.stringify({ success: true, counts }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reset_section") {
      if (!sections || !Array.isArray(sections)) {
        return new Response(JSON.stringify({ error: "No sections specified" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const resetStats: Record<string, number> = {};
      const errors: string[] = [];

      for (const section of sections) {
        const tables = EXPORTABLE_TABLES[section];
        if (!tables) continue;

        // Delete in reverse order to handle FK dependencies
        for (const table of [...tables].reverse()) {
          const { error, count } = await supabase
            .from(table)
            .delete()
            .neq("id", "00000000-0000-0000-0000-000000000000");

          if (error) {
            errors.push(`${table}: ${error.message}`);
          } else {
            resetStats[table] = count || 0;
          }
        }
      }

      return new Response(
        JSON.stringify({ success: errors.length === 0, stats: resetStats, errors }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("backup-export error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
