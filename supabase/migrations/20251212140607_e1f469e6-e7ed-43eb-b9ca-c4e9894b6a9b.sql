-- Create payment_slips table for storing payment confirmation images
CREATE TABLE public.payment_slips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  platform TEXT NOT NULL DEFAULT 'line',
  platform_user_id TEXT NOT NULL,
  image_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  admin_notes TEXT,
  confirmed_by UUID,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_slips ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payment_slips
CREATE POLICY "Anyone can insert payment slips" ON public.payment_slips
FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view payment slips" ON public.payment_slips
FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update payment slips" ON public.payment_slips
FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete payment slips" ON public.payment_slips
FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Create broadcast_messages table for storing broadcast history
CREATE TABLE public.broadcast_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL DEFAULT 'line',
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'promotion')),
  content TEXT NOT NULL,
  image_url TEXT,
  target_audience TEXT NOT NULL DEFAULT 'all' CHECK (target_audience IN ('all', 'recent', 'with_orders')),
  sent_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'completed', 'failed')),
  sent_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.broadcast_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for broadcast_messages
CREATE POLICY "Admins can manage broadcasts" ON public.broadcast_messages
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Create storage bucket for payment slips
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-slips', 'payment-slips', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for payment slips bucket
CREATE POLICY "Anyone can upload payment slips" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'payment-slips');

CREATE POLICY "Anyone can view payment slips" ON storage.objects
FOR SELECT USING (bucket_id = 'payment-slips');

CREATE POLICY "Admins can delete payment slips" ON storage.objects
FOR DELETE USING (bucket_id = 'payment-slips' AND has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_payment_slips_updated_at
BEFORE UPDATE ON public.payment_slips
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();