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

    // Get LINE tokens from settings
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['LINE_CHANNEL_ACCESS_TOKEN', 'LINE_CHANNEL_SECRET']);

    if (settingsError) {
      console.error('Error fetching settings:', settingsError);
      return new Response(
        JSON.stringify({ success: false, message: 'ไม่สามารถโหลดการตั้งค่าได้' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const channelAccessToken = settings?.find(s => s.key === 'LINE_CHANNEL_ACCESS_TOKEN')?.value;

    if (!channelAccessToken) {
      return new Response(
        JSON.stringify({ success: false, message: 'ยังไม่ได้ตั้งค่า LINE Channel Access Token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Test LINE API by getting bot info
    console.log('Testing LINE connection...');
    const response = await fetch('https://api.line.me/v2/bot/info', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${channelAccessToken}`,
      },
    });

    const responseText = await response.text();
    console.log('LINE API response status:', response.status);
    console.log('LINE API response:', responseText);

    if (response.ok) {
      const botInfo = JSON.parse(responseText);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `เชื่อมต่อสำเร็จ! Bot: ${botInfo.displayName}`,
          botInfo: {
            displayName: botInfo.displayName,
            userId: botInfo.userId,
            pictureUrl: botInfo.pictureUrl
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      const errorData = JSON.parse(responseText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `การเชื่อมต่อล้มเหลว: ${errorData.message || 'Token ไม่ถูกต้อง'}`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
  } catch (error: unknown) {
    console.error('Error testing LINE connection:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, message: `เกิดข้อผิดพลาด: ${errorMessage}` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
