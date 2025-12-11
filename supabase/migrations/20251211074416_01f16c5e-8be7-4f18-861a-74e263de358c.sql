-- Create shopping cart table for LINE users
CREATE TABLE public.shopping_carts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  platform_user_id TEXT NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  price NUMERIC NOT NULL,
  variants TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, product_id, variants)
);

-- Enable RLS
ALTER TABLE public.shopping_carts ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can insert cart items" ON public.shopping_carts
FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view their cart items" ON public.shopping_carts
FOR SELECT USING (true);

CREATE POLICY "Anyone can update their cart items" ON public.shopping_carts
FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete their cart items" ON public.shopping_carts
FOR DELETE USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_shopping_carts_updated_at
BEFORE UPDATE ON public.shopping_carts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();