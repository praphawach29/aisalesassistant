import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useInView } from '@/hooks/useInView';
import { 
  Store, Coffee, Stethoscope, Sparkles, Scissors, Dumbbell, 
  GraduationCap, Car, PawPrint, Building2, Bot, User,
  ShoppingCart, CreditCard, MessageCircle, CalendarCheck, BellRing
} from 'lucide-react';

interface DemoBusinessType {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  aiName: string;
  greeting: string;
  conversation: { role: 'user' | 'bot'; text: string }[];
  products: string[];
}

const demoBusinessTypes: DemoBusinessType[] = [
  {
    id: 'online-shop',
    label: 'ร้านค้าออนไลน์',
    icon: Store,
    aiName: 'น้องช้อป',
    greeting: '🔔 สวัสดีค่ะคุณสมชาย! เห็นว่ามีออเดอร์ ORD-20260319-0042 ยังไม่ได้ชำระเงินค่ะ 🛒',
    conversation: [
      { role: 'bot', text: '📦 ออเดอร์ของคุณค่ะ:\n• เสื้อยืด Oversize สีขาว L x2 = ฿780\n\n💳 โอนเข้าบัญชี:\nกสิกร 088-xxx-xxxx\nชื่อ ร้าน SellMate\n\nส่งสลิปมาได้เลยนะคะ! 😊' },
      { role: 'user', text: 'โอ ลืมไปเลย เดี๋ยวโอนนะ' },
      { role: 'bot', text: 'ไม่เป็นไรค่ะ ✨ รอสลิปอยู่นะคะ!\n\nพอส่งสลิปมา ระบบจะตรวจสอบอัตโนมัติ และยืนยันออเดอร์ให้ทันทีค่ะ 🚀' },
    ],
    products: ['เสื้อยืด Cotton', 'กางเกงยีนส์', 'รองเท้าผ้าใบ'],
  },
  {
    id: 'cafe',
    label: 'คาเฟ่',
    icon: Coffee,
    aiName: 'น้องกาแฟ',
    greeting: 'สวัสดีค่ะ! ☕ ยินดีต้อนรับสู่ร้านค่ะ วันนี้อยากดื่มอะไรดีคะ?',
    conversation: [
      { role: 'user', text: 'มีเมนูอะไรแนะนำบ้าง' },
      { role: 'bot', text: '☕ เมนูแนะนำวันนี้ค่ะ!\n\n1. Dirty Latte ฿85 ⭐ ขายดี!\n2. Matcha Oat Milk ฿95\n3. เค้กส้มนุ่ม ฿120\n\nทุกเมนูใช้เมล็ดกาแฟ Specialty Grade ค่ะ' },
      { role: 'user', text: 'เอา Dirty Latte 1 แก้ว กับเค้กส้ม' },
      { role: 'bot', text: '✅ รับออเดอร์แล้วค่ะ!\n☕ Dirty Latte x1 = ฿85\n🍰 เค้กส้มนุ่ม x1 = ฿120\n💰 รวม ฿205\n\nรับที่ร้านหรือส่ง Delivery คะ?' },
    ],
    products: ['Dirty Latte', 'Matcha Oat Milk', 'เค้กส้ม'],
  },
  {
    id: 'clinic',
    label: 'คลินิก',
    icon: Stethoscope,
    aiName: 'น้องแคร์',
    greeting: 'สวัสดีค่ะ! 🏥 ยินดีให้คำปรึกษาค่ะ มีอะไรให้ช่วยมั้ยคะ?',
    conversation: [
      { role: 'user', text: 'อยากทำเลเซอร์หน้าใส ราคาเท่าไหร่' },
      { role: 'bot', text: '✨ เลเซอร์หน้าใสค่ะ!\n\n• Q-Switch Laser ฿1,500/ครั้ง\n• Picosecond Laser ฿3,500/ครั้ง ⭐แนะนำ\n\nPico ได้ผลเร็วกว่า แนะนำทำ 3-5 ครั้ง ห่างกัน 2-4 สัปดาห์ค่ะ' },
      { role: 'user', text: 'จองคิว Pico วันเสาร์ได้ไหม' },
      { role: 'bot', text: '📅 เสาร์นี้ยังว่างค่ะ! ช่วงเวลาที่เลือกได้:\n• 10:00 น.\n• 13:00 น.\n• 15:00 น.\n\nส่งชื่อ-เบอร์โทร เพื่อจองคิวเลยนะคะ 💕' },
    ],
    products: ['Q-Switch Laser', 'Picosecond Laser', 'Botox'],
  },
  {
    id: 'spa',
    label: 'สปา & นวด',
    icon: Sparkles,
    aiName: 'น้องสปา',
    greeting: 'สวัสดีค่ะ! 🧖‍♀️ พร้อมให้บริการค่ะ ต้องการนวดหรือทรีตเมนต์อะไรคะ?',
    conversation: [
      { role: 'user', text: 'มีแพ็กเกจนวดอะไรบ้าง' },
      { role: 'bot', text: '🧖‍♀️ แพ็กเกจยอดนิยมค่ะ!\n\n1. นวดไทย 60 นาที ฿500\n2. นวดน้ำมันอโรมา 90 นาที ฿800 ⭐\n3. แพ็กเกจ Royal Spa 2 ชม. ฿1,500\n   (นวด+สครับ+มาส์กหน้า)\n\nสนใจแพ็กเกจไหนคะ?' },
      { role: 'user', text: 'เอา Royal Spa วันอาทิตย์บ่ายโมง' },
      { role: 'bot', text: '✅ จองแล้วค่ะ!\n👑 Royal Spa Package\n📅 อาทิตย์ 13:00 น.\n💰 ฿1,500\n\nส่งชื่อ-เบอร์โทรมาได้เลยค่ะ ✨' },
    ],
    products: ['นวดไทย', 'อโรมา 90 นาที', 'Royal Spa Package'],
  },
  {
    id: 'salon',
    label: 'ร้านทำผม',
    icon: Scissors,
    aiName: 'น้องผม',
    greeting: 'สวัสดีค่ะ! ✂️ ต้องการทำผมแบบไหนดีคะวันนี้?',
    conversation: [
      { role: 'user', text: 'อยากจองคิวทำสี Balayage ค่ะ' },
      { role: 'bot', text: '🎨 Balayage เริ่มต้น ฿2,500 ค่ะ\nใช้เวลาประมาณ 3-4 ชม.\n\n📅 คิวว่างสัปดาห์นี้:\n• พฤ 14:00 น.\n• ศ 10:00, 14:00 น.\n• ส 10:00 น.\n\nสนใจวันไหนคะ?' },
      { role: 'user', text: 'เอาวันเสาร์ 10 โมงค่ะ' },
      { role: 'bot', text: '✅ จองคิวสำเร็จแล้วค่ะ!\n📋 BK-0012\n💇‍♀️ Balayage\n📅 เสาร์ 10:00 น.\n💰 ฿2,500\n\nส่งชื่อ-เบอร์โทรมายืนยันได้เลยนะคะ ✨' },
    ],
    products: ['ตัดผม', 'ทำสี Balayage', 'ทรีตเมนต์เคราติน'],
  },
  {
    id: 'fitness',
    label: 'ฟิตเนส',
    icon: Dumbbell,
    aiName: 'น้องฟิต',
    greeting: 'สวัสดีครับ! 💪 พร้อมช่วยแนะนำคอร์สออกกำลังกายครับ!',
    conversation: [
      { role: 'user', text: 'อยากจอง Personal Training ครับ' },
      { role: 'bot', text: '🏋️ Personal Training 4 ครั้ง ฿4,000\n(เฉลี่ย ฿1,000/ครั้ง)\n\n📅 ตารางเทรนเนอร์ว่าง:\n• จ-ศ: 7:00-21:00\n• ส-อา: 9:00-18:00\n\nสนใจวันไหนครับ?' },
      { role: 'user', text: 'จันทร์หน้า 18:00 ครับ' },
      { role: 'bot', text: '✅ จองสำเร็จครับ!\n📋 BK-0045\n🏋️ Personal Training\n📅 จันทร์ 18:00 น.\n👤 เทรนเนอร์ โค้ชบอส\n\nส่งชื่อ-เบอร์โทร เพื่อยืนยันได้เลยครับ 🔥' },
    ],
    products: ['Weight Training', 'Group Yoga', 'Personal Training'],
  },
  {
    id: 'tutor',
    label: 'กวดวิชา',
    icon: GraduationCap,
    aiName: 'น้องติว',
    greeting: 'สวัสดีค่ะ! 📚 สนใจคอร์สเรียนอะไรดีคะ?',
    conversation: [
      { role: 'user', text: 'มีคอร์สคณิต ม.6 ไหมครับ' },
      { role: 'bot', text: '📐 คอร์สคณิต ม.6 มีค่ะ!\n\n1. คณิตพื้นฐาน 10 ชม. ฿3,500\n2. คณิต PAT1 เข้มข้น 20 ชม. ฿6,000 ⭐\n3. ติวเดี่ยว 1:1 ชม.ละ ฿500\n\nทุกคอร์สมีเอกสาร+ข้อสอบเก่าให้ค่ะ' },
      { role: 'user', text: 'จอง PAT1 เริ่มเสาร์หน้าได้ไหม' },
      { role: 'bot', text: '✅ จองคอร์สสำเร็จค่ะ!\n📋 BK-0078\n📐 คณิต PAT1 เข้มข้น\n📅 เริ่ม เสาร์หน้า 09:00-12:00\n💰 ฿6,000 (แบ่งจ่ายได้ 2 งวด)\n\nส่งชื่อ-เบอร์โทรมาได้เลยค่ะ 🎓' },
    ],
    products: ['คณิตพื้นฐาน', 'PAT1 เข้มข้น', 'ติวเดี่ยว 1:1'],
  },
  {
    id: 'pet-clinic',
    label: 'คลินิกสัตว์',
    icon: PawPrint,
    aiName: 'น้องหมอเหมียว',
    greeting: 'สวัสดีค่ะ! 🐾 มีอะไรให้ช่วยดูแลน้องหมาน้องแมวคะ?',
    conversation: [
      { role: 'user', text: 'อยากพาน้องแมวมาฉีดวัคซีนค่ะ' },
      { role: 'bot', text: '💉 วัคซีนแมวค่ะ!\n\n• วัคซีนรวม 3 โรค ฿650\n• วัคซีนพิษสุนัขบ้า ฿350\n• แพ็กเกจรวม ฿900 ⭐ ประหยัด ฿100\n\n📅 คิวว่างสัปดาห์นี้:\n• พุธ 10:00, 14:00\n• เสาร์ 10:00-16:00' },
      { role: 'user', text: 'เอาแพ็กเกจรวม วันเสาร์บ่ายโมง' },
      { role: 'bot', text: '✅ จองคิวสำเร็จค่ะ!\n📋 BK-0091\n🐱 วัคซีนแพ็กเกจรวม\n📅 เสาร์ 13:00 น.\n💰 ฿900\n\nอย่าลืมนำสมุดวัคซีนมาด้วยนะคะ 🐾' },
    ],
    products: ['วัคซีนรวม', 'ตรวจสุขภาพ', 'อาบน้ำตัดขน'],
  },
  {
    id: 'car-service',
    label: 'อู่รถยนต์',
    icon: Car,
    aiName: 'น้องช่าง',
    greeting: 'สวัสดีครับ! 🚗 มีอะไรให้ช่วยดูแลรถครับ?',
    conversation: [
      { role: 'user', text: 'อยากจองคิวเปลี่ยนถ่ายน้ำมันเครื่องครับ' },
      { role: 'bot', text: '🔧 บริการเปลี่ยนถ่ายน้ำมันเครื่องครับ!\n\n• น้ำมันสังเคราะห์ ฿1,500\n• น้ำมันกึ่งสังเคราะห์ ฿900\n• เช็คระยะ+เปลี่ยนถ่าย ฿2,200 ⭐\n\n📅 คิวว่าง:\n• พรุ่งนี้ 09:00, 13:00\n• มะรืน 09:00-16:00' },
      { role: 'user', text: 'เอาเช็คระยะพร้อมเปลี่ยน พรุ่งนี้เช้าครับ' },
      { role: 'bot', text: '✅ จองคิวสำเร็จครับ!\n📋 BK-0103\n🚗 เช็คระยะ+เปลี่ยนถ่ายน้ำมัน\n📅 พรุ่งนี้ 09:00 น.\n💰 ฿2,200\n⏰ ใช้เวลาประมาณ 1.5-2 ชม.\n\nนำรถมาจอดหน้าอู่ได้เลยครับ 🔧' },
    ],
    products: ['เปลี่ยนถ่ายน้ำมัน', 'เช็คระยะ', 'ซ่อมช่วงล่าง'],
  },
];

