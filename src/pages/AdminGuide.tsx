import { useState } from 'react';
import { 
  ShoppingCart, Package, MessageCircle, Bot, Settings, CreditCard,
  Ticket, MapPin, Radio, Bell, Code, Globe, BookOpen, BarChart3,
  ChevronDown, ChevronRight, Plug, Database, HelpCircle, Link2,
  GraduationCap, MessageSquareText, FileText, Bug, ArrowLeft,
  CheckCircle2, Sparkles, Printer
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface GuideSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  steps: {
    title: string;
    description: string;
    tip?: string;
  }[];
}

const guideSections: GuideSection[] = [
  {
    id: 'getting-started',
    title: 'เริ่มต้นใช้งาน',
    icon: Sparkles,
    badge: 'เริ่มที่นี่',
    steps: [
      {
        title: 'เข้าสู่ระบบ Admin Panel',
        description: 'เข้าไปที่ลิงก์ที่ได้รับ แล้วกรอก Email และ Password ที่ได้รับจากทีมงาน เพื่อเข้าสู่หน้า Dashboard',
        tip: 'หากลืมรหัสผ่าน สามารถติดต่อทีมสนับสนุนเพื่อรีเซ็ตรหัสผ่านได้',
      },
      {
        title: 'ทำความรู้จัก Dashboard',
        description: 'หน้า Dashboard จะแสดงภาพรวมของร้านค้า ยอดขายวันนี้ ออเดอร์ที่รอดำเนินการ และแชทล่าสุด',
      },
      {
        title: 'เลือกแพ็กเกจ',
        description: 'ไปที่เมนู "แพ็กเกจ" เพื่อดูแพ็กเกจปัจจุบัน ฟีเจอร์ที่ใช้ได้ และจำนวนข้อความ AI ที่เหลือ',
      },
    ],
  },
  {
    id: 'products',
    title: 'จัดการสินค้า',
    icon: Package,
    steps: [
      {
        title: 'เพิ่มสินค้าใหม่',
        description: 'ไปที่เมนู "สินค้า" → กดปุ่ม "เพิ่มสินค้า" → กรอกชื่อ, ราคา, รายละเอียด, อัพโหลดรูปภาพ → กด "บันทึก"',
        tip: 'รูปภาพควรเป็นรูปสี่เหลี่ยมจัตุรัส ขนาดไม่เกิน 2MB',
      },
      {
        title: 'แก้ไขสินค้า',
        description: 'คลิกที่สินค้าที่ต้องการแก้ไข → แก้ไขข้อมูล → กด "บันทึก"',
      },
      {
        title: 'จัดการ Variants',
        description: 'ในหน้าแก้ไขสินค้า สามารถเพิ่มตัวเลือกสินค้า เช่น ไซส์, สี, รสชาติ พร้อมราคาและสต็อกแยกแต่ละตัวเลือก',
      },
      {
        title: 'ตั้งราคาโปรโมชั่น',
        description: 'กรอกราคาโปรโมชั่นในช่อง "ราคาลด" ระบบจะแสดงราคาเดิมพร้อมราคาลดให้ลูกค้าเห็นอัตโนมัติ',
      },
    ],
  },
  {
    id: 'orders',
    title: 'จัดการออเดอร์',
    icon: ShoppingCart,
    steps: [
      {
        title: 'ดูรายการออเดอร์',
        description: 'ไปที่เมนู "ออเดอร์" จะเห็นรายการออเดอร์ทั้งหมด สามารถกรองตามสถานะ หรือค้นหาด้วยเลขออเดอร์ / ชื่อลูกค้า',
      },
      {
        title: 'อัปเดตสถานะออเดอร์',
        description: 'คลิกที่ออเดอร์ → กดปุ่ม "แก้ไข" → เปลี่ยนสถานะ (รอชำระ → ยืนยัน → จัดส่ง → ส่งแล้ว) → กด "บันทึก"',
        tip: 'เมื่อเปลี่ยนสถานะ ระบบจะถามว่าต้องการส่งแจ้งเตือนลูกค้าหรือไม่',
      },
      {
        title: 'ใส่เลขพัสดุ',
        description: 'เมื่อจัดส่งแล้ว ให้กรอก "เลข Tracking" ในหน้าแก้ไขออเดอร์ ลูกค้าจะได้รับแจ้งเตือนอัตโนมัติ',
      },
    ],
  },
  {
    id: 'payment-slips',
    title: 'ตรวจสอบสลิปโอนเงิน',
    icon: CreditCard,
    steps: [
      {
        title: 'ดูสลิปที่รอตรวจสอบ',
        description: 'ไปที่เมนู "สลิปโอนเงิน" จะเห็นรายการสลิปทั้งหมด แยกตามสถานะ (รอตรวจ / ยืนยันแล้ว / ปฏิเสธ)',
      },
      {
        title: 'ยืนยันหรือปฏิเสธสลิป',
        description: 'คลิกที่สลิป → ดูรูปสลิป ข้อมูลที่ AI วิเคราะห์ได้ → กด "ยืนยัน" หรือ "ปฏิเสธ"',
        tip: 'AI จะวิเคราะห์สลิปให้อัตโนมัติ (ธนาคาร, จำนวนเงิน, วันที่) แต่ควรตรวจสอบอีกครั้ง',
      },
    ],
  },
  {
    id: 'chats',
    title: 'จัดการแชทลูกค้า',
    icon: MessageCircle,
    steps: [
      {
        title: 'ดูรายการแชท',
        description: 'ไปที่เมนู "แชท" จะเห็นรายการแชทจากทุก Platform (เว็บ, LINE, Facebook) ใช้ Search ค้นหาได้',
      },
      {
        title: 'เข้าควบคุมแชท (Human Takeover)',
        description: 'คลิกที่แชท → กดปุ่ม "เข้าควบคุม" → AI จะหยุดตอบ คุณสามารถพิมพ์ตอบลูกค้าเองได้',
        tip: 'เมื่อต้องการให้ AI กลับมาตอบ กด "คืนให้ AI" ได้ทุกเมื่อ',
      },
      {
        title: 'ใช้ Template ข้อความ',
        description: 'ในหน้าแชท สามารถเลือกใช้ Template ข้อความสำเร็จรูปเพื่อตอบลูกค้าได้รวดเร็ว',
      },
    ],
  },
  {
    id: 'ai-settings',
    title: 'ตั้งค่า AI',
    icon: Bot,
    steps: [
      {
        title: 'ตั้งชื่อ AI',
        description: 'ไปที่เมนู "ตั้งค่า AI" → ตั้งชื่อ AI ที่จะใช้ทักทายลูกค้า เช่น "น้องมิ้นท์"',
      },
      {
        title: 'ปรับบุคลิก AI',
        description: 'เลือกระดับความเป็นทางการ เปิด/ปิดการใช้ Emoji และเลือกความยาวคำตอบ (สั้น / ปานกลาง / ยาว)',
      },
      {
        title: 'ตั้งข้อความทักทาย',
        description: 'กรอกข้อความที่ AI จะใช้ทักทายลูกค้าเมื่อเริ่มแชทครั้งแรก',
      },
      {
        title: 'เพิ่มกฎพิเศษ',
        description: 'กรอก Custom Rules เพื่อกำหนดพฤติกรรมพิเศษ เช่น "ห้ามพูดเรื่องคู่แข่ง" หรือ "แนะนำโปรโมชั่นทุกครั้ง"',
      },
    ],
  },
  {
    id: 'coupons',
    title: 'คูปองส่วนลด',
    icon: Ticket,
    steps: [
      {
        title: 'สร้างคูปอง',
        description: 'ไปที่เมนู "คูปอง" → กด "สร้างคูปอง" → กรอกรหัสคูปอง, ประเภทส่วนลด (% หรือ บาท), จำนวนที่ใช้ได้',
      },
      {
        title: 'กำหนดเงื่อนไข',
        description: 'ตั้งวันหมดอายุ, ยอดสั่งซื้อขั้นต่ำ และจำนวนครั้งที่ใช้ได้สูงสุด',
      },
    ],
  },
  {
    id: 'broadcast',
    title: 'ส่งข้อความ Broadcast',
    icon: Radio,
    steps: [
      {
        title: 'สร้าง Broadcast',
        description: 'ไปที่เมนู "Broadcast" → กด "สร้าง Broadcast" → เลือก Platform (LINE / Facebook) → พิมพ์ข้อความ',
      },
      {
        title: 'เลือกกลุ่มเป้าหมาย',
        description: 'เลือกส่งให้ลูกค้าทุกคน หรือเฉพาะกลุ่ม จากนั้นกด "ส่ง" หรือ "ตั้งเวลาส่ง"',
      },
    ],
  },
  {
    id: 'notifications',
    title: 'การแจ้งเตือน',
    icon: Bell,
    steps: [
      {
        title: 'ดูการแจ้งเตือน',
        description: 'คลิกไอคอนกระดิ่งที่มุมขวาบน หรือไปที่เมนู "แจ้งเตือน" จะเห็นรายการแจ้งเตือนทั้งหมด (ออเดอร์ใหม่, สลิป, สต็อกต่ำ)',
      },
      {
        title: 'จัดการแจ้งเตือน',
        description: 'คลิกที่แจ้งเตือนเพื่อไปยังหน้าที่เกี่ยวข้อง หรือกด "อ่านทั้งหมด" เพื่อเคลียร์',
      },
    ],
  },
  {
    id: 'settings',
    title: 'ตั้งค่าร้านค้า',
    icon: Settings,
    steps: [
      {
        title: 'ข้อมูลร้านค้า',
        description: 'ไปที่เมนู "ตั้งค่า" → กรอกชื่อร้าน, เบอร์โทร, ที่อยู่, เวลาทำการ',
      },
      {
        title: 'ตั้งค่าการชำระเงิน',
        description: 'กรอกข้อมูลบัญชีธนาคาร / PromptPay สำหรับรับชำระเงิน',
      },
      {
        title: 'นโยบายร้าน',
        description: 'กรอกนโยบายการคืนสินค้า, การจัดส่ง, เงื่อนไขต่างๆ AI จะนำไปใช้ตอบลูกค้า',
      },
    ],
  },
  {
    id: 'integrations',
    title: 'เชื่อมต่อ Platform',
    icon: Plug,
    steps: [
      {
        title: 'เชื่อมต่อ LINE',
        description: 'ไปที่เมนู "Integration" → กรอก LINE Channel Access Token และ Channel Secret → กด "บันทึก" → ตั้ง Webhook URL ใน LINE Developers',
        tip: 'ติดต่อทีมสนับสนุนหากไม่แน่ใจวิธีสร้าง LINE Channel',
      },
      {
        title: 'เชื่อมต่อ Facebook',
        description: 'กรอก Facebook Page Access Token → กด "บันทึก" → ตั้ง Webhook URL ใน Facebook Developers',
      },
    ],
  },
];

