import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
  Send, 
  RefreshCw,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Radio,
  MessageCircle
} from 'lucide-react';
import { toast } from 'sonner';

interface BroadcastMessage {
  id: string;
  platform: string;
  message_type: string;
  content: string;
  image_url: string | null;
  target_audience: string;
  sent_count: number;
  success_count: number;
  failed_count: number;
  status: string;
  created_at: string;
  completed_at: string | null;
}

export default function AdminBroadcast() {
  const { user, isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();
  const [broadcasts, setBroadcasts] = useState<BroadcastMessage[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSending, setIsSending] = useState(false);
  
  const [message, setMessage] = useState('');
  const [targetAudience, setTargetAudience] = useState('all');

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/admin');
    }
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchBroadcasts();
    }
  }, [user, isAdmin]);

  const fetchBroadcasts = async () => {
    setIsLoadingData(true);
    const { data, error } = await supabase
      .from('broadcast_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching broadcasts:', error);
    } else {
      setBroadcasts((data || []) as BroadcastMessage[]);
    }
    setIsLoadingData(false);
  };

  const handleSendBroadcast = async () => {
    if (!message.trim()) {
      toast.error('กรุณากรอกข้อความ');
      return;
    }

    setIsSending(true);

    try {
      // Create broadcast record
      const { data: broadcast, error: insertError } = await supabase
        .from('broadcast_messages')
        .insert({
          platform: 'line',
          message_type: 'text',
          content: message.trim(),
          target_audience: targetAudience,
          status: 'pending'
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Call edge function to send broadcast
      const { error: funcError } = await supabase.functions.invoke('send-broadcast', {
        body: {
          broadcast_id: broadcast.id,
          message: message.trim(),
          target_audience: targetAudience
        }
      });

      if (funcError) throw funcError;

      toast.success('กำลังส่ง Broadcast...');
      setMessage('');
      
      // Refresh after a delay to get updated status
      setTimeout(fetchBroadcasts, 2000);
      
    } catch (error) {
      console.error('Error sending broadcast:', error);
      toast.error('เกิดข้อผิดพลาดในการส่ง Broadcast');
    } finally {
      setIsSending(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" /> สำเร็จ</Badge>;
      case 'sending':
        return <Badge className="bg-blue-500"><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> กำลังส่ง</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> ล้มเหลว</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> รอดำเนินการ</Badge>;
    }
  };

  const getAudienceLabel = (audience: string) => {
    switch (audience) {
      case 'all': return 'ทุกคน';
      case 'recent': return 'ใช้งานล่าสุด 30 วัน';
      case 'with_orders': return 'ลูกค้าที่เคยสั่งซื้อ';
      default: return audience;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AdminLayout title="Broadcast LINE">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Send Broadcast Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Radio className="w-5 h-5" />
              ส่งข้อความ Broadcast
            </CardTitle>
            <CardDescription>
              ส่งข้อความโปรโมชั่นหรือประกาศไปยังลูกค้าทุกคนผ่าน LINE
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>กลุ่มเป้าหมาย</Label>
              <Select value={targetAudience} onValueChange={setTargetAudience}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      ลูกค้าทุกคน
                    </div>
                  </SelectItem>
                  <SelectItem value="recent">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      ใช้งานล่าสุด 30 วัน
                    </div>
                  </SelectItem>
                  <SelectItem value="with_orders">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      ลูกค้าที่เคยสั่งซื้อ
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">ข้อความ</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="พิมพ์ข้อความที่ต้องการส่ง..."
                rows={6}
                maxLength={2000}
              />
              <p className="text-xs text-muted-foreground text-right">
                {message.length}/2000
              </p>
            </div>

            <Button 
              onClick={handleSendBroadcast} 
              disabled={isSending || !message.trim()}
              className="w-full gap-2"
            >
              {isSending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              ส่ง Broadcast
            </Button>
          </CardContent>
        </Card>

        {/* Broadcast History */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                ประวัติการส่ง
              </CardTitle>
              <CardDescription>รายการ Broadcast ที่ผ่านมา</CardDescription>
            </div>
            <Button variant="outline" size="icon" onClick={fetchBroadcasts} disabled={isLoadingData}>
              <RefreshCw className={`w-4 h-4 ${isLoadingData ? 'animate-spin' : ''}`} />
            </Button>
          </CardHeader>
          <CardContent>
            {broadcasts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Radio className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>ยังไม่มีประวัติการส่ง Broadcast</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {broadcasts.map((broadcast) => (
                    <div
                      key={broadcast.id}
                      className="p-4 rounded-lg border bg-card"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        {getStatusBadge(broadcast.status)}
                        <span className="text-xs text-muted-foreground">
                          {new Date(broadcast.created_at).toLocaleString('th-TH')}
                        </span>
                      </div>
                      <p className="text-sm line-clamp-2 mb-2">{broadcast.content}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>กลุ่ม: {getAudienceLabel(broadcast.target_audience)}</span>
                        {broadcast.status === 'completed' && (
                          <>
                            <span className="text-green-600">✓ {broadcast.success_count}</span>
                            {broadcast.failed_count > 0 && (
                              <span className="text-red-600">✗ {broadcast.failed_count}</span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}