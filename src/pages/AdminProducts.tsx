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
import { AdminLayout } from '@/components/admin/AdminLayout';
import { 
  Package, 
  Plus, 
  Pencil, 
  Trash2, 
  RefreshCw,
  ImageIcon,
  Search,
  Upload,
  X
} from 'lucide-react';
import { toast } from 'sonner';

interface ProductVariant {
  name: string;
  options: string[];
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  specifications: string | null;
  price: number;
  promotion_price: number | null;
  stock: number;
  category: string | null;
  image_url: string | null;
  is_active: boolean;
  variants: ProductVariant[] | null;
  delivery_type: string;
  created_at: string;
  updated_at: string;
}

interface ProductFormData {
  name: string;
  description: string;
  specifications: string;
  price: string;
  promotion_price: string;
  stock: string;
  category: string;
  image_url: string;
  is_active: boolean;
  variants: ProductVariant[];
  delivery_type: string;
}

const deliveryTypeOptions = [
  { value: 'shipping', label: '📦 จัดส่ง', desc: 'ต้องระบุที่อยู่จัดส่ง' },
  { value: 'pickup', label: '🏪 รับหน้าร้าน', desc: 'ไม่ต้องจัดส่ง' },
  { value: 'digital', label: '💻 สินค้าดิจิทัล', desc: 'ส่งทางออนไลน์' },
  { value: 'booking', label: '📅 จองบริการ', desc: 'ใช้ระบบจองคิว' },
];

const initialFormData: ProductFormData = {
  name: '',
  description: '',
  specifications: '',
  price: '',
  promotion_price: '',
  stock: '0',
  category: '',
  image_url: '',
  is_active: true,
  variants: [],
  delivery_type: 'shipping',
};

