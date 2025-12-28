import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { 
  Package, 
  ShoppingCart, 
  TrendingUp, 
  Clock,
  RefreshCw,
  Users,
  MessageSquare,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  BoxIcon,
  CheckCircle2,
  Truck,
  XCircle
} from 'lucide-react';
import { Order } from '@/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Area, AreaChart } from 'recharts';

interface DashboardStats {
  totalOrders: number;
  pendingOrders: number;
  confirmedOrders: number;
  shippedOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  todayOrders: number;
  thisWeekOrders: number;
  thisMonthOrders: number;
  totalRevenue: number;
  todayRevenue: number;
  thisWeekRevenue: number;
  thisMonthRevenue: number;
  totalProducts: number;
  activeProducts: number;
  lowStockProducts: number;
  totalConversations: number;
  todayConversations: number;
}

interface OrdersByPlatform {
  platform: string;
  count: number;
  revenue: number;
}

interface DailyRevenue {
  date: string;
  revenue: number;
  orders: number;
}

interface MonthlyRevenue {
  month: string;
  revenue: number;
  orders: number;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function AdminDashboard() {
  const { user, isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalOrders: 0,
    pendingOrders: 0,
    confirmedOrders: 0,
    shippedOrders: 0,
    deliveredOrders: 0,
    cancelledOrders: 0,
    todayOrders: 0,
    thisWeekOrders: 0,
    thisMonthOrders: 0,
    totalRevenue: 0,
    todayRevenue: 0,
    thisWeekRevenue: 0,
    thisMonthRevenue: 0,
    totalProducts: 0,
    activeProducts: 0,
    lowStockProducts: 0,
    totalConversations: 0,
    todayConversations: 0
  });
  const [ordersByPlatform, setOrdersByPlatform] = useState<OrdersByPlatform[]>([]);
  const [dailyRevenue, setDailyRevenue] = useState<DailyRevenue[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthlyRevenue[]>([]);
  const [reportView, setReportView] = useState<'daily' | 'monthly'>('daily');
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/admin');
    }
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchData();
      
