-- Function to reduce product stock when order items are created
CREATE OR REPLACE FUNCTION public.reduce_stock_on_order_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_stock integer;
  product_name text;
BEGIN
  -- Get current stock
  SELECT stock, name INTO current_stock, product_name
  FROM public.products
  WHERE id = NEW.product_id;
  
  IF NEW.product_id IS NOT NULL THEN
    -- Reduce stock
    UPDATE public.products
    SET stock = stock - NEW.quantity,
        updated_at = now()
    WHERE id = NEW.product_id;
    
    -- Log the stock reduction
    RAISE NOTICE 'Stock reduced for product % by % units', NEW.product_id, NEW.quantity;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto reduce stock when order items are inserted
DROP TRIGGER IF EXISTS trigger_reduce_stock_on_order_item ON public.order_items;
CREATE TRIGGER trigger_reduce_stock_on_order_item
AFTER INSERT ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.reduce_stock_on_order_item();

-- Function to restore stock when order is cancelled
CREATE OR REPLACE FUNCTION public.restore_stock_on_order_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only restore stock if changing TO cancelled from something else
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    -- Restore stock for all items in this order
    UPDATE public.products p
    SET stock = p.stock + oi.quantity,
        updated_at = now()
    FROM public.order_items oi
    WHERE oi.order_id = NEW.id
      AND oi.product_id = p.id;
    
    RAISE NOTICE 'Stock restored for cancelled order %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to restore stock when order is cancelled
DROP TRIGGER IF EXISTS trigger_restore_stock_on_order_cancel ON public.orders;
CREATE TRIGGER trigger_restore_stock_on_order_cancel
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.restore_stock_on_order_cancel();