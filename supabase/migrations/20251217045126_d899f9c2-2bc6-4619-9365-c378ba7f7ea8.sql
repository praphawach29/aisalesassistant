-- Add scheduling fields to scraped_content table
ALTER TABLE public.scraped_content
ADD COLUMN IF NOT EXISTS scrape_interval TEXT DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS next_scrape_at TIMESTAMP WITH TIME ZONE;

-- Create index for efficient scheduled scrape queries
CREATE INDEX IF NOT EXISTS idx_scraped_content_next_scrape 
ON public.scraped_content (next_scrape_at) 
WHERE is_active = true AND scrape_interval != 'manual';

COMMENT ON COLUMN public.scraped_content.scrape_interval IS 'Scraping frequency: manual, hourly, daily, weekly, monthly';
COMMENT ON COLUMN public.scraped_content.next_scrape_at IS 'Next scheduled scrape time';