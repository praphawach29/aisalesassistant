ALTER TABLE public.products ADD COLUMN delivery_type text NOT NULL DEFAULT 'shipping';

COMMENT ON COLUMN public.products.delivery_type IS 'Product delivery method: shipping, pickup, digital, booking';