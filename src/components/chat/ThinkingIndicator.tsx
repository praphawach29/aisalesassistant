import { Bot } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ThinkingIndicator() {
  return (
    <div className="flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-md">
        <Bot className="w-4 h-4" />
      </div>
      
      <div className="flex flex-col gap-2 max-w-[80%]">
        <div className="rounded-2xl px-5 py-3.5 bg-gradient-to-r from-muted to-muted/80 rounded-bl-md shadow-sm border border-border/50">
          <div className="flex gap-1.5 items-center">
            <span className="w-3 h-3 bg-primary rounded-full animate-bounce shadow-sm" style={{ animationDelay: '0ms', animationDuration: '0.6s' }} />
            <span className="w-3 h-3 bg-primary/80 rounded-full animate-bounce shadow-sm" style={{ animationDelay: '150ms', animationDuration: '0.6s' }} />
            <span className="w-3 h-3 bg-primary/60 rounded-full animate-bounce shadow-sm" style={{ animationDelay: '300ms', animationDuration: '0.6s' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
