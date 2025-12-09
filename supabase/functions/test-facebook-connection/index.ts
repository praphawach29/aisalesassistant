import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get Facebook tokens from settings
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['FACEBOOK_PAGE_ACCESS_TOKEN']);

    if (settingsError) {
      console.error('Error fetching settings:', settingsError);
      return new Response(
        JSON.stringify({ success: false, message: 'ไม่สามารถโหลดการตั้งค่าได้' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const pageAccessToken = settings?.find(s => s.key === 'FACEBOOK_PAGE_ACCESS_TOKEN')?.value;

    if (!pageAccessToken) {
      return new Response(
        JSON.stringify({ success: false, message: 'ยังไม่ได้ตั้งค่า Facebook Page Access Token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Test Facebook API by getting page info
    console.log('Testing Facebook connection...');
    const response = await fetch(`https://graph.facebook.com/v18.0/me?access_token=${pageAccessToken}`);

    const responseText = await response.text();
    console.log('Facebook API response status:', response.status);
    console.log('Facebook API response:', responseText);

    if (response.ok) {
      const pageInfo = JSON.parse(responseText);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `เชื่อมต่อสำเร็จ! Page: ${pageInfo.name}`,
          pageInfo: {
            name: pageInfo.name,
            id: pageInfo.id
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      const errorData = JSON.parse(responseText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `การเชื่อมต่อล้มเหลว: ${errorData.error?.message || 'Token ไม่ถูกต้อง'}`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
  } catch (error: unknown) {
    console.error('Error testing Facebook connection:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, message: `เกิดข้อผิดพลาด: ${errorMessage}` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
