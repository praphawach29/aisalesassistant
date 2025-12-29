import { useState, FormEvent, KeyboardEvent, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Paperclip, X, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

interface ChatInputProps {
  onSend: (message: string, imageFile?: File) => void;
  isLoading?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, isLoading, placeholder = 'พิมพ์ข้อความ...' }: ChatInputProps) {
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if ((input.trim() || selectedImage) && !isLoading) {
      onSend(input.trim(), selectedImage || undefined);
      setInput('');
      setSelectedImage(null);
      setImagePreview(null);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleAttachClick = () => {
    console.log('Attach button clicked');
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('File input changed', e.target.files);
    const file = e.target.files?.[0];
    if (!file) {
      console.log('No file selected');
      return;
    }

    console.log('File selected:', file.name, file.type, file.size);

    // Validate file type - accept common image formats
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];
    const isValidType = validTypes.includes(file.type.toLowerCase()) || file.type.startsWith('image/');
    
    if (!isValidType) {
      toast.error('กรุณาเลือกไฟล์รูปภาพเท่านั้น (JPG, PNG, GIF, WEBP)');
      e.target.value = '';
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('ไฟล์ใหญ่เกินไป (สูงสุด 5MB)');
      e.target.value = '';
      return;
    }

    setSelectedImage(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      console.log('Preview created');
      setImagePreview(reader.result as string);
    };
    reader.onerror = () => {
      console.error('Error reading file');
      toast.error('ไม่สามารถอ่านไฟล์ได้');
    };
    reader.readAsDataURL(file);
    
    toast.success('เลือกรูปภาพแล้ว');
  };

  const removeSelectedImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      {/* Image Preview */}
      {imagePreview && (
        <div className="relative inline-block">
          <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-border">
            <img 
              src={imagePreview} 
              alt="สลิปโอนเงิน" 
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={removeSelectedImage}
              className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:bg-destructive/80 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">สลิปโอนเงิน</p>
        </div>
      )}
      
      <div className="flex gap-1.5 sm:gap-2 items-end">
        {/* Hidden file input - moved outside button for better mobile support */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
          aria-label="แนบไฟล์รูปภาพ"
        />
        
        {/* Attach button */}
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleAttachClick}
          disabled={isLoading}
          className="h-9 w-9 sm:h-11 sm:w-11 flex-shrink-0"
          title="แนบสลิปโอนเงิน"
        >
          {selectedImage ? (
            <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          ) : (
            <Paperclip className="w-4 h-4 sm:w-5 sm:h-5" />
          )}
        </Button>
        
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isLoading}
          rows={1}
          className="min-h-[36px] sm:min-h-[44px] max-h-32 resize-none text-sm sm:text-base"
        />
        <Button
          type="submit"
          size="icon"
          disabled={(!input.trim() && !selectedImage) || isLoading}
          className="h-9 w-9 sm:h-11 sm:w-11 flex-shrink-0"
        >
          <Send className="w-4 h-4 sm:w-5 sm:h-5" />
        </Button>
      </div>
    </form>
  );
}