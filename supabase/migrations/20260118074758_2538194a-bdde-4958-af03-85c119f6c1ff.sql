-- Drop existing policies for customer_addresses
DROP POLICY IF EXISTS "Admins can manage addresses" ON public.customer_addresses;
DROP POLICY IF EXISTS "Admins can view addresses" ON public.customer_addresses;
DROP POLICY IF EXISTS "Anyone can insert addresses" ON public.customer_addresses;

-- Drop existing policies for payment_slips
DROP POLICY IF EXISTS "Admins can delete payment slips" ON public.payment_slips;
DROP POLICY IF EXISTS "Admins can update payment slips" ON public.payment_slips;
DROP POLICY IF EXISTS "Admins can view payment slips" ON public.payment_slips;
DROP POLICY IF EXISTS "Anyone can insert payment slips" ON public.payment_slips;

-- ================================
-- CUSTOMER_ADDRESSES TABLE POLICIES
-- ================================

-- Admin can do everything with addresses
CREATE POLICY "Admins can manage all addresses"
ON public.customer_addresses
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Users can view their own addresses (matching platform_user_id)
CREATE POLICY "Users can view own addresses"
ON public.customer_addresses
FOR SELECT
TO authenticated
USING (platform_user_id = auth.uid()::text);

-- Users can update their own addresses
CREATE POLICY "Users can update own addresses"
ON public.customer_addresses
FOR UPDATE
TO authenticated
USING (platform_user_id = auth.uid()::text);

-- Users can delete their own addresses
CREATE POLICY "Users can delete own addresses"
ON public.customer_addresses
FOR DELETE
TO authenticated
USING (platform_user_id = auth.uid()::text);

-- Allow inserting addresses - must set platform_user_id
CREATE POLICY "Users can insert own addresses"
ON public.customer_addresses
FOR INSERT
TO anon, authenticated
WITH CHECK (
  -- Allow if admin
  public.has_role(auth.uid(), 'admin')
  OR
  -- Allow if inserting for authenticated user's own addresses
  platform_user_id = auth.uid()::text
  OR
  -- Allow anon users to create addresses (for chat widget)
  platform_user_id IS NOT NULL
);

-- ============================
-- PAYMENT_SLIPS TABLE POLICIES
-- ============================

-- Admin can do everything with payment slips
CREATE POLICY "Admins can manage all payment slips"
ON public.payment_slips
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Users can view their own payment slips (matching platform_user_id)
CREATE POLICY "Users can view own payment slips"
ON public.payment_slips
FOR SELECT
TO authenticated
USING (platform_user_id = auth.uid()::text);

-- Allow inserting payment slips - must set platform_user_id
CREATE POLICY "Users can insert own payment slips"
ON public.payment_slips
FOR INSERT
TO anon, authenticated
WITH CHECK (
  -- Allow if admin
  public.has_role(auth.uid(), 'admin')
  OR
  -- Allow if inserting for authenticated user
  platform_user_id = auth.uid()::text
  OR
  -- Allow anon users to upload slips (for chat widget) - must have platform_user_id set
  platform_user_id IS NOT NULL
);