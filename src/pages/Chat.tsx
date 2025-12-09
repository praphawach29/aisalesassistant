import { ChatWindow } from '@/components/chat/ChatWindow';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Settings } from 'lucide-react';

export default function Chat() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-6 max-w-2xl h-screen flex flex-col">
        <header className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            AI Sales Assistant
          </h1>
          <Link to="/admin">
            <Button variant="ghost" size="icon">
              <Settings className="w-5 h-5" />
            </Button>
          </Link>
        </header>
        
        <div className="flex-1 bg-card rounded-2xl shadow-xl overflow-hidden border">
          <ChatWindow />
        </div>
      </div>
    </div>
  );
}
