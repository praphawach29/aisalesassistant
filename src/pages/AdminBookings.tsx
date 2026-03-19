import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format, addDays, parse } from 'date-fns';
import { th } from 'date-fns/locale';
import { CalendarIcon, Plus, Clock, Users, CheckCircle, XCircle, RefreshCw, Trash2, Settings2 } from 'lucide-react';

interface BookingSettings {
  id: string;
  is_enabled: boolean;
  service_name: string;
  slot_duration_minutes: number;
  max_advance_days: number;
  auto_confirm: boolean;
  business_hours: any[];
  booking_rules: string | null;
}

interface BookingSlot {
  id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  max_bookings: number;
  current_bookings: number;
  is_available: boolean;
  note: string | null;
}

interface Booking {
  id: string;
  booking_number: string;
  customer_name: string;
  customer_phone: string;
  platform: string;
  booking_date: string;
  booking_time: string;
  service_name: string;
  notes: string | null;
  status: string;
  created_at: string;
}

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: '⏳ รอยืนยัน', variant: 'secondary' },
  confirmed: { label: '✅ ยืนยันแล้ว', variant: 'default' },
  completed: { label: '🎉 เสร็จสิ้น', variant: 'outline' },
  cancelled: { label: '❌ ยกเลิก', variant: 'destructive' },
  no_show: { label: '🚫 ไม่มา', variant: 'destructive' },
};

const DAY_NAMES = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

