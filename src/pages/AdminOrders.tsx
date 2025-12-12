import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { 
  Package, 
  RefreshCw,
  Search,
  Eye,
  Truck,
  Phone,
  User,
  ShoppingCart,
  MapPin,
  Calendar,
  MessageCircle,
  Send,
  Bell,
  BellOff
} from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { Order, OrderItem } from '@/types';
import { PaymentSlipSection } from '@/components/admin/PaymentSlipSection';

type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';

const statusOptions: { value: OrderStatus; label: string; color: string }[] = [
  { value: 'pending', label: 'รอดำเนินการ', color: 'bg-yellow-500' },
  { value: 'confirmed', label: 'ยืนยันแล้ว', color: 'bg-blue-500' },
  { value: 'shipped', label: 'จัดส่งแล้ว', color: 'bg-purple-500' },
  { value: 'delivered', label: 'ส่งสำเร็จ', color: 'bg-green-500' },
  { value: 'cancelled', label: 'ยกเลิก', color: 'bg-red-500' },
];

interface MessageTemplate {
  id: string;
  name: string;
  content: string;
}

export default function AdminOrders() {
  const { user, isAdmin, isLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<Record<string, OrderItem[]>>({});
  const [messageTemplates, setMessageTemplates] = useState<MessageTemplate[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isMessageOpen, setIsMessageOpen] = useState(false);
  const [customMessage, setCustomMessage] = useState('');
  const [editData, setEditData] = useState({
    status: '' as OrderStatus,
    tracking_number: '',
    notes: '',
  });
  const [sendNotificationOnSave, setSendNotificationOnSave] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/admin');
    }
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchOrders();
      fetchTemplates();
      
      // Subscribe to realtime updates
      const channel = supabase
        .channel('orders-admin-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'orders' },
          () => fetchOrders()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, isAdmin]);

  const fetchOrders = async () => {
    setIsLoadingData(true);
    
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching orders:', error);
      toast.error('ไม่สามารถโหลดข้อมูลออเดอร์ได้');
    } else {
      const typedOrders = (data || []).map(order => ({
        ...order,
        platform: order.platform as 'web' | 'line' | 'facebook',
        status: order.status as OrderStatus
      }));
      setOrders(typedOrders);
    }
    
    setIsLoadingData(false);
  };

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from('message_templates')
      .select('id, name, content')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching templates:', error);
    } else {
      setMessageTemplates(data || []);
    }
  };

  const fetchOrderItems = async (orderId: string) => {
    if (orderItems[orderId]) return;

    const { data, error } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId);

    if (error) {
      console.error('Error fetching order items:', error);
    } else {
      setOrderItems(prev => ({ ...prev, [orderId]: data || [] }));
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin');
  };

  const openDetailSheet = async (order: Order) => {
    setSelectedOrder(order);
    setIsDetailOpen(true);
    await fetchOrderItems(order.id);
  };

  const openEditDialog = (order: Order) => {
    setSelectedOrder(order);
    setEditData({
      status: order.status,
      tracking_number: order.tracking_number || '',
      notes: order.notes || '',
    });
    // Auto-enable notification for LINE/Facebook, disable for web
    setSendNotificationOnSave(order.platform !== 'web');
    setIsEditOpen(true);
  };

  const sendNotification = async (orderId: string, notificationType: 'status_update' | 'tracking_update' | 'custom', customMsg?: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('send-order-notification', {
        body: {
          order_id: orderId,
          notification_type: notificationType,
          custom_message: customMsg,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('ส่งการแจ้งเตือนสำเร็จ');
        return true;
      } else if (data?.results?.some((r: any) => r.error === 'Token not configured')) {
        toast.warning('ยังไม่ได้ตั้งค่า API Token กรุณาตั้งค่าในหน้า Settings');
      } else if (data?.results?.some((r: any) => r.error === 'Push notification not available for web')) {
        toast.info('ออเดอร์นี้มาจาก Web ไม่สามารถส่ง Push Notification ได้');
      } else {
        toast.warning('ไม่สามารถส่งการแจ้งเตือนได้');
      }
      return false;
    } catch (error) {
      console.error('Error sending notification:', error);
      toast.error('เกิดข้อผิดพลาดในการส่งการแจ้งเตือน');
      return false;
    }
  };

  const openMessageDialog = (order: Order) => {
    setSelectedOrder(order);
    setCustomMessage('');
    setIsMessageOpen(true);
  };

  const handleSendCustomMessage = async () => {
    if (!selectedOrder || !customMessage.trim()) return;

    setIsSendingMessage(true);
    const success = await sendNotification(selectedOrder.id, 'custom', customMessage.trim());
    setIsSendingMessage(false);

    if (success) {
      setIsMessageOpen(false);
      setCustomMessage('');
    }
  };

  const handleUpdate = async () => {
    if (!selectedOrder) return;

    setIsSaving(true);

    const statusChanged = editData.status !== selectedOrder.status;
    const trackingChanged = editData.tracking_number.trim() !== (selectedOrder.tracking_number || '');

    try {
      const { error } = await supabase
        .from('orders')
        .update({
          status: editData.status,
          tracking_number: editData.tracking_number.trim() || null,
          notes: editData.notes.trim() || null,
        })
        .eq('id', selectedOrder.id);

      if (error) throw error;
      
      toast.success('อัพเดทออเดอร์สำเร็จ');
      
      // Send notification based on what changed (only if enabled)
      if (sendNotificationOnSave && selectedOrder.platform !== 'web') {
        if (trackingChanged && editData.tracking_number.trim()) {
          await sendNotification(selectedOrder.id, 'tracking_update');
        } else if (statusChanged) {
          await sendNotification(selectedOrder.id, 'status_update');
        }
      }
      
      setIsEditOpen(false);
      fetchOrders();
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('เกิดข้อผิดพลาดในการอัพเดท');
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusBadge = (status: OrderStatus) => {
    const option = statusOptions.find(s => s.value === status);
    const variants: Record<OrderStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'secondary',
      confirmed: 'default',
      shipped: 'outline',
      delivered: 'default',
      cancelled: 'destructive'
    };
    return <Badge variant={variants[status]}>{option?.label || status}</Badge>;
  };

  const getPlatformIcon = (platform: Order['platform']) => {
    switch (platform) {
      case 'line': return '🟢';
      case 'facebook': return '🔵';
      default: return '🌐';
    }
  };

  const getPlatformLabel = (platform: Order['platform']) => {
    switch (platform) {
      case 'line': return 'LINE';
      case 'facebook': return 'Facebook';
      default: return 'Web';
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer_phone.includes(searchQuery);
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    shipped: orders.filter(o => o.status === 'shipped').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
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
              <Package className="w-8 h-8 text-destructive" />
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
    <AdminLayout title="จัดการออเดอร์">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">ออเดอร์ทั้งหมด</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
                <p className="text-sm text-muted-foreground">รอดำเนินการ</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">{stats.shipped}</p>
                <p className="text-sm text-muted-foreground">จัดส่งแล้ว</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{stats.delivered}</p>
                <p className="text-sm text-muted-foreground">ส่งสำเร็จ</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="ค้นหาออเดอร์, ชื่อ, เบอร์โทร..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="สถานะทั้งหมด" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">สถานะทั้งหมด</SelectItem>
              {statusOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchOrders} disabled={isLoadingData}>
            <RefreshCw className={`w-4 h-4 ${isLoadingData ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Orders List */}
        <Card>
          <CardHeader>
            <CardTitle>รายการออเดอร์ ({filteredOrders.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredOrders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ShoppingCart className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{searchQuery || statusFilter !== 'all' ? 'ไม่พบออเดอร์ที่ค้นหา' : 'ยังไม่มีออเดอร์'}</p>
              </div>
            ) : (
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {filteredOrders.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      {/* Platform Icon */}
                      <div className="text-2xl flex-shrink-0">
                        {getPlatformIcon(order.platform)}
                      </div>

                      {/* Order Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-medium">{order.order_number}</span>
                          {getStatusBadge(order.status)}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {order.customer_name}
                          </span>
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {order.customer_phone}
                          </span>
                        </div>
                        {order.tracking_number && (
                          <div className="flex items-center gap-1 mt-1 text-sm text-primary">
                            <Truck className="w-3 h-3" />
                            {order.tracking_number}
                          </div>
                        )}
                      </div>

                      {/* Amount & Date */}
                      <div className="text-right flex-shrink-0">
                        <p className="text-lg font-semibold">฿{Number(order.total_amount).toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString('th-TH', {
                            day: 'numeric',
                            month: 'short',
                            year: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => openDetailSheet(order)}
                          title="ดูรายละเอียด"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {order.platform !== 'web' && (
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => openMessageDialog(order)}
                            title="ส่งข้อความ"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="default"
                          size="icon"
                          onClick={() => openEditDialog(order)}
                          title="แก้ไขออเดอร์"
                        >
                          <Truck className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      

      {/* Order Detail Sheet */}
      <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>รายละเอียดออเดอร์</SheetTitle>
          </SheetHeader>
          
          {selectedOrder && (
            <div className="mt-6 space-y-6">
              {/* Order Number & Status */}
              <div className="flex items-center justify-between">
                <span className="font-mono text-lg font-bold">{selectedOrder.order_number}</span>
                {getStatusBadge(selectedOrder.status)}
              </div>

              {/* Platform */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-lg">{getPlatformIcon(selectedOrder.platform)}</span>
                <span>{getPlatformLabel(selectedOrder.platform)}</span>
              </div>

              {/* Customer Info */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">ข้อมูลลูกค้า</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span>{selectedOrder.customer_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span>{selectedOrder.customer_phone}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <span>{selectedOrder.customer_address}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Order Items */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">รายการสินค้า</CardTitle>
                </CardHeader>
                <CardContent>
                  {orderItems[selectedOrder.id] ? (
                    <div className="space-y-2">
                      {orderItems[selectedOrder.id].map((item) => (
                        <div key={item.id} className="flex justify-between text-sm">
                          <span>
                            {item.product_name} x{item.quantity}
                          </span>
                          <span className="font-medium">
                            ฿{(Number(item.price) * item.quantity).toLocaleString()}
                          </span>
                        </div>
                      ))}
                      <div className="border-t pt-2 flex justify-between font-semibold">
                        <span>รวม</span>
                        <span>฿{Number(selectedOrder.total_amount).toLocaleString()}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-4">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Payment Slips */}
              <PaymentSlipSection orderId={selectedOrder.id} />

              {/* Tracking */}
              {selectedOrder.tracking_number && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">เลข Tracking</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-primary" />
                      <span className="font-mono">{selectedOrder.tracking_number}</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Notes */}
              {selectedOrder.notes && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">หมายเหตุ</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{selectedOrder.notes}</p>
                  </CardContent>
                </Card>
              )}

              {/* Dates */}
              <div className="text-xs text-muted-foreground space-y-1">
                <div className="flex items-center gap-2">
                  <Calendar className="w-3 h-3" />
                  <span>สร้างเมื่อ: {new Date(selectedOrder.created_at).toLocaleString('th-TH')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-3 h-3" />
                  <span>อัพเดทล่าสุด: {new Date(selectedOrder.updated_at).toLocaleString('th-TH')}</span>
                </div>
              </div>

              {/* Action Button */}
              <Button onClick={() => { setIsDetailOpen(false); openEditDialog(selectedOrder); }} className="w-full gap-2">
                <Truck className="w-4 h-4" />
                อัพเดทสถานะ / Tracking
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>อัพเดทออเดอร์ {selectedOrder?.order_number}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>สถานะ</Label>
              <Select value={editData.status} onValueChange={(v) => setEditData({ ...editData, status: v as OrderStatus })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tracking">เลข Tracking</Label>
              <Input
                id="tracking"
                value={editData.tracking_number}
                onChange={(e) => setEditData({ ...editData, tracking_number: e.target.value })}
                placeholder="กรอกเลข Tracking"
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">หมายเหตุ</Label>
              <Textarea
                id="notes"
                value={editData.notes}
                onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                placeholder="หมายเหตุเพิ่มเติม"
                rows={3}
                maxLength={500}
              />
            </div>

            {/* Notification Toggle */}
            {selectedOrder && (
              <div className={`flex items-start gap-3 p-3 rounded-lg border ${
                selectedOrder.platform === 'web' 
                  ? 'bg-muted/50 border-muted' 
                  : sendNotificationOnSave 
                    ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800' 
                    : 'bg-muted/50 border-muted'
              }`}>
                <Checkbox
                  id="sendNotification"
                  checked={sendNotificationOnSave}
                  onCheckedChange={(checked) => setSendNotificationOnSave(checked === true)}
                  disabled={selectedOrder.platform === 'web'}
                />
                <div className="flex-1">
                  <label 
                    htmlFor="sendNotification" 
                    className={`text-sm font-medium cursor-pointer flex items-center gap-2 ${
                      selectedOrder.platform === 'web' ? 'text-muted-foreground' : ''
                    }`}
                  >
                    {sendNotificationOnSave && selectedOrder.platform !== 'web' ? (
                      <Bell className="w-4 h-4 text-green-600" />
                    ) : (
                      <BellOff className="w-4 h-4 text-muted-foreground" />
                    )}
                    แจ้งเตือนลูกค้าอัตโนมัติ
                  </label>
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedOrder.platform === 'web' ? (
                      'ไม่สามารถส่ง Push Notification ได้ (ออเดอร์จาก Web)'
                    ) : selectedOrder.platform === 'line' ? (
                      `ส่งแจ้งเตือนไปยัง LINE ของลูกค้า`
                    ) : (
                      `ส่งแจ้งเตือนไปยัง Facebook Messenger ของลูกค้า`
                    )}
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsEditOpen(false)}
                className="flex-1"
              >
                ยกเลิก
              </Button>
              <Button onClick={handleUpdate} disabled={isSaving} className="flex-1">
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

      {/* Custom Message Dialog */}
      <Dialog open={isMessageOpen} onOpenChange={setIsMessageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              ส่งข้อความถึงลูกค้า
            </DialogTitle>
          </DialogHeader>
          
          {selectedOrder && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="text-lg">{getPlatformIcon(selectedOrder.platform)}</span>
                <span>{selectedOrder.customer_name}</span>
                <span>•</span>
                <span className="font-mono">{selectedOrder.order_number}</span>
              </div>

              {selectedOrder.platform === 'web' ? (
                <div className="text-center py-6 text-muted-foreground">
                  <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>ไม่สามารถส่งข้อความได้</p>
                  <p className="text-sm">ออเดอร์นี้มาจาก Web ไม่มีช่องทางส่ง Push Notification</p>
                </div>
              ) : (
                <>
                  {/* Message Templates */}
                  <div className="space-y-2">
                    <Label>เทมเพลตข้อความ</Label>
                    <div className="flex flex-wrap gap-2">
                      {messageTemplates.map((tpl) => (
                        <Button
                          key={tpl.id}
                          type="button"
                          variant={customMessage === tpl.content ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCustomMessage(tpl.content)}
                        >
                          {tpl.name}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="customMessage">ข้อความ</Label>
                    <Textarea
                      id="customMessage"
                      value={customMessage}
                      onChange={(e) => setCustomMessage(e.target.value)}
                      placeholder="พิมพ์ข้อความที่ต้องการส่งถึงลูกค้า หรือเลือกจากเทมเพลตด้านบน..."
                      rows={4}
                      maxLength={1000}
                    />
                    <p className="text-xs text-muted-foreground text-right">
                      {customMessage.length}/1000
                    </p>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsMessageOpen(false)}
                      className="flex-1"
                    >
                      ยกเลิก
                    </Button>
                    <Button 
                      onClick={handleSendCustomMessage} 
                      disabled={isSendingMessage || !customMessage.trim()} 
                      className="flex-1"
                    >
                      {isSendingMessage ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          ส่งข้อความ
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
