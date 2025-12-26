import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Eye, EyeOff, Key, Check, AlertCircle, Sparkles, Zap, Brain, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AIProvider {
  id: string;
  name: string;
  description: string;
  characteristics: string[];
  icon: React.ReactNode;
  color: string;
  requiresApiKey: boolean;
}

const AI_PROVIDERS: AIProvider[] = [
  {
    id: 'lovable',
    name: 'Lovable AI (แนะนำ)',
    description: 'AI เริ่มต้นที่ใช้งานได้ทันที ไม่ต้องใส่ API Key',
    characteristics: [
      'ใช้งานได้ทันที ไม่ต้องตั้งค่า',
      'รองรับภาษาไทยดี',
      'เหมาะสำหรับการเริ่มต้น',
      'ไม่มีค่าใช้จ่ายเพิ่มเติม',
    ],
    icon: <Sparkles className="w-5 h-5" />,
    color: 'bg-gradient-to-r from-violet-500 to-purple-500',
    requiresApiKey: false,
  },
  {
    id: 'openai',
    name: 'ChatGPT (OpenAI)',
    description: 'GPT-4o โมเดลอัจฉริยะจาก OpenAI',
    characteristics: [
      'ฉลาดมาก เข้าใจบริบทได้ดีเยี่ยม',
      'ตอบคำถามซับซ้อนได้ดี',
      'รองรับหลายภาษา',
      'เหมาะกับงานที่ต้องการคุณภาพสูง',
    ],
    icon: <MessageSquare className="w-5 h-5" />,
    color: 'bg-gradient-to-r from-emerald-500 to-teal-500',
    requiresApiKey: true,
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Gemini Pro จาก Google',
    characteristics: [
      'ตอบเร็ว ประสิทธิภาพสูง',
      'เข้าใจบริบทการสนทนาดี',
      'รองรับภาษาไทยได้ดี',
      'เหมาะกับการใช้งานหลากหลาย',
    ],
    icon: <Zap className="w-5 h-5" />,
    color: 'bg-gradient-to-r from-blue-500 to-cyan-500',
    requiresApiKey: true,
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    description: 'DeepSeek-V2 โมเดลจากจีน',
    characteristics: [
      'ราคาประหยัด คุ้มค่า',
      'ตอบได้ละเอียด',
      'เก่งเรื่อง coding และ logic',
      'เหมาะกับการใช้งานปริมาณมาก',
    ],
    icon: <Brain className="w-5 h-5" />,
    color: 'bg-gradient-to-r from-orange-500 to-amber-500',
    requiresApiKey: true,
  },
  {
    id: 'claude',
    name: 'Claude (Anthropic)',
    description: 'Claude 3 จาก Anthropic',
    characteristics: [
      'ปลอดภัย ตอบอย่างมีจริยธรรม',
      'เข้าใจคำถามยาวๆ ได้ดี',
      'ตอบอย่างละเอียดและครบถ้วน',
      'เหมาะกับงานที่ต้องการความแม่นยำ',
    ],
    icon: <Sparkles className="w-5 h-5" />,
    color: 'bg-gradient-to-r from-rose-500 to-pink-500',
    requiresApiKey: true,
  },
];

interface AIProviderSelectorProps {
  selectedProvider: string;
  onProviderChange: (provider: string) => void;
}

