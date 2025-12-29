import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Receipt, 
  CheckCircle, 
  XCircle, 
  Clock, 
  RefreshCw,
  Eye,
  ZoomIn,
  Bot,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';

interface PaymentSlip {
  id: string;
  order_id: string;
  platform: string;
  platform_user_id: string;
  image_url: string;
  status: string;
  admin_notes: string | null;
  confirmed_at: string | null;
  created_at: string;
  analyzed_amount: number | null;
  analyzed_date: string | null;
  analyzed_bank: string | null;
  analyzed_account: string | null;
  confidence_score: number | null;
  auto_verified: boolean;
}

interface PaymentSlipSectionProps {
  orderId: string;
  expectedAmount?: number;
}

export function PaymentSlipSection({ orderId, expectedAmount }: PaymentSlipSectionProps) {
  const [slips, setSlips] = useState<PaymentSlip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSlip, setSelectedSlip] = useState<PaymentSlip | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isActionOpen, setIsActionOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    fetchSlips();
  }, [orderId]);

  const fetchSlips = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('payment_slips')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching payment slips:', error);
    } else {
      setSlips((data || []) as PaymentSlip[]);
    }
    setIsLoading(false);
  };

  const sendPaymentNotification = async (type: 'payment_confirmed' | 'payment_rejected', reason?: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await supabase.functions.invoke('send-order-notification', {
        body: {
          order_id: orderId,
          notification_type: type,
          custom_message: reason
        }
      });
      console.log(`Payment ${type} notification sent`);
    } catch (error) {
      console.error('Error sending payment notification:', error);
    }
  };

  const handleAnalyze = async (slip: PaymentSlip) => {
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-payment-slip', {
        body: {
          image_url: slip.image_url,
          expected_amount: expectedAmount,
          payment_slip_id: slip.id,
          order_id: orderId
        }
      });

      if (error) throw error;

      if (data?.auto_verified) {
        toast.success('ยืนยันการชำระเงินอัตโนมัติสำเร็จ!');
        await sendPaymentNotification('payment_confirmed');
      } else if (data?.success) {
        toast.success(`AI วิเคราะห์สลิปแล้ว: ฿${data.analyzed_amount?.toLocaleString() || 'ไม่ทราบ'}`);
      } else {
        toast.error('ไม่สามารถวิเคราะห์สลิปได้');
      }
      
      fetchSlips();
    } catch (error) {
      console.error('Error analyzing slip:', error);
      toast.error('เกิดข้อผิดพลาดในการวิเคราะห์');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleConfirm = async (slip: PaymentSlip) => {
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('payment_slips')
        .update({
          status: 'confirmed',
          admin_notes: adminNotes.trim() || null,
          confirmed_at: new Date().toISOString()
        })
        .eq('id', slip.id);

      if (error) throw error;

      // Update order status to confirmed
      await supabase
        .from('orders')
        .update({ status: 'confirmed' })
        .eq('id', orderId);

      // Send notification to customer
      await sendPaymentNotification('payment_confirmed');

      toast.success('ยืนยันการชำระเงินสำเร็จ และส่งแจ้งเตือนลูกค้าแล้ว');
      setIsActionOpen(false);
      fetchSlips();
    } catch (error) {
      console.error('Error confirming slip:', error);
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (slip: PaymentSlip) => {
    if (!adminNotes.trim()) {
      toast.error('กรุณาระบุเหตุผลในการปฏิเสธ');
      return;
    }
    
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('payment_slips')
        .update({
          status: 'rejected',
          admin_notes: adminNotes.trim()
        })
        .eq('id', slip.id);

      if (error) throw error;

      // Send notification to customer with rejection reason
      await sendPaymentNotification('payment_rejected', adminNotes.trim());

      toast.success('ปฏิเสธสลิปสำเร็จ และส่งแจ้งเตือนลูกค้าแล้ว');
      setIsActionOpen(false);
      fetchSlips();
    } catch (error) {
      console.error('Error rejecting slip:', error);
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setIsProcessing(false);
    }
  };

  const openActionDialog = (slip: PaymentSlip) => {
    setSelectedSlip(slip);
    setAdminNotes(slip.admin_notes || '');
    setIsActionOpen(true);
  };

  const getStatusBadge = (slip: PaymentSlip) => {
    if (slip.auto_verified && slip.status === 'confirmed') {
      return <Badge className="bg-blue-500"><Bot className="w-3 h-3 mr-1" /> ยืนยันอัตโนมัติ</Badge>;
    }
    switch (slip.status) {
      case 'confirmed':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" /> ยืนยันแล้ว</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> ปฏิเสธ</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> รอตรวจสอบ</Badge>;
    }
  };

  const getConfidenceBadge = (score: number | null) => {
    if (score === null) return null;
    if (score >= 80) {
      return <Badge variant="outline" className="text-green-600 border-green-600">ความมั่นใจ {score}%</Badge>;
    } else if (score >= 50) {
      return <Badge variant="outline" className="text-yellow-600 border-yellow-600">ความมั่นใจ {score}%</Badge>;
    } else {
      return <Badge variant="outline" className="text-red-600 border-red-600">ความมั่นใจ {score}%</Badge>;
    }
  };

  const renderAIAnalysis = (slip: PaymentSlip) => {
    if (!slip.analyzed_amount && !slip.analyzed_bank) return null;
    
    const amountMismatch = expectedAmount && slip.analyzed_amount && 
      Math.abs(slip.analyzed_amount - expectedAmount) > expectedAmount * 0.05;
    
    return (
      <div className="mt-2 p-2 rounded-md bg-muted/50 text-xs space-y-1">
        <div className="flex items-center gap-1 text-muted-foreground">
          <Bot className="w-3 h-3" />
          <span className="font-medium">AI วิเคราะห์:</span>
        </div>
        {slip.analyzed_amount && (
          <div className={`flex items-center gap-1 ${amountMismatch ? 'text-orange-600' : 'text-foreground'}`}>
            {amountMismatch && <AlertTriangle className="w-3 h-3" />}
            <span>ยอดเงิน: ฿{slip.analyzed_amount.toLocaleString()}</span>
            {amountMismatch && expectedAmount && (
              <span className="text-muted-foreground">(คาดหวัง ฿{expectedAmount.toLocaleString()})</span>
            )}
          </div>
        )}
        {slip.analyzed_bank && (
          <div>ธนาคาร: {slip.analyzed_bank}</div>
        )}
        {slip.analyzed_date && (
          <div>วันที่: {slip.analyzed_date}</div>
        )}
        {slip.analyzed_account && (
          <div>เลขบัญชี: xxx-{slip.analyzed_account}</div>
        )}
        {getConfidenceBadge(slip.confidence_score)}
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6 flex items-center justify-center">
          <RefreshCw className="w-4 h-4 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (slips.length === 0) {
    return null;
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Receipt className="w-4 h-4" />
            สลิปชำระเงิน ({slips.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {slips.map((slip) => (
            <div
              key={slip.id}
              className="flex flex-col gap-2 p-3 rounded-lg border bg-muted/30"
            >
              <div className="flex items-start gap-4">
                {/* Thumbnail - larger and clearer */}
                <div 
                  className="w-24 h-24 rounded-lg overflow-hidden cursor-pointer bg-muted flex-shrink-0 border-2 border-border shadow-sm hover:shadow-md hover:border-primary/50 transition-all group"
                  onClick={() => { setSelectedSlip(slip); setIsPreviewOpen(true); }}
                >
                  <img 
                    src={slip.image_url} 
                    alt="Payment slip" 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {getStatusBadge(slip)}
                    <span className="text-xs text-muted-foreground">
                      {slip.platform === 'line' ? '🟢' : '🔵'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(slip.created_at).toLocaleString('th-TH')}
                  </p>
                  {slip.admin_notes && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      หมายเหตุ: {slip.admin_notes}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => { setSelectedSlip(slip); setIsPreviewOpen(true); }}
                    title="ดูสลิป"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  {slip.status === 'pending' && !slip.analyzed_amount && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAnalyze(slip)}
                      disabled={isAnalyzing}
                      title="ให้ AI วิเคราะห์"
                    >
                      {isAnalyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
                    </Button>
                  )}
                  {slip.status === 'pending' && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => openActionDialog(slip)}
                    >
                      ตรวจสอบ
                    </Button>
                  )}
                </div>
              </div>
              
              {/* AI Analysis Results */}
              {renderAIAnalysis(slip)}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Image Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ZoomIn className="w-5 h-5" />
              สลิปชำระเงิน
            </DialogTitle>
          </DialogHeader>
          {selectedSlip && (
            <div className="space-y-4">
              <img 
                src={selectedSlip.image_url} 
                alt="Payment slip" 
                className="w-full rounded-lg max-h-[70vh] object-contain"
              />
              <div className="flex items-center justify-between flex-wrap gap-2">
                {getStatusBadge(selectedSlip)}
                <span className="text-sm text-muted-foreground">
                  {new Date(selectedSlip.created_at).toLocaleString('th-TH')}
                </span>
              </div>
              
              {/* AI Analysis in preview */}
              {renderAIAnalysis(selectedSlip)}
              
              {selectedSlip.status === 'pending' && (
                <div className="flex gap-2">
                  {!selectedSlip.analyzed_amount && (
                    <Button 
                      variant="outline"
                      onClick={() => handleAnalyze(selectedSlip)}
                      disabled={isAnalyzing}
                      className="flex-1"
                    >
                      {isAnalyzing ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Bot className="w-4 h-4 mr-2" />}
                      ให้ AI วิเคราะห์
                    </Button>
                  )}
                  <Button 
                    onClick={() => { setIsPreviewOpen(false); openActionDialog(selectedSlip); }}
                    className="flex-1"
                  >
                    ตรวจสอบและยืนยัน/ปฏิเสธ
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Action Dialog */}
      <Dialog open={isActionOpen} onOpenChange={setIsActionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ตรวจสอบสลิปชำระเงิน</DialogTitle>
          </DialogHeader>
          {selectedSlip && (
            <div className="space-y-4 pt-4">
              <div className="w-full h-48 rounded-lg overflow-hidden bg-muted">
                <img 
                  src={selectedSlip.image_url} 
                  alt="Payment slip" 
                  className="w-full h-full object-contain"
                />
              </div>

              {/* AI Analysis in action dialog */}
              {renderAIAnalysis(selectedSlip)}

              {/* Expected amount info */}
              {expectedAmount && (
                <div className="p-3 rounded-md bg-primary/10 text-sm">
                  <span className="font-medium">ยอดที่ต้องชำระ:</span> ฿{expectedAmount.toLocaleString()}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">หมายเหตุ (สำหรับกรณีปฏิเสธ)</label>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="ระบุเหตุผล เช่น จำนวนเงินไม่ตรง, สลิปไม่ชัด..."
                  rows={3}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="destructive"
                  onClick={() => handleReject(selectedSlip)}
                  disabled={isProcessing}
                  className="flex-1"
                >
                  {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : (
                    <>
                      <XCircle className="w-4 h-4 mr-2" />
                      ปฏิเสธ
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => handleConfirm(selectedSlip)}
                  disabled={isProcessing}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      ยืนยัน
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
