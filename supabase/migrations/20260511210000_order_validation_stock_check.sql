-- ============================================================
-- Fix 3: Order Status Transition Validation
-- Fix 4: Stock Validation on Order Creation
-- Fix 5: Auto-Verify Payment Status Fix
-- ============================================================

-- 1. Valid order status transitions
CREATE OR REPLACE FUNCTION public.validate_order_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_valid boolean := false;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  CASE OLD.status::text
    WHEN 'pending' THEN
      v_valid := NEW.status::text IN ('confirmed', 'cancelled');
    WHEN 'confirmed' THEN
      v_valid := NEW.status::text IN ('payment_confirmed', 'cancelled');
    WHEN 'payment_confirmed' THEN
      v_valid := NEW.status::text IN ('shipped', 'cancelled');
    WHEN 'shipped' THEN
      v_valid := NEW.status::text IN ('delivered');
    WHEN 'delivered' THEN
      v_valid := false;
    WHEN 'cancelled' THEN
      v_valid := false;
    ELSE
      v_valid := false;
  END CASE;

  IF NOT v_valid THEN
    RAISE EXCEPTION 'Invalid status transition: % -> %', OLD.status, NEW.status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_order_status ON public.orders;
CREATE TRIGGER validate_order_status
  BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_order_status_transition();

-- 2. Stock validation function for order creation
CREATE OR REPLACE FUNCTION public.validate_stock_before_order(
  p_product_id uuid,
  p_quantity integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock integer;
  v_product_name text;
  v_is_active boolean;
BEGIN
  SELECT stock_quantity, name, is_active
  INTO v_stock, v_product_name, v_is_active
  FROM products
  WHERE id = p_product_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Product not found');
  END IF;

  IF NOT v_is_active THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Product is inactive', 'product_name', v_product_name);
  END IF;

  IF v_stock < p_quantity THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Insufficient stock',
      'product_name', v_product_name,
      'available', v_stock,
      'requested', p_quantity
    );
  END IF;

  RETURN jsonb_build_object('valid', true, 'product_name', v_product_name, 'available', v_stock);
END;
$$;

-- 3. Batch stock validation for multiple items
CREATE OR REPLACE FUNCTION public.validate_order_stock(
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_result jsonb;
  v_errors jsonb := '[]'::jsonb;
  v_all_valid boolean := true;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_result := public.validate_stock_before_order(
      (v_item->>'product_id')::uuid,
      (v_item->>'quantity')::integer
    );

    IF NOT (v_result->>'valid')::boolean THEN
      v_all_valid := false;
      v_errors := v_errors || jsonb_build_array(v_result);
    END IF;
  END LOOP;

  RETURN jsonb_build_object('valid', v_all_valid, 'errors', v_errors);
END;
$$;

-- 4. Get valid next statuses for an order
CREATE OR REPLACE FUNCTION public.get_valid_order_transitions(p_current_status text)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  CASE p_current_status
    WHEN 'pending' THEN RETURN ARRAY['confirmed', 'cancelled'];
    WHEN 'confirmed' THEN RETURN ARRAY['payment_confirmed', 'cancelled'];
    WHEN 'payment_confirmed' THEN RETURN ARRAY['shipped', 'cancelled'];
    WHEN 'shipped' THEN RETURN ARRAY['delivered'];
    WHEN 'delivered' THEN RETURN ARRAY[]::text[];
    WHEN 'cancelled' THEN RETURN ARRAY[]::text[];
    ELSE RETURN ARRAY[]::text[];
  END CASE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_stock_before_order(uuid, integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.validate_order_stock(jsonb) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_valid_order_transitions(text) TO authenticated, anon;
