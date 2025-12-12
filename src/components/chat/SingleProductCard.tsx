import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, ImageIcon, ExternalLink, Palette } from 'lucide-react';
import { Product } from './ProductCarousel';

interface SingleProductCardProps {
  product: Product;
  onSelectProduct?: (product: Product) => void;
}

export function SingleProductCard({ product, onSelectProduct }: SingleProductCardProps) {
  const hasPromotion = product.promotion_price && product.promotion_price < product.price;
  const discountPercent = hasPromotion 
    ? Math.round((1 - product.promotion_price! / product.price) * 100)
    : 0;

  return (
    <Card className="w-full max-w-[300px] overflow-hidden hover:shadow-lg transition-shadow">
      {/* Product Image - Clickable */}
      <Link to={`/products/${product.id}`}>
        <div className="relative h-40 bg-muted overflow-hidden cursor-pointer group">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="w-16 h-16 text-muted-foreground/30" />
            </div>
          )}
          
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-sm font-medium bg-black/50 px-3 py-1 rounded-full">
              ดูรายละเอียด
            </span>
          </div>
          
          {/* Promotion Badge */}
          {hasPromotion && (
            <Badge className="absolute top-2 left-2 bg-destructive text-destructive-foreground">
              ลด {discountPercent}%
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

      <CardContent className="p-4">
        {/* Category */}
        {product.category && (
          <span className="text-xs text-muted-foreground">{product.category}</span>
        )}
        
        {/* Product Name - Clickable */}
        <Link to={`/products/${product.id}`}>
          <h4 className="font-semibold text-base mt-1 line-clamp-2 hover:text-primary transition-colors cursor-pointer">
            {product.name}
          </h4>
        </Link>

        {/* Description */}
        {product.description && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {product.description}
          </p>
        )}

        {/* Product Variants */}
        {product.variants && Array.isArray(product.variants) && product.variants.length > 0 && (
          <div className="mt-3 p-2 bg-muted/50 rounded-md space-y-1.5">
            {product.variants.map((variant, idx) => (
              <div key={idx} className="flex items-start gap-2 text-sm">
                <Palette className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-muted-foreground">{variant.name}: </span>
                  <span className="font-medium text-foreground">
                    {variant.options.join(', ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Price */}
        <div className="flex items-center gap-2 mt-3">
          {hasPromotion ? (
            <>
              <span className="text-lg font-bold text-destructive">
                ฿{product.promotion_price!.toLocaleString()}
              </span>
              <span className="text-sm text-muted-foreground line-through">
                ฿{product.price.toLocaleString()}
              </span>
            </>
          ) : (
            <span className="text-lg font-bold">
              ฿{product.price.toLocaleString()}
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-4">
          <Button
            size="sm"
            className="flex-1 gap-2"
            disabled={product.stock === 0}
            onClick={() => onSelectProduct?.(product)}
          >
            <ShoppingCart className="w-4 h-4" />
            {product.stock === 0 ? 'สินค้าหมด' : 'สั่งซื้อ'}
          </Button>
          <Link to={`/products/${product.id}`}>
            <Button size="sm" variant="outline">
              <ExternalLink className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}