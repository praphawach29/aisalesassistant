import { useState, useEffect } from 'react';
import { MessageCircle, X, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatWindow } from './ChatWindow';
import { cn } from '@/lib/utils';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import avatarWoman1 from '@/assets/avatars/avatar-woman-1.png';

interface ChatWidgetProps {
  position?: 'bottom-right' | 'bottom-left';
  primaryColor?: string;
}

export function ChatWidget({ 
  position = 'bottom-right',
  primaryColor
}: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [botAvatarUrl, setBotAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchAvatarUrl = async () => {
      const { data } = await supabase
        .from('ai_settings')
        .select('avatar_url')
        .eq('is_active', true)
        .maybeSingle();
      
      if (data?.avatar_url) {
        setBotAvatarUrl(data.avatar_url);
      }
    };
    fetchAvatarUrl();
  }, []);

  const botAvatar = botAvatarUrl || avatarWoman1;

  const positionClasses = {
    'bottom-right': 'right-4 bottom-4',
    'bottom-left': 'left-4 bottom-4',
  };

  return (
    <div className={cn('fixed z-50', positionClasses[position])}>
      {/* Chat Window */}
      {isOpen && (
        <div 
          className={cn(
            'mb-4 bg-card rounded-2xl shadow-2xl border transition-all duration-300',
            isMinimized ? 'h-14 w-[340px]' : 'h-[500px] w-[340px]'
          )}
          style={primaryColor ? { '--primary': primaryColor } as React.CSSProperties : undefined}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-3 bg-primary text-primary-foreground">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              <span className="font-semibold text-sm">AI Sales Assistant</span>
            </div>
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
                onClick={() => setIsMinimized(!isMinimized)}
              >
                <Minimize2 className="w-4 h-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
                onClick={() => setIsOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Chat Content */}
          {!isMinimized && (
            <div className="h-[calc(100%-56px)] overflow-hidden">
              <ChatWindow />
            </div>
          )}
        </div>
      )}

      {/* Toggle Button */}
      {isOpen ? (
        <Button
          onClick={() => {
            setIsOpen(false);
            setIsMinimized(false);
          }}
          className="h-14 w-14 rounded-full shadow-lg transition-all duration-300 hover:scale-110"
          style={primaryColor ? { backgroundColor: primaryColor } as React.CSSProperties : undefined}
        >
          <X className="w-6 h-6" />
        </Button>
      ) : (
        <button
          onClick={() => {
            setIsOpen(true);
            setIsMinimized(false);
          }}
          className="h-14 w-14 rounded-full shadow-lg transition-all duration-300 hover:scale-110 overflow-hidden border-2 border-primary"
        >
          <Avatar className="h-full w-full">
            <AvatarImage src={botAvatar} alt="Chat Assistant" className="object-cover" />
            <AvatarFallback className="bg-primary text-primary-foreground">
              <MessageCircle className="w-6 h-6" />
            </AvatarFallback>
          </Avatar>
        </button>
      )}
    </div>
  );
}
