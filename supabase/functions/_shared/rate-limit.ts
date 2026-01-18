// Rate Limiting Helper for Edge Functions
// Uses the check_rate_limit database function

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset_at: string;
  retry_after?: number;
}

export async function checkRateLimit(
  supabase: any,
  identifier: string,
  endpoint: string,
  maxRequests: number = 60,
  windowSeconds: number = 60
): Promise<RateLimitResult> {
  try {
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_identifier: identifier,
      p_endpoint: endpoint,
      p_max_requests: maxRequests,
      p_window_seconds: windowSeconds
    });

    if (error) {
      console.error('Rate limit check error:', error);
      // Allow request if rate limit check fails
      return { allowed: true, remaining: maxRequests, reset_at: new Date().toISOString() };
    }

    return data as RateLimitResult;
  } catch (error) {
    console.error('Rate limit check exception:', error);
    // Allow request if rate limit check fails
    return { allowed: true, remaining: maxRequests, reset_at: new Date().toISOString() };
  }
}

export function createRateLimitResponse(result: RateLimitResult, corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({
      error: 'Too Many Requests',
      message: 'คุณส่งคำขอบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่',
      retry_after: result.retry_after
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After': String(result.retry_after || 60),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': result.reset_at
      }
    }
  );
}
