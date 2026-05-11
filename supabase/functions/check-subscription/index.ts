import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));
    const { action, feature } = body;

    if (action === "get_info") {
      const { data, error } = await supabase.rpc("get_subscription_info");
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "check_feature") {
      if (!feature) {
        return new Response(JSON.stringify({ error: "feature parameter required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data, error } = await supabase.rpc("check_feature_access", { p_feature: feature });
      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, allowed: data, feature }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "check_quota") {
      const { data, error } = await supabase.rpc("check_message_quota");
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, quota: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "increment_usage") {
      const count: number = body.count || 1;
      const { data, error } = await supabase.rpc("increment_message_usage", { p_count: count });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, updated: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_all_plans") {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .order("price", { ascending: true });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, plans: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "upgrade_plan") {
      const { plan_id } = body;
      if (!plan_id) {
        return new Response(JSON.stringify({ error: "plan_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify plan exists
      const { data: plan, error: planError } = await supabase
        .from("subscription_plans")
        .select("id, name")
        .eq("id", plan_id)
        .single();

      if (planError || !plan) {
        return new Response(JSON.stringify({ error: "Invalid plan" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if subscription exists
      const { data: existingSub } = await supabase
        .from("store_subscription")
        .select("id")
        .limit(1)
        .maybeSingle();

      if (existingSub) {
        const { error: updateError } = await supabase
          .from("store_subscription")
          .update({ plan_id, messages_used: 0, started_at: new Date().toISOString() })
          .eq("id", existingSub.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("store_subscription")
          .insert({ plan_id, messages_used: 0, started_at: new Date().toISOString() });
        if (insertError) throw insertError;
      }

      // Notify admin
      await supabase.rpc("create_admin_notification", {
        p_type: "subscription_change",
        p_title: "📦 เปลี่ยนแผนการสมัครสมาชิก",
        p_message: `เปลี่ยนเป็นแผน ${plan.name} เรียบร้อยแล้ว`,
        p_data: { plan_id, plan_name: plan.name },
      });

      return new Response(
        JSON.stringify({ success: true, message: `Upgraded to ${plan.name}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("check-subscription error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
