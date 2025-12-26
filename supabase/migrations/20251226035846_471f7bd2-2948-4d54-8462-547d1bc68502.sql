-- Add AI provider configuration to ai_settings table
ALTER TABLE public.ai_settings 
ADD COLUMN IF NOT EXISTS ai_provider text DEFAULT 'lovable' CHECK (ai_provider IN ('lovable', 'openai', 'gemini', 'deepseek', 'claude'));

-- Create table for storing encrypted API keys for each provider
CREATE TABLE IF NOT EXISTS public.ai_provider_keys (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  provider text NOT NULL UNIQUE CHECK (provider IN ('openai', 'gemini', 'deepseek', 'claude')),
  encrypted_api_key text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.ai_provider_keys ENABLE ROW LEVEL SECURITY;

-- Create policy for admin access (public read for now since no auth required for admin)
CREATE POLICY "Allow all access to ai_provider_keys" 
ON public.ai_provider_keys 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_ai_provider_keys_updated_at
BEFORE UPDATE ON public.ai_provider_keys
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();