import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  order_id: string;
  notification_type: 'status_update' | 'tracking_update' | 'custom';
  custom_message?: string;
}

const statusMessages: Record<string, string> = {
  pending: 'ออเดอร์ของคุณกำลังรอการดำเนินการ',
  confirmed: 'ออเดอร์ของคุณได้รับการยืนยันแล้ว',
  shipped: 'ออเดอร์ของคุณถูกจัดส่งแล้ว',
  delivered: 'ออเดอร์ของคุณส่งสำเร็จแล้ว',
  cancelled: 'ออเดอร์ของคุณถูกยกเลิก',
};

async function sendToLine(accessToken: string, userId: string, message: string): Promise<boolean> {
  try {
    console.log(`Sending LINE notification to ${userId}`);
    
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        to: userId,
        messages: [{ type: 'text', text: message }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('LINE API error:', errorText);
      return false;
    }

    console.log('LINE notification sent successfully');
    return true;
  } catch (error) {
    console.error('Error sending LINE notification:', error);
    return false;
  }
}

async function sendToFacebook(accessToken: string, userId: string, message: string): Promise<boolean> {
  try {
    console.log(`Sending Facebook notification to ${userId}`);
    
    const response = await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${accessToken}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipient: { id: userId },
        message: { text: message },
        messaging_type: 'UPDATE',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Facebook API error:', errorText);
      return false;
    }

    console.log('Facebook notification sent successfully');
    return true;
  } catch (error) {
    console.error('Error sending Facebook notification:', error);
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Create client with anon key to verify user's JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    // Verify user is authenticated and is an admin
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has admin role using service role client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (roleError || !roleData) {
      console.log('User is not admin:', user.id);
      return new Response(
        JSON.stringify({ success: false, error: 'Forbidden - Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { order_id, notification_type, custom_message }: NotificationRequest = await req.json();

    console.log(`Processing notification for order: ${order_id}, type: ${notification_type}`);

    // Fetch order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      console.error('Order not found:', orderError);
      return new Response(
        JSON.stringify({ success: false, error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch API tokens from settings
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['LINE_CHANNEL_ACCESS_TOKEN', 'FACEBOOK_PAGE_ACCESS_TOKEN']);

    if (settingsError) {
      console.error('Error fetching settings:', settingsError);
    }

    const lineToken = settings?.find(s => s.key === 'LINE_CHANNEL_ACCESS_TOKEN')?.value;
    const facebookToken = settings?.find(s => s.key === 'FACEBOOK_PAGE_ACCESS_TOKEN')?.value;

    // Build notification message
    let message = '';
    
    if (notification_type === 'custom' && custom_message) {
      message = custom_message;
    } else if (notification_type === 'tracking_update' && order.tracking_number) {
      message = `📦 อัพเดทออเดอร์ ${order.order_number}\n\n🚚 หมายเลขพัสดุ: ${order.tracking_number}\n\nคุณสามารถติดตามพัสดุได้แล้วค่ะ`;
    } else if (notification_type === 'status_update') {
      const statusText = statusMessages[order.status] || 'สถานะออเดอร์มีการเปลี่ยนแปลง';
      message = `📦 อัพเดทออเดอร์ ${order.order_number}\n\n${statusText}`;
      
      if (order.tracking_number && order.status === 'shipped') {
        message += `\n\n🚚 หมายเลขพัสดุ: ${order.tracking_number}`;
      }
    }

    if (!message) {
      return new Response(
        JSON.stringify({ success: false, error: 'No message to send' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let notificationSent = false;
    const results: { platform: string; success: boolean; error?: string }[] = [];

    // Send to LINE if applicable
    if (order.platform === 'line' && order.customer_line_id) {
      if (!lineToken) {
        console.error('LINE access token not configured');
        results.push({ platform: 'line', success: false, error: 'Token not configured' });
      } else {
        const success = await sendToLine(lineToken, order.customer_line_id, message);
        results.push({ platform: 'line', success });
        if (success) notificationSent = true;
      }
    }

    // Send to Facebook if applicable
    if (order.platform === 'facebook' && order.customer_facebook_id) {
      if (!facebookToken) {
        console.error('Facebook access token not configured');
        results.push({ platform: 'facebook', success: false, error: 'Token not configured' });
      } else {
        const success = await sendToFacebook(facebookToken, order.customer_facebook_id, message);
        results.push({ platform: 'facebook', success });
        if (success) notificationSent = true;
      }
    }

    // If web platform, we can't send push notifications
    if (order.platform === 'web') {
      console.log('Web platform - no push notification available');
      results.push({ platform: 'web', success: false, error: 'Push notification not available for web' });
    }

    return new Response(
      JSON.stringify({ 
        success: notificationSent, 
        results,
        message: notificationSent ? 'Notification sent' : 'No notification sent'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in send-order-notification:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
