
-- Table to track follow-up messages sent to customers
CREATE TABLE public.follow_up_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_user_id text NOT NULL,
  follow_up_type text NOT NULL, -- 'abandoned_cart' or 'pending_order'
  reference_id text, -- order_id or cart group identifier
  follow_up_count integer NOT NULL DEFAULT 1,
  last_sent_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Unique constraint to track per user + type + reference
CREATE UNIQUE INDEX idx_follow_up_unique ON public.follow_up_tracking (platform_user_id, follow_up_type, reference_id);

-- Index for cleanup queries
CREATE INDEX idx_follow_up_last_sent ON public.follow_up_tracking (last_sent_at);

-- RLS
ALTER TABLE public.follow_up_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only for follow_up_tracking"
ON public.follow_up_tracking
FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- Auto-cleanup old tracking records (older than 7 days)
CREATE OR REPLACE FUNCTION public.cleanup_follow_up_tracking()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM follow_up_tracking
  WHERE last_sent_at < now() - INTERVAL '7 days';
END;
$$;
