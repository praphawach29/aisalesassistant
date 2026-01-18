// CORS Helper for Edge Functions
// Supports both hardened and open CORS modes

const DEFAULT_ALLOWED_ORIGINS = [
  'https://aisalesassistant.lovable.app',
  'https://id-preview--10bc975e-c142-4a47-85df-1f14b4c66462.lovable.app'
];

export function getAllowedOrigins(): string[] {
  const envOrigins = Deno.env.get('ALLOWED_ORIGINS');
  if (envOrigins) {
    return envOrigins.split(',').map(o => o.trim()).filter(Boolean);
  }
  return DEFAULT_ALLOWED_ORIGINS;
}

export function getCorsHeaders(origin?: string | null, allowAll: boolean = false): Record<string, string> {
  // For webhooks from LINE/Facebook, allow all origins
  if (allowAll) {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-line-signature, x-hub-signature-256',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };
  }

  const allowedOrigins = getAllowedOrigins();
  
  // Check if origin is allowed
  if (origin && allowedOrigins.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Credentials': 'true'
    };
  }
  
  // Default to first allowed origin (for requests without origin header)
  return {
    'Access-Control-Allow-Origin': allowedOrigins[0] || '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };
}

export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return true; // Server-to-server requests
  return getAllowedOrigins().includes(origin);
}
