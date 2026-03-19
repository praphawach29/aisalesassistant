import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SubscriptionPlan {
  id: string;
  name: string;
  name_th: string;
  price: number;
  billing_period: string;
  max_products: number | null;
  max_messages_per_month: number | null;
  max_platforms: number;
  features: string[];
  is_active: boolean;
  sort_order: number;
}

export interface StoreSubscription {
  id: string;
  plan_id: string;
  status: string;
  started_at: string;
  expires_at: string | null;
  messages_used: number;
  messages_reset_at: string;
}

// Feature keys mapping to admin pages
export const FEATURE_PAGE_MAP: Record<string, string[]> = {
  '/admin/dashboard': ['basic_ai'],
  '/admin/orders': ['order_management'],
  '/admin/products': ['product_management'],
  '/admin/chats': ['web_chat'],
  '/admin/faqs': ['faq_management'],
  '/admin/settings': ['basic_ai'],
  '/admin/notifications': ['basic_ai'],
  // Professional features
  '/admin/payment-slips': ['ai_slip_verification'],
  '/admin/integrations': ['line_integration'],
  '/admin/broadcast': ['broadcast'],
  '/admin/coupons': ['coupons'],
  '/admin/templates': ['templates'],
  '/admin/analytics': ['analytics'],
  '/admin/ai-settings': ['basic_ai'],
  '/admin/addresses': ['order_management'],
  // Business features
  '/admin/web-scraping': ['web_scraping'],
  '/admin/knowledge-base': ['knowledge_base'],
  '/admin/category-expertise': ['category_expertise'],
  '/admin/embed-code': ['embed_widget'],
  '/admin/backup-reset': ['backup_restore'],
  '/admin/audit-logs': ['audit_logs'],
  '/admin/error-logs': ['error_logs'],
  '/admin/product-faqs': ['product_faqs'],
  '/admin/related-products': ['related_products'],
  '/admin/bookings': ['booking_system'],
};

interface SubscriptionContextType {
  currentPlan: SubscriptionPlan | null;
  subscription: StoreSubscription | null;
  allPlans: SubscriptionPlan[];
  isLoading: boolean;
  hasFeature: (feature: string) => boolean;
  canAccessPage: (path: string) => boolean;
  isFeatureLocked: (path: string) => { locked: boolean; requiredPlan: string };
  messagesRemaining: number | null;
  productsRemaining: number | null;
  refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [currentPlan, setCurrentPlan] = useState<SubscriptionPlan | null>(null);
  const [subscription, setSubscription] = useState<StoreSubscription | null>(null);
  const [allPlans, setAllPlans] = useState<SubscriptionPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSubscription = async () => {
    try {
      // Fetch all plans
      const { data: plans } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (plans) {
        setAllPlans(plans.map(p => ({ ...p, features: (p.features as string[]) || [] })));
      }

      // Fetch current subscription
      const { data: sub } = await supabase
        .from('store_subscription')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sub && plans) {
        setSubscription(sub as StoreSubscription);
        const plan = plans.find(p => p.id === sub.plan_id);
        if (plan) {
          setCurrentPlan({ ...plan, features: (plan.features as string[]) || [] });
        }
      } else if (plans && plans.length > 0) {
        // No subscription yet - default to starter (or no plan)
        setCurrentPlan(null);
        setSubscription(null);
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscription();
  }, []);

  const hasFeature = (feature: string): boolean => {
    if (!currentPlan) return true; // No plan set = all features (owner mode)
    return currentPlan.features.includes(feature);
  };

  const canAccessPage = (path: string): boolean => {
    if (!currentPlan) return true; // No plan = full access
    const requiredFeatures = FEATURE_PAGE_MAP[path];
    if (!requiredFeatures) return true;
    return requiredFeatures.some(f => currentPlan.features.includes(f));
  };

  const isFeatureLocked = (path: string): { locked: boolean; requiredPlan: string } => {
    if (!currentPlan) return { locked: false, requiredPlan: '' };
    const requiredFeatures = FEATURE_PAGE_MAP[path];
    if (!requiredFeatures) return { locked: false, requiredPlan: '' };
    
    const hasAccess = requiredFeatures.some(f => currentPlan.features.includes(f));
    if (hasAccess) return { locked: false, requiredPlan: '' };

    // Find which plan has this feature
    for (const plan of allPlans) {
      const planFeatures = (plan.features as string[]) || [];
      if (requiredFeatures.some(f => planFeatures.includes(f))) {
        return { locked: true, requiredPlan: plan.name_th };
      }
    }
    return { locked: true, requiredPlan: 'Business' };
  };

  const messagesRemaining = currentPlan?.max_messages_per_month != null && subscription
    ? currentPlan.max_messages_per_month - subscription.messages_used
    : null;

  const productsRemaining = currentPlan?.max_products != null
    ? currentPlan.max_products
    : null;

  return (
    <SubscriptionContext.Provider value={{
      currentPlan,
      subscription,
      allPlans,
      isLoading,
      hasFeature,
      canAccessPage,
      isFeatureLocked,
      messagesRemaining,
      productsRemaining,
      refreshSubscription: fetchSubscription,
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}
