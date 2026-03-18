import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AITemplateCard } from '@/components/admin/AITemplateCard';
import { AISettingsForm } from '@/components/admin/AISettingsForm';
import { AITestChat } from '@/components/admin/AITestChat';
import { AIProviderSelector } from '@/components/admin/AIProviderSelector';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCacheInvalidation } from '@/hooks/useCacheInvalidation';
import { Bot, Save, FlaskConical, Plus, Settings2, Store } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

interface AITemplate {
  id: string;
  name: string;
  description: string | null;
  ai_name: string;
  gender: string;
  personality: string | null;
  formality_level: number;
  use_emoji: boolean;
  response_length: string;
  greeting_message: string | null;
  closing_message: string | null;
  custom_rules: string | null;
  is_system: boolean;
}

interface AISettings {
  id?: string;
  template_id?: string | null;
  ai_name: string;
  gender: string;
  personality: string;
  formality_level: number;
  use_emoji: boolean;
  response_length: string;
  greeting_message: string;
  closing_message: string;
  custom_rules: string;
  avatar_url: string | null;
  ai_provider: string;
  default_store_type: string;
  use_auto_detect: boolean;
}

interface StoreType {
  value: string;
  label: string;
}

const defaultSettings: AISettings = {
  ai_name: 'น้องช้อป',
  gender: 'female',
  personality: 'ร่าเริง เป็นกันเอง สนุกสนาน',
  formality_level: 2,
  use_emoji: true,
  response_length: 'medium',
  greeting_message: 'สวัสดีค่ะ! 😊 ยินดีให้บริการค่ะ',
  closing_message: 'ขอบคุณมากค่ะ! 🙏',
  custom_rules: '',
  avatar_url: null,
  ai_provider: 'lovable',
  default_store_type: 'auto',
  use_auto_detect: true,
};

const defaultStoreTypes: StoreType[] = [
  { value: 'auto', label: '🔄 อัตโนมัติ (Auto-detect)' },
  { value: 'general', label: '🏪 ร้านทั่วไป' },
  { value: 'technology', label: '💻 เทคโนโลยี / IT' },
  { value: 'food', label: '🍽️ อาหาร / เครื่องดื่ม' },
  { value: 'beauty', label: '💄 ความงาม / เครื่องสำอาง' },
  { value: 'printer', label: '🖨️ ร้านปริ้นเตอร์' },
  { value: 'spa', label: '💆 สปา & นวด' },
  { value: 'clinic', label: '🏥 คลินิกทั่วไป' },
  { value: 'beauty_clinic', label: '✨ คลินิกความงาม' },
  { value: 'restaurant', label: '🍜 ร้านอาหาร' },
  { value: 'fitness', label: '🏋️ ฟิตเนส' },
  { value: 'education', label: '📚 โรงเรียน/กวดวิชา' },
  { value: 'car_repair', label: '🚗 อู่ซ่อมรถ' },
  { value: 'pet_clinic', label: '🐾 คลินิกสัตว์เลี้ยง' },
  { value: 'real_estate', label: '🏠 อสังหาริมทรัพย์' },
];

