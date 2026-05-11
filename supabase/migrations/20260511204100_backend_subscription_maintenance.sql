-- ============================================================
-- Backend System: Subscription Enforcement + Maintenance Functions
-- ============================================================

-- 1. Check Feature Access for Current Subscription Plan
CREATE OR REPLACE FUNCTION public.check_feature_access(p_feature text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_features jsonb;
BEGIN
  SELECT sp.features INTO v_features
  FROM store_subscription ss
  JOIN subscription_plans sp ON sp.id = ss.plan_id
  LIMIT 1;

  IF v_features IS NULL THEN
    RETURN false;
  END IF;

  RETURN v_features ? p_feature;
END;
$$;

-- 2. Check Message Quota (returns remaining messages)
CREATE OR REPLACE FUNCTION public.check_message_quota()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'allowed', CASE WHEN sp.max_messages_per_month < 0 THEN true
                    WHEN ss.messages_used < sp.max_messages_per_month THEN true
                    ELSE false END,
    'messages_used', ss.messages_used,
    'max_messages', sp.max_messages_per_month,
    'remaining', CASE WHEN sp.max_messages_per_month < 0 THEN -1
                      ELSE GREATEST(sp.max_messages_per_month - ss.messages_used, 0) END,
    'plan_name', sp.name
  )
  INTO v_result
  FROM store_subscription ss
  JOIN subscription_plans sp ON sp.id = ss.plan_id
  LIMIT 1;

  RETURN COALESCE(v_result, jsonb_build_object(
    'allowed', false,
    'messages_used', 0,
    'max_messages', 0,
    'remaining', 0,
    'plan_name', 'none'
  ));
END;
$$;

-- 3. Increment Message Usage Counter
CREATE OR REPLACE FUNCTION public.increment_message_usage(p_count integer DEFAULT 1)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE store_subscription
  SET messages_used = messages_used + p_count
  WHERE id = (SELECT id FROM store_subscription LIMIT 1);

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

-- 4. Reset Monthly Message Usage (call at start of each billing period)
CREATE OR REPLACE FUNCTION public.reset_monthly_message_usage()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE store_subscription
  SET messages_used = 0,
      started_at = now();
END;
$$;

-- 5. Get Subscription Info
CREATE OR REPLACE FUNCTION public.get_subscription_info()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'plan_id', sp.id,
    'plan_name', sp.name,
    'plan_name_th', sp.name_th,
    'price', sp.price,
    'max_products', sp.max_products,
    'max_messages_per_month', sp.max_messages_per_month,
    'max_platforms', sp.max_platforms,
    'features', sp.features,
    'messages_used', ss.messages_used,
    'started_at', ss.started_at,
    'days_remaining', CASE
      WHEN ss.started_at IS NOT NULL
      THEN GREATEST(30 - EXTRACT(DAY FROM now() - ss.started_at)::integer, 0)
      ELSE 0
    END
  )
  INTO v_result
  FROM store_subscription ss
  JOIN subscription_plans sp ON sp.id = ss.plan_id
  LIMIT 1;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

-- ============================================================
-- Maintenance & Cleanup Functions
-- ============================================================

-- 6. Cleanup Old Audit Logs
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs(p_days_to_keep integer DEFAULT 90)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM audit_logs
  WHERE created_at < now() - (p_days_to_keep || ' days')::interval;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- 7. Cleanup Old Error Logs
