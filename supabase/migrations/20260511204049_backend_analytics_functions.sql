-- ============================================================
-- Backend System: Analytics & Dashboard RPC Functions
-- ============================================================

-- 1. Dashboard KPI Stats
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_days_back integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_start_date timestamptz;
  v_prev_start_date timestamptz;
BEGIN
  v_start_date := now() - (p_days_back || ' days')::interval;
  v_prev_start_date := v_start_date - (p_days_back || ' days')::interval;

  SELECT jsonb_build_object(
    'total_orders', COALESCE((
      SELECT COUNT(*) FROM orders WHERE created_at >= v_start_date
    ), 0),
    'prev_total_orders', COALESCE((
      SELECT COUNT(*) FROM orders WHERE created_at >= v_prev_start_date AND created_at < v_start_date
    ), 0),
    'total_revenue', COALESCE((
      SELECT SUM(total_amount) FROM orders
      WHERE created_at >= v_start_date AND status NOT IN ('cancelled')
    ), 0),
    'prev_total_revenue', COALESCE((
      SELECT SUM(total_amount) FROM orders
      WHERE created_at >= v_prev_start_date AND created_at < v_start_date AND status NOT IN ('cancelled')
    ), 0),
    'total_conversations', COALESCE((
      SELECT COUNT(*) FROM chat_conversations WHERE created_at >= v_start_date
    ), 0),
    'prev_total_conversations', COALESCE((
      SELECT COUNT(*) FROM chat_conversations WHERE created_at >= v_prev_start_date AND created_at < v_start_date
    ), 0),
    'confirmed_orders', COALESCE((
      SELECT COUNT(*) FROM orders
      WHERE created_at >= v_start_date AND status IN ('confirmed','payment_confirmed','shipped','delivered')
    ), 0),
    'pending_orders', COALESCE((
      SELECT COUNT(*) FROM orders WHERE created_at >= v_start_date AND status = 'pending'
    ), 0),
    'delivered_orders', COALESCE((
      SELECT COUNT(*) FROM orders WHERE created_at >= v_start_date AND status = 'delivered'
    ), 0),
    'cancelled_orders', COALESCE((
      SELECT COUNT(*) FROM orders WHERE created_at >= v_start_date AND status = 'cancelled'
    ), 0),
    'low_stock_products', COALESCE((
      SELECT COUNT(*) FROM products WHERE is_active = true AND stock_quantity > 0 AND stock_quantity <= 5
    ), 0),
    'out_of_stock_products', COALESCE((
      SELECT COUNT(*) FROM products WHERE is_active = true AND stock_quantity = 0
    ), 0)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- 2. Revenue Chart Data (daily/weekly/monthly)
CREATE OR REPLACE FUNCTION public.get_revenue_chart_data(
  p_period text DEFAULT 'daily',
  p_periods_back integer DEFAULT 14
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF p_period = 'daily' THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'date', TO_CHAR(day_series, 'YYYY-MM-DD'),
        'revenue', COALESCE(SUM(o.total_amount), 0),
        'orders', COUNT(o.id)
      ) ORDER BY day_series
    )
    INTO v_result
    FROM generate_series(
      (now() - ((p_periods_back - 1) || ' days')::interval)::date,
      now()::date,
      '1 day'::interval
    ) AS day_series
    LEFT JOIN orders o ON
      DATE_TRUNC('day', o.created_at) = day_series::date
      AND o.status NOT IN ('cancelled')
    GROUP BY day_series;

  ELSIF p_period = 'weekly' THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'date', TO_CHAR(week_series, 'IYYY-"W"IW'),
        'revenue', COALESCE(SUM(o.total_amount), 0),
        'orders', COUNT(o.id)
      ) ORDER BY week_series
    )
    INTO v_result
    FROM generate_series(
      DATE_TRUNC('week', now() - ((p_periods_back - 1) || ' weeks')::interval),
      DATE_TRUNC('week', now()),
      '1 week'::interval
    ) AS week_series
    LEFT JOIN orders o ON
      DATE_TRUNC('week', o.created_at) = week_series
      AND o.status NOT IN ('cancelled')
    GROUP BY week_series;

  ELSIF p_period = 'monthly' THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'date', TO_CHAR(month_series, 'YYYY-MM'),
        'revenue', COALESCE(SUM(o.total_amount), 0),
        'orders', COUNT(o.id)
      ) ORDER BY month_series
    )
    INTO v_result
    FROM generate_series(
      DATE_TRUNC('month', now() - ((p_periods_back - 1) || ' months')::interval),
      DATE_TRUNC('month', now()),
      '1 month'::interval
    ) AS month_series
    LEFT JOIN orders o ON
      DATE_TRUNC('month', o.created_at) = month_series
      AND o.status NOT IN ('cancelled')
    GROUP BY month_series;
  END IF;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- 3. Top Selling Products
