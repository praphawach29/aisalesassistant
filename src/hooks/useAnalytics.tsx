import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Generate or get session ID
function getSessionId(): string {
  let sessionId = sessionStorage.getItem('analytics_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('analytics_session_id', sessionId);
  }
  return sessionId;
}

// Detect device type
function getDeviceType(): string {
  const width = window.innerWidth;
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

// Get browser info
function getBrowser(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Chrome') && !ua.includes('Edge')) return 'Chrome';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Edge')) return 'Edge';
  if (ua.includes('Opera')) return 'Opera';
  return 'Unknown';
}

interface TrackEventOptions {
  event_type: string;
  event_data?: Record<string, any>;
  platform_user_id?: string;
}

export function useAnalytics() {
  const sessionId = useRef(getSessionId());
  const hasTrackedPageView = useRef(false);

  const trackEvent = useCallback(async (options: TrackEventOptions) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      await supabase.from('analytics_events').insert({
        event_type: options.event_type,
        event_data: options.event_data || {},
        session_id: sessionId.current,
        platform: 'web',
        platform_user_id: options.platform_user_id,
        user_id: user?.id,
        device_type: getDeviceType(),
        browser: getBrowser(),
        referrer: document.referrer || null,
        page_url: window.location.href
      });
    } catch (error) {
      // Silently fail - analytics should not break the app
      console.debug('Analytics tracking failed:', error);
    }
  }, []);

  const trackPageView = useCallback((pageName?: string) => {
    trackEvent({
      event_type: 'page_view',
      event_data: {
        page_name: pageName || document.title,
        path: window.location.pathname
      }
    });
  }, [trackEvent]);

  const trackProductView = useCallback((product: {
    id: string;
    name: string;
    price: number;
    category?: string;
  }) => {
    trackEvent({
      event_type: 'product_view',
      event_data: product
    });
  }, [trackEvent]);

  const trackAddToCart = useCallback((product: {
    id: string;
    name: string;
    price: number;
    quantity: number;
    variants?: string;
  }) => {
    trackEvent({
      event_type: 'add_to_cart',
      event_data: product
    });
  }, [trackEvent]);

  const trackCheckout = useCallback((order: {
    order_id?: string;
    total_amount: number;
    item_count: number;
  }) => {
    trackEvent({
      event_type: 'checkout',
      event_data: order
    });
  }, [trackEvent]);

  const trackOrderComplete = useCallback((order: {
    order_id: string;
    order_number: string;
    total_amount: number;
    item_count: number;
  }) => {
    trackEvent({
      event_type: 'order_complete',
      event_data: order
    });
  }, [trackEvent]);

  const trackChatStarted = useCallback((platform_user_id?: string) => {
    trackEvent({
      event_type: 'chat_started',
      platform_user_id
    });
  }, [trackEvent]);

  const trackChatMessage = useCallback((messageType: 'user' | 'assistant', platform_user_id?: string) => {
    trackEvent({
      event_type: 'chat_message',
      event_data: { message_type: messageType },
      platform_user_id
    });
  }, [trackEvent]);

  // Auto-track page view on mount (once per component lifecycle)
  useEffect(() => {
    if (!hasTrackedPageView.current) {
      trackPageView();
      hasTrackedPageView.current = true;
    }
  }, [trackPageView]);

  return {
    trackEvent,
    trackPageView,
    trackProductView,
    trackAddToCart,
    trackCheckout,
    trackOrderComplete,
    trackChatStarted,
    trackChatMessage,
    sessionId: sessionId.current
  };
}
