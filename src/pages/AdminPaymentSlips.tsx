import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
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
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { 
  CreditCard, 
  RefreshCw,
  Search,
  Eye,
  Check,
  X,
  Image,
  Calendar,
  User,
  Building2,
  CircleDollarSign,
  Package,
  Percent
} from 'lucide-react';
import { toast } from 'sonner';

interface PaymentSlip {
  id: string;
  order_id: string;
  platform: string;
  platform_user_id: string;
  image_url: string;
  status: 'pending' | 'confirmed' | 'rejected';
  admin_notes: string | null;
  analyzed_amount: number | null;
  analyzed_bank: string | null;
  analyzed_date: string | null;
  analyzed_account: string | null;
  confidence_score: number | null;
  auto_verified: boolean;
  created_at: string;
  confirmed_at: string | null;
  order?: {
    order_number: string;
    customer_name: string;
    customer_phone: string;
    total_amount: number;
    status: string;
    customer_line_id?: string;
    platform: string;
  };
}

const statusOptions = [
  { value: 'pending', label: 'รอตรวจสอบ', color: 'bg-yellow-500' },
  { value: 'confirmed', label: 'ยืนยันแล้ว', color: 'bg-green-500' },
  { value: 'rejected', label: 'ปฏิเสธ', color: 'bg-red-500' },
];

