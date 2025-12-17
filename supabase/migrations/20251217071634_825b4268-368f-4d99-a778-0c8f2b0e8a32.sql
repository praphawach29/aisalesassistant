-- Create knowledge_base table
CREATE TABLE public.knowledge_base (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'pdf',
  original_content TEXT,
  summary TEXT,
  category TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage knowledge base"
ON public.knowledge_base
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active knowledge base"
ON public.knowledge_base
FOR SELECT
USING (is_active = true);

-- Trigger for updated_at
CREATE TRIGGER update_knowledge_base_updated_at
BEFORE UPDATE ON public.knowledge_base
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for knowledge files
INSERT INTO storage.buckets (id, name, public) VALUES ('knowledge-files', 'knowledge-files', false);

-- Storage policies
CREATE POLICY "Admins can upload knowledge files"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'knowledge-files' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view knowledge files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'knowledge-files' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete knowledge files"
ON storage.objects
FOR DELETE
USING (bucket_id = 'knowledge-files' AND has_role(auth.uid(), 'admin'::app_role));