import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Copy, Check, Code, ExternalLink, MessageCircle, Monitor, Smartphone, Plus, X, Image, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Json } from '@/integrations/supabase/types';

interface QuickAction {
  label: string;
  message: string;
}

export default function AdminEmbedCode() {
  const [copied, setCopied] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  
  // Widget customization state
  const [primaryColor, setPrimaryColor] = useState('#6366f1');
  const [position, setPosition] = useState('bottom-right');
  const [buttonSize, setButtonSize] = useState('56');
  const [windowWidth, setWindowWidth] = useState('380');
  const [windowHeight, setWindowHeight] = useState('500');
  const [autoOpen, setAutoOpen] = useState(false);
  const [botName, setBotName] = useState('AI Sales Assistant');
  const [welcomeMessage, setWelcomeMessage] = useState('สวัสดีครับ! ผมพร้อมช่วยแนะนำสินค้า รับออเดอร์ และตอบคำถามของคุณครับ');
  const [logoUrl, setLogoUrl] = useState('');
  const [quickActions, setQuickActions] = useState<QuickAction[]>([
    { label: 'ดูสินค้า', message: 'อยากดูสินค้าที่มีขายหน่อยครับ' },
    { label: 'สั่งซื้อ', message: 'ต้องการสั่งซื้อสินค้า' },
    { label: 'สอบถามราคา', message: 'อยากสอบถามราคาสินค้า' },
  ]);

  // Load settings from database
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('embed_settings')
          .select('*')
          .eq('is_active', true)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading embed settings:', error);
          return;
        }

        if (data) {
          setSettingsId(data.id);
          setPrimaryColor(data.primary_color);
          setPosition(data.position);
          setButtonSize(data.button_size);
          setWindowWidth(data.window_width);
          setWindowHeight(data.window_height);
          setAutoOpen(data.auto_open);
          setBotName(data.bot_name);
          setWelcomeMessage(data.welcome_message || '');
          setLogoUrl(data.logo_url || '');
          setQuickActions((data.quick_actions as unknown as QuickAction[]) || []);
        }
      } catch (err) {
        console.error('Error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  // Save settings to database
  const saveSettings = async () => {
    setIsSaving(true);
    try {
      const settingsData = {
        primary_color: primaryColor,
        position,
        button_size: buttonSize,
        window_width: windowWidth,
        window_height: windowHeight,
        auto_open: autoOpen,
        bot_name: botName,
        welcome_message: welcomeMessage,
        logo_url: logoUrl,
        quick_actions: JSON.parse(JSON.stringify(quickActions)) as Json,
        is_active: true,
      };

      if (settingsId) {
        // Update existing
        const { error } = await supabase
          .from('embed_settings')
          .update(settingsData)
          .eq('id', settingsId);

        if (error) throw error;
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('embed_settings')
          .insert([{ ...settingsData, name: 'default' }])
          .select()
          .single();

        if (error) throw error;
        if (data) setSettingsId(data.id);
      }

      toast.success('บันทึกการตั้งค่าเรียบร้อยแล้ว');
    } catch (err) {
      console.error('Error saving settings:', err);
      toast.error('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setIsSaving(false);
    }
  };

  const baseUrl = window.location.origin;

  // Encode quick actions for URL
  const quickActionsParam = encodeURIComponent(JSON.stringify(quickActions));

  // Generate embed URLs
  const widgetUrl = `${baseUrl}/embed-widget?color=${encodeURIComponent(primaryColor)}&position=${position}&buttonSize=${buttonSize}&width=${windowWidth}&height=${windowHeight}&autoOpen=${autoOpen}&botName=${encodeURIComponent(botName)}&welcomeMessage=${encodeURIComponent(welcomeMessage)}&logoUrl=${encodeURIComponent(logoUrl)}&quickActions=${quickActionsParam}`;
  const fullPageUrl = `${baseUrl}/embed`;

  const updateQuickAction = (index: number, field: 'label' | 'message', value: string) => {
    const updated = [...quickActions];
    updated[index][field] = value;
    setQuickActions(updated);
  };

  const addQuickAction = () => {
    if (quickActions.length < 5) {
      setQuickActions([...quickActions, { label: '', message: '' }]);
    }
  };

  const removeQuickAction = (index: number) => {
    setQuickActions(quickActions.filter((_, i) => i !== index));
  };

  // Generate embed codes
  const widgetIframeCode = `<iframe 
  src="${widgetUrl}" 
  style="position:fixed;bottom:0;${position === 'bottom-right' ? 'right' : 'left'}:0;width:${parseInt(windowWidth) + 40}px;height:${parseInt(windowHeight) + 100}px;border:none;z-index:9999;pointer-events:auto;background:transparent;"
  allow="microphone"
></iframe>`;

  const fullPageIframeCode = `<iframe 
  src="${fullPageUrl}" 
  style="width:100%;height:600px;border:none;border-radius:12px;"
  allow="microphone"
></iframe>`;

  const scriptCode = `<script>
(function() {
  var iframe = document.createElement('iframe');
  iframe.src = '${widgetUrl}';
  iframe.style.cssText = 'position:fixed;bottom:0;${position === 'bottom-right' ? 'right' : 'left'}:0;width:${parseInt(windowWidth) + 40}px;height:${parseInt(windowHeight) + 100}px;border:none;z-index:9999;pointer-events:auto;background:transparent;';
  iframe.allow = 'microphone';
  document.body.appendChild(iframe);
})();
</script>`;

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    toast.success('คัดลอกโค้ดแล้ว');
    setTimeout(() => setCopied(null), 2000);
  };

  if (isLoading) {
    return (
      <AdminLayout title="Embed Code Generator">
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Embed Code Generator">
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Embed Code Generator</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              สร้างโค้ดสำหรับฝัง Chatbot ในเว็บไซต์
            </p>
          </div>
          <Button onClick={saveSettings} disabled={isSaving} className="h-9 sm:h-10 w-full sm:w-auto">
            {isSaving ? (
              <Loader2 className="w-4 h-4 sm:mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 sm:mr-2" />
            )}
            <span className="sm:inline">บันทึกการตั้งค่า</span>
          </Button>
        </div>

        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          {/* Customization Panel */}
          <Card>
            <CardHeader className="py-3 sm:py-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                ปรับแต่ง Widget
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                ปรับแต่งรูปแบบและขนาดของ Chat Widget
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 sm:space-y-6">
              {/* Color Picker */}
              <div className="space-y-2">
                <Label>สีหลัก</Label>
                <div className="flex gap-3">
                  <Input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-14 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="flex-1"
                    placeholder="#6366f1"
                  />
                </div>
                <div className="flex gap-2 mt-2">
                  {['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'].map((color) => (
                    <button
                      key={color}
                      className="w-8 h-8 rounded-full border-2 border-white shadow-sm hover:scale-110 transition-transform"
                      style={{ backgroundColor: color }}
                      onClick={() => setPrimaryColor(color)}
                    />
                  ))}
                </div>
              </div>

              {/* Bot Name */}
              <div className="space-y-2">
                <Label>ชื่อ Chatbot</Label>
                <Input
                  type="text"
                  value={botName}
                  onChange={(e) => setBotName(e.target.value)}
                  placeholder="AI Sales Assistant"
                  maxLength={50}
                />
              </div>

              {/* Logo URL */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Image className="w-4 h-4" />
                  โลโก้/รูป Avatar
                </Label>
                <Input
                  type="url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://example.com/logo.png"
                />
                <p className="text-xs text-muted-foreground">
                  URL รูปภาพโลโก้ (แนะนำขนาด 40x40 px)
                </p>
                {logoUrl && (
                  <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                    <img 
                      src={logoUrl} 
                      alt="Preview" 
                      className="w-10 h-10 rounded-full object-cover border"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                    <span className="text-xs text-muted-foreground">ตัวอย่างโลโก้</span>
                  </div>
                )}
              </div>

              {/* Welcome Message */}
              <div className="space-y-2">
                <Label>ข้อความต้อนรับ</Label>
                <Textarea
                  value={welcomeMessage}
                  onChange={(e) => setWelcomeMessage(e.target.value)}
                  placeholder="สวัสดีครับ! ผมพร้อมช่วยแนะนำสินค้า..."
                  rows={3}
                  maxLength={200}
                />
                <p className="text-xs text-muted-foreground">
                  ({welcomeMessage.length}/200)
                </p>
              </div>

              {/* Position */}
              <div className="space-y-2">
                <Label>ตำแหน่ง</Label>
                <Select value={position} onValueChange={setPosition}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bottom-right">มุมขวาล่าง</SelectItem>
                    <SelectItem value="bottom-left">มุมซ้ายล่าง</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Button Size */}
              <div className="space-y-2">
                <Label>ขนาดปุ่ม (px)</Label>
                <Select value={buttonSize} onValueChange={setButtonSize}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="48">เล็ก (48px)</SelectItem>
                    <SelectItem value="56">ปกติ (56px)</SelectItem>
                    <SelectItem value="64">ใหญ่ (64px)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Window Size */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>ความกว้างหน้าต่าง (px)</Label>
                  <Input
                    type="number"
                    value={windowWidth}
                    onChange={(e) => setWindowWidth(e.target.value)}
                    min="300"
                    max="500"
                  />
                </div>
                <div className="space-y-2">
                  <Label>ความสูงหน้าต่าง (px)</Label>
                  <Input
                    type="number"
                    value={windowHeight}
                    onChange={(e) => setWindowHeight(e.target.value)}
                    min="400"
                    max="700"
                  />
                </div>
              </div>

              {/* Auto Open */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>เปิดอัตโนมัติ</Label>
                  <p className="text-sm text-muted-foreground">
                    เปิดหน้าต่างแชทอัตโนมัติเมื่อโหลดหน้า
                  </p>
                </div>
                <Switch checked={autoOpen} onCheckedChange={setAutoOpen} />
              </div>

              {/* Quick Actions */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>ปุ่มลัด Quick Actions</Label>
                  {quickActions.length < 5 && (
                    <Button variant="ghost" size="sm" onClick={addQuickAction}>
                      <Plus className="w-4 h-4 mr-1" />
                      เพิ่ม
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  {quickActions.map((action, index) => (
                    <div key={index} className="flex gap-2 items-start p-2 bg-muted/50 rounded-lg">
                      <div className="flex-1 space-y-2">
                        <Input
                          placeholder="ชื่อปุ่ม"
                          value={action.label}
                          onChange={(e) => updateQuickAction(index, 'label', e.target.value)}
                          className="h-8 text-sm"
                          maxLength={20}
                        />
                        <Input
                          placeholder="ข้อความที่ส่ง"
                          value={action.message}
                          onChange={(e) => updateQuickAction(index, 'message', e.target.value)}
                          className="h-8 text-sm"
                          maxLength={100}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => removeQuickAction(index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  ปุ่มลัดสำหรับลูกค้าเมื่อเปิด Widget (สูงสุด 5 ปุ่ม)
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Preview Panel */}
          <Card>
            <CardHeader className="py-3 sm:py-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Monitor className="w-4 h-4 sm:w-5 sm:h-5" />
                ตัวอย่าง
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                ดูตัวอย่างการแสดงผลของ Widget
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 sm:p-6">
              <div className="relative bg-muted/50 rounded-lg h-[280px] sm:h-[400px] overflow-hidden border">
                {/* Mock website content */}
                <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
                  <div className="h-6 sm:h-8 bg-muted rounded w-3/4" />
                  <div className="h-3 sm:h-4 bg-muted rounded w-full" />
                  <div className="h-3 sm:h-4 bg-muted rounded w-5/6" />
                  <div className="h-3 sm:h-4 bg-muted rounded w-4/6" />
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-4 sm:mt-6">
                    <div className="h-16 sm:h-24 bg-muted rounded" />
                    <div className="h-16 sm:h-24 bg-muted rounded" />
                  </div>
                </div>

                {/* Widget Preview */}
                <div 
                  className={`absolute ${position === 'bottom-right' ? 'right-3 sm:right-4' : 'left-3 sm:left-4'} bottom-3 sm:bottom-4`}
                >
                  <button
                    className="rounded-full shadow-lg flex items-center justify-center text-white"
                    style={{ 
                      backgroundColor: primaryColor,
                      width: `${Math.min(parseInt(buttonSize), 48)}px`,
                      height: `${Math.min(parseInt(buttonSize), 48)}px`
                    }}
                  >
                    <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                </div>
              </div>

              <div className="mt-3 sm:mt-4 flex gap-2">
                <Button variant="outline" className="flex-1 h-9 sm:h-10 text-xs sm:text-sm" asChild>
                  <a href="/widget-demo" target="_blank">
                    <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2" />
                    <span className="hidden xs:inline">ดู Demo</span>
                  </a>
                </Button>
                <Button variant="outline" className="flex-1 h-9 sm:h-10 text-xs sm:text-sm" asChild>
                  <a href={widgetUrl} target="_blank">
                    <Smartphone className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2" />
                    <span className="hidden xs:inline">ทดสอบ Widget</span>
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Embed Codes */}
        <Card>
          <CardHeader className="py-3 sm:py-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Code className="w-4 h-4 sm:w-5 sm:h-5" />
              โค้ดสำหรับฝัง
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              คัดลอกโค้ดด้านล่างไปวางในเว็บไซต์
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 sm:p-6">
            <Tabs defaultValue="widget">
              <TabsList className="mb-3 sm:mb-4 w-full grid grid-cols-3 h-auto">
                <TabsTrigger value="widget" className="text-xs sm:text-sm py-1.5 sm:py-2">Widget</TabsTrigger>
                <TabsTrigger value="fullpage" className="text-xs sm:text-sm py-1.5 sm:py-2">Full Page</TabsTrigger>
                <TabsTrigger value="script" className="text-xs sm:text-sm py-1.5 sm:py-2">Script</TabsTrigger>
              </TabsList>

              <TabsContent value="widget" className="space-y-3 sm:space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs sm:text-sm">วางโค้ดนี้ก่อน &lt;/body&gt;</Label>
                  <div className="relative">
                    <pre className="bg-muted p-3 sm:p-4 rounded-lg text-[10px] sm:text-sm overflow-x-auto whitespace-pre-wrap break-all max-h-[200px] sm:max-h-none">
                      {widgetIframeCode}
                    </pre>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="absolute top-2 right-2 h-7 w-7 sm:h-8 sm:w-auto sm:px-2"
                      onClick={() => copyToClipboard(widgetIframeCode, 'widget')}
                    >
                      {copied === 'widget' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="fullpage" className="space-y-3 sm:space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs sm:text-sm">สำหรับฝังแบบเต็มหน้า</Label>
                  <div className="relative">
                    <pre className="bg-muted p-3 sm:p-4 rounded-lg text-[10px] sm:text-sm overflow-x-auto whitespace-pre-wrap break-all max-h-[200px] sm:max-h-none">
                      {fullPageIframeCode}
                    </pre>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="absolute top-2 right-2 h-7 w-7 sm:h-8 sm:w-auto sm:px-2"
                      onClick={() => copyToClipboard(fullPageIframeCode, 'fullpage')}
                    >
                      {copied === 'fullpage' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="script" className="space-y-3 sm:space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs sm:text-sm">วิธีใช้ Script Tag</Label>
                  <div className="relative">
                    <pre className="bg-muted p-3 sm:p-4 rounded-lg text-[10px] sm:text-sm overflow-x-auto whitespace-pre-wrap break-all max-h-[200px] sm:max-h-none">
                      {scriptCode}
                    </pre>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="absolute top-2 right-2 h-7 w-7 sm:h-8 sm:w-auto sm:px-2"
                      onClick={() => copyToClipboard(scriptCode, 'script')}
                    >
                      {copied === 'script' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {/* Installation Guide */}
            <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-muted/50 rounded-lg">
              <h4 className="font-semibold mb-2 text-sm sm:text-base">📋 วิธีติดตั้ง</h4>
              <ul className="text-[10px] sm:text-sm text-muted-foreground space-y-1">
                <li>• <strong>WordPress:</strong> Theme Editor → footer.php</li>
                <li>• <strong>Wix:</strong> Settings → Custom Code</li>
                <li>• <strong>Shopify:</strong> Themes → Edit Code → theme.liquid</li>
                <li>• <strong>HTML:</strong> วางโค้ดก่อน &lt;/body&gt;</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
