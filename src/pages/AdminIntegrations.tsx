import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Save, Eye, EyeOff, MessageSquare, ExternalLink, CheckCircle2, AlertCircle } from "lucide-react";
import { AdminLayout } from '@/components/admin/AdminLayout';

interface Setting {
  id: string;
  key: string;
  value: string | null;
  description: string | null;
  created_at?: string;
  updated_at?: string;
}

const LINE_SETTINGS = [
  { key: 'LINE_CHANNEL_ACCESS_TOKEN', description: 'Channel Access Token จาก LINE Developers Console' },
  { key: 'LINE_CHANNEL_SECRET', description: 'Channel Secret จาก LINE Developers Console' },
];

const FACEBOOK_SETTINGS = [
  { key: 'FACEBOOK_PAGE_ACCESS_TOKEN', description: 'Page Access Token จาก Facebook for Developers' },
  { key: 'FACEBOOK_VERIFY_TOKEN', description: 'Verify Token ที่คุณกำหนดเอง สำหรับยืนยัน Webhook' },
  { key: 'FACEBOOK_APP_SECRET', description: 'App Secret จาก Facebook App Settings' },
];

const AdminIntegrations = () => {
  const { toast } = useToast();
  const { isAdmin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<Setting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showTokens, setShowTokens] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate("/admin");
    }
  }, [isAdmin, authLoading, navigate]);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("settings")
        .select("*")
        .order("key");

      if (error) throw error;
      
      // Merge with default settings if they don't exist
      const allKeys = [...LINE_SETTINGS, ...FACEBOOK_SETTINGS].map(s => s.key);
      const existingKeys = (data || []).map(s => s.key);
      
      const mergedSettings: Setting[] = [...(data || [])];
      
      for (const settingDef of [...LINE_SETTINGS, ...FACEBOOK_SETTINGS]) {
        if (!existingKeys.includes(settingDef.key)) {
          mergedSettings.push({
            id: settingDef.key,
            key: settingDef.key,
            value: null,
            description: settingDef.description,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      }
      
      setSettings(mergedSettings);
    } catch (error) {
      console.error("Error fetching settings:", error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถโหลดการตั้งค่าได้",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleValueChange = (key: string, value: string) => {
    setSettings((prev) =>
      prev.map((s) => (s.key === key ? { ...s, value } : s))
    );
  };

  const handleSave = async (platform: 'line' | 'facebook') => {
    setIsSaving(true);
    try {
      const keysToSave = platform === 'line' 
        ? LINE_SETTINGS.map(s => s.key)
        : FACEBOOK_SETTINGS.map(s => s.key);
      
      for (const setting of settings.filter(s => keysToSave.includes(s.key))) {
        // Check if setting exists
        const { data: existing } = await supabase
          .from("settings")
          .select("id")
          .eq("key", setting.key)
          .single();
        
        if (existing) {
          const { error } = await supabase
            .from("settings")
            .update({ value: setting.value })
            .eq("key", setting.key);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("settings")
            .insert({ 
              key: setting.key, 
              value: setting.value,
              description: [...LINE_SETTINGS, ...FACEBOOK_SETTINGS].find(s => s.key === setting.key)?.description
            });
          if (error) throw error;
        }
      }

      toast({
        title: "บันทึกสำเร็จ",
        description: `การตั้งค่า ${platform === 'line' ? 'LINE' : 'Facebook'} ถูกบันทึกเรียบร้อยแล้ว`,
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถบันทึกการตั้งค่าได้",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleShowToken = (key: string) => {
    setShowTokens((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const getSettingValue = (key: string) => {
    return settings.find(s => s.key === key)?.value || '';
  };

  const isConfigured = (keys: string[]) => {
    return keys.every(key => getSettingValue(key));
  };

  const renderSettingInput = (settingKey: string, description: string) => {
    const value = getSettingValue(settingKey);
    return (
      <div key={settingKey} className="space-y-2">
        <Label className="flex items-center gap-2 font-medium">
          {settingKey}
          {value && <CheckCircle2 className="h-4 w-4 text-green-500" />}
        </Label>
        <p className="text-sm text-muted-foreground">{description}</p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              type={showTokens[settingKey] ? "text" : "password"}
              value={value}
              onChange={(e) => handleValueChange(settingKey, e.target.value)}
              placeholder="กรอก token ที่นี่..."
              className="pr-10 font-mono text-sm"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full px-3"
              onClick={() => toggleShowToken(settingKey)}
            >
              {showTokens[settingKey] ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">กำลังโหลด...</div>
      </div>
    );
  }

  const lineConfigured = isConfigured(LINE_SETTINGS.map(s => s.key));
  const facebookConfigured = isConfigured(FACEBOOK_SETTINGS.map(s => s.key));

  return (
    <AdminLayout title="ตั้งค่า Integration">
      {/* Status Overview */}
      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <Card className={lineConfigured ? "border-green-500/50 bg-green-500/5" : "border-yellow-500/50 bg-yellow-500/5"}>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="p-3 rounded-full bg-green-500/10">
              <MessageSquare className="h-6 w-6 text-green-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">LINE Integration</h3>
              <p className="text-sm text-muted-foreground">
                {lineConfigured ? "เชื่อมต่อแล้ว" : "ยังไม่ได้ตั้งค่า"}
              </p>
            </div>
            {lineConfigured ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <AlertCircle className="h-5 w-5 text-yellow-500" />
            )}
          </CardContent>
        </Card>

        <Card className={facebookConfigured ? "border-blue-500/50 bg-blue-500/5" : "border-yellow-500/50 bg-yellow-500/5"}>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="p-3 rounded-full bg-blue-500/10">
              <MessageSquare className="h-6 w-6 text-blue-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Facebook Integration</h3>
              <p className="text-sm text-muted-foreground">
                {facebookConfigured ? "เชื่อมต่อแล้ว" : "ยังไม่ได้ตั้งค่า"}
              </p>
            </div>
            {facebookConfigured ? (
              <CheckCircle2 className="h-5 w-5 text-blue-500" />
            ) : (
              <AlertCircle className="h-5 w-5 text-yellow-500" />
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="line" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="line" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-green-500" />
            LINE
          </TabsTrigger>
          <TabsTrigger value="facebook" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-blue-500" />
            Facebook
          </TabsTrigger>
        </TabsList>

        {/* LINE Tab */}
        <TabsContent value="line" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-green-500" />
                LINE Messaging API
              </CardTitle>
              <CardDescription>
                ตั้งค่าการเชื่อมต่อกับ LINE Official Account เพื่อรับ-ส่งข้อความกับลูกค้า
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {LINE_SETTINGS.map(s => renderSettingInput(s.key, s.description))}
              
              <div className="pt-4 border-t">
                <Button onClick={() => handleSave('line')} disabled={isSaving} className="w-full sm:w-auto">
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? "กำลังบันทึก..." : "บันทึกการตั้งค่า LINE"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>วิธีการตั้งค่า LINE</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <ol className="list-decimal list-inside space-y-2">
                <li>ไปที่ <a href="https://developers.line.biz/console/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">LINE Developers Console <ExternalLink className="h-3 w-3" /></a></li>
                <li>เลือก Provider และ Channel ที่ต้องการ (หรือสร้างใหม่)</li>
                <li>ไปที่แท็บ <strong>"Messaging API"</strong></li>
                <li>คัดลอก <strong>Channel access token</strong> (กด Issue ถ้ายังไม่มี)</li>
                <li>ไปที่แท็บ <strong>"Basic settings"</strong> เพื่อคัดลอก <strong>Channel secret</strong></li>
                <li>ตั้งค่า Webhook URL เป็น: <code className="bg-muted px-2 py-1 rounded text-xs break-all">https://mufevyjzslfskdzccoao.supabase.co/functions/v1/line-webhook</code></li>
                <li>เปิดใช้งาน "Use webhook" และปิด "Auto-reply messages"</li>
              </ol>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Facebook Tab */}
        <TabsContent value="facebook" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-blue-500" />
                Facebook Messenger
              </CardTitle>
              <CardDescription>
                ตั้งค่าการเชื่อมต่อกับ Facebook Page เพื่อรับ-ส่งข้อความกับลูกค้า
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {FACEBOOK_SETTINGS.map(s => renderSettingInput(s.key, s.description))}
              
              <div className="pt-4 border-t">
                <Button onClick={() => handleSave('facebook')} disabled={isSaving} className="w-full sm:w-auto">
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? "กำลังบันทึก..." : "บันทึกการตั้งค่า Facebook"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>วิธีการตั้งค่า Facebook</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <ol className="list-decimal list-inside space-y-2">
                <li>ไปที่ <a href="https://developers.facebook.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">Facebook for Developers <ExternalLink className="h-3 w-3" /></a></li>
                <li>สร้าง App ใหม่ หรือเลือก App ที่มีอยู่</li>
                <li>เพิ่ม Product <strong>"Messenger"</strong></li>
                <li>ในส่วน <strong>"Access Tokens"</strong> เลือก Page และสร้าง Token</li>
                <li>คัดลอก <strong>App Secret</strong> จากหน้า Settings {">"} Basic</li>
                <li>กำหนด <strong>Verify Token</strong> เป็นข้อความใดก็ได้ที่คุณจำได้</li>
                <li>ตั้งค่า Webhook URL เป็น: <code className="bg-muted px-2 py-1 rounded text-xs break-all">https://mufevyjzslfskdzccoao.supabase.co/functions/v1/facebook-webhook</code></li>
                <li>ใส่ Verify Token เดียวกับที่กำหนดไว้ข้างบน</li>
                <li>Subscribe ไปที่ <strong>messages</strong> และ <strong>messaging_postbacks</strong></li>
              </ol>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
};

export default AdminIntegrations;
