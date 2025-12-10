import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AISettings {
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

interface AISettingsFormProps {
  settings: AISettings;
  onChange: (settings: AISettings) => void;
}

const formalityLabels: Record<number, string> = {
  1: 'เป็นกันเองมาก',
  2: 'เป็นกันเอง',
  3: 'ปานกลาง',
  4: 'เป็นทางการ',
  5: 'เป็นทางการมาก',
};

export function AISettingsForm({ settings, onChange }: AISettingsFormProps) {
  const handleChange = (key: keyof AISettings, value: any) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Basic Info Section */}
      <div className="space-y-4">
        <h4 className="font-medium text-sm text-muted-foreground">ข้อมูลพื้นฐาน</h4>
        
        <div className="space-y-2">
          <Label htmlFor="ai_name">ชื่อ AI</Label>
          <Input
            id="ai_name"
            value={settings.ai_name}
            onChange={(e) => handleChange('ai_name', e.target.value)}
            placeholder="เช่น น้องช้อป, คุณเอ, พี่เซลล์"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="gender">เพศ</Label>
          <Select
            value={settings.gender}
            onValueChange={(value) => handleChange('gender', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="เลือกเพศ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="female">หญิง (ใช้ ค่ะ/คะ)</SelectItem>
              <SelectItem value="male">ชาย (ใช้ ครับ)</SelectItem>
              <SelectItem value="neutral">กลาง (ใช้ ครับ/ค่ะ)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="personality">บุคลิก/ลักษณะนิสัย</Label>
          <Textarea
            id="personality"
            value={settings.personality}
            onChange={(e) => handleChange('personality', e.target.value)}
            placeholder="อธิบายบุคลิกของ AI เช่น ร่าเริง เป็นกันเอง สนุกสนาน..."
            rows={3}
          />
        </div>
      </div>

      {/* Communication Style Section */}
      <div className="space-y-4">
        <h4 className="font-medium text-sm text-muted-foreground">สไตล์การสื่อสาร</h4>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>ระดับความเป็นทางการ</Label>
            <span className="text-sm text-muted-foreground">
              {formalityLabels[settings.formality_level]}
            </span>
          </div>
          <Slider
            value={[settings.formality_level]}
            onValueChange={([value]) => handleChange('formality_level', value)}
            min={1}
            max={5}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>เป็นกันเอง</span>
            <span>เป็นทางการ</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>ใช้ Emoji</Label>
            <p className="text-xs text-muted-foreground">เช่น 😊 🙏 ✨</p>
          </div>
          <Switch
            checked={settings.use_emoji}
            onCheckedChange={(checked) => handleChange('use_emoji', checked)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="response_length">ความยาวคำตอบ</Label>
          <Select
            value={settings.response_length}
            onValueChange={(value) => handleChange('response_length', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="เลือกความยาว" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="short">กระชับ (1-2 ประโยค)</SelectItem>
              <SelectItem value="medium">ปานกลาง (3-4 ประโยค)</SelectItem>
              <SelectItem value="long">ละเอียด (5+ ประโยค)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Scripts Section */}
      <div className="space-y-4 md:col-span-2">
        <h4 className="font-medium text-sm text-muted-foreground">สคริปต์และกฎ</h4>
        
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="greeting_message">ข้อความทักทายเริ่มต้น</Label>
            <Textarea
              id="greeting_message"
              value={settings.greeting_message}
              onChange={(e) => handleChange('greeting_message', e.target.value)}
              placeholder="ข้อความที่จะใช้ทักทายลูกค้าเมื่อเริ่มสนทนา"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="closing_message">ข้อความปิดท้าย/ขอบคุณ</Label>
            <Textarea
              id="closing_message"
              value={settings.closing_message}
              onChange={(e) => handleChange('closing_message', e.target.value)}
              placeholder="ข้อความที่จะใช้ขอบคุณหรือปิดท้ายการสนทนา"
              rows={3}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="custom_rules">กฎพิเศษ / เรื่องที่ห้ามพูด</Label>
          <Textarea
            id="custom_rules"
            value={settings.custom_rules}
            onChange={(e) => handleChange('custom_rules', e.target.value)}
            placeholder="กำหนดกฎพิเศษ เช่น ห้ามพูดเรื่องการเมือง, ห้ามเปิดเผยสต็อก, ห้ามพูดถึงคู่แข่ง..."
            rows={4}
          />
          <p className="text-xs text-muted-foreground">
            คั่นแต่ละกฎด้วยเครื่องหมาย , (comma)
          </p>
        </div>
      </div>
    </div>
  );
}