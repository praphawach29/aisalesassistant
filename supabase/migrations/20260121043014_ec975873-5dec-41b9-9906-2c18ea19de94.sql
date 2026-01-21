-- Add specifications column to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS specifications text;

-- Create product_faqs table for product-specific Q&A
CREATE TABLE public.product_faqs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer text NOT NULL,
  sort_order integer DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_faqs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage product FAQs" ON public.product_faqs
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active product FAQs" ON public.product_faqs
  FOR SELECT USING (is_active = true);

-- Create index for faster lookups
CREATE INDEX idx_product_faqs_product_id ON public.product_faqs(product_id);

-- Add trigger for updated_at
CREATE TRIGGER update_product_faqs_updated_at
  BEFORE UPDATE ON public.product_faqs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();