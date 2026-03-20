import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useInView } from '@/hooks/useInView';
import { 
  Store, Coffee, Stethoscope, Sparkles, Scissors, Dumbbell, 
  GraduationCap, Car, PawPrint, Bot, User,
  ShoppingCart, CreditCard, MessageCircle, CalendarCheck, BellRing,
  Tag, Package
} from 'lucide-react';

interface ProductCard {
  name: string;
  price: number;
  promoPrice?: number;
  image: string;
  category?: string;
  stock?: string;
}

interface DemoMessage {
  role: 'user' | 'bot';
  text: string;
  productCard?: ProductCard;
}

interface DemoBusinessType {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  aiName: string;
  greeting: string;
  conversation: DemoMessage[];
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
      { role: 'user', text: 'มีเสื้อรุ่นใหม่มาไหม' },
      { role: 'bot', text: '✨ มาใหม่เลยค่ะ! เสื้อยืด Premium Cotton รุ่นล่าสุด 👇', productCard: {
        name: 'เสื้อยืด Premium Cotton',
        price: 590,
        promoPrice: 450,
        image: '👕',
        category: 'เสื้อผ้า',
        stock: 'พร้อมส่ง'
      }},
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
      { role: 'bot', text: '☕ เมนูแนะนำวันนี้ค่ะ!', productCard: {
        name: 'Dirty Latte',
        price: 95,
        promoPrice: 85,
        image: '☕',
        category: 'เครื่องดื่ม',
        stock: 'พร้อมเสิร์ฟ'
      }},
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
      { role: 'bot', text: '✨ เลเซอร์หน้าใสค่ะ! แนะนำ Pico ค่ะ 👇', productCard: {
        name: 'Picosecond Laser',
        price: 4500,
        promoPrice: 3500,
        image: '✨',
        category: 'เลเซอร์',
        stock: 'คิวว่าง'
      }},
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
      { role: 'bot', text: '🧖‍♀️ แพ็กเกจยอดนิยมค่ะ!', productCard: {
        name: 'Royal Spa Package',
        price: 1800,
        promoPrice: 1500,
        image: '👑',
        category: 'แพ็กเกจ',
        stock: 'คิวว่าง'
      }},
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
      { role: 'bot', text: '🎨 แนะนำ Balayage รุ่นใหม่ค่ะ!', productCard: {
        name: 'Balayage Premium',
        price: 3500,
        promoPrice: 2500,
        image: '💇‍♀️',
        category: 'ทำสีผม',
        stock: 'คิวว่าง'
      }},
      { role: 'user', text: 'เอาวันเสาร์ 10 โมงค่ะ' },
      { role: 'bot', text: '✅ จองคิวสำเร็จแล้วค่ะ!\n📋 BK-0012\n💇‍♀️ Balayage Premium\n📅 เสาร์ 10:00 น.\n💰 ฿2,500\n\nส่งชื่อ-เบอร์โทรมายืนยันได้เลยนะคะ ✨' },
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
      { role: 'bot', text: '🏋️ แนะนำคอร์สนี้ครับ!', productCard: {
        name: 'Personal Training 4 ครั้ง',
        price: 5000,
        promoPrice: 4000,
        image: '🏋️',
        category: 'คอร์สออกกำลังกาย',
        stock: 'เหลือ 3 ที่'
      }},
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
      { role: 'bot', text: '📐 คอร์สคณิตยอดนิยมค่ะ!', productCard: {
        name: 'คณิต PAT1 เข้มข้น',
        price: 7500,
        promoPrice: 6000,
        image: '📐',
        category: 'คอร์สเรียน',
        stock: 'เหลือ 5 ที่'
      }},
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
      { role: 'bot', text: '💉 แพ็กเกจวัคซีนแนะนำค่ะ!', productCard: {
        name: 'วัคซีนแพ็กเกจรวม',
        price: 1000,
        promoPrice: 900,
        image: '🐱',
        category: 'บริการสัตว์เลี้ยง',
        stock: 'คิวว่าง'
      }},
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
      { role: 'bot', text: '🔧 แพ็กเกจแนะนำครับ!', productCard: {
        name: 'เช็คระยะ+เปลี่ยนถ่าย',
        price: 2800,
        promoPrice: 2200,
        image: '🚗',
        category: 'บริการรถยนต์',
        stock: 'คิวว่าง'
      }},
      { role: 'user', text: 'เอาเช็คระยะพร้อมเปลี่ยน พรุ่งนี้เช้าครับ' },
      { role: 'bot', text: '✅ จองคิวสำเร็จครับ!\n📋 BK-0103\n🚗 เช็คระยะ+เปลี่ยนถ่ายน้ำมัน\n📅 พรุ่งนี้ 09:00 น.\n💰 ฿2,200\n⏰ ใช้เวลาประมาณ 1.5-2 ชม.\n\nนำรถมาจอดหน้าอู่ได้เลยครับ 🔧' },
    ],
    products: ['เปลี่ยนถ่ายน้ำมัน', 'เช็คระยะ', 'ซ่อมช่วงล่าง'],
  },
];

