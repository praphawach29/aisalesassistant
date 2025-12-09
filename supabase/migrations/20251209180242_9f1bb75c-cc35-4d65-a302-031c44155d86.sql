-- Create message_templates table
CREATE TABLE public.message_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage templates"
ON public.message_templates
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active templates"
ON public.message_templates
FOR SELECT
USING (is_active = true);

-- Add trigger for updated_at
CREATE TRIGGER update_message_templates_updated_at
BEFORE UPDATE ON public.message_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default templates
INSERT INTO public.message_templates (name, content, category, sort_order) VALUES
('ยืนยันออเดอร์', 'สวัสดีค่ะ ทางร้านได้รับออเดอร์ของคุณเรียบร้อยแล้วค่ะ กำลังเตรียมจัดส่งให้นะคะ ขอบคุณที่อุดหนุนค่ะ 🙏', 'order', 1),
('กำลังเตรียมสินค้า', 'สวัสดีค่ะ ออเดอร์ของคุณกำลังเตรียมจัดส่งค่ะ คาดว่าจะจัดส่งภายในวันนี้นะคะ', 'order', 2),
('จัดส่งแล้ว', 'สวัสดีค่ะ ออเดอร์ของคุณถูกจัดส่งเรียบร้อยแล้วค่ะ สามารถติดตามพัสดุได้ที่เลข Tracking ที่แจ้งไว้นะคะ 📦', 'order', 3),
('แจ้งล่าช้า', 'สวัสดีค่ะ ขออภัยนะคะ ออเดอร์ของคุณอาจล่าช้ากว่าปกติเล็กน้อย ทางร้านกำลังเร่งดำเนินการให้เร็วที่สุดค่ะ', 'order', 4),
('ขอบคุณลูกค้า', 'ขอบคุณที่อุดหนุนค่ะ 🙏 หวังว่าจะได้รับการอุดหนุนอีกนะคะ หากมีข้อสงสัยสามารถสอบถามได้ตลอดเวลาค่ะ', 'general', 5),
('แจ้งโปรโมชั่น', 'สวัสดีค่ะ ทางร้านมีโปรโมชั่นพิเศษสำหรับลูกค้าคนพิเศษอย่างคุณค่ะ สนใจสอบถามรายละเอียดเพิ่มเติมได้เลยนะคะ 🎉', 'promo', 6);