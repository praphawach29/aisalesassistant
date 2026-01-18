-- =====================================================
-- STEP 1: FIX CRITICAL RLS POLICIES
-- =====================================================

-- 1.1 Fix ai_provider_keys - Admin only access
DROP POLICY IF EXISTS "Allow read access to ai_provider_keys" ON public.ai_provider_keys;
DROP POLICY IF EXISTS "Allow write access to ai_provider_keys" ON public.ai_provider_keys;
DROP POLICY IF EXISTS "Admin can manage ai_provider_keys" ON public.ai_provider_keys;

CREATE POLICY "Admin can manage ai_provider_keys" 
ON public.ai_provider_keys 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- =====================================================
-- STEP 2: CREATE RATE LIMITING SYSTEM
-- =====================================================

-- 2.1 Create rate_limits table
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(identifier, endpoint)
);

-- Enable RLS on rate_limits
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Rate limits should be manageable by service role only (no user access)
CREATE POLICY "Service role only for rate_limits" 
ON public.rate_limits 
FOR ALL 
USING (false)
WITH CHECK (false);

-- 2.2 Create rate limit check function
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_identifier TEXT,
  p_endpoint TEXT,
  p_max_requests INTEGER DEFAULT 60,
  p_window_seconds INTEGER DEFAULT 60
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_count INTEGER;
  v_window_start TIMESTAMPTZ;
  v_now TIMESTAMPTZ := now();
  v_window_cutoff TIMESTAMPTZ := v_now - (p_window_seconds || ' seconds')::INTERVAL;
BEGIN
  SELECT request_count, window_start INTO v_current_count, v_window_start
  FROM rate_limits
  WHERE identifier = p_identifier AND endpoint = p_endpoint
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO rate_limits (identifier, endpoint, request_count, window_start)
    VALUES (p_identifier, p_endpoint, 1, v_now);
    
    RETURN jsonb_build_object(
      'allowed', true,
      'remaining', p_max_requests - 1,
      'reset_at', v_now + (p_window_seconds || ' seconds')::INTERVAL
    );
  END IF;

  IF v_window_start < v_window_cutoff THEN
    UPDATE rate_limits
    SET request_count = 1, window_start = v_now
    WHERE identifier = p_identifier AND endpoint = p_endpoint;
    
    RETURN jsonb_build_object(
      'allowed', true,
      'remaining', p_max_requests - 1,
      'reset_at', v_now + (p_window_seconds || ' seconds')::INTERVAL
    );
  END IF;

  IF v_current_count >= p_max_requests THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'reset_at', v_window_start + (p_window_seconds || ' seconds')::INTERVAL,
      'retry_after', EXTRACT(EPOCH FROM (v_window_start + (p_window_seconds || ' seconds')::INTERVAL - v_now))::INTEGER
    );
  END IF;

  UPDATE rate_limits
  SET request_count = request_count + 1
  WHERE identifier = p_identifier AND endpoint = p_endpoint;

  RETURN jsonb_build_object(
    'allowed', true,
    'remaining', p_max_requests - v_current_count - 1,
    'reset_at', v_window_start + (p_window_seconds || ' seconds')::INTERVAL
  );
END;
$$;

-- 2.3 Create cleanup function for old rate limit records
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM rate_limits
  WHERE window_start < now() - INTERVAL '1 hour';
END;
$$;