// Flex Message-style Product Card component
function DemoProductCard({ product }: { product: ProductCard }) {
  const discount = product.promoPrice && product.price > 0
    ? Math.round(((product.price - product.promoPrice) / product.price) * 100)
    : 0;

  return (
    <div className="rounded-xl overflow-hidden border border-border/60 bg-card shadow-sm max-w-[240px] text-left" style={{ animation: 'fadeIn 0.3s ease-out both' }}>
      {/* Hero image area */}
      <div className="relative bg-gradient-to-br from-primary/10 to-accent/10 h-24 flex items-center justify-center">
        <span className="text-4xl">{product.image}</span>
        {discount > 0 && (
          <span className="absolute top-2 left-2 bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-md">
            🔥 ลด {discount}%
          </span>
        )}
        {product.stock && (
          <span className="absolute top-2 right-2 bg-card/90 text-[10px] font-medium px-1.5 py-0.5 rounded-md text-green-600 border border-green-200">
            ✅ {product.stock}
          </span>
        )}
      </div>
      {/* Content */}
      <div className="p-3 space-y-2">
        {product.category && (
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <Tag className="w-2.5 h-2.5" />
            {product.category}
          </span>
        )}
        <p className="text-sm font-semibold text-foreground leading-tight">{product.name}</p>
        <div className="flex items-baseline gap-2">
          {product.promoPrice ? (
            <>
              <span className="text-base font-bold text-destructive">฿{product.promoPrice.toLocaleString()}</span>
              <span className="text-xs text-muted-foreground line-through">฿{product.price.toLocaleString()}</span>
            </>
          ) : (
            <span className="text-base font-bold text-foreground">฿{product.price.toLocaleString()}</span>
          )}
        </div>
        {/* Action buttons mimicking Flex Message */}
        <div className="flex gap-1.5 pt-1">
          <button className="flex-1 flex items-center justify-center gap-1 bg-primary text-primary-foreground text-[11px] font-medium py-1.5 rounded-lg hover:opacity-90 transition-opacity">
            <ShoppingCart className="w-3 h-3" />
            สั่งซื้อ
          </button>
          <button className="flex-1 flex items-center justify-center gap-1 bg-muted text-foreground text-[11px] font-medium py-1.5 rounded-lg hover:bg-muted/80 transition-colors">
            <Package className="w-3 h-3" />
            ดูเพิ่มเติม
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DemoSection() {
  const [activeDemo, setActiveDemo] = useState('online-shop');
  const sectionRef = useInView();
  const [visibleCount, setVisibleCount] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  const currentDemo = demoBusinessTypes.find(d => d.id === activeDemo)!;

  useEffect(() => {
    setVisibleCount(0);
    setIsTyping(true);

    let current = 0;
    const showNext = () => {
      current++;
      setIsTyping(false);
      setVisibleCount(current);

      if (current < 1 + currentDemo.conversation.length) {
        const nextMsg = current === 0 ? { role: 'bot' } : currentDemo.conversation[current - 1];
        const delay = nextMsg?.role === 'user' ? 600 : 800;
        
        setTimeout(() => {
          setIsTyping(true);
          setTimeout(showNext, nextMsg?.role === 'user' ? 500 : 1200);
        }, delay);
      }
    };

    const timer = setTimeout(showNext, 1000);
    return () => clearTimeout(timer);
  }, [activeDemo]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [visibleCount, isTyping]);

  const allMessages: DemoMessage[] = [
    { role: 'bot' as const, text: currentDemo.greeting },
    ...currentDemo.conversation,
  ];

  const handleSelectDemo = (id: string) => {
    if (id === activeDemo) return;
    setActiveDemo(id);
  };

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
                onClick={() => handleSelectDemo(biz.id)}
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
                  <span className="text-primary-foreground/80 text-xs">
                    {isTyping ? 'กำลังพิมพ์...' : 'ออนไลน์อยู่ค่ะ'}
                  </span>
                </div>
              </div>
              <Badge className="ml-auto bg-primary-foreground/20 text-primary-foreground border-none text-[10px]">
                DEMO
              </Badge>
            </div>

            {/* Chat Messages */}
            <CardContent ref={chatContainerRef} className="p-4 space-y-3 bg-muted/30 min-h-[100px] overflow-hidden transition-all duration-500 ease-out">
              {allMessages.slice(0, visibleCount).map((msg, i) => (
                <div key={`${activeDemo}-${i}`}>
                  <div
                    className={`flex gap-2 items-end ${msg.role === 'user' ? 'justify-end' : ''}`}
                    style={{ animation: 'fadeIn 0.3s ease-out both' }}
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
                  {/* Product Card (Flex Message style) */}
                  {msg.productCard && msg.role === 'bot' && (
                    <div className="flex gap-2 items-end mt-2" style={{ animation: 'fadeIn 0.4s ease-out 0.2s both' }}>
                      <div className="w-7 shrink-0" />
                      <DemoProductCard product={msg.productCard} />
                    </div>
                  )}
                </div>
              ))}

              {/* Typing Indicator */}
              {isTyping && (
                <div className="flex gap-2 items-end" style={{ animation: 'fadeIn 0.2s ease-out both' }}>
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="bg-card rounded-2xl rounded-bl-md px-4 py-3 shadow-sm border border-border/50">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '0ms', animationDuration: '0.6s' }} />
                      <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '150ms', animationDuration: '0.6s' }} />
                      <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '300ms', animationDuration: '0.6s' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
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
