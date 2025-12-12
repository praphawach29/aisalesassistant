-- Add columns for AI payment slip analysis
ALTER TABLE public.payment_slips
ADD COLUMN analyzed_amount numeric NULL,
ADD COLUMN analyzed_date text NULL,
ADD COLUMN analyzed_bank text NULL,
ADD COLUMN analyzed_account text NULL,
ADD COLUMN confidence_score integer NULL DEFAULT 0,
ADD COLUMN auto_verified boolean NOT NULL DEFAULT false;