import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Checking for scheduled scrapes...");

    // Get content that needs scraping (next_scrape_at <= now and is_active)
    const { data: dueContent, error: fetchError } = await supabase
      .from("scraped_content")
      .select("*")
      .eq("is_active", true)
      .neq("scrape_interval", "manual")
      .lte("next_scrape_at", new Date().toISOString());

    if (fetchError) {
      console.error("Error fetching scheduled content:", fetchError);
      throw fetchError;
    }

    if (!dueContent || dueContent.length === 0) {
      console.log("No scheduled scrapes due");
      return new Response(JSON.stringify({ success: true, message: "No scheduled scrapes due", processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${dueContent.length} URLs to scrape`);

    let processed = 0;
    let errors = 0;

    for (const item of dueContent) {
      try {
        console.log(`Scraping: ${item.url}`);

        // Scrape the website
        const response = await fetch(item.url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; LovableBot/1.0)",
            Accept: "text/html,application/xhtml+xml",
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const html = await response.text();

        // Extract content
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : item.title;

        // Remove scripts, styles, and extract text
        let content = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
          .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
          .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .substring(0, 50000);

        // Generate summary using AI
        let summary = item.summary;
        try {
          const aiResponse = await fetch("https://lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                {
                  role: "system",
                  content: "สรุปเนื้อหาเว็บไซต์ให้กระชับ 2-3 ประโยค เน้นประเด็นสำคัญ ตอบเป็นภาษาไทย",
                },
                {
                  role: "user",
                  content: `สรุปเนื้อหานี้:\n${content.substring(0, 8000)}`,
                },
              ],
              max_tokens: 300,
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            summary = aiData.choices?.[0]?.message?.content || summary;
          }
        } catch (aiError) {
          console.error("AI summary error:", aiError);
        }

        // Calculate next scrape time
        const nextScrape = calculateNextScrapeTime(item.scrape_interval);

        // Update the record
        await supabase
          .from("scraped_content")
          .update({
            title,
            content,
            summary,
            last_scraped_at: new Date().toISOString(),
            next_scrape_at: nextScrape,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);

        processed++;
        console.log(`Successfully scraped: ${item.url}`);
      } catch (error) {
        errors++;
        console.error(`Error scraping ${item.url}:`, error);
        
        // Still update next_scrape_at to avoid retrying immediately
        const nextScrape = calculateNextScrapeTime(item.scrape_interval);
        await supabase
          .from("scraped_content")
          .update({ next_scrape_at: nextScrape })
          .eq("id", item.id);
      }
    }

    console.log(`Completed: ${processed} processed, ${errors} errors`);

    return new Response(
      JSON.stringify({ success: true, processed, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in scheduled scrapes:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function calculateNextScrapeTime(interval: string): string {
  const now = new Date();
  switch (interval) {
    case "hourly":
      now.setHours(now.getHours() + 1);
      break;
    case "daily":
      now.setDate(now.getDate() + 1);
      break;
    case "weekly":
      now.setDate(now.getDate() + 7);
      break;
    case "monthly":
      now.setMonth(now.getMonth() + 1);
      break;
    default:
      now.setDate(now.getDate() + 1);
  }
  return now.toISOString();
}
