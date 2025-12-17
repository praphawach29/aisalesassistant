import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MessageCircle, X } from 'lucide-react';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { cn } from '@/lib/utils';

export default function EmbedWidget() {
  const [searchParams] = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);

  // Get customization from URL params
  const position = searchParams.get('position') || 'bottom-right';
  const primaryColor = searchParams.get('color') || '#6366f1';
  const buttonSize = parseInt(searchParams.get('buttonSize') || '56');
  const windowWidth = parseInt(searchParams.get('width') || '380');
  const windowHeight = parseInt(searchParams.get('height') || '500');
  const autoOpen = searchParams.get('autoOpen') === 'true';
  const botName = searchParams.get('botName') || 'AI Sales Assistant';
  const welcomeMessage = searchParams.get('welcomeMessage') || '';

  useEffect(() => {
    if (autoOpen) {
      setIsOpen(true);
    }
  }, [autoOpen]);

  const positionClasses = {
    'bottom-right': 'right-4 bottom-4',
    'bottom-left': 'left-4 bottom-4',
  };

  return (
    <div className={cn('fixed z-50', positionClasses[position as keyof typeof positionClasses] || 'right-4 bottom-4')}>
      {/* Chat Window */}
      {isOpen && (
        <div 
          className="mb-4 bg-card rounded-2xl shadow-2xl border overflow-hidden transition-all duration-300 animate-in slide-in-from-bottom-5"
          style={{ 
            width: `${windowWidth}px`, 
            height: `${windowHeight}px` 
          }}
        >
          {/* Header */}
          <div 
            className="flex items-center justify-between p-3 text-white"
            style={{ backgroundColor: primaryColor }}
          >
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              <span className="font-semibold">{botName}</span>
            </div>
            <button 
              className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
              onClick={() => setIsOpen(false)}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Chat Content */}
          <div className="h-[calc(100%-56px)]">
            <ChatWindow welcomeMessage={welcomeMessage} />
          </div>
        </div>
      )}

      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'rounded-full shadow-lg transition-all duration-300 hover:scale-110 flex items-center justify-center text-white',
          isOpen && 'rotate-90'
        )}
        style={{ 
          backgroundColor: primaryColor,
          width: `${buttonSize}px`,
          height: `${buttonSize}px`
        }}
      >
        {isOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <MessageCircle className="w-6 h-6" />
        )}
      </button>
    </div>
  );
}
