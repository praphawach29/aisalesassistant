import { cn } from '@/lib/utils';
import { ChatMessage } from '@/types';
import { User } from 'lucide-react';
import { ProductCarousel, Product } from './ProductCarousel';
import { SingleProductCard } from './SingleProductCard';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import avatarWoman1 from '@/assets/avatars/avatar-woman-1.png';

interface ChatBubbleProps {
  message: ChatMessage;
  products?: Product[];
  onSelectProduct?: (product: Product) => void;
  botAvatarUrl?: string | null;
}

// Helper function to detect if message contains product list marker
const hasProductMarker = (content: string): boolean => {
  return content.includes('[SHOW_PRODUCTS]') || 
         content.includes('สินค้าที่แนะนำ') ||
         content.includes('รายการสินค้า');
};

// Helper function to extract single product reference from message
const extractProductReference = (content: string, products: Product[]): Product | null => {
  // Pattern: [PRODUCT:product_name] or [SHOW_PRODUCT:product_name]
  const productMatch = content.match(/\[(?:SHOW_)?PRODUCT:([^\]]+)\]/i);
  if (productMatch) {
    const productName = productMatch[1].trim().toLowerCase();
    return products.find(p => 
      p.name.toLowerCase().includes(productName) || 
      productName.includes(p.name.toLowerCase())
    ) || null;
  }
  return null;
};

// Clean message content by removing product markers
const cleanContent = (content: string): string => {
  return content
    .replace(/\[SHOW_PRODUCTS?\]/gi, '')
    .replace(/\[(?:SHOW_)?PRODUCT:[^\]]+\]/gi, '')
    .trim();
};

export function ChatBubble({ message, products, onSelectProduct, botAvatarUrl }: ChatBubbleProps) {
  const isUser = message.role === 'user';
  const showCarousel = !isUser && products && products.length > 0 && hasProductMarker(message.content);
  const singleProduct = !isUser && products ? extractProductReference(message.content, products) : null;
  
  const displayContent = cleanContent(message.content);

  // Use provided avatar URL or fallback to default female avatar
  const botAvatar = botAvatarUrl || avatarWoman1;

  return (
    <div className={cn(
      'flex gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300 w-full',
      isUser ? 'flex-row-reverse' : 'flex-row'
    )}>
      {isUser ? (
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
          <User className="w-3.5 h-3.5" />
        </div>
      ) : (
        <Avatar className="flex-shrink-0 w-7 h-7">
          <AvatarImage src={botAvatar} alt="Bot Avatar" />
          <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">AI</AvatarFallback>
        </Avatar>
      )}
      
      <div className={cn(
        'flex flex-col gap-2 min-w-0',
        isUser ? 'items-end' : 'items-start',
        'max-w-[calc(100%-3rem)]'
      )}>
        <div className={cn(
          'rounded-2xl px-3 py-2 max-w-full',
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-md'
            : 'bg-muted text-foreground rounded-bl-md'
        )}>
          <p className="text-xs leading-relaxed whitespace-pre-wrap break-all">
            {displayContent || (
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            )}
          </p>
        </div>
        
        {/* Single Product Card */}
        {singleProduct && (
          <SingleProductCard 
            product={singleProduct} 
            onSelectProduct={onSelectProduct}
          />
        )}
        
        {/* Product Carousel */}
        {showCarousel && !singleProduct && (
          <ProductCarousel 
            products={products} 
            onSelectProduct={onSelectProduct}
          />
        )}
      </div>
    </div>
  );
}
