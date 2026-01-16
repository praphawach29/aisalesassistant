import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCacheInvalidation } from '@/hooks/useCacheInvalidation';
import { GraduationCap, Plus, Pencil, Trash2, Search, Sparkles } from 'lucide-react';

interface CategoryExpertise {
  id: string;
  category: string;
  expertise_name: string;
  expertise_prompt: string;
  selling_tips: string | null;
  terminology: string | null;
  common_questions: string | null;
  store_type: string;
  is_active: boolean;
  is_system: boolean;
  created_at: string;
}

const storeTypeOptions = [
  { value: 'general', label: 'ร้านทั่วไป/แฟชั่น', icon: '👔' },
  { value: 'technology', label: 'เทคโนโลยี/IT', icon: '💻' },
  { value: 'food', label: 'อาหาร/เครื่องดื่ม', icon: '🍽️' },
  { value: 'beauty', label: 'ความงาม/เครื่องสำอาง', icon: '💄' },
];

const defaultFormData = {
  category: '',
  expertise_name: '',
  expertise_prompt: '',
  selling_tips: '',
  terminology: '',
  common_questions: '',
  store_type: 'general',
  is_active: true,
};

export default function AdminCategoryExpertise() {
  const [expertise, setExpertise] = useState<CategoryExpertise[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStoreType, setFilterStoreType] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(defaultFormData);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const { invalidateCache } = useCacheInvalidation();

  useEffect(() => {
    fetchExpertise();
  }, []);

  const fetchExpertise = async () => {
    try {
      const { data, error } = await supabase
        .from('category_expertise')
        .select('*')
        .order('store_type')
        .order('category');

      if (error) throw error;
      setExpertise(data || []);
    } catch (error) {
      console.error('Error fetching expertise:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถโหลดข้อมูลได้',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDialog = (item?: CategoryExpertise) => {
    if (item) {
      setEditingId(item.id);
      setFormData({
        category: item.category,
        expertise_name: item.expertise_name,
        expertise_prompt: item.expertise_prompt,
        selling_tips: item.selling_tips || '',
        terminology: item.terminology || '',
        common_questions: item.common_questions || '',
        store_type: item.store_type,
        is_active: item.is_active,
      });
    } else {
      setEditingId(null);
      setFormData(defaultFormData);
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.category.trim() || !formData.expertise_name.trim() || !formData.expertise_prompt.trim()) {
      toast({
        title: 'กรุณากรอกข้อมูลให้ครบ',
        description: 'ต้องมีชื่อหมวดหมู่ ชื่อความเชี่ยวชาญ และ Prompt',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        category: formData.category.trim(),
        expertise_name: formData.expertise_name.trim(),
        expertise_prompt: formData.expertise_prompt.trim(),
        selling_tips: formData.selling_tips.trim() || null,
        terminology: formData.terminology.trim() || null,
        common_questions: formData.common_questions.trim() || null,
        store_type: formData.store_type,
        is_active: formData.is_active,
        is_system: false,
      };

      if (editingId) {
        const { error } = await supabase
          .from('category_expertise')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
        toast({ title: 'อัปเดตสำเร็จ' });
      } else {
        const { error } = await supabase
          .from('category_expertise')
          .insert(payload);
        if (error) throw error;
        toast({ title: 'เพิ่มความเชี่ยวชาญสำเร็จ' });
      }

      await invalidateCache(['category_expertise']);
      setIsDialogOpen(false);
      fetchExpertise();
    } catch (error: any) {
      console.error('Error saving expertise:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: error.message?.includes('duplicate') 
          ? 'หมวดหมู่นี้มีอยู่แล้วในประเภทร้านนี้' 
          : 'ไม่สามารถบันทึกได้',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, isSystem: boolean) => {
    if (isSystem) {
      toast({
        title: 'ไม่สามารถลบได้',
        description: 'ความเชี่ยวชาญนี้เป็นข้อมูลเริ่มต้นของระบบ',
        variant: 'destructive',
      });
      return;
    }

    if (!confirm('ยืนยันการลบ?')) return;

    try {
      const { error } = await supabase
        .from('category_expertise')
        .delete()
        .eq('id', id);
      if (error) throw error;
      
      toast({ title: 'ลบสำเร็จ' });
      await invalidateCache(['category_expertise']);
      fetchExpertise();
    } catch (error) {
      console.error('Error deleting expertise:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถลบได้',
        variant: 'destructive',
      });
    }
  };

  const handleToggleActive = async (id: string, currentValue: boolean) => {
    try {
      const { error } = await supabase
        .from('category_expertise')
        .update({ is_active: !currentValue })
        .eq('id', id);
      if (error) throw error;
      
      await invalidateCache(['category_expertise']);
      fetchExpertise();
    } catch (error) {
      console.error('Error toggling active:', error);
    }
  };

  const filteredExpertise = expertise.filter(item => {
    const matchesSearch = 
      item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.expertise_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterStoreType === 'all' || item.store_type === filterStoreType;
    return matchesSearch && matchesType;
  });

  const groupedExpertise = filteredExpertise.reduce((acc, item) => {
    const type = item.store_type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(item);
    return acc;
  }, {} as Record<string, CategoryExpertise[]>);

  if (isLoading) {
    return (
      <AdminLayout title="จัดการความเชี่ยวชาญ">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="จัดการความเชี่ยวชาญ">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <GraduationCap className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold">ความเชี่ยวชาญตามหมวดหมู่</h2>
              <p className="text-sm text-muted-foreground">กำหนดความรู้เฉพาะทางให้ AI ตามประเภทสินค้า</p>
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="w-4 h-4 mr-2" />
                เพิ่มความเชี่ยวชาญ
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingId ? 'แก้ไขความเชี่ยวชาญ' : 'เพิ่มความเชี่ยวชาญใหม่'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>หมวดหมู่สินค้า *</Label>
                    <Input
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      placeholder="เช่น รองเท้า, ปริ้นเตอร์, ขนม"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>ประเภทร้านค้า</Label>
                    <Select
                      value={formData.store_type}
                      onValueChange={(value) => setFormData({ ...formData, store_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {storeTypeOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.icon} {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>ชื่อความเชี่ยวชาญ *</Label>
                  <Input
                    value={formData.expertise_name}
                    onChange={(e) => setFormData({ ...formData, expertise_name: e.target.value })}
                    placeholder="เช่น ผู้เชี่ยวชาญรองเท้า, ผู้เชี่ยวชาญเครื่องพิมพ์"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Expertise Prompt * (คำสั่งให้ AI)</Label>
                  <Textarea
                    value={formData.expertise_prompt}
                    onChange={(e) => setFormData({ ...formData, expertise_prompt: e.target.value })}
                    placeholder="อธิบายบทบาทและความสามารถของ AI ในฐานะผู้เชี่ยวชาญ"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>เทคนิคการขาย</Label>
                  <Textarea
                    value={formData.selling_tips}
                    onChange={(e) => setFormData({ ...formData, selling_tips: e.target.value })}
                    placeholder="แนะนำวิธีขายสินค้าหมวดนี้ เช่น ถามไซส์อย่างไร แนะนำอะไรบ้าง"
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label>คำศัพท์ที่ควรรู้</Label>
                  <Textarea
                    value={formData.terminology}
                    onChange={(e) => setFormData({ ...formData, terminology: e.target.value })}
                    placeholder="คำศัพท์เฉพาะทาง เช่น S/M/L, Inkjet, Laser"
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label>คำถามที่พบบ่อย</Label>
                  <Textarea
                    value={formData.common_questions}
                    onChange={(e) => setFormData({ ...formData, common_questions: e.target.value })}
                    placeholder="คำถามที่ลูกค้ามักถาม เช่น ไซส์นี้เหมาะกับใคร?, กันน้ำไหม?"
                    rows={2}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                    />
                    <Label>เปิดใช้งาน</Label>
                  </div>
                  <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? 'กำลังบันทึก...' : 'บันทึก'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="ค้นหาหมวดหมู่..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterStoreType} onValueChange={setFilterStoreType}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="ประเภทร้าน" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  {storeTypeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.icon} {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Expertise List */}
        {Object.entries(groupedExpertise).map(([storeType, items]) => {
          const typeInfo = storeTypeOptions.find(o => o.value === storeType);
          return (
            <Card key={storeType}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <span>{typeInfo?.icon || '📦'}</span>
                  {typeInfo?.label || storeType}
                  <Badge variant="secondary">{items.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((item) => (
                    <Card key={item.id} className={!item.is_active ? 'opacity-50' : ''}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-base flex items-center gap-2">
                              <Sparkles className="w-4 h-4 text-primary" />
                              {item.category}
                            </CardTitle>
                            <CardDescription className="text-xs mt-1">
                              {item.expertise_name}
                            </CardDescription>
                          </div>
                          <div className="flex items-center gap-1">
                            {item.is_system && (
                              <Badge variant="outline" className="text-xs">ระบบ</Badge>
                            )}
                            <Switch
                              checked={item.is_active}
                              onCheckedChange={() => handleToggleActive(item.id, item.is_active)}
                            />
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                          {item.expertise_prompt}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => handleOpenDialog(item)}
                          >
                            <Pencil className="w-3 h-3 mr-1" />
                            แก้ไข
                          </Button>
                          {!item.is_system && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(item.id, item.is_system)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filteredExpertise.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <GraduationCap className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>ไม่พบความเชี่ยวชาญที่ตรงกับการค้นหา</p>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
