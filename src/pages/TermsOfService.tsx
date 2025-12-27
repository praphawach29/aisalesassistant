import { Link } from "react-router-dom";
import { ArrowLeft, FileText, CheckCircle, AlertTriangle, ShoppingBag, CreditCard, Ban, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const TermsOfService = () => {
  const lastUpdated = "27 ธันวาคม 2567";
  const companyName = "AI Sales Assistant";
  const contactEmail = "support@example.com";

  const sections = [
    {
      icon: CheckCircle,
      title: "1. การยอมรับข้อกำหนด",
      content: [
        "การเข้าถึงและใช้บริการของเรา ถือว่าคุณยอมรับและตกลงที่จะปฏิบัติตามข้อกำหนดเหล่านี้",
        "หากคุณไม่เห็นด้วยกับข้อกำหนดใด ๆ กรุณางดใช้บริการของเรา",
        "เราขอสงวนสิทธิ์ในการแก้ไขข้อกำหนดเหล่านี้ได้ตลอดเวลา โดยจะแจ้งให้ทราบผ่านทางเว็บไซต์",
        "การใช้งานต่อหลังจากมีการเปลี่ยนแปลง ถือว่าคุณยอมรับข้อกำหนดใหม่"
      ]
    },
    {
      icon: ShoppingBag,
      title: "2. การใช้บริการ",
      content: [
        "**AI Assistant:** บริการ AI ให้คำแนะนำสินค้าและตอบคำถามโดยอัตโนมัติ ข้อมูลอาจไม่ถูกต้อง 100%",
        "**การสั่งซื้อ:** คำสั่งซื้อจะสมบูรณ์เมื่อได้รับการยืนยันจากระบบ",
        "**ความพร้อมของบริการ:** เรามุ่งมั่นให้บริการ 24/7 แต่อาจมีการหยุดให้บริการเพื่อบำรุงรักษา",
        "**การเปลี่ยนแปลง:** เราสามารถปรับปรุง เปลี่ยนแปลง หรือยุติบริการใด ๆ ได้โดยไม่ต้องแจ้งล่วงหน้า"
      ]
    },
    {
      icon: CreditCard,
      title: "3. การชำระเงินและราคา",
      content: [
        "ราคาสินค้าทั้งหมดแสดงเป็นสกุลเงินบาท และรวมภาษีมูลค่าเพิ่มแล้ว (ยกเว้นระบุไว้เป็นอื่น)",
        "เราขอสงวนสิทธิ์ในการเปลี่ยนแปลงราคาได้ตลอดเวลาโดยไม่ต้องแจ้งล่วงหน้า",
        "การชำระเงินต้องทำให้เสร็จสิ้นก่อนการจัดส่งสินค้า",
        "ในกรณีที่ราคาแสดงผิดพลาด เราขอสงวนสิทธิ์ในการยกเลิกคำสั่งซื้อและคืนเงินเต็มจำนวน"
      ]
    },
    {
      icon: AlertTriangle,
      title: "4. การจัดส่งและการคืนสินค้า",
      content: [
        "**ระยะเวลาจัดส่ง:** โดยทั่วไป 3-7 วันทำการ ขึ้นอยู่กับพื้นที่จัดส่ง",
        "**ความเสียหายระหว่างขนส่ง:** กรุณาแจ้งภายใน 24 ชั่วโมงหลังได้รับสินค้า พร้อมหลักฐานภาพถ่าย",
        "**การคืนสินค้า:** สามารถคืนสินค้าได้ภายใน 7 วันหลังได้รับ หากสินค้าอยู่ในสภาพเดิม",
        "**สินค้าที่ไม่รับคืน:** สินค้าที่เปิดใช้แล้ว สินค้าลดราคา หรือสินค้าที่ระบุว่าไม่รับคืน"
      ]
    },
    {
      icon: Ban,
      title: "5. ข้อห้ามและข้อจำกัด",
      content: [
        "ห้ามใช้บริการเพื่อวัตถุประสงค์ที่ผิดกฎหมายหรือไม่เหมาะสม",
        "ห้ามพยายามเข้าถึงระบบโดยไม่ได้รับอนุญาต หรือรบกวนการทำงานของระบบ",
        "ห้ามส่งข้อความสแปม หรือเนื้อหาที่ไม่เหมาะสมผ่านระบบแชท",
        "ห้ามแอบอ้างเป็นบุคคลอื่นหรือให้ข้อมูลเท็จ",
        "การละเมิดข้อห้ามเหล่านี้อาจส่งผลให้ถูกระงับการใช้บริการทันที"
      ]
    },
    {
      icon: Scale,
      title: "6. ข้อจำกัดความรับผิดชอบ",
      content: [
        "บริการนี้ให้บริการ \"ตามสภาพ\" โดยไม่มีการรับประกันใด ๆ ทั้งโดยชัดแจ้งหรือโดยนัย",
        "เราไม่รับประกันว่าบริการจะปราศจากข้อผิดพลาดหรือไม่หยุดชะงัก",
        "เราไม่รับผิดชอบต่อความเสียหายทางอ้อม ความเสียหายพิเศษ หรือความเสียหายที่เป็นผลสืบเนื่อง",
        "ความรับผิดชอบสูงสุดของเราจำกัดอยู่ที่จำนวนเงินที่คุณชำระสำหรับการทำธุรกรรมที่เกี่ยวข้อง"
      ]
    }
  ];

  const renderContent = (text: string) => {
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
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">ข้อกำหนดการใช้บริการ</h1>
              <p className="text-sm text-muted-foreground">Terms of Service</p>
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
              ยินดีต้อนรับสู่ <strong>{companyName}</strong> กรุณาอ่านข้อกำหนดการใช้บริการเหล่านี้อย่างละเอียด 
              ก่อนใช้บริการของเรา ข้อกำหนดเหล่านี้มีผลผูกพันทางกฎหมายระหว่างคุณและเรา
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
              <h3 className="font-semibold mb-3">7. ทรัพย์สินทางปัญญา</h3>
              <p className="text-foreground/80 leading-relaxed">
                เนื้อหา โลโก้ กราฟิก และซอฟต์แวร์ทั้งหมดบนเว็บไซต์นี้เป็นทรัพย์สินของ {companyName} 
                และได้รับการคุ้มครองตามกฎหมายทรัพย์สินทางปัญญา ห้ามทำซ้ำ ดัดแปลง 
                หรือเผยแพร่โดยไม่ได้รับอนุญาต
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-3">8. กฎหมายที่ใช้บังคับ</h3>
              <p className="text-foreground/80 leading-relaxed">
                ข้อกำหนดเหล่านี้อยู่ภายใต้กฎหมายของประเทศไทย 
                ข้อพิพาทใด ๆ ที่เกิดขึ้นจะอยู่ในเขตอำนาจของศาลไทย
                เราสนับสนุนการไกล่เกลี่ยก่อนดำเนินคดีทางกฎหมาย
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Force Majeure */}
        <Card className="mt-6">
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-3">9. เหตุสุดวิสัย</h3>
            <p className="text-foreground/80 leading-relaxed">
              เราไม่รับผิดชอบต่อความล่าช้าหรือความล้มเหลวในการปฏิบัติตามข้อผูกพัน 
              อันเนื่องมาจากเหตุสุดวิสัย เช่น ภัยธรรมชาติ การระบาดของโรค สงคราม 
              การนัดหยุดงาน หรือเหตุการณ์อื่น ๆ ที่อยู่นอกเหนือการควบคุมของเรา
            </p>
          </CardContent>
        </Card>

        {/* Contact Section */}
        <Card className="mt-8 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
          <CardContent className="pt-6">
            <h3 className="text-xl font-semibold mb-4">📬 ติดต่อเรา</h3>
            <p className="text-foreground/80 leading-relaxed mb-4">
              หากคุณมีคำถามเกี่ยวกับข้อกำหนดการใช้บริการนี้ กรุณาติดต่อเราที่:
            </p>
            <div className="flex flex-wrap gap-4">
              <a 
                href={`mailto:${contactEmail}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <CreditCard className="h-4 w-4" />
                {contactEmail}
              </a>
              <Link 
                to="/privacy-policy"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
              >
                นโยบายความเป็นส่วนตัว →
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Footer Note */}
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>
            © {new Date().getFullYear()} {companyName}. สงวนลิขสิทธิ์.
          </p>
        </div>
      </main>
    </div>
  );
};

export default TermsOfService;
