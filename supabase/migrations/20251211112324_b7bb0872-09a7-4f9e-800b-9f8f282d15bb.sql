-- Add customer_address column to chat_conversations table
ALTER TABLE public.chat_conversations 
ADD COLUMN customer_address TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.chat_conversations.customer_address IS 'Saved delivery address for the customer';