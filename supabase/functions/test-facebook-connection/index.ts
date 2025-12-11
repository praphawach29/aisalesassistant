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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify user is authenticated and is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, message: 'Missing authorization header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, message: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Check admin role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      return new Response(
        JSON.stringify({ success: false, message: 'Forbidden - Admin access required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // Read Facebook token from environment variable (secure secret)
    const pageAccessToken = Deno.env.get('FACEBOOK_PAGE_ACCESS_TOKEN');

    if (!pageAccessToken) {
      return new Response(
        JSON.stringify({ success: false, message: 'ยังไม่ได้ตั้งค่า Facebook Page Access Token ใน Secrets' }),
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
