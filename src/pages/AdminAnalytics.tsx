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

  // Use server-side RPC for aggregated stats (efficient)
  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['analytics-summary', dateRange],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_analytics_summary', {
        p_start_date: startDate.toISOString(),
        p_end_date: endDate.toISOString(),
      });
      if (error) throw error;
      return data as Record<string, unknown>;
    }
  });

  const { data: trendRaw, isLoading: trendLoading } = useQuery({
    queryKey: ['analytics-trend', dateRange],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_analytics_daily_trend', {
        p_start_date: startDate.toISOString(),
        p_end_date: endDate.toISOString(),
      });
      if (error) throw error;
      return data as Array<{ date: string; page_views: number; product_views: number; orders: number; chats: number }>;
    }
  });

  // Fetch raw events for top pages (minimal fields only)
  const { data: pageEvents } = useQuery({
    queryKey: ['analytics-pages', dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('analytics_events')
        .select('page_url, device_type, event_type')
        .eq('event_type', 'page_view')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());
      if (error) throw error;
      return data;
    }
  });

  const isLoading = summaryLoading || trendLoading;

  const stats = {
    pageViews: (summaryData?.page_views as number) || 0,
    productViews: (summaryData?.product_views as number) || 0,
    addToCarts: (summaryData?.add_to_cart as number) || 0,
    ordersCompleted: (summaryData?.orders_completed as number) || 0,
    chatStarted: (summaryData?.chats_started as number) || 0,
    chatMessages: (summaryData?.chat_messages as number) || 0,
    uniqueSessions: (summaryData?.unique_sessions as number) || 0,
  };

  const trendData = (trendRaw || []).map(d => ({
    date: format(new Date(d.date), 'MM/dd'),
    pageViews: d.page_views,
    productViews: d.product_views,
    orders: d.orders,
    chats: d.chats,
  }));

  // Device type distribution from summary RPC
  const deviceDistribution = (summaryData?.by_device as Record<string, number>) || {};
  const deviceData = Object.entries(deviceDistribution).map(([name, value]) => ({
    name: name === 'mobile' ? 'มือถือ' : name === 'tablet' ? 'แท็บเล็ต' : name === 'desktop' ? 'คอมพิวเตอร์' : 'ไม่ทราบ',
    value: value as number,
  }));

  // Event type distribution from platform data
  const platformDistribution = (summaryData?.by_platform as Record<string, number>) || {};
  const eventData = Object.entries(platformDistribution)
    .map(([name, value]) => ({ name, value: value as number }));

  // Top pages from lightweight fetch
  const pageDistribution = (pageEvents || []).reduce((acc, event) => {
    const page = event.page_url || '/';
    acc[page] = (acc[page] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

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
