import { useState } from 'react';
import { MessageCircle, X, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatWindow } from './ChatWindow';
import { cn } from '@/lib/utils';

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
            'mb-4 bg-card rounded-2xl shadow-2xl border overflow-hidden transition-all duration-300',
            isMinimized ? 'h-14' : 'h-[500px] w-[380px]'
          )}
          style={primaryColor ? { '--primary': primaryColor } as React.CSSProperties : undefined}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-3 bg-primary text-primary-foreground">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              <span className="font-semibold">AI Sales Assistant</span>
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
            <div className="h-[calc(100%-56px)]">
              <ChatWindow />
            </div>
          )}
        </div>
      )}

      {/* Toggle Button */}
      <Button
        onClick={() => {
          setIsOpen(!isOpen);
          setIsMinimized(false);
        }}
        className={cn(
          'h-14 w-14 rounded-full shadow-lg transition-all duration-300 hover:scale-110',
          isOpen && 'rotate-90'
        )}
        style={primaryColor ? { backgroundColor: primaryColor } as React.CSSProperties : undefined}
      >
        {isOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <MessageCircle className="w-6 h-6" />
        )}
      </Button>
    </div>
  );
}
