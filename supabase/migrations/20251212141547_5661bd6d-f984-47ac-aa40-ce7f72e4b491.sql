-- Add scheduled_at column to broadcast_messages
ALTER TABLE public.broadcast_messages 
ADD COLUMN scheduled_at timestamp with time zone DEFAULT NULL;

-- Add index for scheduled broadcasts
CREATE INDEX idx_broadcast_scheduled 
ON public.broadcast_messages (scheduled_at) 
WHERE status = 'scheduled' AND scheduled_at IS NOT NULL;