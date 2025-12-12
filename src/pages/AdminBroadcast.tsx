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
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
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
  MessageCircle,
  CalendarIcon,
  Timer,
  ImagePlus,
  X
} from 'lucide-react';
import { Input } from '@/components/ui/input';
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
  scheduled_at: string | null;
}

export default function AdminBroadcast() {
  const { user, isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();
  const [broadcasts, setBroadcasts] = useState<BroadcastMessage[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSending, setIsSending] = useState(false);
  
  const [message, setMessage] = useState('');
  const [targetAudience, setTargetAudience] = useState('all');
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined);
  const [scheduledTime, setScheduledTime] = useState('');
  const [isScheduleMode, setIsScheduleMode] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('รูปภาพต้องมีขนาดไม่เกิน 5MB');
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return null;
    
    setIsUploadingImage(true);
    try {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `broadcast-${Date.now()}.${fileExt}`;
      const filePath = `broadcasts/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, imageFile);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('ไม่สามารถอัปโหลดรูปภาพได้');
      return null;
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSendBroadcast = async (selectedPlatform: 'line' | 'facebook' | 'all') => {
    if (!message.trim()) {
      toast.error('กรุณากรอกข้อความ');
      return;
    }

    // Upload image first if exists
    let imageUrl: string | null = null;
    if (imageFile) {
      imageUrl = await uploadImage();
    }

    // For scheduled broadcasts
    if (isScheduleMode) {
      if (!scheduledDate || !scheduledTime) {
        toast.error('กรุณาเลือกวันและเวลา');
        return;
      }
      
      const [hours, minutes] = scheduledTime.split(':').map(Number);
      const scheduledDateTime = new Date(scheduledDate);
      scheduledDateTime.setHours(hours, minutes, 0, 0);
      
      if (scheduledDateTime <= new Date()) {
        toast.error('เวลาที่ตั้งต้องเป็นอนาคต');
        return;
      }

      setIsSending(true);
      try {
        const { error: insertError } = await supabase
          .from('broadcast_messages')
          .insert({
            platform: selectedPlatform,
            message_type: imageUrl ? 'image' : 'text',
            content: message.trim(),
            image_url: imageUrl,
            target_audience: targetAudience,
            status: 'scheduled',
            scheduled_at: scheduledDateTime.toISOString()
          });

        if (insertError) throw insertError;

        toast.success(`ตั้งเวลา Broadcast สำหรับ ${format(scheduledDateTime, 'dd MMM yyyy HH:mm', { locale: th })}`);
        setMessage('');
        setScheduledDate(undefined);
        setScheduledTime('');
        setIsScheduleMode(false);
        removeImage();
        fetchBroadcasts();
      } catch (error) {
        console.error('Error scheduling broadcast:', error);
        toast.error('เกิดข้อผิดพลาดในการตั้งเวลา');
      } finally {
        setIsSending(false);
      }
      return;
    }

    // Immediate broadcast
    setIsSending(true);
    try {
      const { data: broadcast, error: insertError } = await supabase
        .from('broadcast_messages')
        .insert({
          platform: selectedPlatform,
          message_type: imageUrl ? 'image' : 'text',
          content: message.trim(),
          image_url: imageUrl,
          target_audience: targetAudience,
          status: 'pending'
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const { error: funcError } = await supabase.functions.invoke('send-broadcast', {
        body: {
          broadcast_id: broadcast.id,
          message: message.trim(),
          image_url: imageUrl,
          target_audience: targetAudience,
          platform: selectedPlatform
        }
      });

      if (funcError) throw funcError;

      toast.success('กำลังส่ง Broadcast...');
      setMessage('');
      removeImage();
      setTimeout(fetchBroadcasts, 2000);
    } catch (error) {
      console.error('Error sending broadcast:', error);
      toast.error('เกิดข้อผิดพลาดในการส่ง Broadcast');
    } finally {
      setIsSending(false);
    }
  };

  const handleCancelScheduled = async (id: string) => {
    try {
      const { error } = await supabase
        .from('broadcast_messages')
        .update({ status: 'cancelled' })
        .eq('id', id);
      
      if (error) throw error;
      toast.success('ยกเลิกการตั้งเวลาสำเร็จ');
      fetchBroadcasts();
    } catch (error) {
      console.error('Error cancelling broadcast:', error);
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  const getStatusBadge = (status: string, scheduledAt?: string | null) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" /> สำเร็จ</Badge>;
      case 'sending':
        return <Badge className="bg-blue-500"><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> กำลังส่ง</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> ล้มเหลว</Badge>;
      case 'scheduled':
        return <Badge className="bg-orange-500"><Timer className="w-3 h-3 mr-1" /> ตั้งเวลา</Badge>;
      case 'cancelled':
        return <Badge variant="outline"><XCircle className="w-3 h-3 mr-1" /> ยกเลิก</Badge>;
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

  // Generate time options
  const timeOptions = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      timeOptions.push(time);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AdminLayout title="Broadcast">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Send Broadcast Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Radio className="w-5 h-5" />
              ส่งข้อความ Broadcast
            </CardTitle>
            <CardDescription>
              ส่งข้อความโปรโมชั่นหรือประกาศไปยังลูกค้าผ่าน LINE และ Facebook
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

            {/* Image Upload */}
            <div className="space-y-2">
              <Label>รูปภาพ (ไม่บังคับ)</Label>
              {imagePreview ? (
                <div className="relative w-32 h-32 rounded-lg overflow-hidden border">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-1 right-1 w-6 h-6"
                    onClick={removeImage}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                    id="broadcast-image"
                  />
                  <label htmlFor="broadcast-image">
                    <Button type="button" variant="outline" size="sm" className="gap-2 cursor-pointer" asChild>
                      <span>
                        <ImagePlus className="w-4 h-4" />
                        เพิ่มรูปภาพ
                      </span>
                    </Button>
                  </label>
                  <span className="text-xs text-muted-foreground">ขนาดไม่เกิน 5MB</span>
                </div>
              )}
            </div>

            {/* Schedule Toggle */}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={isScheduleMode ? "default" : "outline"}
                size="sm"
                onClick={() => setIsScheduleMode(!isScheduleMode)}
                className="gap-2"
              >
                <Timer className="w-4 h-4" />
                {isScheduleMode ? 'ตั้งเวลาส่ง' : 'ส่งทันที'}
              </Button>
              {isScheduleMode && (
                <span className="text-sm text-muted-foreground">เลือกวันและเวลาด้านล่าง</span>
              )}
            </div>

            {/* Schedule Date & Time */}
            {isScheduleMode && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>วันที่</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !scheduledDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {scheduledDate ? format(scheduledDate, "dd MMM yyyy", { locale: th }) : "เลือกวันที่"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={scheduledDate}
                        onSelect={setScheduledDate}
                        disabled={(date) => date < new Date()}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>เวลา</Label>
                  <Select value={scheduledTime} onValueChange={setScheduledTime}>
                    <SelectTrigger>
                      <SelectValue placeholder="เลือกเวลา" />
                    </SelectTrigger>
                    <SelectContent>
                      {timeOptions.map(time => (
                        <SelectItem key={time} value={time}>{time}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              <Button 
                onClick={() => handleSendBroadcast('line')} 
                disabled={isSending || !message.trim()}
                className="gap-2 bg-green-600 hover:bg-green-700"
              >
                {isSending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>🟢</span>}
                LINE
              </Button>
              <Button 
                onClick={() => handleSendBroadcast('facebook')} 
                disabled={isSending || !message.trim()}
                className="gap-2 bg-blue-600 hover:bg-blue-700"
              >
                {isSending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>🔵</span>}
                Facebook
              </Button>
              <Button 
                onClick={() => handleSendBroadcast('all')} 
                disabled={isSending || !message.trim()}
                variant="default"
                className="gap-2"
              >
                {isSending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                ทั้งหมด
              </Button>
            </div>
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
                        <div className="flex items-center gap-2">
                          <span>{broadcast.platform === 'line' ? '🟢' : broadcast.platform === 'facebook' ? '🔵' : '📢'}</span>
                          {getStatusBadge(broadcast.status, broadcast.scheduled_at)}
                        </div>
                        <div className="text-right">
                          {broadcast.status === 'scheduled' && broadcast.scheduled_at ? (
                            <div className="text-xs">
                              <div className="text-orange-600 font-medium">
                                {format(new Date(broadcast.scheduled_at), 'dd MMM yyyy HH:mm', { locale: th })}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {new Date(broadcast.created_at).toLocaleString('th-TH')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 mb-2">
                        {broadcast.image_url && (
                          <img 
                            src={broadcast.image_url} 
                            alt="" 
                            className="w-12 h-12 rounded object-cover flex-shrink-0"
                          />
                        )}
                        <p className="text-sm line-clamp-2">{broadcast.content}</p>
                      </div>
                      <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-4">
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
                        {broadcast.status === 'scheduled' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancelScheduled(broadcast.id)}
                            className="text-destructive hover:text-destructive h-6 px-2"
                          >
                            ยกเลิก
                          </Button>
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