import { useEffect, useRef, useState } from 'react';
import { useChat } from '@/hooks/useChat';
import { ChatBubble } from './ChatBubble';
import { ChatInput } from './ChatInput';
import { ThinkingIndicator } from './ThinkingIndicator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { RotateCcw, ShoppingBag, MessageCircle, Package, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Product } from './ProductCarousel';
import { VariantSelectDialog } from './VariantSelectDialog';

interface AISettings {
  ai_name: string;
  gender: string;
  greeting_message: string | null;
}

// Helper function to get default greeting based on gender
function getDefaultGreeting(gender?: string): string {
  if (gender === 'female') {
    return 'สวัสดีค่ะ! ดิฉันเป็นผู้ช่วยขายอัตโนมัติ พร้อมช่วยแนะนำสินค้า รับออเดอร์ และตอบคำถามของคุณค่ะ';
  } else if (gender === 'male') {
    return 'สวัสดีครับ! ผมเป็นผู้ช่วยขายอัตโนมัติ พร้อมช่วยแนะนำสินค้า รับออเดอร์ และตอบคำถามของคุณครับ';
  }
  return 'สวัสดีครับ/ค่ะ! เป็นผู้ช่วยขายอัตโนมัติ พร้อมช่วยแนะนำสินค้า รับออเดอร์ และตอบคำถามของคุณ';
}

interface ChatWindowProps {
  welcomeMessage?: string;
  logoUrl?: string;
  quickActions?: Array<{ label: string; message: string }>;
}

export function ChatWindow({ welcomeMessage, logoUrl, quickActions }: ChatWindowProps) {
  const { messages, isLoading, isLoadingHistory, sendMessage, clearChat } = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isVariantDialogOpen, setIsVariantDialogOpen] = useState(false);
  const [aiSettings, setAiSettings] = useState<AISettings | null>(null);

  // Fetch AI settings
  useEffect(() => {
    const fetchAISettings = async () => {
      const { data } = await supabase
        .from('ai_settings')
        .select('ai_name, gender, greeting_message')
        .eq('is_active', true)
        .maybeSingle();
      
      if (data) {
        setAiSettings(data);
      }
    };
    fetchAISettings();
  }, []);

  // Fetch products for carousel display
  useEffect(() => {
    const fetchProducts = async () => {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (data) {
        // Map database products to Product type with proper variants typing
        const mappedProducts: Product[] = data.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          price: p.price,
          promotion_price: p.promotion_price,
          image_url: p.image_url,
          category: p.category,
          stock: p.stock,
          variants: Array.isArray(p.variants) ? p.variants as unknown as Product['variants'] : null
        }));
        setProducts(mappedProducts);
      }
    };
    fetchProducts();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSelectProduct = (product: Product) => {
    // If product has variants, show selection dialog
    const hasVariants = product.variants && Array.isArray(product.variants) && product.variants.length > 0;
    
    if (hasVariants) {
      setSelectedProduct(product);
      setIsVariantDialogOpen(true);
    } else {
      // No variants, order directly
      sendMessage(`ต้องการสั่งซื้อ ${product.name} จำนวน 1 ชิ้นครับ`);
    }
  };

  const handleVariantConfirm = (product: Product, selectedVariants: Record<string, string>, quantity: number) => {
    // Build order message with variants
    const variantText = Object.entries(selectedVariants)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
    
    const message = variantText 
      ? `ต้องการสั่งซื้อ ${product.name} (${variantText}) จำนวน ${quantity} ชิ้นครับ`
      : `ต้องการสั่งซื้อ ${product.name} จำนวน ${quantity} ชิ้นครับ`;
    
    sendMessage(message);
  };

  const defaultQuickActions = [
    { label: 'ดูสินค้า', icon: ShoppingBag, message: 'อยากดูสินค้าที่มีขายหน่อยครับ' },
    { label: 'สั่งซื้อสินค้า', icon: Package, message: 'ต้องการสั่งซื้อสินค้า' },
    { label: 'สอบถามราคา', icon: MessageCircle, message: 'อยากสอบถามราคาสินค้า' },
  ];

  // Use custom quick actions if provided, otherwise use defaults
  const displayQuickActions = quickActions 
    ? quickActions.map((action, i) => ({ 
        ...action, 
        icon: [ShoppingBag, Package, MessageCircle, RefreshCw, MessageCircle][i] || MessageCircle 
      }))
    : defaultQuickActions;

  if (isLoadingHistory) {
    return (
      <div className="flex flex-col h-full bg-background items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-sm text-muted-foreground">กำลังโหลดประวัติการสนทนา...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-card">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-primary-foreground" />
            </div>
          )}
          <div>
            <h2 className="font-semibold text-foreground">{aiSettings?.ai_name || 'Sales Assistant'}</h2>
            <p className="text-xs text-muted-foreground">
              {messages.length > 0 ? `${messages.length} ข้อความ` : 'พร้อมให้บริการ 24 ชม.'}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearChat}
          title="เริ่มสนทนาใหม่"
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="w-4 h-4" />
          <span className="hidden sm:inline">เริ่มใหม่</span>
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mb-4">
                <MessageCircle className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-medium text-foreground mb-2">ยินดีต้อนรับ!</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                {welcomeMessage || aiSettings?.greeting_message || getDefaultGreeting(aiSettings?.gender)}
              </p>
              
              <div className="flex flex-wrap gap-2 justify-center">
                {displayQuickActions.map((action) => (
                  <Button
                    key={action.label}
                    variant="outline"
                    size="sm"
                    onClick={() => sendMessage(action.message)}
                    className="gap-2"
                  >
                    {'icon' in action && action.icon && <action.icon className="w-4 h-4" />}
                    {action.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Show conversation history notice */}
              <div className="text-center mb-4">
                <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                  ประวัติการสนทนา
                </span>
              </div>
              {messages.map((message) => (
                <ChatBubble 
                  key={message.id} 
                  message={message}
                  products={products}
                  onSelectProduct={handleSelectProduct}
                />
              ))}
              {isLoading && <ThinkingIndicator />}
            </>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t bg-card">
        <ChatInput
          onSend={sendMessage}
          isLoading={isLoading}
          placeholder="พิมพ์ข้อความ... (กด Enter เพื่อส่ง)"
        />
      </div>

      {/* Variant Selection Dialog */}
      <VariantSelectDialog
        product={selectedProduct}
        open={isVariantDialogOpen}
        onOpenChange={setIsVariantDialogOpen}
        onConfirm={handleVariantConfirm}
      />
    </div>
  );
}
