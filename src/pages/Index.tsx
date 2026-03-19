import { 
  MessageCircle, Zap, Clock, TrendingUp, Users, ShoppingCart, Bot, Phone, 
  CheckCircle2, Sparkles, Star, Shield, BarChart3, Globe, Brain, 
  Palette, CreditCard, Headphones, Store, Coffee, Shirt, Smartphone,
  ArrowRight, BadgeCheck, Rocket, Gift
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ChatWidget } from '@/components/chat/ChatWidget';
import { useInView } from '@/hooks/useInView';
import { Link } from 'react-router-dom';
import DemoSection from '@/components/landing/DemoSection';

const Index = () => {
  const heroRef = useInView();
  const trustRef = useInView();
  const featuresRef = useInView();
  const useCaseRef = useInView();
  const howItWorksRef = useInView();
  const pricingRef = useInView();
  const benefitsRef = useInView();
  const faqRef = useInView();
  const contactRef = useInView();

  const features = [
    {
      icon: Bot,
      title: 'AI ฉลาดเข้าใจภาษาไทย',
      description: 'ตอบคำถามลูกค้าได้อัตโนมัติ 24 ชม. เข้าใจบริบท จำการสนทนา และแนะนำสินค้าตรงใจ'
    },
    {
      icon: ShoppingCart,
      title: 'สร้างออเดอร์อัตโนมัติ',
      description: 'รับออเดอร์ เก็บที่อยู่ คำนวณราคา และแจ้งเตือนแอดมินทันทีที่มีคำสั่งซื้อใหม่'
    },
    {
      icon: MessageCircle,
      title: 'LINE · Facebook · เว็บไซต์',
      description: 'เชื่อมต่อทุกช่องทางในระบบเดียว จัดการแชทรวมศูนย์ ไม่พลาดลูกค้าแม้แต่คนเดียว'
    },
    {
      icon: CreditCard,
      title: 'ตรวจสลิปอัตโนมัติ',
      description: 'AI วิเคราะห์สลิปโอนเงิน ตรวจจำนวนเงิน ธนาคาร วันที่ ยืนยันการชำระเงินทันที'
    },
    {
      icon: Brain,
      title: 'ปรับบุคลิก AI ได้เอง',
      description: 'เลือกเทมเพลตสำเร็จรูปหรือกำหนดบุคลิก ภาษา สไตล์การพูดให้ตรงกับแบรนด์ของคุณ'
    },
    {
      icon: Palette,
      title: 'ฝัง Widget บนเว็บ',
      description: 'ปรับสี ขนาด ตำแหน่ง และข้อความได้ตามใจ คัดลอก Code ไปวางบนเว็บได้ทันที'
    },
    {
      icon: BarChart3,
      title: 'Dashboard & Analytics',
      description: 'ดูยอดขาย สถิติแชท อัตราการปิดการขาย และรายงานแบบ Real-time ทั้งหมดในที่เดียว'
    },
    {
      icon: Globe,
      title: 'Web Scraping & ฐานความรู้',
      description: 'ดึงข้อมูลจากเว็บไซต์ อัพโหลดไฟล์ความรู้ ให้ AI ตอบได้แม่นยำยิ่งขึ้น'
    },
    {
      icon: Shield,
      title: 'ระบบแอดมินครบวงจร',
      description: 'จัดการสินค้า ออเดอร์ คูปอง Broadcast แจ้งเตือน Audit Logs ทุกอย่างในหน้าเดียว'
    }
  ];

  const useCases = [
    {
      icon: Store,
      title: 'ร้านค้าออนไลน์',
      description: 'ขายเสื้อผ้า รองเท้า เครื่องสำอาง อุปกรณ์ IT สินค้าทุกประเภท',
      examples: ['แนะนำสินค้าตามความต้องการ', 'โปรโมชั่นและส่วนลดอัตโนมัติ', 'ติดตามสถานะจัดส่ง'],
      gradient: 'from-primary to-primary/70'
    },
    {
      icon: Coffee,
      title: 'ร้านอาหาร · คาเฟ่',
      description: 'รับออเดอร์ แนะนำเมนู จัดการคิว สำหรับร้านอาหาร คาเฟ่ เบเกอรี่',
      examples: ['แนะนำเมนูยอดนิยม', 'รับออเดอร์ Delivery', 'แจ้งโปรโมชั่นประจำวัน'],
      gradient: 'from-accent to-accent/70'
    },
    {
      icon: Headphones,
      title: 'ธุรกิจบริการ',
      description: 'คลินิก ซาลอน อสังหาริมทรัพย์ ธุรกิจที่ต้องการ AI ตอบคำถาม 24 ชม.',
      examples: ['ตอบ FAQ อัตโนมัติ', 'นัดหมายผ่านแชท', 'ส่ง Broadcast โปรโมชั่น'],
      gradient: 'from-primary/80 to-accent/80'
    }
  ];

  const howItWorks = [
    {
      step: 1,
      title: 'สมัครและเลือกแพ็กเกจ',
      description: 'สมัครสมาชิกและเลือกแพ็กเกจที่เหมาะกับธุรกิจของคุณ'
    },
    {
      step: 2,
      title: 'เพิ่มสินค้า & ตั้งค่า AI',
      description: 'เพิ่มสินค้า ราคา รูปภาพ และเลือกบุคลิก AI ที่ตรงกับแบรนด์'
    },
    {
      step: 3,
      title: 'เชื่อมต่อ LINE / Facebook',
      description: 'เชื่อมต่อช่องทางการขายของคุณเข้ากับระบบ ใส่ Token เสร็จ!'
    },
    {
      step: 4,
      title: 'AI เริ่มขายให้คุณ 24 ชม.',
      description: 'AI พร้อมตอบลูกค้า แนะนำสินค้า และรับออเดอร์อัตโนมัติทันที'
    }
  ];

  const pricingPlans = [
    {
      name: 'Starter',
      price: '1,490',
      period: '/เดือน',
      description: 'เหมาะสำหรับร้านค้าเริ่มต้น',
      features: [
        'เชื่อมต่อ 1 แพลตฟอร์ม (LINE หรือ Facebook)',
        'สินค้าสูงสุด 50 รายการ',
        'AI ตอบแชทอัตโนมัติ 24 ชม.',
        'สร้างออเดอร์อัตโนมัติ',
        'Dashboard รายงานยอดขาย',
        'ตรวจสลิปอัตโนมัติ',
      ],
      highlight: false,
      cta: 'เริ่มต้นใช้งาน'
    },
    {
      name: 'Professional',
      price: '2,990',
      period: '/เดือน',
      description: 'ครบทุกฟีเจอร์สำหรับร้านค้าที่เติบโต',
      features: [
        'เชื่อมต่อทุกแพลตฟอร์ม (LINE + Facebook + เว็บ)',
        'สินค้าไม่จำกัด',
        'ปรับบุคลิก AI ได้เต็มรูปแบบ',
        'Broadcast ส่งข้อความหาลูกค้า',
        'Web Scraping & ฐานความรู้',
        'คูปอง & โปรโมชั่น',
        'Widget ฝังบนเว็บไซต์',
        'แจ้งเตือน LINE สำหรับแอดมิน',
      ],
      highlight: true,
      cta: 'แนะนำ — เริ่มใช้เลย'
    },
    {
      name: 'Business',
      price: '5,990',
      period: '/เดือน',
      description: 'สำหรับธุรกิจที่ต้องการระบบครบวงจร',
      features: [
        'ทุกอย่างใน Professional',
        'หลายสาขา / หลายแบรนด์',
        'API เชื่อมต่อระบบภายนอก',
        'Audit Logs & Error Logs',
        'Analytics ขั้นสูง',
        'ทีมซัพพอร์ตเฉพาะทาง',
        'อัพเดทฟีเจอร์ก่อนใคร',
        'ปรับแต่งระบบตามความต้องการ',
      ],
      highlight: false,
      cta: 'ติดต่อทีมขาย'
    }
  ];

  const faqs = [
    { q: 'SellMate AI คืออะไร?', a: 'SellMate AI คือระบบ AI Chatbot สำหรับธุรกิจ ช่วยตอบลูกค้า แนะนำสินค้า รับออเดอร์ และตรวจสลิปโอนเงินอัตโนมัติ 24 ชั่วโมง ผ่าน LINE, Facebook และเว็บไซต์' },
    { q: 'ใช้งานยากไหม? ต้องเขียนโค้ดหรือเปล่า?', a: 'ไม่ต้องเขียนโค้ดเลย! ระบบมีหน้า Admin Panel ที่ใช้งานง่าย แค่เพิ่มสินค้า ตั้งค่า AI และเชื่อมต่อ LINE/Facebook ก็พร้อมใช้งานได้ทันที' },
    { q: 'รองรับธุรกิจประเภทไหนบ้าง?', a: 'รองรับทุกประเภทธุรกิจ ทั้งร้านค้าออนไลน์ ร้านอาหาร คาเฟ่ เบเกอรี่ คลินิก ซาลอน และอื่นๆ โดยมีเทมเพลต AI สำเร็จรูปให้เลือกตามประเภทธุรกิจ' },
    { q: 'ทดลองใช้งานฟรีได้ไหม?', a: 'สามารถทดลองระบบได้โดยคลิกไอคอนแชทด้านล่างขวาของหน้านี้ หรือติดต่อทีมขายเพื่อขอทดลองใช้งานจริง' },
  ];

  const benefits = [
    'ตอบลูกค้าได้ตลอด 24 ชั่วโมง ไม่มีวันหยุด',
    'ลดต้นทุนค่าจ้างพนักงานตอบแชท 60%+',
    'เพิ่มอัตราการปิดการขายได้ 35%+',
    'จัดการออเดอร์ สลิป ส่งของ อย่างเป็นระบบ',
    'Broadcast โปรโมชั่นหาลูกค้าเก่าได้ทันที',
    'ดูรายงาน Analytics แบบ Real-time'
  ];

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
              <Bot className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg text-foreground">SellMate AI</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">ฟีเจอร์</a>
            <a href="#use-cases" className="text-sm text-muted-foreground hover:text-foreground transition-colors">เหมาะกับใคร</a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">ราคา</a>
            <a href="#faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors">คำถามที่พบบ่อย</a>
            <a href="#contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors">ติดต่อ</a>
          </div>
          <Link to="/admin" className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-md shadow-primary/20">
            เข้าสู่ระบบ
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-[90vh] sm:min-h-screen flex items-center pt-16">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10 animate-gradient" />
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden">
          <div className="absolute top-10 sm:top-20 left-[5%] sm:left-[10%] w-40 sm:w-56 md:w-72 h-40 sm:h-56 md:h-72 bg-primary/20 rounded-full blur-[80px] sm:blur-[100px] animate-float" />
          <div className="absolute bottom-10 sm:bottom-20 right-[5%] sm:right-[10%] w-48 sm:w-72 md:w-96 h-48 sm:h-72 md:h-96 bg-accent/15 rounded-full blur-[100px] sm:blur-[120px] animate-float" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] sm:w-[450px] md:w-[600px] h-[300px] sm:h-[450px] md:h-[600px] bg-primary/5 rounded-full blur-[100px] sm:blur-[150px]" />
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(hsl(var(--foreground)/0.03)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--foreground)/0.03)_1px,transparent_1px)] bg-[size:40px_40px] sm:bg-[size:50px_50px] md:bg-[size:60px_60px]" />
        
        <div ref={heroRef.ref} className="container mx-auto px-4 py-16 sm:py-20 relative z-10">
          <div className={`max-w-5xl mx-auto text-center ${heroRef.isInView ? '' : 'opacity-0'}`}>
            <div className={`inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 rounded-full glass text-primary text-xs sm:text-sm font-medium mb-6 sm:mb-8 ${heroRef.isInView ? 'animate-fade-down' : ''}`}>
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>AI ผู้ช่วยขายอัจฉริยะ สำหรับทุกธุรกิจ</span>
              <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-primary" />
            </div>
            
            <h1 className={`text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-bold mb-6 sm:mb-8 leading-relaxed sm:leading-relaxed md:leading-relaxed lg:leading-tight tracking-tight ${heroRef.isInView ? 'animate-fade-up' : ''}`}>
              <span className="text-foreground">เปลี่ยนแชทบอทธรรมดา</span>
              <br />
              <span className="gradient-text">ให้เป็นพนักงานขายมืออาชีพ</span>
            </h1>
            
            <p className={`text-base sm:text-lg md:text-xl lg:text-2xl text-muted-foreground mb-8 sm:mb-12 max-w-3xl mx-auto leading-loose sm:leading-loose px-2 sm:px-0 ${heroRef.isInView ? 'animate-fade-up animate-stagger-1' : ''}`}>
              SellMate AI ช่วยตอบแชท แนะนำสินค้า รับออเดอร์ และตรวจสลิปอัตโนมัติ 24 ชม.
              <br className="hidden sm:block" />
              เชื่อมต่อ LINE · Facebook · เว็บไซต์ พร้อมใช้งานทันที
            </p>

            <div className={`flex flex-col sm:flex-row gap-4 justify-center mb-8 ${heroRef.isInView ? 'animate-fade-up animate-stagger-2' : ''}`}>
              <a href="#pricing" className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl bg-primary text-primary-foreground font-semibold text-base sm:text-lg shadow-xl shadow-primary/25 hover:shadow-2xl hover:shadow-primary/30 hover:scale-105 transition-all duration-300">
                <Rocket className="w-5 h-5" />
                เริ่มต้นใช้งาน
              </a>
              <a href="#contact" className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl glass text-foreground font-semibold text-base sm:text-lg hover:bg-card hover:shadow-xl transition-all duration-300">
                <Phone className="w-5 h-5" />
                ติดต่อทีมขาย
              </a>
            </div>

            <div className={`inline-flex items-center gap-2 sm:gap-3 px-4 sm:px-5 md:px-6 py-2.5 sm:py-3 rounded-full bg-primary/10 border border-primary/20 ${heroRef.isInView ? 'animate-fade-up animate-stagger-3' : ''}`}>
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-green-500 rounded-full animate-pulse" />
              <span className="text-muted-foreground text-xs sm:text-sm md:text-base">ลองคุยกับ AI ได้เลย — คลิกไอคอนแชทด้านล่างขวา</span>
            </div>
          </div>
        </div>

        <div className="absolute bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 animate-bounce hidden md:block">
          <div className="w-6 h-10 border-2 border-muted-foreground/30 rounded-full flex items-start justify-center p-2">
            <div className="w-1.5 h-3 bg-muted-foreground/50 rounded-full" />
          </div>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="py-8 sm:py-12 border-y border-border/50 bg-muted/30">
        <div ref={trustRef.ref} className="container mx-auto px-4">
          <div className={`flex flex-wrap justify-center gap-6 sm:gap-12 items-center ${trustRef.isInView ? 'animate-fade-up' : 'opacity-0'}`}>
            {[
              { icon: BadgeCheck, text: 'ไม่ต้องเขียนโค้ด' },
              { icon: Clock, text: 'ตั้งค่าไม่ถึง 10 นาที' },
              { icon: Shield, text: 'ข้อมูลปลอดภัย 100%' },
              { icon: Headphones, text: 'ซัพพอร์ตทีมไทย' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-muted-foreground">
                <item.icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                <span className="text-xs sm:text-sm font-medium">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 sm:py-24 relative">
        <div className="absolute top-1/2 left-0 w-40 sm:w-72 h-40 sm:h-72 bg-accent/10 rounded-full blur-[80px] sm:blur-[100px]" />
        <div className="absolute bottom-0 right-0 w-48 sm:w-96 h-48 sm:h-96 bg-primary/10 rounded-full blur-[100px] sm:blur-[120px]" />
        
        <div ref={featuresRef.ref} className="container mx-auto px-4 relative z-10">
          <div className={`text-center mb-10 sm:mb-16 ${featuresRef.isInView ? 'animate-fade-up' : 'opacity-0'}`}>
            <span className="inline-block px-3 sm:px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs sm:text-sm font-medium mb-3 sm:mb-4">
              ฟีเจอร์ทั้งหมด
            </span>
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4 sm:mb-6">
              ครบทุกเครื่องมือที่ธุรกิจต้องการ
            </h2>
            <p className="text-muted-foreground text-sm sm:text-lg max-w-2xl mx-auto px-2">
              ระบบ AI พร้อมเครื่องมือบริหารจัดการร้านค้าแบบครบวงจร
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <Card 
                key={index} 
                className={`group glass hover:bg-card border-transparent hover:border-primary/20 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500 ${featuresRef.isInView ? `animate-fade-up animate-stagger-${Math.min(index + 1, 6)}` : 'opacity-0'}`}
              >
                <CardContent className="p-6 sm:p-8">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500 shadow-lg shadow-primary/25">
                    <feature.icon className="w-6 h-6 sm:w-7 sm:h-7 text-primary-foreground" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-foreground mb-2 sm:mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed text-sm sm:text-base">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section id="use-cases" className="py-16 sm:py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-muted/30 to-background" />
        
        <div ref={useCaseRef.ref} className="container mx-auto px-4 relative z-10">
          <div className={`text-center mb-10 sm:mb-16 ${useCaseRef.isInView ? 'animate-fade-up' : 'opacity-0'}`}>
            <span className="inline-block px-3 sm:px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs sm:text-sm font-medium mb-3 sm:mb-4">
              เหมาะกับทุกธุรกิจ
            </span>
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4 sm:mb-6">
              ไม่ว่าขายอะไร SellMate AI ช่วยได้
            </h2>
            <p className="text-muted-foreground text-sm sm:text-lg max-w-2xl mx-auto px-2">
              มีเทมเพลต AI สำเร็จรูปให้เลือกตามประเภทธุรกิจ ตั้งค่าง่าย ใช้งานได้ทันที
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto">
            {useCases.map((useCase, index) => (
              <Card 
                key={index} 
                className={`group glass hover:bg-card hover:shadow-2xl hover:shadow-primary/10 transition-all duration-500 overflow-hidden ${useCaseRef.isInView ? `animate-scale-up animate-stagger-${index + 1}` : 'opacity-0'}`}
              >
                <CardContent className="p-6 sm:p-8 relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative">
                    <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br ${useCase.gradient} flex items-center justify-center mb-4 sm:mb-6 shadow-lg group-hover:scale-110 transition-transform duration-500`}>
                      <useCase.icon className="w-7 h-7 sm:w-8 sm:h-8 text-primary-foreground" />
                    </div>
                    <h3 className="font-bold text-xl sm:text-2xl text-foreground mb-2 sm:mb-3">{useCase.title}</h3>
                    <p className="text-muted-foreground text-sm sm:text-base mb-4 sm:mb-6">{useCase.description}</p>
                    <div className="space-y-2.5">
                      {useCase.examples.map((example, i) => (
                        <div key={i} className="flex items-center gap-2.5">
                          <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                          <span className="text-foreground text-sm">{example}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 sm:py-24 relative">
        <div ref={howItWorksRef.ref} className="container mx-auto px-4 relative z-10">
          <div className={`text-center mb-10 sm:mb-16 ${howItWorksRef.isInView ? 'animate-fade-up' : 'opacity-0'}`}>
            <span className="inline-block px-3 sm:px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs sm:text-sm font-medium mb-3 sm:mb-4">
              เริ่มต้นง่าย
            </span>
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4 sm:mb-6">
              4 ขั้นตอน พร้อมใช้งาน
            </h2>
            <p className="text-muted-foreground text-sm sm:text-lg max-w-2xl mx-auto px-2">
              ตั้งค่าง่าย ไม่ต้องเขียนโค้ด ใช้งานได้ภายไม่กี่นาที
            </p>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 md:gap-8 max-w-6xl mx-auto">
            {howItWorks.map((item, index) => (
              <div 
                key={index} 
                className={`text-center relative group ${howItWorksRef.isInView ? `animate-fade-up animate-stagger-${index + 1}` : 'opacity-0'}`}
              >
                <div className="relative inline-block mb-4 sm:mb-6">
                  <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground flex items-center justify-center text-xl sm:text-3xl font-bold shadow-xl shadow-primary/25 group-hover:scale-110 transition-transform duration-500">
                    {item.step}
                  </div>
                  <div className="absolute inset-0 w-14 h-14 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-primary/50 blur-xl opacity-0 group-hover:opacity-50 transition-opacity duration-500" />
                </div>
                <h3 className="text-base sm:text-xl font-bold text-foreground mb-2 sm:mb-3">{item.title}</h3>
                <p className="text-muted-foreground text-xs sm:text-base">{item.description}</p>
                
                {index < howItWorks.length - 1 && (
                  <div className="hidden lg:block absolute top-10 left-[65%] w-[70%] border-t-2 border-dashed border-primary/30" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-16 sm:py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-muted/40 to-background" />
        <div className="absolute top-1/4 left-0 w-72 h-72 bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-0 w-72 h-72 bg-accent/10 rounded-full blur-[120px]" />
        
        <div ref={pricingRef.ref} className="container mx-auto px-4 relative z-10">
          <div className={`text-center mb-10 sm:mb-16 ${pricingRef.isInView ? 'animate-fade-up' : 'opacity-0'}`}>
            <span className="inline-block px-3 sm:px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs sm:text-sm font-medium mb-3 sm:mb-4">
              แพ็กเกจ & ราคา
            </span>
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4 sm:mb-6">
              เลือกแพ็กเกจที่เหมาะกับคุณ
            </h2>
            <p className="text-muted-foreground text-sm sm:text-lg max-w-2xl mx-auto px-2">
              เริ่มต้นได้ทุกขนาดธุรกิจ อัพเกรดได้ตลอดเวลา
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto items-stretch">
            {pricingPlans.map((plan, index) => (
              <Card 
                key={index} 
                className={`relative group overflow-hidden transition-all duration-500 ${
                  plan.highlight 
                    ? 'gradient-border shadow-2xl shadow-primary/15 scale-[1.02] md:scale-105' 
                    : 'glass hover:bg-card hover:shadow-xl'
                } ${pricingRef.isInView ? `animate-scale-up animate-stagger-${index + 1}` : 'opacity-0'}`}
              >
                {plan.highlight && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-accent to-primary" />
                )}
                <CardContent className="p-6 sm:p-8 flex flex-col h-full">
                  {plan.highlight && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4 self-start">
                      <Star className="w-3 h-3 fill-primary" />
                      ยอดนิยม
                    </div>
                  )}
                  <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-1">{plan.name}</h3>
                  <p className="text-muted-foreground text-sm mb-4 sm:mb-6">{plan.description}</p>
                  
                  <div className="mb-6 sm:mb-8">
                    <span className="text-3xl sm:text-4xl font-bold text-foreground">฿{plan.price}</span>
                    <span className="text-muted-foreground text-sm">{plan.period}</span>
                  </div>
                  
                  <div className="space-y-3 mb-6 sm:mb-8 flex-1">
                    {plan.features.map((feature, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-primary shrink-0 mt-0.5" />
                        <span className="text-foreground text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>
                  
                  <a 
                    href="#contact" 
                    className={`w-full text-center py-3 sm:py-3.5 rounded-xl font-semibold text-sm sm:text-base transition-all duration-300 block ${
                      plan.highlight 
                        ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:scale-105' 
                        : 'bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground'
                    }`}
                  >
                    {plan.cta}
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 sm:py-24 relative">
        <div className="absolute top-0 right-0 w-48 sm:w-96 h-48 sm:h-96 bg-primary/10 rounded-full blur-[100px] sm:blur-[150px]" />
        
        <div ref={benefitsRef.ref} className="container mx-auto px-4 relative z-10">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-8 sm:gap-16 items-center">
              <div className={benefitsRef.isInView ? 'animate-fade-right' : 'opacity-0'}>
                <span className="inline-block px-3 sm:px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs sm:text-sm font-medium mb-3 sm:mb-4">
                  ทำไมต้อง SellMate AI
                </span>
                <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4 sm:mb-6 leading-tight">
                  เพิ่มยอดขาย
                  <br />
                  <span className="gradient-text">ลดต้นทุน ทำงานน้อยลง</span>
                </h2>
                <p className="text-muted-foreground text-sm sm:text-lg mb-6 sm:mb-10 leading-relaxed">
                  ให้ AI ทำงานแทนคุณ ตอบแชท รับออเดอร์ ตรวจสลิป ตลอด 24 ชั่วโมง คุณมีเวลาโฟกัสเรื่องสำคัญของธุรกิจ
                </p>
                
                <div className="space-y-3 sm:space-y-5">
                  {benefits.map((benefit, index) => (
                    <div 
                      key={index} 
                      className={`flex items-start gap-3 sm:gap-4 ${benefitsRef.isInView ? `animate-fade-left animate-stagger-${index + 1}` : 'opacity-0'}`}
                    >
                      <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4 text-primary-foreground" />
                      </div>
                      <span className="text-foreground text-sm sm:text-lg">{benefit}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className={`relative ${benefitsRef.isInView ? 'animate-fade-left' : 'opacity-0'}`}>
                <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-accent/20 rounded-2xl sm:rounded-[2rem] blur-2xl sm:blur-3xl" />
                <Card className="relative glass gradient-border overflow-hidden">
                  <CardContent className="p-6 sm:p-10">
                    <div className="text-center">
                      <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center mx-auto mb-4 sm:mb-8 shadow-xl shadow-primary/30 animate-float">
                        <Zap className="w-8 h-8 sm:w-12 sm:h-12 text-primary-foreground" />
                      </div>
                      <h3 className="text-lg sm:text-2xl font-bold text-foreground mb-2 sm:mb-4">เพิ่มยอดขาย</h3>
                      <p className="text-4xl sm:text-6xl font-bold gradient-text mb-2 sm:mb-4">+35%</p>
                      <p className="text-muted-foreground text-sm sm:text-lg">โดยเฉลี่ยจากร้านค้าที่ใช้ระบบ</p>
                      
                      <div className="grid grid-cols-2 gap-4 mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-border/50">
                        <div>
                          <p className="text-2xl sm:text-3xl font-bold text-foreground">60%</p>
                          <p className="text-muted-foreground text-xs sm:text-sm">ลดค่าใช้จ่ายแชท</p>
                        </div>
                        <div>
                          <p className="text-2xl sm:text-3xl font-bold text-foreground">24/7</p>
                          <p className="text-muted-foreground text-xs sm:text-sm">ตอบลูกค้าตลอด</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-16 sm:py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-muted/30 to-background" />
        
        <div ref={faqRef.ref} className="container mx-auto px-4 relative z-10">
          <div className={`text-center mb-10 sm:mb-16 ${faqRef.isInView ? 'animate-fade-up' : 'opacity-0'}`}>
            <span className="inline-block px-3 sm:px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs sm:text-sm font-medium mb-3 sm:mb-4">
              คำถามที่พบบ่อย
            </span>
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4 sm:mb-6">
              มีคำถาม? เรามีคำตอบ
            </h2>
          </div>
          
          <div className="max-w-3xl mx-auto space-y-4">
            {faqs.map((faq, index) => (
              <Card 
                key={index} 
                className={`glass hover:bg-card transition-all duration-300 ${faqRef.isInView ? `animate-fade-up animate-stagger-${index + 1}` : 'opacity-0'}`}
              >
                <CardContent className="p-5 sm:p-6">
                  <h3 className="font-bold text-foreground text-base sm:text-lg mb-2">{faq.q}</h3>
                  <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">{faq.a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-16 sm:py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/5 to-background" />
        
        <div ref={contactRef.ref} className="container mx-auto px-4 relative z-10">
          <div className={`max-w-4xl mx-auto text-center ${contactRef.isInView ? '' : 'opacity-0'}`}>
            <span className={`inline-block px-3 sm:px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs sm:text-sm font-medium mb-3 sm:mb-4 ${contactRef.isInView ? 'animate-fade-down' : ''}`}>
              เริ่มต้นวันนี้
            </span>
            <h2 className={`text-2xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4 sm:mb-6 ${contactRef.isInView ? 'animate-fade-up' : ''}`}>
              พร้อมเพิ่มยอดขายด้วย AI?
            </h2>
            <p className={`text-muted-foreground text-sm sm:text-lg mb-8 sm:mb-12 ${contactRef.isInView ? 'animate-fade-up animate-stagger-1' : ''}`}>
              ติดต่อทีมงานเพื่อเริ่มต้นใช้งาน หรือสอบถามรายละเอียดเพิ่มเติม
            </p>
            
            <div className={`flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center ${contactRef.isInView ? 'animate-fade-up animate-stagger-2' : ''}`}>
              <a 
                href="tel:0955851136"
                className="group inline-flex items-center justify-center gap-3 sm:gap-4 px-5 sm:px-8 py-4 sm:py-5 glass rounded-xl sm:rounded-2xl hover:bg-card hover:shadow-xl transition-all duration-500"
              >
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/25 group-hover:scale-110 transition-transform duration-500">
                  <Phone className="w-6 h-6 sm:w-7 sm:h-7 text-primary-foreground" />
                </div>
                <div className="text-left">
                  <p className="text-xs sm:text-sm text-muted-foreground">โทรศัพท์</p>
                  <p className="text-lg sm:text-xl font-bold text-foreground">095-585-1136</p>
                </div>
              </a>
              
              <a 
                href="https://line.me/ti/p/DF5gdjoeU0"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center justify-center gap-3 sm:gap-4 px-5 sm:px-8 py-4 sm:py-5 glass rounded-xl sm:rounded-2xl hover:bg-card hover:shadow-xl transition-all duration-500"
              >
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br from-[#00B900] to-[#00D100] flex items-center justify-center shadow-lg shadow-[#00B900]/25 group-hover:scale-110 transition-transform duration-500">
                  <svg className="w-7 h-7 sm:w-8 sm:h-8" viewBox="0 0 24 24" fill="white">
                    <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="text-xs sm:text-sm text-muted-foreground">LINE</p>
                  <p className="text-lg sm:text-xl font-bold text-foreground">แชทกับเรา</p>
                </div>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 sm:py-12 border-t border-border/50 relative">
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-bold text-foreground">SellMate AI</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link to="/privacy-policy" className="hover:text-foreground transition-colors">นโยบายความเป็นส่วนตัว</Link>
              <Link to="/terms-of-service" className="hover:text-foreground transition-colors">เงื่อนไขการใช้งาน</Link>
            </div>
            <p className="text-muted-foreground text-sm">
              © 2025 SellMate AI. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* Chat Widget */}
      <ChatWidget position="bottom-right" />
    </div>
  );
};

export default Index;