export default function DemoSection() {
  const [activeDemo, setActiveDemo] = useState('online-shop');
  const sectionRef = useInView();
  
  const currentDemo = demoBusinessTypes.find(d => d.id === activeDemo)!;

  return (
    <section id="demo" className="py-16 sm:py-24 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/5 to-background" />
      <div className="absolute top-1/3 right-0 w-72 h-72 bg-accent/10 rounded-full blur-[120px]" />
      
      <div ref={sectionRef.ref} className="container mx-auto px-4 relative z-10">
        <div className={`text-center mb-10 sm:mb-14 ${sectionRef.isInView ? 'animate-fade-up' : 'opacity-0'}`}>
          <span className="inline-block px-3 sm:px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs sm:text-sm font-medium mb-3 sm:mb-4">
            🎮 ลองเล่นดูเลย
          </span>
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4 sm:mb-6">
            ดูตัวอย่าง AI ในแต่ละธุรกิจ
          </h2>
          <p className="text-muted-foreground text-sm sm:text-lg max-w-2xl mx-auto px-2">
            เลือกประเภทธุรกิจเพื่อดูว่า AI จะตอบลูกค้าอย่างไร — ทุกแบบใช้ระบบเดียวกัน
          </p>
        </div>

        {/* Business Type Selector */}
        <div className={`flex flex-wrap justify-center gap-2 sm:gap-3 mb-8 sm:mb-12 ${sectionRef.isInView ? 'animate-fade-up animate-stagger-1' : 'opacity-0'}`}>
          {demoBusinessTypes.map((biz) => {
            const Icon = biz.icon;
            const isActive = biz.id === activeDemo;
            return (
              <button
                key={biz.id}
                onClick={() => setActiveDemo(biz.id)}
                className={`inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-medium transition-all duration-300 ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-105'
                    : 'glass text-muted-foreground hover:text-foreground hover:bg-card'
                }`}
              >
                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                {biz.label}
              </button>
            );
          })}
        </div>

        {/* Demo Chat Preview */}
        <div className={`max-w-lg mx-auto ${sectionRef.isInView ? 'animate-scale-up animate-stagger-2' : 'opacity-0'}`}>
          <Card className="glass gradient-border overflow-hidden">
            {/* Chat Header */}
            <div className="bg-gradient-to-r from-primary to-primary/80 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                <Bot className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <p className="text-primary-foreground font-semibold text-sm">{currentDemo.aiName}</p>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-primary-foreground/80 text-xs">ออนไลน์อยู่ค่ะ</span>
                </div>
              </div>
              <Badge className="ml-auto bg-primary-foreground/20 text-primary-foreground border-none text-[10px]">
                DEMO
              </Badge>
            </div>

            {/* Chat Messages */}
            <CardContent className="p-4 space-y-3 bg-muted/30 min-h-[320px]">
              {/* Greeting */}
              <div className="flex gap-2 items-end">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="bg-card rounded-2xl rounded-bl-md px-3.5 py-2.5 max-w-[85%] shadow-sm border border-border/50">
                  <p className="text-foreground text-sm whitespace-pre-line">{currentDemo.greeting}</p>
                </div>
              </div>

              {/* Conversation */}
              {currentDemo.conversation.map((msg, i) => (
                <div
                  key={`${activeDemo}-${i}`}
                  className={`flex gap-2 items-end ${msg.role === 'user' ? 'justify-end' : ''}`}
                  style={{ animation: `fadeIn 0.3s ease-out ${(i + 1) * 0.15}s both` }}
                >
                  {msg.role === 'bot' && (
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Bot className="w-3.5 h-3.5 text-primary" />
                    </div>
                  )}
                  <div
                    className={`rounded-2xl px-3.5 py-2.5 max-w-[85%] shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-card rounded-bl-md border border-border/50'
                    }`}
                  >
                    <p className={`text-sm whitespace-pre-line ${msg.role === 'user' ? '' : 'text-foreground'}`}>
                      {msg.text}
                    </p>
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0">
                      <User className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
            </CardContent>

            {/* Features Tags */}
            <div className="px-4 py-3 border-t border-border/50 bg-card/50">
              <div className="flex flex-wrap gap-1.5">
                {[
                  { icon: MessageCircle, label: 'ตอบอัตโนมัติ' },
                  { icon: ShoppingCart, label: 'รับออเดอร์' },
                  { icon: CalendarCheck, label: 'จองคิว' },
                  { icon: BellRing, label: 'ติดตามลูกค้า' },
                  { icon: CreditCard, label: 'ตรวจสลิป' },
                ].map((tag, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/5 text-primary text-[10px] font-medium">
                    <tag.icon className="w-3 h-3" />
                    {tag.label}
                  </span>
                ))}
              </div>
            </div>
          </Card>

          {/* CTA under demo */}
          <p className="text-center text-muted-foreground text-xs sm:text-sm mt-4">
            💬 อยากลองคุยจริง? คลิกไอคอนแชทด้านล่างขวาได้เลย!
          </p>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
}
