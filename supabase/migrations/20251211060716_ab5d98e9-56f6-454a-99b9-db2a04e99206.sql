-- Add variants column to products table for storing product options
ALTER TABLE public.products 
ADD COLUMN variants jsonb DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.products.variants IS 'Product variants/options like color, size stored as JSON array e.g. [{"name": "สี", "options": ["แดง", "น้ำเงิน"]}, {"name": "ไซส์", "options": ["S", "M", "L"]}]';

-- Update existing products with sample variants
UPDATE public.products SET variants = '[{"name": "สี", "options": ["ขาว", "ดำ", "เทา"]}, {"name": "ไซส์", "options": ["S", "M", "L", "XL"]}]'::jsonb WHERE name = 'เสื้อยืดคอกลม';

UPDATE public.products SET variants = '[{"name": "สี", "options": ["ดำ", "กรมท่า", "เขียว"]}, {"name": "ไซส์", "options": ["S", "M", "L", "XL"]}]'::jsonb WHERE name = 'กางเกงขาสั้น';

UPDATE public.products SET variants = '[{"name": "สี", "options": ["ดำ", "น้ำเงิน", "แดง"]}]'::jsonb WHERE name = 'หมวกแก๊ป';

UPDATE public.products SET variants = '[{"name": "สี", "options": ["ดำ", "น้ำตาล", "ครีม"]}]'::jsonb WHERE name = 'กระเป๋าสะพายข้าง';

UPDATE public.products SET variants = '[{"name": "สี", "options": ["ขาว", "ดำ"]}, {"name": "ไซส์", "options": ["38", "39", "40", "41", "42", "43"]}]'::jsonb WHERE name = 'รองเท้าผ้าใบ';

UPDATE public.products SET variants = '[{"name": "สี", "options": ["ขาว", "ฟ้าอ่อน", "ชมพู"]}, {"name": "ไซส์", "options": ["S", "M", "L", "XL"]}]'::jsonb WHERE name = 'เสื้อเชิ้ตแขนยาว';

UPDATE public.products SET variants = '[{"name": "สี", "options": ["ดำ", "เทา", "น้ำเงิน"]}]'::jsonb WHERE name = 'กระเป๋าเป้';

UPDATE public.products SET variants = '[{"name": "สี", "options": ["เงิน", "ทอง", "ดำ"]}]'::jsonb WHERE name = 'นาฬิกาข้อมือ';