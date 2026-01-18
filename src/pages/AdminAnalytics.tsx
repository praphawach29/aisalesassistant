import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { th } from "date-fns/locale";
import { 
  Eye, 
  ShoppingCart, 
  Package, 
  MessageSquare, 
  TrendingUp,
  Users,
  BarChart3,
  Activity
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from "recharts";

interface AnalyticsEvent {
  id: string;
  event_type: string;
  event_data: Record<string, unknown> | null;
  session_id: string | null;
  platform_user_id: string | null;
  user_id: string | null;
  platform: string | null;
  page_url: string | null;
  referrer: string | null;
  device_type: string | null;
  browser: string | null;
  created_at: string;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const AdminAnalytics = () => {
  const [dateRange, setDateRange] = useState("7");

  const startDate = startOfDay(subDays(new Date(), parseInt(dateRange)));
  const endDate = endOfDay(new Date());

  const { data: analyticsEvents, isLoading } = useQuery({
    queryKey: ['analytics-events', dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('analytics_events')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as AnalyticsEvent[];
    }
  });

  // Calculate stats
  const stats = {
    pageViews: analyticsEvents?.filter(e => e.event_type === 'page_view').length || 0,
    productViews: analyticsEvents?.filter(e => e.event_type === 'product_view').length || 0,
    addToCarts: analyticsEvents?.filter(e => e.event_type === 'add_to_cart').length || 0,
    ordersCompleted: analyticsEvents?.filter(e => e.event_type === 'order_complete').length || 0,
    chatStarted: analyticsEvents?.filter(e => e.event_type === 'chat_started').length || 0,
    chatMessages: analyticsEvents?.filter(e => e.event_type === 'chat_message').length || 0,
    uniqueSessions: new Set(analyticsEvents?.map(e => e.session_id)).size || 0,
  };

  // Calculate daily trends
  const dailyTrends = analyticsEvents?.reduce((acc, event) => {
    const date = format(new Date(event.created_at), 'MM/dd');
    if (!acc[date]) {
      acc[date] = { date, pageViews: 0, productViews: 0, orders: 0, chats: 0 };
    }
    if (event.event_type === 'page_view') acc[date].pageViews++;
    if (event.event_type === 'product_view') acc[date].productViews++;
    if (event.event_type === 'order_complete') acc[date].orders++;
    if (event.event_type === 'chat_started') acc[date].chats++;
    return acc;
  }, {} as Record<string, { date: string; pageViews: number; productViews: number; orders: number; chats: number }>) || {};

  const trendData = Object.values(dailyTrends);

  // Device type distribution
  const deviceDistribution = analyticsEvents?.reduce((acc, event) => {
    const device = event.device_type || 'unknown';
    acc[device] = (acc[device] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  const deviceData = Object.entries(deviceDistribution).map(([name, value]) => ({
    name: name === 'mobile' ? 'มือถือ' : name === 'tablet' ? 'แท็บเล็ต' : name === 'desktop' ? 'คอมพิวเตอร์' : 'ไม่ทราบ',
    value
  }));

  // Event type distribution
  const eventDistribution = analyticsEvents?.reduce((acc, event) => {
    acc[event.event_type] = (acc[event.event_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  const eventData = Object.entries(eventDistribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, value]) => ({
      name: name.replace(/_/g, ' '),
      value
    }));

  // Top pages
  const pageDistribution = analyticsEvents
    ?.filter(e => e.event_type === 'page_view' && e.page_url)
    .reduce((acc, event) => {
      const page = event.page_url || '/';
      acc[page] = (acc[page] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

  const topPages = Object.entries(pageDistribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <AdminLayout title="Analytics">
      <div className="space-y-6">
        {/* Date Range Filter */}
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Analytics Dashboard
          </h2>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="ช่วงเวลา" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">วันนี้</SelectItem>
              <SelectItem value="7">7 วันล่าสุด</SelectItem>
              <SelectItem value="14">14 วันล่าสุด</SelectItem>
              <SelectItem value="30">30 วันล่าสุด</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Page Views</p>
                  <p className="text-2xl font-bold">{stats.pageViews.toLocaleString()}</p>
                </div>
                <Eye className="h-8 w-8 text-primary opacity-80" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Product Views</p>
                  <p className="text-2xl font-bold">{stats.productViews.toLocaleString()}</p>
                </div>
                <Package className="h-8 w-8 text-blue-500 opacity-80" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Add to Cart</p>
                  <p className="text-2xl font-bold">{stats.addToCarts.toLocaleString()}</p>
                </div>
                <ShoppingCart className="h-8 w-8 text-green-500 opacity-80" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Orders</p>
                  <p className="text-2xl font-bold">{stats.ordersCompleted.toLocaleString()}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-orange-500 opacity-80" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Chat Sessions</p>
                  <p className="text-2xl font-bold">{stats.chatStarted.toLocaleString()}</p>
                </div>
                <MessageSquare className="h-8 w-8 text-purple-500 opacity-80" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Chat Messages</p>
                  <p className="text-2xl font-bold">{stats.chatMessages.toLocaleString()}</p>
                </div>
                <Activity className="h-8 w-8 text-pink-500 opacity-80" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Unique Sessions</p>
                  <p className="text-2xl font-bold">{stats.uniqueSessions.toLocaleString()}</p>
                </div>
                <Users className="h-8 w-8 text-teal-500 opacity-80" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Conversion Rate</p>
                  <p className="text-2xl font-bold">
                    {stats.pageViews > 0 
                      ? ((stats.ordersCompleted / stats.pageViews) * 100).toFixed(2) 
                      : 0}%
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-emerald-500 opacity-80" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily Trends */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Daily Trends</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  กำลังโหลด...
                </div>
              ) : trendData.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  ไม่มีข้อมูล
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Line type="monotone" dataKey="pageViews" stroke="hsl(var(--primary))" name="Page Views" />
                    <Line type="monotone" dataKey="productViews" stroke="#3b82f6" name="Product Views" />
                    <Line type="monotone" dataKey="orders" stroke="#10b981" name="Orders" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Event Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Event Types</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  กำลังโหลด...
                </div>
              ) : eventData.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  ไม่มีข้อมูล
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={eventData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" className="text-xs" />
                    <YAxis dataKey="name" type="category" width={100} className="text-xs" />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Device Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Device Types</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  กำลังโหลด...
                </div>
              ) : deviceData.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  ไม่มีข้อมูล
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={deviceData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {deviceData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Pages */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Top Pages</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  กำลังโหลด...
                </div>
              ) : topPages.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  ไม่มีข้อมูล
                </div>
              ) : (
                <div className="space-y-4">
                  {topPages.map(([page, count], index) => (
                    <div key={page} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="w-6 h-6 rounded-full flex items-center justify-center">
                          {index + 1}
                        </Badge>
                        <span className="text-sm truncate max-w-[200px]">{page}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-muted rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full" 
                            style={{ width: `${(count / topPages[0][1]) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm text-muted-foreground w-12 text-right">
                          {count}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminAnalytics;
