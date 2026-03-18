import { useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useSubscription } from '@/hooks/useSubscription';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Check, Crown, Zap, Rocket, MessageCircle, Package, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

const PLAN_ICONS: Record<string, React.ReactNode> = {
  starter: <Zap className="w-6 h-6" />,
  professional: <Crown className="w-6 h-6" />,
  business: <Rocket className="w-6 h-6" />,
};

const PLAN_COLORS: Record<string, string> = {
  starter: 'border-blue-500/30 bg-blue-500/5',
  professional: 'border-purple-500/30 bg-purple-500/5',
  business: 'border-amber-500/30 bg-amber-500/5',
};

const PLAN_BADGE_COLORS: Record<string, string> = {
  starter: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  professional: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  business: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
};

const FEATURE_LABELS: Record<string, string> = {
  web_chat: 'แชทบนเว็บ',
  basic_ai: 'AI ตอบอัตโนมัติ',
  order_management: 'จัดการออเดอร์',
  product_management: 'จัดการสินค้า',
  faq_management: 'จัดการ FAQ',
  line_integration: 'เชื่อมต่อ LINE',
  facebook_integration: 'เชื่อมต่อ Facebook',
  ai_slip_verification: 'AI ตรวจสลิป',
  broadcast: 'Broadcast ข้อความ',
  coupons: 'ระบบคูปอง',
  templates: 'เทมเพลตข้อความ',
  analytics: 'วิเคราะห์ข้อมูล',
  web_scraping: 'Web Scraping',
  knowledge_base: 'ฐานความรู้',
  category_expertise: 'ความเชี่ยวชาญหมวดหมู่',
  embed_widget: 'Embed Widget',
  backup_restore: 'สำรอง/กู้คืนข้อมูล',
  audit_logs: 'Audit Logs',
  error_logs: 'Error Logs',
  related_products: 'สินค้าที่เกี่ยวข้อง',
  product_faqs: 'FAQ เฉพาะสินค้า',
};

const AdminSubscription = () => {
  const { currentPlan, subscription, allPlans, messagesRemaining, refreshSubscription } = useSubscription();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isChanging, setIsChanging] = useState<string | null>(null);

  const handleSelectPlan = async (planId: string) => {
    setIsChanging(planId);
    try {
      if (subscription) {
        // Update existing subscription
        const { error } = await supabase
          .from('store_subscription')
          .update({ plan_id: planId, updated_at: new Date().toISOString() })
          .eq('id', subscription.id);
        if (error) throw error;
      } else {
        // Create new subscription
        const { error } = await supabase
          .from('store_subscription')
          .insert({ plan_id: planId });
        if (error) throw error;
      }

      await refreshSubscription();
      toast({ title: 'เปลี่ยนแพ็กเกจสำเร็จ', description: 'ระบบจะอัปเดตฟีเจอร์ตามแพ็กเกจใหม่ทันที' });
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    } finally {
      setIsChanging(null);
    }
  };

  const messageUsagePercent = currentPlan?.max_messages_per_month && subscription
    ? Math.min((subscription.messages_used / currentPlan.max_messages_per_month) * 100, 100)
    : 0;

  return (
    <AdminLayout title="แพ็กเกจ & Subscription">
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Current Plan Status */}
        {currentPlan && subscription && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {PLAN_ICONS[currentPlan.name]}
                แพ็กเกจปัจจุบัน: {currentPlan.name_th}
              </CardTitle>
              <CardDescription>
                เริ่มใช้งาน: {new Date(subscription.started_at).toLocaleDateString('th-TH')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Messages Usage */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <MessageCircle className="w-4 h-4" />
                    ข้อความที่ใช้
                  </div>
                  {currentPlan.max_messages_per_month ? (
                    <>
                      <Progress value={messageUsagePercent} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        {subscription.messages_used.toLocaleString()} / {currentPlan.max_messages_per_month.toLocaleString()} ข้อความ
                        ({messagesRemaining?.toLocaleString()} เหลือ)
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-green-600 font-medium">ไม่จำกัด ∞</p>
                  )}
                </div>

                {/* Products Limit */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Package className="w-4 h-4" />
                    สินค้าสูงสุด
                  </div>
                  <p className="text-sm">
                    {currentPlan.max_products ? `${currentPlan.max_products} รายการ` : 'ไม่จำกัด ∞'}
                  </p>
                </div>

                {/* Platforms */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Globe className="w-4 h-4" />
                    แพลตฟอร์ม
                  </div>
                  <p className="text-sm">{currentPlan.max_platforms} แพลตฟอร์ม</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {!currentPlan && (
          <Card className="border-dashed border-2">
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">ยังไม่ได้เลือกแพ็กเกจ — กรุณาเลือกแพ็กเกจด้านล่าง</p>
              <p className="text-xs text-muted-foreground mt-1">ขณะนี้เปิดใช้งานทุกฟีเจอร์ (Owner Mode)</p>
            </CardContent>
          </Card>
        )}

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {allPlans.map((plan) => {
            const isCurrentPlan = currentPlan?.id === plan.id;
            const features = (plan.features as string[]) || [];

            return (
              <Card key={plan.id} className={cn(
                'relative transition-all',
                isCurrentPlan && 'ring-2 ring-primary',
                PLAN_COLORS[plan.name] || 'border-border'
              )}>
                {isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground">แพ็กเกจปัจจุบัน</Badge>
                  </div>
                )}

                <CardHeader className="text-center pb-2">
                  <div className="flex justify-center mb-2">
                    <div className={cn('p-3 rounded-full', PLAN_BADGE_COLORS[plan.name] || '')}>
                      {PLAN_ICONS[plan.name] || <Zap className="w-6 h-6" />}
                    </div>
                  </div>
                  <CardTitle>{plan.name_th}</CardTitle>
                  <div className="mt-2">
                    <span className="text-3xl font-bold">฿{plan.price.toLocaleString()}</span>
                    <span className="text-muted-foreground text-sm"> /เดือน</span>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  <div className="text-sm space-y-1 text-muted-foreground">
                    <div className="flex justify-between">
                      <span>สินค้า</span>
                      <span className="font-medium text-foreground">
                        {plan.max_products ? `${plan.max_products} รายการ` : 'ไม่จำกัด'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>ข้อความ/เดือน</span>
                      <span className="font-medium text-foreground">
                        {plan.max_messages_per_month ? plan.max_messages_per_month.toLocaleString() : 'ไม่จำกัด'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>แพลตฟอร์ม</span>
                      <span className="font-medium text-foreground">{plan.max_platforms}</span>
                    </div>
                  </div>

                  <div className="border-t pt-3 space-y-1.5">
                    {features.map((feature) => (
                      <div key={feature} className="flex items-center gap-2 text-sm">
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span>{FEATURE_LABELS[feature] || feature}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>

                <CardFooter>
                  <Button
                    className="w-full"
                    variant={isCurrentPlan ? 'outline' : 'default'}
                    disabled={isCurrentPlan || isChanging !== null}
                    onClick={() => handleSelectPlan(plan.id)}
                  >
                    {isChanging === plan.id ? 'กำลังเปลี่ยน...' : isCurrentPlan ? 'ใช้งานอยู่' : 'เลือกแพ็กเกจนี้'}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminSubscription;
