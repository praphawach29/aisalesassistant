import { supabase } from '@/integrations/supabase/client';

// Cache invalidation types
export type CacheType = 'products' | 'faqs' | 'settings' | 'ai_settings' | 'all';

/**
 * Hook to invalidate edge function caches after admin updates
 * This updates a timestamp in the database that edge functions check
 */
export function useCacheInvalidation() {
  
  const invalidateCache = async (types: CacheType[] = ['all']) => {
    try {
      const timestamp = new Date().toISOString();
      
      // Update the cache invalidation timestamp in settings
      const { error } = await supabase
        .from('settings')
        .upsert({
          key: 'CACHE_INVALIDATED_AT',
          value: timestamp,
          description: 'Timestamp when cache was last invalidated'
        }, {
          onConflict: 'key'
        });

      if (error) {
        console.error('Cache invalidation failed:', error);
        return false;
      }

      console.log(`Cache invalidated for: ${types.join(', ')} at ${timestamp}`);
      return true;
    } catch (error) {
      console.error('Cache invalidation error:', error);
      return false;
    }
  };

  return { invalidateCache };
}
