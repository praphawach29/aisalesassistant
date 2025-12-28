import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { NotificationBell } from './NotificationBell';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  MessageCircle,
  HelpCircle,
  Settings,
  ExternalLink,
  LogOut,
  Menu,
  ChevronLeft,
  Plug,
  Bell,
  MessageSquareText,
  Bot,
  Ticket,
  MapPin,
  Radio,
  Code,
  Globe,
  BookOpen,
  CreditCard
} from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
}

const menuItems = [
  { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/admin/orders', label: 'ออเดอร์', icon: ShoppingCart },
  { path: '/admin/payment-slips', label: 'สลิปโอนเงิน', icon: CreditCard },
  { path: '/admin/products', label: 'สินค้า', icon: Package },
  { path: '/admin/chats', label: 'แชท', icon: MessageCircle },
  { path: '/admin/faqs', label: 'FAQ', icon: HelpCircle },
  { path: '/admin/notifications', label: 'แจ้งเตือน', icon: Bell },
  { path: '/admin/templates', label: 'เทมเพลต', icon: MessageSquareText },
  { path: '/admin/ai-settings', label: 'ตั้งค่า AI', icon: Bot },
  { path: '/admin/coupons', label: 'คูปอง', icon: Ticket },
  { path: '/admin/addresses', label: 'ที่อยู่ลูกค้า', icon: MapPin },
  { path: '/admin/broadcast', label: 'Broadcast', icon: Radio },
  { path: '/admin/embed-code', label: 'Embed Code', icon: Code },
  { path: '/admin/web-scraping', label: 'Web Scraping', icon: Globe },
  { path: '/admin/knowledge-base', label: 'ฐานความรู้', icon: BookOpen },
  { path: '/admin/integrations', label: 'Integration', icon: Plug },
  { path: '/admin/settings', label: 'ตั้งค่า', icon: Settings },
];

export function AdminLayout({ children, title }: AdminLayoutProps) {
  const { signOut } = useAuth();
  const location = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleSignOut = async () => {
    await signOut();
  };

  const NavContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className="flex flex-col h-full">
      {/* Logo/Brand */}
      <div className={cn(
        "flex items-center border-b h-16 px-4",
        isCollapsed && !isMobile ? "justify-center" : "justify-between"
      )}>
        {(!isCollapsed || isMobile) && (
          <span className="font-bold text-lg">Admin Panel</span>
        )}
        {!isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="h-8 w-8"
          >
            <ChevronLeft className={cn(
              "h-4 w-4 transition-transform",
              isCollapsed && "rotate-180"
            )} />
          </Button>
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-4">
        <nav className="space-y-1 px-2">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => isMobile && setIsMobileOpen(false)}
              >
                <div className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground",
                  isCollapsed && !isMobile && "justify-center"
                )}>
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  {(!isCollapsed || isMobile) && (
                    <span className="font-medium">{item.label}</span>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Bottom Actions */}
      <div className="border-t p-4 space-y-2">
        <Link to="/" onClick={() => isMobile && setIsMobileOpen(false)}>
          <Button
            variant="outline"
            className={cn(
              "w-full gap-2",
              isCollapsed && !isMobile && "px-2"
            )}
          >
            <ExternalLink className="w-4 h-4" />
            {(!isCollapsed || isMobile) && <span>ไปหน้า Chatbot</span>}
          </Button>
        </Link>
        <Button
          variant="ghost"
          onClick={handleSignOut}
          className={cn(
            "w-full gap-2 text-destructive hover:text-destructive hover:bg-destructive/10",
            isCollapsed && !isMobile && "px-2"
          )}
        >
          <LogOut className="w-4 h-4" />
          {(!isCollapsed || isMobile) && <span>ออกจากระบบ</span>}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Desktop Sidebar */}
      <aside className={cn(
        "fixed left-0 top-0 z-40 h-screen border-r bg-card hidden lg:block transition-all duration-300",
        isCollapsed ? "w-16" : "w-64"
      )}>
        <NavContent />
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden sticky top-0 z-50 border-b bg-card/95 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 h-14">
          <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72">
              <NavContent isMobile />
            </SheetContent>
          </Sheet>
          
          <h1 className="font-semibold text-lg">{title}</h1>
          
          <NotificationBell />
        </div>
      </header>

      {/* Main Content */}
      <main className={cn(
        "transition-all duration-300",
        isCollapsed ? "lg:pl-16" : "lg:pl-64"
      )}>
        {/* Desktop Header */}
        <header className="hidden lg:block sticky top-0 z-30 border-b bg-card/95 backdrop-blur-sm">
          <div className="flex items-center justify-between px-6 h-16">
            <h1 className="text-xl font-bold">{title}</h1>
            <NotificationBell />
          </div>
        </header>

        {/* Page Content */}
        <div className="p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