export default function AdminGuide() {
  const [openSections, setOpenSections] = useState<string[]>(['getting-started']);

  const toggleSection = (id: string) => {
    setOpenSections(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur-sm print:static print:bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/admin/dashboard">
              <Button variant="ghost" size="icon" className="print:hidden">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="font-bold text-lg">คู่มือใช้งาน Admin Panel</h1>
              <p className="text-xs text-muted-foreground">SellMate AI — ระบบจัดการร้านค้าอัจฉริยะ</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2 print:hidden">
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">พิมพ์ / PDF</span>
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Intro */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Bot className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold mb-2">ยินดีต้อนรับสู่ SellMate AI 🎉</h2>
                <p className="text-muted-foreground leading-relaxed">
                  SellMate AI คือระบบ AI ผู้ช่วยขายอัจฉริยะที่ช่วยตอบแชทลูกค้า รับออเดอร์ และจัดการร้านค้าออนไลน์ของคุณแบบอัตโนมัติ
                  ผ่าน LINE, Facebook และเว็บไซต์ คู่มือนี้จะอธิบายวิธีใช้งานฟีเจอร์ต่างๆ ทีละขั้นตอน
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Navigation */}
        <div className="print:hidden">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">สารบัญ</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {guideSections.map(section => (
              <button
                key={section.id}
                onClick={() => {
                  setOpenSections(prev => prev.includes(section.id) ? prev : [...prev, section.id]);
                  document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card hover:bg-accent text-left text-sm transition-colors"
              >
                <section.icon className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="truncate">{section.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Guide Sections */}
        <div className="space-y-4">
          {guideSections.map((section, sectionIndex) => {
            const isOpen = openSections.includes(section.id);
            return (
              <Card key={section.id} id={section.id} className="overflow-hidden print:break-inside-avoid">
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center gap-3 p-4 sm:p-6 hover:bg-muted/50 transition-colors text-left print:hover:bg-transparent"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <section.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base sm:text-lg">
                        {sectionIndex + 1}. {section.title}
                      </h3>
                      {section.badge && (
                        <Badge variant="secondary" className="text-xs">{section.badge}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {section.steps.length} ขั้นตอน
                    </p>
                  </div>
                  <div className="print:hidden">
                    {isOpen ? (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                </button>

                <div className={cn(
                  "transition-all duration-200 print:block",
                  isOpen ? "block" : "hidden"
                )}>
                  <div className="px-4 sm:px-6 pb-6 space-y-4">
                    {section.steps.map((step, stepIndex) => (
                      <div key={stepIndex} className="flex gap-3 print:break-inside-avoid">
                        <div className="flex flex-col items-center">
                          <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {stepIndex + 1}
                          </div>
                          {stepIndex < section.steps.length - 1 && (
                            <div className="w-px h-full bg-border mt-1" />
                          )}
                        </div>
                        <div className="flex-1 pb-4">
                          <h4 className="font-semibold text-sm sm:text-base">{step.title}</h4>
                          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                            {step.description}
                          </p>
                          {step.tip && (
                            <div className="mt-2 flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                              <CheckCircle2 className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                              <p className="text-xs text-amber-800 dark:text-amber-300">
                                <strong>💡 เคล็ดลับ:</strong> {step.tip}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Footer */}
        <Card className="border-muted">
          <CardContent className="p-6 text-center">
            <h3 className="font-bold text-lg mb-2">ต้องการความช่วยเหลือเพิ่มเติม?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              หากมีคำถามหรือต้องการความช่วยเหลือ สามารถติดต่อทีมสนับสนุนได้ตลอดเวลา
            </p>
            <div className="flex flex-wrap gap-2 justify-center print:hidden">
              <Link to="/admin/dashboard">
                <Button variant="default" size="sm">กลับไป Dashboard</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Print styles */}
      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print\\:hidden { display: none !important; }
          .print\\:static { position: static !important; }
          .print\\:bg-white { background: white !important; }
          .print\\:break-inside-avoid { break-inside: avoid; }
          .print\\:block { display: block !important; }
          .print\\:hover\\:bg-transparent:hover { background: transparent !important; }
        }
      `}</style>
    </div>
  );
}
