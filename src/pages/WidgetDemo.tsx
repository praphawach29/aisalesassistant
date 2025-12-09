import { ChatWidget } from '@/components/chat/ChatWidget';

export default function WidgetDemo() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-6">ตัวอย่างหน้าเว็บไซต์ของคุณ</h1>
        <p className="text-lg text-muted-foreground mb-8">
          นี่คือตัวอย่างการฝัง Chat Widget ในเว็บไซต์ ลูกค้าสามารถคลิกปุ่มมุมขวาล่างเพื่อเปิด Chatbot
        </p>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="bg-card rounded-xl p-6 border shadow-sm">
            <h2 className="text-xl font-semibold mb-3">สินค้าแนะนำ</h2>
            <p className="text-muted-foreground">
              เนื้อหาเว็บไซต์ของคุณจะแสดงที่นี่ ลูกค้าสามารถใช้ chatbot เพื่อสอบถามข้อมูลสินค้าได้ตลอดเวลา
            </p>
          </div>
          <div className="bg-card rounded-xl p-6 border shadow-sm">
            <h2 className="text-xl font-semibold mb-3">โปรโมชั่น</h2>
            <p className="text-muted-foreground">
              Chatbot จะช่วยตอบคำถามและแนะนำสินค้าให้ลูกค้าโดยอัตโนมัติ
            </p>
          </div>
        </div>

        <div className="mt-12 p-6 bg-muted/50 rounded-xl border">
          <h2 className="text-xl font-semibold mb-4">วิธีฝัง Chat Widget ในเว็บไซต์</h2>
          <p className="text-muted-foreground mb-4">
            เพิ่มโค้ดนี้ในเว็บไซต์ของคุณก่อน &lt;/body&gt;:
          </p>
          <pre className="bg-background p-4 rounded-lg border overflow-x-auto text-sm">
{`<iframe 
  src="${window.location.origin}/embed" 
  style="position:fixed;bottom:0;right:0;width:420px;height:580px;border:none;z-index:9999;"
  allow="microphone"
></iframe>`}
          </pre>
        </div>
      </div>

      {/* Chat Widget */}
      <ChatWidget position="bottom-right" />
    </div>
  );
}