CREATE OR REPLACE FUNCTION public.get_top_products(
  p_limit integer DEFAULT 5,
  p_days_back integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_agg(row_data ORDER BY total_revenue DESC)
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'product_id', p.id,
      'product_name', p.name,
      'total_quantity', COALESCE(SUM(oi.quantity), 0),
      'total_revenue', COALESCE(SUM(oi.quantity * oi.unit_price), 0),
      'order_count', COUNT(DISTINCT oi.order_id)
    ) AS row_data
    FROM products p
    LEFT JOIN order_items oi ON oi.product_id = p.id
    LEFT JOIN orders o ON o.id = oi.order_id
      AND o.created_at >= now() - (p_days_back || ' days')::interval
      AND o.status NOT IN ('cancelled')
    GROUP BY p.id, p.name
    ORDER BY COALESCE(SUM(oi.quantity * oi.unit_price), 0) DESC
    LIMIT p_limit
  ) sub;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- 4. Platform Breakdown Stats
CREATE OR REPLACE FUNCTION public.get_platform_stats(p_days_back integer DEFAULT 30)
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
      'platform', COALESCE(platform, 'web'),
      'orders', COUNT(*),
      'revenue', COALESCE(SUM(total_amount), 0)
    )
  )
  INTO v_result
  FROM orders
  WHERE created_at >= now() - (p_days_back || ' days')::interval
    AND status NOT IN ('cancelled')
  GROUP BY platform;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- 5. Order Status Breakdown
CREATE OR REPLACE FUNCTION public.get_order_status_breakdown(p_days_back integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_object_agg(status, cnt)
  INTO v_result
  FROM (
    SELECT status::text, COUNT(*) AS cnt
    FROM orders
    WHERE created_at >= now() - (p_days_back || ' days')::interval
    GROUP BY status
  ) sub;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

-- 6. Analytics Events Summary
CREATE OR REPLACE FUNCTION public.get_analytics_summary(
  p_start_date timestamptz,
  p_end_date timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_events', COUNT(*),
    'unique_sessions', COUNT(DISTINCT session_id),
    'page_views', COUNT(*) FILTER (WHERE event_type = 'page_view'),
    'product_views', COUNT(*) FILTER (WHERE event_type = 'product_view'),
    'add_to_cart', COUNT(*) FILTER (WHERE event_type = 'add_to_cart'),
    'orders_completed', COUNT(*) FILTER (WHERE event_type = 'order_complete'),
    'chats_started', COUNT(*) FILTER (WHERE event_type = 'chat_started'),
    'chat_messages', COUNT(*) FILTER (WHERE event_type = 'chat_message'),
    'by_platform', (
      SELECT jsonb_object_agg(COALESCE(platform, 'web'), cnt)
      FROM (
        SELECT COALESCE(platform, 'web') AS platform, COUNT(*) AS cnt
        FROM analytics_events
        WHERE created_at BETWEEN p_start_date AND p_end_date
        GROUP BY platform
      ) sub
    ),
    'by_device', (
      SELECT jsonb_object_agg(COALESCE(device_type, 'unknown'), cnt)
      FROM (
        SELECT COALESCE(device_type, 'unknown') AS device_type, COUNT(*) AS cnt
        FROM analytics_events
        WHERE created_at BETWEEN p_start_date AND p_end_date
        GROUP BY device_type
      ) sub
    ),
    'conversion_rate', ROUND(
      CASE WHEN COUNT(*) FILTER (WHERE event_type = 'page_view') > 0
        THEN (COUNT(*) FILTER (WHERE event_type = 'order_complete')::numeric /
              COUNT(*) FILTER (WHERE event_type = 'page_view')::numeric) * 100
        ELSE 0
      END, 2
    )
  )
  INTO v_result
  FROM analytics_events
  WHERE created_at BETWEEN p_start_date AND p_end_date;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

-- 7. Daily Analytics Trend
CREATE OR REPLACE FUNCTION public.get_analytics_daily_trend(
  p_start_date timestamptz,
  p_end_date timestamptz
)
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
      'date', TO_CHAR(day_series, 'YYYY-MM-DD'),
      'page_views', COALESCE(SUM(CASE WHEN ae.event_type = 'page_view' THEN 1 ELSE 0 END), 0),
      'product_views', COALESCE(SUM(CASE WHEN ae.event_type = 'product_view' THEN 1 ELSE 0 END), 0),
      'orders', COALESCE(SUM(CASE WHEN ae.event_type = 'order_complete' THEN 1 ELSE 0 END), 0),
      'chats', COALESCE(SUM(CASE WHEN ae.event_type = 'chat_started' THEN 1 ELSE 0 END), 0)
    ) ORDER BY day_series
  )
  INTO v_result
  FROM generate_series(
    p_start_date::date,
    p_end_date::date,
    '1 day'::interval
  ) AS day_series
  LEFT JOIN analytics_events ae ON
    DATE_TRUNC('day', ae.created_at) = day_series::date
    AND ae.created_at BETWEEN p_start_date AND p_end_date
  GROUP BY day_series;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- 8. API Usage Stats
