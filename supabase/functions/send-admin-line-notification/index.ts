import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Encryption utilities
const ENCRYPTION_KEY = Deno.env.get('ENCRYPTION_KEY') || '';

async function getKey(): Promise<CryptoKey> {
  const keyData = new TextEncoder().encode(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
  return await crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM' }, false, ['decrypt']);
}

async function decrypt(encryptedText: string): Promise<string> {
  try {
    const key = await getKey();
    const combined = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return new TextDecoder().decode(decrypted);
  } catch {
    return encryptedText;
  }
}

async function getDecryptedSetting(supabase: any, key: string): Promise<string | null> {
  const { data } = await supabase.from('settings').select('value').eq('key', key).maybeSingle();
  if (!data?.value) return null;
  return await decrypt(data.value);
}

// Build LINE Flex Message for notifications
function buildNotificationFlex(notification: {
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown>;
}): any {
  const getTypeInfo = (type: string) => {
    switch (type) {
      case 'new_order':
        return { emoji: '🛒', color: '#00B900' };
      case 'low_stock':
        return { emoji: '⚠️', color: '#FFB800' };
      case 'out_of_stock':
        return { emoji: '🚨', color: '#FF0000' };
      case 'out_of_stock_request':
        return { emoji: '📦', color: '#FF6B00' };
      case 'payment_received':
        return { emoji: '💰', color: '#00B900' };
      default:
        return { emoji: '🔔', color: '#5B5B5B' };
    }
  };

  const typeInfo = getTypeInfo(notification.type);

  const contents: any = {
    type: 'bubble',
    size: 'kilo',
    header: {
      type: 'box',
      layout: 'horizontal',
      contents: [
        {
          type: 'text',
          text: typeInfo.emoji,
          size: 'xl',
          flex: 0
        },
        {
          type: 'text',
          text: notification.title,
          weight: 'bold',
          size: 'md',
          flex: 1,
          margin: 'md'
        }
      ],
      backgroundColor: typeInfo.color + '15',
      paddingAll: 'md'
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: notification.message,
          wrap: true,
          size: 'sm',
          color: '#555555'
        }
      ],
      paddingAll: 'lg'
    }
  };

  // Add extra details based on notification type
  const extraContents: any[] = [];

  if (notification.type === 'new_order' && notification.data) {
    if (notification.data.order_number) {
      extraContents.push({
        type: 'box',
        layout: 'horizontal',
        contents: [
          { type: 'text', text: 'เลขที่:', size: 'xs', color: '#8C8C8C', flex: 2 },
          { type: 'text', text: String(notification.data.order_number), size: 'xs', color: '#111111', flex: 4, weight: 'bold' }
        ],
        margin: 'md'
      });
    }
    if (notification.data.total_amount) {
      extraContents.push({
        type: 'box',
        layout: 'horizontal',
        contents: [
          { type: 'text', text: 'ยอดรวม:', size: 'xs', color: '#8C8C8C', flex: 2 },
          { type: 'text', text: `฿${Number(notification.data.total_amount).toLocaleString()}`, size: 'xs', color: '#00B900', flex: 4, weight: 'bold' }
        ],
        margin: 'sm'
      });
    }
    if (notification.data.customer_name) {
      extraContents.push({
        type: 'box',
        layout: 'horizontal',
        contents: [
          { type: 'text', text: 'ลูกค้า:', size: 'xs', color: '#8C8C8C', flex: 2 },
          { type: 'text', text: String(notification.data.customer_name), size: 'xs', color: '#111111', flex: 4 }
        ],
        margin: 'sm'
      });
    }
  }

  if ((notification.type === 'low_stock' || notification.type === 'out_of_stock') && notification.data) {
    if (notification.data.product_name) {
      extraContents.push({
        type: 'box',
        layout: 'horizontal',
        contents: [
          { type: 'text', text: 'สินค้า:', size: 'xs', color: '#8C8C8C', flex: 2 },
          { type: 'text', text: String(notification.data.product_name), size: 'xs', color: '#111111', flex: 4, wrap: true }
        ],
        margin: 'md'
      });
    }
    if (notification.data.stock !== undefined) {
      extraContents.push({
        type: 'box',
        layout: 'horizontal',
        contents: [
          { type: 'text', text: 'คงเหลือ:', size: 'xs', color: '#8C8C8C', flex: 2 },
          { type: 'text', text: `${notification.data.stock} ชิ้น`, size: 'xs', color: notification.type === 'out_of_stock' ? '#FF0000' : '#FFB800', flex: 4, weight: 'bold' }
        ],
        margin: 'sm'
      });
    }
  }

  if (extraContents.length > 0) {
    contents.body.contents.push({
      type: 'separator',
      margin: 'lg'
    });
    contents.body.contents.push(...extraContents);
  }

  // Add timestamp
  contents.footer = {
    type: 'box',
    layout: 'vertical',
    contents: [
      {
        type: 'text',
        text: new Date().toLocaleString('th-TH', { 
          timeZone: 'Asia/Bangkok',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        size: 'xxs',
        color: '#AAAAAA',
        align: 'end'
      }
    ],
    paddingAll: 'md'
  };

  return {
    type: 'flex',
    altText: notification.title,
    contents
  };
}

// Send LINE notification
async function sendLineNotification(accessToken: string, userId: string, message: any): Promise<boolean> {
  try {
    console.log(`Sending LINE notification to admin: ${userId}`);
    
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        to: userId,
        messages: [message],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('LINE API error:', errorText);
      return false;
    }

    console.log('LINE admin notification sent successfully');
    return true;
  } catch (error) {
    console.error('Error sending LINE notification:', error);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { notification_id, notification } = await req.json();

    // Get notification data
    let notificationData = notification;
    if (notification_id && !notification) {
      const { data, error } = await supabase
        .from('admin_notifications')
        .select('*')
        .eq('id', notification_id)
        .single();
      
      if (error || !data) {
        console.error('Notification not found:', error);
        return new Response(
          JSON.stringify({ success: false, message: 'Notification not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      notificationData = data;
    }

    if (!notificationData) {
      return new Response(
        JSON.stringify({ success: false, message: 'No notification data provided' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if admin LINE notification is enabled
    const { data: enabledSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'ADMIN_LINE_NOTIFY_ENABLED')
      .maybeSingle();

    if (enabledSetting?.value !== 'true') {
      console.log('Admin LINE notification is disabled');
      return new Response(
        JSON.stringify({ success: true, message: 'Admin LINE notification is disabled', sent: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get admin LINE user ID
    const { data: adminLineSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'ADMIN_LINE_USER_ID')
      .maybeSingle();

    const adminLineUserId = adminLineSetting?.value;
    if (!adminLineUserId) {
      console.log('Admin LINE user ID not configured');
      return new Response(
        JSON.stringify({ success: false, message: 'Admin LINE user ID not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get LINE access token
    const lineAccessToken = await getDecryptedSetting(supabase, 'LINE_CHANNEL_ACCESS_TOKEN');
    if (!lineAccessToken) {
      console.log('LINE access token not configured');
      return new Response(
        JSON.stringify({ success: false, message: 'LINE access token not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build and send notification
    const lineMessage = buildNotificationFlex({
      type: notificationData.type,
      title: notificationData.title,
      message: notificationData.message,
      data: notificationData.data || {}
    });

    const success = await sendLineNotification(lineAccessToken, adminLineUserId, lineMessage);

    return new Response(
      JSON.stringify({ 
        success, 
        message: success ? 'Notification sent to admin LINE' : 'Failed to send notification',
        sent: success
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-admin-line-notification:', error);
    return new Response(
      JSON.stringify({ success: false, message: String(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
