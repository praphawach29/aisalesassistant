import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCacheInvalidation } from '@/hooks/useCacheInvalidation';
import { supabase } from '@/integrations/supabase/client';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { 
  HelpCircle, 
  Plus, 
  Pencil, 
  Trash2, 
  RefreshCw,
  Search,
  Package,
  MessageCircleQuestion,
  Sparkles,
  Wand2
} from 'lucide-react';
import { toast } from 'sonner';

interface Product {
  id: string;
  name: string;
  image_url: string | null;
  specifications: string | null;
  description: string | null;
}

interface ProductFAQ {
  id: string;
  product_id: string;
  question: string;
  answer: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  products?: Product;
}

interface FAQFormData {
  product_id: string;
  question: string;
  answer: string;
  sort_order: string;
  is_active: boolean;
}

const initialFormData: FAQFormData = {
  product_id: '',
  question: '',
  answer: '',
  sort_order: '0',
  is_active: true,
};

export default function AdminProductFAQs() {
  const { user, isAdmin, isLoading } = useAuth();
  const { invalidateCache } = useCacheInvalidation();
  const navigate = useNavigate();
  const [faqs, setFaqs] = useState<ProductFAQ[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProductId, setFilterProductId] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedFAQ, setSelectedFAQ] = useState<ProductFAQ | null>(null);
  const [formData, setFormData] = useState<FAQFormData>(initialFormData);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAutoGenDialogOpen, setIsAutoGenDialogOpen] = useState(false);
  const [selectedProductForGen, setSelectedProductForGen] = useState<string>('');

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/admin');
    }
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchData();
    }
  }, [user, isAdmin]);

  const fetchData = async () => {
    setIsLoadingData(true);
    
    // Fetch products and FAQs in parallel
    const [productsRes, faqsRes] = await Promise.all([
      supabase
        .from('products')
        .select('id, name, image_url, specifications, description')
        .order('name'),
      supabase
        .from('product_faqs')
        .select('*, products:product_id(id, name, image_url, specifications, description)')
        .order('sort_order')
    ]);

    if (productsRes.error) {
      console.error('Error fetching products:', productsRes.error);
      toast.error('ไม่สามารถโหลดข้อมูลสินค้าได้');
    } else {
      setProducts(productsRes.data || []);
    }

    if (faqsRes.error) {
      console.error('Error fetching FAQs:', faqsRes.error);
      toast.error('ไม่สามารถโหลดข้อมูล FAQ ได้');
    } else {
      setFaqs(faqsRes.data || []);
    }
    
    setIsLoadingData(false);
  };

  const openCreateDialog = () => {
    setSelectedFAQ(null);
    setFormData(initialFormData);
    setIsDialogOpen(true);
  };

  const openEditDialog = (faq: ProductFAQ) => {
    setSelectedFAQ(faq);
    setFormData({
      product_id: faq.product_id,
      question: faq.question,
      answer: faq.answer,
      sort_order: faq.sort_order.toString(),
      is_active: faq.is_active,
    });
    setIsDialogOpen(true);
  };

  const openDeleteDialog = (faq: ProductFAQ) => {
    setSelectedFAQ(faq);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.product_id) {
      toast.error('กรุณาเลือกสินค้า');
      return;
    }

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
      product_id: formData.product_id,
      question: formData.question.trim(),
      answer: formData.answer.trim(),
      sort_order: Number(formData.sort_order) || 0,
      is_active: formData.is_active,
    };

    try {
      if (selectedFAQ) {
        const { error } = await supabase
          .from('product_faqs')
          .update(faqData)
          .eq('id', selectedFAQ.id);

        if (error) throw error;
        toast.success('อัพเดท FAQ สำเร็จ');
      } else {
        const { error } = await supabase
          .from('product_faqs')
          .insert(faqData);

        if (error) throw error;
        toast.success('เพิ่ม FAQ สำเร็จ');
      }

      await invalidateCache(['product_faqs']);
      setIsDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving FAQ:', error);
      toast.error('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedFAQ) return;

    try {
      const { error } = await supabase
        .from('product_faqs')
        .delete()
        .eq('id', selectedFAQ.id);

      if (error) throw error;
      
      await invalidateCache(['product_faqs']);
      toast.success('ลบ FAQ สำเร็จ');
      setIsDeleteDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error deleting FAQ:', error);
      toast.error('เกิดข้อผิดพลาดในการลบ');
    }
  };

  const toggleActive = async (faq: ProductFAQ) => {
    try {
      const { error } = await supabase
        .from('product_faqs')
        .update({ is_active: !faq.is_active })
        .eq('id', faq.id);

      if (error) throw error;
      
      await invalidateCache(['product_faqs']);
      toast.success(faq.is_active ? 'ปิดใช้งาน FAQ แล้ว' : 'เปิดใช้งาน FAQ แล้ว');
      fetchData();
    } catch (error) {
      console.error('Error toggling FAQ:', error);
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  const handleAutoGenerate = async () => {
    if (!selectedProductForGen) {
      toast.error('กรุณาเลือกสินค้า');
      return;
    }

    const product = products.find(p => p.id === selectedProductForGen);
    if (!product?.description && !product?.specifications) {
      toast.error('สินค้านี้ไม่มี description หรือ specifications กรุณาเพิ่มข้อมูลก่อน');
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-product-faq', {
        body: { productId: selectedProductForGen }
      });

      if (error) throw error;

      if (data?.error) {
        if (data.error.includes('Rate limit')) {
          toast.error('เกินขีดจำกัดการใช้งาน กรุณาลองใหม่อีกครั้ง');
        } else if (data.error.includes('Payment required')) {
          toast.error('กรุณาเติมเครดิต Lovable AI');
        } else {
          toast.error(data.error);
        }
        return;
      }

      await invalidateCache(['product_faqs']);
      toast.success(`สร้าง FAQ อัตโนมัติสำเร็จ ${data.count} รายการ`);
      setIsAutoGenDialogOpen(false);
      setSelectedProductForGen('');
      fetchData();
    } catch (error) {
      console.error('Error generating FAQs:', error);
      toast.error('เกิดข้อผิดพลาดในการสร้าง FAQ');
    } finally {
      setIsGenerating(false);
    }
  };

  // Get products with specs for auto-generate
  const productsWithSpecs = products.filter(p => p.description || p.specifications);


  const filteredFaqs = faqs.filter(faq => {
    const matchesSearch = 
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.products?.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesProduct = filterProductId === 'all' || faq.product_id === filterProductId;
    
    return matchesSearch && matchesProduct;
  });

  // Group FAQs by product
  const groupedFaqs = filteredFaqs.reduce((acc, faq) => {
    const productName = faq.products?.name || 'ไม่ระบุสินค้า';
    if (!acc[productName]) {
      acc[productName] = [];
    }
    acc[productName].push(faq);
    return acc;
  }, {} as Record<string, ProductFAQ[]>);

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
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <AdminLayout title="Product FAQ">
      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4 sm:mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="ค้นหาคำถาม..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-9 sm:h-10"
          />
        </div>
        <Select value={filterProductId} onValueChange={setFilterProductId}>
          <SelectTrigger className="w-full sm:w-[200px] h-9 sm:h-10">
            <SelectValue placeholder="เลือกสินค้า" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกสินค้า</SelectItem>
            {products.map((product) => (
              <SelectItem key={product.id} value={product.id}>
                {product.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={fetchData} disabled={isLoadingData} className="h-9 w-9 sm:h-10 sm:w-10 shrink-0">
          <RefreshCw className={`w-4 h-4 ${isLoadingData ? 'animate-spin' : ''}`} />
        </Button>

        {/* Auto Generate Dialog */}
        <Dialog open={isAutoGenDialogOpen} onOpenChange={setIsAutoGenDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              variant="outline" 
              className="gap-2 h-9 sm:h-10 px-3 sm:px-4 shrink-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-300 hover:from-purple-500/20 hover:to-pink-500/20"
              onClick={() => setSelectedProductForGen('')}
            >
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span className="hidden sm:inline">AI สร้าง FAQ</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[95vw] max-w-md p-4 sm:p-6">
            <DialogHeader className="pb-2">
              <DialogTitle className="text-base sm:text-lg flex items-center gap-2">
                <Wand2 className="w-5 h-5 text-purple-600" />
                สร้าง FAQ อัตโนมัติด้วย AI
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                AI จะวิเคราะห์ข้อมูลสินค้า (description และ specifications) เพื่อสร้างคำถาม-คำตอบที่พบบ่อยโดยอัตโนมัติ 3-5 รายการ
              </p>
              
              <div className="space-y-1.5">
                <Label className="text-sm">เลือกสินค้า *</Label>
                <Select 
                  value={selectedProductForGen} 
                  onValueChange={setSelectedProductForGen}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="เลือกสินค้าที่ต้องการสร้าง FAQ" />
                  </SelectTrigger>
                  <SelectContent>
                    {productsWithSpecs.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground text-center">
                        ไม่มีสินค้าที่มีข้อมูล description หรือ specifications
                      </div>
                    ) : (
                      productsWithSpecs.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          <div className="flex items-center gap-2">
                            {product.image_url ? (
                              <img src={product.image_url} className="w-5 h-5 rounded object-cover" alt="" />
                            ) : (
                              <Package className="w-5 h-5 text-muted-foreground" />
                            )}
                            <span>{product.name}</span>
                            {product.specifications && (
                              <Badge variant="secondary" className="text-[10px] px-1">มี specs</Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {selectedProductForGen && (
                <div className="bg-muted/50 rounded-lg p-3 text-sm">
                  <p className="font-medium mb-1">ข้อมูลที่จะใช้สร้าง FAQ:</p>
                  {(() => {
                    const p = products.find(p => p.id === selectedProductForGen);
                    return (
                      <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                        {p?.description && <li>Description: มี</li>}
                        {p?.specifications && <li>Specifications: มี</li>}
                      </ul>
                    );
                  })()}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsAutoGenDialogOpen(false)}
                  className="flex-1 h-9 sm:h-10"
                  disabled={isGenerating}
                >
                  ยกเลิก
                </Button>
                <Button 
                  onClick={handleAutoGenerate} 
                  disabled={isGenerating || !selectedProductForGen}
                  className="flex-1 h-9 sm:h-10 gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      กำลังสร้าง...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      สร้าง FAQ
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog} className="gap-2 h-9 sm:h-10 px-3 sm:px-4 shrink-0">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">เพิ่ม FAQ</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6">
            <DialogHeader className="pb-2">
              <DialogTitle className="text-base sm:text-lg">
                {selectedFAQ ? 'แก้ไข FAQ' : 'เพิ่ม FAQ ใหม่'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm">สินค้า *</Label>
                <Select 
                  value={formData.product_id} 
                  onValueChange={(value) => setFormData({ ...formData, product_id: value })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="เลือกสินค้า" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        <div className="flex items-center gap-2">
                          {product.image_url ? (
                            <img src={product.image_url} className="w-5 h-5 rounded object-cover" alt="" />
                          ) : (
                            <Package className="w-5 h-5 text-muted-foreground" />
                          )}
                          <span>{product.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="question" className="text-sm">คำถาม *</Label>
                <Textarea
                  id="question"
                  value={formData.question}
                  onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                  placeholder="เช่น สินค้านี้ทำจากวัสดุอะไร?"
                  rows={2}
                  maxLength={500}
                  className="min-h-[60px]"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="answer" className="text-sm">คำตอบ *</Label>
                <Textarea
                  id="answer"
                  value={formData.answer}
                  onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                  placeholder="กรอกคำตอบโดยละเอียด..."
                  rows={4}
                  maxLength={2000}
                  className="min-h-[100px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="sort_order" className="text-sm">ลำดับ</Label>
                  <Input
                    id="sort_order"
                    type="number"
                    min="0"
                    value={formData.sort_order}
                    onChange={(e) => setFormData({ ...formData, sort_order: e.target.value })}
                    placeholder="0"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5 flex items-end">
                  <div className="flex items-center justify-between w-full pb-1">
                    <Label htmlFor="is_active" className="text-sm">เปิดใช้งาน</Label>
                    <Switch
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                  className="flex-1 h-9 sm:h-10"
                >
                  ยกเลิก
                </Button>
                <Button type="submit" disabled={isSaving} className="flex-1 h-9 sm:h-10">
                  {isSaving ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : selectedFAQ ? (
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

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
        <Card>
          <CardContent className="p-2 sm:p-4">
            <div className="text-center">
              <p className="text-lg sm:text-2xl font-bold">{faqs.length}</p>
              <p className="text-[10px] sm:text-sm text-muted-foreground">FAQ ทั้งหมด</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-2 sm:p-4">
            <div className="text-center">
              <p className="text-lg sm:text-2xl font-bold text-green-600">
                {faqs.filter(f => f.is_active).length}
              </p>
              <p className="text-[10px] sm:text-sm text-muted-foreground">เปิดใช้งาน</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-2 sm:p-4">
            <div className="text-center">
              <p className="text-lg sm:text-2xl font-bold text-blue-600">
                {new Set(faqs.map(f => f.product_id)).size}
              </p>
              <p className="text-[10px] sm:text-sm text-muted-foreground">สินค้าที่มี FAQ</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FAQ List */}
      <Card>
        <CardHeader className="py-3 px-3 sm:px-6 sm:py-4">
          <CardTitle className="text-sm sm:text-base lg:text-lg flex items-center gap-2">
            <MessageCircleQuestion className="w-4 h-4 sm:w-5 sm:h-5" />
            คำถามเฉพาะสินค้า ({filteredFaqs.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-4 lg:p-6 lg:pt-0">
          {filteredFaqs.length === 0 ? (
            <div className="text-center py-8 sm:py-12 text-muted-foreground">
              <HelpCircle className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 opacity-50" />
              <p className="text-sm sm:text-base">{searchQuery ? 'ไม่พบ FAQ ที่ค้นหา' : 'ยังไม่มี FAQ'}</p>
              {!searchQuery && (
                <Button onClick={openCreateDialog} className="mt-3 sm:mt-4 gap-2 h-9">
                  <Plus className="w-4 h-4" />
                  เพิ่ม FAQ แรก
                </Button>
              )}
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-380px)]">
              <div className="space-y-4 px-3 sm:px-4 lg:px-0 pb-4">
                {Object.entries(groupedFaqs).map(([productName, productFaqs]) => (
                  <div key={productName} className="space-y-2">
                    <div className="flex items-center gap-2 sticky top-0 bg-background py-2">
                      <Package className="w-4 h-4 text-muted-foreground" />
                      <h3 className="font-medium text-sm">{productName}</h3>
                      <Badge variant="secondary" className="text-xs">
                        {productFaqs.length} FAQ
                      </Badge>
                    </div>
                    
                    {productFaqs.map((faq) => (
                      <div
                        key={faq.id}
                        className={`p-3 sm:p-4 rounded-lg border ${
                          faq.is_active ? 'bg-card' : 'bg-muted/50 opacity-60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant={faq.is_active ? 'default' : 'secondary'} className="text-[10px]">
                                {faq.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                              </Badge>
                            </div>
                            <p className="font-medium text-sm mb-1">{faq.question}</p>
                            <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">{faq.answer}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Switch
                              checked={faq.is_active}
                              onCheckedChange={() => toggleActive(faq)}
                              className="scale-75"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEditDialog(faq)}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => openDeleteDialog(faq)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="w-[90vw] max-w-md p-4 sm:p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg">ยืนยันการลบ FAQ</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              คุณต้องการลบคำถาม "{selectedFAQ?.question}" หรือไม่?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="h-9 sm:h-10">ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="h-9 sm:h-10 bg-destructive text-destructive-foreground hover:bg-destructive/90">
              ลบ FAQ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