export default function AdminProducts() {
  const { user, isAdmin, isLoading } = useAuth();
  const { invalidateCache } = useCacheInvalidation();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<ProductFormData>(initialFormData);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/admin');
    }
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchProducts();
    }
  }, [user, isAdmin]);

  const fetchProducts = async () => {
    setIsLoadingData(true);
    
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching products:', error);
      toast.error('ไม่สามารถโหลดข้อมูลสินค้าได้');
    } else {
      // Cast variants from Json to ProductVariant[]
      const productsWithVariants = (data || []).map(p => ({
        ...p,
        variants: (p.variants as unknown as ProductVariant[]) || []
      }));
      setProducts(productsWithVariants);
    }
    
    setIsLoadingData(false);
  };


  const openCreateDialog = () => {
    setSelectedProduct(null);
    setFormData(initialFormData);
    setIsDialogOpen(true);
  };

  const openEditDialog = (product: Product) => {
    setSelectedProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      specifications: product.specifications || '',
      price: product.price.toString(),
      promotion_price: product.promotion_price?.toString() || '',
      stock: product.stock.toString(),
      category: product.category || '',
      image_url: product.image_url || '',
      is_active: product.is_active,
      variants: (product.variants as ProductVariant[]) || [],
      delivery_type: product.delivery_type || 'shipping',
    });
    setIsDialogOpen(true);
  };

  const openDeleteDialog = (product: Product) => {
    setSelectedProduct(product);
    setIsDeleteDialogOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('กรุณาเลือกไฟล์รูปภาพเท่านั้น');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('ขนาดไฟล์ต้องไม่เกิน 5MB');
      return;
    }

    setIsUploading(true);

    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `products/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      setFormData({ ...formData, image_url: publicUrl });
      toast.success('อัพโหลดรูปภาพสำเร็จ');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('เกิดข้อผิดพลาดในการอัพโหลดรูปภาพ');
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = () => {
    setFormData({ ...formData, image_url: '' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('กรุณากรอกชื่อสินค้า');
      return;
    }

    if (!formData.price || Number(formData.price) < 0) {
      toast.error('กรุณากรอกราคาที่ถูกต้อง');
      return;
    }

    setIsSaving(true);

    const productData = {
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      specifications: formData.specifications.trim() || null,
      price: Number(formData.price),
      promotion_price: formData.promotion_price ? Number(formData.promotion_price) : null,
      stock: Number(formData.stock) || 0,
      category: formData.category.trim() || null,
      image_url: formData.image_url.trim() || null,
      is_active: formData.is_active,
      variants: formData.variants.length > 0 ? JSON.parse(JSON.stringify(formData.variants)) : [],
    };

    try {
      if (selectedProduct) {
        // Update existing product
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', selectedProduct.id);

        if (error) throw error;
        toast.success('อัพเดทสินค้าสำเร็จ');
      } else {
        // Create new product
        const { error } = await supabase
          .from('products')
          .insert(productData);

        if (error) throw error;
        toast.success('เพิ่มสินค้าสำเร็จ');
      }

      // Invalidate edge function cache
      await invalidateCache(['products']);
      
      setIsDialogOpen(false);
      fetchProducts();
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedProduct) return;

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', selectedProduct.id);

      if (error) throw error;
      
      // Invalidate edge function cache
      await invalidateCache(['products']);
      
      toast.success('ลบสินค้าสำเร็จ');
      setIsDeleteDialogOpen(false);
      fetchProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('เกิดข้อผิดพลาดในการลบ');
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
              <Package className="w-8 h-8 text-destructive" />
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
    <AdminLayout title="จัดการสินค้า">
      {/* Actions Bar */}
      <div className="flex gap-2 mb-4 sm:mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="ค้นหาสินค้า..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-9 sm:h-10"
          />
        </div>
        <Button variant="outline" size="icon" onClick={fetchProducts} disabled={isLoadingData} className="h-9 w-9 sm:h-10 sm:w-10 shrink-0">
          <RefreshCw className={`w-4 h-4 ${isLoadingData ? 'animate-spin' : ''}`} />
        </Button>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog} className="gap-2 h-9 sm:h-10 px-3 sm:px-4 shrink-0">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">เพิ่มสินค้า</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6">
            <DialogHeader className="pb-2">
              <DialogTitle className="text-base sm:text-lg">
                {selectedProduct ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-sm">ชื่อสินค้า *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="กรอกชื่อสินค้า"
                  maxLength={200}
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description" className="text-sm">รายละเอียด</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="กรอกรายละเอียดสินค้า"
                  rows={2}
                  maxLength={1000}
                  className="min-h-[60px]"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="specifications" className="text-sm">รายละเอียดเพิ่มเติม (สเปค)</Label>
                <Textarea
                  id="specifications"
                  value={formData.specifications}
                  onChange={(e) => setFormData({ ...formData, specifications: e.target.value })}
                  placeholder="เช่น วัสดุ: ผ้าฝ้าย 100%&#10;ขนาด: S, M, L, XL&#10;น้ำหนัก: 200 กรัม&#10;วิธีดูแลรักษา: ซักมือหรือเครื่อง อุณหภูมิไม่เกิน 30°C"
                  rows={4}
                  maxLength={2000}
                  className="min-h-[100px]"
                />
                <p className="text-xs text-muted-foreground">
                  ใส่ข้อมูลเชิงลึกเช่น วัสดุ ขนาด น้ำหนัก วิธีดูแลรักษา เพื่อให้บอทตอบคำถามได้ละเอียดขึ้น
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="price" className="text-sm">ราคา (฿) *</Label>
                  <Input
                    id="price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="0.00"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="promotion_price" className="text-sm">ราคาโปรฯ (฿)</Label>
                  <Input
                    id="promotion_price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.promotion_price}
                    onChange={(e) => setFormData({ ...formData, promotion_price: e.target.value })}
                    placeholder="0.00"
                    className="h-9"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="stock" className="text-sm">จำนวนสต็อก</Label>
                  <Input
                    id="stock"
                    type="number"
                    min="0"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    placeholder="0"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="category" className="text-sm">หมวดหมู่</Label>
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="เช่น เสื้อผ้า"
                    maxLength={100}
                    className="h-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">รูปภาพสินค้า</Label>
                
                {formData.image_url ? (
                  <div className="relative inline-block">
                    <img 
                      src={formData.image_url} 
                      alt="Product preview" 
                      className="w-24 h-24 sm:w-32 sm:h-32 object-cover rounded-lg border"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 w-6 h-6"
                      onClick={removeImage}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <label className="cursor-pointer">
                      <div className="flex items-center justify-center gap-2 px-4 py-6 sm:py-8 border-2 border-dashed rounded-lg hover:bg-muted/50 transition-colors">
                        {isUploading ? (
                          <RefreshCw className="w-5 h-5 animate-spin" />
                        ) : (
                          <>
                            <Upload className="w-5 h-5 text-muted-foreground" />
                            <span className="text-xs sm:text-sm text-muted-foreground">คลิกเพื่ออัพโหลดรูป</span>
                          </>
                        )}
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={isUploading}
                        className="hidden"
                      />
                    </label>
                    <span className="text-xs text-muted-foreground text-center">
                      JPG, PNG, WEBP (ไม่เกิน 5MB)
                    </span>
                  </div>
                )}

                {/* Alternative: URL input */}
                <div className="pt-2">
                  <Label htmlFor="image_url" className="text-xs text-muted-foreground">หรือกรอก URL</Label>
                  <Input
                    id="image_url"
                    type="url"
                    value={formData.image_url}
                    onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                    placeholder="https://example.com/image.jpg"
                    className="mt-1 h-9"
                  />
                </div>
              </div>

              {/* Product Variants Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">ตัวเลือกสินค้า</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        variants: [...formData.variants, { name: '', options: [''] }]
                      });
                    }}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    เพิ่ม
                  </Button>
                </div>
                
                {formData.variants.map((variant, variantIndex) => (
                  <div key={variantIndex} className="p-2 sm:p-3 border rounded-lg space-y-2 bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Input
                        value={variant.name}
                        onChange={(e) => {
                          const newVariants = [...formData.variants];
                          newVariants[variantIndex].name = e.target.value;
                          setFormData({ ...formData, variants: newVariants });
                        }}
                        placeholder="ชื่อ (เช่น สี, ไซส์)"
                        className="flex-1 h-8 text-sm"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                        onClick={() => {
                          const newVariants = formData.variants.filter((_, i) => i !== variantIndex);
                          setFormData({ ...formData, variants: newVariants });
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    <div className="flex flex-wrap gap-1.5 items-center">
                      {variant.options.map((option, optionIndex) => (
                        <div key={optionIndex} className="flex items-center gap-0.5">
                          <Input
                            value={option}
                            onChange={(e) => {
                              const newVariants = [...formData.variants];
                              newVariants[variantIndex].options[optionIndex] = e.target.value;
                              setFormData({ ...formData, variants: newVariants });
                            }}
                            placeholder="ค่า"
                            className="w-20 sm:w-24 h-7 text-sm"
                          />
                          {variant.options.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => {
                                const newVariants = [...formData.variants];
                                newVariants[variantIndex].options = variant.options.filter((_, i) => i !== optionIndex);
                                setFormData({ ...formData, variants: newVariants });
                              }}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs px-2"
                        onClick={() => {
                          const newVariants = [...formData.variants];
                          newVariants[variantIndex].options.push('');
                          setFormData({ ...formData, variants: newVariants });
                        }}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
                
                {formData.variants.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    ยังไม่มีตัวเลือกสินค้า
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between py-1">
                <Label htmlFor="is_active" className="text-sm">เปิดใช้งาน</Label>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
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
                  ) : selectedProduct ? (
                    'บันทึก'
                  ) : (
                    'เพิ่มสินค้า'
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Products Stats */}
      <div className="grid grid-cols-4 gap-2 sm:gap-3 lg:gap-4 mb-4 sm:mb-6">
        <Card>
          <CardContent className="p-2 sm:p-4">
            <div className="text-center">
              <p className="text-lg sm:text-xl lg:text-2xl font-bold">{products.length}</p>
              <p className="text-[10px] sm:text-xs lg:text-sm text-muted-foreground">ทั้งหมด</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-2 sm:p-4">
            <div className="text-center">
              <p className="text-lg sm:text-xl lg:text-2xl font-bold text-green-600">
                {products.filter(p => p.is_active).length}
              </p>
              <p className="text-[10px] sm:text-xs lg:text-sm text-muted-foreground">เปิดใช้งาน</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-2 sm:p-4">
            <div className="text-center">
              <p className="text-lg sm:text-xl lg:text-2xl font-bold text-orange-500">
                {products.filter(p => p.stock <= 5).length}
              </p>
              <p className="text-[10px] sm:text-xs lg:text-sm text-muted-foreground">สต็อกต่ำ</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-2 sm:p-4">
            <div className="text-center">
              <p className="text-lg sm:text-xl lg:text-2xl font-bold text-red-500">
                {products.filter(p => p.stock === 0).length}
              </p>
              <p className="text-[10px] sm:text-xs lg:text-sm text-muted-foreground">หมดสต็อก</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Products List */}
      <Card>
        <CardHeader className="py-3 px-3 sm:px-6 sm:py-4">
          <CardTitle className="text-sm sm:text-base lg:text-lg">รายการสินค้า ({filteredProducts.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-4 lg:p-6 lg:pt-0">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-8 sm:py-12 text-muted-foreground">
              <Package className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 opacity-50" />
              <p className="text-sm sm:text-base">{searchQuery ? 'ไม่พบสินค้าที่ค้นหา' : 'ยังไม่มีสินค้า'}</p>
              {!searchQuery && (
                <Button onClick={openCreateDialog} className="mt-3 sm:mt-4 gap-2 h-9">
                  <Plus className="w-4 h-4" />
                  เพิ่มสินค้าแรก
                </Button>
              )}
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-320px)] sm:h-[calc(100vh-340px)] lg:h-[calc(100vh-360px)]">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 px-3 sm:px-4 lg:px-0 pb-4">
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    className="flex flex-col rounded-xl border bg-card overflow-hidden hover:shadow-lg transition-all duration-200 group"
                  >
                    {/* Product Image */}
                    <div className="relative aspect-square bg-muted overflow-hidden">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '';
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="w-10 h-10 sm:w-12 sm:h-12 text-muted-foreground/50" />
                        </div>
                      )}
                      
                      {/* Status Badge */}
                      {!product.is_active && (
                        <Badge variant="secondary" className="absolute top-2 left-2 text-[10px] sm:text-xs">
                          ปิดใช้งาน
                        </Badge>
                      )}
                      
                      {/* Promotion Badge */}
                      {product.promotion_price && (
                        <Badge className="absolute top-2 right-2 bg-destructive text-destructive-foreground text-[10px] sm:text-xs">
                          ลด {Math.round(((product.price - product.promotion_price) / product.price) * 100)}%
                        </Badge>
                      )}
                      
                      {/* Stock Warning */}
                      {product.stock === 0 && (
                        <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                          <Badge variant="destructive" className="text-xs sm:text-sm">หมดสต็อก</Badge>
                        </div>
                      )}
                    </div>
                    
                    {/* Product Info */}
                    <div className="flex-1 p-2.5 sm:p-3 space-y-1.5">
                      <h3 className="font-medium text-xs sm:text-sm line-clamp-2 leading-tight">{product.name}</h3>
                      
                      {/* Price */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {product.promotion_price ? (
                          <>
                            <span className="font-bold text-sm sm:text-base text-primary">
                              ฿{product.promotion_price.toLocaleString()}
                            </span>
                            <span className="text-[10px] sm:text-xs line-through text-muted-foreground">
                              ฿{product.price.toLocaleString()}
                            </span>
                          </>
                        ) : (
                          <span className="font-bold text-sm sm:text-base">
                            ฿{product.price.toLocaleString()}
                          </span>
                        )}
                      </div>
                      
                      {/* Stock & Category */}
                      <div className="flex items-center justify-between text-[10px] sm:text-xs text-muted-foreground">
                        <span className={product.stock <= 5 ? (product.stock === 0 ? 'text-destructive' : 'text-orange-500') : ''}>
                          สต็อก: {product.stock}
                        </span>
                        {product.category && (
                          <span className="truncate max-w-[60%]">{product.category}</span>
                        )}
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex border-t">
                      <Button
                        variant="ghost"
                        className="flex-1 h-9 sm:h-10 rounded-none text-xs sm:text-sm gap-1.5 hover:bg-muted"
                        onClick={() => openEditDialog(product)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        แก้ไข
                      </Button>
                      <div className="w-px bg-border" />
                      <Button
                        variant="ghost"
                        className="flex-1 h-9 sm:h-10 rounded-none text-xs sm:text-sm gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => openDeleteDialog(product)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        ลบ
                      </Button>
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
        <AlertDialogContent className="w-[90vw] max-w-md p-4 sm:p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg">ยืนยันการลบสินค้า</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              คุณต้องการลบ "{selectedProduct?.name}" หรือไม่?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="h-9 sm:h-10">ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="h-9 sm:h-10 bg-destructive text-destructive-foreground hover:bg-destructive/90">
              ลบสินค้า
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
