import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Package, 
  ShoppingCart, 
  TrendingUp, 
  Clock,
  LogOut,
  MessageCircle,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { Order } from '@/types';

export default function AdminDashboard() {
  const { user, isAdmin, isLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    todayOrders: 0,
    totalRevenue: 0
  });
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/admin');
    }
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchData();
      
      // Subscribe to realtime updates
      const channel = supabase
        .channel('orders-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'orders' },
          () => fetchData()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, isAdmin]);

  const fetchData = async () => {
    setIsLoadingData(true);
    
    const { data: ordersData, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching orders:', error);
      setIsLoadingData(false);
      return;
    }

    const typedOrders = (ordersData || []).map(order => ({
      ...order,
      platform: order.platform as 'web' | 'line' | 'facebook',
      status: order.status as 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
    }));
    setOrders(typedOrders);

    // Calculate stats
    const today = new Date().toISOString().split('T')[0];
    const todayOrders = typedOrders.filter(o => o.created_at.startsWith(today));
    const pendingOrders = typedOrders.filter(o => o.status === 'pending');
    const totalRevenue = typedOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);

    setStats({
      totalOrders: typedOrders.length,
      pendingOrders: pendingOrders.length,
      todayOrders: todayOrders.length,
      totalRevenue
    });

    setIsLoadingData(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin');
  };

  const getStatusBadge = (status: Order['status']) => {
    const variants: Record<Order['status'], { variant: 'default' | 'secondary' | 'destructive' | 'outline', label: string }> = {
      pending: { variant: 'secondary', label: 'รอดำเนินการ' },
      confirmed: { variant: 'default', label: 'ยืนยันแล้ว' },
      shipped: { variant: 'outline', label: 'จัดส่งแล้ว' },
      delivered: { variant: 'default', label: 'ส่งสำเร็จ' },
      cancelled: { variant: 'destructive', label: 'ยกเลิก' }
    };
    const { variant, label } = variants[status];
    return <Badge variant={variant}>{label}</Badge>;
  };

  const getPlatformIcon = (platform: Order['platform']) => {
    switch (platform) {
      case 'line': return '🟢';
      case 'facebook': return '🔵';
      default: return '🌐';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin && !isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
            <p className="text-muted-foreground mb-4">
              คุณยังไม่ได้รับสิทธิ์ Admin กรุณาติดต่อผู้ดูแลระบบ
            </p>
            <Button onClick={handleSignOut} variant="outline">
              ออกจากระบบ
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">Admin Dashboard</h1>
          <div className="flex items-center gap-2">
            <Link to="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <MessageCircle className="w-4 h-4" />
                Chatbot
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={handleSignOut} className="gap-2">
              <LogOut className="w-4 h-4" />
              ออกจากระบบ
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <ShoppingCart className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">ออเดอร์ทั้งหมด</p>
                  <p className="text-2xl font-bold">{stats.totalOrders}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-orange-500/10">
                  <Clock className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">รอดำเนินการ</p>
                  <p className="text-2xl font-bold">{stats.pendingOrders}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-green-500/10">
                  <Package className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">วันนี้</p>
                  <p className="text-2xl font-bold">{stats.todayOrders}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-blue-500/10">
                  <TrendingUp className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">รายได้</p>
                  <p className="text-2xl font-bold">฿{stats.totalRevenue.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>ออเดอร์ล่าสุด</CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchData} disabled={isLoadingData}>
              <RefreshCw className={`w-4 h-4 ${isLoadingData ? 'animate-spin' : ''}`} />
            </Button>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>ยังไม่มีออเดอร์</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {orders.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-2xl">{getPlatformIcon(order.platform)}</span>
                        <div>
                          <p className="font-medium">{order.order_number}</p>
                          <p className="text-sm text-muted-foreground">{order.customer_name}</p>
                          <p className="text-xs text-muted-foreground">{order.customer_phone}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        {getStatusBadge(order.status)}
                        <p className="text-lg font-semibold mt-1">฿{Number(order.total_amount).toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString('th-TH')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