export function AIProviderSelector({ selectedProvider, onProviderChange }: AIProviderSelectorProps) {
  const [apiKeys, setApiKeys] = useState<Record<string, { key: string; isSet: boolean }>>({
    openai: { key: '', isSet: false },
    gemini: { key: '', isSet: false },
    deepseek: { key: '', isSet: false },
    claude: { key: '', isSet: false },
  });
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const fetchApiKeys = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_provider_keys')
        .select('provider, encrypted_api_key, is_active');

      if (error) throw error;

      const keysStatus: Record<string, { key: string; isSet: boolean }> = {
        openai: { key: '', isSet: false },
        gemini: { key: '', isSet: false },
        deepseek: { key: '', isSet: false },
        claude: { key: '', isSet: false },
      };

      data?.forEach((item) => {
        if (item.provider in keysStatus) {
          keysStatus[item.provider] = {
            key: '',
            isSet: !!item.encrypted_api_key && item.is_active,
          };
        }
      });

      setApiKeys(keysStatus);
    } catch (error) {
      console.error('Error fetching API keys:', error);
    }
  };

  const handleSaveApiKey = async (provider: string) => {
    const key = apiKeys[provider]?.key;
    if (!key?.trim()) {
      toast({
        title: 'กรุณาใส่ API Key',
        variant: 'destructive',
      });
      return;
    }

    setSavingKey(provider);
    try {
      // Encrypt and save the API key using edge function
      const { error } = await supabase.functions.invoke('settings-crypto', {
        body: {
          action: 'encrypt_provider_key',
          provider,
          value: key.trim(),
        },
      });

      if (error) throw error;

      toast({
        title: 'บันทึก API Key สำเร็จ',
        description: `${provider.toUpperCase()} API Key ถูกบันทึกเรียบร้อยแล้ว`,
      });

      setApiKeys((prev) => ({
        ...prev,
        [provider]: { key: '', isSet: true },
      }));
    } catch (error) {
      console.error('Error saving API key:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถบันทึก API Key ได้',
        variant: 'destructive',
      });
    } finally {
      setSavingKey(null);
    }
  };

  const handleRemoveApiKey = async (provider: string) => {
    setSavingKey(provider);
    try {
      const { error } = await supabase
        .from('ai_provider_keys')
        .delete()
        .eq('provider', provider);

      if (error) throw error;

      toast({
        title: 'ลบ API Key สำเร็จ',
      });

      setApiKeys((prev) => ({
        ...prev,
        [provider]: { key: '', isSet: false },
      }));

      // If this was the selected provider, switch back to lovable
      if (selectedProvider === provider) {
        onProviderChange('lovable');
      }
    } catch (error) {
      console.error('Error removing API key:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        variant: 'destructive',
      });
    } finally {
      setSavingKey(null);
    }
  };

  const canSelectProvider = (provider: AIProvider) => {
    if (!provider.requiresApiKey) return true;
    return apiKeys[provider.id]?.isSet;
  };

  return (
    <div className="space-y-6">
      <div>
        <h4 className="font-medium text-sm text-muted-foreground mb-4">เลือก AI Provider</h4>
        <RadioGroup
          value={selectedProvider}
          onValueChange={(value) => {
            const provider = AI_PROVIDERS.find((p) => p.id === value);
            if (provider && canSelectProvider(provider)) {
              onProviderChange(value);
            }
          }}
          className="grid gap-4"
        >
          {AI_PROVIDERS.map((provider) => {
            const isSelected = selectedProvider === provider.id;
            const canSelect = canSelectProvider(provider);
            const needsApiKey = provider.requiresApiKey && !apiKeys[provider.id]?.isSet;

            return (
              <div key={provider.id} className="space-y-3">
                <Card
                  className={`relative cursor-pointer transition-all ${
                    isSelected
                      ? 'ring-2 ring-primary border-primary'
                      : canSelect
                      ? 'hover:border-primary/50'
                      : 'opacity-60'
                  }`}
                  onClick={() => {
                    if (canSelect) {
                      onProviderChange(provider.id);
                    }
                  }}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <RadioGroupItem
                          value={provider.id}
                          id={provider.id}
                          disabled={!canSelect}
                          className="mt-1"
                        />
                        <div
                          className={`p-2 rounded-lg text-white ${provider.color}`}
                        >
                          {provider.icon}
                        </div>
                        <div>
                          <CardTitle className="text-sm sm:text-base flex items-center gap-2 flex-wrap">
                            {provider.name}
                            {isSelected && (
                              <Badge variant="default" className="text-xs">
                                <Check className="w-3 h-3 mr-1" />
                                ใช้งานอยู่
                              </Badge>
                            )}
                            {needsApiKey && (
                              <Badge variant="outline" className="text-xs">
                                <Key className="w-3 h-3 mr-1" />
                                ต้องใส่ API Key
                              </Badge>
                            )}
                          </CardTitle>
                          <CardDescription className="text-xs sm:text-sm mt-1">
                            {provider.description}
                          </CardDescription>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="ml-10 sm:ml-14">
                      <ul className="text-xs sm:text-sm text-muted-foreground space-y-1">
                        {provider.characteristics.map((char, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-primary mt-0.5">•</span>
                            <span>{char}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>

                {/* API Key Input for providers that require it */}
                {provider.requiresApiKey && (
                  <Card className="ml-4 sm:ml-8 border-dashed">
                    <CardContent className="pt-4 pb-4">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Key className="w-4 h-4 text-muted-foreground" />
                          <Label className="text-xs sm:text-sm">
                            {provider.name} API Key
                          </Label>
                          {apiKeys[provider.id]?.isSet && (
                            <Badge variant="secondary" className="text-xs">
                              <Check className="w-3 h-3 mr-1" />
                              ตั้งค่าแล้ว
                            </Badge>
                          )}
                        </div>

                        {apiKeys[provider.id]?.isSet ? (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-muted rounded-md px-3 py-2 text-sm text-muted-foreground">
                              ••••••••••••••••••••
                            </div>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveApiKey(provider.id);
                              }}
                              disabled={savingKey === provider.id}
                            >
                              ลบ
                            </Button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <Input
                                type={showKey[provider.id] ? 'text' : 'password'}
                                placeholder={`ใส่ ${provider.name} API Key`}
                                value={apiKeys[provider.id]?.key || ''}
                                onChange={(e) => {
                                  setApiKeys((prev) => ({
                                    ...prev,
                                    [provider.id]: {
                                      ...prev[provider.id],
                                      key: e.target.value,
                                    },
                                  }));
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="pr-10 text-sm"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowKey((prev) => ({
                                    ...prev,
                                    [provider.id]: !prev[provider.id],
                                  }));
                                }}
                              >
                                {showKey[provider.id] ? (
                                  <EyeOff className="w-4 h-4" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </Button>
                            </div>
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSaveApiKey(provider.id);
                              }}
                              disabled={savingKey === provider.id || !apiKeys[provider.id]?.key}
                            >
                              {savingKey === provider.id ? 'กำลังบันทึก...' : 'บันทึก'}
                            </Button>
                          </div>
                        )}

                        <p className="text-xs text-muted-foreground flex items-start gap-1">
                          <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                          <span>
                            API Key จะถูกเข้ารหัสและเก็บอย่างปลอดภัย ดู API Key ได้จาก{' '}
                            {provider.id === 'openai' && (
                              <a
                                href="https://platform.openai.com/api-keys"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                OpenAI Dashboard
                              </a>
                            )}
                            {provider.id === 'gemini' && (
                              <a
                                href="https://aistudio.google.com/apikey"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                Google AI Studio
                              </a>
                            )}
                            {provider.id === 'deepseek' && (
                              <a
                                href="https://platform.deepseek.com/api_keys"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                DeepSeek Platform
                              </a>
                            )}
                            {provider.id === 'claude' && (
                              <a
                                href="https://console.anthropic.com/settings/keys"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                Anthropic Console
                              </a>
                            )}
                          </span>
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            );
          })}
        </RadioGroup>
      </div>
    </div>
  );
}
