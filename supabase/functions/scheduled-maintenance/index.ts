import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Secret to prevent unauthorized invocations when called as cron
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate cron secret for automated invocations
  const authHeader = req.headers.get("authorization");
  const cronSecret = req.headers.get("x-cron-secret");

  const isAuthorized =
    (authHeader && authHeader.startsWith("Bearer ")) ||
    (cronSecret && cronSecret === CRON_SECRET);

  if (!isAuthorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const tasks: string[] = body.tasks || ["all"];

    const results: Record<string, unknown> = {
      ran_at: new Date().toISOString(),
      tasks_completed: [] as string[],
      errors: [] as string[],
    };

    const shouldRun = (task: string) =>
      tasks.includes("all") || tasks.includes(task);

    // Task 1: Run all DB maintenance (audit logs, error logs, carts, rate limits, notifications)
    if (shouldRun("maintenance")) {
      try {
        const { data } = await supabase.rpc("run_maintenance");
        results["maintenance"] = data;
        (results.tasks_completed as string[]).push("maintenance");
      } catch (err) {
        (results.errors as string[]).push(`maintenance: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Task 2: Send booking reminders (bookings in next 24 hours)
    if (shouldRun("booking_reminders")) {
      try {
        const response = await fetch(
          `${SUPABASE_URL}/functions/v1/booking-reminder`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({ hours_ahead: 24 }),
          }
        );
        const reminderResult = await response.json();
        results["booking_reminders"] = reminderResult;
        (results.tasks_completed as string[]).push("booking_reminders");
      } catch (err) {
        (results.errors as string[]).push(`booking_reminders: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Task 3: Cleanup old booking slots
    if (shouldRun("booking_slots_cleanup")) {
      try {
        const { data } = await supabase.rpc("cleanup_old_booking_slots", { p_days_old: 30 });
        results["booking_slots_cleanup"] = { deleted: data };
        (results.tasks_completed as string[]).push("booking_slots_cleanup");
      } catch (err) {
        (results.errors as string[]).push(`booking_slots_cleanup: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Task 4: Process scheduled broadcasts
    if (shouldRun("scheduled_broadcasts")) {
      try {
        const response = await fetch(
          `${SUPABASE_URL}/functions/v1/process-scheduled-broadcasts`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
          }
        );
        const broadcastResult = await response.json();
        results["scheduled_broadcasts"] = broadcastResult;
        (results.tasks_completed as string[]).push("scheduled_broadcasts");
      } catch (err) {
        (results.errors as string[]).push(`scheduled_broadcasts: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Task 5: Process scheduled scrapes
    if (shouldRun("scheduled_scrapes")) {
      try {
        const response = await fetch(
          `${SUPABASE_URL}/functions/v1/process-scheduled-scrapes`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
          }
        );
        const scrapeResult = await response.json();
        results["scheduled_scrapes"] = scrapeResult;
        (results.tasks_completed as string[]).push("scheduled_scrapes");
      } catch (err) {
        (results.errors as string[]).push(`scheduled_scrapes: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Task 6: Auto follow-up messages
    if (shouldRun("auto_follow_up")) {
      try {
        const response = await fetch(
          `${SUPABASE_URL}/functions/v1/auto-follow-up`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
          }
        );
        const followUpResult = await response.json();
        results["auto_follow_up"] = followUpResult;
        (results.tasks_completed as string[]).push("auto_follow_up");
      } catch (err) {
        (results.errors as string[]).push(`auto_follow_up: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Task 7: Check and reset monthly message quota if billing period ended
    if (shouldRun("quota_reset_check")) {
      try {
        const { data: subInfo } = await supabase.rpc("get_subscription_info");
        if (subInfo && subInfo.days_remaining === 0) {
          await supabase.rpc("reset_monthly_message_usage");
          results["quota_reset"] = { reset: true, plan: subInfo.plan_name };
        } else {
          results["quota_reset"] = { reset: false, days_remaining: subInfo?.days_remaining };
        }
        (results.tasks_completed as string[]).push("quota_reset_check");
      } catch (err) {
        (results.errors as string[]).push(`quota_reset_check: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Log maintenance run to error_logs for audit
    await supabase.from("error_logs").insert({
      error_type: "backend",
      severity: "info",
      message: "Scheduled maintenance completed",
      stack_trace: JSON.stringify(results),
      source: "scheduled-maintenance",
      resolved: true,
    }).catch(() => {});

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("scheduled-maintenance error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
