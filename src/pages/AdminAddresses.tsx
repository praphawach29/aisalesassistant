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
import { Loader2, Search, MapPin, Edit, Trash2, Plus, Home, Building2, MessageCircle, Facebook } from 'lucide-react';
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

        {/* Search */}
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
            </div>
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
    </AdminLayout>
  );
}