      const channel = supabase
        .channel('dashboard-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => fetchData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_conversations' }, () => fetchData())
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, isAdmin]);

  const fetchData = async () => {
    setIsLoadingData(true);
    
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch all orders
    const { data: allOrders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      setIsLoadingData(false);
      return;
    }

    const typedOrders = (allOrders || []).map(order => ({
      ...order,
      platform: order.platform as 'web' | 'line' | 'facebook',
      status: order.status as 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
    }));

    // Fetch products
    const { data: products } = await supabase.from('products').select('*');
    
    // Fetch conversations
    const { data: conversations } = await supabase.from('chat_conversations').select('*');

    // Calculate stats
    const todayOrders = typedOrders.filter(o => o.created_at.startsWith(todayStr));
    const thisWeekOrders = typedOrders.filter(o => new Date(o.created_at) >= new Date(weekAgo));
    const thisMonthOrders = typedOrders.filter(o => new Date(o.created_at) >= new Date(monthAgo));
    
    const pendingOrders = typedOrders.filter(o => o.status === 'pending');
    const confirmedOrders = typedOrders.filter(o => o.status === 'confirmed');
    const shippedOrders = typedOrders.filter(o => o.status === 'shipped');
    const deliveredOrders = typedOrders.filter(o => o.status === 'delivered');
    const cancelledOrders = typedOrders.filter(o => o.status === 'cancelled');

    const totalRevenue = typedOrders.filter(o => o.status !== 'cancelled').reduce((sum, o) => sum + Number(o.total_amount), 0);
    const todayRevenue = todayOrders.filter(o => o.status !== 'cancelled').reduce((sum, o) => sum + Number(o.total_amount), 0);
    const thisWeekRevenue = thisWeekOrders.filter(o => o.status !== 'cancelled').reduce((sum, o) => sum + Number(o.total_amount), 0);
    const thisMonthRevenue = thisMonthOrders.filter(o => o.status !== 'cancelled').reduce((sum, o) => sum + Number(o.total_amount), 0);

    const activeProducts = (products || []).filter(p => p.is_active);
    const lowStockProducts = (products || []).filter(p => p.stock <= 5 && p.is_active);

    const todayConversations = (conversations || []).filter(c => c.created_at.startsWith(todayStr));

    setStats({
      totalOrders: typedOrders.length,
      pendingOrders: pendingOrders.length,
      confirmedOrders: confirmedOrders.length,
      shippedOrders: shippedOrders.length,
      deliveredOrders: deliveredOrders.length,
      cancelledOrders: cancelledOrders.length,
      todayOrders: todayOrders.length,
      thisWeekOrders: thisWeekOrders.length,
      thisMonthOrders: thisMonthOrders.length,
      totalRevenue,
      todayRevenue,
      thisWeekRevenue,
      thisMonthRevenue,
      totalProducts: (products || []).length,
      activeProducts: activeProducts.length,
      lowStockProducts: lowStockProducts.length,
      totalConversations: (conversations || []).length,
      todayConversations: todayConversations.length
    });

    // Orders by platform
    const platformStats = ['web', 'line', 'facebook'].map(platform => {
      const platformOrders = typedOrders.filter(o => o.platform === platform);
      return {
        platform: platform === 'web' ? 'เว็บไซต์' : platform === 'line' ? 'LINE' : 'Facebook',
        count: platformOrders.length,
        revenue: platformOrders.filter(o => o.status !== 'cancelled').reduce((sum, o) => sum + Number(o.total_amount), 0)
      };
    });
    setOrdersByPlatform(platformStats);

    // Daily revenue for last 7 days
    const last7Days: DailyRevenue[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      const dayOrders = typedOrders.filter(o => o.created_at.startsWith(dateStr) && o.status !== 'cancelled');
      last7Days.push({
        date: date.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric' }),
        revenue: dayOrders.reduce((sum, o) => sum + Number(o.total_amount), 0),
        orders: dayOrders.length
      });
    }
    setDailyRevenue(last7Days);

    // Monthly revenue for last 6 months
    const last6Months: MonthlyRevenue[] = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = date.getMonth();
      const monthOrders = typedOrders.filter(o => {
        const orderDate = new Date(o.created_at);
        return orderDate.getFullYear() === year && 
               orderDate.getMonth() === month && 
               o.status !== 'cancelled';
      });
      last6Months.push({
        month: date.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' }),
        revenue: monthOrders.reduce((sum, o) => sum + Number(o.total_amount), 0),
        orders: monthOrders.length
      });
    }
    setMonthlyRevenue(last6Months);

    setOrders(typedOrders.slice(0, 5));
    setIsLoadingData(false);
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

  const orderStatusData = [
    { name: 'รอดำเนินการ', value: stats.pendingOrders, color: '#f59e0b' },
    { name: 'ยืนยันแล้ว', value: stats.confirmedOrders, color: '#3b82f6' },
    { name: 'จัดส่งแล้ว', value: stats.shippedOrders, color: '#8b5cf6' },
    { name: 'สำเร็จ', value: stats.deliveredOrders, color: '#10b981' },
    { name: 'ยกเลิก', value: stats.cancelledOrders, color: '#ef4444' },
  ].filter(d => d.value > 0);

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
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <AdminLayout title="Dashboard">
      {/* Main Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-6">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-4 lg:pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs lg:text-sm text-muted-foreground">รายได้วันนี้</p>
                <p className="text-xl lg:text-2xl font-bold text-primary">฿{stats.todayRevenue.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.todayOrders} ออเดอร์
                </p>
              </div>
              <div className="p-2 lg:p-3 rounded-full bg-primary/10">
                <DollarSign className="w-5 h-5 lg:w-6 lg:h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <CardContent className="p-4 lg:pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs lg:text-sm text-muted-foreground">รายได้เดือนนี้</p>
                <p className="text-xl lg:text-2xl font-bold text-green-600">฿{stats.thisMonthRevenue.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.thisMonthOrders} ออเดอร์
                </p>
              </div>
              <div className="p-2 lg:p-3 rounded-full bg-green-500/10">
                <TrendingUp className="w-5 h-5 lg:w-6 lg:h-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20">
          <CardContent className="p-4 lg:pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs lg:text-sm text-muted-foreground">รอดำเนินการ</p>
                <p className="text-xl lg:text-2xl font-bold text-orange-600">{stats.pendingOrders}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  ออเดอร์ใหม่
                </p>
              </div>
              <div className="p-2 lg:p-3 rounded-full bg-orange-500/10">
                <Clock className="w-5 h-5 lg:w-6 lg:h-6 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <CardContent className="p-4 lg:pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs lg:text-sm text-muted-foreground">แชทวันนี้</p>
                <p className="text-xl lg:text-2xl font-bold text-blue-600">{stats.todayConversations}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  ทั้งหมด {stats.totalConversations}
                </p>
              </div>
              <div className="p-2 lg:p-3 rounded-full bg-blue-500/10">
                <MessageSquare className="w-5 h-5 lg:w-6 lg:h-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Order Status Cards - Horizontal scroll on mobile */}
      <div className="mb-6 -mx-4 px-4 lg:mx-0 lg:px-0">
        <div className="flex lg:grid lg:grid-cols-5 gap-2 lg:gap-4 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide">
          <Card className="p-2 lg:p-4 text-center flex-shrink-0 w-[72px] lg:w-auto">
            <Clock className="w-4 h-4 lg:w-6 lg:h-6 mx-auto text-yellow-500 mb-0.5 lg:mb-1" />
            <p className="text-base lg:text-xl font-bold">{stats.pendingOrders}</p>
            <p className="text-[9px] lg:text-xs text-muted-foreground leading-tight">รอดำเนินการ</p>
          </Card>
          <Card className="p-2 lg:p-4 text-center flex-shrink-0 w-[72px] lg:w-auto">
            <CheckCircle2 className="w-4 h-4 lg:w-6 lg:h-6 mx-auto text-blue-500 mb-0.5 lg:mb-1" />
            <p className="text-base lg:text-xl font-bold">{stats.confirmedOrders}</p>
            <p className="text-[9px] lg:text-xs text-muted-foreground leading-tight">ยืนยันแล้ว</p>
          </Card>
          <Card className="p-2 lg:p-4 text-center flex-shrink-0 w-[72px] lg:w-auto">
            <Truck className="w-4 h-4 lg:w-6 lg:h-6 mx-auto text-purple-500 mb-0.5 lg:mb-1" />
            <p className="text-base lg:text-xl font-bold">{stats.shippedOrders}</p>
            <p className="text-[9px] lg:text-xs text-muted-foreground leading-tight">จัดส่งแล้ว</p>
          </Card>
          <Card className="p-2 lg:p-4 text-center flex-shrink-0 w-[72px] lg:w-auto">
            <Package className="w-4 h-4 lg:w-6 lg:h-6 mx-auto text-green-500 mb-0.5 lg:mb-1" />
            <p className="text-base lg:text-xl font-bold">{stats.deliveredOrders}</p>
            <p className="text-[9px] lg:text-xs text-muted-foreground leading-tight">สำเร็จ</p>
          </Card>
          <Card className="p-2 lg:p-4 text-center flex-shrink-0 w-[72px] lg:w-auto">
            <XCircle className="w-4 h-4 lg:w-6 lg:h-6 mx-auto text-red-500 mb-0.5 lg:mb-1" />
            <p className="text-base lg:text-xl font-bold">{stats.cancelledOrders}</p>
            <p className="text-[9px] lg:text-xs text-muted-foreground leading-tight">ยกเลิก</p>
          </Card>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-3 gap-3 lg:gap-4 mb-6">
        {/* Revenue Chart with Tabs */}
        <Card className="lg:col-span-2">
          <CardHeader className="p-3 lg:p-6 pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle className="text-sm lg:text-lg">
                  {reportView === 'daily' ? 'รายได้รายวัน' : 'รายได้รายเดือน'}
                </CardTitle>
                <CardDescription className="text-xs lg:text-sm">
                  {reportView === 'daily' 
                    ? `7 วันล่าสุด • ฿${stats.thisWeekRevenue.toLocaleString()}`
                    : `6 เดือนล่าสุด • ฿${stats.totalRevenue.toLocaleString()}`
                  }
                </CardDescription>
              </div>
              <div className="flex gap-1 bg-muted rounded-lg p-0.5">
                <Button 
                  variant={reportView === 'daily' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs px-3"
                  onClick={() => setReportView('daily')}
                >
                  รายวัน
                </Button>
                <Button 
                  variant={reportView === 'monthly' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs px-3"
                  onClick={() => setReportView('monthly')}
                >
                  รายเดือน
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-3 lg:p-6 pt-0">
            <div className="h-[180px] lg:h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                {reportView === 'daily' ? (
                  <AreaChart data={dailyRevenue} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 9 }} />
                    <YAxis className="text-xs" tick={{ fontSize: 9 }} tickFormatter={(v) => `฿${(v/1000).toFixed(0)}K`} width={45} />
                    <Tooltip 
                      formatter={(value: number, name: string) => [
                        name === 'orders' ? `${value} ออเดอร์` : `฿${value.toLocaleString()}`,
                        name === 'orders' ? 'จำนวน' : 'รายได้'
                      ]}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontSize: '12px' }}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorRevenue)" strokeWidth={2} />
                  </AreaChart>
                ) : (
                  <BarChart data={monthlyRevenue} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" tick={{ fontSize: 9 }} />
                    <YAxis className="text-xs" tick={{ fontSize: 9 }} tickFormatter={(v) => `฿${(v/1000).toFixed(0)}K`} width={45} />
                    <Tooltip 
                      formatter={(value: number, name: string) => [
                        name === 'orders' ? `${value} ออเดอร์` : `฿${value.toLocaleString()}`,
                        name === 'orders' ? 'จำนวน' : 'รายได้'
                      ]}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontSize: '12px' }}
                    />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="orders" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
            {/* Summary stats below chart */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-4 border-t">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">วันนี้</p>
                <p className="text-sm font-bold text-primary">฿{stats.todayRevenue.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">{stats.todayOrders} ออเดอร์</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">สัปดาห์นี้</p>
                <p className="text-sm font-bold text-blue-600">฿{stats.thisWeekRevenue.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">{stats.thisWeekOrders} ออเดอร์</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">เดือนนี้</p>
                <p className="text-sm font-bold text-green-600">฿{stats.thisMonthRevenue.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">{stats.thisMonthOrders} ออเดอร์</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">ทั้งหมด</p>
                <p className="text-sm font-bold text-purple-600">฿{stats.totalRevenue.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">{stats.totalOrders} ออเดอร์</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Platform Distribution */}
        <Card>
          <CardHeader className="p-3 lg:p-6 pb-2">
            <CardTitle className="text-sm lg:text-lg">ออเดอร์ตามช่องทาง</CardTitle>
            <CardDescription className="text-xs lg:text-sm">รวม {stats.totalOrders} ออเดอร์</CardDescription>
          </CardHeader>
          <CardContent className="p-3 lg:p-6 pt-0">
            <div className="space-y-3 lg:space-y-4">
              {ordersByPlatform.map((item, index) => (
                <div key={item.platform} className="space-y-1.5 lg:space-y-2">
                  <div className="flex items-center justify-between text-xs lg:text-sm">
                    <span className="flex items-center gap-1.5 lg:gap-2">
                      <span className="text-sm lg:text-base">{index === 0 ? '🌐' : index === 1 ? '🟢' : '🔵'}</span>
                      {item.platform}
                    </span>
                    <span className="font-medium">{item.count}</span>
                  </div>
                  <Progress 
                    value={stats.totalOrders > 0 ? (item.count / stats.totalOrders) * 100 : 0} 
                    className="h-1.5 lg:h-2"
                  />
                  <p className="text-[10px] lg:text-xs text-muted-foreground text-right">
                    ฿{item.revenue.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid lg:grid-cols-2 gap-3 lg:gap-4">
        {/* Recent Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-3 lg:p-6 py-3 lg:py-4">
            <div>
              <CardTitle className="text-sm lg:text-lg">ออเดอร์ล่าสุด</CardTitle>
              <CardDescription className="text-xs lg:text-sm">5 รายการล่าสุด</CardDescription>
            </div>
            <div className="flex gap-1 lg:gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={fetchData} disabled={isLoadingData}>
                <RefreshCw className={`w-4 h-4 ${isLoadingData ? 'animate-spin' : ''}`} />
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs lg:text-sm px-2 lg:px-3" asChild>
                <Link to="/admin/orders">ดูทั้งหมด</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0 lg:p-6 lg:pt-0">
            {orders.length === 0 ? (
              <div className="text-center py-6 lg:py-8 text-muted-foreground">
                <Package className="w-10 h-10 lg:w-12 lg:h-12 mx-auto mb-3 lg:mb-4 opacity-50" />
                <p className="text-sm lg:text-base">ยังไม่มีออเดอร์</p>
              </div>
            ) : (
              <div className="space-y-1.5 lg:space-y-2 px-3 lg:px-0 pb-3 lg:pb-4">
                {orders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-2 lg:p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 lg:gap-3 min-w-0">
                      <span className="text-base lg:text-xl flex-shrink-0">{getPlatformIcon(order.platform)}</span>
                      <div className="min-w-0">
                        <p className="font-medium text-xs lg:text-sm truncate">{order.order_number}</p>
                        <p className="text-[10px] lg:text-xs text-muted-foreground truncate">{order.customer_name}</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <div className="scale-90 lg:scale-100 origin-right">{getStatusBadge(order.status)}</div>
                      <p className="text-xs lg:text-sm font-semibold mt-0.5 lg:mt-1">฿{Number(order.total_amount).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card>
          <CardHeader className="p-3 lg:p-6 pb-2">
            <CardTitle className="text-sm lg:text-lg">สรุปข้อมูลสำคัญ</CardTitle>
            <CardDescription className="text-xs lg:text-sm">ภาพรวมระบบ</CardDescription>
          </CardHeader>
          <CardContent className="p-3 lg:p-6 pt-0 space-y-3 lg:space-y-4">
            <div className="grid grid-cols-2 gap-2 lg:gap-4">
              <div className="p-2.5 lg:p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-1.5 lg:gap-2 mb-1 lg:mb-2">
                  <BoxIcon className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-primary" />
                  <span className="text-xs lg:text-sm font-medium">สินค้า</span>
                </div>
                <p className="text-xl lg:text-2xl font-bold">{stats.activeProducts}</p>
                <p className="text-[10px] lg:text-xs text-muted-foreground">สินค้าที่ใช้งาน</p>
              </div>
              <div className="p-2.5 lg:p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-1.5 lg:gap-2 mb-1 lg:mb-2">
                  <Package className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-orange-500" />
                  <span className="text-xs lg:text-sm font-medium">สต็อกต่ำ</span>
                </div>
                <p className="text-xl lg:text-2xl font-bold text-orange-500">{stats.lowStockProducts}</p>
                <p className="text-[10px] lg:text-xs text-muted-foreground">เหลือ ≤5 ชิ้น</p>
              </div>
              <div className="p-2.5 lg:p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-1.5 lg:gap-2 mb-1 lg:mb-2">
                  <ShoppingCart className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-green-500" />
                  <span className="text-xs lg:text-sm font-medium">ออเดอร์ทั้งหมด</span>
                </div>
                <p className="text-xl lg:text-2xl font-bold">{stats.totalOrders}</p>
                <p className="text-[10px] lg:text-xs text-muted-foreground">ตั้งแต่เริ่มต้น</p>
              </div>
              <div className="p-2.5 lg:p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-1.5 lg:gap-2 mb-1 lg:mb-2">
                  <TrendingUp className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-blue-500" />
                  <span className="text-xs lg:text-sm font-medium">รายได้รวม</span>
                </div>
                <p className="text-lg lg:text-xl font-bold">฿{(stats.totalRevenue / 1000).toFixed(1)}K</p>
                <p className="text-[10px] lg:text-xs text-muted-foreground">ยอดขายทั้งหมด</p>
              </div>
            </div>

            {stats.lowStockProducts > 0 && (
              <div className="p-2.5 lg:p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <div className="flex items-center gap-1.5 lg:gap-2 text-orange-600">
                  <Package className="w-3.5 h-3.5 lg:w-4 lg:h-4 flex-shrink-0" />
                  <span className="text-xs lg:text-sm font-medium">แจ้งเตือน: สินค้า {stats.lowStockProducts} รายการสต็อกใกล้หมด</span>
                </div>
                <Button variant="link" className="p-0 h-auto text-orange-600 text-[10px] lg:text-xs" asChild>
                  <Link to="/admin/products">ดูรายละเอียด →</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
