import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Loader2, Search, MapPin, Edit, Trash2, Plus, Home, Building2, MessageCircle, Facebook, Download, Upload } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

interface CustomerAddress {
  id: string;
  platform_user_id: string;
  platform: string;
  label: string;
  address: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export default function AdminAddresses() {
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingAddress, setEditingAddress] = useState<CustomerAddress | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importData, setImportData] = useState<Array<{platform: string; platform_user_id: string; label: string; address: string; is_default: boolean}>>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [formData, setFormData] = useState({
    label: '',
    address: '',
    is_default: false
  });

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate('/admin');
    }
  }, [user, isAdmin, authLoading, navigate]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchAddresses();
    }
  }, [user, isAdmin]);

  const fetchAddresses = async () => {
    try {
      const { data, error } = await supabase
        .from('customer_addresses')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAddresses(data || []);
    } catch (error) {
      console.error('Error fetching addresses:', error);
      toast.error('ไม่สามารถโหลดข้อมูลที่อยู่ได้');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (address: CustomerAddress) => {
    setEditingAddress(address);
    setFormData({
      label: address.label,
      address: address.address,
      is_default: address.is_default
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingAddress) return;

    try {
      // If setting as default, unset other defaults for this user
      if (formData.is_default) {
        await supabase
          .from('customer_addresses')
          .update({ is_default: false })
          .eq('platform_user_id', editingAddress.platform_user_id)
          .eq('platform', editingAddress.platform)
          .neq('id', editingAddress.id);
      }

      const { error } = await supabase
        .from('customer_addresses')
        .update({
          label: formData.label,
          address: formData.address,
          is_default: formData.is_default
        })
        .eq('id', editingAddress.id);

      if (error) throw error;

      toast.success('อัปเดตที่อยู่สำเร็จ');
      setIsDialogOpen(false);
      setEditingAddress(null);
      fetchAddresses();
    } catch (error) {
      console.error('Error updating address:', error);
      toast.error('ไม่สามารถอัปเดตที่อยู่ได้');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('คุณต้องการลบที่อยู่นี้ใช่หรือไม่?')) return;

    try {
      const { error } = await supabase
        .from('customer_addresses')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('ลบที่อยู่สำเร็จ');
      fetchAddresses();
    } catch (error) {
      console.error('Error deleting address:', error);
      toast.error('ไม่สามารถลบที่อยู่ได้');
    }
  };

  const filteredAddresses = addresses.filter(address =>
    address.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
    address.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    address.platform_user_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'line':
        return <MessageCircle className="w-4 h-4 text-green-500" />;
      case 'facebook':
        return <Facebook className="w-4 h-4 text-blue-500" />;
      default:
        return <MapPin className="w-4 h-4 text-gray-500" />;
    }
  };

  const getLabelIcon = (label: string) => {
    if (label.includes('บ้าน') || label.includes('home')) {
      return <Home className="w-4 h-4" />;
    }
    if (label.includes('ที่ทำงาน') || label.includes('office') || label.includes('work')) {
      return <Building2 className="w-4 h-4" />;
    }
    return <MapPin className="w-4 h-4" />;
  };

  // Group addresses by user
  const groupedAddresses = filteredAddresses.reduce((acc, addr) => {
    const key = `${addr.platform}-${addr.platform_user_id}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(addr);
    return acc;
  }, {} as Record<string, CustomerAddress[]>);

  const exportToCSV = () => {
    const headers = ['แพลตฟอร์ม', 'ID ลูกค้า', 'ป้ายกำกับ', 'ที่อยู่', 'ค่าเริ่มต้น', 'วันที่สร้าง', 'วันที่อัปเดต'];
    const rows = filteredAddresses.map(addr => [
      addr.platform,
      addr.platform_user_id,
      addr.label,
      `"${addr.address.replace(/"/g, '""')}"`,
      addr.is_default ? 'ใช่' : 'ไม่',
      format(new Date(addr.created_at), 'd MMM yyyy HH:mm', { locale: th }),
      format(new Date(addr.updated_at), 'd MMM yyyy HH:mm', { locale: th })
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `customer-addresses-${format(new Date(), 'yyyyMMdd-HHmmss')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`ส่งออก ${filteredAddresses.length} รายการสำเร็จ`);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          toast.error('ไฟล์ CSV ต้องมีอย่างน้อย 1 แถวข้อมูล');
          return;
        }

        // Parse header
        const header = lines[0].toLowerCase();
        const hasHeader = header.includes('platform') || header.includes('แพลตฟอร์ม');
        const startIndex = hasHeader ? 1 : 0;

        const parsed: Array<{platform: string; platform_user_id: string; label: string; address: string; is_default: boolean}> = [];
        
        for (let i = startIndex; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          // Parse CSV line (handle quoted values)
          const values: string[] = [];
          let current = '';
          let inQuotes = false;
          
          for (const char of line) {
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              values.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          values.push(current.trim());

          if (values.length >= 4) {
            parsed.push({
              platform: values[0] || 'line',
              platform_user_id: values[1],
              label: values[2] || 'บ้าน',
              address: values[3],
              is_default: values[4]?.toLowerCase() === 'ใช่' || values[4]?.toLowerCase() === 'true' || values[4] === '1'
            });
          }
        }

        if (parsed.length === 0) {
          toast.error('ไม่พบข้อมูลที่ถูกต้องในไฟล์ CSV');
          return;
        }

        setImportData(parsed);
        setIsImportDialogOpen(true);
      } catch (error) {
        console.error('Error parsing CSV:', error);
        toast.error('ไม่สามารถอ่านไฟล์ CSV ได้');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleImport = async () => {
    if (importData.length === 0) return;

    setIsImporting(true);
    try {
      let successCount = 0;
      let errorCount = 0;

      for (const item of importData) {
        if (!item.platform_user_id || !item.address) {
          errorCount++;
          continue;
        }

        // Check if address already exists
        const { data: existing } = await supabase
          .from('customer_addresses')
          .select('id')
          .eq('platform_user_id', item.platform_user_id)
          .eq('platform', item.platform)
          .eq('label', item.label)
          .maybeSingle();

        if (existing) {
          // Update existing
          const { error } = await supabase
            .from('customer_addresses')
            .update({ 
              address: item.address, 
              is_default: item.is_default,
              updated_at: new Date().toISOString() 
            })
            .eq('id', existing.id);
          
          if (error) errorCount++;
          else successCount++;
        } else {
          // Insert new
          const { error } = await supabase
            .from('customer_addresses')
            .insert({
              platform: item.platform,
              platform_user_id: item.platform_user_id,
              label: item.label,
              address: item.address,
              is_default: item.is_default
            });
          
          if (error) errorCount++;
          else successCount++;
        }
      }

      toast.success(`นำเข้าสำเร็จ ${successCount} รายการ${errorCount > 0 ? `, ล้มเหลว ${errorCount} รายการ` : ''}`);
      setIsImportDialogOpen(false);
      setImportData([]);
      fetchAddresses();
    } catch (error) {
      console.error('Error importing:', error);
      toast.error('เกิดข้อผิดพลาดในการนำเข้าข้อมูล');
    } finally {
      setIsImporting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <AdminLayout title="ที่อยู่ลูกค้า">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="ที่อยู่ลูกค้า">
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">ที่อยู่ทั้งหมด</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{addresses.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">ลูกค้าที่มีที่อยู่</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Object.keys(groupedAddresses).length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">ที่อยู่ LINE / Facebook</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {addresses.filter(a => a.platform === 'line').length} / {addresses.filter(a => a.platform === 'facebook').length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Export */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="ค้นหาที่อยู่, ป้ายกำกับ, หรือ ID ลูกค้า..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                id="csv-import"
              />
              <Button variant="outline" onClick={() => document.getElementById('csv-import')?.click()}>
                <Upload className="w-4 h-4 mr-2" />
                นำเข้า CSV
              </Button>
              <Button onClick={exportToCSV} disabled={filteredAddresses.length === 0}>
                <Download className="w-4 h-4 mr-2" />
                ส่งออก CSV
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              รูปแบบ CSV: แพลตฟอร์ม, ID ลูกค้า, ป้ายกำกับ, ที่อยู่, ค่าเริ่มต้น (ใช่/ไม่)
            </p>
          </CardContent>
        </Card>

        {/* Address Table */}
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>แพลตฟอร์ม</TableHead>
                  <TableHead>ID ลูกค้า</TableHead>
                  <TableHead>ป้ายกำกับ</TableHead>
                  <TableHead>ที่อยู่</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>วันที่สร้าง</TableHead>
                  <TableHead className="text-right">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAddresses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      ไม่พบข้อมูลที่อยู่
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAddresses.map((address) => (
                    <TableRow key={address.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getPlatformIcon(address.platform)}
                          <span className="capitalize">{address.platform}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {address.platform_user_id.slice(0, 15)}...
                        </code>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getLabelIcon(address.label)}
                          <span>{address.label}</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs truncate" title={address.address}>
                        {address.address}
                      </TableCell>
                      <TableCell>
                        {address.is_default && (
                          <Badge variant="secondary">ค่าเริ่มต้น</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {format(new Date(address.created_at), 'd MMM yyyy', { locale: th })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(address)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(address.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>แก้ไขที่อยู่</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="label">ป้ายกำกับ</Label>
              <Input
                id="label"
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                placeholder="เช่น บ้าน, ที่ทำงาน"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">ที่อยู่</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="ที่อยู่เต็ม"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_default"
                checked={formData.is_default}
                onCheckedChange={(checked) => setFormData({ ...formData, is_default: checked as boolean })}
              />
              <Label htmlFor="is_default">ตั้งเป็นที่อยู่เริ่มต้น</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleSave}>
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>นำเข้าที่อยู่จาก CSV</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              พบข้อมูล {importData.length} รายการ กรุณาตรวจสอบก่อนนำเข้า
            </p>
            <ScrollArea className="h-64 border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>แพลตฟอร์ม</TableHead>
                    <TableHead>ID ลูกค้า</TableHead>
                    <TableHead>ป้ายกำกับ</TableHead>
                    <TableHead>ที่อยู่</TableHead>
                    <TableHead>ค่าเริ่มต้น</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importData.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{item.platform}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1 py-0.5 rounded">
                          {item.platform_user_id.slice(0, 15)}...
                        </code>
                      </TableCell>
                      <TableCell>{item.label}</TableCell>
                      <TableCell className="max-w-xs truncate">{item.address}</TableCell>
                      <TableCell>{item.is_default ? 'ใช่' : 'ไม่'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsImportDialogOpen(false);
              setImportData([]);
            }}>
              ยกเลิก
            </Button>
            <Button onClick={handleImport} disabled={isImporting}>
              {isImporting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              นำเข้า {importData.length} รายการ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
