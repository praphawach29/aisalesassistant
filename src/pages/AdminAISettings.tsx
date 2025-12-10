import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AITemplateCard } from '@/components/admin/AITemplateCard';
import { AISettingsForm } from '@/components/admin/AISettingsForm';
import { AITestChat } from '@/components/admin/AITestChat';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Bot, Save, FlaskConical, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

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
};

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
  const { toast } = useToast();

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
            is_active: true,
          });

        if (error) throw error;
      }

      toast({
        title: 'บันทึกสำเร็จ',
        description: 'ค่า AI ถูกบันทึกและใช้งานเรียบร้อยแล้ว',
      });
      
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Bot className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold">AI Personality Settings</h2>
              <p className="text-sm text-muted-foreground">กำหนดบุคลิกและสไตล์การสื่อสารของ AI</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsTestOpen(true)}>
              <FlaskConical className="w-4 h-4 mr-2" />
              ทดสอบ AI
            </Button>
            <Dialog open={isSaveTemplateOpen} onOpenChange={setIsSaveTemplateOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  บันทึกเป็น Template
                </Button>
              </DialogTrigger>
              <DialogContent>
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
            <Button onClick={handleSaveSettings} disabled={isSaving}>
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? 'กำลังบันทึก...' : 'บันทึกและใช้งาน'}
            </Button>
          </div>
        </div>

        {/* Templates Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">เลือก Template สำเร็จรูป</CardTitle>
            <CardDescription>เลือก Template ที่ต้องการแล้วปรับแต่งเพิ่มเติมได้</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
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
          <CardHeader>
            <CardTitle className="text-lg">ปรับแต่งเพิ่มเติม</CardTitle>
            <CardDescription>ปรับค่าต่างๆ ให้ตรงกับความต้องการของคุณ</CardDescription>
          </CardHeader>
          <CardContent>
            <AISettingsForm
              settings={settings}
              onChange={setSettings}
            />
          </CardContent>
        </Card>

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