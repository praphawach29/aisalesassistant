import { useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Download, Trash2, ShoppingCart, MessageSquare, Bell, Package, FileText, Settings, Brain, HelpCircle, Users, CreditCard, Database, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DataSection {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  tables: string[];
  color: string;
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
    description: 'FAQ, Knowledge Base, เนื้อหาที่ scrape, ความเชี่ยวชาญหมวดหมู่',
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

export default function AdminBackupReset() {
  const [loadingBackup, setLoadingBackup] = useState<string | null>(null);
  const [loadingReset, setLoadingReset] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});

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

  useState(() => {
    fetchCounts();
  });

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

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_${section.id}_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`สำรองข้อมูล ${section.name} สำเร็จ`);
    } catch (error) {
      console.error('Backup error:', error);
      toast.error('เกิดข้อผิดพลาดในการสำรองข้อมูล');
    } finally {
      setLoadingBackup(null);
    }
  };

  const handleReset = async (section: DataSection) => {
    setLoadingReset(section.id);
    
    try {
      // Delete in order (respecting foreign keys)
      for (const table of section.tables) {
        const { error } = await supabase
          .from(table as any)
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
        
        if (error) {
          console.error(`Error deleting ${table}:`, error);
          // Continue with other tables
        }
      }

      toast.success(`รีเซ็ตข้อมูล ${section.name} สำเร็จ`);
      fetchCounts(); // Refresh counts
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

      const blob = new Blob([JSON.stringify(allBackupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_all_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

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
              สำรองหรือรีเซ็ตข้อมูลทั้งหมดในระบบ
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-4">
            <Button 
              onClick={handleBackupAll}
              disabled={loadingBackup === 'all'}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              {loadingBackup === 'all' ? 'กำลังสำรอง...' : 'สำรองทั้งหมด'}
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
              </CardHeader>
              <CardContent className="flex gap-2">
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
