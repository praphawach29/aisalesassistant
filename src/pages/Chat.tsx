import { ChatWindow } from '@/components/chat/ChatWindow';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Settings } from 'lucide-react';

export default function Chat() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-6 max-w-2xl h-screen flex flex-col">
        <header className="flex items-center justify-between mb-2 sm:mb-4 px-2 sm:px-0">
          <h1 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            AI Sales Assistant
          </h1>
          <Link to="/admin">
            <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10">
              <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
          </Link>
        </header>
        
        <div className="flex-1 bg-card rounded-xl sm:rounded-2xl shadow-xl overflow-hidden border min-h-0">
          <ChatWindow />
        </div>
      </div>
    </div>
  );
}
