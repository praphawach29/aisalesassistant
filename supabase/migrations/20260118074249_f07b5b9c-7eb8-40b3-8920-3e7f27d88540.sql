-- Drop existing policies for orders
DROP POLICY IF EXISTS "Admins can manage orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;

-- Drop existing policies for order_items
DROP POLICY IF EXISTS "Admins can manage order items" ON public.order_items;
DROP POLICY IF EXISTS "Admins can view all order items" ON public.order_items;
DROP POLICY IF EXISTS "Anyone can create order items" ON public.order_items;

-- Drop existing policies for shopping_carts
DROP POLICY IF EXISTS "Admins can delete carts" ON public.shopping_carts;
DROP POLICY IF EXISTS "Admins can update carts" ON public.shopping_carts;
DROP POLICY IF EXISTS "Admins can view carts" ON public.shopping_carts;
DROP POLICY IF EXISTS "Anyone can insert cart items" ON public.shopping_carts;

-- =====================
-- ORDERS TABLE POLICIES
-- =====================

-- Admin can do everything with orders
CREATE POLICY "Admins can manage all orders"
ON public.orders
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Users can view their own orders (via LINE ID, Facebook ID, or phone)
CREATE POLICY "Users can view own orders by line_id"
ON public.orders
FOR SELECT
TO authenticated
USING (customer_line_id = auth.uid()::text);

CREATE POLICY "Users can view own orders by facebook_id"
ON public.orders
FOR SELECT
TO authenticated
USING (customer_facebook_id = auth.uid()::text);

-- Service role can create orders (for edge functions)
-- Anon users can create orders through chat
CREATE POLICY "Service role and anon can create orders"
ON public.orders
FOR INSERT
TO anon, authenticated
WITH CHECK (
  -- Allow admins to create orders
  public.has_role(auth.uid(), 'admin')
  OR
  -- Allow if customer_line_id or customer_facebook_id matches the inserting user
  customer_line_id IS NOT NULL
  OR customer_facebook_id IS NOT NULL
  OR platform = 'web'
);

-- =========================
-- ORDER_ITEMS TABLE POLICIES
-- =========================

-- Admin can do everything with order items
CREATE POLICY "Admins can manage all order items"
ON public.order_items
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Users can view their own order items
CREATE POLICY "Users can view own order items"
ON public.order_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_id
    AND (o.customer_line_id = auth.uid()::text OR o.customer_facebook_id = auth.uid()::text)
  )
);

-- Allow creating order items when creating orders (anon users through chat)
CREATE POLICY "Anyone can create order items for their orders"
ON public.order_items
FOR INSERT
TO anon, authenticated
WITH CHECK (
  -- Allow if admin
  public.has_role(auth.uid(), 'admin')
  OR
  -- Allow if the order belongs to this user
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_id
    AND (
      o.customer_line_id IS NOT NULL
      OR o.customer_facebook_id IS NOT NULL
      OR o.platform = 'web'
    )
  )
);

-- ===========================
-- SHOPPING_CARTS TABLE POLICIES
-- ===========================

-- Admin can do everything with shopping carts
CREATE POLICY "Admins can manage all carts"
ON public.shopping_carts
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Users can view their own cart items (matching platform_user_id)
CREATE POLICY "Users can view own cart"
ON public.shopping_carts
FOR SELECT
TO authenticated
USING (platform_user_id = auth.uid()::text);

-- Users can update their own cart items
CREATE POLICY "Users can update own cart"
ON public.shopping_carts
FOR UPDATE
TO authenticated
USING (platform_user_id = auth.uid()::text);

-- Users can delete their own cart items
CREATE POLICY "Users can delete own cart"
ON public.shopping_carts
FOR DELETE
TO authenticated
USING (platform_user_id = auth.uid()::text);

-- Allow inserting cart items (platform_user_id must match or be set)
CREATE POLICY "Users can insert to own cart"
ON public.shopping_carts
FOR INSERT
TO anon, authenticated
WITH CHECK (
  -- Allow if admin
  public.has_role(auth.uid(), 'admin')
  OR
  -- Allow if inserting for authenticated user's own cart
  platform_user_id = auth.uid()::text
  OR
  -- Allow anon users to create cart (for chat widget)
  platform_user_id IS NOT NULL
);