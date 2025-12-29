-- Add payment_confirmed status to order_status enum
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'payment_confirmed' AFTER 'confirmed';