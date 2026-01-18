-- Remove the problematic RLS policy that allows all access
DROP POLICY IF EXISTS "Allow all access to ai_provider_keys" ON ai_provider_keys;