CREATE OR REPLACE FUNCTION public.cleanup_old_error_logs(p_days_to_keep integer DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM error_logs
  WHERE created_at < now() - (p_days_to_keep || ' days')::interval
    AND resolved = true;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- 8. Cleanup Abandoned Shopping Carts
CREATE OR REPLACE FUNCTION public.cleanup_expired_carts(p_days_inactive integer DEFAULT 7)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM shopping_carts
  WHERE updated_at < now() - (p_days_inactive || ' days')::interval;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- 9. Cleanup Expired Rate Limits
CREATE OR REPLACE FUNCTION public.cleanup_expired_rate_limits()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM rate_limits
  WHERE window_start < now() - interval '1 hour';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- 10. Cleanup Old Admin Notifications (keep last 500)
CREATE OR REPLACE FUNCTION public.cleanup_old_notifications(p_keep_count integer DEFAULT 500)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM admin_notifications
  WHERE id NOT IN (
    SELECT id FROM admin_notifications
    WHERE is_read = true
    ORDER BY created_at DESC
    LIMIT p_keep_count
  )
  AND is_read = true
  AND created_at < now() - interval '30 days';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- 11. Run All Maintenance Tasks
CREATE OR REPLACE FUNCTION public.run_maintenance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_audit_deleted integer;
  v_error_deleted integer;
  v_cart_deleted integer;
  v_rate_deleted integer;
  v_notif_deleted integer;
BEGIN
  v_audit_deleted := public.cleanup_old_audit_logs(90);
  v_error_deleted := public.cleanup_old_error_logs(30);
  v_cart_deleted := public.cleanup_expired_carts(7);
  v_rate_deleted := public.cleanup_expired_rate_limits();
  v_notif_deleted := public.cleanup_old_notifications(500);

  RETURN jsonb_build_object(
    'audit_logs_deleted', v_audit_deleted,
    'error_logs_deleted', v_error_deleted,
    'carts_deleted', v_cart_deleted,
    'rate_limits_deleted', v_rate_deleted,
    'notifications_deleted', v_notif_deleted,
    'ran_at', now()
  );
END;
$$;

-- ============================================================
-- Booking Management Functions
-- ============================================================

-- 12. Check Booking Conflict (prevent double-booking same slot)
CREATE OR REPLACE FUNCTION public.check_booking_conflict(
  p_slot_date date,
  p_start_time time,
  p_end_time time
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slot_id uuid;
  v_current_bookings integer;
  v_max_bookings integer;
BEGIN
  SELECT id, current_bookings, max_bookings
  INTO v_slot_id, v_current_bookings, v_max_bookings
  FROM booking_slots
  WHERE slot_date = p_slot_date
    AND start_time = p_start_time
    AND end_time = p_end_time
    AND is_available = true;

  IF v_slot_id IS NULL THEN
    RETURN false; -- Slot doesn't exist
  END IF;

  RETURN v_current_bookings < v_max_bookings;
END;
$$;

-- 13. Get Upcoming Bookings (for reminders)
CREATE OR REPLACE FUNCTION public.get_upcoming_bookings(p_hours_ahead integer DEFAULT 24)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', b.id,
      'booking_number', b.booking_number,
      'customer_name', b.customer_name,
      'customer_phone', b.customer_phone,
      'platform', b.platform,
      'booking_date', b.booking_date,
      'booking_time', b.booking_time,
      'service_name', b.service_name,
      'status', b.status,
      'reminder_sent', b.reminder_sent
    )
  )
  INTO v_result
  FROM bookings b
  WHERE b.status = 'confirmed'
    AND b.reminder_sent = false
    AND (b.booking_date::text || ' ' || b.booking_time::text)::timestamptz
        BETWEEN now() AND now() + (p_hours_ahead || ' hours')::interval;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- 14. Mark Booking Reminder Sent
CREATE OR REPLACE FUNCTION public.mark_booking_reminder_sent(p_booking_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE bookings
  SET reminder_sent = true
  WHERE id = p_booking_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

-- 15. Cleanup Old Booking Slots (past slots)
CREATE OR REPLACE FUNCTION public.cleanup_old_booking_slots(p_days_old integer DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM booking_slots
  WHERE slot_date < CURRENT_DATE - p_days_old;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- Add reminder_sent column to bookings if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'reminder_sent'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN reminder_sent boolean NOT NULL DEFAULT false;
  END IF;
END;
$$;

-- Add messages_used column to store_subscription if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'store_subscription' AND column_name = 'messages_used'
  ) THEN
    ALTER TABLE public.store_subscription ADD COLUMN messages_used integer NOT NULL DEFAULT 0;
  END IF;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.check_feature_access(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.check_message_quota() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.increment_message_usage(integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.reset_monthly_message_usage() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_subscription_info() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.cleanup_old_audit_logs(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_error_logs(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_carts(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_rate_limits() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_notifications(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_maintenance() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_booking_conflict(date, time, time) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_upcoming_bookings(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_booking_reminder_sent(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_booking_slots(integer) TO authenticated;
