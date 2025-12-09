import { useEffect, useRef, useState } from 'react';
import { useChat } from '@/hooks/useChat';
import { ChatBubble } from './ChatBubble';
import { ChatInput } from './ChatInput';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { RotateCcw, ShoppingBag, MessageCircle, Package, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Product } from './ProductCarousel';

export function ChatWindow() {
  const { messages, isLoading, isLoadingHistory, sendMessage, clearChat } = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [products, setProducts] = useState<Product[]>([]);

  // Fetch products for carousel display
  useEffect(() => {
    const fetchProducts = async () => {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (data) {
        setProducts(data as Product[]);
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
    sendMessage(`ต้องการสั่งซื้อ ${product.name} ครับ`);
  };

  const quickActions = [
    { label: 'ดูสินค้า', icon: ShoppingBag, message: 'อยากดูสินค้าที่มีขายหน่อยครับ' },
    { label: 'สั่งซื้อสินค้า', icon: Package, message: 'ต้องการสั่งซื้อสินค้า' },
    { label: 'สอบถามราคา', icon: MessageCircle, message: 'อยากสอบถามราคาสินค้า' },
  ];

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
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
            <ShoppingBag className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Sales Assistant</h2>
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
                สวัสดีครับ! ผมเป็นผู้ช่วยขายอัตโนมัติ พร้อมช่วยแนะนำสินค้า รับออเดอร์ และตอบคำถามของคุณครับ
              </p>
              
              <div className="flex flex-wrap gap-2 justify-center">
                {quickActions.map((action) => (
                  <Button
                    key={action.label}
                    variant="outline"
                    size="sm"
                    onClick={() => sendMessage(action.message)}
                    className="gap-2"
                  >
                    <action.icon className="w-4 h-4" />
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
    </div>
  );
}
