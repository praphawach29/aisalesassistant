-- Create related products table for cross-sell configuration
CREATE TABLE public.related_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  related_product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, related_product_id)
);

-- Prevent self-referencing
ALTER TABLE public.related_products ADD CONSTRAINT no_self_relation CHECK (product_id != related_product_id);

-- Enable RLS
ALTER TABLE public.related_products ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage related products"
ON public.related_products
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view related products"
ON public.related_products
FOR SELECT
USING (true);

-- Create index for faster lookups
CREATE INDEX idx_related_products_product_id ON public.related_products(product_id);
CREATE INDEX idx_related_products_related_product_id ON public.related_products(related_product_id);