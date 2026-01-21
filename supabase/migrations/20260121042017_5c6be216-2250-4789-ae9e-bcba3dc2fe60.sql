-- Add human takeover columns to chat_conversations
ALTER TABLE public.chat_conversations 
ADD COLUMN IF NOT EXISTS is_human_takeover boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS assigned_admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS takeover_at timestamp with time zone;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_chat_conversations_takeover 
ON public.chat_conversations(is_human_takeover) 
WHERE is_human_takeover = true;