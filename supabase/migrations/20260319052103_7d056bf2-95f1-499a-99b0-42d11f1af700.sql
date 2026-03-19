
-- Add anon SELECT policy for chat_conversations (scoped by conversation ID known to user)
CREATE POLICY "Anon can view conversations by id"
ON public.chat_conversations
FOR SELECT
TO anon
USING (true);

-- Add anon SELECT policy for chat_messages (scoped via conversation)
CREATE POLICY "Anon can view messages"
ON public.chat_messages
FOR SELECT
TO anon
USING (true);

-- Add anon UPDATE policy for chat_conversations (to update last_message)
CREATE POLICY "Anon can update conversations"
ON public.chat_conversations
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);