-- =====================================================
-- STEP 3: CREATE AUDIT LOGS SYSTEM
-- =====================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data JSONB,
  new_data JSONB,
  changed_fields TEXT[],
  user_id UUID,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON public.audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record_id ON public.audit_logs(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view audit_logs" 
ON public.audit_logs 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_data JSONB;
  v_new_data JSONB;
  v_changed_fields TEXT[];
  v_record_id TEXT;
  v_key TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old_data := to_jsonb(OLD);
    v_record_id := OLD.id::TEXT;
    
    INSERT INTO audit_logs (table_name, record_id, action, old_data, user_id)
    VALUES (TG_TABLE_NAME, v_record_id, 'DELETE', v_old_data, auth.uid());
    
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
    v_record_id := NEW.id::TEXT;
    
    FOR v_key IN SELECT jsonb_object_keys(v_new_data)
    LOOP
      IF v_old_data->v_key IS DISTINCT FROM v_new_data->v_key THEN
        v_changed_fields := array_append(v_changed_fields, v_key);
      END IF;
    END LOOP;
    
    IF array_length(v_changed_fields, 1) > 0 THEN
      INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data, changed_fields, user_id)
      VALUES (TG_TABLE_NAME, v_record_id, 'UPDATE', v_old_data, v_new_data, v_changed_fields, auth.uid());
    END IF;
    
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    v_new_data := to_jsonb(NEW);
    v_record_id := NEW.id::TEXT;
    
    INSERT INTO audit_logs (table_name, record_id, action, new_data, user_id)
    VALUES (TG_TABLE_NAME, v_record_id, 'INSERT', v_new_data, auth.uid());
    
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS audit_orders_trigger ON public.orders;
CREATE TRIGGER audit_orders_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_products_trigger ON public.products;
CREATE TRIGGER audit_products_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_payment_slips_trigger ON public.payment_slips;
CREATE TRIGGER audit_payment_slips_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.payment_slips
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_settings_trigger ON public.settings;
CREATE TRIGGER audit_settings_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.settings
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_ai_provider_keys_trigger ON public.ai_provider_keys;
CREATE TRIGGER audit_ai_provider_keys_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.ai_provider_keys
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- =====================================================
-- STEP 4: CREATE ERROR LOGGING SYSTEM
-- =====================================================

CREATE TABLE IF NOT EXISTS public.error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_type TEXT NOT NULL,
  error_code TEXT,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  context JSONB,
  source TEXT,
  url TEXT,
  user_id UUID,
  session_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  severity TEXT DEFAULT 'error' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_error_logs_type ON public.error_logs(error_type);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON public.error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON public.error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_resolved ON public.error_logs(resolved);
CREATE INDEX IF NOT EXISTS idx_error_logs_source ON public.error_logs(source);

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage error_logs" 
ON public.error_logs 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Anyone can insert error_logs" 
ON public.error_logs 
FOR INSERT 
WITH CHECK (true);

-- =====================================================
-- STEP 5: CREATE ANALYTICS EVENTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  event_data JSONB,
  session_id TEXT,
  platform TEXT,
  platform_user_id TEXT,
  user_id UUID,
  device_type TEXT,
  browser TEXT,
  referrer TEXT,
  page_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON public.analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON public.analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session_id ON public.analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_platform ON public.analytics_events(platform);
CREATE INDEX IF NOT EXISTS idx_analytics_events_platform_user_id ON public.analytics_events(platform_user_id);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view analytics_events" 
ON public.analytics_events 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Anyone can insert analytics_events" 
ON public.analytics_events 
FOR INSERT 
WITH CHECK (true);

-- =====================================================
-- STEP 6: ADD DATABASE INDEXES FOR PERFORMANCE
-- =====================================================

-- Orders indexes (using existing columns)
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_platform ON public.orders(platform);
CREATE INDEX IF NOT EXISTS idx_orders_customer_line_id ON public.orders(customer_line_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_facebook_id ON public.orders(customer_facebook_id);

-- Products indexes
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON public.products(created_at DESC);

-- Chat conversations indexes
CREATE INDEX IF NOT EXISTS idx_chat_conversations_platform_user_id ON public.chat_conversations(platform_user_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_platform ON public.chat_conversations(platform);

-- Chat messages indexes
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON public.chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages(created_at DESC);

-- Payment slips indexes
CREATE INDEX IF NOT EXISTS idx_payment_slips_order_id ON public.payment_slips(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_slips_status ON public.payment_slips(status);
CREATE INDEX IF NOT EXISTS idx_payment_slips_created_at ON public.payment_slips(created_at DESC);

-- Shopping carts indexes
CREATE INDEX IF NOT EXISTS idx_shopping_carts_platform_user_id ON public.shopping_carts(platform_user_id);

-- Customer addresses indexes
CREATE INDEX IF NOT EXISTS idx_customer_addresses_platform_user_id ON public.customer_addresses(platform_user_id);
CREATE INDEX IF NOT EXISTS idx_customer_addresses_platform ON public.customer_addresses(platform);

-- Admin notifications indexes
CREATE INDEX IF NOT EXISTS idx_admin_notifications_created_at ON public.admin_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_is_read ON public.admin_notifications(is_read);

-- =====================================================
-- STEP 7: ADD ALLOWED_ORIGINS SETTING
-- =====================================================

INSERT INTO public.settings (key, value)
VALUES ('ALLOWED_ORIGINS', 'https://aisalesassistant.lovable.app,https://id-preview--10bc975e-c142-4a47-85df-1f14b4c66462.lovable.app')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;