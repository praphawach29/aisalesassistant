import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useCacheInvalidation } from "@/hooks/useCacheInvalidation";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Save, Store, Bell, Shield, Loader2, CreditCard } from "lucide-react";
import { AdminLayout } from '@/components/admin/AdminLayout';

interface StoreSetting {
  key: string;
  value: string;
  description: string;
}

const DEFAULT_STORE_SETTINGS: StoreSetting[] = [
  { key: 'STORE_NAME', value: '', description: 'ชื่อร้านค้า' },
  { key: 'STORE_PHONE', value: '', description: 'เบอร์โทรติดต่อ' },
  { key: 'STORE_ADDRESS', value: '', description: 'ที่อยู่ร้านค้า' },
  { key: 'STORE_EMAIL', value: '', description: 'อีเมลติดต่อ' },
  { key: 'BUSINESS_HOURS', value: '', description: 'เวลาทำการ' },
  { key: 'LINE_ID', value: '', description: 'LINE ID' },
  { key: 'FACEBOOK_PAGE', value: '', description: 'Facebook Page' },
  { key: 'INSTAGRAM', value: '', description: 'Instagram' },
  { key: 'BANK_ACCOUNTS', value: '', description: 'บัญชีธนาคาร' },
  { key: 'PAYMENT_METHODS', value: '', description: 'วิธีการชำระเงิน' },
  { key: 'RETURN_POLICY', value: '', description: 'นโยบายการคืนสินค้า' },
  { key: 'SHIPPING_INFO', value: '', description: 'ข้อมูลการจัดส่ง' },
  { key: 'WARRANTY_INFO', value: '', description: 'ข้อมูลการรับประกัน' },
  { key: 'PRIVACY_POLICY', value: '', description: 'นโยบายความเป็นส่วนตัว' },
  { key: 'TERMS_CONDITIONS', value: '', description: 'ข้อกำหนดและเงื่อนไข' },
];

