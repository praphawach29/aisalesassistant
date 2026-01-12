import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, ShoppingCart, ImageIcon, ExternalLink, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ProductVariant {
  name: string;
  options: string[];
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  promotion_price: number | null;
  image_url: string | null;
  category: string | null;
  stock: number;
  variants?: ProductVariant[] | null;
  created_at?: string;
  sales_count?: number;
}

interface ProductCarouselProps {
  products: Product[];
  onSelectProduct?: (product: Product) => void;
}

export function ProductCarousel({ products, onSelectProduct }: ProductCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  const updateScrollButtons = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
      
      // Calculate active index based on scroll position
      const cardWidth = 220 + 12; // card width + gap
      const newIndex = Math.round(scrollLeft / cardWidth);
      setActiveIndex(Math.min(newIndex, products.length - 1));
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 280;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
      setTimeout(updateScrollButtons, 300);
    }
  };

  if (products.length === 0) return null;

  return (
    <div className="relative w-full max-w-[calc(100vw-120px)] sm:max-w-[500px]">
      {/* Navigation Buttons */}
      {canScrollLeft && (
        <Button
          variant="secondary"
          size="icon"
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 z-10 h-8 w-8 rounded-full shadow-lg"
          onClick={() => scroll('left')}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}
      
      {canScrollRight && products.length > 1 && (
        <Button
          variant="secondary"
          size="icon"
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 z-10 h-8 w-8 rounded-full shadow-lg"
          onClick={() => scroll('right')}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}

      {/* Carousel Container */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scrollbar-hide scroll-smooth pb-2"
        onScroll={updateScrollButtons}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {products.map((product) => (
          <Card
            key={product.id}
            className="flex-shrink-0 w-[200px] sm:w-[220px] overflow-hidden hover:shadow-lg transition-shadow group"
          >
            {/* Product Image - Clickable */}
            <Link to={`/products/${product.id}`}>
              <div className="relative h-32 bg-muted overflow-hidden cursor-pointer">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-12 h-12 text-muted-foreground/30" />
                  </div>
                )}
                
                {/* Promotion Badge */}
                {product.promotion_price && (
                  <Badge className="absolute top-2 left-2 bg-destructive text-destructive-foreground text-xs">
                    ลด {Math.round((1 - product.promotion_price / product.price) * 100)}%
                  </Badge>
                )}
                
                {/* Out of Stock Overlay */}
                {product.stock === 0 && (
                  <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                    <span className="text-sm font-medium text-muted-foreground">สินค้าหมด</span>
                  </div>
                )}
              </div>
            </Link>

            <CardContent className="p-3">
              {/* Category */}
              {product.category && (
                <span className="text-xs text-muted-foreground">{product.category}</span>
              )}
              
              {/* Product Name - Clickable */}
              <Link to={`/products/${product.id}`}>
                <h4 className="font-medium text-sm line-clamp-2 min-h-[40px] mt-1 hover:text-primary transition-colors cursor-pointer">
                  {product.name}
                </h4>
              </Link>

              {/* Product Variants */}
              {product.variants && Array.isArray(product.variants) && product.variants.length > 0 && (
                <div className="mt-2 space-y-1">
                  {product.variants.slice(0, 2).map((variant, idx) => (
                    <div key={idx} className="flex items-center gap-1 text-xs">
                      <Palette className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground">{variant.name}:</span>
                      <span className="text-foreground font-medium truncate">
                        {variant.options.slice(0, 3).join(', ')}
                        {variant.options.length > 3 && ' ...'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Price */}
              <div className="flex items-center gap-2 mt-2">
                {product.promotion_price ? (
                  <>
                    <span className="text-base font-bold text-destructive">
                      ฿{product.promotion_price.toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground line-through">
                      ฿{product.price.toLocaleString()}
                    </span>
                  </>
                ) : (
                  <span className="text-base font-bold">
                    ฿{product.price.toLocaleString()}
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-1 mt-3">
                <Button
                  size="sm"
                  className="flex-1 gap-1"
                  disabled={product.stock === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectProduct?.(product);
                  }}
                >
                  <ShoppingCart className="w-3 h-3" />
                  {product.stock === 0 ? 'หมด' : 'สั่งซื้อ'}
                </Button>
                <Link to={`/products/${product.id}`}>
                  <Button size="sm" variant="outline" className="px-2">
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Scroll Indicator */}
      {products.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-2">
          {products.map((_, index) => (
            <div
              key={index}
              className={cn(
                "w-2 h-2 rounded-full transition-all duration-300",
                index === activeIndex 
                  ? "bg-primary scale-110" 
                  : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
