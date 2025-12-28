
-- Drop old trigger and function
DROP TRIGGER IF EXISTS trigger_notify_customer_on_status_change ON orders;
DROP FUNCTION IF EXISTS public.notify_customer_on_status_change();

-- Enable pg_net extension (should be in extensions schema)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create function to send order notification via edge function using pg_net
CREATE OR REPLACE FUNCTION public.notify_customer_on_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  supabase_url text := 'https://mufevyjzslfskdzccoao.supabase.co';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11ZmV2eWp6c2xmc2tkemNjb2FvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNDk0NTksImV4cCI6MjA4MDgyNTQ1OX0.3UzvePqi1lVKQE79SKNVmVCJ3ZagFdysKAlX2ivF5bw';
  notification_type text := 'status_update';
  request_id bigint;
BEGIN
  -- Only trigger if status actually changed
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Determine notification type based on status
  IF NEW.status = 'shipped' AND NEW.tracking_number IS NOT NULL THEN
    notification_type := 'tracking_update';
  ELSE
    notification_type := 'status_update';
  END IF;

  -- Call the edge function to send notification using pg_net
  SELECT extensions.http_post(
    url := supabase_url || '/functions/v1/auto-notify-order',
    body := jsonb_build_object(
      'order_id', NEW.id::text,
      'notification_type', notification_type,
      'old_status', OLD.status::text,
      'new_status', NEW.status::text
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key
    )
  ) INTO request_id;

  RAISE NOTICE 'Automatic notification triggered for order % (status: % -> %), request_id: %', NEW.order_number, OLD.status, NEW.status, request_id;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE WARNING 'Failed to send automatic notification for order %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Create trigger for automatic notifications
CREATE TRIGGER trigger_notify_customer_on_status_change
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_customer_on_status_change();

-- Add comment
COMMENT ON FUNCTION notify_customer_on_status_change() IS 'Automatically notifies customers via LINE/Messenger when order status changes';
