-- Create embed_settings table for storing widget customization
CREATE TABLE public.embed_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL DEFAULT 'default',
  primary_color text NOT NULL DEFAULT '#6366f1',
  position text NOT NULL DEFAULT 'bottom-right',
  button_size text NOT NULL DEFAULT '56',
  window_width text NOT NULL DEFAULT '380',
  window_height text NOT NULL DEFAULT '500',
  auto_open boolean NOT NULL DEFAULT false,
  bot_name text NOT NULL DEFAULT 'AI Sales Assistant',
  welcome_message text DEFAULT 'สวัสดีครับ! ผมพร้อมช่วยแนะนำสินค้า รับออเดอร์ และตอบคำถามของคุณครับ',
  logo_url text DEFAULT '',
  quick_actions jsonb NOT NULL DEFAULT '[{"label":"ดูสินค้า","message":"อยากดูสินค้าที่มีขายหน่อยครับ"},{"label":"สั่งซื้อ","message":"ต้องการสั่งซื้อสินค้า"},{"label":"สอบถามราคา","message":"อยากสอบถามราคาสินค้า"}]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.embed_settings ENABLE ROW LEVEL SECURITY;

-- Admins can manage embed settings
CREATE POLICY "Admins can manage embed settings" 
ON public.embed_settings 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Anyone can view active embed settings (for loading in widget)
CREATE POLICY "Anyone can view active embed settings" 
ON public.embed_settings 
FOR SELECT 
USING (is_active = true);

-- Trigger for updated_at
CREATE TRIGGER update_embed_settings_updated_at
  BEFORE UPDATE ON public.embed_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default settings
INSERT INTO public.embed_settings (name, is_active) VALUES ('default', true);