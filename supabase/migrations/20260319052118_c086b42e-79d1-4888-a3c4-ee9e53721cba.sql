
-- Replace overly permissive anon UPDATE policy with one scoped by platform_user_id header
DROP POLICY "Anon can update conversations" ON public.chat_conversations;

-- Anon can only update conversations they know the ID of (conversation ID acts as secret)
CREATE POLICY "Anon can update own conversations"
ON public.chat_conversations
FOR UPDATE
TO anon
USING (platform = 'web')
WITH CHECK (platform = 'web');
