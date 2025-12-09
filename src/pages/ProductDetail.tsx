import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  ShoppingCart,
  Share2,
  MessageCircle,
  Package,
  Tag,
  ImageIcon,
  CheckCircle,
  XCircle,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  promotion_price: number | null;
  image_url: string | null;
  category: string | null;
  stock: number;
  is_active: boolean;
}

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (id) {
      fetchProduct(id);
    }
  }, [id]);

  const fetchProduct = async (productId: string) => {
    setIsLoading(true);
    
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('Error fetching product:', error);
      toast.error('ไม่สามารถโหลดข้อมูลสินค้าได้');
      setNotFound(true);
    } else if (!data) {
      setNotFound(true);
    } else {
      setProduct(data);
      // Update page title for SEO
      document.title = `${data.name} | AI Sales Assistant`;
    }
    
    setIsLoading(false);
  };

  const handleShare = async () => {
    const url = window.location.href;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: product?.name,
          text: `ดูสินค้า: ${product?.name}`,
          url: url,
        });
      } catch (error) {
        // User cancelled or share failed
        copyToClipboard(url);
      }
    } else {
      copyToClipboard(url);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('คัดลอกลิงค์แล้ว');
  };

  const handleOrderViaChat = () => {
    // Navigate to chat with product pre-filled
    navigate(`/?product=${encodeURIComponent(product?.name || '')}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !product) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-6">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-muted-foreground" />
            </div>
            <h1 className="text-xl font-semibold mb-2">ไม่พบสินค้า</h1>
            <p className="text-muted-foreground mb-6">
              สินค้านี้อาจถูกลบหรือไม่มีในระบบแล้ว
            </p>
            <Link to="/">
              <Button className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                กลับหน้าหลัก
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasPromotion = product.promotion_price && product.promotion_price < product.price;
  const discountPercent = hasPromotion 
    ? Math.round((1 - product.promotion_price! / product.price) * 100)
    : 0;
  const finalPrice = hasPromotion ? product.promotion_price! : product.price;
  const isInStock = product.stock > 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              กลับ
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={handleShare} className="gap-2">
            <Share2 className="w-4 h-4" />
            แชร์
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Product Image */}
          <div className="relative">
            <div className="aspect-square rounded-2xl overflow-hidden bg-muted shadow-lg">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon className="w-24 h-24 text-muted-foreground/30" />
                </div>
              )}
            </div>
            
            {/* Badges */}
            <div className="absolute top-4 left-4 flex flex-col gap-2">
              {hasPromotion && (
                <Badge className="bg-destructive text-destructive-foreground text-sm px-3 py-1">
                  ลด {discountPercent}%
                </Badge>
              )}
              {!isInStock && (
                <Badge variant="secondary" className="text-sm px-3 py-1">
                  สินค้าหมด
                </Badge>
              )}
            </div>
          </div>

          {/* Product Info */}
          <div className="flex flex-col">
            {/* Category */}
            {product.category && (
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Tag className="w-4 h-4" />
                <span className="text-sm">{product.category}</span>
              </div>
            )}

            {/* Name */}
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
              {product.name}
            </h1>

            {/* Price */}
            <div className="flex items-baseline gap-3 mb-6">
              <span className="text-3xl font-bold text-primary">
                ฿{finalPrice.toLocaleString()}
              </span>
              {hasPromotion && (
                <span className="text-xl text-muted-foreground line-through">
                  ฿{product.price.toLocaleString()}
                </span>
              )}
            </div>

            {/* Stock Status */}
            <div className="flex items-center gap-2 mb-6">
              {isInStock ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-green-600 font-medium">มีสินค้าพร้อมจำหน่าย</span>
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-destructive" />
                  <span className="text-destructive font-medium">สินค้าหมดชั่วคราว</span>
                </>
              )}
            </div>

            <Separator className="my-4" />

            {/* Description */}
            {product.description && (
              <div className="mb-6">
                <h2 className="font-semibold text-lg mb-2">รายละเอียดสินค้า</h2>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {product.description}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col gap-3 mt-auto">
              <Button 
                size="lg" 
                className="w-full gap-2 text-base"
                disabled={!isInStock}
                onClick={handleOrderViaChat}
              >
                <ShoppingCart className="w-5 h-5" />
                {isInStock ? 'สั่งซื้อสินค้านี้' : 'สินค้าหมด'}
              </Button>
              
              <Button 
                variant="outline" 
                size="lg" 
                className="w-full gap-2 text-base"
                onClick={handleOrderViaChat}
              >
                <MessageCircle className="w-5 h-5" />
                สอบถามเพิ่มเติม
              </Button>
            </div>

            {/* Share Link */}
            <div className="mt-6 p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">แชร์ลิงค์สินค้านี้:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-background px-3 py-2 rounded border truncate">
                  {window.location.href}
                </code>
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={() => copyToClipboard(window.location.href)}
                >
                  คัดลอก
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-12 py-6 text-center text-sm text-muted-foreground">
        <Link to="/" className="hover:text-primary transition-colors">
          กลับไปหน้า Chatbot
        </Link>
      </footer>
    </div>
  );
}