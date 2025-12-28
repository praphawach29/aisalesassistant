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
  BellOff,
  Trash2
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
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const sendNotification = async (orderId: string, notificationType: 'status_update' | 'tracking_update' | 'custom' | 'payment_confirmed' | 'payment_rejected' | 'order_receipt', customMsg?: string) => {
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

  const handleDeleteOrder = async () => {
    if (!orderToDelete) return;
    
    setIsDeleting(true);
    try {
      // Delete payment slips first
      await supabase
        .from('payment_slips')
        .delete()
        .eq('order_id', orderToDelete.id);
      
      // Delete order items
      const { error: itemsError } = await supabase
        .from('order_items')
        .delete()
        .eq('order_id', orderToDelete.id);
      
      if (itemsError) throw itemsError;
      
      // Delete the order
      const { error: orderError } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderToDelete.id);
      
      if (orderError) throw orderError;
      
      toast.success(`ลบออเดอร์ ${orderToDelete.order_number} เรียบร้อยแล้ว`);
      
      // Close detail sheet if deleting currently viewed order
      if (selectedOrder?.id === orderToDelete.id) {
        setIsDetailOpen(false);
        setSelectedOrder(null);
      }
      
      // Remove from orderItems state
      setOrderItems(prev => {
        const newItems = { ...prev };
        delete newItems[orderToDelete.id];
        return newItems;
      });
      
      fetchOrders();
    } catch (error) {
      console.error('Error deleting order:', error);
      toast.error('เกิดข้อผิดพลาดในการลบออเดอร์');
    } finally {
      setIsDeleting(false);
      setOrderToDelete(null);
    }
  };

  const confirmDeleteOrder = (e: React.MouseEvent, order: Order) => {
    e.stopPropagation();
    setOrderToDelete(order);
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
          <Card>
            <CardContent className="p-3 sm:pt-6">
              <div className="text-center">
                <p className="text-xl sm:text-2xl font-bold">{stats.total}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">ออเดอร์ทั้งหมด</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:pt-6">
              <div className="text-center">
                <p className="text-xl sm:text-2xl font-bold text-yellow-600">{stats.pending}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">รอดำเนินการ</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:pt-6">
              <div className="text-center">
                <p className="text-xl sm:text-2xl font-bold text-purple-600">{stats.shipped}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">จัดส่งแล้ว</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:pt-6">
              <div className="text-center">
                <p className="text-xl sm:text-2xl font-bold text-green-600">{stats.delivered}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">ส่งสำเร็จ</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-4 sm:mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="ค้นหาออเดอร์, ชื่อ, เบอร์โทร..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10"
            />
          </div>
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="flex-1 sm:w-[180px] h-10">
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
            <Button variant="outline" size="icon" onClick={fetchOrders} disabled={isLoadingData} className="h-10 w-10 shrink-0">
              <RefreshCw className={`w-4 h-4 ${isLoadingData ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Orders List */}
        <Card>
          <CardHeader className="py-3 sm:py-6">
            <CardTitle className="text-base sm:text-lg">รายการออเดอร์ ({filteredOrders.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-2 sm:p-6 pt-0 sm:pt-0">
            {filteredOrders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ShoppingCart className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{searchQuery || statusFilter !== 'all' ? 'ไม่พบออเดอร์ที่ค้นหา' : 'ยังไม่มีออเดอร์'}</p>
              </div>
            ) : (
              <ScrollArea className="h-[calc(100vh-380px)] sm:h-[500px]">
                <div className="space-y-2 sm:space-y-3">
                  {filteredOrders.map((order) => (
                    <div
                      key={order.id}
                      className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 sm:p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => openDetailSheet(order)}
                    >
                      {/* Mobile: Top Row - Platform, Order Number, Status */}
                      <div className="flex items-center gap-2 sm:hidden">
                        <span className="text-lg">{getPlatformIcon(order.platform)}</span>
                        <span className="font-mono text-sm font-medium flex-1">{order.order_number}</span>
                        {getStatusBadge(order.status)}
                      </div>

                      {/* Mobile: Customer Info Row */}
                      <div className="flex items-center justify-between text-sm sm:hidden">
                        <div className="flex items-center gap-3 text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {order.customer_name}
                          </span>
                        </div>
                        <p className="font-semibold">฿{Number(order.total_amount).toLocaleString()}</p>
                      </div>

                      {/* Mobile: Bottom Row - Date & Actions */}
                      <div className="flex items-center justify-between sm:hidden">
                        <p className="text-xs text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString('th-TH', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                          {order.platform !== 'web' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => openMessageDialog(order)}
                            >
                              <MessageCircle className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="default"
                            size="sm"
                            className="h-8 px-3"
                            onClick={() => openEditDialog(order)}
                          >
                            <Truck className="w-4 h-4 mr-1" />
                            แก้ไข
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => confirmDeleteOrder(e, order)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Desktop: Original Layout */}
                      <div className="hidden sm:flex sm:items-center sm:gap-4 sm:flex-1">
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
                        <div className="flex gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
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
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => confirmDeleteOrder(e, order)}
                            title="ลบออเดอร์"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
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
      

      {/* Order Detail Sheet */}
      <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-4 sm:p-6">
          <SheetHeader className="pb-2">
            <SheetTitle className="text-base sm:text-lg">รายละเอียดออเดอร์</SheetTitle>
          </SheetHeader>
          
          {selectedOrder && (
            <div className="mt-4 space-y-4 sm:space-y-6">
              {/* Order Number & Status */}
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm sm:text-lg font-bold">{selectedOrder.order_number}</span>
                {getStatusBadge(selectedOrder.status)}
              </div>

              {/* Platform */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-lg">{getPlatformIcon(selectedOrder.platform)}</span>
                <span>{getPlatformLabel(selectedOrder.platform)}</span>
              </div>

              {/* Customer Info */}
              <Card>
                <CardHeader className="p-3 pb-2">
                  <CardTitle className="text-sm">ข้อมูลลูกค้า</CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0 space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="break-all">{selectedOrder.customer_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span>{selectedOrder.customer_phone}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <span className="break-all">{selectedOrder.customer_address}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Order Items */}
              <Card>
                <CardHeader className="p-3 pb-2">
                  <CardTitle className="text-sm">รายการสินค้า</CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  {orderItems[selectedOrder.id] ? (
                    <div className="space-y-2">
                      {orderItems[selectedOrder.id].map((item) => (
                        <div key={item.id} className="flex justify-between text-sm gap-2">
                          <span className="break-all">
                            {item.product_name} x{item.quantity}
                          </span>
                          <span className="font-medium shrink-0">
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
                  <CardHeader className="p-3 pb-2">
                    <CardTitle className="text-sm">เลข Tracking</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-primary shrink-0" />
                      <span className="font-mono text-sm break-all">{selectedOrder.tracking_number}</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Notes */}
              {selectedOrder.notes && (
                <Card>
                  <CardHeader className="p-3 pb-2">
                    <CardTitle className="text-sm">หมายเหตุ</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <p className="text-sm text-muted-foreground break-all">{selectedOrder.notes}</p>
                  </CardContent>
                </Card>
              )}

              {/* Dates */}
              <div className="text-xs text-muted-foreground space-y-1">
                <div className="flex items-center gap-2">
                  <Calendar className="w-3 h-3 shrink-0" />
                  <span>สร้างเมื่อ: {new Date(selectedOrder.created_at).toLocaleString('th-TH')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-3 h-3 shrink-0" />
                  <span>อัพเดทล่าสุด: {new Date(selectedOrder.updated_at).toLocaleString('th-TH')}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 pt-2">
                <div className="flex gap-2">
                  {selectedOrder.platform !== 'web' && (
                    <Button 
                      variant="outline" 
                      onClick={() => { setIsDetailOpen(false); openMessageDialog(selectedOrder); }} 
                      className="flex-1 gap-2"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span className="hidden sm:inline">ส่งข้อความ</span>
                    </Button>
                  )}
                  <Button onClick={() => { setIsDetailOpen(false); openEditDialog(selectedOrder); }} className="flex-1 gap-2">
                    <Truck className="w-4 h-4" />
                    อัพเดทสถานะ
                  </Button>
                </div>
                {selectedOrder.platform !== 'web' && orderItems[selectedOrder.id] && orderItems[selectedOrder.id].length > 0 && (
                  <Button 
                    variant="secondary" 
                    onClick={async () => {
                      const success = await sendNotification(selectedOrder.id, 'order_receipt');
                      if (success) {
                        toast.success('ส่งใบเสร็จเรียบร้อยแล้ว');
                      }
                    }} 
                    className="w-full gap-2"
                  >
                    <Package className="w-4 h-4" />
                    ส่งใบเสร็จ (Receipt)
                  </Button>
                )}
                
                {/* Delete Button */}
                <Button 
                  variant="destructive" 
                  onClick={(e) => {
                    if (selectedOrder) {
                      confirmDeleteOrder(e, selectedOrder);
                    }
                  }} 
                  className="w-full gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  ลบออเดอร์นี้
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg pr-6">อัพเดทออเดอร์ {selectedOrder?.order_number}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-3 sm:space-y-4 pt-2 sm:pt-4">
            <div className="space-y-2">
              <Label className="text-sm">สถานะ</Label>
              <Select value={editData.status} onValueChange={(v) => setEditData({ ...editData, status: v as OrderStatus })}>
                <SelectTrigger className="h-10">
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
              <Label htmlFor="tracking" className="text-sm">เลข Tracking</Label>
              <Input
                id="tracking"
                value={editData.tracking_number}
                onChange={(e) => setEditData({ ...editData, tracking_number: e.target.value })}
                placeholder="กรอกเลข Tracking"
                maxLength={100}
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="text-sm">หมายเหตุ</Label>
              <Textarea
                id="notes"
                value={editData.notes}
                onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                placeholder="หมายเหตุเพิ่มเติม"
                rows={2}
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
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <label 
                    htmlFor="sendNotification" 
                    className={`text-sm font-medium cursor-pointer flex items-center gap-2 ${
                      selectedOrder.platform === 'web' ? 'text-muted-foreground' : ''
                    }`}
                  >
                    {sendNotificationOnSave && selectedOrder.platform !== 'web' ? (
                      <Bell className="w-4 h-4 text-green-600 shrink-0" />
                    ) : (
                      <BellOff className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                    <span className="truncate">แจ้งเตือนลูกค้าอัตโนมัติ</span>
                  </label>
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedOrder.platform === 'web' ? (
                      'ไม่สามารถส่ง Push Notification ได้'
                    ) : selectedOrder.platform === 'line' ? (
                      `ส่งแจ้งเตือนไปยัง LINE`
                    ) : (
                      `ส่งแจ้งเตือนไปยัง Facebook`
                    )}
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2 sm:pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsEditOpen(false)}
                className="flex-1 h-11"
              >
                ยกเลิก
              </Button>
              <Button onClick={handleUpdate} disabled={isSaving} className="flex-1 h-11">
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
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg pr-6">
              <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              ส่งข้อความถึงลูกค้า
            </DialogTitle>
          </DialogHeader>
          
          {selectedOrder && (
            <div className="space-y-3 sm:space-y-4 py-2 sm:py-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                <span className="text-lg">{getPlatformIcon(selectedOrder.platform)}</span>
                <span className="truncate max-w-[150px]">{selectedOrder.customer_name}</span>
                <span>•</span>
                <span className="font-mono text-xs">{selectedOrder.order_number}</span>
              </div>

              {selectedOrder.platform === 'web' ? (
                <div className="text-center py-6 text-muted-foreground">
                  <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>ไม่สามารถส่งข้อความได้</p>
                  <p className="text-sm">ออเดอร์นี้มาจาก Web</p>
                </div>
              ) : (
                <>
                  {/* Message Templates */}
                  {messageTemplates.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm">เทมเพลตข้อความ</Label>
                      <ScrollArea className="w-full whitespace-nowrap pb-2">
                        <div className="flex gap-2">
                          {messageTemplates.map((tpl) => (
                            <Button
                              key={tpl.id}
                              type="button"
                              variant={customMessage === tpl.content ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCustomMessage(tpl.content)}
                              className="shrink-0"
                            >
                              {tpl.name}
                            </Button>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="customMessage" className="text-sm">ข้อความ</Label>
                    <Textarea
                      id="customMessage"
                      value={customMessage}
                      onChange={(e) => setCustomMessage(e.target.value)}
                      placeholder="พิมพ์ข้อความที่ต้องการส่งถึงลูกค้า..."
                      rows={3}
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
                      className="flex-1 h-11"
                    >
                      ยกเลิก
                    </Button>
                    <Button 
                      onClick={handleSendCustomMessage} 
                      disabled={isSendingMessage || !customMessage.trim()} 
                      className="flex-1 h-11"
                    >
                      {isSendingMessage ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-1 sm:mr-2" />
                          ส่ง
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!orderToDelete} onOpenChange={(open) => !open && setOrderToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบออเดอร์</AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการลบออเดอร์ <span className="font-mono font-medium">{orderToDelete?.order_number}</span> ของ "{orderToDelete?.customer_name}" ใช่หรือไม่?
              <span className="block mt-2 text-destructive font-medium">
                ⚠️ ข้อมูลออเดอร์, รายการสินค้า และสลิปการชำระเงินจะถูกลบถาวร
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteOrder}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  กำลังลบ...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  ลบออเดอร์
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
