-- Create notifications table
CREATE TABLE public.admin_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL, -- 'new_order', 'low_stock', 'out_of_stock'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

-- Admin can view and manage notifications
CREATE POLICY "Admins can view notifications"
ON public.admin_notifications
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update notifications"
ON public.admin_notifications
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete notifications"
ON public.admin_notifications
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- System can insert notifications (for triggers)
CREATE POLICY "System can insert notifications"
ON public.admin_notifications
FOR INSERT
WITH CHECK (true);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_notifications;

-- Function to create notification on new order
CREATE OR REPLACE FUNCTION public.notify_new_order()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger for new order notifications
CREATE TRIGGER on_new_order_notify
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_order();

-- Function to check and notify low stock
CREATE OR REPLACE FUNCTION public.notify_low_stock()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger for stock notifications
CREATE TRIGGER on_stock_change_notify
AFTER INSERT OR UPDATE OF stock ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.notify_low_stock();