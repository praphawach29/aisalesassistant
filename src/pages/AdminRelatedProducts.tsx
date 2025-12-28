import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, Link2, ArrowRight, Package } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  category: string | null;
  image_url: string | null;
  price: number;
}

interface RelatedProduct {
  id: string;
  product_id: string;
  related_product_id: string;
  created_at: string;
  product: Product;
  related_product: Product;
}

export default function AdminRelatedProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [relatedProducts, setRelatedProducts] = useState<RelatedProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [selectedRelated, setSelectedRelated] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch products
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, name, category, image_url, price')
        .eq('is_active', true)
        .order('name');

      if (productsError) throw productsError;
      setProducts(productsData || []);

      // Fetch related products with joins
      const { data: relatedData, error: relatedError } = await supabase
        .from('related_products')
        .select(`
          id,
          product_id,
          related_product_id,
          created_at
        `)
        .order('created_at', { ascending: false });

      if (relatedError) throw relatedError;

      // Map product details
      const mappedRelated = (relatedData || []).map(item => {
        const product = productsData?.find(p => p.id === item.product_id);
        const relatedProduct = productsData?.find(p => p.id === item.related_product_id);
        return {
          ...item,
          product: product || { id: item.product_id, name: 'Unknown', category: null, image_url: null, price: 0 },
          related_product: relatedProduct || { id: item.related_product_id, name: 'Unknown', category: null, image_url: null, price: 0 }
        };
      });

      setRelatedProducts(mappedRelated);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddRelation = async () => {
    if (!selectedProduct || !selectedRelated) {
      toast.error('กรุณาเลือกสินค้าทั้งสองรายการ');
      return;
    }

    if (selectedProduct === selectedRelated) {
      toast.error('ไม่สามารถเชื่อมโยงสินค้าเดียวกันได้');
      return;
    }

    // Check if relation already exists
    const exists = relatedProducts.some(
      rp => (rp.product_id === selectedProduct && rp.related_product_id === selectedRelated) ||
            (rp.product_id === selectedRelated && rp.related_product_id === selectedProduct)
    );

    if (exists) {
      toast.error('คู่สินค้านี้ถูกเชื่อมโยงไว้แล้ว');
      return;
    }

    setIsAdding(true);
    try {
      // Add bidirectional relation
      const { error } = await supabase
        .from('related_products')
        .insert([
          { product_id: selectedProduct, related_product_id: selectedRelated },
          { product_id: selectedRelated, related_product_id: selectedProduct }
        ]);

      if (error) throw error;

      toast.success('เพิ่มคู่สินค้าที่เกี่ยวข้องแล้ว');
      setSelectedProduct('');
      setSelectedRelated('');
      fetchData();
    } catch (error) {
      console.error('Error adding relation:', error);
      toast.error('ไม่สามารถเพิ่มคู่สินค้าได้');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteRelation = async (productId: string, relatedProductId: string) => {
    try {
      // Delete both directions
      const { error } = await supabase
        .from('related_products')
        .delete()
        .or(`and(product_id.eq.${productId},related_product_id.eq.${relatedProductId}),and(product_id.eq.${relatedProductId},related_product_id.eq.${productId})`);

      if (error) throw error;

      toast.success('ลบคู่สินค้าที่เกี่ยวข้องแล้ว');
      fetchData();
    } catch (error) {
      console.error('Error deleting relation:', error);
      toast.error('ไม่สามารถลบคู่สินค้าได้');
    }
  };

  // Get unique pairs (avoid showing A->B and B->A)
  const uniquePairs = relatedProducts.filter((rp, index, self) => {
    const reverseIndex = self.findIndex(
      item => item.product_id === rp.related_product_id && item.related_product_id === rp.product_id
    );
    return reverseIndex === -1 || index < reverseIndex;
  });

  return (
    <AdminLayout title="สินค้าที่เกี่ยวข้อง">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">สินค้าที่เกี่ยวข้อง</h1>
          <p className="text-muted-foreground">ตั้งค่าคู่สินค้าที่เกี่ยวข้องสำหรับแนะนำลูกค้า (Cross-sell)</p>
        </div>

        {/* Add new relation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              เพิ่มคู่สินค้าที่เกี่ยวข้อง
            </CardTitle>
            <CardDescription>
              เลือกสินค้า 2 รายการที่ต้องการเชื่อมโยง เมื่อลูกค้าสนใจสินค้าหนึ่ง บอทจะแนะนำอีกสินค้าให้
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium">สินค้าหลัก</label>
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกสินค้า..." />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map(product => (
                      <SelectItem key={product.id} value={product.id}>
                        <div className="flex items-center gap-2">
                          <span>{product.name}</span>
                          {product.category && (
                            <Badge variant="outline" className="text-xs">{product.category}</Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="hidden sm:flex items-center justify-center">
                <Link2 className="w-5 h-5 text-muted-foreground" />
              </div>

              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium">สินค้าที่เกี่ยวข้อง</label>
                <Select value={selectedRelated} onValueChange={setSelectedRelated}>
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกสินค้า..." />
                  </SelectTrigger>
                  <SelectContent>
                    {products
                      .filter(p => p.id !== selectedProduct)
                      .map(product => (
                        <SelectItem key={product.id} value={product.id}>
                          <div className="flex items-center gap-2">
                            <span>{product.name}</span>
                            {product.category && (
                              <Badge variant="outline" className="text-xs">{product.category}</Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <Button 
                onClick={handleAddRelation} 
                disabled={isAdding || !selectedProduct || !selectedRelated}
              >
                <Plus className="w-4 h-4 mr-2" />
                เพิ่ม
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* List of relations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              คู่สินค้าที่ตั้งค่าไว้
            </CardTitle>
            <CardDescription>
              รายการคู่สินค้าที่เชื่อมโยงกัน (แสดงทั้ง 2 ทิศทาง)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
            ) : uniquePairs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                ยังไม่มีคู่สินค้าที่เกี่ยวข้อง
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>สินค้า A</TableHead>
                    <TableHead className="text-center w-16"></TableHead>
                    <TableHead>สินค้า B</TableHead>
                    <TableHead className="text-right w-24">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {uniquePairs.map((rp) => (
                    <TableRow key={rp.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {rp.product.image_url ? (
                            <img 
                              src={rp.product.image_url} 
                              alt={rp.product.name}
                              className="w-10 h-10 object-cover rounded"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                              <Package className="w-5 h-5 text-muted-foreground" />
                            </div>
                          )}
                          <div>
                            <div className="font-medium">{rp.product.name}</div>
                            {rp.product.category && (
                              <Badge variant="outline" className="text-xs">{rp.product.category}</Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <ArrowRight className="w-4 h-4 text-muted-foreground mx-auto" />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {rp.related_product.image_url ? (
                            <img 
                              src={rp.related_product.image_url} 
                              alt={rp.related_product.name}
                              className="w-10 h-10 object-cover rounded"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                              <Package className="w-5 h-5 text-muted-foreground" />
                            </div>
                          )}
                          <div>
                            <div className="font-medium">{rp.related_product.name}</div>
                            {rp.related_product.category && (
                              <Badge variant="outline" className="text-xs">{rp.related_product.category}</Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteRelation(rp.product_id, rp.related_product_id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
