import { MessageCircle, Zap, Clock, TrendingUp, Users, ShoppingCart, Bot, Phone, CheckCircle2, Sparkles, Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ChatWidget } from '@/components/chat/ChatWidget';
import { useInView } from '@/hooks/useInView';

const Index = () => {
  const heroRef = useInView();
  const demoRef = useInView();
  const featuresRef = useInView();
  const howItWorksRef = useInView();
  const benefitsRef = useInView();
  const contactRef = useInView();

  const features = [
    {
      icon: Bot,
      title: 'AI อัจฉริยะ',
      description: 'ตอบคำถามลูกค้าได้อัตโนมัติ 24 ชั่วโมง ด้วย AI ที่เข้าใจภาษาไทย'
    },
    {
      icon: ShoppingCart,
      title: 'รับออเดอร์อัตโนมัติ',
      description: 'สร้างออเดอร์และเก็บข้อมูลลูกค้าโดยอัตโนมัติผ่านการแชท'
    },
    {
      icon: MessageCircle,
      title: 'รองรับหลายแพลตฟอร์ม',
      description: 'ใช้งานได้ทั้ง LINE, Facebook Messenger และเว็บไซต์'
    },
    {
      icon: TrendingUp,
      title: 'เพิ่มยอดขาย',
      description: 'แนะนำสินค้าตรงใจลูกค้า เพิ่มโอกาสในการปิดการขาย'
    },
    {
      icon: Clock,
      title: 'ประหยัดเวลา',
      description: 'ลดภาระงานตอบแชทซ้ำๆ ให้คุณมีเวลาทำสิ่งอื่น'
    },
    {
      icon: Users,
      title: 'บริการลูกค้าดีขึ้น',
      description: 'ตอบกลับทันที ไม่พลาดลูกค้าแม้แต่รายเดียว'
    }
  ];

  const howItWorks = [
    {
      step: 1,
      title: 'เชื่อมต่อแพลตฟอร์ม',
      description: 'เชื่อมต่อ LINE, Facebook หรือเว็บไซต์ของร้านคุณเข้ากับระบบ'
    },
    {
      step: 2,
      title: 'เพิ่มข้อมูลสินค้า',
      description: 'อัพโหลดรายละเอียดสินค้า ราคา และรูปภาพ'
    },
    {
      step: 3,
      title: 'ปรับแต่ง AI',
      description: 'ตั้งค่าบุคลิกและสไตล์การตอบของ AI ให้เหมาะกับแบรนด์'
    },
    {
      step: 4,
      title: 'เริ่มใช้งาน',
      description: 'AI พร้อมรับลูกค้าและสร้างออเดอร์ให้คุณอัตโนมัติ'
    }
  ];

  const benefits = [
    'ตอบลูกค้าได้ตลอด 24 ชั่วโมง ไม่มีวันหยุด',
    'ลดต้นทุนค่าจ้างพนักงานตอบแชท',
    'เพิ่มอัตราการปิดการขายได้มากขึ้น',
    'จัดการออเดอร์อย่างเป็นระบบ',
    'รองรับหลายแพลตฟอร์มในที่เดียว',
    'ดูสถิติและรายงานการขายได้ง่าย'
  ];

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] sm:min-h-screen flex items-center">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10 animate-gradient" />
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden">
          <div className="absolute top-10 sm:top-20 left-[5%] sm:left-[10%] w-40 sm:w-72 h-40 sm:h-72 bg-primary/20 rounded-full blur-[80px] sm:blur-[100px] animate-float" />
          <div className="absolute bottom-10 sm:bottom-20 right-[5%] sm:right-[10%] w-48 sm:w-96 h-48 sm:h-96 bg-accent/15 rounded-full blur-[100px] sm:blur-[120px] animate-float" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] sm:w-[600px] h-[300px] sm:h-[600px] bg-primary/5 rounded-full blur-[100px] sm:blur-[150px]" />
        </div>
        
        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(hsl(var(--foreground)/0.03)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--foreground)/0.03)_1px,transparent_1px)] bg-[size:40px_40px] sm:bg-[size:60px_60px]" />
        
        <div ref={heroRef.ref} className="container mx-auto px-4 py-16 sm:py-20 relative z-10">
          <div className={`max-w-5xl mx-auto text-center ${heroRef.isInView ? '' : 'opacity-0'}`}>
            <div className={`inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-full glass text-primary text-xs sm:text-sm font-medium mb-6 sm:mb-8 ${heroRef.isInView ? 'animate-fade-down' : ''}`}>
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>AI Sales Assistant สำหรับร้านค้าออนไลน์</span>
              <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-primary" />
            </div>
            
            <h1 className={`text-3xl sm:text-5xl md:text-7xl font-bold mb-6 sm:mb-8 leading-tight tracking-tight ${heroRef.isInView ? 'animate-fade-up' : ''}`}>
              <span className="text-foreground">เปลี่ยนแชทบอทธรรมดา</span>
              <br />
              <span className="gradient-text">ให้เป็นพนักงานขายมืออาชีพ</span>
            </h1>
            
            <p className={`text-base sm:text-xl md:text-2xl text-muted-foreground mb-8 sm:mb-12 max-w-3xl mx-auto leading-relaxed px-2 sm:px-0 ${heroRef.isInView ? 'animate-fade-up animate-stagger-1' : ''}`}>
              ระบบ AI Chatbot อัจฉริยะที่ช่วยตอบคำถาม แนะนำสินค้า และรับออเดอร์ให้คุณอัตโนมัติ 
              รองรับทั้ง LINE, Facebook และเว็บไซต์
            </p>

            {/* Chat indicator */}
            <div className={`inline-flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-2.5 sm:py-3 rounded-full bg-primary/10 border border-primary/20 ${heroRef.isInView ? 'animate-fade-up animate-stagger-2' : ''}`}>
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-green-500 rounded-full animate-pulse" />
              <span className="text-muted-foreground text-xs sm:text-base">คลิกไอคอนแชทด้านล่างเพื่อทดลอง</span>
            </div>
          </div>
        </div>

        {/* Scroll indicator - hidden on mobile */}
        <div className="absolute bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 animate-bounce hidden sm:block">
          <div className="w-6 h-10 border-2 border-muted-foreground/30 rounded-full flex items-start justify-center p-2">
            <div className="w-1.5 h-3 bg-muted-foreground/50 rounded-full" />
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section id="demo-section" className="py-16 sm:py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-muted/50 to-background" />
        
        <div ref={demoRef.ref} className="container mx-auto px-4 relative z-10">
          <div className={`text-center mb-10 sm:mb-16 ${demoRef.isInView ? 'animate-fade-up' : 'opacity-0'}`}>
            <span className="inline-block px-3 sm:px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs sm:text-sm font-medium mb-3 sm:mb-4">
              ทดลองใช้งาน
            </span>
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4 sm:mb-6">
              ลองใช้งานจริง
            </h2>
            <p className="text-muted-foreground text-sm sm:text-lg max-w-2xl mx-auto px-2">
              คลิกที่ไอคอนแชทด้านล่างขวา เพื่อทดลองสนทนากับ AI Sales Assistant ของเรา
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-8 max-w-5xl mx-auto">
            {[
              { img: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=100&h=100&fit=crop", title: "สินค้าแฟชั่น", desc: "ถามเกี่ยวกับเสื้อผ้า รองเท้า กระเป๋า" },
              { img: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=100&h=100&fit=crop", title: "อิเล็กทรอนิกส์", desc: "สอบถามราคา สเปค การรับประกัน" },
              { img: "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=100&h=100&fit=crop", title: "สินค้าทั่วไป", desc: "สั่งซื้อ เช็คสต็อก ติดตามออเดอร์" }
            ].map((item, index) => (
              <Card 
                key={index} 
                className={`group glass hover:bg-card hover:shadow-2xl hover:shadow-primary/10 transition-all duration-500 overflow-hidden ${demoRef.isInView ? `animate-scale-up animate-stagger-${index + 1}` : 'opacity-0'}`}
              >
                <CardContent className="p-6 sm:p-8 text-center relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto mb-4 sm:mb-6 group-hover:scale-110 transition-transform duration-500">
                      <img 
                        src={item.img}
                        alt={item.title}
                        className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl object-cover"
                      />
                    </div>
                    <h3 className="font-bold text-lg sm:text-xl text-foreground mb-2 sm:mb-3">{item.title}</h3>
                    <p className="text-muted-foreground text-sm sm:text-base">{item.desc}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 sm:py-24 relative">
        <div className="absolute top-1/2 left-0 w-40 sm:w-72 h-40 sm:h-72 bg-accent/10 rounded-full blur-[80px] sm:blur-[100px]" />
        <div className="absolute bottom-0 right-0 w-48 sm:w-96 h-48 sm:h-96 bg-primary/10 rounded-full blur-[100px] sm:blur-[120px]" />
        
        <div ref={featuresRef.ref} className="container mx-auto px-4 relative z-10">
          <div className={`text-center mb-10 sm:mb-16 ${featuresRef.isInView ? 'animate-fade-up' : 'opacity-0'}`}>
            <span className="inline-block px-3 sm:px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs sm:text-sm font-medium mb-3 sm:mb-4">
              ฟีเจอร์
            </span>
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4 sm:mb-6">
              ฟีเจอร์ที่ช่วยให้ร้านคุณเติบโต
            </h2>
            <p className="text-muted-foreground text-sm sm:text-lg max-w-2xl mx-auto px-2">
              ครบครันทุกฟังก์ชันที่ร้านค้าออนไลน์ต้องการ
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <Card 
                key={index} 
                className={`group glass hover:bg-card border-transparent hover:border-primary/20 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500 ${featuresRef.isInView ? `animate-fade-up animate-stagger-${index + 1}` : 'opacity-0'}`}
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

      {/* How It Works Section */}
      <section className="py-16 sm:py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-muted/30 to-background" />
        
        <div ref={howItWorksRef.ref} className="container mx-auto px-4 relative z-10">
          <div className={`text-center mb-10 sm:mb-16 ${howItWorksRef.isInView ? 'animate-fade-up' : 'opacity-0'}`}>
            <span className="inline-block px-3 sm:px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs sm:text-sm font-medium mb-3 sm:mb-4">
              วิธีใช้งาน
            </span>
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4 sm:mb-6">
              เริ่มต้นง่ายใน 4 ขั้นตอน
            </h2>
            <p className="text-muted-foreground text-sm sm:text-lg max-w-2xl mx-auto px-2">
              ตั้งค่าระบบได้ภายในไม่กี่นาที พร้อมใช้งานทันที
            </p>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-8 max-w-6xl mx-auto">
            {howItWorks.map((item, index) => (
              <div 
                key={index} 
                className={`text-center relative group ${howItWorksRef.isInView ? `animate-fade-up animate-stagger-${index + 1}` : 'opacity-0'}`}
              >
                <div className="relative inline-block mb-4 sm:mb-6">
                  <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground flex items-center justify-center text-xl sm:text-3xl font-bold shadow-xl shadow-primary/25 group-hover:scale-110 transition-transform duration-500">
                    {item.step}
                  </div>
                  {/* Glow effect */}
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

      {/* Benefits Section */}
      <section className="py-16 sm:py-24 relative">
        <div className="absolute top-0 right-0 w-48 sm:w-96 h-48 sm:h-96 bg-primary/10 rounded-full blur-[100px] sm:blur-[150px]" />
        
        <div ref={benefitsRef.ref} className="container mx-auto px-4 relative z-10">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-8 sm:gap-16 items-center">
              <div className={benefitsRef.isInView ? 'animate-fade-right' : 'opacity-0'}>
                <span className="inline-block px-3 sm:px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs sm:text-sm font-medium mb-3 sm:mb-4">
                  ประโยชน์
                </span>
                <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4 sm:mb-6 leading-tight">
                  ทำไมร้านค้าต้องใช้
                  <br />
                  <span className="gradient-text">AI Sales Assistant?</span>
                </h2>
                <p className="text-muted-foreground text-sm sm:text-lg mb-6 sm:mb-10 leading-relaxed">
                  เพิ่มประสิทธิภาพการขายและลดภาระงานของคุณด้วยระบบ AI ที่ออกแบบมาเพื่อร้านค้าออนไลน์โดยเฉพาะ
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
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-16 sm:py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-muted/30 to-background" />
        
        <div ref={contactRef.ref} className="container mx-auto px-4 relative z-10">
          <div className={`max-w-4xl mx-auto text-center ${contactRef.isInView ? '' : 'opacity-0'}`}>
            <span className={`inline-block px-3 sm:px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs sm:text-sm font-medium mb-3 sm:mb-4 ${contactRef.isInView ? 'animate-fade-down' : ''}`}>
              ติดต่อ
            </span>
            <h2 className={`text-2xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4 sm:mb-6 ${contactRef.isInView ? 'animate-fade-up' : ''}`}>
              ติดต่อเรา
            </h2>
            <p className={`text-muted-foreground text-sm sm:text-lg mb-8 sm:mb-12 ${contactRef.isInView ? 'animate-fade-up animate-stagger-1' : ''}`}>
              สนใจใช้งานหรือมีคำถาม? ติดต่อทีมงานของเราได้เลย
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
      <footer className="py-6 sm:py-10 border-t border-border/50 relative">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <p className="text-muted-foreground text-sm sm:text-base">
              © 2024 AI Sales Assistant. All rights reserved.
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