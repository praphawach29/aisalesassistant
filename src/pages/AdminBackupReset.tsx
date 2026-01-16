import { useState, useEffect, useRef } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Download, Trash2, ShoppingCart, MessageSquare, Bell, Package, FileText, Settings, Brain, CreditCard, Database, RefreshCw, Upload, Clock, HardDrive } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
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

const dataSections: DataSection[] = [
  {
    id: 'orders',
    name: 'ออเดอร์และการชำระเงิน',
    description: 'ข้อมูลออเดอร์, รายการสินค้า, สลิปการชำระเงิน',
    icon: <ShoppingCart className="h-5 w-5" />,
    tables: ['order_items', 'payment_slips', 'orders'],
    color: 'bg-blue-500'
  },
  {
    id: 'chats',
    name: 'การสนทนา',
    description: 'ข้อความแชท, ตะกร้าสินค้า, ที่อยู่ลูกค้า',
    icon: <MessageSquare className="h-5 w-5" />,
    tables: ['chat_messages', 'shopping_carts', 'customer_addresses', 'chat_conversations'],
    color: 'bg-green-500'
  },
  {
    id: 'notifications',
    name: 'การแจ้งเตือน',
    description: 'การแจ้งเตือนของแอดมิน',
    icon: <Bell className="h-5 w-5" />,
    tables: ['admin_notifications'],
    color: 'bg-yellow-500'
  },
  {
    id: 'products',
    name: 'สินค้า',
    description: 'รายการสินค้า, ความสัมพันธ์สินค้า',
    icon: <Package className="h-5 w-5" />,
    tables: ['related_products', 'products'],
    color: 'bg-purple-500'
  },
  {
    id: 'knowledge',
    name: 'ฐานความรู้',
    description: 'FAQ, Knowledge Base, เนื้อหาที่ scrape',
    icon: <Brain className="h-5 w-5" />,
    tables: ['faqs', 'knowledge_base', 'scraped_content'],
    color: 'bg-pink-500'
  },
  {
    id: 'coupons',
    name: 'คูปอง',
    description: 'คูปองส่วนลด',
    icon: <CreditCard className="h-5 w-5" />,
    tables: ['coupons'],
    color: 'bg-orange-500'
  },
  {
    id: 'broadcasts',
    name: 'ข้อความ Broadcast',
    description: 'ข้อความ broadcast, เทมเพลตข้อความ',
    icon: <FileText className="h-5 w-5" />,
    tables: ['broadcast_messages', 'message_templates'],
    color: 'bg-cyan-500'
  },
  {
    id: 'ai_settings',
    name: 'ตั้งค่า AI',
    description: 'การตั้งค่า AI, เทมเพลตบุคลิกภาพ, API Keys',
    icon: <Settings className="h-5 w-5" />,
    tables: ['ai_settings', 'ai_personality_templates', 'ai_provider_keys'],
    color: 'bg-indigo-500'
  }
];

