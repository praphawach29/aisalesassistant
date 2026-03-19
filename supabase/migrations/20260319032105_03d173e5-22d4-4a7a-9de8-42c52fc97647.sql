-- Allow anyone to view orders by order_number (for tracking page)
CREATE POLICY "Anyone can view orders by order_number" ON public.orders
FOR SELECT TO anon
USING (true);

-- Allow anyone to view order items for tracking
CREATE POLICY "Anyone can view order items via tracking" ON public.order_items
FOR SELECT TO anon
USING (true);