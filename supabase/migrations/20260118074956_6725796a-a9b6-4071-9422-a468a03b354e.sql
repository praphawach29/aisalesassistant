-- =====================================
-- FIX ADMIN_NOTIFICATIONS RLS POLICIES
-- =====================================

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "System can insert notifications" ON public.admin_notifications;

-- Create a more secure INSERT policy
-- Only allow inserts from authenticated admin users or via database triggers/functions
CREATE POLICY "Admins and system can insert notifications"
ON public.admin_notifications
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow service role to insert (for triggers and edge functions)
-- This uses a security definer function approach
CREATE OR REPLACE FUNCTION public.create_admin_notification(
  p_type text,
  p_title text,
  p_message text,
  p_data jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  INSERT INTO public.admin_notifications (type, title, message, data)
  VALUES (p_type, p_title, p_message, p_data)
  RETURNING id INTO new_id;
  
  RETURN new_id;
END;
$$;

-- =====================================
-- MOVE PG_NET EXTENSION TO EXTENSIONS SCHEMA
-- =====================================

-- First, ensure the extensions schema exists
CREATE SCHEMA IF NOT EXISTS extensions;

-- Drop the extension from public schema
DROP EXTENSION IF EXISTS pg_net;

-- Recreate pg_net in extensions schema
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- =====================================
-- UPDATE TRIGGER FUNCTION TO USE NEW APPROACH
-- =====================================

-- Update notify_new_order to use SECURITY DEFINER properly
CREATE OR REPLACE FUNCTION public.notify_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.admin_notifications (type, title, message, data)
  VALUES (
    'new_order',
    'ออเดอร์ใหม่!',
    'มีออเดอร์ใหม่ ' || NEW.order_number || ' จาก ' || NEW.customer_name,
    jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number, 'customer_name', NEW.customer_name, 'total_amount', NEW.total_amount, 'platform', NEW.platform)
  );
  RETURN NEW;
END;
$$;

-- Update notify_low_stock to use SECURITY DEFINER properly
CREATE OR REPLACE FUNCTION public.notify_low_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Notify if stock is 5 or less but not 0
  IF NEW.stock <= 5 AND NEW.stock > 0 AND (OLD.stock IS NULL OR OLD.stock > 5) THEN
    INSERT INTO public.admin_notifications (type, title, message, data)
    VALUES (
      'low_stock',
      'สินค้าใกล้หมด!',
      'สินค้า "' || NEW.name || '" เหลือเพียง ' || NEW.stock || ' ชิ้น',
      jsonb_build_object('product_id', NEW.id, 'product_name', NEW.name, 'stock', NEW.stock)
    );
  -- Notify if out of stock
  ELSIF NEW.stock = 0 AND (OLD.stock IS NULL OR OLD.stock > 0) THEN
    INSERT INTO public.admin_notifications (type, title, message, data)
    VALUES (
      'out_of_stock',
      'สินค้าหมด!',
      'สินค้า "' || NEW.name || '" หมดสต็อกแล้ว',
      jsonb_build_object('product_id', NEW.id, 'product_name', NEW.name, 'stock', 0)
    );
  END IF;
  RETURN NEW;
END;
$$;