export default function AdminAISettings() {
  const [templates, setTemplates] = useState<AITemplate[]>([]);
  const [settings, setSettings] = useState<AISettings>(defaultSettings);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestOpen, setIsTestOpen] = useState(false);
  const [isSaveTemplateOpen, setIsSaveTemplateOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDescription, setNewTemplateDescription] = useState('');
  const [storeTypes, setStoreTypes] = useState<StoreType[]>(defaultStoreTypes);
  const { toast } = useToast();
  const { invalidateCache } = useCacheInvalidation();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch templates
      const { data: templatesData, error: templatesError } = await supabase
        .from('ai_personality_templates')
        .select('*')
        .order('is_system', { ascending: false })
        .order('created_at', { ascending: true });

      if (templatesError) throw templatesError;
      setTemplates(templatesData || []);

      // Fetch unique store types from category_expertise
      const { data: expertiseData } = await supabase
        .from('category_expertise')
        .select('store_type')
        .eq('is_active', true);

      if (expertiseData) {
        const uniqueStoreTypes = [...new Set(expertiseData.map(e => e.store_type).filter(Boolean))];
        const storeTypeLabels: Record<string, string> = {
          'general': '🏪 ร้านทั่วไป',
          'technology': '💻 เทคโนโลยี / IT',
          'food': '🍽️ อาหาร / เครื่องดื่ม',
          'beauty': '💄 ความงาม / เครื่องสำอาง',
          'printer': '🖨️ ร้านปริ้นเตอร์',
          'spa': '💆 สปา & นวด',
          'clinic': '🏥 คลินิกทั่วไป',
          'beauty_clinic': '✨ คลินิกความงาม',
          'restaurant': '🍜 ร้านอาหาร',
          'fitness': '🏋️ ฟิตเนส',
          'education': '📚 โรงเรียน/กวดวิชา',
          'car_repair': '🚗 อู่ซ่อมรถ',
          'pet_clinic': '🐾 คลินิกสัตว์เลี้ยง',
          'real_estate': '🏠 อสังหาริมทรัพย์',
        };
        
        const dynamicStoreTypes: StoreType[] = [
          { value: 'auto', label: '🔄 อัตโนมัติ (Auto-detect)' },
          ...uniqueStoreTypes.map(type => ({
            value: type as string,
            label: storeTypeLabels[type as string] || `📦 ${type}`,
          })),
        ];
        setStoreTypes(dynamicStoreTypes);
      }

      // Fetch current active settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('ai_settings')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (settingsError) throw settingsError;
      
      if (settingsData) {
        setSettings({
          id: settingsData.id,
          template_id: settingsData.template_id,
          ai_name: settingsData.ai_name,
          gender: settingsData.gender,
          personality: settingsData.personality || '',
          formality_level: settingsData.formality_level,
          use_emoji: settingsData.use_emoji,
          response_length: settingsData.response_length,
          greeting_message: settingsData.greeting_message || '',
          closing_message: settingsData.closing_message || '',
          custom_rules: settingsData.custom_rules || '',
          avatar_url: settingsData.avatar_url || null,
          ai_provider: settingsData.ai_provider || 'lovable',
          default_store_type: settingsData.default_store_type || 'auto',
          use_auto_detect: settingsData.use_auto_detect ?? true,
        });
        setSelectedTemplateId(settingsData.template_id);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถโหลดข้อมูลได้',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectTemplate = (template: AITemplate) => {
    setSelectedTemplateId(template.id);
    setSettings({
      ...settings,
      template_id: template.id,
      ai_name: template.ai_name,
      gender: template.gender,
      personality: template.personality || '',
      formality_level: template.formality_level,
      use_emoji: template.use_emoji,
      response_length: template.response_length,
      greeting_message: template.greeting_message || '',
      closing_message: template.closing_message || '',
      custom_rules: template.custom_rules || '',
    });
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      // Deactivate all existing settings
      await supabase
        .from('ai_settings')
        .update({ is_active: false })
        .eq('is_active', true);

      // Insert or update settings
      if (settings.id) {
        const { error } = await supabase
          .from('ai_settings')
          .update({
            template_id: selectedTemplateId,
            ai_name: settings.ai_name,
            gender: settings.gender,
            personality: settings.personality,
            formality_level: settings.formality_level,
            use_emoji: settings.use_emoji,
            response_length: settings.response_length,
            greeting_message: settings.greeting_message,
            closing_message: settings.closing_message,
            custom_rules: settings.custom_rules,
            avatar_url: settings.avatar_url,
            ai_provider: settings.ai_provider,
            default_store_type: settings.default_store_type,
            use_auto_detect: settings.use_auto_detect,
            is_active: true,
          })
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('ai_settings')
          .insert({
            template_id: selectedTemplateId,
            ai_name: settings.ai_name,
            gender: settings.gender,
            personality: settings.personality,
            formality_level: settings.formality_level,
            use_emoji: settings.use_emoji,
            response_length: settings.response_length,
            greeting_message: settings.greeting_message,
            closing_message: settings.closing_message,
            custom_rules: settings.custom_rules,
            avatar_url: settings.avatar_url,
            ai_provider: settings.ai_provider,
            default_store_type: settings.default_store_type,
            use_auto_detect: settings.use_auto_detect,
            is_active: true,
          });

        if (error) throw error;
      }

      toast({
        title: 'บันทึกสำเร็จ',
        description: 'ค่า AI ถูกบันทึกและใช้งานเรียบร้อยแล้ว',
      });
      
      await invalidateCache(['ai_settings']);
      fetchData();
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถบันทึกข้อมูลได้',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!newTemplateName.trim()) {
      toast({
        title: 'กรุณาใส่ชื่อ Template',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('ai_personality_templates')
        .insert({
          name: newTemplateName,
          description: newTemplateDescription,
          ai_name: settings.ai_name,
          gender: settings.gender,
          personality: settings.personality,
          formality_level: settings.formality_level,
          use_emoji: settings.use_emoji,
          response_length: settings.response_length,
          greeting_message: settings.greeting_message,
          closing_message: settings.closing_message,
          custom_rules: settings.custom_rules,
          is_system: false,
        });

      if (error) throw error;

      toast({
        title: 'บันทึก Template สำเร็จ',
        description: `Template "${newTemplateName}" ถูกสร้างเรียบร้อยแล้ว`,
      });
      
      await invalidateCache(['ai_settings']);
      setIsSaveTemplateOpen(false);
      setNewTemplateName('');
      setNewTemplateDescription('');
      fetchData();
    } catch (error) {
      console.error('Error saving template:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถบันทึก Template ได้',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      const { error } = await supabase
        .from('ai_personality_templates')
        .delete()
        .eq('id', templateId)
        .eq('is_system', false);

      if (error) throw error;

      toast({
        title: 'ลบ Template สำเร็จ',
      });
      
      await invalidateCache(['ai_settings']);
      if (selectedTemplateId === templateId) {
        setSelectedTemplateId(null);
      }
      fetchData();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถลบ Template ได้',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <AdminLayout title="ตั้งค่า AI">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="ตั้งค่า AI">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg shrink-0">
              <Bot className="w-6 h-6 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-bold truncate">AI Personality Settings</h2>
              <p className="text-xs sm:text-sm text-muted-foreground">กำหนดบุคลิกและสไตล์การสื่อสารของ AI</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsTestOpen(true)} className="flex-1 sm:flex-none">
              <FlaskConical className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">ทดสอบ AI</span>
            </Button>
            <Dialog open={isSaveTemplateOpen} onOpenChange={setIsSaveTemplateOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1 sm:flex-none">
                  <Plus className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">บันทึกเป็น Template</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>บันทึกเป็น Template ใหม่</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>ชื่อ Template</Label>
                    <Input
                      value={newTemplateName}
                      onChange={(e) => setNewTemplateName(e.target.value)}
                      placeholder="เช่น พนักงานขายของฉัน"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>คำอธิบาย</Label>
                    <Textarea
                      value={newTemplateDescription}
                      onChange={(e) => setNewTemplateDescription(e.target.value)}
                      placeholder="อธิบายว่า Template นี้เหมาะกับอะไร"
                      rows={3}
                    />
                  </div>
                  <Button onClick={handleSaveAsTemplate} className="w-full">
                    บันทึก Template
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button size="sm" onClick={handleSaveSettings} disabled={isSaving} className="flex-1 sm:flex-none">
              <Save className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">{isSaving ? 'กำลังบันทึก...' : 'บันทึกและใช้งาน'}</span>
            </Button>
          </div>
        </div>

        {/* Store Type Selection */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Store className="w-5 h-5 text-primary" />
              <CardTitle className="text-base sm:text-lg">ประเภทร้านค้า</CardTitle>
            </div>
            <CardDescription className="text-xs sm:text-sm">
              เลือกประเภทร้านค้าเพื่อให้ AI มีความเชี่ยวชาญเฉพาะทาง หรือใช้โหมดอัตโนมัติ
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">โหมดตรวจจับอัตโนมัติ</Label>
                  <p className="text-xs text-muted-foreground">
                    AI จะวิเคราะห์จากข้อความลูกค้าและปรับความเชี่ยวชาญตามหมวดหมู่สินค้า
                  </p>
                </div>
                <Switch
                  checked={settings.use_auto_detect}
                  onCheckedChange={(checked) => {
                    setSettings({ 
                      ...settings, 
                      use_auto_detect: checked,
                      default_store_type: checked ? 'auto' : settings.default_store_type === 'auto' ? 'general' : settings.default_store_type
                    });
                  }}
                />
              </div>
              
              {!settings.use_auto_detect && (
                <div className="space-y-2">
                  <Label>เลือกประเภทร้านค้า</Label>
                  <Select
                    value={settings.default_store_type}
                    onValueChange={(value) => setSettings({ ...settings, default_store_type: value })}
                  >
                    <SelectTrigger className="w-full bg-background">
                      <SelectValue placeholder="เลือกประเภทร้านค้า" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      {storeTypes.filter(st => st.value !== 'auto').map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    AI จะใช้ความเชี่ยวชาญของประเภทร้านที่เลือกตลอดเวลา
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tabs for different settings */}
        <Tabs defaultValue="personality" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="personality" className="text-xs sm:text-sm">
              <Bot className="w-4 h-4 mr-2" />
              บุคลิก AI
            </TabsTrigger>
            <TabsTrigger value="provider" className="text-xs sm:text-sm">
              <Settings2 className="w-4 h-4 mr-2" />
              AI Provider
            </TabsTrigger>
          </TabsList>

          <TabsContent value="personality" className="space-y-6">
            {/* Templates Section */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base sm:text-lg">เลือก Template สำเร็จรูป</CardTitle>
                <CardDescription className="text-xs sm:text-sm">เลือก Template ที่ต้องการแล้วปรับแต่งเพิ่มเติมได้</CardDescription>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-4">
                  {templates.map((template) => (
                    <AITemplateCard
                      key={template.id}
                      template={template}
                      isSelected={selectedTemplateId === template.id}
                      onSelect={() => handleSelectTemplate(template)}
                      onDelete={!template.is_system ? () => handleDeleteTemplate(template.id) : undefined}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Settings Form */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base sm:text-lg">ปรับแต่งเพิ่มเติม</CardTitle>
                <CardDescription className="text-xs sm:text-sm">ปรับค่าต่างๆ ให้ตรงกับความต้องการของคุณ</CardDescription>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <AISettingsForm
                  settings={{
                    ai_name: settings.ai_name,
                    gender: settings.gender,
                    personality: settings.personality,
                    formality_level: settings.formality_level,
                    use_emoji: settings.use_emoji,
                    response_length: settings.response_length,
                    greeting_message: settings.greeting_message,
                    closing_message: settings.closing_message,
                    custom_rules: settings.custom_rules,
                    avatar_url: settings.avatar_url,
                  }}
                  onChange={(newSettings) => setSettings({ ...settings, ...newSettings })}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="provider" className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base sm:text-lg">เลือก AI Provider</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  เลือก AI ที่ต้องการใช้งาน แต่ละตัวมีจุดเด่นแตกต่างกัน
                </CardDescription>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <AIProviderSelector
                  selectedProvider={settings.ai_provider}
                  onProviderChange={(provider) => setSettings({ ...settings, ai_provider: provider })}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Test Chat Dialog */}
        <AITestChat
          isOpen={isTestOpen}
          onClose={() => setIsTestOpen(false)}
          settings={settings}
        />
      </div>
    </AdminLayout>
  );
}