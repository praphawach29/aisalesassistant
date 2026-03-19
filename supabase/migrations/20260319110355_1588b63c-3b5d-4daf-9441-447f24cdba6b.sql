-- Create chat-images storage bucket for general image uploads (product search, complaints)
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-images', 'chat-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to upload to chat-images bucket
CREATE POLICY "Anyone can upload chat images"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'chat-images');

-- Allow anyone to read chat images
CREATE POLICY "Anyone can read chat images"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'chat-images');