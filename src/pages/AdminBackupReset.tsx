import { useState, useEffect, useRef } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Download, Trash2, ShoppingCart, MessageSquare, Bell, Package, FileText, Settings, Brain, CreditCard, Database, RefreshCw, Upload, Clock, HardDrive, CalendarClock, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, addDays, addWeeks, addMonths, isPast, formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';

interface DataSection {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  tables: string[];
  color: string;
}

interface BackupInfo {
  lastBackupDate: string | null;
  lastBackupSize: number | null;
}

interface BackupSchedule {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  lastScheduledBackup: string | null;
}

const dataSections: DataSection[] = [
  {
    id: 'orders',
    name: 'ออเดอร์และการชำระเงิน',
    description: 'ออเดอร์, รายการสินค้า, สลิป',
    icon: <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5" />,
    tables: ['order_items', 'payment_slips', 'orders'],
    color: 'bg-blue-500'
  },
  {
    id: 'chats',
    name: 'การสนทนา',
    description: 'แชท, ตะกร้า, ที่อยู่',
    icon: <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5" />,
    tables: ['chat_messages', 'shopping_carts', 'customer_addresses', 'chat_conversations'],
    color: 'bg-green-500'
  },
  {
    id: 'notifications',
    name: 'การแจ้งเตือน',
    description: 'แจ้งเตือนแอดมิน',
    icon: <Bell className="h-4 w-4 sm:h-5 sm:w-5" />,
    tables: ['admin_notifications'],
    color: 'bg-yellow-500'
  },
  {
    id: 'products',
    name: 'สินค้า',
    description: 'สินค้า, ความสัมพันธ์',
    icon: <Package className="h-4 w-4 sm:h-5 sm:w-5" />,
    tables: ['related_products', 'products'],
    color: 'bg-purple-500'
  },
  {
    id: 'knowledge',
    name: 'ฐานความรู้',
    description: 'FAQ, Knowledge Base',
    icon: <Brain className="h-4 w-4 sm:h-5 sm:w-5" />,
    tables: ['faqs', 'knowledge_base', 'scraped_content'],
    color: 'bg-pink-500'
  },
  {
    id: 'coupons',
    name: 'คูปอง',
    description: 'คูปองส่วนลด',
    icon: <CreditCard className="h-4 w-4 sm:h-5 sm:w-5" />,
    tables: ['coupons'],
    color: 'bg-orange-500'
  },
  {
    id: 'broadcasts',
    name: 'Broadcast',
    description: 'ข้อความ, เทมเพลต',
    icon: <FileText className="h-4 w-4 sm:h-5 sm:w-5" />,
    tables: ['broadcast_messages', 'message_templates'],
    color: 'bg-cyan-500'
  },
  {
    id: 'ai_settings',
    name: 'ตั้งค่า AI',
    description: 'AI, บุคลิกภาพ, Keys',
    icon: <Settings className="h-4 w-4 sm:h-5 sm:w-5" />,
    tables: ['ai_settings', 'ai_personality_templates', 'ai_provider_keys'],
    color: 'bg-indigo-500'
  }
];

const BACKUP_INFO_KEY = 'backup_info';
const BACKUP_SCHEDULE_KEY = 'backup_schedule';

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getNextBackupDate(lastDate: string | null, frequency: 'daily' | 'weekly' | 'monthly'): Date {
  const baseDate = lastDate ? new Date(lastDate) : new Date();
  switch (frequency) {
    case 'daily':
      return addDays(baseDate, 1);
    case 'weekly':
      return addWeeks(baseDate, 1);
    case 'monthly':
      return addMonths(baseDate, 1);
  }
}