export default function AdminBookings() {
  const [settings, setSettings] = useState<BookingSettings | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [slots, setSlots] = useState<BookingSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [slotDate, setSlotDate] = useState<Date>(new Date());
  const [slotStartTime, setSlotStartTime] = useState('09:00');
  const [slotEndTime, setSlotEndTime] = useState('10:00');
  const [slotMaxBookings, setSlotMaxBookings] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateFromDate, setGenerateFromDate] = useState<Date>(new Date());
  const [generateDays, setGenerateDays] = useState(7);

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    fetchSlots();
  }, [selectedDate]);

  const fetchAll = async () => {
    setIsLoading(true);
    await Promise.all([fetchSettings(), fetchBookings(), fetchSlots()]);
    setIsLoading(false);
  };

  const fetchSettings = async () => {
    const { data } = await supabase.from('booking_settings').select('*').limit(1).maybeSingle();
    if (data) setSettings(data as BookingSettings);
  };

  const fetchBookings = async () => {
    const { data } = await supabase
      .from('bookings')
      .select('*')
      .order('booking_date', { ascending: false })
      .order('booking_time', { ascending: true })
      .limit(100);
    if (data) setBookings(data as Booking[]);
  };

  const fetchSlots = async () => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const { data } = await supabase
      .from('booking_slots')
      .select('*')
      .eq('slot_date', dateStr)
      .order('start_time');
    if (data) setSlots(data as BookingSlot[]);
  };

  const updateSettings = async (updates: Partial<BookingSettings>) => {
    if (!settings) return;
    const { error } = await supabase.from('booking_settings').update(updates).eq('id', settings.id);
    if (error) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    } else {
      setSettings({ ...settings, ...updates });
      toast({ title: 'บันทึกสำเร็จ' });
    }
  };

  const addSlot = async () => {
    const dateStr = format(slotDate, 'yyyy-MM-dd');
    const { error } = await supabase.from('booking_slots').insert({
      slot_date: dateStr,
      start_time: slotStartTime,
      end_time: slotEndTime,
      max_bookings: slotMaxBookings,
    });
    if (error) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'เพิ่ม slot สำเร็จ' });
      setSelectedDate(slotDate);
      fetchSlots();
    }
  };

  const generateSlots = async () => {
    if (!settings) return;
    setIsGenerating(true);
    const slotsToInsert: any[] = [];
    const duration = settings.slot_duration_minutes;
    const businessHours = settings.business_hours as any[];

    for (let d = 0; d < generateDays; d++) {
      const date = addDays(generateFromDate, d);
      const dayOfWeek = date.getDay();
      const dayConfig = businessHours.find((h: any) => h.day === dayOfWeek);
      if (!dayConfig) continue;

      const dateStr = format(date, 'yyyy-MM-dd');
      const openParts = dayConfig.open.split(':').map(Number);
      const closeParts = dayConfig.close.split(':').map(Number);
      const openMinutes = openParts[0] * 60 + openParts[1];
      const closeMinutes = closeParts[0] * 60 + closeParts[1];

      for (let m = openMinutes; m + duration <= closeMinutes; m += duration) {
        const startH = String(Math.floor(m / 60)).padStart(2, '0');
        const startM = String(m % 60).padStart(2, '0');
        const endTotal = m + duration;
        const endH = String(Math.floor(endTotal / 60)).padStart(2, '0');
        const endM = String(endTotal % 60).padStart(2, '0');

        slotsToInsert.push({
          slot_date: dateStr,
          start_time: `${startH}:${startM}`,
          end_time: `${endH}:${endM}`,
          max_bookings: 1,
        });
      }
    }

    if (slotsToInsert.length === 0) {
      toast({ title: 'ไม่มี slot ที่จะสร้าง', description: 'ตรวจสอบเวลาทำการ', variant: 'destructive' });
      setIsGenerating(false);
      return;
    }

    // Use upsert to avoid duplicate errors
    const { error } = await supabase.from('booking_slots').upsert(slotsToInsert, { onConflict: 'slot_date,start_time,end_time' });
    if (error) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `สร้าง ${slotsToInsert.length} slots สำเร็จ` });
      fetchSlots();
    }
    setIsGenerating(false);
  };

  const deleteSlot = async (id: string) => {
    await supabase.from('booking_slots').delete().eq('id', id);
    fetchSlots();
  };

  const updateBookingStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('bookings').update({ status }).eq('id', id);
    if (error) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'อัปเดตสถานะสำเร็จ' });
      fetchBookings();
    }
  };

  if (isLoading) {
    return (
      <AdminLayout title="ระบบจองคิว">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="ระบบจองคิว">
      <Tabs defaultValue="bookings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="bookings">📋 รายการจอง</TabsTrigger>
          <TabsTrigger value="slots">📅 จัดการ Slot</TabsTrigger>
          <TabsTrigger value="settings">⚙️ ตั้งค่า</TabsTrigger>
        </TabsList>

        {/* Bookings Tab */}
        <TabsContent value="bookings" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{bookings.filter(b => b.status === 'pending').length}</p>
                <p className="text-sm text-muted-foreground">รอยืนยัน</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-green-600">{bookings.filter(b => b.status === 'confirmed').length}</p>
                <p className="text-sm text-muted-foreground">ยืนยันแล้ว</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-blue-600">{bookings.filter(b => b.status === 'completed').length}</p>
                <p className="text-sm text-muted-foreground">เสร็จสิ้น</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-red-600">{bookings.filter(b => b.status === 'cancelled').length}</p>
                <p className="text-sm text-muted-foreground">ยกเลิก</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>รายการจองทั้งหมด</CardTitle>
            </CardHeader>
            <CardContent>
              {bookings.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">ยังไม่มีการจอง</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>เลขจอง</TableHead>
                        <TableHead>ลูกค้า</TableHead>
                        <TableHead>วันที่</TableHead>
                        <TableHead>เวลา</TableHead>
                        <TableHead>บริการ</TableHead>
                        <TableHead>สถานะ</TableHead>
                        <TableHead>จัดการ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bookings.map(booking => (
                        <TableRow key={booking.id}>
                          <TableCell className="font-mono text-sm">{booking.booking_number}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{booking.customer_name}</p>
                              <p className="text-xs text-muted-foreground">{booking.customer_phone}</p>
                            </div>
                          </TableCell>
                          <TableCell>{booking.booking_date}</TableCell>
                          <TableCell>{booking.booking_time}</TableCell>
                          <TableCell>{booking.service_name}</TableCell>
                          <TableCell>
                            <Badge variant={STATUS_MAP[booking.status]?.variant || 'secondary'}>
                              {STATUS_MAP[booking.status]?.label || booking.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {booking.status === 'pending' && (
                                <>
                                  <Button size="sm" variant="outline" onClick={() => updateBookingStatus(booking.id, 'confirmed')}>
                                    <CheckCircle className="w-3 h-3 mr-1" /> ยืนยัน
                                  </Button>
                                  <Button size="sm" variant="destructive" onClick={() => updateBookingStatus(booking.id, 'cancelled')}>
                                    <XCircle className="w-3 h-3 mr-1" /> ยกเลิก
                                  </Button>
                                </>
                              )}
                              {booking.status === 'confirmed' && (
                                <Button size="sm" variant="outline" onClick={() => updateBookingStatus(booking.id, 'completed')}>
                                  🎉 เสร็จสิ้น
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Slots Tab */}
        <TabsContent value="slots" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Calendar */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">เลือกวันที่</CardTitle>
              </CardHeader>
              <CardContent>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => d && setSelectedDate(d)}
                  className="pointer-events-auto"
                />
              </CardContent>
            </Card>

            {/* Slots for selected date */}
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">
                    Slots วันที่ {format(selectedDate, 'd MMMM yyyy', { locale: th })}
                  </CardTitle>
                  <CardDescription>{slots.length} slots</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {slots.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">ไม่มี slot สำหรับวันนี้</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {slots.map(slot => (
                      <div key={slot.id} className={cn(
                        "p-3 rounded-lg border text-center relative group",
                        slot.is_available ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800" : "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800"
                      )}>
                        <p className="font-mono font-medium">{slot.start_time} - {slot.end_time}</p>
                        <p className="text-xs text-muted-foreground">{slot.current_bookings}/{slot.max_bookings} จอง</p>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100"
                          onClick={() => deleteSlot(slot.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Add slot & generate slots */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">เพิ่ม Slot ทีละรายการ</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>วันที่</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(slotDate, 'd MMMM yyyy', { locale: th })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={slotDate} onSelect={(d) => d && setSlotDate(d)} className="pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>เริ่ม</Label>
                    <Input type="time" value={slotStartTime} onChange={e => setSlotStartTime(e.target.value)} />
                  </div>
                  <div>
                    <Label>สิ้นสุด</Label>
                    <Input type="time" value={slotEndTime} onChange={e => setSlotEndTime(e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label>จำนวนที่จองได้</Label>
                  <Input type="number" min={1} value={slotMaxBookings} onChange={e => setSlotMaxBookings(Number(e.target.value))} />
                </div>
                <Button onClick={addSlot} className="w-full">
                  <Plus className="w-4 h-4 mr-2" /> เพิ่ม Slot
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">สร้าง Slot อัตโนมัติ</CardTitle>
                <CardDescription>สร้าง slot ตามเวลาทำการที่ตั้งไว้</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>เริ่มจากวันที่</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(generateFromDate, 'd MMMM yyyy', { locale: th })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={generateFromDate} onSelect={(d) => d && setGenerateFromDate(d)} className="pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>จำนวนวัน</Label>
                  <Input type="number" min={1} max={60} value={generateDays} onChange={e => setGenerateDays(Number(e.target.value))} />
                </div>
                <Button onClick={generateSlots} disabled={isGenerating} className="w-full">
                  {isGenerating ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Clock className="w-4 h-4 mr-2" />}
                  สร้าง Slot อัตโนมัติ
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          {settings && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings2 className="w-5 h-5" />
                    ตั้งค่าระบบจอง
                  </CardTitle>
                  <CardDescription>เปิด/ปิดระบบจอง และกำหนดค่าต่างๆ</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50">
                    <div>
                      <p className="font-medium">เปิดใช้งานระบบจอง</p>
                      <p className="text-sm text-muted-foreground">เมื่อเปิด บอทจะรองรับการจองคิว/นัดหมาย</p>
                    </div>
                    <Switch
                      checked={settings.is_enabled}
                      onCheckedChange={(v) => updateSettings({ is_enabled: v })}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label>ชื่อบริการ</Label>
                      <Input
                        value={settings.service_name}
                        onChange={e => setSettings({ ...settings, service_name: e.target.value })}
                        onBlur={() => updateSettings({ service_name: settings.service_name })}
                        placeholder="เช่น ทำผม, นวดแผนไทย, ตรวจสุขภาพ"
                      />
                    </div>
                    <div>
                      <Label>ระยะเวลาต่อ slot (นาที)</Label>
                      <Input
                        type="number"
                        value={settings.slot_duration_minutes}
                        onChange={e => setSettings({ ...settings, slot_duration_minutes: Number(e.target.value) })}
                        onBlur={() => updateSettings({ slot_duration_minutes: settings.slot_duration_minutes })}
                      />
                    </div>
                    <div>
                      <Label>จองล่วงหน้าได้สูงสุด (วัน)</Label>
                      <Input
                        type="number"
                        value={settings.max_advance_days}
                        onChange={e => setSettings({ ...settings, max_advance_days: Number(e.target.value) })}
                        onBlur={() => updateSettings({ max_advance_days: settings.max_advance_days })}
                      />
                    </div>
                    <div className="flex items-center gap-3 pt-6">
                      <Switch
                        checked={settings.auto_confirm}
                        onCheckedChange={(v) => updateSettings({ auto_confirm: v })}
                      />
                      <Label>ยืนยันอัตโนมัติ (ไม่ต้องรอแอดมิน)</Label>
                    </div>
                  </div>

                  <div>
                    <Label>กฎการจอง / หมายเหตุ (แสดงให้ลูกค้าเห็น)</Label>
                    <Textarea
                      value={settings.booking_rules || ''}
                      onChange={e => setSettings({ ...settings, booking_rules: e.target.value })}
                      onBlur={() => updateSettings({ booking_rules: settings.booking_rules })}
                      placeholder="เช่น กรุณามาก่อนนัด 15 นาที, ยกเลิกล่วงหน้า 24 ชม."
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>เวลาทำการ</CardTitle>
                  <CardDescription>กำหนดวันและเวลาที่เปิดให้จอง (ใช้สำหรับสร้าง slot อัตโนมัติ)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[0, 1, 2, 3, 4, 5, 6].map(day => {
                      const hours = (settings.business_hours as any[]) || [];
                      const dayConfig = hours.find((h: any) => h.day === day);
                      const isOpen = !!dayConfig;

                      return (
                        <div key={day} className="flex items-center gap-3 flex-wrap">
                          <Switch
                            checked={isOpen}
                            onCheckedChange={(checked) => {
                              let newHours = [...hours];
                              if (checked) {
                                newHours.push({ day, open: '09:00', close: '18:00' });
                              } else {
                                newHours = newHours.filter((h: any) => h.day !== day);
                              }
                              updateSettings({ business_hours: newHours });
                            }}
                          />
                          <span className="w-20 text-sm font-medium">{DAY_NAMES[day]}</span>
                          {isOpen && (
                            <div className="flex items-center gap-2">
                              <Input
                                type="time"
                                className="w-32"
                                value={dayConfig?.open || '09:00'}
                                onChange={e => {
                                  const newHours = hours.map((h: any) =>
                                    h.day === day ? { ...h, open: e.target.value } : h
                                  );
                                  updateSettings({ business_hours: newHours });
                                }}
                              />
                              <span className="text-muted-foreground">-</span>
                              <Input
                                type="time"
                                className="w-32"
                                value={dayConfig?.close || '18:00'}
                                onChange={e => {
                                  const newHours = hours.map((h: any) =>
                                    h.day === day ? { ...h, close: e.target.value } : h
                                  );
                                  updateSettings({ business_hours: newHours });
                                }}
                              />
                            </div>
                          )}
                          {!isOpen && <span className="text-sm text-muted-foreground">ปิดทำการ</span>}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
