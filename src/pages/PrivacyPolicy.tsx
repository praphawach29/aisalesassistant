import { Link } from "react-router-dom";
import { ArrowLeft, Shield, Lock, Eye, UserCheck, Bell, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const PrivacyPolicy = () => {
  const lastUpdated = "27 ธันวาคม 2567";
  const companyName = "AI Sales Assistant";
  const contactEmail = "support@example.com";

  const sections = [
    {
      icon: Eye,
      title: "1. ข้อมูลที่เราเก็บรวบรวม",
      content: [
        "**ข้อมูลที่คุณให้โดยตรง:** ชื่อ, อีเมล, หมายเลขโทรศัพท์, ที่อยู่จัดส่ง เมื่อคุณสมัครใช้บริการหรือทำการสั่งซื้อ",
        "**ข้อมูลการใช้งาน:** ประวัติการสนทนา, การโต้ตอบกับ AI Assistant, หน้าที่เข้าชม, เวลาที่ใช้งาน",
        "**ข้อมูลทางเทคนิค:** IP Address, ประเภทเบราว์เซอร์, ระบบปฏิบัติการ, อุปกรณ์ที่ใช้งาน",
        "**ข้อมูลจากแพลตฟอร์มภายนอก:** เมื่อคุณเชื่อมต่อผ่าน Facebook Messenger หรือ LINE เราอาจได้รับข้อมูลโปรไฟล์พื้นฐานตามที่แพลตฟอร์มอนุญาต"
      ]
    },
    {
      icon: Lock,
      title: "2. วัตถุประสงค์ในการใช้ข้อมูล",
      content: [
        "ให้บริการ AI Assistant ตอบคำถามและแนะนำสินค้า",
        "ประมวลผลคำสั่งซื้อและจัดส่งสินค้า",
        "ปรับปรุงประสบการณ์การใช้งานและพัฒนาบริการ",
        "ส่งการแจ้งเตือนเกี่ยวกับคำสั่งซื้อและโปรโมชั่น (ตามความยินยอม)",
        "ป้องกันการฉ้อโกงและรักษาความปลอดภัย"
      ]
    },
    {
      icon: UserCheck,
      title: "3. การแบ่งปันข้อมูล",
      content: [
        "**ผู้ให้บริการภายนอก:** บริษัทขนส่ง, ระบบชำระเงิน เพื่อดำเนินการตามคำสั่งซื้อ",
        "**แพลตฟอร์มโซเชียลมีเดีย:** Facebook, LINE ตามที่จำเป็นสำหรับการสื่อสาร",
        "**หน่วยงานรัฐ:** เมื่อกฎหมายกำหนดหรือเพื่อปกป้องสิทธิ์ของเรา",
        "เราไม่ขายข้อมูลส่วนบุคคลของคุณให้กับบุคคลที่สาม"
      ]
    },
    {
      icon: Shield,
      title: "4. การรักษาความปลอดภัยข้อมูล",
      content: [
        "เข้ารหัสข้อมูลที่ส่งผ่านระบบด้วย SSL/TLS",
        "จัดเก็บข้อมูลในระบบคลาวด์ที่มีมาตรฐานความปลอดภัยสูง",
        "จำกัดการเข้าถึงข้อมูลเฉพาะพนักงานที่จำเป็น",
        "ตรวจสอบและอัปเดตมาตรการรักษาความปลอดภัยอย่างสม่ำเสมอ"
      ]
    },
    {
      icon: Bell,
      title: "5. สิทธิ์ของคุณ",
      content: [
        "**สิทธิ์ในการเข้าถึง:** ขอสำเนาข้อมูลส่วนบุคคลของคุณ",
        "**สิทธิ์ในการแก้ไข:** ขอให้แก้ไขข้อมูลที่ไม่ถูกต้อง",
        "**สิทธิ์ในการลบ:** ขอให้ลบข้อมูลของคุณ (ภายใต้เงื่อนไขที่กฎหมายกำหนด)",
        "**สิทธิ์ในการคัดค้าน:** ปฏิเสธการใช้ข้อมูลเพื่อการตลาด",
        "**สิทธิ์ในการโอนย้าย:** ขอรับข้อมูลในรูปแบบที่อ่านได้ด้วยเครื่อง"
      ]
    },
    {
      icon: Mail,
      title: "6. คุกกี้และเทคโนโลยีติดตาม",
      content: [
        "**คุกกี้ที่จำเป็น:** เพื่อให้ระบบทำงานได้อย่างถูกต้อง",
        "**คุกกี้วิเคราะห์:** เพื่อเข้าใจพฤติกรรมการใช้งานและปรับปรุงบริการ",
        "**คุกกี้การตลาด:** เพื่อแสดงโฆษณาที่เกี่ยวข้อง (ตามความยินยอม)",
        "คุณสามารถจัดการการตั้งค่าคุกกี้ผ่านการตั้งค่าเบราว์เซอร์"
      ]
    }
  ];

  const renderContent = (text: string) => {
    // Convert **bold** to JSX
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">นโยบายความเป็นส่วนตัว</h1>
              <p className="text-sm text-muted-foreground">Privacy Policy</p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Intro Card */}
        <Card className="mb-8 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
          <CardContent className="pt-6">
            <p className="text-lg leading-relaxed text-foreground/90">
              <strong>{companyName}</strong> ให้ความสำคัญกับความเป็นส่วนตัวของคุณ 
              นโยบายนี้อธิบายวิธีที่เราเก็บรวบรวม ใช้ และปกป้องข้อมูลส่วนบุคคลของคุณ
              เมื่อคุณใช้บริการของเรา
            </p>
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted">
                📅 อัปเดตล่าสุด: {lastUpdated}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Sections */}
        <div className="space-y-6">
          {sections.map((section, index) => (
            <Card key={index} className="overflow-hidden hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-primary/10 shrink-0">
                    <section.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold mb-4">{section.title}</h2>
                    <ul className="space-y-3">
                      {section.content.map((item, itemIndex) => (
                        <li key={itemIndex} className="flex items-start gap-3 text-foreground/80">
                          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                          <span className="leading-relaxed">{renderContent(item)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Separator className="my-8" />

        {/* Additional Info */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-3">7. การเปลี่ยนแปลงนโยบาย</h3>
              <p className="text-foreground/80 leading-relaxed">
                เราอาจปรับปรุงนโยบายนี้เป็นครั้งคราว การเปลี่ยนแปลงที่สำคัญจะแจ้งให้คุณทราบ
                ผ่านอีเมลหรือประกาศบนเว็บไซต์ การใช้งานต่อหลังการเปลี่ยนแปลง
                ถือว่าคุณยอมรับนโยบายใหม่
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-3">8. การเก็บรักษาข้อมูล</h3>
              <p className="text-foreground/80 leading-relaxed">
                เราเก็บรักษาข้อมูลของคุณตราบเท่าที่จำเป็นสำหรับวัตถุประสงค์ที่ระบุ
                หรือตามที่กฎหมายกำหนด หลังจากนั้นข้อมูลจะถูกลบหรือทำให้ไม่สามารถระบุตัวตนได้
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Contact Section */}
        <Card className="mt-8 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
          <CardContent className="pt-6">
            <h3 className="text-xl font-semibold mb-4">📬 ติดต่อเรา</h3>
            <p className="text-foreground/80 leading-relaxed mb-4">
              หากคุณมีคำถามเกี่ยวกับนโยบายความเป็นส่วนตัวนี้ หรือต้องการใช้สิทธิ์ของคุณ
              กรุณาติดต่อเราที่:
            </p>
            <div className="flex flex-wrap gap-4">
              <a 
                href={`mailto:${contactEmail}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Mail className="h-4 w-4" />
                {contactEmail}
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Footer Note */}
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>
            นโยบายนี้จัดทำขึ้นตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)
          </p>
          <p className="mt-2">
            © {new Date().getFullYear()} {companyName}. สงวนลิขสิทธิ์.
          </p>
        </div>
      </main>
    </div>
  );
};

export default PrivacyPolicy;
