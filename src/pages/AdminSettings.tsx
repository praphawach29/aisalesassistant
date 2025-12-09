import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Key, MessageCircle, Settings, Eye, EyeOff } from "lucide-react";

interface Setting {
  id: string;
  key: string;
  value: string | null;
  description: string | null;
}

const AdminSettings = () => {
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
      setSettings(data || []);
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

  const handleSave = async () => {
    setIsSaving(true);
    try {
      for (const setting of settings) {
        const { error } = await supabase
          .from("settings")
          .update({ value: setting.value })
          .eq("key", setting.key);

        if (error) throw error;
      }

      toast({
        title: "บันทึกสำเร็จ",
        description: "การตั้งค่าถูกบันทึกเรียบร้อยแล้ว",
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

  const getIcon = (key: string) => {
    if (key.includes("LINE")) return <MessageCircle className="h-5 w-5 text-green-500" />;
    if (key.includes("FACEBOOK")) return <MessageCircle className="h-5 w-5 text-blue-500" />;
    return <Key className="h-5 w-5 text-muted-foreground" />;
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">กำลังโหลด...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Settings className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">ตั้งค่าระบบ</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              API Tokens
            </CardTitle>
            <CardDescription>
              กรอก Access Token สำหรับเชื่อมต่อกับ LINE และ Facebook เพื่อส่งการแจ้งเตือนไปยังลูกค้า
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {settings.map((setting) => (
              <div key={setting.id} className="space-y-2">
                <Label className="flex items-center gap-2">
                  {getIcon(setting.key)}
                  {setting.key}
                </Label>
                {setting.description && (
                  <p className="text-sm text-muted-foreground">{setting.description}</p>
                )}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showTokens[setting.key] ? "text" : "password"}
                      value={setting.value || ""}
                      onChange={(e) => handleValueChange(setting.key, e.target.value)}
                      placeholder="กรอก token ที่นี่..."
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => toggleShowToken(setting.key)}
                    >
                      {showTokens[setting.key] ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            <div className="pt-4 border-t">
              <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto">
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>วิธีการรับ Token</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div>
              <h4 className="font-medium text-foreground flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-green-500" />
                LINE Channel Access Token
              </h4>
              <ol className="list-decimal list-inside mt-2 space-y-1">
                <li>ไปที่ LINE Developers Console</li>
                <li>เลือก Provider และ Channel ที่ต้องการ</li>
                <li>ไปที่แท็บ "Messaging API"</li>
                <li>คัดลอก "Channel access token"</li>
              </ol>
            </div>
            <div>
              <h4 className="font-medium text-foreground flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-blue-500" />
                Facebook Page Access Token
              </h4>
              <ol className="list-decimal list-inside mt-2 space-y-1">
                <li>ไปที่ Facebook for Developers</li>
                <li>เลือก App ที่เชื่อมต่อกับ Page</li>
                <li>ไปที่ "Tools" {">"} "Graph API Explorer"</li>
                <li>เลือก Page และสร้าง Access Token</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AdminSettings;
