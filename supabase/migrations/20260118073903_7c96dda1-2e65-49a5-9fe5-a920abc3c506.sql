-- Drop existing policies for chat_conversations
DROP POLICY IF EXISTS "Admins can delete conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Admins can update conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Admins can view conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Anyone can create conversations" ON public.chat_conversations;

-- Drop existing policies for chat_messages
DROP POLICY IF EXISTS "Admins can delete messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Admins can view messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Anyone can create messages" ON public.chat_messages;

-- Create a helper function to get conversation owner
CREATE OR REPLACE FUNCTION public.get_conversation_platform_user_id(conv_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT platform_user_id FROM public.chat_conversations WHERE id = conv_id;
$$;

-- Create new RLS policies for chat_conversations

-- Admin can do everything
CREATE POLICY "Admins can manage all conversations"
ON public.chat_conversations
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Users can view their own conversations (matching platform_user_id with their user ID)
CREATE POLICY "Users can view own conversations"
ON public.chat_conversations
FOR SELECT
TO authenticated
USING (platform_user_id = auth.uid()::text);

-- Users can update their own conversations
CREATE POLICY "Users can update own conversations"
ON public.chat_conversations
FOR UPDATE
TO authenticated
USING (platform_user_id = auth.uid()::text);

-- Anyone can create conversations (for unauthenticated chat users)
CREATE POLICY "Anyone can create conversations"
ON public.chat_conversations
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Create new RLS policies for chat_messages

-- Admin can do everything with messages
CREATE POLICY "Admins can manage all messages"
ON public.chat_messages
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Users can view messages from their own conversations
CREATE POLICY "Users can view own messages"
ON public.chat_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_conversations 
    WHERE id = conversation_id 
    AND platform_user_id = auth.uid()::text
  )
);

-- Anyone can create messages (for unauthenticated chat users)
CREATE POLICY "Anyone can create messages"
ON public.chat_messages
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Users can delete their own messages
CREATE POLICY "Users can delete own messages"
ON public.chat_messages
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_conversations 
    WHERE id = conversation_id 
    AND platform_user_id = auth.uid()::text
  )
);