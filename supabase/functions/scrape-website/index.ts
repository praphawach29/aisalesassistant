import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Helper to extract text from HTML
function extractTextFromHtml(html: string): { title: string; content: string } {
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : "";

  // Remove script and style tags with their content
  let cleanedHtml = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  // Extract text from main content areas if available
  const mainContentMatch = cleanedHtml.match(/<main[\s\S]*?<\/main>/i) ||
    cleanedHtml.match(/<article[\s\S]*?<\/article>/i) ||
    cleanedHtml.match(/<div[^>]*class="[^"]*content[^"]*"[\s\S]*?<\/div>/i);
  
  const contentHtml = mainContentMatch ? mainContentMatch[0] : cleanedHtml;

  // Remove HTML tags and decode entities
  let content = contentHtml
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  // Limit content length
  if (content.length > 10000) {
    content = content.substring(0, 10000) + "...";
  }

  return { title, content };
}

// Generate summary using AI
async function generateSummary(content: string, apiKey: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  if (!LOVABLE_API_KEY) {
    console.log("No LOVABLE_API_KEY, skipping summary generation");
    return "";
  }

  try {
    const response = await fetch("https://api.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: "คุณเป็นผู้ช่วยสรุปเนื้อหาเว็บไซต์ ให้สรุปเป็นภาษาไทยแบบกระชับ ครบถ้วน เน้นข้อมูลที่สำคัญสำหรับลูกค้าที่จะถามถึง เช่น สินค้า บริการ ราคา ติดต่อ เวลาทำการ เป็นต้น"
          },
          {
            role: "user",
            content: `สรุปเนื้อหาต่อไปนี้ให้กระชับ (ไม่เกิน 500 ตัวอักษร):\n\n${content.substring(0, 5000)}`
          }
        ],
        max_tokens: 1000,
        temperature: 0.3,
      }),
    });

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  } catch (error) {
    console.error("Error generating summary:", error);
    return "";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, sourceName, interval = "manual" } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: "URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Scraping URL:", url, "Interval:", interval);

    // Format URL
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
      formattedUrl = `https://${formattedUrl}`;
    }

    // Calculate next scrape time
    const nextScrapeAt = calculateNextScrapeTime(interval);

    // Fetch the webpage
    const response = await fetch(formattedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Lovable-Bot/1.0)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "th-TH,th;q=0.9,en;q=0.8",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    console.log("Fetched HTML length:", html.length);

    // Extract text content
    const { title, content } = extractTextFromHtml(html);
    console.log("Extracted title:", title);
    console.log("Content length:", content.length);

    // Generate AI summary
    const summary = await generateSummary(content, "");
    console.log("Generated summary length:", summary.length);

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Check if URL already exists
    const { data: existing } = await supabase
      .from("scraped_content")
      .select("id")
      .eq("url", formattedUrl)
      .maybeSingle();

    let result;
    if (existing) {
      // Update existing record
      const { data, error } = await supabase
        .from("scraped_content")
        .update({
          title: title || sourceName || "Untitled",
          content,
          summary,
          source_name: sourceName || title || formattedUrl,
          last_scraped_at: new Date().toISOString(),
          scrape_interval: interval,
          next_scrape_at: nextScrapeAt,
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Insert new record
      const { data, error } = await supabase
        .from("scraped_content")
        .insert({
          url: formattedUrl,
          title: title || sourceName || "Untitled",
          content,
          summary,
          source_name: sourceName || title || formattedUrl,
          scrape_interval: interval,
          next_scrape_at: nextScrapeAt,
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: result,
        extracted: { title, contentLength: content.length, summaryLength: summary.length }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error scraping website:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to scrape website";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function calculateNextScrapeTime(interval: string): string | null {
  if (interval === "manual") return null;
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
      return null;
  }
  return now.toISOString();
}
