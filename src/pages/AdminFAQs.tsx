import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCacheInvalidation } from '@/hooks/useCacheInvalidation';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  HelpCircle, 
  Plus, 
  Pencil, 
  Trash2, 
  RefreshCw,
  Search,
  MessageSquare
} from 'lucide-react';
import { toast } from 'sonner';
import { FAQ } from '@/types';

interface FAQFormData {
  question: string;
  answer: string;
  category: string;
  is_active: boolean;
}

const initialFormData: FAQFormData = {
  question: '',
  answer: '',
  category: '',
  is_active: true,
};

export default function AdminFAQs() {
  const { user, isAdmin, isLoading, signOut } = useAuth();
  const { invalidateCache } = useCacheInvalidation();
  const navigate = useNavigate();
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedFaq, setSelectedFaq] = useState<FAQ | null>(null);
  const [formData, setFormData] = useState<FAQFormData>(initialFormData);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/admin');
    }
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchFaqs();
    }
  }, [user, isAdmin]);

  const fetchFaqs = async () => {
    setIsLoadingData(true);
    
    const { data, error } = await supabase
      .from('faqs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching FAQs:', error);
      toast.error('ไม่สามารถโหลดข้อมูล FAQ ได้');
    } else {
      setFaqs(data || []);
    }
    
    setIsLoadingData(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin');
  };

  const openCreateDialog = () => {
    setSelectedFaq(null);
    setFormData(initialFormData);
    setIsDialogOpen(true);
  };

  const openEditDialog = (faq: FAQ) => {
    setSelectedFaq(faq);
    setFormData({
      question: faq.question,
      answer: faq.answer,
      category: faq.category || '',
      is_active: faq.is_active,
    });
    setIsDialogOpen(true);
  };

  const openDeleteDialog = (faq: FAQ) => {
    setSelectedFaq(faq);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.question.trim()) {
      toast.error('กรุณากรอกคำถาม');
      return;
    }

    if (!formData.answer.trim()) {
      toast.error('กรุณากรอกคำตอบ');
      return;
    }

    setIsSaving(true);

    const faqData = {
      question: formData.question.trim(),
      answer: formData.answer.trim(),
      category: formData.category.trim() || null,
      is_active: formData.is_active,
    };

    try {
      if (selectedFaq) {
        // Update existing FAQ
        const { error } = await supabase
          .from('faqs')
          .update(faqData)
          .eq('id', selectedFaq.id);

        if (error) throw error;
        toast.success('อัพเดท FAQ สำเร็จ');
      } else {
        // Create new FAQ
        const { error } = await supabase
          .from('faqs')
          .insert(faqData);

        if (error) throw error;
        toast.success('เพิ่ม FAQ สำเร็จ');
      }

      // Invalidate edge function cache
      await invalidateCache(['faqs']);
      
      setIsDialogOpen(false);
      fetchFaqs();
    } catch (error) {
      console.error('Error saving FAQ:', error);
      toast.error('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedFaq) return;

    try {
      const { error } = await supabase
        .from('faqs')
        .delete()
        .eq('id', selectedFaq.id);

      if (error) throw error;
      
      // Invalidate edge function cache
      await invalidateCache(['faqs']);
      
      toast.success('ลบ FAQ สำเร็จ');
      setIsDeleteDialogOpen(false);
      fetchFaqs();
    } catch (error) {
      console.error('Error deleting FAQ:', error);
      toast.error('เกิดข้อผิดพลาดในการลบ');
    }
  };

  const filteredFaqs = faqs.filter(faq =>
    faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faq.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get unique categories
  const categories = [...new Set(faqs.filter(f => f.category).map(f => f.category))];

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
              <HelpCircle className="w-8 h-8 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
            <p className="text-muted-foreground mb-4">
              คุณยังไม่ได้รับสิทธิ์ Admin กรุณาติดต่อผู้ดูแลระบบ
            </p>
            <Button onClick={handleSignOut} variant="outline">
              ออกจากระบบ
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <AdminLayout title="จัดการ FAQ">
      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="ค้นหา FAQ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={fetchFaqs} disabled={isLoadingData}>
              <RefreshCw className={`w-4 h-4 ${isLoadingData ? 'animate-spin' : ''}`} />
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreateDialog} className="gap-2">
                  <Plus className="w-4 h-4" />
                  เพิ่ม FAQ
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {selectedFaq ? 'แก้ไข FAQ' : 'เพิ่ม FAQ ใหม่'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="question">คำถาม *</Label>
                    <Textarea
                      id="question"
                      value={formData.question}
                      onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                      placeholder="กรอกคำถาม"
                      rows={2}
                      maxLength={500}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="answer">คำตอบ *</Label>
                    <Textarea
                      id="answer"
                      value={formData.answer}
                      onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                      placeholder="กรอกคำตอบ"
                      rows={4}
                      maxLength={2000}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category">หมวดหมู่</Label>
                    <Input
                      id="category"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      placeholder="เช่น การชำระเงิน, การจัดส่ง"
                      list="category-list"
                      maxLength={100}
                    />
                    <datalist id="category-list">
                      {categories.map((cat) => (
                        <option key={cat} value={cat || ''} />
                      ))}
                    </datalist>
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
                    <Button type="submit" disabled={isSaving} className="flex-1">
                      {isSaving ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : selectedFaq ? (
                        'บันทึก'
                      ) : (
                        'เพิ่ม FAQ'
                      )}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-2xl font-bold">{faqs.length}</p>
                <p className="text-sm text-muted-foreground">FAQ ทั้งหมด</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  {faqs.filter(f => f.is_active).length}
                </p>
                <p className="text-sm text-muted-foreground">เปิดใช้งาน</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-muted-foreground">
                  {faqs.filter(f => !f.is_active).length}
                </p>
                <p className="text-sm text-muted-foreground">ปิดใช้งาน</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">
                  {categories.length}
                </p>
                <p className="text-sm text-muted-foreground">หมวดหมู่</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* FAQs List */}
        <Card>
          <CardHeader>
            <CardTitle>รายการ FAQ ({filteredFaqs.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredFaqs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <HelpCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{searchQuery ? 'ไม่พบ FAQ ที่ค้นหา' : 'ยังไม่มี FAQ'}</p>
                {!searchQuery && (
                  <Button onClick={openCreateDialog} className="mt-4 gap-2">
                    <Plus className="w-4 h-4" />
                    เพิ่ม FAQ แรก
                  </Button>
                )}
              </div>
            ) : (
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {filteredFaqs.map((faq) => (
                    <div
                      key={faq.id}
                      className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start gap-4">
                        {/* Icon */}
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <MessageSquare className="w-5 h-5 text-primary" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h3 className="font-medium">{faq.question}</h3>
                            {!faq.is_active && (
                              <Badge variant="secondary">ปิดใช้งาน</Badge>
                            )}
                          </div>
                          {faq.category && (
                            <Badge variant="outline" className="mb-2 text-xs">
                              {faq.category}
                            </Badge>
                          )}
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {faq.answer}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 flex-shrink-0">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => openEditDialog(faq)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => openDeleteDialog(faq)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบ FAQ</AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการลบ FAQ นี้หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              ลบ FAQ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
