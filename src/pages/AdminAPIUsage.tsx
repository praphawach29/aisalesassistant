import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { format, subDays, startOfDay, endOfDay, differenceInDays } from "date-fns";
import { th } from "date-fns/locale";
import {
  Zap,
  TrendingUp,
  TrendingDown,
  DollarSign,
  MessageSquare,
  Activity,
  AlertTriangle,
  BarChart3
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell
} from "recharts";

// Cost constants (Gemini 2.5 Flash via Lovable AI)
const COST_PER_INPUT_TOKEN = 0.075 / 1_000_000;  // $0.075 per 1M input tokens
const COST_PER_OUTPUT_TOKEN = 0.30 / 1_000_000;   // $0.30 per 1M output tokens
const AVG_INPUT_TOKENS_PER_MSG = 800;
const AVG_OUTPUT_TOKENS_PER_MSG = 400;
const THB_RATE = 35;

const COST_PER_MESSAGE_USD =
  (AVG_INPUT_TOKENS_PER_MSG * COST_PER_INPUT_TOKEN) +
  (AVG_OUTPUT_TOKENS_PER_MSG * COST_PER_OUTPUT_TOKEN);
const COST_PER_MESSAGE_THB = COST_PER_MESSAGE_USD * THB_RATE;

const COLORS = ['hsl(var(--primary))', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const AdminAPIUsage = () => {
  const [dateRange, setDateRange] = useState("30");

  const startDate = startOfDay(subDays(new Date(), parseInt(dateRange)));
  const endDate = endOfDay(new Date());
  const days = differenceInDays(endDate, startDate) || 1;

  // Use server-side RPC for aggregated API usage stats
  const { data: usageData, isLoading: loadingChats } = useQuery({
    queryKey: ['api-usage-stats', dateRange],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_api_usage_stats', {
        p_start_date: startDate.toISOString(),
        p_end_date: endDate.toISOString(),
      });
      if (error) throw error;
      return data as Record<string, unknown>;
    }
  });

  const stats = useMemo(() => {
    const totalMessages = (usageData?.total_messages as number) || 0;
    const totalCostUSD = totalMessages * COST_PER_MESSAGE_USD;
    const totalCostTHB = totalMessages * COST_PER_MESSAGE_THB;
    const avgPerDay = totalMessages / days;
    const projectedMonthly = avgPerDay * 30;
    const projectedMonthlyCostTHB = projectedMonthly * COST_PER_MESSAGE_THB;

    return { totalMessages, totalCostUSD, totalCostTHB, avgPerDay, projectedMonthly, projectedMonthlyCostTHB };
  }, [usageData, days]);

  // Daily usage chart data from RPC
  const dailyData = useMemo(() => {
    const raw = (usageData?.daily_usage as Array<{ date: string; messages: number }>) || [];
    return raw.map(d => ({
      date: format(new Date(d.date), 'MM/dd'),
      messages: d.messages,
      cost: d.messages * COST_PER_MESSAGE_THB,
    }));
  }, [usageData]);

  // Platform breakdown from RPC
  const platformData = useMemo(() => {
    const raw = (usageData?.by_platform as Record<string, number>) || {};
    const labels: Record<string, string> = { web: 'เว็บ', line: 'LINE', facebook: 'Facebook', unknown: 'อื่นๆ' };
    return Object.entries(raw).map(([k, v]) => ({
      name: labels[k] || k,
      messages: v,
      cost: v * COST_PER_MESSAGE_THB,
    }));
  }, [usageData]);

  // Hourly distribution (empty - not available from RPC, show empty)
  const hourlyData = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => ({ hour: `${i.toString().padStart(2, '0')}:00`, messages: 0 }));
  }, []);

  const quotaUsed = (usageData?.quota_used as number) || 0;
  const quotaLimit = (usageData?.quota_limit as number) || null;
  const quotaPercent = quotaLimit ? (quotaUsed / quotaLimit) * 100 : 0;

  const isLoading = loadingChats;

  return (
    <AdminLayout title="API Usage & Cost">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            ต้นทุน API & การใช้งาน
          </h2>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">วันนี้</SelectItem>
              <SelectItem value="7">7 วันล่าสุด</SelectItem>
              <SelectItem value="14">14 วันล่าสุด</SelectItem>
              <SelectItem value="30">30 วันล่าสุด</SelectItem>
              <SelectItem value="90">90 วันล่าสุด</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Quota Alert */}
        {quotaLimit && quotaPercent > 80 && (
          <Card className="border-destructive bg-destructive/5">
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>
                <p className="font-medium text-destructive">
                  ใช้โควต้าไปแล้ว {quotaPercent.toFixed(0)}% ({quotaUsed.toLocaleString()}/{quotaLimit.toLocaleString()} ข้อความ)
                </p>
                <p className="text-sm text-muted-foreground">แนะนำอัปเกรดแพ็กเกจเพื่อเพิ่มโควต้า</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">AI ข้อความทั้งหมด</p>
                  <p className="text-2xl font-bold">{stats.totalMessages.toLocaleString()}</p>
                </div>
                <MessageSquare className="h-8 w-8 text-primary opacity-80" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">ต้นทุนรวม</p>
                  <p className="text-2xl font-bold">฿{stats.totalCostTHB.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">${stats.totalCostUSD.toFixed(4)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-500 opacity-80" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">เฉลี่ย/วัน</p>
                  <p className="text-2xl font-bold">{stats.avgPerDay.toFixed(1)}</p>
                  <p className="text-xs text-muted-foreground">ข้อความ</p>
                </div>
                <Activity className="h-8 w-8 text-blue-500 opacity-80" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">คาดการณ์/เดือน</p>
                  <p className="text-2xl font-bold">฿{stats.projectedMonthlyCostTHB.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">{stats.projectedMonthly.toFixed(0)} ข้อความ</p>
                </div>
                <TrendingUp className="h-8 w-8 text-orange-500 opacity-80" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quota Progress */}
        {quotaLimit && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">โควต้าข้อความรายเดือน</CardTitle>
              <CardDescription>
                ใช้ไป {quotaUsed.toLocaleString()} จาก {quotaLimit.toLocaleString()} ข้อความ
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Progress value={Math.min(quotaPercent, 100)} className="h-3" />
              <div className="flex justify-between mt-2 text-sm text-muted-foreground">
                <span>เหลือ {(quotaLimit - quotaUsed).toLocaleString()} ข้อความ</span>
                <span>{quotaPercent.toFixed(1)}%</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily Usage */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">การใช้งานรายวัน</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">กำลังโหลด...</div>
              ) : dailyData.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">ไม่มีข้อมูล</div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip
                      formatter={(value: number, name: string) =>
                        name === 'cost' ? [`฿${value.toFixed(2)}`, 'ต้นทุน'] : [value, 'ข้อความ']
                      }
                    />
                    <Bar dataKey="messages" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="messages" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Daily Cost Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">แนวโน้มต้นทุนรายวัน (฿)</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">กำลังโหลด...</div>
              ) : dailyData.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">ไม่มีข้อมูล</div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={v => `฿${v.toFixed(1)}`} />
                    <Tooltip formatter={(v: number) => [`฿${v.toFixed(2)}`, 'ต้นทุน']} />
                    <Line type="monotone" dataKey="cost" stroke="#10b981" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Platform Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">ต้นทุนตามแพลตฟอร์ม</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">กำลังโหลด...</div>
              ) : platformData.length === 0 ? (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">ไม่มีข้อมูล</div>
              ) : (
                <div className="space-y-4">
                  {platformData.sort((a, b) => b.messages - a.messages).map((p, i) => (
                    <div key={p.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="font-medium">{p.name}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground">{p.messages.toLocaleString()} ข้อความ</span>
                        <Badge variant="secondary">฿{p.cost.toFixed(2)}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Hourly Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">ช่วงเวลาที่ใช้งานมากที่สุด</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">กำลังโหลด...</div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={hourlyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="hour" className="text-xs" interval={3} />
                    <YAxis className="text-xs" />
                    <Tooltip formatter={(v: number) => [v, 'ข้อความ']} />
                    <Bar dataKey="messages" radius={[2, 2, 0, 0]}>
                      {hourlyData.map((_, i) => (
                        <Cell key={i} fill={`hsl(var(--primary) / ${0.4 + (hourlyData[i]?.messages || 0) / Math.max(...hourlyData.map(h => h.messages || 1)) * 0.6})`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Cost Reference */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              อัตราค่าใช้จ่ายอ้างอิง
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="font-medium mb-1">Gemini 2.5 Flash (Default)</p>
                <p className="text-muted-foreground">Input: $0.075 / 1M tokens</p>
                <p className="text-muted-foreground">Output: $0.30 / 1M tokens</p>
                <p className="mt-2 font-medium text-primary">≈ ฿{COST_PER_MESSAGE_THB.toFixed(4)} / ข้อความ</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="font-medium mb-1">ค่าเฉลี่ยต่อข้อความ</p>
                <p className="text-muted-foreground">Input: ~{AVG_INPUT_TOKENS_PER_MSG} tokens</p>
                <p className="text-muted-foreground">Output: ~{AVG_OUTPUT_TOKENS_PER_MSG} tokens</p>
                <p className="mt-2 font-medium text-primary">${COST_PER_MESSAGE_USD.toFixed(6)} USD</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="font-medium mb-1">ตัวอย่างต้นทุนรายเดือน</p>
                <p className="text-muted-foreground">500 ข้อความ: ฿{(500 * COST_PER_MESSAGE_THB).toFixed(2)}</p>
                <p className="text-muted-foreground">2,000 ข้อความ: ฿{(2000 * COST_PER_MESSAGE_THB).toFixed(2)}</p>
                <p className="text-muted-foreground">5,000 ข้อความ: ฿{(5000 * COST_PER_MESSAGE_THB).toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminAPIUsage;