const AdminSettings = () => {
  const { toast } = useToast();
  const { invalidateCache } = useCacheInvalidation();
  const { isAdmin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<StoreSetting[]>(DEFAULT_STORE_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Notification preferences
  const [notifyNewOrders, setNotifyNewOrders] = useState(true);
  const [notifyLowStock, setNotifyLowStock] = useState(true);
  const [lowStockThreshold, setLowStockThreshold] = useState("5");
  const [autoNotifyCustomers, setAutoNotifyCustomers] = useState(true);
  
  // Payment settings (for Flex Message)
  const [bankName, setBankName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");
  const [promptpayId, setPromptpayId] = useState("");
  const [promptpayError, setPromptpayError] = useState("");
  const [bankAccountError, setBankAccountError] = useState("");

  // Validate bank account number (digits only, 10-15 digits typical for Thai banks)
  const validateBankAccountNumber = (value: string): string => {
    if (!value) return ""; // Empty is allowed
    const digitsOnly = value.replace(/\D/g, '');
    if (digitsOnly.length < 10 || digitsOnly.length > 15) {
      return "เลขบัญชีธนาคารควรมี 10-15 หลัก";
    }
    return "";
  };

  const handleBankAccountChange = (value: string) => {
    // Only allow digits and dashes for formatting
    const cleanValue = value.replace(/[^0-9-]/g, '');
    setBankAccountNumber(cleanValue);
    setBankAccountError(validateBankAccountNumber(cleanValue));
  };

  // Validate PromptPay ID (10 digits for phone or 13 digits for national ID)
  const validatePromptpayId = (value: string): string => {
    if (!value) return ""; // Empty is allowed
    const digitsOnly = value.replace(/\D/g, '');
    if (digitsOnly.length !== 10 && digitsOnly.length !== 13) {
      return "เลขพร้อมเพย์ต้องเป็นเบอร์โทร 10 หลัก หรือเลขบัตรประชาชน 13 หลัก";
    }
    return "";
  };

  const handlePromptpayChange = (value: string) => {
    // Only allow digits and common separators
    const cleanValue = value.replace(/[^0-9-]/g, '');
    setPromptpayId(cleanValue);
    setPromptpayError(validatePromptpayId(cleanValue));
  };

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
      
      // Merge with defaults
      const mergedSettings = DEFAULT_STORE_SETTINGS.map(defaultSetting => {
        const dbSetting = data?.find(s => s.key === defaultSetting.key);
        return {
          ...defaultSetting,
          value: dbSetting?.value || ''
        };
      });
      
      setSettings(mergedSettings);

      // Load notification preferences
      const notifyOrders = data?.find(s => s.key === 'NOTIFY_NEW_ORDERS');
      const notifyStock = data?.find(s => s.key === 'NOTIFY_LOW_STOCK');
      const stockThreshold = data?.find(s => s.key === 'LOW_STOCK_THRESHOLD');
      const autoNotify = data?.find(s => s.key === 'AUTO_NOTIFY_CUSTOMERS');
      
      if (notifyOrders) setNotifyNewOrders(notifyOrders.value === 'true');
      if (notifyStock) setNotifyLowStock(notifyStock.value === 'true');
      if (stockThreshold) setLowStockThreshold(stockThreshold.value || '5');
      if (autoNotify) setAutoNotifyCustomers(autoNotify.value === 'true');
      
      // Load payment settings for Flex Message
      const bankNameSetting = data?.find(s => s.key === 'bank_name');
      const bankAccNumSetting = data?.find(s => s.key === 'bank_account_number');
      const bankAccNameSetting = data?.find(s => s.key === 'bank_account_name');
      const promptpaySetting = data?.find(s => s.key === 'promptpay_id');
      
      if (bankNameSetting) setBankName(bankNameSetting.value || '');
      if (bankAccNumSetting) setBankAccountNumber(bankAccNumSetting.value || '');
      if (bankAccNameSetting) setBankAccountName(bankAccNameSetting.value || '');
      if (promptpaySetting) setPromptpayId(promptpaySetting.value || '');
      
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

  const saveSetting = async (key: string, value: string, description?: string) => {
    const { data: existing } = await supabase
      .from("settings")
      .select("id")
      .eq("key", key)
      .maybeSingle();
    
    if (existing) {
      await supabase.from("settings").update({ value }).eq("key", key);
    } else {
      await supabase.from("settings").insert({ key, value, description });
    }
  };

  const handleSave = async () => {
    // Validate bank account before saving
    const bankError = validateBankAccountNumber(bankAccountNumber);
    if (bankError) {
      setBankAccountError(bankError);
      toast({
        title: "ข้อมูลไม่ถูกต้อง",
        description: bankError,
        variant: "destructive",
      });
      return;
    }
    
    // Validate promptpay before saving
    const ppError = validatePromptpayId(promptpayId);
    if (ppError) {
      setPromptpayError(ppError);
      toast({
        title: "ข้อมูลไม่ถูกต้อง",
        description: ppError,
        variant: "destructive",
      });
      return;
    }
    
    setIsSaving(true);
    try {
      // Save store settings
      for (const setting of settings) {
        await saveSetting(setting.key, setting.value, setting.description);
      }

      // Save notification preferences
      await saveSetting('NOTIFY_NEW_ORDERS', String(notifyNewOrders), 'แจ้งเตือนออเดอร์ใหม่');
      await saveSetting('NOTIFY_LOW_STOCK', String(notifyLowStock), 'แจ้งเตือนสินค้าใกล้หมด');
      await saveSetting('LOW_STOCK_THRESHOLD', lowStockThreshold, 'จำนวนสินค้าที่ถือว่าใกล้หมด');
      await saveSetting('AUTO_NOTIFY_CUSTOMERS', String(autoNotifyCustomers), 'แจ้งเตือนลูกค้าอัตโนมัติเมื่อสถานะออเดอร์เปลี่ยน');

      // Save payment settings for Flex Message
      await saveSetting('bank_name', bankName, 'ชื่อธนาคารสำหรับ Flex Message');
      await saveSetting('bank_account_number', bankAccountNumber, 'เลขบัญชีธนาคารสำหรับ Flex Message');
      await saveSetting('bank_account_name', bankAccountName, 'ชื่อบัญชีธนาคารสำหรับ Flex Message');
      await saveSetting('promptpay_id', promptpayId, 'เลขพร้อมเพย์สำหรับ Flex Message');

      // Invalidate edge function cache
      await invalidateCache(['settings']);

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

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <AdminLayout title="ตั้งค่าระบบ">
      <div className="space-y-6">
        {/* Store Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              ข้อมูลร้านค้า
            </CardTitle>
            <CardDescription>
              ข้อมูลพื้นฐานของร้านค้าที่จะแสดงให้ลูกค้าเห็น และใช้ในการสนทนากับ AI
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Basic Info */}
            <div className="grid gap-4 md:grid-cols-2">
              {settings.filter(s => ['STORE_NAME', 'STORE_PHONE', 'STORE_ADDRESS', 'STORE_EMAIL'].includes(s.key)).map((setting) => (
                <div key={setting.key} className="space-y-2">
                  <Label>{setting.description}</Label>
                  <Input
                    value={setting.value}
                    onChange={(e) => handleValueChange(setting.key, e.target.value)}
                    placeholder={`กรอก${setting.description}...`}
                  />
                </div>
              ))}
            </div>
            
            {/* Business Hours */}
            <div className="space-y-2">
              <Label>เวลาทำการ</Label>
              <Input
                value={settings.find(s => s.key === 'BUSINESS_HOURS')?.value || ''}
                onChange={(e) => handleValueChange('BUSINESS_HOURS', e.target.value)}
                placeholder="เช่น: จันทร์-ศุกร์ 09:00-18:00, เสาร์ 10:00-16:00"
              />
            </div>

            {/* Other Contact Channels */}
            <div>
              <Label className="text-base font-medium">ช่องทางติดต่ออื่นๆ</Label>
              <div className="grid gap-4 md:grid-cols-3 mt-3">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">LINE ID</Label>
                  <Input
                    value={settings.find(s => s.key === 'LINE_ID')?.value || ''}
                    onChange={(e) => handleValueChange('LINE_ID', e.target.value)}
                    placeholder="@yourlineid"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Facebook Page</Label>
                  <Input
                    value={settings.find(s => s.key === 'FACEBOOK_PAGE')?.value || ''}
                    onChange={(e) => handleValueChange('FACEBOOK_PAGE', e.target.value)}
                    placeholder="facebook.com/yourpage"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Instagram</Label>
                  <Input
                    value={settings.find(s => s.key === 'INSTAGRAM')?.value || ''}
                    onChange={(e) => handleValueChange('INSTAGRAM', e.target.value)}
                    placeholder="@yourinstagram"
                  />
                </div>
              </div>
            </div>

            {/* Bank Accounts */}
            <div className="space-y-2">
              <Label>บัญชีธนาคาร</Label>
              <Textarea
                value={settings.find(s => s.key === 'BANK_ACCOUNTS')?.value || ''}
                onChange={(e) => handleValueChange('BANK_ACCOUNTS', e.target.value)}
                placeholder="เช่น: ธนาคารกสิกรไทย 123-4-56789-0 ชื่อบัญชี&#10;ธนาคารไทยพาณิชย์ 987-6-54321-0 ชื่อบัญชี"
                rows={3}
              />
            </div>
            
            {/* Payment Methods */}
            <div className="space-y-2">
              <Label>วิธีการชำระเงิน</Label>
              <Textarea
                value={settings.find(s => s.key === 'PAYMENT_METHODS')?.value || ''}
                onChange={(e) => handleValueChange('PAYMENT_METHODS', e.target.value)}
                placeholder="เช่น: โอนเงินผ่านธนาคาร, PromptPay, บัตรเครดิต/เดบิต, เก็บเงินปลายทาง (COD)..."
                rows={2}
              />
            </div>

            {/* Return Policy */}
            <div className="space-y-2">
              <Label>นโยบายการคืนสินค้า</Label>
              <Textarea
                value={settings.find(s => s.key === 'RETURN_POLICY')?.value || ''}
                onChange={(e) => handleValueChange('RETURN_POLICY', e.target.value)}
                placeholder="เช่น: รับคืนสินค้าภายใน 7 วัน หากสินค้ามีปัญหาจากการผลิต..."
                rows={3}
              />
            </div>

            {/* Shipping Info */}
            <div className="space-y-2">
              <Label>ข้อมูลการจัดส่ง</Label>
              <Textarea
                value={settings.find(s => s.key === 'SHIPPING_INFO')?.value || ''}
                onChange={(e) => handleValueChange('SHIPPING_INFO', e.target.value)}
                placeholder="เช่น: จัดส่งทุกวันจันทร์-ศุกร์ ภายใน 1-3 วันทำการ..."
                rows={3}
              />
            </div>

            {/* Warranty Info */}
            <div className="space-y-2">
              <Label>ข้อมูลการรับประกัน</Label>
              <Textarea
                value={settings.find(s => s.key === 'WARRANTY_INFO')?.value || ''}
                onChange={(e) => handleValueChange('WARRANTY_INFO', e.target.value)}
                placeholder="เช่น: รับประกันสินค้า 1 ปี กรณีชำรุดจากการใช้งานปกติ..."
                rows={2}
              />
            </div>

            {/* Privacy Policy */}
            <div className="space-y-2">
              <Label>นโยบายความเป็นส่วนตัว</Label>
              <Textarea
                value={settings.find(s => s.key === 'PRIVACY_POLICY')?.value || ''}
                onChange={(e) => handleValueChange('PRIVACY_POLICY', e.target.value)}
                placeholder="เช่น: เราจะเก็บรักษาข้อมูลส่วนบุคคลของท่านเป็นความลับ และใช้เพื่อการจัดส่งสินค้าเท่านั้น..."
                rows={3}
              />
            </div>

            {/* Terms & Conditions */}
            <div className="space-y-2">
              <Label>ข้อกำหนดและเงื่อนไข</Label>
              <Textarea
                value={settings.find(s => s.key === 'TERMS_CONDITIONS')?.value || ''}
                onChange={(e) => handleValueChange('TERMS_CONDITIONS', e.target.value)}
                placeholder="เช่น: การสั่งซื้อสินค้าถือว่าลูกค้ายอมรับเงื่อนไขการซื้อขาย..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Payment Settings for Flex Message */}
        <Card className="border-green-500/30 bg-green-500/5">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-green-600 text-base sm:text-lg">
              <CreditCard className="h-5 w-5 flex-shrink-0" />
              <span>ข้อมูลชำระเงินสำหรับ LINE Flex Message</span>
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              ข้อมูลนี้จะแสดงใน Flex Message เมื่อลูกค้าสั่งซื้อสำเร็จผ่าน LINE
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Bank Info */}
            <div>
              <Label className="text-base font-medium">ข้อมูลบัญชีธนาคาร</Label>
              <p className="text-xs sm:text-sm text-muted-foreground mb-3">
                แสดงในการ์ดยืนยันออเดอร์พร้อมปุ่มคัดลอกเลขบัญชี
              </p>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">ชื่อธนาคาร</Label>
                  <Input
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="เช่น: ธนาคารกสิกรไทย"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">เลขบัญชี</Label>
                  <Input
                    value={bankAccountNumber}
                    onChange={(e) => handleBankAccountChange(e.target.value)}
                    placeholder="เช่น: 123-4-56789-0"
                    className={bankAccountError ? "border-destructive" : ""}
                  />
                  {bankAccountError && (
                    <p className="text-xs text-destructive">{bankAccountError}</p>
                  )}
                </div>
                <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                  <Label className="text-sm text-muted-foreground">ชื่อบัญชี</Label>
                  <Input
                    value={bankAccountName}
                    onChange={(e) => setBankAccountName(e.target.value)}
                    placeholder="เช่น: นาย ใจดี มีเงิน"
                  />
                </div>
              </div>
            </div>

            {/* PromptPay */}
            <div className="border-t pt-6">
              <Label className="text-base font-medium">พร้อมเพย์</Label>
              <p className="text-xs sm:text-sm text-muted-foreground mb-3">
                แสดง QR Code พร้อมเพย์พร้อมยอดเงินในการ์ดยืนยันออเดอร์
              </p>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">เลขพร้อมเพย์</Label>
                <Input
                  value={promptpayId}
                  onChange={(e) => handlePromptpayChange(e.target.value)}
                  placeholder="เบอร์โทรหรือเลขบัตรประชาชน เช่น: 0812345678"
                  className={`max-w-full sm:max-w-sm ${promptpayError ? "border-destructive" : ""}`}
                />
                {promptpayError ? (
                  <p className="text-xs text-destructive">{promptpayError}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    ใส่เบอร์โทรศัพท์ (10 หลัก) หรือเลขบัตรประชาชน (13 หลัก)
                  </p>
                )}
              </div>
              
              {promptpayId && !promptpayError && (
                <div className="mt-4 p-3 sm:p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium mb-3 text-center sm:text-left">ตัวอย่าง QR Code (ยอด 100 บาท)</p>
                  <div className="flex flex-col items-center sm:items-start gap-2">
                    <div className="relative">
                      <img 
                        src={`https://promptpay.io/${promptpayId.replace(/-/g, '')}/100.png`}
                        alt="PromptPay QR Code"
                        className="w-36 h-36 sm:w-32 sm:h-32 border rounded bg-white"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const errorDiv = target.nextElementSibling as HTMLElement;
                          if (errorDiv) errorDiv.style.display = 'flex';
                        }}
                        onLoad={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'block';
                          const errorDiv = target.nextElementSibling as HTMLElement;
                          if (errorDiv) errorDiv.style.display = 'none';
                        }}
                      />
                      <div 
                        className="w-36 h-36 sm:w-32 sm:h-32 border rounded bg-muted items-center justify-center text-xs text-muted-foreground text-center p-2"
                        style={{ display: 'none' }}
                      >
                        ไม่สามารถโหลด QR Code ได้ กรุณาตรวจสอบเลขพร้อมเพย์
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground text-center sm:text-left break-all">
                      URL: promptpay.io/{promptpayId.replace(/-/g, '')}/100.png
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Notification Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              การแจ้งเตือน
            </CardTitle>
            <CardDescription>
              ตั้งค่าการแจ้งเตือนสำหรับผู้ดูแลระบบ
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>แจ้งเตือนออเดอร์ใหม่</Label>
                <p className="text-sm text-muted-foreground">
                  รับการแจ้งเตือนเมื่อมีออเดอร์ใหม่เข้ามา
                </p>
              </div>
              <Switch
                checked={notifyNewOrders}
                onCheckedChange={setNotifyNewOrders}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>แจ้งเตือนสินค้าใกล้หมด</Label>
                <p className="text-sm text-muted-foreground">
                  รับการแจ้งเตือนเมื่อสินค้าเหลือน้อย
                </p>
              </div>
              <Switch
                checked={notifyLowStock}
                onCheckedChange={setNotifyLowStock}
              />
            </div>

            {notifyLowStock && (
              <div className="space-y-2 pl-4 border-l-2 border-muted">
                <Label>จำนวนสินค้าที่ถือว่าใกล้หมด</Label>
                <Input
                  type="number"
                  min="1"
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(e.target.value)}
                  className="w-32"
                />
                <p className="text-sm text-muted-foreground">
                  แจ้งเตือนเมื่อสินค้าเหลือน้อยกว่าหรือเท่ากับจำนวนนี้
                </p>
              </div>
            )}

            <div className="border-t pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">แจ้งเตือนลูกค้าอัตโนมัติ</Label>
                  <p className="text-sm text-muted-foreground">
                    ส่งแจ้งเตือนให้ลูกค้าอัตโนมัติเมื่อสถานะออเดอร์เปลี่ยน (ผ่าน LINE/Messenger)
                  </p>
                </div>
                <Switch
                  checked={autoNotifyCustomers}
                  onCheckedChange={setAutoNotifyCustomers}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security Notice */}
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-600">
              <Shield className="h-5 w-5" />
              การตั้งค่า API Integration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              การตั้งค่า LINE และ Facebook API tokens ได้ย้ายไปที่หน้า{" "}
              <a href="/admin/integrations" className="text-primary hover:underline font-medium">
                Integration
              </a>{" "}
              แล้ว เพื่อความปลอดภัยที่มากขึ้น (tokens จะถูกเข้ารหัสก่อนบันทึก)
            </p>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving} size="lg">
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {isSaving ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminSettings;
