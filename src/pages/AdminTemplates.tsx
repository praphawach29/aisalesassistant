import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useCacheInvalidation } from '@/hooks/useCacheInvalidation';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  MessageSquareText,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Copy
} from 'lucide-react';
import { toast } from 'sonner';

interface MessageTemplate {
  id: string;
  name: string;
  content: string;
  category: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

const categoryOptions = [
  { value: 'order', label: 'ออเดอร์' },
  { value: 'general', label: 'ทั่วไป' },
  { value: 'promo', label: 'โปรโมชั่น' },
  { value: 'support', label: 'ซัพพอร์ต' },
];

export default function AdminTemplates() {
  const { user, isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();
  const { invalidateCache } = useCacheInvalidation();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    content: '',
    category: 'general',
    is_active: true,
    sort_order: 0,
  });

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/admin');
    }
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchTemplates();
    }
  }, [user, isAdmin]);

  const fetchTemplates = async () => {
    setIsLoadingData(true);
    const { data, error } = await supabase
      .from('message_templates')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching templates:', error);
      toast.error('ไม่สามารถโหลดเทมเพลตได้');
    } else {
      setTemplates(data || []);
    }
    setIsLoadingData(false);
  };

  const openCreateDialog = () => {
    setEditingTemplate(null);
    setFormData({
      name: '',
      content: '',
      category: 'general',
      is_active: true,
      sort_order: templates.length + 1,
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (template: MessageTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      content: template.content,
      category: template.category,
      is_active: template.is_active,
      sort_order: template.sort_order,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.content.trim()) {
      toast.error('กรุณากรอกชื่อและเนื้อหาเทมเพลต');
      return;
    }

    setIsSaving(true);

    try {
      if (editingTemplate) {
        const { error } = await supabase
          .from('message_templates')
          .update({
            name: formData.name.trim(),
            content: formData.content.trim(),
            category: formData.category,
            is_active: formData.is_active,
            sort_order: formData.sort_order,
          })
          .eq('id', editingTemplate.id);

        if (error) throw error;
        toast.success('อัปเดตเทมเพลตสำเร็จ');
      } else {
        const { error } = await supabase
          .from('message_templates')
          .insert({
            name: formData.name.trim(),
            content: formData.content.trim(),
            category: formData.category,
            is_active: formData.is_active,
            sort_order: formData.sort_order,
          });

        if (error) throw error;
        toast.success('สร้างเทมเพลตสำเร็จ');
      }

      await invalidateCache(['all']);
      setIsDialogOpen(false);
      fetchTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('ต้องการลบเทมเพลตนี้หรือไม่?')) return;

    try {
      const { error } = await supabase
        .from('message_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await invalidateCache(['all']);
      toast.success('ลบเทมเพลตสำเร็จ');
      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('เกิดข้อผิดพลาดในการลบ');
    }
  };

  const handleToggleActive = async (id: string, currentState: boolean) => {
    try {
      const { error } = await supabase
        .from('message_templates')
        .update({ is_active: !currentState })
        .eq('id', id);

      if (error) throw error;
      
      await invalidateCache(['all']);
      setTemplates(prev => 
        prev.map(t => t.id === id ? { ...t, is_active: !currentState } : t)
      );
      toast.success(currentState ? 'ปิดใช้งานเทมเพลต' : 'เปิดใช้งานเทมเพลต');
    } catch (error) {
      console.error('Error toggling template:', error);
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('คัดลอกข้อความแล้ว');
  };

  const getCategoryBadge = (category: string) => {
    const option = categoryOptions.find(c => c.value === category);
    const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
      order: 'default',
      general: 'secondary',
      promo: 'outline',
      support: 'secondary',
    };
    return <Badge variant={variants[category] || 'secondary'}>{option?.label || category}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin && !isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <MessageSquareText className="w-8 h-8 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
            <p className="text-muted-foreground">
              คุณยังไม่ได้รับสิทธิ์ Admin กรุณาติดต่อผู้ดูแลระบบ
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <AdminLayout title="เทมเพลตข้อความ">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-muted-foreground">
            จัดการเทมเพลตข้อความสำหรับส่งให้ลูกค้า
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={fetchTemplates} disabled={isLoadingData}>
            <RefreshCw className={`w-4 h-4 ${isLoadingData ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />
            เพิ่มเทมเพลต
          </Button>
        </div>
      </div>

      {/* Templates List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquareText className="w-5 h-5" />
            เทมเพลตทั้งหมด ({templates.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquareText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>ยังไม่มีเทมเพลต</p>
              <Button variant="link" onClick={openCreateDialog}>
                สร้างเทมเพลตแรก
              </Button>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-3">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className={`flex items-start gap-4 p-4 rounded-lg border transition-colors ${
                      template.is_active ? 'bg-card' : 'bg-muted/50 opacity-60'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-medium">{template.name}</span>
                        {getCategoryBadge(template.category)}
                        {!template.is_active && (
                          <Badge variant="outline" className="text-muted-foreground">
                            ปิดใช้งาน
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {template.content}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Switch
                        checked={template.is_active}
                        onCheckedChange={() => handleToggleActive(template.id, template.is_active)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(template.content)}
                        title="คัดลอก"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(template)}
                        title="แก้ไข"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(template.id)}
                        title="ลบ"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'แก้ไขเทมเพลต' : 'สร้างเทมเพลตใหม่'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">ชื่อเทมเพลต</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="เช่น ยืนยันออเดอร์"
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">หมวดหมู่</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">เนื้อหาข้อความ</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="พิมพ์ข้อความเทมเพลต..."
                rows={5}
                maxLength={1000}
              />
              <p className="text-xs text-muted-foreground text-right">
                {formData.content.length}/1000
              </p>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">เปิดใช้งาน</Label>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                className="flex-1"
              >
                ยกเลิก
              </Button>
              <Button onClick={handleSave} disabled={isSaving} className="flex-1">
                {isSaving ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  'บันทึก'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
