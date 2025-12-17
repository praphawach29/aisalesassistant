import { useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, Check, Code, ExternalLink, MessageCircle, Monitor, Smartphone } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminEmbedCode() {
  const [copied, setCopied] = useState<string | null>(null);
  
  // Widget customization state
  const [primaryColor, setPrimaryColor] = useState('#6366f1');
  const [position, setPosition] = useState('bottom-right');
  const [buttonSize, setButtonSize] = useState('56');
  const [windowWidth, setWindowWidth] = useState('380');
  const [windowHeight, setWindowHeight] = useState('500');
  const [autoOpen, setAutoOpen] = useState(false);

  const baseUrl = window.location.origin;

  // Generate embed URLs
  const widgetUrl = `${baseUrl}/embed-widget?color=${encodeURIComponent(primaryColor)}&position=${position}&buttonSize=${buttonSize}&width=${windowWidth}&height=${windowHeight}&autoOpen=${autoOpen}`;
  const fullPageUrl = `${baseUrl}/embed`;

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

  return (
    <AdminLayout title="Embed Code Generator">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Embed Code Generator</h1>
          <p className="text-muted-foreground mt-1">
            สร้างโค้ดสำหรับฝัง Chatbot ในเว็บไซต์ของคุณ
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Customization Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                ปรับแต่ง Widget
              </CardTitle>
              <CardDescription>
                ปรับแต่งรูปแบบและขนาดของ Chat Widget
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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
            </CardContent>
          </Card>

          {/* Preview Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="w-5 h-5" />
                ตัวอย่าง
              </CardTitle>
              <CardDescription>
                ดูตัวอย่างการแสดงผลของ Widget
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative bg-muted/50 rounded-lg h-[400px] overflow-hidden border">
                {/* Mock website content */}
                <div className="p-4 space-y-4">
                  <div className="h-8 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-full" />
                  <div className="h-4 bg-muted rounded w-5/6" />
                  <div className="h-4 bg-muted rounded w-4/6" />
                  <div className="grid grid-cols-2 gap-4 mt-6">
                    <div className="h-24 bg-muted rounded" />
                    <div className="h-24 bg-muted rounded" />
                  </div>
                </div>

                {/* Widget Preview */}
                <div 
                  className={`absolute ${position === 'bottom-right' ? 'right-4' : 'left-4'} bottom-4`}
                >
                  <button
                    className="rounded-full shadow-lg flex items-center justify-center text-white"
                    style={{ 
                      backgroundColor: primaryColor,
                      width: `${buttonSize}px`,
                      height: `${buttonSize}px`
                    }}
                  >
                    <MessageCircle className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <Button variant="outline" className="flex-1" asChild>
                  <a href="/widget-demo" target="_blank">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    ดู Demo
                  </a>
                </Button>
                <Button variant="outline" className="flex-1" asChild>
                  <a href={widgetUrl} target="_blank">
                    <Smartphone className="w-4 h-4 mr-2" />
                    ทดสอบ Widget
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Embed Codes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="w-5 h-5" />
              โค้ดสำหรับฝัง
            </CardTitle>
            <CardDescription>
              คัดลอกโค้ดด้านล่างไปวางในเว็บไซต์ของคุณ
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="widget">
              <TabsList className="mb-4">
                <TabsTrigger value="widget">Popup Widget</TabsTrigger>
                <TabsTrigger value="fullpage">Full Page</TabsTrigger>
                <TabsTrigger value="script">Script Tag</TabsTrigger>
              </TabsList>

              <TabsContent value="widget" className="space-y-4">
                <div className="space-y-2">
                  <Label>วางโค้ดนี้ก่อน &lt;/body&gt; ในเว็บไซต์ของคุณ</Label>
                  <div className="relative">
                    <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto whitespace-pre-wrap break-all">
                      {widgetIframeCode}
                    </pre>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(widgetIframeCode, 'widget')}
                    >
                      {copied === 'widget' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="fullpage" className="space-y-4">
                <div className="space-y-2">
                  <Label>สำหรับฝังแบบเต็มหน้า (เหมาะสำหรับหน้า Contact Us)</Label>
                  <div className="relative">
                    <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto whitespace-pre-wrap break-all">
                      {fullPageIframeCode}
                    </pre>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(fullPageIframeCode, 'fullpage')}
                    >
                      {copied === 'fullpage' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="script" className="space-y-4">
                <div className="space-y-2">
                  <Label>วิธีใช้ Script Tag (ง่ายกว่า iframe)</Label>
                  <div className="relative">
                    <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto whitespace-pre-wrap break-all">
                      {scriptCode}
                    </pre>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(scriptCode, 'script')}
                    >
                      {copied === 'script' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {/* Installation Guide */}
            <div className="mt-6 p-4 bg-muted/50 rounded-lg">
              <h4 className="font-semibold mb-2">📋 วิธีติดตั้ง</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <strong>WordPress:</strong> ไปที่ Appearance → Theme Editor → footer.php → วางโค้ดก่อน &lt;/body&gt;</li>
                <li>• <strong>Wix:</strong> ไปที่ Settings → Custom Code → Add Code → Body End</li>
                <li>• <strong>Shopify:</strong> ไปที่ Online Store → Themes → Edit Code → theme.liquid → วางก่อน &lt;/body&gt;</li>
                <li>• <strong>HTML ทั่วไป:</strong> วางโค้ดก่อน &lt;/body&gt; ในไฟล์ HTML</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
