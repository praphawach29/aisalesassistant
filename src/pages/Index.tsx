import { MessageCircle, Zap, Clock, TrendingUp, Users, ShoppingCart, Bot, Phone, ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
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
      description: 'เชื่อมต่อ LINE หรือ Facebook ของร้านคุณเข้ากับระบบ'
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
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/10" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        
        <div ref={heroRef.ref} className="container mx-auto px-4 py-20 relative z-10">
          <div className={`max-w-4xl mx-auto text-center ${heroRef.isInView ? '' : 'opacity-0'}`}>
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6 ${heroRef.isInView ? 'animate-fade-down' : ''}`}>
              <Sparkles className="w-4 h-4" />
              AI Sales Assistant
            </div>
            
            <h1 className={`text-4xl md:text-6xl font-bold text-foreground mb-6 leading-tight ${heroRef.isInView ? 'animate-fade-up' : ''}`}>
              เปลี่ยนแชทบอทธรรมดา
              <br />
              <span className="text-primary">ให้เป็นพนักงานขายมืออาชีพ</span>
            </h1>
            
            <p className={`text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto ${heroRef.isInView ? 'animate-fade-up animate-stagger-1' : ''}`}>
              ระบบ AI Chatbot อัจฉริยะที่ช่วยตอบคำถาม แนะนำสินค้า และรับออเดอร์ให้คุณอัตโนมัติ 
              รองรับทั้ง LINE, Facebook และเว็บไซต์
            </p>
            
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section id="demo-section" className="py-16 bg-muted/30">
        <div ref={demoRef.ref} className="container mx-auto px-4">
          <div className={`text-center mb-12 ${demoRef.isInView ? 'animate-fade-up' : 'opacity-0'}`}>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              ลองใช้งานจริง
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              คลิกที่ไอคอนแชทด้านล่างขวา เพื่อทดลองสนทนากับ AI Sales Assistant ของเรา
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              { img: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=100&h=100&fit=crop", title: "สินค้าแฟชั่น", desc: "ถามเกี่ยวกับเสื้อผ้า รองเท้า กระเป๋า" },
              { img: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=100&h=100&fit=crop", title: "อิเล็กทรอนิกส์", desc: "สอบถามราคา สเปค การรับประกัน" },
              { img: "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=100&h=100&fit=crop", title: "สินค้าทั่วไป", desc: "สั่งซื้อ เช็คสต็อก ติดตามออเดอร์" }
            ].map((item, index) => (
              <Card 
                key={index} 
                className={`bg-card border-border/50 hover:border-primary/50 transition-all duration-300 ${demoRef.isInView ? `animate-scale-up animate-stagger-${index + 1}` : 'opacity-0'}`}
              >
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <img 
                      src={item.img}
                      alt={item.title}
                      className="w-12 h-12 rounded-xl object-cover"
                    />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div ref={featuresRef.ref} className="container mx-auto px-4">
          <div className={`text-center mb-16 ${featuresRef.isInView ? 'animate-fade-up' : 'opacity-0'}`}>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              ฟีเจอร์ที่ช่วยให้ร้านคุณเติบโต
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              ครบครันทุกฟังก์ชันที่ร้านค้าออนไลน์ต้องการ
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <Card 
                key={index} 
                className={`bg-card border-border/50 hover:shadow-lg hover:border-primary/30 transition-all duration-300 ${featuresRef.isInView ? `animate-fade-up animate-stagger-${index + 1}` : 'opacity-0'}`}
              >
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-muted/30">
        <div ref={howItWorksRef.ref} className="container mx-auto px-4">
          <div className={`text-center mb-16 ${howItWorksRef.isInView ? 'animate-fade-up' : 'opacity-0'}`}>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              เริ่มต้นง่ายใน 4 ขั้นตอน
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              ตั้งค่าระบบได้ภายในไม่กี่นาที พร้อมใช้งานทันที
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-5xl mx-auto">
            {howItWorks.map((item, index) => (
              <div 
                key={index} 
                className={`text-center relative ${howItWorksRef.isInView ? `animate-fade-up animate-stagger-${index + 1}` : 'opacity-0'}`}
              >
                <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-muted-foreground text-sm">{item.description}</p>
                
                {index < howItWorks.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-[60%] w-[80%] border-t-2 border-dashed border-primary/30" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20">
        <div ref={benefitsRef.ref} className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className={benefitsRef.isInView ? 'animate-fade-right' : 'opacity-0'}>
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                  ทำไมร้านค้าต้องใช้ AI Sales Assistant?
                </h2>
                <p className="text-muted-foreground text-lg mb-8">
                  เพิ่มประสิทธิภาพการขายและลดภาระงานของคุณด้วยระบบ AI ที่ออกแบบมาเพื่อร้านค้าออนไลน์โดยเฉพาะ
                </p>
                
                <div className="space-y-4">
                  {benefits.map((benefit, index) => (
                    <div 
                      key={index} 
                      className={`flex items-start gap-3 ${benefitsRef.isInView ? `animate-fade-left animate-stagger-${index + 1}` : 'opacity-0'}`}
                    >
                      <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                      <span className="text-foreground">{benefit}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className={`relative ${benefitsRef.isInView ? 'animate-fade-left' : 'opacity-0'}`}>
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5 rounded-3xl blur-2xl" />
                <Card className="relative bg-card border-border/50">
                  <CardContent className="p-8">
                    <div className="text-center">
                      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                        <Zap className="w-10 h-10 text-primary" />
                      </div>
                      <h3 className="text-2xl font-bold text-foreground mb-2">เพิ่มยอดขาย</h3>
                      <p className="text-4xl font-bold text-primary mb-2">+35%</p>
                      <p className="text-muted-foreground">โดยเฉลี่ยจากร้านค้าที่ใช้ระบบ</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-20 bg-muted/30">
        <div ref={contactRef.ref} className="container mx-auto px-4">
          <div className={`max-w-3xl mx-auto text-center ${contactRef.isInView ? '' : 'opacity-0'}`}>
            <h2 className={`text-3xl md:text-4xl font-bold text-foreground mb-4 ${contactRef.isInView ? 'animate-fade-up' : ''}`}>
              ติดต่อเรา
            </h2>
            <p className={`text-muted-foreground text-lg mb-10 ${contactRef.isInView ? 'animate-fade-up animate-stagger-1' : ''}`}>
              สนใจใช้งานหรือมีคำถาม? ติดต่อทีมงานของเราได้เลย
            </p>
            
            <div className={`flex flex-col sm:flex-row gap-6 justify-center ${contactRef.isInView ? 'animate-fade-up animate-stagger-2' : ''}`}>
              <a 
                href="tel:0955851136"
                className="inline-flex items-center justify-center gap-3 px-8 py-4 bg-card border border-border rounded-xl hover:border-primary/50 transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Phone className="w-6 h-6 text-primary" />
                </div>
                <div className="text-left">
                  <p className="text-sm text-muted-foreground">โทรศัพท์</p>
                  <p className="text-lg font-semibold text-foreground">095-585-1136</p>
                </div>
              </a>
              
              <a 
                href="https://line.me/ti/p/DF5gdjoeU0"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-3 px-8 py-4 bg-card border border-border rounded-xl hover:border-[#00B900]/50 transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-[#00B900]/10 flex items-center justify-center">
                  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="#00B900">
                    <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="text-sm text-muted-foreground">LINE</p>
                  <p className="text-lg font-semibold text-foreground">แชทกับเรา</p>
                </div>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border">
        <div className="container mx-auto px-4">
          <div className="text-center text-muted-foreground text-sm">
            © 2024 AI Sales Assistant. All rights reserved.
          </div>
        </div>
      </footer>

      {/* Chat Widget */}
      <ChatWidget position="bottom-right" />
    </div>
  );
};

export default Index;