import { cn } from '@/lib/utils';
import { ChatMessage } from '@/types';
import { Bot, User } from 'lucide-react';

interface ChatBubbleProps {
  message: ChatMessage;
}

export function ChatBubble({ message }: ChatBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={cn(
      'flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300',
      isUser ? 'flex-row-reverse' : 'flex-row'
    )}>
      <div className={cn(
        'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
        isUser ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
      )}>
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>
      
      <div className={cn(
        'max-w-[80%] rounded-2xl px-4 py-3',
        isUser
          ? 'bg-primary text-primary-foreground rounded-br-md'
          : 'bg-muted text-foreground rounded-bl-md'
      )}>
        <p className="text-sm whitespace-pre-wrap leading-relaxed">
          {message.content || (
            <span className="inline-flex gap-1">
              <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
