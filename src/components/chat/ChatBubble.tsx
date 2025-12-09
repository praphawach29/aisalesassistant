import { cn } from '@/lib/utils';
import { ChatMessage } from '@/types';
import { Bot, User } from 'lucide-react';
import { ProductCarousel, Product } from './ProductCarousel';

interface ChatBubbleProps {
  message: ChatMessage;
  products?: Product[];
  onSelectProduct?: (product: Product) => void;
}

// Helper function to detect if message contains product list marker
const hasProductMarker = (content: string): boolean => {
  return content.includes('[SHOW_PRODUCTS]') || 
         content.includes('สินค้าที่แนะนำ') ||
         content.includes('รายการสินค้า');
};

export function ChatBubble({ message, products, onSelectProduct }: ChatBubbleProps) {
  const isUser = message.role === 'user';
  const showCarousel = !isUser && products && products.length > 0 && hasProductMarker(message.content);
  
  // Clean message content by removing product marker
  const cleanContent = message.content.replace('[SHOW_PRODUCTS]', '').trim();

  return (
    <div className={cn(
      'flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300',
      isUser ? 'flex-row-reverse' : 'flex-row'
    )}>
      <div className={cn(
        'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
        isUser ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
      )}>
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>
      
      <div className="flex flex-col gap-2 max-w-[80%]">
        <div className={cn(
          'rounded-2xl px-4 py-3',
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-md'
            : 'bg-muted text-foreground rounded-bl-md'
        )}>
          <p className="text-sm whitespace-pre-wrap leading-relaxed">
            {cleanContent || (
              <span className="inline-flex gap-1">
                <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            )}
          </p>
        </div>
        
        {/* Product Carousel */}
        {showCarousel && (
          <ProductCarousel 
            products={products} 
            onSelectProduct={onSelectProduct}
          />
        )}
      </div>
    </div>
  );
}
