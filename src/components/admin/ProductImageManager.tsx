import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Upload, X, RefreshCw, Star, GripVertical } from 'lucide-react';
import { toast } from 'sonner';

export interface ProductImage {
  id?: string;
  image_url: string;
  sort_order: number;
  is_primary: boolean;
}

interface ProductImageManagerProps {
  images: ProductImage[];
  onChange: (images: ProductImage[]) => void;
  maxImages?: number;
}

export function ProductImageManager({ images, onChange, maxImages = 3 }: ProductImageManagerProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('กรุณาเลือกไฟล์รูปภาพเท่านั้น');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('ขนาดไฟล์ต้องไม่เกิน 5MB');
      return;
    }
    if (images.length >= maxImages) {
      toast.error(`เพิ่มรูปได้สูงสุด ${maxImages} รูป`);
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `products/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      const newImage: ProductImage = {
        image_url: publicUrl,
        sort_order: images.length,
        is_primary: images.length === 0,
      };
      onChange([...images, newImage]);
      toast.success('อัพโหลดรูปภาพสำเร็จ');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('เกิดข้อผิดพลาดในการอัพโหลดรูปภาพ');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const removeImage = (index: number) => {
    const updated = images.filter((_, i) => i !== index);
    // If we removed the primary, set first one as primary
    if (updated.length > 0 && !updated.some(img => img.is_primary)) {
      updated[0].is_primary = true;
    }
    // Re-index sort_order
    updated.forEach((img, i) => { img.sort_order = i; });
    onChange(updated);
  };

  const setPrimary = (index: number) => {
    const updated = images.map((img, i) => ({
      ...img,
      is_primary: i === index,
    }));
    // Move the primary to front
    const primary = updated.splice(index, 1)[0];
    updated.unshift(primary);
    updated.forEach((img, i) => { img.sort_order = i; });
    onChange(updated);
  };

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (index: number) => {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const updated = [...images];
    const [moved] = updated.splice(dragIndex, 1);
    updated.splice(index, 0, moved);
    // First image is always primary
    updated.forEach((img, i) => {
      img.sort_order = i;
      img.is_primary = i === 0;
    });
    onChange(updated);
    setDragIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm">รูปภาพสินค้า ({images.length}/{maxImages})</Label>
      
      {/* Image Grid */}
      <div className="grid grid-cols-3 gap-2">
        {images.map((img, index) => (
          <div
            key={`${img.image_url}-${index}`}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={() => handleDrop(index)}
            onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
            className={`relative group aspect-square rounded-lg border-2 overflow-hidden cursor-grab active:cursor-grabbing transition-all ${
              dragOverIndex === index ? 'border-primary scale-105' : 
              img.is_primary ? 'border-primary' : 'border-border'
            } ${dragIndex === index ? 'opacity-50' : ''}`}
          >
            <img 
              src={img.image_url} 
              alt={`Product ${index + 1}`}
              className="w-full h-full object-cover"
            />
            
            {/* Primary Badge */}
            {img.is_primary && (
              <div className="absolute top-1 left-1 bg-primary text-primary-foreground rounded px-1.5 py-0.5 text-[9px] font-medium flex items-center gap-0.5">
                <Star className="w-2.5 h-2.5 fill-current" />
                หลัก
              </div>
            )}

            {/* Drag handle */}
            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <GripVertical className="w-4 h-4 text-white drop-shadow-md" />
            </div>

            {/* Hover Overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-end justify-center gap-1 pb-1.5">
              {!img.is_primary && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-6 text-[10px] px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => { e.stopPropagation(); setPrimary(index); }}
                >
                  <Star className="w-3 h-3 mr-0.5" />
                  ตั้งเป็นหลัก
                </Button>
              )}
              <Button
                type="button"
                size="icon"
                variant="destructive"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => { e.stopPropagation(); removeImage(index); }}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ))}

        {/* Upload Slot */}
        {images.length < maxImages && (
          <label className="cursor-pointer aspect-square">
            <div className="w-full h-full flex flex-col items-center justify-center border-2 border-dashed rounded-lg hover:bg-muted/50 transition-colors">
              {isUploading ? (
                <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <Upload className="w-5 h-5 text-muted-foreground mb-1" />
                  <span className="text-[10px] text-muted-foreground">เพิ่มรูป</span>
                </>
              )}
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={handleUpload}
              disabled={isUploading}
              className="hidden"
            />
          </label>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground">
        ลากเพื่อจัดลำดับ • รูปแรกจะเป็นรูปหลัก • JPG, PNG, WEBP (ไม่เกิน 5MB)
      </p>
    </div>
  );
}
