-- Fix shopping_carts overly permissive RLS policies
DROP POLICY IF EXISTS "Anyone can view their cart items" ON public.shopping_carts;
DROP POLICY IF EXISTS "Anyone can update their cart items" ON public.shopping_carts;
DROP POLICY IF EXISTS "Anyone can delete their cart items" ON public.shopping_carts;

-- Admins can view all carts
CREATE POLICY "Admins can view carts" ON public.shopping_carts
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update carts
CREATE POLICY "Admins can update carts" ON public.shopping_carts
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete carts
CREATE POLICY "Admins can delete carts" ON public.shopping_carts
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Add DELETE policies for chat tables (admins only)
CREATE POLICY "Admins can delete conversations" ON public.chat_conversations
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete messages" ON public.chat_messages
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));