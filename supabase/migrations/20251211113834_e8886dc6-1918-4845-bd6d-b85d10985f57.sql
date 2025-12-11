-- Create customer_addresses table for multiple addresses per customer
CREATE TABLE public.customer_addresses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform_user_id TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'line',
  label TEXT NOT NULL DEFAULT 'บ้าน',
  address TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_customer_addresses_platform_user ON public.customer_addresses(platform_user_id, platform);

-- Enable RLS
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert addresses (from chatbot)
CREATE POLICY "Anyone can insert addresses"
ON public.customer_addresses
FOR INSERT
WITH CHECK (true);

-- Admins can view all addresses
CREATE POLICY "Admins can view addresses"
ON public.customer_addresses
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can manage addresses
CREATE POLICY "Admins can manage addresses"
ON public.customer_addresses
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_customer_addresses_updated_at
BEFORE UPDATE ON public.customer_addresses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();