export default function AdminBackupReset() {
  const [loadingBackup, setLoadingBackup] = useState<string | null>(null);
  const [loadingReset, setLoadingReset] = useState<string | null>(null);
  const [loadingRestore, setLoadingRestore] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [backupInfos, setBackupInfos] = useState<Record<string, BackupInfo>>({});
  const [schedule, setSchedule] = useState<BackupSchedule>({
    enabled: false,
    frequency: 'weekly',
    lastScheduledBackup: null
  });
  const [showScheduleReminder, setShowScheduleReminder] = useState(false);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Load backup info and schedule from localStorage
  useEffect(() => {
    const storedInfo = localStorage.getItem(BACKUP_INFO_KEY);
    if (storedInfo) {
      try {
        setBackupInfos(JSON.parse(storedInfo));
      } catch (e) {
        console.error('Error parsing backup info:', e);
      }
    }

    const storedSchedule = localStorage.getItem(BACKUP_SCHEDULE_KEY);
    if (storedSchedule) {
      try {
        const parsed = JSON.parse(storedSchedule);
        setSchedule(parsed);
        
        // Check if backup is due
        if (parsed.enabled && parsed.lastScheduledBackup) {
          const nextBackup = getNextBackupDate(parsed.lastScheduledBackup, parsed.frequency);
          if (isPast(nextBackup)) {
            setShowScheduleReminder(true);
          }
        } else if (parsed.enabled && !parsed.lastScheduledBackup) {
          setShowScheduleReminder(true);
        }
      } catch (e) {
        console.error('Error parsing backup schedule:', e);
      }
    }

    fetchCounts();
  }, []);

  // Save schedule to localStorage
  const saveSchedule = (newSchedule: BackupSchedule) => {
    setSchedule(newSchedule);
    localStorage.setItem(BACKUP_SCHEDULE_KEY, JSON.stringify(newSchedule));
  };

  // Save backup info to localStorage
  const saveBackupInfo = (sectionId: string, size: number) => {
    const newInfo: BackupInfo = {
      lastBackupDate: new Date().toISOString(),
      lastBackupSize: size
    };
    const updated = { ...backupInfos, [sectionId]: newInfo };
    setBackupInfos(updated);
    localStorage.setItem(BACKUP_INFO_KEY, JSON.stringify(updated));
  };

  const fetchCounts = async () => {
    try {
      // Use server-side backup-export function for counts
      const { data, error } = await supabase.functions.invoke('backup-export', {
        body: { action: 'get_counts' },
      });
      if (error) throw error;
      if (data?.counts) {
        const newCounts: Record<string, number> = {};
        for (const section of dataSections) {
          newCounts[section.id] = section.tables.reduce(
            (sum, table) => sum + (data.counts[table] || 0),
            0
          );
        }
        setCounts(newCounts);
      }
    } catch (error) {
      console.error('Error fetching counts via edge function, falling back:', error);
      // Fallback to direct queries
      const newCounts: Record<string, number> = {};
      for (const section of dataSections) {
        let totalCount = 0;
        for (const table of section.tables) {
          try {
            const { count } = await supabase
              .from(table as any)
              .select('*', { count: 'exact', head: true });
            totalCount += count || 0;
          } catch (err) {
            console.error(`Error counting ${table}:`, err);
          }
        }
        newCounts[section.id] = totalCount;
      }
      setCounts(newCounts);
    }
  };

  const handleBackup = async (section: DataSection) => {
    setLoadingBackup(section.id);
    
    try {
      const backupData: Record<string, any[]> = {};
      
      for (const table of section.tables) {
        const { data, error } = await supabase
          .from(table as any)
          .select('*');
        
        if (error) {
          console.error(`Error fetching ${table}:`, error);
          continue;
        }
        
        backupData[table] = data || [];
      }

      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_${section.id}_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      saveBackupInfo(section.id, blob.size);
      toast.success(`สำรองข้อมูล ${section.name} สำเร็จ`);
    } catch (error) {
      console.error('Backup error:', error);
      toast.error('เกิดข้อผิดพลาดในการสำรองข้อมูล');
    } finally {
      setLoadingBackup(null);
    }
  };

  const handleRestore = async (section: DataSection, file: File) => {
    setLoadingRestore(section.id);
    
    try {
      const text = await file.text();
      const backupData = JSON.parse(text);
      
      const isValidFormat = section.tables.some(table => backupData[table] !== undefined);
      if (!isValidFormat) {
        toast.error('รูปแบบไฟล์ไม่ถูกต้อง');
        return;
      }

      let totalRestored = 0;
      let hasErrors = false;
      const reversedTables = [...section.tables].reverse();
      
      for (const table of reversedTables) {
        const tableData = backupData[table];
        if (!tableData || !Array.isArray(tableData) || tableData.length === 0) continue;

        const { error } = await supabase
          .from(table as any)
          .upsert(tableData, { onConflict: 'id' });
        
        if (error) {
          console.error(`Error restoring ${table}:`, error);
          hasErrors = true;
        } else {
          totalRestored += tableData.length;
        }
      }

      if (hasErrors) {
        toast.warning(`นำเข้าบางส่วนสำเร็จ (${totalRestored} รายการ)`);
      } else {
        toast.success(`นำเข้าสำเร็จ (${totalRestored} รายการ)`);
      }
      
      fetchCounts();
    } catch (error) {
      console.error('Restore error:', error);
      toast.error('เกิดข้อผิดพลาดในการนำเข้าข้อมูล');
    } finally {
      setLoadingRestore(null);
    }
  };

  const handleRestoreAll = async (file: File) => {
    setLoadingRestore('all');
    
    try {
      const text = await file.text();
      const allBackupData = JSON.parse(text);
      
      let totalRestored = 0;
      let hasErrors = false;

      for (const section of dataSections) {
        const sectionData = allBackupData[section.id];
        if (!sectionData) continue;

        const reversedTables = [...section.tables].reverse();
        
        for (const table of reversedTables) {
          const tableData = sectionData[table];
          if (!tableData || !Array.isArray(tableData) || tableData.length === 0) continue;

          const { error } = await supabase
            .from(table as any)
            .upsert(tableData, { onConflict: 'id' });
          
          if (error) {
            console.error(`Error restoring ${table}:`, error);
            hasErrors = true;
          } else {
            totalRestored += tableData.length;
          }
        }
      }

      if (hasErrors) {
        toast.warning(`นำเข้าบางส่วนสำเร็จ (${totalRestored} รายการ)`);
      } else {
        toast.success(`นำเข้าทั้งหมดสำเร็จ (${totalRestored} รายการ)`);
      }
      
      fetchCounts();
    } catch (error) {
      console.error('Restore all error:', error);
      toast.error('เกิดข้อผิดพลาดในการนำเข้าข้อมูล');
    } finally {
      setLoadingRestore(null);
    }
  };

  const handleReset = async (section: DataSection) => {
    setLoadingReset(section.id);
    
    try {
      for (const table of section.tables) {
        const { error } = await supabase
          .from(table as any)
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000');
        
        if (error) console.error(`Error deleting ${table}:`, error);
      }

      toast.success(`รีเซ็ต ${section.name} สำเร็จ`);
      fetchCounts();
    } catch (error) {
      console.error('Reset error:', error);
      toast.error('เกิดข้อผิดพลาดในการรีเซ็ตข้อมูล');
    } finally {
      setLoadingReset(null);
    }
  };

  const handleBackupAll = async (isScheduled = false) => {
    setLoadingBackup('all');
    
    try {
      const allBackupData: Record<string, Record<string, any[]>> = {};
      
      for (const section of dataSections) {
        allBackupData[section.id] = {};
        for (const table of section.tables) {
          const { data, error } = await supabase
            .from(table as any)
            .select('*');
          
          if (error) {
            console.error(`Error fetching ${table}:`, error);
            continue;
          }
          
          allBackupData[section.id][table] = data || [];
        }
      }

      const jsonString = JSON.stringify(allBackupData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_all_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      saveBackupInfo('all', blob.size);

      // Update schedule if this is a scheduled backup
      if (isScheduled) {
        const newSchedule = {
          ...schedule,
          lastScheduledBackup: new Date().toISOString()
        };
        saveSchedule(newSchedule);
        setShowScheduleReminder(false);
      }

      toast.success('สำรองข้อมูลทั้งหมดสำเร็จ');
    } catch (error) {
      console.error('Backup all error:', error);
      toast.error('เกิดข้อผิดพลาดในการสำรองข้อมูล');
    } finally {
      setLoadingBackup(null);
    }
  };

  const handleResetAll = async () => {
    setLoadingReset('all');
    
    try {
      for (const section of dataSections) {
        for (const table of section.tables) {
          const { error } = await supabase
            .from(table as any)
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');
          
          if (error) console.error(`Error deleting ${table}:`, error);
        }
      }

      toast.success('รีเซ็ตข้อมูลทั้งหมดสำเร็จ');
      fetchCounts();
    } catch (error) {
      console.error('Reset all error:', error);
      toast.error('เกิดข้อผิดพลาดในการรีเซ็ตข้อมูล');
    } finally {
      setLoadingReset(null);
    }
  };

  const triggerFileInput = (sectionId: string) => {
    fileInputRefs.current[sectionId]?.click();
  };

  const getNextBackupText = () => {
    if (!schedule.enabled) return null;
    const nextDate = getNextBackupDate(schedule.lastScheduledBackup, schedule.frequency);
    if (isPast(nextDate)) {
      return 'ถึงกำหนดแล้ว!';
    }
    return formatDistanceToNow(nextDate, { addSuffix: true, locale: th });
  };

  return (
    <AdminLayout title="สำรอง & รีเซ็ต">
      <div className="space-y-4 sm:space-y-6">
        {/* Schedule Reminder */}
        {showScheduleReminder && (
          <Card className="border-orange-500 bg-orange-50 dark:bg-orange-950/20">
            <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 py-4">
              <div className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <span className="text-sm font-medium">ถึงเวลาสำรองข้อมูลตามกำหนดแล้ว!</span>
              </div>
              <Button 
                size="sm" 
                onClick={() => handleBackupAll(true)}
                disabled={loadingBackup === 'all'}
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4 mr-1" />
                {loadingBackup === 'all' ? 'กำลังสำรอง...' : 'สำรองเลย'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Schedule Settings */}
        <Card>
          <CardHeader className="pb-3 sm:pb-4">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <CalendarClock className="h-4 w-4 sm:h-5 sm:w-5" />
              ตั้งเวลา Backup อัตโนมัติ
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              ระบบจะแจ้งเตือนเมื่อถึงกำหนดสำรองข้อมูล
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-3">
                <Switch
                  id="schedule-enabled"
                  checked={schedule.enabled}
                  onCheckedChange={(checked) => {
                    const newSchedule = { ...schedule, enabled: checked };
                    saveSchedule(newSchedule);
                    if (checked && !schedule.lastScheduledBackup) {
                      setShowScheduleReminder(true);
                    }
                  }}
                />
                <Label htmlFor="schedule-enabled" className="text-sm">เปิดใช้งาน</Label>
              </div>

              <Select
                value={schedule.frequency}
                onValueChange={(value: 'daily' | 'weekly' | 'monthly') => {
                  const newSchedule = { ...schedule, frequency: value };
                  saveSchedule(newSchedule);
                }}
                disabled={!schedule.enabled}
              >
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">ทุกวัน</SelectItem>
                  <SelectItem value="weekly">ทุกสัปดาห์</SelectItem>
                  <SelectItem value="monthly">ทุกเดือน</SelectItem>
                </SelectContent>
              </Select>

              {schedule.enabled && getNextBackupText() && (
                <div className="text-xs sm:text-sm text-muted-foreground">
                  ครั้งถัดไป: <span className={isPast(getNextBackupDate(schedule.lastScheduledBackup, schedule.frequency)) ? 'text-orange-600 font-medium' : ''}>{getNextBackupText()}</span>
                </div>
              )}
            </div>

            {schedule.lastScheduledBackup && (
              <div className="text-xs text-muted-foreground">
                สำรองล่าสุด: {format(new Date(schedule.lastScheduledBackup), 'dd MMM yyyy HH:mm', { locale: th })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Header Actions */}
        <Card>
          <CardHeader className="pb-3 sm:pb-4">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Database className="h-4 w-4 sm:h-5 sm:w-5" />
              จัดการข้อมูลทั้งหมด
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              สำรอง นำเข้า หรือรีเซ็ตข้อมูลทั้งหมด
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:flex gap-2 sm:gap-3">
              <Button 
                onClick={() => handleBackupAll(false)}
                disabled={loadingBackup === 'all'}
                className="flex items-center justify-center gap-1.5 text-xs sm:text-sm"
                size="sm"
              >
                <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden xs:inline">{loadingBackup === 'all' ? 'กำลัง...' : 'สำรอง'}</span>
                <span className="xs:hidden">{loadingBackup === 'all' ? '...' : 'สำรอง'}</span>
              </Button>

              <input
                type="file"
                accept=".json"
                className="hidden"
                ref={(el) => fileInputRefs.current['all'] = el}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleRestoreAll(file);
                  e.target.value = '';
                }}
              />
              <Button 
                variant="secondary"
                onClick={() => triggerFileInput('all')}
                disabled={loadingRestore === 'all'}
                className="flex items-center justify-center gap-1.5 text-xs sm:text-sm"
                size="sm"
              >
                <Upload className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>{loadingRestore === 'all' ? '...' : 'นำเข้า'}</span>
              </Button>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="flex items-center justify-center gap-1.5 text-xs sm:text-sm" size="sm">
                    <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span>รีเซ็ต</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="max-w-[90vw] sm:max-w-md">
                  <AlertDialogHeader>
                    <AlertDialogTitle>ยืนยันการรีเซ็ตข้อมูลทั้งหมด?</AlertDialogTitle>
                    <AlertDialogDescription>
                      การดำเนินการนี้จะลบข้อมูลทั้งหมด ไม่สามารถกู้คืนได้
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                    <AlertDialogCancel className="w-full sm:w-auto">ยกเลิก</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleResetAll}
                      className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {loadingReset === 'all' ? 'กำลังรีเซ็ต...' : 'รีเซ็ตทั้งหมด'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <Button 
                variant="outline" 
                onClick={fetchCounts}
                className="flex items-center justify-center gap-1.5 text-xs sm:text-sm"
                size="sm"
              >
                <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">รีเฟรช</span>
              </Button>
            </div>

            {/* All backup info */}
            {backupInfos['all'] && (
              <div className="flex flex-wrap gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground pt-2 border-t">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{format(new Date(backupInfos['all'].lastBackupDate!), 'dd MMM yy HH:mm', { locale: th })}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <HardDrive className="h-3.5 w-3.5" />
                  <span>{formatFileSize(backupInfos['all'].lastBackupSize!)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Data Sections */}
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
          {dataSections.map((section) => (
            <Card key={section.id} className="relative overflow-hidden">
              <div className={`absolute top-0 left-0 w-1 h-full ${section.color}`} />
              <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-4">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base">
                    {section.icon}
                    <span className="truncate">{section.name}</span>
                  </CardTitle>
                  <Badge variant="secondary" className="text-xs shrink-0">
                    {counts[section.id] ?? '...'}
                  </Badge>
                </div>
                <CardDescription className="text-xs line-clamp-1">
                  {section.description}
                </CardDescription>
                
                {/* Backup info for this section */}
                {backupInfos[section.id] && (
                  <div className="flex flex-wrap gap-2 text-[10px] sm:text-xs text-muted-foreground mt-1.5 pt-1.5 border-t">
                    <div className="flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                      <span>{format(new Date(backupInfos[section.id].lastBackupDate!), 'dd/MM/yy', { locale: th })}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <HardDrive className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                      <span>{formatFileSize(backupInfos[section.id].lastBackupSize!)}</span>
                    </div>
                  </div>
                )}
              </CardHeader>
              <CardContent className="flex flex-wrap gap-1.5 sm:gap-2 px-3 sm:px-6 pb-3 sm:pb-4">
                <Button 
                  size="sm"
                  variant="outline"
                  onClick={() => handleBackup(section)}
                  disabled={loadingBackup === section.id}
                  className="flex items-center gap-1 text-xs h-7 sm:h-8 px-2 sm:px-3"
                >
                  <Download className="h-3 w-3" />
                  <span>{loadingBackup === section.id ? '...' : 'สำรอง'}</span>
                </Button>

                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  ref={(el) => fileInputRefs.current[section.id] = el}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleRestore(section, file);
                    e.target.value = '';
                  }}
                />
                <Button 
                  size="sm"
                  variant="secondary"
                  onClick={() => triggerFileInput(section.id)}
                  disabled={loadingRestore === section.id}
                  className="flex items-center gap-1 text-xs h-7 sm:h-8 px-2 sm:px-3"
                >
                  <Upload className="h-3 w-3" />
                  <span>{loadingRestore === section.id ? '...' : 'นำเข้า'}</span>
                </Button>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      size="sm" 
                      variant="destructive"
                      className="flex items-center gap-1 text-xs h-7 sm:h-8 px-2 sm:px-3"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>รีเซ็ต</span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="max-w-[90vw] sm:max-w-md">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-base">ยืนยันการรีเซ็ต {section.name}?</AlertDialogTitle>
                      <AlertDialogDescription className="text-sm">
                        ลบข้อมูลใน: {section.tables.join(', ')}
                        <br />
                        ไม่สามารถกู้คืนได้
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                      <AlertDialogCancel className="w-full sm:w-auto">ยกเลิก</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => handleReset(section)}
                        className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {loadingReset === section.id ? 'กำลังรีเซ็ต...' : 'รีเซ็ต'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
