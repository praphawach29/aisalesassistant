import { cn } from '@/lib/utils';
import { ChatMessage } from '@/types';
import { User, Copy, Check, ZoomIn } from 'lucide-react';
import { ProductCarousel, Product } from './ProductCarousel';
import { SingleProductCard } from './SingleProductCard';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { toast } from 'sonner';
import { resolveAvatarUrl } from '@/lib/avatarMap';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ChatBubbleProps {
  message: ChatMessage;
  products?: Product[];
  onSelectProduct?: (product: Product) => void;
  botAvatarUrl?: string | null;
}

// Helper function to detect if message contains product list marker
const hasProductMarker = (content: string): boolean => {
  return content.includes('[SHOW_PRODUCTS]') || 
         content.includes('[SHOW_PROMOTIONS]') ||
         content.includes('[SHOW_NEW_ARRIVALS]') ||
         content.includes('[SHOW_BESTSELLERS]') ||
         content.includes('[SHOW_LOW_STOCK]') ||
         content.includes('สินค้าที่แนะนำ') ||
         content.includes('รายการสินค้า');
};

// Helper function to filter products based on marker type
const filterProductsByMarker = (content: string, products: Product[]): Product[] => {
  // Filter for promotions - only products with promotion_price
  if (content.includes('[SHOW_PROMOTIONS]')) {
    return products.filter(p => p.promotion_price !== null && p.promotion_price > 0);
  }
  
  // Filter for new arrivals - products added in the last 7 days
  if (content.includes('[SHOW_NEW_ARRIVALS]')) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return products.filter(p => {
      if (!p.created_at) return false;
      const productDate = new Date(p.created_at);
      return productDate >= sevenDaysAgo;
    });
  }
  
  // Filter for bestsellers - products with sales, sorted by sales_count
  if (content.includes('[SHOW_BESTSELLERS]')) {
    return products
      .filter(p => (p.sales_count ?? 0) > 0)
      .sort((a, b) => (b.sales_count ?? 0) - (a.sales_count ?? 0))
      .slice(0, 10); // Top 10 bestsellers
  }
  
  // Filter for low stock - products with stock less than 10
  if (content.includes('[SHOW_LOW_STOCK]')) {
    return products
      .filter(p => p.stock < 10 && p.stock > 0)
      .sort((a, b) => a.stock - b.stock); // Sort by lowest stock first
  }
  
  // Default - return all products
  return products;
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

// Helper function to extract copyable values from [COPY:xxx] format
const extractCopyableValues = (content: string): { text: string; value: string }[] => {
  const matches = content.matchAll(/\[COPY:([^\]]+)\]/gi);
  const results: { text: string; value: string }[] = [];
  for (const match of matches) {
    results.push({ text: match[0], value: match[1].trim() });
  }
  return results;
};

// Clean message content by removing markers
const cleanContent = (content: string): string => {
  return content
    .replace(/\[SHOW_PRODUCTS?\]/gi, '')
    .replace(/\[SHOW_PROMOTIONS\]/gi, '')
    .replace(/\[SHOW_NEW_ARRIVALS\]/gi, '')
    .replace(/\[SHOW_BESTSELLERS\]/gi, '')
    .replace(/\[SHOW_LOW_STOCK\]/gi, '')
    .replace(/\[(?:SHOW_)?PRODUCT:[^\]]+\]/gi, '')
    .trim();
};

// Component for copyable text
function CopyableText({ value, children }: { value: string; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success('คัดลอกแล้ว');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = value;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        toast.success('คัดลอกแล้ว');
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        toast.error('ไม่สามารถคัดลอกได้');
      }
      document.body.removeChild(textArea);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      className="inline-flex items-center gap-1 h-auto px-2 py-1 text-sm font-medium bg-primary/10 hover:bg-primary/20 text-primary rounded-md transition-colors"
    >
      {children}
      {copied ? (
        <Check className="w-3.5 h-3.5 text-green-500" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </Button>
  );
}

// Render content with copyable elements
function RenderContent({ content }: { content: string }) {
  const copyableValues = extractCopyableValues(content);
  
  if (copyableValues.length === 0) {
    return <>{content}</>;
  }

  // Split content and replace [COPY:xxx] with copyable buttons
  let remainingContent = content;
  const parts: React.ReactNode[] = [];
  let keyIndex = 0;

  for (const { text, value } of copyableValues) {
    const index = remainingContent.indexOf(text);
    if (index !== -1) {
      // Add text before the copyable part
      if (index > 0) {
        parts.push(<span key={`text-${keyIndex}`}>{remainingContent.substring(0, index)}</span>);
      }
      // Add the copyable button
      parts.push(
        <CopyableText key={`copy-${keyIndex}`} value={value}>
          {value}
        </CopyableText>
      );
      remainingContent = remainingContent.substring(index + text.length);
      keyIndex++;
    }
  }

  // Add remaining text
  if (remainingContent) {
    parts.push(<span key={`text-final`}>{remainingContent}</span>);
  }

  return <>{parts}</>;
}

export function ChatBubble({ message, products, onSelectProduct, botAvatarUrl }: ChatBubbleProps) {
  const isUser = message.role === 'user';
  const filteredProducts = products ? filterProductsByMarker(message.content, products) : [];
  const showCarousel = !isUser && filteredProducts.length > 0 && hasProductMarker(message.content);
  const singleProduct = !isUser && products ? extractProductReference(message.content, products) : null;
  
  const displayContent = cleanContent(message.content);

  // Use provided avatar URL or fallback to default female avatar
  const botAvatar = botAvatarUrl || avatarWoman1;

  return (
    <div className={cn(
      'flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300 w-full',
      isUser ? 'flex-row-reverse' : 'flex-row'
    )}>
      {isUser ? (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
          <User className="w-4 h-4" />
        </div>
      ) : (
        <img 
          src={botAvatar} 
          alt="Bot" 
          className="flex-shrink-0 w-8 h-8 rounded-full object-cover shadow-md"
        />
      )}
      
      <div className="flex flex-col gap-2" style={{ maxWidth: 'calc(100% - 44px)' }}>
        {/* Image Preview for payment slips */}
        {message.image_url && (
          <Dialog>
            <DialogTrigger asChild>
              <div className={cn(
                "relative cursor-pointer group rounded-lg overflow-hidden w-fit",
                isUser ? "self-end" : "self-start"
              )}>
                <img 
                  src={message.image_url} 
                  alt="สลิปโอนเงิน" 
                  className="max-w-[200px] max-h-[200px] object-cover rounded-lg border border-border"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <ZoomIn className="w-6 h-6 text-white" />
                </div>
              </div>
            </DialogTrigger>
            <DialogContent className="max-w-3xl p-2">
              <img 
                src={message.image_url} 
                alt="สลิปโอนเงิน" 
                className="w-full h-auto max-h-[80vh] object-contain"
              />
            </DialogContent>
          </Dialog>
        )}

        {displayContent && (
          <div className={cn(
            'rounded-2xl px-4 py-3 w-fit',
            isUser
              ? 'bg-primary text-primary-foreground rounded-br-md'
              : 'bg-muted text-foreground rounded-bl-md'
          )} style={{ maxWidth: 'min(85%, 280px)', wordBreak: 'break-word' }}>
            <p className="text-sm whitespace-pre-wrap leading-relaxed m-0">
              <RenderContent content={displayContent} />
            </p>
          </div>
        )}
        
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
            products={filteredProducts} 
            onSelectProduct={onSelectProduct}
          />
        )}
      </div>
    </div>
  );
}
