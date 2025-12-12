-- Fix STORAGE_EXPOSURE: Make payment-slips bucket private and restrict access to admins

-- Make the bucket private
UPDATE storage.buckets SET public = false WHERE id = 'payment-slips';

-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Anyone can view payment slips" ON storage.objects;

-- Create admin-only SELECT policy
CREATE POLICY "Admins can view payment slips" ON storage.objects
FOR SELECT USING (
  bucket_id = 'payment-slips' AND 
  has_role(auth.uid(), 'admin'::app_role)
);

-- Keep the INSERT policy for customer uploads (already exists but recreate to ensure)
DROP POLICY IF EXISTS "Anyone can upload payment slips" ON storage.objects;
CREATE POLICY "Anyone can upload payment slips" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'payment-slips');