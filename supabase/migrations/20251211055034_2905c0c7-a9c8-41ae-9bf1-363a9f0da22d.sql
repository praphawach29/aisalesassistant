-- Fix chat_conversations RLS - restrict to admins only
DROP POLICY IF EXISTS "Anyone can view conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Anyone can update conversations" ON public.chat_conversations;

CREATE POLICY "Admins can view conversations" ON public.chat_conversations
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update conversations" ON public.chat_conversations
  FOR UPDATE USING (has_role(auth.uid(), 'admin'));

-- Fix chat_messages RLS - restrict to admins only  
DROP POLICY IF EXISTS "Anyone can view messages" ON public.chat_messages;

CREATE POLICY "Admins can view messages" ON public.chat_messages
  FOR SELECT USING (has_role(auth.uid(), 'admin'));