const BACKUP_INFO_KEY = 'backup_info';

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function AdminBackupReset() {
  const [loadingBackup, setLoadingBackup] = useState<string | null>(null);
  const [loadingReset, setLoadingReset] = useState<string | null>(null);
  const [loadingRestore, setLoadingRestore] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [backupInfos, setBackupInfos] = useState<Record<string, BackupInfo>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Load backup info from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(BACKUP_INFO_KEY);
    if (stored) {
      try {
        setBackupInfos(JSON.parse(stored));
      } catch (e) {
        console.error('Error parsing backup info:', e);
      }
    }
    fetchCounts();
  }, []);

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
    const newCounts: Record<string, number> = {};
    
    for (const section of dataSections) {
      let totalCount = 0;
      for (const table of section.tables) {
        try {
          const { count } = await supabase
            .from(table as any)
            .select('*', { count: 'exact', head: true });
          totalCount += count || 0;
        } catch (error) {
          console.error(`Error counting ${table}:`, error);
        }
      }
      newCounts[section.id] = totalCount;
    }
    
    setCounts(newCounts);
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

      // Save backup info
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
      
      // Validate backup data structure
      const isValidFormat = section.tables.some(table => backupData[table] !== undefined);
      if (!isValidFormat) {
        toast.error('รูปแบบไฟล์ไม่ถูกต้อง กรุณาเลือกไฟล์ backup ที่ถูกต้อง');
        return;
      }

      let totalRestored = 0;
      let hasErrors = false;

      // Restore data in reverse order (child tables first for foreign keys)
      const reversedTables = [...section.tables].reverse();
      
      for (const table of reversedTables) {
        const tableData = backupData[table];
        if (!tableData || !Array.isArray(tableData) || tableData.length === 0) {
          continue;
        }

        // Use upsert to handle existing records
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
        toast.warning(`นำเข้าข้อมูล ${section.name} บางส่วนสำเร็จ (${totalRestored} รายการ)`);
      } else {
        toast.success(`นำเข้าข้อมูล ${section.name} สำเร็จ (${totalRestored} รายการ)`);
      }
      
      fetchCounts(); // Refresh counts
    } catch (error) {
      console.error('Restore error:', error);
      toast.error('เกิดข้อผิดพลาดในการนำเข้าข้อมูล กรุณาตรวจสอบรูปแบบไฟล์');
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
          if (!tableData || !Array.isArray(tableData) || tableData.length === 0) {
            continue;
          }

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
        toast.warning(`นำเข้าข้อมูลทั้งหมดบางส่วนสำเร็จ (${totalRestored} รายการ)`);
      } else {
        toast.success(`นำเข้าข้อมูลทั้งหมดสำเร็จ (${totalRestored} รายการ)`);
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
        
        if (error) {
          console.error(`Error deleting ${table}:`, error);
        }
      }

      toast.success(`รีเซ็ตข้อมูล ${section.name} สำเร็จ`);
      fetchCounts();
    } catch (error) {
      console.error('Reset error:', error);
      toast.error('เกิดข้อผิดพลาดในการรีเซ็ตข้อมูล');
    } finally {
      setLoadingReset(null);
    }
  };

  const handleBackupAll = async () => {
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

      // Save backup info for all
      saveBackupInfo('all', blob.size);

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
          
          if (error) {
            console.error(`Error deleting ${table}:`, error);
          }
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

  return (
    <AdminLayout title="สำรอง & รีเซ็ตข้อมูล">
      <div className="space-y-6">
        {/* Header Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              จัดการข้อมูลทั้งหมด
            </CardTitle>
            <CardDescription>
              สำรอง นำเข้า หรือรีเซ็ตข้อมูลทั้งหมดในระบบ
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button 
                onClick={handleBackupAll}
                disabled={loadingBackup === 'all'}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                {loadingBackup === 'all' ? 'กำลังสำรอง...' : 'สำรองทั้งหมด'}
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
                className="flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                {loadingRestore === 'all' ? 'กำลังนำเข้า...' : 'นำเข้าทั้งหมด'}
              </Button>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="flex items-center gap-2">
                    <Trash2 className="h-4 w-4" />
                    รีเซ็ตทั้งหมด
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>ยืนยันการรีเซ็ตข้อมูลทั้งหมด?</AlertDialogTitle>
                    <AlertDialogDescription>
                      การดำเนินการนี้จะลบข้อมูลทั้งหมดในระบบ ไม่สามารถกู้คืนได้ 
                      กรุณาสำรองข้อมูลก่อนดำเนินการ
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleResetAll}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {loadingReset === 'all' ? 'กำลังรีเซ็ต...' : 'รีเซ็ตทั้งหมด'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <Button 
                variant="outline" 
                onClick={fetchCounts}
                className="flex items-center gap-2 ml-auto"
              >
                <RefreshCw className="h-4 w-4" />
                รีเฟรช
              </Button>
            </div>

            {/* All backup info */}
            {backupInfos['all'] && (
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground pt-2 border-t">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  <span>สำรองล่าสุด: {format(new Date(backupInfos['all'].lastBackupDate!), 'dd MMM yyyy HH:mm', { locale: th })}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <HardDrive className="h-4 w-4" />
                  <span>ขนาด: {formatFileSize(backupInfos['all'].lastBackupSize!)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Data Sections */}
        <div className="grid gap-4 md:grid-cols-2">
          {dataSections.map((section) => (
            <Card key={section.id} className="relative overflow-hidden">
              <div className={`absolute top-0 left-0 w-1 h-full ${section.color}`} />
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    {section.icon}
                    {section.name}
                  </CardTitle>
                  <Badge variant="secondary">
                    {counts[section.id] ?? '...'} รายการ
                  </Badge>
                </div>
                <CardDescription className="text-sm">
                  {section.description}
                </CardDescription>
                
                {/* Backup info for this section */}
                {backupInfos[section.id] && (
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-2 pt-2 border-t">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{format(new Date(backupInfos[section.id].lastBackupDate!), 'dd MMM yy HH:mm', { locale: th })}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <HardDrive className="h-3 w-3" />
                      <span>{formatFileSize(backupInfos[section.id].lastBackupSize!)}</span>
                    </div>
                  </div>
                )}
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button 
                  size="sm"
                  variant="outline"
                  onClick={() => handleBackup(section)}
                  disabled={loadingBackup === section.id}
                  className="flex items-center gap-1"
                >
                  <Download className="h-3 w-3" />
                  {loadingBackup === section.id ? 'กำลังสำรอง...' : 'สำรอง'}
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
                  className="flex items-center gap-1"
                >
                  <Upload className="h-3 w-3" />
                  {loadingRestore === section.id ? 'กำลังนำเข้า...' : 'นำเข้า'}
                </Button>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      size="sm" 
                      variant="destructive"
                      className="flex items-center gap-1"
                    >
                      <Trash2 className="h-3 w-3" />
                      รีเซ็ต
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>ยืนยันการรีเซ็ต {section.name}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        การดำเนินการนี้จะลบข้อมูลทั้งหมดใน: {section.tables.join(', ')}
                        <br />
                        ไม่สามารถกู้คืนได้ กรุณาสำรองข้อมูลก่อนดำเนินการ
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => handleReset(section)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