export default function AdminPaymentSlips() {
  const { user, isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();
  const [slips, setSlips] = useState<PaymentSlip[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedSlip, setSelectedSlip] = useState<PaymentSlip | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/admin');
    }
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchSlips();
      
      // Subscribe to realtime updates
      const channel = supabase
        .channel('payment-slips-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'payment_slips' },
          () => fetchSlips()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, isAdmin]);

  const fetchSlips = async () => {
    setIsLoadingData(true);
    
    const { data, error } = await supabase
      .from('payment_slips')
      .select(`
        *,
        order:orders(order_number, customer_name, customer_phone, total_amount, status, customer_line_id, platform)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching payment slips:', error);
      toast.error('ไม่สามารถโหลดข้อมูลสลิปได้');
    } else {
      setSlips((data || []) as PaymentSlip[]);
    }
    
    setIsLoadingData(false);
  };

  const handleConfirm = async (slip: PaymentSlip) => {
    setIsProcessing(true);
    
    try {
      // Update slip status
      const { error: slipError } = await supabase
        .from('payment_slips')
        .update({
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
          confirmed_by: user?.id
        })
        .eq('id', slip.id);

      if (slipError) throw slipError;

      // Update order status to confirmed
      const { error: orderError } = await supabase
        .from('orders')
        .update({ status: 'confirmed' })
        .eq('id', slip.order_id);

      if (orderError) throw orderError;

      // Send payment confirmed notification
      try {
        await supabase.functions.invoke('send-order-notification', {
          body: {
            order_id: slip.order_id,
            notification_type: 'payment_confirmed'
          }
        });
        console.log('Payment confirmed notification sent');
      } catch (notifyError) {
        console.error('Failed to send payment confirmed notification:', notifyError);
      }

      // Send order receipt automatically after payment confirmation
      try {
        await supabase.functions.invoke('send-order-notification', {
          body: {
            order_id: slip.order_id,
            notification_type: 'order_receipt'
          }
        });
        console.log('Order receipt sent');
      } catch (receiptError) {
        console.error('Failed to send order receipt:', receiptError);
      }

      toast.success('ยืนยันสลิปเรียบร้อยแล้ว');
      setIsDetailOpen(false);
      fetchSlips();
    } catch (error) {
      console.error('Error confirming slip:', error);
      toast.error('เกิดข้อผิดพลาดในการยืนยันสลิป');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedSlip) return;
    
    setIsProcessing(true);
    
    try {
      const { error: slipError } = await supabase
        .from('payment_slips')
        .update({
          status: 'rejected',
          admin_notes: rejectReason || 'สลิปไม่ผ่านการตรวจสอบ',
          confirmed_at: new Date().toISOString(),
          confirmed_by: user?.id
        })
        .eq('id', selectedSlip.id);

      if (slipError) throw slipError;

      // Send LINE notification if applicable
      if (selectedSlip.order?.platform === 'line' && selectedSlip.order?.customer_line_id) {
        try {
          await supabase.functions.invoke('send-order-notification', {
            body: {
              order_id: selectedSlip.order_id,
              notification_type: 'payment_rejected',
              custom_message: rejectReason || 'สลิปไม่ผ่านการตรวจสอบ กรุณาส่งสลิปใหม่'
            }
          });
        } catch (notifyError) {
          console.error('Failed to send notification:', notifyError);
        }
      }

      toast.success('ปฏิเสธสลิปเรียบร้อยแล้ว');
      setIsRejectOpen(false);
      setIsDetailOpen(false);
      setRejectReason('');
      fetchSlips();
    } catch (error) {
      console.error('Error rejecting slip:', error);
      toast.error('เกิดข้อผิดพลาดในการปฏิเสธสลิป');
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      pending: 'secondary',
      confirmed: 'default',
      rejected: 'destructive'
    };
    const labels: Record<string, string> = {
      pending: 'รอตรวจสอบ',
      confirmed: 'ยืนยันแล้ว',
      rejected: 'ปฏิเสธ'
    };
    return <Badge variant={variants[status]}>{labels[status] || status}</Badge>;
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'line': return '🟢';
      case 'facebook': return '🔵';
      default: return '🌐';
    }
  };

  const filteredSlips = slips.filter(slip => {
    const matchesSearch = 
      slip.order?.order_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      slip.order?.customer_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || slip.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: slips.length,
    pending: slips.filter(s => s.status === 'pending').length,
    confirmed: slips.filter(s => s.status === 'confirmed').length,
    rejected: slips.filter(s => s.status === 'rejected').length,
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AdminLayout title="จัดการสลิปโอนเงิน">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
        <Card>
          <CardContent className="p-3 sm:pt-6">
            <div className="text-center">
              <p className="text-xl sm:text-2xl font-bold">{stats.total}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">ทั้งหมด</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:pt-6">
            <div className="text-center">
              <p className="text-xl sm:text-2xl font-bold text-yellow-600">{stats.pending}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">รอตรวจสอบ</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:pt-6">
            <div className="text-center">
              <p className="text-xl sm:text-2xl font-bold text-green-600">{stats.confirmed}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">ยืนยันแล้ว</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:pt-6">
            <div className="text-center">
              <p className="text-xl sm:text-2xl font-bold text-red-600">{stats.rejected}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">ปฏิเสธ</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-4 sm:mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="ค้นหาออเดอร์, ชื่อลูกค้า..."
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
          <Button variant="outline" size="icon" onClick={fetchSlips} disabled={isLoadingData} className="h-10 w-10 shrink-0">
            <RefreshCw className={`w-4 h-4 ${isLoadingData ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Slips List */}
      <Card>
        <CardHeader className="py-3 sm:py-6">
          <CardTitle className="text-base sm:text-lg">รายการสลิปโอนเงิน ({filteredSlips.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-2 sm:p-6 pt-0 sm:pt-0">
          {filteredSlips.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{searchQuery || statusFilter !== 'all' ? 'ไม่พบสลิปที่ค้นหา' : 'ยังไม่มีสลิปโอนเงิน'}</p>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-380px)] sm:h-[500px]">
              <div className="space-y-2 sm:space-y-3">
                {filteredSlips.map((slip) => (
                  <div
                    key={slip.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 sm:p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedSlip(slip);
                      setIsDetailOpen(true);
                    }}
                  >
                    {/* Thumbnail */}
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      <img 
                        src={slip.image_url} 
                        alt="Payment slip" 
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{getPlatformIcon(slip.platform)}</span>
                        <span className="font-mono text-sm font-medium">{slip.order?.order_number}</span>
                        {getStatusBadge(slip.status)}
                        {slip.auto_verified && (
                          <Badge variant="outline" className="text-xs">Auto</Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {slip.order?.customer_name}
                        </span>
                        <span className="font-semibold text-foreground">
                          ฿{Number(slip.order?.total_amount).toLocaleString()}
                        </span>
                      </div>
                      {slip.analyzed_amount && (
                        <div className="text-xs text-muted-foreground mt-1">
                          💰 ยอดวิเคราะห์: ฿{slip.analyzed_amount.toLocaleString()}
                          {slip.confidence_score && ` (${slip.confidence_score}%)`}
                        </div>
                      )}
                    </div>

                    {/* Date & Actions */}
                    <div className="flex items-center justify-between sm:flex-col sm:items-end gap-2">
                      <p className="text-xs text-muted-foreground">
                        {new Date(slip.created_at).toLocaleDateString('th-TH', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                      {slip.status === 'pending' && (
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="default"
                            className="h-8 px-2"
                            onClick={() => handleConfirm(slip)}
                          >
                            <Check className="w-3 h-3 mr-1" />
                            ยืนยัน
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-8 px-2"
                            onClick={() => {
                              setSelectedSlip(slip);
                              setIsRejectOpen(true);
                            }}
                          >
                            <X className="w-3 h-3 mr-1" />
                            ปฏิเสธ
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Detail Sheet */}
      <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <SheetContent className="sm:max-w-lg w-full overflow-y-auto">
          <SheetHeader>
            <SheetTitle>รายละเอียดสลิปโอนเงิน</SheetTitle>
          </SheetHeader>
          
          {selectedSlip && (
            <div className="mt-6 space-y-6">
              {/* Slip Image */}
              <div className="rounded-lg overflow-hidden border">
                <img 
                  src={selectedSlip.image_url} 
                  alt="Payment slip" 
                  className="w-full object-contain max-h-80"
                />
              </div>

              {/* Order Info */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    ข้อมูลออเดอร์
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">เลขออเดอร์</span>
                    <span className="font-mono font-medium">{selectedSlip.order?.order_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ลูกค้า</span>
                    <span>{selectedSlip.order?.customer_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">เบอร์โทร</span>
                    <span>{selectedSlip.order?.customer_phone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ยอดที่ต้องชำระ</span>
                    <span className="font-semibold text-primary">
                      ฿{Number(selectedSlip.order?.total_amount).toLocaleString()}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* AI Analysis */}
              {(selectedSlip.analyzed_amount || selectedSlip.analyzed_bank) && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Percent className="w-4 h-4" />
                      ผลวิเคราะห์ AI
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {selectedSlip.analyzed_amount && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <CircleDollarSign className="w-3 h-3" />
                          ยอดโอน
                        </span>
                        <span className="font-medium">฿{selectedSlip.analyzed_amount.toLocaleString()}</span>
                      </div>
                    )}
                    {selectedSlip.analyzed_bank && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          ธนาคาร
                        </span>
                        <span>{selectedSlip.analyzed_bank}</span>
                      </div>
                    )}
                    {selectedSlip.analyzed_date && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          วันที่
                        </span>
                        <span>{selectedSlip.analyzed_date}</span>
                      </div>
                    )}
                    {selectedSlip.confidence_score && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">ความมั่นใจ</span>
                        <Badge variant={selectedSlip.confidence_score >= 80 ? 'default' : 'secondary'}>
                          {selectedSlip.confidence_score}%
                        </Badge>
                      </div>
                    )}
                    {selectedSlip.auto_verified && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">ยืนยันอัตโนมัติ</span>
                        <Badge variant="default">✅ ผ่าน</Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Status */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">สถานะ</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    {getStatusBadge(selectedSlip.status)}
                    <span className="text-xs text-muted-foreground">
                      {new Date(selectedSlip.created_at).toLocaleString('th-TH')}
                    </span>
                  </div>
                  {selectedSlip.admin_notes && (
                    <p className="mt-2 text-sm text-muted-foreground bg-muted p-2 rounded">
                      {selectedSlip.admin_notes}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Actions */}
              {selectedSlip.status === 'pending' && (
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => handleConfirm(selectedSlip)}
                    disabled={isProcessing}
                  >
                    <Check className="w-4 h-4 mr-2" />
                    ยืนยันสลิป
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => setIsRejectOpen(true)}
                    disabled={isProcessing}
                  >
                    <X className="w-4 h-4 mr-2" />
                    ปฏิเสธ
                  </Button>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Reject Dialog */}
      <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ปฏิเสธสลิปโอนเงิน</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">เหตุผล (จะส่งแจ้งลูกค้า)</label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="เช่น ยอดเงินไม่ตรงกับออเดอร์, สลิปไม่ชัดเจน, ฯลฯ"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectOpen(false)}>
              ยกเลิก
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleReject}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <X className="w-4 h-4 mr-2" />
              )}
              ปฏิเสธสลิป
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