CREATE OR REPLACE FUNCTION public.get_api_usage_stats(
  p_start_date timestamptz,
  p_end_date timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_msg_count integer;
  v_quota_limit integer;
  v_quota_used integer;
BEGIN
  SELECT COUNT(*) INTO v_msg_count
  FROM chat_messages
  WHERE role = 'assistant'
    AND created_at BETWEEN p_start_date AND p_end_date;

  SELECT COALESCE(sp.max_messages_per_month, 0), COALESCE(ss.messages_used, 0)
  INTO v_quota_limit, v_quota_used
  FROM store_subscription ss
  JOIN subscription_plans sp ON sp.id = ss.plan_id
  LIMIT 1;

  SELECT jsonb_build_object(
    'total_messages', v_msg_count,
    'quota_limit', v_quota_limit,
    'quota_used', v_quota_used,
    'quota_remaining', GREATEST(v_quota_limit - v_quota_used, 0),
    'by_platform', (
      SELECT jsonb_object_agg(COALESCE(cc.platform, 'web'), cnt)
      FROM (
        SELECT COALESCE(cc.platform, 'web') AS platform, COUNT(cm.id) AS cnt
        FROM chat_messages cm
        JOIN chat_conversations cc ON cc.id = cm.conversation_id
        WHERE cm.role = 'assistant'
          AND cm.created_at BETWEEN p_start_date AND p_end_date
        GROUP BY cc.platform
      ) sub
    ),
    'daily_usage', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'date', TO_CHAR(day_series, 'YYYY-MM-DD'),
          'messages', COALESCE(COUNT(cm.id), 0)
        ) ORDER BY day_series
      )
      FROM generate_series(p_start_date::date, p_end_date::date, '1 day'::interval) AS day_series
      LEFT JOIN chat_messages cm ON
        DATE_TRUNC('day', cm.created_at) = day_series::date
        AND cm.role = 'assistant'
        AND cm.created_at BETWEEN p_start_date AND p_end_date
      GROUP BY day_series
    )
  ) INTO v_result;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

-- Grant execute to authenticated users (functions use SECURITY DEFINER)
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_revenue_chart_data(text, integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_top_products(integer, integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_platform_stats(integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_order_status_breakdown(integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_analytics_summary(timestamptz, timestamptz) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_analytics_daily_trend(timestamptz, timestamptz) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_api_usage_stats(timestamptz, timestamptz) TO authenticated, anon;
