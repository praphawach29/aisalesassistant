import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ENCRYPTION_KEY = Deno.env.get('ENCRYPTION_KEY') || '';

// Simple AES-like encryption using Web Crypto API
async function getKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
  return await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encrypt(text: string): Promise<string> {
  if (!text) return '';
  
  const key = await getKey();
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(text)
  );
  
  // Combine IV and encrypted data, then base64 encode
  const combined = new Uint8Array(iv.length + new Uint8Array(encrypted).length);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

async function decrypt(encryptedText: string): Promise<string> {
  if (!encryptedText) return '';
  
  try {
    const key = await getKey();
    const combined = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));
    
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );
    
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    // Return original if decryption fails (might be unencrypted legacy data)
    return encryptedText;
  }
}

// Export decrypt function for use by other edge functions
export { decrypt, encrypt };

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify admin authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, settings, provider, value } = await req.json();

    if (action === 'encrypt_and_save') {
      // Encrypt each setting value and save to database
      const results = [];
      
      for (const setting of settings) {
        const encryptedValue = setting.value ? await encrypt(setting.value) : null;
        
        // Check if setting exists
        const { data: existing } = await supabase
          .from('settings')
          .select('id')
          .eq('key', setting.key)
          .maybeSingle();
        
        if (existing) {
          const { error } = await supabase
            .from('settings')
            .update({ value: encryptedValue, updated_at: new Date().toISOString() })
            .eq('key', setting.key);
          
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('settings')
            .insert({ 
              key: setting.key, 
              value: encryptedValue,
              description: setting.description 
            });
          
          if (error) throw error;
        }
        
        results.push({ key: setting.key, success: true });
      }
      
      return new Response(
        JSON.stringify({ success: true, results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'load_and_decrypt') {
      // Load settings from database and decrypt
      const { data: dbSettings, error } = await supabase
        .from('settings')
        .select('*')
        .order('key');
      
      if (error) throw error;
      
      const decryptedSettings = await Promise.all(
        (dbSettings || []).map(async (s) => ({
          ...s,
          value: s.value ? await decrypt(s.value) : null
        }))
      );
      
      return new Response(
        JSON.stringify({ success: true, settings: decryptedSettings }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle AI provider API key encryption and storage
    if (action === 'encrypt_provider_key') {
      if (!provider || !value) {
        return new Response(
          JSON.stringify({ error: 'Provider and value are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const validProviders = ['openai', 'gemini', 'deepseek', 'claude'];
      if (!validProviders.includes(provider)) {
        return new Response(
          JSON.stringify({ error: 'Invalid provider' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const encryptedKey = await encrypt(value);

      // Upsert the provider key
      const { error } = await supabase
        .from('ai_provider_keys')
        .upsert({
          provider,
          encrypted_api_key: encryptedKey,
          is_active: true,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'provider',
        });

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle decryption of provider key for use in chat
    if (action === 'get_provider_key') {
      if (!provider) {
        return new Response(
          JSON.stringify({ error: 'Provider is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: keyData, error } = await supabase
        .from('ai_provider_keys')
        .select('encrypted_api_key')
        .eq('provider', provider)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;

      if (!keyData?.encrypted_api_key) {
        return new Response(
          JSON.stringify({ error: 'API key not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const decryptedKey = await decrypt(keyData.encrypted_api_key);

      return new Response(
        JSON.stringify({ success: true, apiKey: decryptedKey }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in settings-crypto:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
