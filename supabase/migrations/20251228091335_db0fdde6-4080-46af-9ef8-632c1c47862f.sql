
-- Enable pg_net extension for making HTTP requests from database
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create function to send order notification via edge function
CREATE OR REPLACE FUNCTION public.notify_customer_on_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  supabase_url text := 'https://mufevyjzslfskdzccoao.supabase.co';
  service_role_key text;
  notification_type text := 'status_update';
BEGIN
  -- Only trigger if status actually changed
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Get the service role key from vault or use anon key
  -- For automatic notifications, we use the service role key stored in settings
  SELECT value INTO service_role_key 
  FROM settings 
  WHERE key = 'SUPABASE_SERVICE_ROLE_KEY_PLAIN'
  LIMIT 1;

  -- If no service key, skip notification (will be sent manually)
  IF service_role_key IS NULL THEN
    RAISE NOTICE 'No service role key found, skipping automatic notification for order %', NEW.id;
    RETURN NEW;
  END IF;

  -- Determine notification type based on status
  IF NEW.status = 'shipped' AND NEW.tracking_number IS NOT NULL THEN
    notification_type := 'tracking_update';
  ELSE
    notification_type := 'status_update';
  END IF;

  -- Call the edge function to send notification
  PERFORM extensions.http_post(
    url := supabase_url || '/functions/v1/auto-notify-order',
    body := json_build_object(
      'order_id', NEW.id::text,
      'notification_type', notification_type,
      'old_status', OLD.status::text,
      'new_status', NEW.status::text
    )::text,
    headers := json_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    )::jsonb
  );

  RAISE NOTICE 'Automatic notification triggered for order % (status: % -> %)', NEW.order_number, OLD.status, NEW.status;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE WARNING 'Failed to send automatic notification for order %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Create trigger for automatic notifications
DROP TRIGGER IF EXISTS trigger_notify_customer_on_status_change ON orders;
CREATE TRIGGER trigger_notify_customer_on_status_change
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_customer_on_status_change();

-- Add comment
COMMENT ON FUNCTION notify_customer_on_status_change() IS 'Automatically notifies customers via LINE/Messenger when order status changes';
