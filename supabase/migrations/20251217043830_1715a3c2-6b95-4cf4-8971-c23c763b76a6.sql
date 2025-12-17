-- Create table to store scraped website content
CREATE TABLE public.scraped_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT,
  content TEXT,
  summary TEXT,
  source_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_scraped_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scraped_content ENABLE ROW LEVEL SECURITY;

-- Admins can manage scraped content
CREATE POLICY "Admins can manage scraped content"
ON public.scraped_content
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Anyone can read active scraped content (for AI to use)
CREATE POLICY "Anyone can read active scraped content"
ON public.scraped_content
FOR SELECT
USING (is_active = true);

-- Add trigger for updated_at
CREATE TRIGGER update_scraped_content_updated_at
BEFORE UPDATE ON public.scraped_content
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();