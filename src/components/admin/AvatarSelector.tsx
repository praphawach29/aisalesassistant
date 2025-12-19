import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import { Upload, Check, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Import all preset avatars
import avatarWoman1 from '@/assets/avatars/avatar-woman-1.png';
import avatarWoman2 from '@/assets/avatars/avatar-woman-2.png';
import avatarWoman3 from '@/assets/avatars/avatar-woman-3.png';
import avatarWoman4 from '@/assets/avatars/avatar-woman-4.png';
import avatarMan1 from '@/assets/avatars/avatar-man-1.png';
import avatarMan2 from '@/assets/avatars/avatar-man-2.png';
import avatarRobot1 from '@/assets/avatars/avatar-robot-1.png';
import avatarAnime1 from '@/assets/avatars/avatar-anime-1.png';
import avatarCat1 from '@/assets/avatars/avatar-cat-1.png';
import avatarAbstract1 from '@/assets/avatars/avatar-abstract-1.png';

interface AvatarSelectorProps {
  value: string | null;
  onChange: (url: string) => void;
}

interface PresetAvatar {
  id: string;
  src: string;
  label: string;
  category: 'female' | 'male' | 'character' | 'abstract';
}

const presetAvatars: PresetAvatar[] = [
  { id: 'woman-1', src: avatarWoman1, label: 'ผู้หญิง 1', category: 'female' },
  { id: 'woman-2', src: avatarWoman2, label: 'ผู้หญิง 2', category: 'female' },
  { id: 'woman-3', src: avatarWoman3, label: 'ผู้หญิง 3', category: 'female' },
  { id: 'woman-4', src: avatarWoman4, label: 'ผู้หญิง 4', category: 'female' },
  { id: 'man-1', src: avatarMan1, label: 'ผู้ชาย 1', category: 'male' },
  { id: 'man-2', src: avatarMan2, label: 'ผู้ชาย 2', category: 'male' },
  { id: 'robot-1', src: avatarRobot1, label: 'หุ่นยนต์', category: 'character' },
  { id: 'anime-1', src: avatarAnime1, label: 'อนิเมะ', category: 'character' },
  { id: 'cat-1', src: avatarCat1, label: 'แมว', category: 'character' },
  { id: 'abstract-1', src: avatarAbstract1, label: 'นามธรรม', category: 'abstract' },
];

const categories = [
  { id: 'female', label: 'ผู้หญิง' },
  { id: 'male', label: 'ผู้ชาย' },
  { id: 'character', label: 'ตัวการ์ตูน' },
  { id: 'abstract', label: 'นามธรรม' },
];

export function AvatarSelector({ value, onChange }: AvatarSelectorProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('female');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredAvatars = presetAvatars.filter(
    (avatar) => avatar.category === activeCategory
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('กรุณาเลือกไฟล์รูปภาพเท่านั้น');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('ไฟล์มีขนาดใหญ่เกินไป (สูงสุด 2MB)');
      return;
    }

    setIsUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `avatar-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      onChange(publicUrl);
      toast.success('อัปโหลดรูปภาพสำเร็จ');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('เกิดข้อผิดพลาดในการอัปโหลด');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const isSelected = (avatarSrc: string) => {
    return value === avatarSrc;
  };

  const isCustomAvatar = value && !presetAvatars.some(a => a.src === value);

  return (
    <div className="space-y-4">
      <Label>อวาต้าของ AI</Label>
      
      {/* Current Avatar Preview */}
      <div className="flex items-center gap-4">
        <Avatar className="w-16 h-16 border-2 border-primary">
          <AvatarImage src={value || avatarWoman1} alt="Current Avatar" />
          <AvatarFallback><User className="w-8 h-8" /></AvatarFallback>
        </Avatar>
        <div className="text-sm text-muted-foreground">
          {isCustomAvatar ? 'รูปที่อัปโหลดเอง' : 'อวาต้าสำเร็จรูป'}
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <Button
            key={cat.id}
            type="button"
            variant={activeCategory === cat.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveCategory(cat.id)}
          >
            {cat.label}
          </Button>
        ))}
      </div>

      {/* Preset Avatars Grid */}
      <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
        {filteredAvatars.map((avatar) => (
          <button
            key={avatar.id}
            type="button"
            onClick={() => onChange(avatar.src)}
            className={cn(
              'relative rounded-full overflow-hidden border-2 transition-all hover:scale-105',
              isSelected(avatar.src)
                ? 'border-primary ring-2 ring-primary ring-offset-2'
                : 'border-border hover:border-primary/50'
            )}
          >
            <Avatar className="w-full h-auto aspect-square">
              <AvatarImage src={avatar.src} alt={avatar.label} />
              <AvatarFallback>{avatar.label[0]}</AvatarFallback>
            </Avatar>
            {isSelected(avatar.src) && (
              <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                <Check className="w-6 h-6 text-primary" />
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Custom Upload */}
      <div className="pt-4 border-t">
        <Label className="text-sm mb-2 block">หรืออัปโหลดรูปของคุณเอง</Label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="w-full"
        >
          <Upload className="w-4 h-4 mr-2" />
          {isUploading ? 'กำลังอัปโหลด...' : 'อัปโหลดรูปภาพ'}
        </Button>
        <p className="text-xs text-muted-foreground mt-2">
          รองรับไฟล์ JPG, PNG ขนาดไม่เกิน 2MB
        </p>
      </div>
    </div>
  );
}
