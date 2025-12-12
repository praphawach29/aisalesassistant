import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, ImageIcon, Minus, Plus } from 'lucide-react';
import { Product, ProductVariant } from './ProductCarousel';
import { cn } from '@/lib/utils';

interface VariantSelectDialogProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (product: Product, selectedVariants: Record<string, string>, quantity: number) => void;
}

export function VariantSelectDialog({ product, open, onOpenChange, onConfirm }: VariantSelectDialogProps) {
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);

  if (!product) return null;

  const hasVariants = product.variants && Array.isArray(product.variants) && product.variants.length > 0;
  const hasPromotion = product.promotion_price && product.promotion_price < product.price;
  const displayPrice = product.promotion_price || product.price;
  const totalPrice = displayPrice * quantity;

  const handleVariantSelect = (variantName: string, option: string) => {
    setSelectedVariants(prev => ({
      ...prev,
      [variantName]: option
    }));
  };

  const handleConfirm = () => {
    onConfirm(product, selectedVariants, quantity);
    // Reset state
    setSelectedVariants({});
    setQuantity(1);
    onOpenChange(false);
  };

  const handleClose = () => {
    setSelectedVariants({});
    setQuantity(1);
    onOpenChange(false);
  };

  // Check if all variants are selected
  const allVariantsSelected = hasVariants 
    ? product.variants!.every(v => selectedVariants[v.name])
    : true;

  const isOutOfStock = product.stock === 0;
  const exceedsStock = quantity > product.stock;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">เลือกรายละเอียดสินค้า</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Product Info */}
          <div className="flex gap-4">
            <div className="w-24 h-24 rounded-lg bg-muted overflow-hidden flex-shrink-0">
              {product.image_url ? (
                <img 
                  src={product.image_url} 
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon className="w-8 h-8 text-muted-foreground/30" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base line-clamp-2">{product.name}</h3>
              {product.category && (
                <span className="text-xs text-muted-foreground">{product.category}</span>
              )}
              <div className="flex items-center gap-2 mt-2">
                {hasPromotion ? (
                  <>
                    <span className="text-lg font-bold text-destructive">
                      ฿{displayPrice.toLocaleString()}
                    </span>
                    <span className="text-sm text-muted-foreground line-through">
                      ฿{product.price.toLocaleString()}
                    </span>
                    <Badge variant="destructive" className="text-xs">
                      ลด {Math.round((1 - product.promotion_price! / product.price) * 100)}%
                    </Badge>
                  </>
                ) : (
                  <span className="text-lg font-bold">฿{displayPrice.toLocaleString()}</span>
                )}
              </div>
            </div>
          </div>

          {/* Variant Selection */}
          {hasVariants && product.variants!.map((variant, idx) => (
            <div key={idx} className="space-y-2">
              <Label className="text-sm font-medium">
                {variant.name} <span className="text-destructive">*</span>
              </Label>
              <div className="flex flex-wrap gap-2">
                {variant.options.map((option) => (
                  <Button
                    key={option}
                    type="button"
                    variant={selectedVariants[variant.name] === option ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      "h-8 px-3",
                      selectedVariants[variant.name] === option && "ring-2 ring-primary ring-offset-2"
                    )}
                    onClick={() => handleVariantSelect(variant.name, option)}
                  >
                    {option}
                  </Button>
                ))}
              </div>
            </div>
          ))}

          {/* Quantity Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">จำนวน</Label>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-12 text-center font-semibold text-lg">{quantity}</span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => setQuantity(quantity + 1)}
                disabled={quantity >= product.stock}
              >
                <Plus className="h-4 w-4" />
              </Button>
              {product.stock <= 10 && product.stock > 0 && (
                <span className="text-xs text-muted-foreground">
                  (เหลือ {product.stock} ชิ้น)
                </span>
              )}
            </div>
            {exceedsStock && (
              <p className="text-xs text-destructive">จำนวนสินค้าเกินสต็อกที่มี</p>
            )}
          </div>

          {/* Total Price */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <span className="font-medium">ยอดรวม</span>
            <span className="text-xl font-bold text-primary">฿{totalPrice.toLocaleString()}</span>
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button variant="outline" onClick={handleClose} className="flex-1">
            ยกเลิก
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={isOutOfStock || exceedsStock || !allVariantsSelected}
            className="flex-1 gap-2"
          >
            <ShoppingCart className="w-4 h-4" />
            {isOutOfStock ? 'สินค้าหมด' : 'ยืนยันสั่งซื้อ'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
