
-- Subscription plans table
CREATE TABLE public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_th text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  billing_period text NOT NULL DEFAULT 'monthly',
  max_products integer DEFAULT NULL,
  max_messages_per_month integer DEFAULT NULL,
  max_platforms integer NOT NULL DEFAULT 1,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Store's current subscription
CREATE TABLE public.store_subscription (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid REFERENCES public.subscription_plans(id) NOT NULL,
  status text NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  messages_used integer NOT NULL DEFAULT 0,
  messages_reset_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_subscription ENABLE ROW LEVEL SECURITY;

-- Policies for subscription_plans (anyone can view, admin can manage)
CREATE POLICY "Anyone can view active plans" ON public.subscription_plans
  FOR SELECT TO public USING (is_active = true);

CREATE POLICY "Admins can manage plans" ON public.subscription_plans
  FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Policies for store_subscription (admin only)
CREATE POLICY "Admins can manage subscription" ON public.store_subscription
  FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view subscription" ON public.store_subscription
  FOR SELECT TO public USING (true);

-- Insert default plans
INSERT INTO public.subscription_plans (name, name_th, price, max_products, max_messages_per_month, max_platforms, sort_order, features) VALUES
('starter', 'Starter', 1490, 50, 1000, 1, 1, '["web_chat", "basic_ai", "order_management", "product_management", "faq_management"]'::jsonb),
('professional', 'Professional', 2990, 200, 5000, 2, 2, '["web_chat", "basic_ai", "order_management", "product_management", "faq_management", "line_integration", "facebook_integration", "ai_slip_verification", "broadcast", "coupons", "templates", "analytics"]'::jsonb),
('business', 'Business', 5990, NULL, NULL, 3, 3, '["web_chat", "basic_ai", "order_management", "product_management", "faq_management", "line_integration", "facebook_integration", "ai_slip_verification", "broadcast", "coupons", "templates", "analytics", "web_scraping", "knowledge_base", "category_expertise", "embed_widget", "backup_restore", "audit_logs", "error_logs", "related_products", "product_faqs"]'::jsonb);
