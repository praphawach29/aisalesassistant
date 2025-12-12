import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-line-signature",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ENCRYPTION_KEY = Deno.env.get('ENCRYPTION_KEY') || '';

// ============= Decryption Utilities =============
async function getKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
  return await crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM' }, false, ['decrypt']);
}

async function decrypt(encryptedText: string): Promise<string> {
  if (!encryptedText) return '';
  try {
    const key = await getKey();
    const combined = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    return encryptedText; // Return as-is if decryption fails
  }
}

async function getDecryptedSetting(supabase: any, key: string): Promise<string | null> {
  const { data, error } = await supabase.from('settings').select('value').eq('key', key).maybeSingle();
  if (error || !data?.value) return null;
  return await decrypt(data.value);
}

// ============= Interfaces =============
interface AISettings {
  ai_name: string;
  gender: string;
  personality: string | null;
  formality_level: number;
  use_emoji: boolean;
  response_length: string;
  greeting_message: string | null;
  closing_message: string | null;
  custom_rules: string | null;
}

interface StoreSettings {
  storeName: string;
  shippingInfo: string;
  bankAccounts: string;
  paymentMethods: string;
  returnPolicy: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  promotion_price?: number;
  description?: string;
  image_url?: string;
  category?: string;
  stock: number;
  variants?: any[];
}

interface CartItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
  variants?: string;
}

interface CartAction {
  type: 'add' | 'view' | 'clear' | 'checkout' | 'remove' | 'update';
  productName?: string;
  quantity?: number;
  variants?: string;
  customerName?: string;
  customerAddress?: string;
  customerPhone?: string;
  couponCode?: string;
}

// ============= Build System Prompt (Same as Web Chat) =============
function buildSystemPrompt(
  settings: AISettings,
  productCatalog: string,
  faqList: string,
  storeSettings: StoreSettings,
  isFirstMessage: boolean
): string {
  const { ai_name, gender, personality, formality_level, use_emoji, response_length, greeting_message, closing_message, custom_rules } = settings;

  // Gender-specific particles
  let particleEnd = "ครับ/ค่ะ";
  let particleQuestion = "ครับ/คะ";
  if (gender === "female") {
    particleEnd = "ค่ะ";
    particleQuestion = "คะ";
  } else if (gender === "male") {
    particleEnd = "ครับ";
    particleQuestion = "ครับ";
  }

  // Formality descriptions
  const formalityDescriptions: Record<number, string> = {
    1: "เป็นกันเองมาก ใช้ภาษาสบายๆ พูดคุยเหมือนเพื่อน",
    2: "เป็นกันเอง สุภาพแต่ไม่เครียด พูดจาน่ารัก",
    3: "ปานกลาง สุภาพพอประมาณ เป็นมืออาชีพแต่ไม่แข็งทื่อ",
    4: "เป็นทางการ สุภาพเรียบร้อย ใช้ภาษาที่เหมาะสม",
    5: "เป็นทางการมาก ใช้ภาษาสุภาพสูง เหมาะกับลูกค้าองค์กร",
  };

  const responseLengthGuide: Record<string, string> = {
    short: "ตอบสั้นกระชับ 1-2 ประโยค ตรงประเด็น",
    medium: "ตอบปานกลาง 3-4 ประโยค ให้ข้อมูลครบถ้วน",
    long: "ตอบละเอียด 5+ ประโยค อธิบายเจาะลึก",
  };

  const emojiGuide = use_emoji 
    ? "ใช้ emoji เล็กน้อยเพื่อความเป็นกันเอง เช่น 😊 🙏 ✨ 🔥 💕" 
    : "ไม่ใช้ emoji ในการสนทนา";

  const greetingInstruction = isFirstMessage && greeting_message
    ? `## 👋 ข้อความทักทาย (ใช้ในคำตอบนี้เท่านั้น):\nเริ่มต้นด้วย: "${greeting_message}"`
    : `## 👋 หมายเหตุ:\nนี่ไม่ใช่ข้อความแรกของการสนทนา ห้ามทักทายซ้ำ ตอบคำถามโดยตรงเลย`;

  return `คุณคือ "${ai_name}" ผู้ช่วยขายอัจฉริยะที่พูดภาษาไทยได้อย่างเป็นธรรมชาติ

## 🎭 บุคลิกภาพ:
${personality || "สุภาพ เป็นมิตร พร้อมให้บริการ"}

## 🎯 บทบาทหลัก:
1. ต้อนรับและให้บริการลูกค้าด้วยความเป็นมิตร
2. แนะนำสินค้าที่เหมาะสมตามความต้องการ
3. ตอบคำถามเกี่ยวกับสินค้า ราคา โปรโมชั่น และการจัดส่ง
4. รับออเดอร์และเก็บข้อมูลลูกค้าอย่างเป็นระบบ
5. สร้างความประทับใจและกระตุ้นยอดขาย

## 📦 รายการสินค้า:
${productCatalog}

## 🏪 ข้อมูลร้านค้า:
${storeSettings.storeName ? `- ชื่อร้าน: ${storeSettings.storeName}` : ''}
${storeSettings.shippingInfo ? `- การจัดส่ง: ${storeSettings.shippingInfo}` : ''}
${storeSettings.bankAccounts ? `- บัญชีธนาคาร: ${storeSettings.bankAccounts}` : ''}
${storeSettings.paymentMethods ? `- วิธีชำระเงิน: ${storeSettings.paymentMethods}` : ''}
${storeSettings.returnPolicy ? `- นโยบายคืนสินค้า: ${storeSettings.returnPolicy}` : ''}

${faqList ? `## ❓ คำถามที่พบบ่อย:\n${faqList}` : ''}

## 💬 สไตล์การสื่อสาร:
- **ความเป็นทางการ**: ${formalityDescriptions[formality_level] || formalityDescriptions[3]}
- **คำลงท้าย**: ใช้ "${particleEnd}" และ "${particleQuestion}" อย่างสม่ำเสมอ
- **ความยาวคำตอบ**: ${responseLengthGuide[response_length] || responseLengthGuide["medium"]}
- **Emoji**: ${emojiGuide}

${greetingInstruction}

${closing_message ? `## 🙏 ข้อความขอบคุณ/ปิดท้าย:\n"${closing_message}"` : ''}

## ✍️ กฎการจัดรูปแบบข้อความ (สำคัญที่สุด - ทำให้อ่านง่าย!):

### 📐 การจัดย่อหน้า:
- **ต้องใส่บรรทัดว่าง 1 บรรทัด** ระหว่างหมวดหมู่ต่างๆ เสมอ
- แยกข้อมูลออกเป็นกลุ่มๆ อย่างชัดเจน เช่น:
  - กลุ่ม 1: ข้อมูลสินค้า/ราคา
  - กลุ่ม 2: ตัวเลือก (สี/ไซส์)
  - กลุ่ม 3: คำถามหรือ Call-to-Action
  - กลุ่ม 4: ข้อความขอบคุณ/ปิดท้าย

### 📝 ตัวอย่างรูปแบบที่ถูกต้อง (จำลองแบบนี้เสมอ):
"""
เสื้อยืดคอกลมค่ะ ราคาโปรโมชั่น ฿249 (ปกติ ฿299) ผ้าฝ้าย 100% ใส่สบาย ระบายอากาศดี 😊

มีให้เลือก 3 สี: ขาว, ดำ, เทา
มีไซส์: S, M, L, XL

สนใจสีไหน ไซส์อะไร และต้องการกี่ตัว${particleQuestion}

ขอบคุณมาก${particleEnd}ที่ไว้วางใจร้านเรานะ${particleQuestion} 🙏✨
"""

### 💰 รูปแบบสรุปออเดอร์/ยืนยัน:
"""
ขอยืนยันข้อมูลนะ${particleQuestion}:
- สินค้า: เสื้อยืดคอกลม สีดำ ไซส์ M
- จำนวน: 1 ตัว
- ราคา: ฿249

กรุณาแจ้งข้อมูลสำหรับจัดส่งด้วย${particleQuestion}:
1) ชื่อ-นามสกุล
2) ที่อยู่จัดส่ง (รวมรหัสไปรษณีย์)
3) เบอร์โทรศัพท์

ขอบคุณมาก${particleEnd}ที่ไว้วางใจร้านเรานะ${particleQuestion} 🙏✨
"""

### 🔢 การใช้ลำดับหมายเลข:
- ใช้ 1) 2) 3) สำหรับรายการขั้นตอนหรือข้อมูลที่ต้องกรอก
- ใช้ - สำหรับรายการสินค้า/รายละเอียด

### ⚠️ กฎที่ห้ามละเมิด:
- **ห้ามเขียนติดกันเป็นก้อนยาว** → ต้องแยกย่อหน้าเสมอ
- **ห้ามเขียน 5+ บรรทัดติดต่อกันโดยไม่มีช่องว่าง** → ต้องใส่บรรทัดว่างคั่น
- **เว้นวรรคหลัง emoji** → เช่น "😊 สินค้า" ไม่ใช่ "😊สินค้า"

## 🧠 กฎการจำ Context สินค้า (สำคัญที่สุด - ละเมิดไม่ได้!):
- **ต้องดูประวัติสนทนาย้อนหลังก่อนตอบเสมอ** → ดูว่าสินค้าตัวล่าสุดที่ลูกค้าพูดถึงหรือสอบถามคืออะไร
- **ขั้นตอนการระบุสินค้า**:
  1) ดูข้อความล่าสุดของลูกค้า → ถ้ามีชื่อสินค้าใช้นั้น
  2) ถ้าลูกค้าพิมพ์แค่ สี/ไซส์/จำนวน → ดูข้อความก่อนหน้าว่าคุยเรื่องสินค้าอะไรอยู่
  3) **ห้ามเดาสินค้าเอง** → ถ้าไม่แน่ใจให้ถามยืนยัน
- **ตัวอย่างที่ถูกต้อง**:
  - ลูกค้าถาม "เสื้อยืด" → AI ตอบเรื่องเสื้อยืด
  - ลูกค้าตอบ "สีดำ M 1 ตัว" → ต้องเป็น "เสื้อยืด สีดำ ไซส์ M" ห้ามเป็นสินค้าอื่น!
- **ตัวอย่างที่ผิด (ห้ามทำ)**:
  - ลูกค้าถาม "เสื้อยืด" แต่ AI ตอบเรื่อง "เสื้อเชิ้ต" ← ผิด!
  - ลูกค้าสั่ง "ดำ M 1 ตัว" หลังคุยเรื่องเสื้อยืด แต่ AI สร้างออเดอร์เสื้อเชิ้ต ← ผิดร้ายแรง!
- **ห้ามสับสนชื่อสินค้าที่คล้ายกันเด็ดขาด**:
  - "เสื้อยืด" ≠ "เสื้อเชิ้ต" (คนละสินค้ากัน)
  - "กางเกงขาสั้น" ≠ "กางเกงขายาว" (คนละสินค้ากัน)
  - "รองเท้าผ้าใบ" ≠ "รองเท้าแตะ" (คนละสินค้ากัน)
- **เมื่อไม่แน่ใจ → ถามยืนยันก่อน**: "ขอยืนยันนะ${particleQuestion} ที่ต้องการสั่งซื้อคือ [ชื่อสินค้าที่คุยกัน] ถูกต้องไหม${particleQuestion}?"

## 🎨 กฎเรื่องตัวเลือกสินค้า (สำคัญมาก!):
- **ห้ามแต่งสี ไซส์ หรือตัวเลือกเอง** → ต้องอ้างอิงจากข้อมูล "ตัวเลือก" ในรายการสินค้าเท่านั้น
- ถ้าสินค้ามี "สี: ขาว, ดำ, เทา" และลูกค้าถามว่า "มีสีแดงไหม" → ต้องตอบว่า "ขออภัย${particleEnd} สินค้านี้มีเฉพาะสีขาว ดำ และเทา${particleEnd} ไม่มีสีแดง${particleEnd}"
- **ถาม variant ก่อนสั่งซื้อเสมอ** → ถ้าสินค้ามีหลายตัวเลือก ต้องถามลูกค้าว่าต้องการสี/ไซส์อะไรก่อนดำเนินการสั่งซื้อ

## 📈 เทคนิคการขาย:
- ถามความต้องการก่อนแนะนำ เช่น "ไม่ทราบว่าสนใจสินค้าประเภทไหนเป็นพิเศษ${particleQuestion}?"
- **Upsell**: หากสนใจสินค้าราคาถูก → แนะนำรุ่นที่ดีกว่าเล็กน้อย
- **Cross-sell**: แนะนำสินค้าที่เข้าคู่กัน
- **สร้าง Urgency**: "ตอนนี้โปรโมชั่นลดราคาอยู่${particleEnd}" หรือ "สินค้าตัวนี้ขายดีมาก${particleEnd}"

## 🛍️ การแสดงสินค้า:
- ลูกค้าขอดูสินค้าทั้งหมด → ตอบแล้วใส่ [SHOW_PRODUCTS] ต่อท้าย
- ลูกค้าถามหาสินค้าเฉพาะตัว → ตอบอธิบายแล้วใส่ [PRODUCT:ชื่อสินค้าเต็ม] ต่อท้าย (ใช้ชื่อเต็มเท่านั้น เช่น [PRODUCT:เสื้อยืดคอกลม] ไม่ใช่ [PRODUCT:เสื้อยืด])
- ลูกค้าถามโปรโมชั่น/ลดราคา → ตอบสั้นๆ แล้วใส่ [SHOW_PROMOTIONS] ต่อท้าย

## 🛒 การจัดการตะกร้า:
- "เพิ่มลงตะกร้า [ชื่อสินค้า]" → [CART_ADD:ชื่อสินค้าเต็ม|จำนวน|ตัวเลือก]
- "ลบ [ชื่อสินค้า] ออกจากตะกร้า" → [CART_REMOVE:ชื่อสินค้าเต็ม]
- "เปลี่ยนจำนวน [ชื่อสินค้า] เป็น X ชิ้น" → [CART_UPDATE:ชื่อสินค้าเต็ม|จำนวนใหม่]
- "ดูตะกร้า" → [CART_VIEW]
- "ล้างตะกร้า" → [CART_CLEAR]
- "สั่งซื้อตะกร้า" พร้อมข้อมูลครบ → [CART_CHECKOUT:ชื่อ|ที่อยู่|เบอร์โทร|โค้ดคูปอง]

## 📝 การรับออเดอร์ (ถามทีละข้อ):
1. **ถามตัวเลือกก่อน** → ถ้าสินค้ามีหลายสี/ไซส์ ต้องถามว่าต้องการแบบไหน
2. ยืนยันรายการสินค้า ตัวเลือก และจำนวน
3. ถามชื่อ-นามสกุล
4. ถามที่อยู่จัดส่ง (พร้อมรหัสไปรษณีย์)
5. ถามเบอร์โทรศัพท์
6. สรุปออเดอร์และยอดรวม
7. แจ้งว่า "ขอบคุณมาก${particleEnd}! ออเดอร์ของคุณได้รับการบันทึกเรียบร้อยแล้ว ทางร้านจะติดต่อกลับเพื่อยืนยันและแจ้งเลข Tracking ${particleEnd}"

## 🚫 กฎสำคัญ:
- **ห้ามบอกจำนวนสต็อก** → ถ้าถามให้ตอบว่า "สินค้ามีพร้อมจำหน่าย${particleEnd}"
- **ห้ามตอบแค่คำสั่งโดดๆ** → ต้องมีข้อความตอบลูกค้าด้วยเสมอ
- **ห้ามแต่งข้อมูลที่ไม่มี** → ถ้าไม่รู้ให้บอกว่า "ขออภัย${particleEnd} ไม่มีข้อมูลในส่วนนี้ รบกวนติดต่อทางร้านโดยตรงนะ${particleQuestion}"
- **ห้ามแต่งสี/ไซส์ที่ไม่มี** → ใช้เฉพาะตัวเลือกที่ระบุในข้อมูลสินค้าเท่านั้น
- **ห้ามพูดเรื่องการเมือง ศาสนา** หรือเรื่องละเอียดอ่อน
- **ห้ามแกล้งทำเป็นมนุษย์** → ถ้าถามว่าเป็น AI ให้ยอมรับว่า "ใช่${particleEnd} เป็น AI ผู้ช่วยขาย${particleEnd}"

## 💬 กฎการตอบให้เป็นธรรมชาติ (สำคัญมาก!):
- **ตอบสั้นกระชับ** → ไม่เกิน 4-5 ประโยคต่อข้อความ ยกเว้นสรุปออเดอร์
- **ห้ามถามหลายอย่างพร้อมกัน** → ถามทีละเรื่อง เช่น ถามสี/ไซส์ก่อน แล้วค่อยถามข้อมูลจัดส่งทีหลัง
- **เมื่อลูกค้าทักทาย** → ตอบทักทายสั้นๆ พร้อมถามว่าสนใจอะไร เช่น "สวัสดี${particleEnd} 😊 สนใจสินค้าอะไรเป็นพิเศษ${particleQuestion}?"
- **เมื่อลูกค้าบอกสี/ไซส์/จำนวน** → ยืนยันสิ่งที่เลือกแล้วถามข้อมูลจัดส่งเท่านั้น ไม่ต้องอธิบายสินค้าซ้ำ
- **ห้ามพูดซ้ำซาก** → ไม่ต้องบอกข้อมูลสินค้าซ้ำถ้าเพิ่งบอกไป

${custom_rules ? `## ⚠️ กฎพิเศษ:\n${custom_rules.split(',').map((rule: string) => `- ${rule.trim()}`).join('\n')}` : ''}`;
}

// ============= LINE Message Builders =============
function buildProductFlexMessage(product: Product) {
  const displayPrice = product.promotion_price || product.price;
  const hasPromotion = product.promotion_price && product.promotion_price < product.price;
  const discountPercent = hasPromotion 
    ? Math.round(((product.price - product.promotion_price!) / product.price) * 100) 
    : 0;
  const isLowStock = product.stock > 0 && product.stock <= 5;
  const isOutOfStock = product.stock === 0;
  const savingsAmount = hasPromotion ? product.price - product.promotion_price! : 0;

  // Hero section with overlay badge
  const heroContents: any[] = [];
  
  // Add promotion badge overlay on image
  if (hasPromotion) {
    heroContents.push({
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: `🔥 ลด ${discountPercent}%`,
          color: "#FFFFFF",
          size: "sm",
          weight: "bold"
        }
      ],
      position: "absolute",
      backgroundColor: "#E74C3C",
      cornerRadius: "md",
      paddingAll: "xs",
      offsetTop: "10px",
      offsetStart: "10px"
    });
  }

  // Body contents
  const bodyContents: any[] = [];

  // Category tag
  if (product.category) {
    bodyContents.push({
      type: "box",
      layout: "horizontal",
      contents: [
        {
          type: "text",
          text: product.category,
          size: "xxs",
          color: "#8B5CF6",
          weight: "bold"
        }
      ],
      backgroundColor: "#F3E8FF",
      cornerRadius: "sm",
      paddingAll: "xs",
      width: "80px",
      justifyContent: "center"
    });
  }

  // Product name
  bodyContents.push({ 
    type: "text", 
    text: product.name, 
    weight: "bold", 
    size: "lg", 
    wrap: true,
    margin: "sm"
  });

  // Description with better formatting
  if (product.description) {
    bodyContents.push({ 
      type: "text", 
      text: `📝 ${product.description}`, 
      size: "sm", 
      color: "#666666", 
      wrap: true,
      maxLines: 2,
      margin: "sm"
    });
  }

  // Price section with savings info
  const priceBox: any = {
    type: "box",
    layout: "vertical",
    contents: [
      {
        type: "box",
        layout: "horizontal",
        contents: [
          { 
            type: "text", 
            text: `฿${displayPrice.toLocaleString()}`, 
            weight: "bold", 
            size: "xxl", 
            color: hasPromotion ? "#E74C3C" : "#1F2937"
          }
        ]
      }
    ],
    margin: "md"
  };

  if (hasPromotion) {
    priceBox.contents[0].contents.push({ 
      type: "text", 
      text: `฿${product.price.toLocaleString()}`, 
      size: "sm", 
      color: "#999999", 
      decoration: "line-through", 
      align: "end",
      gravity: "bottom",
      margin: "md"
    });
    // Add savings text
    priceBox.contents.push({
      type: "text",
      text: `💰 ประหยัด ฿${savingsAmount.toLocaleString()}`,
      size: "xs",
      color: "#10B981",
      weight: "bold",
      margin: "xs"
    });
  }
  bodyContents.push(priceBox);

  // Product variants (color, size, etc.)
  if (product.variants && Array.isArray(product.variants) && product.variants.length > 0) {
    const variantContents: any[] = [];
    
    for (const variant of product.variants) {
      if (variant.name && variant.options && Array.isArray(variant.options) && variant.options.length > 0) {
        variantContents.push({
          type: "box",
          layout: "horizontal",
          contents: [
            {
              type: "text",
              text: `🎨 ${variant.name}:`,
              size: "xs",
              color: "#666666",
              flex: 0
            },
            {
              type: "text",
              text: variant.options.join(", "),
              size: "xs",
              color: "#1F2937",
              weight: "bold",
              margin: "sm",
              wrap: true,
              flex: 1
            }
          ],
          margin: "xs"
        });
      }
    }
    
    if (variantContents.length > 0) {
      bodyContents.push({
        type: "box",
        layout: "vertical",
        contents: variantContents,
        margin: "md",
        backgroundColor: "#F9FAFB",
        cornerRadius: "md",
        paddingAll: "sm"
      });
    }
  }

  // Stock status
  let stockText = "";
  let stockColor = "#10B981";
  if (isOutOfStock) {
    stockText = "❌ สินค้าหมด";
    stockColor = "#EF4444";
  } else if (isLowStock) {
    stockText = `⚡ เหลือ ${product.stock} ชิ้นสุดท้าย!`;
    stockColor = "#F59E0B";
  } else {
    stockText = "✅ พร้อมจัดส่ง";
  }
  
  bodyContents.push({
    type: "text",
    text: stockText,
    size: "xs",
    color: stockColor,
    weight: "bold",
    margin: "sm"
  });

  // Build hero with image and overlay
  const hero: any = product.image_url ? {
    type: "box",
    layout: "vertical",
    contents: [
      {
        type: "image",
        url: product.image_url,
        size: "full",
        aspectRatio: "1:1",
        aspectMode: "cover"
      },
      ...heroContents
    ],
    paddingAll: "0px"
  } : undefined;

  // Footer buttons - Add to Cart, Order Now, View Details
  const footerContents: any[] = [];

  if (!isOutOfStock) {
    // Add to Cart button
    footerContents.push({
      type: "button",
      action: {
        type: "message",
        label: "🛒 เพิ่มลงตะกร้า",
        text: `เพิ่มลงตะกร้า ${product.name}`
      },
      style: "secondary",
      color: "#10B981",
      height: "sm"
    });
    
    // Order Now button
    footerContents.push({
      type: "button",
      action: {
        type: "message",
        label: "⚡ สั่งซื้อเลย",
        text: `สั่งซื้อ ${product.name}`
      },
      style: "primary",
      color: "#E74C3C",
      height: "sm",
      margin: "sm"
    });
  } else {
    // Out of stock button
    footerContents.push({
      type: "button",
      action: {
        type: "message",
        label: "สินค้าหมด",
        text: `สอบถามสินค้า ${product.name}`
      },
      style: "primary",
      color: "#9CA3AF",
      height: "sm"
    });
  }

  // View Details button
  footerContents.push({
    type: "button",
    action: {
      type: "message",
      label: "📦 ดูรายละเอียด",
      text: `ขอดูรายละเอียด ${product.name}`
    },
    style: "secondary",
    height: "sm",
    margin: "sm"
  });

  return {
    type: "bubble",
    size: "mega",
    hero: hero,
    body: {
      type: "box",
      layout: "vertical",
      contents: bodyContents,
      spacing: "none",
      paddingAll: "lg"
    },
    footer: {
      type: "box",
      layout: "vertical",
      contents: footerContents,
      spacing: "none",
      paddingAll: "lg"
    }
  };
}

function buildProductCarousel(products: Product[]) {
  const bubbles = products.slice(0, 10).map(p => buildProductFlexMessage(p));
  return {
    type: "flex",
    altText: "รายการสินค้า",
    contents: { type: "carousel", contents: bubbles }
  };
}

// ============= Cart Message Builders =============
function buildCartSummaryFlex(cartItems: CartItem[], totalAmount: number) {
  const itemContents: any[] = cartItems.map((item, index) => ({
    type: "box",
    layout: "vertical",
    contents: [
      {
        type: "box",
        layout: "horizontal",
        contents: [
          {
            type: "text",
            text: `${index + 1}. ${item.product_name}${item.variants ? ` (${item.variants})` : ''}`,
            size: "sm",
            color: "#333333",
            flex: 4,
            wrap: true
          },
          {
            type: "text",
            text: `฿${(item.price * item.quantity).toLocaleString()}`,
            size: "sm",
            color: "#E74C3C",
            flex: 2,
            align: "end",
            weight: "bold"
          }
        ]
      },
      {
        type: "box",
        layout: "horizontal",
        contents: [
          {
            type: "button",
            action: {
              type: "message",
              label: "➖",
              text: item.quantity > 1 
                ? `เปลี่ยนจำนวน ${item.product_name} เป็น ${item.quantity - 1} ชิ้น`
                : `ลบ ${item.product_name} ออกจากตะกร้า`
            },
            style: "secondary",
            height: "sm",
            flex: 1
          },
          {
            type: "text",
            text: `${item.quantity}`,
            size: "lg",
            weight: "bold",
            color: "#1F2937",
            align: "center",
            gravity: "center",
            flex: 1
          },
          {
            type: "button",
            action: {
              type: "message",
              label: "➕",
              text: `เปลี่ยนจำนวน ${item.product_name} เป็น ${item.quantity + 1} ชิ้น`
            },
            style: "secondary",
            height: "sm",
            flex: 1
          },
          {
            type: "button",
            action: {
              type: "message",
              label: "🗑️",
              text: `ลบ ${item.product_name} ออกจากตะกร้า`
            },
            style: "secondary",
            height: "sm",
            flex: 1,
            color: "#EF4444"
          }
        ],
        margin: "sm",
        spacing: "sm"
      }
    ],
    margin: "md",
    paddingBottom: "sm",
    borderWidth: "1px",
    borderColor: "#E5E7EB",
    cornerRadius: "md",
    paddingAll: "sm"
  }));

  return {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "🛒 ตะกร้าสินค้า",
          weight: "bold",
          size: "xl",
          color: "#1F2937"
        },
        {
          type: "text",
          text: `${cartItems.length} รายการ`,
          size: "sm",
          color: "#666666",
          margin: "sm"
        }
      ],
      backgroundColor: "#F3F4F6",
      paddingAll: "lg"
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        ...itemContents,
        {
          type: "separator",
          margin: "lg"
        },
        {
          type: "box",
          layout: "horizontal",
          contents: [
            {
              type: "text",
              text: "รวมทั้งหมด",
              size: "lg",
              weight: "bold",
              color: "#1F2937"
            },
            {
              type: "text",
              text: `฿${totalAmount.toLocaleString()}`,
              size: "xl",
              weight: "bold",
              color: "#E74C3C",
              align: "end"
            }
          ],
          margin: "lg"
        }
      ],
      paddingAll: "lg"
    },
    footer: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "button",
          action: {
            type: "message",
            label: "✅ สั่งซื้อตะกร้า",
            text: "สั่งซื้อตะกร้า"
          },
          style: "primary",
          color: "#10B981",
          height: "sm"
        },
        {
          type: "button",
          action: {
            type: "message",
            label: "🗑️ ล้างตะกร้า",
            text: "ล้างตะกร้า"
          },
          style: "secondary",
          height: "sm",
          margin: "sm"
        },
        {
          type: "button",
          action: {
            type: "message",
            label: "🛍️ ดูสินค้าเพิ่ม",
            text: "ดูสินค้าทั้งหมด"
          },
          style: "secondary",
          height: "sm",
          margin: "sm"
        }
      ],
      paddingAll: "lg"
    }
  };
}

interface OrderConfirmationData {
  orderNumber: string;
  totalAmount: number;
  discountAmount: number;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  items: Array<{ product_name: string; quantity: number; price: number; variants?: string }>;
  couponCode?: string;
}

function buildOrderConfirmationFlex(data: OrderConfirmationData) {
  const finalAmount = data.totalAmount - data.discountAmount;
  
  // Header section
  const headerContents: any[] = [
    {
      type: "box",
      layout: "horizontal",
      contents: [
        {
          type: "text",
          text: "✅",
          size: "xxl"
        },
        {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: "สั่งซื้อสำเร็จ!",
              weight: "bold",
              size: "xl",
              color: "#FFFFFF"
            },
            {
              type: "text",
              text: data.orderNumber,
              size: "sm",
              color: "#FFFFFF",
              margin: "xs"
            }
          ],
          margin: "md"
        }
      ]
    }
  ];

  // Order items section
  const itemContents: any[] = data.items.map((item, index) => ({
    type: "box",
    layout: "horizontal",
    contents: [
      {
        type: "text",
        text: `${item.product_name}${item.variants ? ` (${item.variants})` : ''} x${item.quantity}`,
        size: "sm",
        color: "#333333",
        flex: 3,
        wrap: true
      },
      {
        type: "text",
        text: `฿${(item.price * item.quantity).toLocaleString()}`,
        size: "sm",
        color: "#1F2937",
        flex: 1,
        align: "end",
        weight: "bold"
      }
    ],
    margin: index === 0 ? "none" : "sm"
  }));

  // Price summary section
  const priceContents: any[] = [];
  
  if (data.discountAmount > 0) {
    priceContents.push(
      {
        type: "box",
        layout: "horizontal",
        contents: [
          { type: "text", text: "ราคารวม", size: "sm", color: "#666666" },
          { type: "text", text: `฿${data.totalAmount.toLocaleString()}`, size: "sm", color: "#666666", align: "end" }
        ]
      },
      {
        type: "box",
        layout: "horizontal",
        contents: [
          { type: "text", text: `🎉 ส่วนลด${data.couponCode ? ` (${data.couponCode})` : ''}`, size: "sm", color: "#10B981" },
          { type: "text", text: `-฿${data.discountAmount.toLocaleString()}`, size: "sm", color: "#10B981", align: "end", weight: "bold" }
        ],
        margin: "sm"
      }
    );
  }

  priceContents.push({
    type: "box",
    layout: "horizontal",
    contents: [
      { type: "text", text: "💰 ยอดชำระ", size: "lg", weight: "bold", color: "#1F2937" },
      { type: "text", text: `฿${finalAmount.toLocaleString()}`, size: "xl", weight: "bold", color: "#E74C3C", align: "end" }
    ],
    margin: data.discountAmount > 0 ? "md" : "none"
  });

  // Customer info section
  const customerContents: any[] = [
    {
      type: "box",
      layout: "horizontal",
      contents: [
        { type: "text", text: "👤 ชื่อ:", size: "sm", color: "#666666", flex: 1 },
        { type: "text", text: data.customerName, size: "sm", color: "#1F2937", flex: 3, wrap: true }
      ]
    },
    {
      type: "box",
      layout: "horizontal",
      contents: [
        { type: "text", text: "📱 เบอร์:", size: "sm", color: "#666666", flex: 1 },
        { type: "text", text: data.customerPhone, size: "sm", color: "#1F2937", flex: 3 }
      ],
      margin: "sm"
    },
    {
      type: "box",
      layout: "horizontal",
      contents: [
        { type: "text", text: "📍 ที่อยู่:", size: "sm", color: "#666666", flex: 1 },
        { type: "text", text: data.customerAddress, size: "sm", color: "#1F2937", flex: 3, wrap: true }
      ],
      margin: "sm"
    }
  ];

  return {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      contents: headerContents,
      backgroundColor: "#10B981",
      paddingAll: "lg"
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        // Order items section
        {
          type: "text",
          text: "📦 รายการสินค้า",
          weight: "bold",
          size: "md",
          color: "#1F2937"
        },
        {
          type: "box",
          layout: "vertical",
          contents: itemContents,
          margin: "md",
          backgroundColor: "#F9FAFB",
          cornerRadius: "md",
          paddingAll: "md"
        },
        // Separator
        {
          type: "separator",
          margin: "lg"
        },
        // Price summary
        {
          type: "box",
          layout: "vertical",
          contents: priceContents,
          margin: "lg"
        },
        // Separator
        {
          type: "separator",
          margin: "lg"
        },
        // Customer info
        {
          type: "text",
          text: "📋 ข้อมูลจัดส่ง",
          weight: "bold",
          size: "md",
          color: "#1F2937",
          margin: "lg"
        },
        {
          type: "box",
          layout: "vertical",
          contents: customerContents,
          margin: "md",
          backgroundColor: "#F9FAFB",
          cornerRadius: "md",
          paddingAll: "md"
        }
      ],
      paddingAll: "lg"
    },
    footer: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "💳 กรุณาชำระเงินและแจ้งสลิปโอนเงิน",
          size: "sm",
          color: "#666666",
          align: "center",
          wrap: true
        },
        {
          type: "button",
          action: {
            type: "message",
            label: "📝 ดูประวัติออเดอร์",
            text: "ประวัติออเดอร์"
          },
          style: "secondary",
          height: "sm",
          margin: "md"
        }
      ],
      paddingAll: "lg",
      backgroundColor: "#F9FAFB"
    }
  };
}

// ============= Coupon Validation =============
async function validateCoupon(supabase: any, code: string, totalAmount: number): Promise<{ valid: boolean; discountAmount: number; message: string }> {
  const { data: coupon, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('code', code.toUpperCase())
    .eq('is_active', true)
    .maybeSingle();

  if (error || !coupon) {
    return { valid: false, discountAmount: 0, message: 'ไม่พบโค้ดส่วนลดนี้ค่ะ' };
  }

  const now = new Date();
  
  if (coupon.valid_from && new Date(coupon.valid_from) > now) {
    return { valid: false, discountAmount: 0, message: 'โค้ดส่วนลดยังไม่เริ่มใช้งานค่ะ' };
  }
  
  if (coupon.valid_until && new Date(coupon.valid_until) < now) {
    return { valid: false, discountAmount: 0, message: 'โค้ดส่วนลดหมดอายุแล้วค่ะ' };
  }

  if (coupon.max_uses && coupon.used_count >= coupon.max_uses) {
    return { valid: false, discountAmount: 0, message: 'โค้ดส่วนลดถูกใช้หมดแล้วค่ะ' };
  }

  if (coupon.min_order_amount && totalAmount < coupon.min_order_amount) {
    return { valid: false, discountAmount: 0, message: `ยอดขั้นต่ำ ฿${coupon.min_order_amount.toLocaleString()} ค่ะ` };
  }

  let discountAmount = 0;
  if (coupon.discount_type === 'percentage') {
    discountAmount = Math.round(totalAmount * (coupon.discount_value / 100));
  } else {
    discountAmount = coupon.discount_value;
  }

  // Update used count
  await supabase
    .from('coupons')
    .update({ used_count: coupon.used_count + 1 })
    .eq('id', coupon.id);

  return { valid: true, discountAmount, message: `ใช้โค้ด ${code} ลด ฿${discountAmount.toLocaleString()} ค่ะ` };
}

// ============= AI Response Parser =============
function parseAIResponse(content: string, products: Product[]) {
  const showProducts = content.includes('[SHOW_PRODUCTS]');
  const showPromotions = content.includes('[SHOW_PROMOTIONS]');
  const productMatch = content.match(/\[PRODUCT:([^\]]+)\]/);
  
  // Cart commands
  const cartAddMatch = content.match(/\[CART_ADD:([^\]]+)\]/);
  const cartRemoveMatch = content.match(/\[CART_REMOVE:([^\]]+)\]/);
  const cartUpdateMatch = content.match(/\[CART_UPDATE:([^\]]+)\]/);
  const cartView = content.includes('[CART_VIEW]');
  const cartClear = content.includes('[CART_CLEAR]');
  const cartCheckoutMatch = content.match(/\[CART_CHECKOUT:?([^\]]*)\]/);

  // Clean the text
  let text = content
    .replace(/\[SHOW_PRODUCTS\]/g, '')
    .replace(/\[SHOW_PROMOTIONS\]/g, '')
    .replace(/\[PRODUCT:[^\]]+\]/g, '')
    .replace(/\[CART_ADD:[^\]]+\]/g, '')
    .replace(/\[CART_REMOVE:[^\]]+\]/g, '')
    .replace(/\[CART_UPDATE:[^\]]+\]/g, '')
    .replace(/\[CART_VIEW\]/g, '')
    .replace(/\[CART_CLEAR\]/g, '')
    .replace(/\[CART_CHECKOUT:[^\]]*\]/g, '')
    .trim();

  // Find specific product - prioritize exact match, then partial match
  let specificProduct: Product | undefined;
  if (productMatch) {
    const productName = productMatch[1].trim().toLowerCase();
    
    // Priority 1: Exact match
    specificProduct = products.find(p => p.name.toLowerCase() === productName);
    
    // Priority 2: Name starts with the search term
    if (!specificProduct) {
      specificProduct = products.find(p => p.name.toLowerCase().startsWith(productName));
    }
    
    // Priority 3: Search term starts with the product name
    if (!specificProduct) {
      specificProduct = products.find(p => productName.startsWith(p.name.toLowerCase()));
    }
    
    // Priority 4: Contains match (but be more strict - require significant overlap)
    if (!specificProduct) {
      specificProduct = products.find(p => {
        const pName = p.name.toLowerCase();
        // Avoid matching "เสื้อยืด" with "เสื้อเชิ้ต" - require at least 60% overlap
        const minLength = Math.min(pName.length, productName.length);
        const overlapRatio = minLength / Math.max(pName.length, productName.length);
        return overlapRatio > 0.6 && (pName.includes(productName) || productName.includes(pName));
      });
    }
    
    console.log(`Product match: "${productMatch[1]}" -> ${specificProduct?.name || 'NOT FOUND'}`);
  }

  // Get promotion products
  const promotionProducts = products.filter(p => p.promotion_price && p.promotion_price < p.price);

  // Parse cart action
  let cartAction: CartAction | undefined;
  
  if (cartAddMatch) {
    const parts = cartAddMatch[1].split('|');
    cartAction = {
      type: 'add',
      productName: parts[0]?.trim(),
      quantity: parseInt(parts[1]) || 1,
      variants: parts[2]?.trim() || undefined
    };
  } else if (cartRemoveMatch) {
    cartAction = {
      type: 'remove',
      productName: cartRemoveMatch[1].trim()
    };
  } else if (cartUpdateMatch) {
    const parts = cartUpdateMatch[1].split('|');
    cartAction = {
      type: 'update',
      productName: parts[0]?.trim(),
      quantity: parseInt(parts[1]) || 1
    };
  } else if (cartView) {
    cartAction = { type: 'view' };
  } else if (cartClear) {
    cartAction = { type: 'clear' };
  } else if (cartCheckoutMatch) {
    const params = cartCheckoutMatch[1];
    if (params) {
      const parts = params.split('|');
      cartAction = {
        type: 'checkout',
        customerName: parts[0]?.trim(),
        customerAddress: parts[1]?.trim(),
        customerPhone: parts[2]?.trim(),
        couponCode: parts[3]?.trim() || undefined
      };
    } else {
      cartAction = { type: 'checkout' };
    }
  }

  return { text, showProducts, showPromotions, specificProduct, promotionProducts, cartAction };
}

// ============= Main Handler =============
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

  try {
    // Get LINE tokens from database
    const lineAccessToken = await getDecryptedSetting(supabase, 'LINE_CHANNEL_ACCESS_TOKEN');
    const lineChannelSecret = await getDecryptedSetting(supabase, 'LINE_CHANNEL_SECRET');

    if (!lineAccessToken || !lineChannelSecret) {
      console.error("LINE tokens not configured");
      return new Response(JSON.stringify({ error: "LINE not configured" }), { status: 500, headers: corsHeaders });
    }

    // Verify LINE signature
    const body = await req.text();
    const signature = req.headers.get("x-line-signature");
    
    if (signature) {
      const hmac = createHmac("sha256", lineChannelSecret);
      hmac.update(body);
      const expectedSignature = hmac.digest("base64");
      if (signature !== expectedSignature) {
        console.error("Invalid LINE signature");
        return new Response("Invalid signature", { status: 401, headers: corsHeaders });
      }
    }

    const webhook = JSON.parse(body);
    console.log("LINE webhook received");

    // Process each event
    for (const event of webhook.events || []) {
      // Handle text messages
      if (event.type === "message" && event.message?.type === "text") {
        const userId = event.source?.userId;
        const userMessage = event.message.text;
        const replyToken = event.replyToken;

        if (!userId || !userMessage || !replyToken) continue;

        console.log(`Message from ${userId}: ${userMessage}`);

        // Get or create conversation
        let { data: conversation } = await supabase
          .from('chat_conversations')
          .select('*')
          .eq('platform', 'line')
          .eq('platform_user_id', userId)
          .maybeSingle();

        if (!conversation) {
          const { data: newConv } = await supabase
            .from('chat_conversations')
            .insert({ platform: 'line', platform_user_id: userId })
            .select()
            .single();
          conversation = newConv;
        }

        // Check for delivery confirmation request
        const confirmKeywords = ['ได้รับแล้ว', 'รับของแล้ว', 'ได้รับสินค้าแล้ว', 'received', 'ยืนยันรับสินค้า'];
        const isConfirmRequest = confirmKeywords.some(keyword => 
          userMessage.toLowerCase().includes(keyword.toLowerCase())
        );
        const confirmOrderMatch = userMessage.match(/ORD-\d{8}-\d{4}/i);

        if (isConfirmRequest && confirmOrderMatch) {
          const orderNumber = confirmOrderMatch[0].toUpperCase();
          console.log("Delivery confirmation requested for:", orderNumber);

          // Find order and verify it belongs to this customer
          const { data: order } = await supabase
            .from("orders")
            .select("*")
            .eq("order_number", orderNumber)
            .eq("customer_line_id", userId)
            .maybeSingle();

          if (!order) {
            await fetch("https://api.line.me/v2/bot/message/reply", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${lineAccessToken}`,
              },
              body: JSON.stringify({
                replyToken,
                messages: [{ 
                  type: "text", 
                  text: `ขออภัยค่ะ ไม่พบออเดอร์หมายเลข ${orderNumber} ในระบบของคุณ 😔` 
                }]
              }),
            });
            continue;
          }

          // Check if order status is 'shipped'
          if (order.status !== 'shipped') {
            const statusMessages: Record<string, string> = {
              'pending': 'ออเดอร์นี้ยังรอดำเนินการอยู่ค่ะ ⏳',
              'confirmed': 'ออเดอร์นี้ยืนยันแล้วแต่ยังไม่จัดส่งค่ะ ✅',
              'delivered': 'ออเดอร์นี้ยืนยันรับสินค้าไปแล้วค่ะ 📦',
              'cancelled': 'ออเดอร์นี้ถูกยกเลิกไปแล้วค่ะ ❌'
            };

            await fetch("https://api.line.me/v2/bot/message/reply", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${lineAccessToken}`,
              },
              body: JSON.stringify({
                replyToken,
                messages: [{ 
                  type: "text", 
                  text: `${statusMessages[order.status] || 'ไม่สามารถยืนยันรับสินค้าได้ค่ะ'}\n\nหากมีปัญหา กรุณาติดต่อเจ้าหน้าที่ค่ะ` 
                }]
              }),
            });
            continue;
          }

          // Update order status to delivered
          const { error: updateError } = await supabase
            .from("orders")
            .update({ status: 'delivered' })
            .eq("id", order.id);

          if (updateError) {
            console.error("Error updating order:", updateError);
            await fetch("https://api.line.me/v2/bot/message/reply", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${lineAccessToken}`,
              },
              body: JSON.stringify({
                replyToken,
                messages: [{ 
                  type: "text", 
                  text: `ขออภัยค่ะ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้งค่ะ` 
                }]
              }),
            });
            continue;
          }

          const confirmMessage = `✅ ยืนยันรับสินค้าเรียบร้อยค่ะ\n━━━━━━━━━━━━━━━\n\n📋 หมายเลข: ${orderNumber}\n📦 สถานะ: ส่งสำเร็จ\n\nขอบคุณที่ไว้วางใจร้านเรานะคะ! 🙏😊\nหวังว่าจะได้รับใช้อีกนะคะ 💕`;

          await supabase.from("chat_messages").insert({
            conversation_id: conversation.id,
            role: "user",
            content: userMessage,
          });
          await supabase.from("chat_messages").insert({
            conversation_id: conversation.id,
            role: "assistant",
            content: `ยืนยันรับสินค้า ${orderNumber} สำเร็จ`,
          });

          await fetch("https://api.line.me/v2/bot/message/reply", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${lineAccessToken}`,
            },
            body: JSON.stringify({
              replyToken,
              messages: [{ type: "text", text: confirmMessage }]
            }),
          });
          continue;
        }

      // Get conversation history FIRST (before saving new message)
      // CRITICAL: Order by descending to get NEWEST messages, then reverse for AI
      const { data: rawHistoryMessages } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: false })
        .limit(20);
      
      // Reverse to get chronological order (oldest to newest) for AI
      const historyMessages = rawHistoryMessages ? [...rawHistoryMessages].reverse() : [];

      // Check if this is effectively a new session (no messages OR last message was more than 1 hour ago)
      let isNewSession = !historyMessages || historyMessages.length === 0;
      if (!isNewSession && historyMessages.length > 0) {
        const lastMessageTime = new Date(historyMessages[historyMessages.length - 1].created_at);
        const hoursSinceLastMessage = (Date.now() - lastMessageTime.getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastMessage > 1) {
          isNewSession = true;
          console.log(`New session detected: ${hoursSinceLastMessage.toFixed(1)} hours since last message`);
        }
      }

      const isFirstMessage = isNewSession;

      // Detect greeting messages (Thai and English)
      const greetingPatterns = /^(สวัสดี|หวัดดี|ดี|hello|hi|hey|hola|หวัดดีครับ|หวัดดีค่ะ|สวัสดีครับ|สวัสดีค่ะ|ดีครับ|ดีค่ะ|ดีจ้า|สวัสดีจ้า|หวัดดีจ้า)[ๆ]*[\s]*[ครับค่ะคะจ้านะ]*$/i;
      const isGreeting = greetingPatterns.test(userMessage.trim());
      
      if (isGreeting) {
        console.log("Greeting detected - will respond with greeting only");
      }

      // Detect "ขอดูรายละเอียด" button press - respond with text only (no Flex)
      const detailRequestPattern = /^ขอดูรายละเอียด\s+(.+)$/i;
      const detailMatch = userMessage.trim().match(detailRequestPattern);
      
      if (detailMatch) {
        const productName = detailMatch[1];
        console.log(`Detail request detected for: ${productName}`);
        
        // Fetch products to find the one they asked about
        const { data: products } = await supabase
          .from("products")
          .select("*")
          .eq("is_active", true);
        
        const product = products?.find(p => 
          p.name.toLowerCase() === productName.toLowerCase() ||
          p.name.toLowerCase().includes(productName.toLowerCase()) ||
          productName.toLowerCase().includes(p.name.toLowerCase())
        );
        
        if (product) {
          // Save user message
          await supabase.from('chat_messages').insert({
            conversation_id: conversation.id,
            role: 'user',
            content: userMessage
          });
          
          // Build detailed text response
          let detailText = `📦 ${product.name}\n\n`;
          
          if (product.description) {
            detailText += `📝 รายละเอียด:\n${product.description}\n\n`;
          }
          
          // Price info
          if (product.promotion_price) {
            const discountPercent = Math.round((1 - product.promotion_price / product.price) * 100);
            detailText += `💰 ราคา: ฿${product.promotion_price.toLocaleString()} (ปกติ ฿${product.price.toLocaleString()}) ลด ${discountPercent}%\n`;
          } else {
            detailText += `💰 ราคา: ฿${product.price.toLocaleString()}\n`;
          }
          
          // Category
          if (product.category) {
            detailText += `📂 หมวดหมู่: ${product.category}\n`;
          }
          
          // Variants
          if (product.variants && Array.isArray(product.variants) && product.variants.length > 0) {
            detailText += `\n🎨 ตัวเลือก:\n`;
            for (const variant of product.variants) {
              if (variant.name && variant.options && Array.isArray(variant.options)) {
                detailText += `• ${variant.name}: ${variant.options.join(', ')}\n`;
              }
            }
          }
          
          // Stock status
          if (product.stock > 0) {
            detailText += `\n✅ สินค้าพร้อมจัดส่ง\n`;
          } else {
            detailText += `\n❌ สินค้าหมดชั่วคราว\n`;
          }
          
          // Call to action
          detailText += `\n━━━━━━━━━━━━━━━━\n`;
          detailText += `สนใจสั่งซื้อไหมคะ? 😊\n`;
          detailText += `พิมพ์บอกสี/ไซส์/จำนวนที่ต้องการได้เลยค่ะ`;
          
          // Save AI response
          await supabase.from('chat_messages').insert({
            conversation_id: conversation.id,
            role: 'assistant',
            content: detailText
          });
          
          // Update conversation
          await supabase
            .from('chat_conversations')
            .update({
              last_message: detailText.substring(0, 100),
              last_message_at: new Date().toISOString()
            })
            .eq('id', conversation.id);
          
          // Send text-only reply (no Flex)
          await fetch("https://api.line.me/v2/bot/message/reply", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${lineAccessToken}`,
            },
            body: JSON.stringify({
              replyToken,
              messages: [{ type: "text", text: detailText }]
            }),
          });
          
          continue; // Skip AI processing for this message
        }
      }

      // Check for order cancellation request
      const cancelKeywords = ['ยกเลิกออเดอร์', 'ยกเลิกคำสั่งซื้อ', 'ยกเลิก', 'cancel'];
      const isCancelRequest = cancelKeywords.some(keyword => 
        userMessage.toLowerCase().includes(keyword.toLowerCase())
      );
      const cancelOrderMatch = userMessage.match(/ORD-\d{8}-\d{4}/i);

      if (isCancelRequest && cancelOrderMatch) {
        const orderNumber = cancelOrderMatch[0].toUpperCase();
        console.log("Order cancellation requested for:", orderNumber);

        // Find order and verify it belongs to this customer
        const { data: order } = await supabase
          .from("orders")
          .select("*")
          .eq("order_number", orderNumber)
          .eq("customer_line_id", userId)
          .maybeSingle();

        if (!order) {
          await supabase.from("chat_messages").insert({
            conversation_id: conversation.id,
            role: "user",
            content: userMessage,
          });
          await supabase.from("chat_messages").insert({
            conversation_id: conversation.id,
            role: "assistant",
            content: `ไม่พบออเดอร์หมายเลข ${orderNumber}`,
          });

          await fetch("https://api.line.me/v2/bot/message/reply", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${lineAccessToken}`,
            },
            body: JSON.stringify({
              replyToken,
              messages: [{ 
                type: "text", 
                text: `ขออภัยค่ะ ไม่พบออเดอร์หมายเลข ${orderNumber} ในระบบของคุณ 😔\n\nกรุณาตรวจสอบหมายเลขออเดอร์อีกครั้งค่ะ` 
              }]
            }),
          });
          continue;
        }

        // Check if order can be cancelled (only pending or confirmed)
        if (!['pending', 'confirmed'].includes(order.status)) {
          const statusMessages: Record<string, string> = {
            'shipped': 'ออเดอร์นี้จัดส่งแล้ว ไม่สามารถยกเลิกได้ค่ะ 📦',
            'delivered': 'ออเดอร์นี้ส่งถึงแล้ว ไม่สามารถยกเลิกได้ค่ะ ✅',
            'cancelled': 'ออเดอร์นี้ถูกยกเลิกไปแล้วค่ะ ❌'
          };

          await supabase.from("chat_messages").insert({
            conversation_id: conversation.id,
            role: "user",
            content: userMessage,
          });
          await supabase.from("chat_messages").insert({
            conversation_id: conversation.id,
            role: "assistant",
            content: `ไม่สามารถยกเลิกออเดอร์ ${orderNumber} ได้ (สถานะ: ${order.status})`,
          });

          await fetch("https://api.line.me/v2/bot/message/reply", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${lineAccessToken}`,
            },
            body: JSON.stringify({
              replyToken,
              messages: [{ 
                type: "text", 
                text: `ขออภัยค่ะ ${statusMessages[order.status] || 'ไม่สามารถยกเลิกออเดอร์นี้ได้ค่ะ'}\n\nหากมีปัญหา กรุณาติดต่อเจ้าหน้าที่ค่ะ` 
              }]
            }),
          });
          continue;
        }

        // Get order items to return stock
        const { data: orderItems } = await supabase
          .from("order_items")
          .select("*, products(*)")
          .eq("order_id", order.id);

        // Return stock for each item
        if (orderItems) {
          for (const item of orderItems) {
            if (item.product_id && item.products) {
              const currentStock = (item.products as any).stock || 0;
              await supabase
                .from("products")
                .update({ stock: currentStock + item.quantity })
                .eq("id", item.product_id);
              console.log(`Returned ${item.quantity} units of stock for product ${item.product_id}`);
            }
          }
        }

        // Update order status to cancelled
        const { error: updateError } = await supabase
          .from("orders")
          .update({ status: 'cancelled' })
          .eq("id", order.id);

        if (updateError) {
          console.error("Error cancelling order:", updateError);
          await fetch("https://api.line.me/v2/bot/message/reply", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${lineAccessToken}`,
            },
            body: JSON.stringify({
              replyToken,
              messages: [{ 
                type: "text", 
                text: `ขออภัยค่ะ เกิดข้อผิดพลาดในการยกเลิกออเดอร์ กรุณาลองใหม่อีกครั้งค่ะ` 
              }]
            }),
          });
          continue;
        }

        const cancelMessage = `❌ ยกเลิกออเดอร์สำเร็จ\n━━━━━━━━━━━━━━━\n\n📋 หมายเลข: ${orderNumber}\n💰 ยอดเงิน: ฿${Number(order.total_amount).toLocaleString()} (ยกเลิก)\n📦 สต็อกสินค้าได้คืนเรียบร้อยแล้ว\n\nหากต้องการสั่งซื้อใหม่ พิมพ์ "ดูสินค้า" ค่ะ 😊`;

        await supabase.from("chat_messages").insert({
          conversation_id: conversation.id,
          role: "user",
          content: userMessage,
        });
        await supabase.from("chat_messages").insert({
          conversation_id: conversation.id,
          role: "assistant",
          content: `ยกเลิกออเดอร์ ${orderNumber} สำเร็จ - คืนสต็อกเรียบร้อย`,
        });

        await supabase
          .from("chat_conversations")
          .update({
            last_message: `ยกเลิกออเดอร์ ${orderNumber}`,
            last_message_at: new Date().toISOString(),
          })
          .eq("id", conversation.id);

        await fetch("https://api.line.me/v2/bot/message/reply", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${lineAccessToken}`,
          },
          body: JSON.stringify({
            replyToken,
            messages: [{ type: "text", text: cancelMessage }]
          }),
        });
        continue;
      }

      // Save user message BEFORE calling AI
      await supabase.from('chat_messages').insert({
        conversation_id: conversation.id,
        role: 'user',
        content: userMessage
      });

      // Fetch AI settings
      const { data: aiSettingsData } = await supabase
        .from("ai_settings")
        .select("*")
        .eq("is_active", true)
        .maybeSingle();

      const aiSettings: AISettings = aiSettingsData || {
        ai_name: "น้องช้อป",
        gender: "female",
        personality: "ร่าเริง เป็นกันเอง ชอบช่วยเหลือลูกค้า",
        formality_level: 2,
        use_emoji: true,
        response_length: "medium",
        greeting_message: "สวัสดีค่ะ! 😊 ยินดีต้อนรับค่ะ",
        closing_message: null,
        custom_rules: null,
      };

      // Fetch products
      const { data: products } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true);

      const productList = products || [];
      
      // Build product catalog with variants info for AI
      const productCatalog = productList.map(p => {
        let info = `- ${p.name}: ฿${p.price}${p.promotion_price ? ` (ลด: ฿${p.promotion_price})` : ''}`;
        if (p.description) info += ` - ${p.description}`;
        
        // Include variants info
        if (p.variants && Array.isArray(p.variants) && p.variants.length > 0) {
          const variantInfo = p.variants.map((v: any) => {
            if (v.name && v.options && Array.isArray(v.options)) {
              return `${v.name}: ${v.options.join(', ')}`;
            }
            return null;
          }).filter(Boolean).join(' | ');
          if (variantInfo) info += ` [ตัวเลือก: ${variantInfo}]`;
        }
        
        return info;
      }).join('\n') || 'ยังไม่มีสินค้า';

      // Fetch FAQs
      const { data: faqs } = await supabase.from("faqs").select("*").eq("is_active", true);
      const faqList = faqs?.map(f => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n') || '';

      // Fetch store settings
      const { data: settingsData } = await supabase
        .from("settings")
        .select("key, value")
        .in("key", ["STORE_NAME", "SHIPPING_INFO", "BANK_ACCOUNTS", "PAYMENT_METHODS", "RETURN_POLICY"]);

      const settingsMap = new Map(settingsData?.map(s => [s.key, s.value]) || []);
      const storeSettings: StoreSettings = {
        storeName: settingsMap.get("STORE_NAME") || "",
        shippingInfo: settingsMap.get("SHIPPING_INFO") || "",
        bankAccounts: settingsMap.get("BANK_ACCOUNTS") || "",
        paymentMethods: settingsMap.get("PAYMENT_METHODS") || "",
        returnPolicy: settingsMap.get("RETURN_POLICY") || "",
      };

      // Build system prompt
      const systemPrompt = buildSystemPrompt(aiSettings, productCatalog, faqList, storeSettings, isFirstMessage);

      // ============= Extract Last Discussed Product from History =============
      // This is CRITICAL to avoid product confusion (e.g., เสื้อยืด vs เสื้อเชิ้ต)
      let lastDiscussedProduct: Product | null = null;
      if (historyMessages && historyMessages.length > 0) {
        // Scan history from newest to oldest to find the last product mentioned
        for (let i = historyMessages.length - 1; i >= 0; i--) {
          const msg = historyMessages[i];
          const content = msg.content.toLowerCase();
          
          // Find product matches in this message
          for (const product of productList) {
            const productNameLower = product.name.toLowerCase();
            // Check for exact product name match or [PRODUCT:name] tag
            if (content.includes(productNameLower) || 
                content.includes(`[product:${productNameLower}`) ||
                content.includes(`[product:${product.name}`)) {
              lastDiscussedProduct = product;
              break;
            }
          }
          if (lastDiscussedProduct) break;
        }
      }

      // Build messages for AI - include FULL conversation history
      // historyMessages contains previous messages, plus we add current user message
      const aiMessages: { role: string; content: string }[] = [];
      
      // If it's a new session or greeting, don't add old history (start fresh)
      if (!isNewSession && !isGreeting && historyMessages && historyMessages.length > 0) {
        for (const m of historyMessages) {
          aiMessages.push({ role: m.role, content: m.content });
        }
      }
      
      // Add context reminder about last discussed product ONLY if not greeting and not new session
      if (lastDiscussedProduct && !isGreeting && !isNewSession) {
        const contextReminder = `[CONTEXT: กำลังคุยเรื่องสินค้า "${lastDiscussedProduct.name}" - ถ้าลูกค้าบอกแค่สี/ไซส์/จำนวน ให้อ้างอิงถึงสินค้านี้เสมอ ห้ามเปลี่ยนเป็นสินค้าอื่น!]`;
        aiMessages.push({ role: "system", content: contextReminder });
        console.log(`Context reminder: Currently discussing "${lastDiscussedProduct.name}"`);
      }
      
      // For greetings, add instruction to respond naturally with just greeting
      if (isGreeting) {
        aiMessages.push({ role: "system", content: "[INSTRUCTION: ลูกค้าทักทายเข้ามา - ตอบทักทายสั้นๆ เป็นธรรมชาติ ถามว่าสนใจสินค้าอะไรหรือช่วยอะไรได้บ้าง ห้ามพูดถึงสินค้าเก่าหรือถามรายละเอียดที่อยู่/ชื่อ/เบอร์]" });
      }
      
      // Add current user message
      aiMessages.push({ role: "user", content: userMessage });
      
      console.log(`Sending ${aiMessages.length} messages to AI (including current)`);

      // Call AI
      console.log("Calling Lovable AI...");
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-5-mini",
          messages: [
            { role: "system", content: systemPrompt },
            ...aiMessages,
          ],
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error("AI error:", errorText);
        
        // Send error message to user
        await fetch("https://api.line.me/v2/bot/message/reply", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${lineAccessToken}`,
          },
          body: JSON.stringify({
            replyToken,
            messages: [{ type: "text", text: "ขออภัยค่ะ ระบบมีปัญหาชั่วคราว กรุณาลองใหม่อีกครั้งนะคะ" }]
          }),
        });
        continue;
      }

      const aiData = await aiResponse.json();
      const aiContent = aiData.choices?.[0]?.message?.content || "ขออภัยค่ะ ไม่สามารถตอบได้";

      console.log("AI response:", aiContent);

      // Parse AI response
      const { text, showProducts, showPromotions, specificProduct, promotionProducts, cartAction } = parseAIResponse(aiContent, productList);

      // Build LINE messages
      const lineMessages: any[] = [];

      // Always add text message first if there's text
      if (text) {
        lineMessages.push({ type: "text", text });
      }

      // Handle cart actions
      if (cartAction) {
        console.log("Cart action:", cartAction);

        if (cartAction.type === 'add' && cartAction.productName) {
          // Find product
          const product = productList.find(p => 
            p.name.toLowerCase().includes(cartAction.productName!.toLowerCase()) ||
            cartAction.productName!.toLowerCase().includes(p.name.toLowerCase())
          );

          if (product) {
            if (product.stock < (cartAction.quantity || 1)) {
              lineMessages.push({ type: "text", text: `ขออภัยค่ะ สินค้า "${product.name}" มีไม่เพียงพอ (เหลือ ${product.stock} ชิ้น) ค่ะ` });
            } else {
              // Check if item already in cart
              const { data: existingItem } = await supabase
                .from('shopping_carts')
                .select('*')
                .eq('platform_user_id', userId)
                .eq('product_id', product.id)
                .maybeSingle();

              const price = product.promotion_price || product.price;

              if (existingItem) {
                // Update quantity
                await supabase
                  .from('shopping_carts')
                  .update({ 
                    quantity: existingItem.quantity + (cartAction.quantity || 1),
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', existingItem.id);
              } else {
                // Insert new item
                await supabase.from('shopping_carts').insert({
                  platform_user_id: userId,
                  conversation_id: conversation.id,
                  product_id: product.id,
                  product_name: product.name,
                  quantity: cartAction.quantity || 1,
                  price: price,
                  variants: cartAction.variants || null
                });
              }

              // Get updated cart
              const { data: cartItems } = await supabase
                .from('shopping_carts')
                .select('*')
                .eq('platform_user_id', userId);

              const cartCount = cartItems?.reduce((sum, item) => sum + item.quantity, 0) || 0;
              lineMessages.push({ 
                type: "text", 
                text: `✅ เพิ่ม "${product.name}" ลงตะกร้าแล้วค่ะ! (ตะกร้ามี ${cartCount} ชิ้น)\n\nพิมพ์ "ดูตะกร้า" เพื่อดูรายการทั้งหมดค่ะ 🛒` 
              });
            }
          } else {
            lineMessages.push({ type: "text", text: `ขออภัยค่ะ ไม่พบสินค้า "${cartAction.productName}" ค่ะ` });
          }
        } else if (cartAction.type === 'remove' && cartAction.productName) {
          // Find item in cart by product name
          const { data: cartItems } = await supabase
            .from('shopping_carts')
            .select('*')
            .eq('platform_user_id', userId);

          const itemToRemove = cartItems?.find(item => 
            item.product_name.toLowerCase().includes(cartAction.productName!.toLowerCase()) ||
            cartAction.productName!.toLowerCase().includes(item.product_name.toLowerCase())
          );

          if (itemToRemove) {
            // Delete the item
            await supabase
              .from('shopping_carts')
              .delete()
              .eq('id', itemToRemove.id);

            // Get remaining cart count
            const { data: remainingItems } = await supabase
              .from('shopping_carts')
              .select('*')
              .eq('platform_user_id', userId);

            const cartCount = remainingItems?.reduce((sum, item) => sum + item.quantity, 0) || 0;
            
            if (cartCount > 0) {
              lineMessages.push({ 
                type: "text", 
                text: `🗑️ ลบ "${itemToRemove.product_name}" ออกจากตะกร้าแล้วค่ะ!\n\nตะกร้ายังมี ${cartCount} ชิ้น พิมพ์ "ดูตะกร้า" เพื่อดูรายการค่ะ 🛒` 
              });
            } else {
              lineMessages.push({ 
                type: "text", 
                text: `🗑️ ลบ "${itemToRemove.product_name}" ออกจากตะกร้าแล้วค่ะ!\n\nตะกร้าว่างเปล่าแล้ว พิมพ์ "ดูสินค้า" เพื่อเลือกสินค้าได้เลยค่ะ` 
              });
            }
          } else {
            lineMessages.push({ type: "text", text: `ไม่พบสินค้า "${cartAction.productName}" ในตะกร้าค่ะ\n\nพิมพ์ "ดูตะกร้า" เพื่อดูรายการสินค้าในตะกร้าค่ะ` });
          }
        } else if (cartAction.type === 'update' && cartAction.productName) {
          // Find item in cart by product name
          const { data: cartItems } = await supabase
            .from('shopping_carts')
            .select('*')
            .eq('platform_user_id', userId);

          const itemToUpdate = cartItems?.find(item => 
            item.product_name.toLowerCase().includes(cartAction.productName!.toLowerCase()) ||
            cartAction.productName!.toLowerCase().includes(item.product_name.toLowerCase())
          );

          if (itemToUpdate) {
            const newQuantity = cartAction.quantity || 1;
            
            // Check stock
            const product = productList.find(p => p.id === itemToUpdate.product_id);
            if (product && product.stock < newQuantity) {
              lineMessages.push({ 
                type: "text", 
                text: `ขออภัยค่ะ สินค้า "${itemToUpdate.product_name}" มีไม่เพียงพอ (เหลือ ${product.stock} ชิ้น) ค่ะ` 
              });
            } else if (newQuantity <= 0) {
              // Delete if quantity is 0 or less
              await supabase
                .from('shopping_carts')
                .delete()
                .eq('id', itemToUpdate.id);

              lineMessages.push({ 
                type: "text", 
                text: `🗑️ ลบ "${itemToUpdate.product_name}" ออกจากตะกร้าแล้วค่ะ!` 
              });
            } else {
              // Update quantity
              await supabase
                .from('shopping_carts')
                .update({ 
                  quantity: newQuantity,
                  updated_at: new Date().toISOString()
                })
                .eq('id', itemToUpdate.id);

              lineMessages.push({ 
                type: "text", 
                text: `✅ เปลี่ยนจำนวน "${itemToUpdate.product_name}" เป็น ${newQuantity} ชิ้นแล้วค่ะ!\n\nพิมพ์ "ดูตะกร้า" เพื่อดูรายการทั้งหมดค่ะ 🛒` 
              });
            }
          } else {
            lineMessages.push({ type: "text", text: `ไม่พบสินค้า "${cartAction.productName}" ในตะกร้าค่ะ\n\nพิมพ์ "ดูตะกร้า" เพื่อดูรายการสินค้าในตะกร้าค่ะ` });
          }
        } else if (cartAction.type === 'view') {
          // Get cart items
          const { data: cartItems } = await supabase
            .from('shopping_carts')
            .select('*')
            .eq('platform_user_id', userId);

          if (cartItems && cartItems.length > 0) {
            const totalAmount = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            lineMessages.push({
              type: "flex",
              altText: "ตะกร้าสินค้า",
              contents: buildCartSummaryFlex(cartItems as CartItem[], totalAmount)
            });
          } else {
            lineMessages.push({ type: "text", text: "ตะกร้าของคุณยังว่างเปล่าค่ะ 🛒\n\nพิมพ์ \"ดูสินค้า\" เพื่อเลือกสินค้าได้เลยค่ะ" });
          }
        } else if (cartAction.type === 'clear') {
          // Clear cart
          await supabase
            .from('shopping_carts')
            .delete()
            .eq('platform_user_id', userId);

          lineMessages.push({ type: "text", text: "🗑️ ล้างตะกร้าเรียบร้อยแล้วค่ะ!\n\nพิมพ์ \"ดูสินค้า\" เพื่อเลือกสินค้าใหม่ได้เลยค่ะ" });
        } else if (cartAction.type === 'checkout') {
          // Get cart items
          const { data: cartItems } = await supabase
            .from('shopping_carts')
            .select('*')
            .eq('platform_user_id', userId);

          if (!cartItems || cartItems.length === 0) {
            lineMessages.push({ type: "text", text: "ตะกร้าของคุณยังว่างเปล่าค่ะ กรุณาเพิ่มสินค้าก่อนนะคะ 🛒" });
          } else if (!cartAction.customerName || !cartAction.customerAddress || !cartAction.customerPhone) {
            // Ask for customer info
            const totalAmount = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            lineMessages.push({ 
              type: "text", 
              text: `📋 ยอดสั่งซื้อ ฿${totalAmount.toLocaleString()}\n\nกรุณาแจ้งข้อมูลจัดส่งค่ะ:\n• ชื่อ-นามสกุล\n• ที่อยู่จัดส่ง\n• เบอร์โทรศัพท์\n${cartAction.couponCode ? '' : '• โค้ดส่วนลด (ถ้ามี)'}`
            });
          } else {
            // Process checkout
            const totalAmount = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            let discountAmount = 0;

            // Validate coupon if provided
            if (cartAction.couponCode) {
              const couponResult = await validateCoupon(supabase, cartAction.couponCode, totalAmount);
              if (couponResult.valid) {
                discountAmount = couponResult.discountAmount;
              } else {
                lineMessages.push({ type: "text", text: couponResult.message });
              }
            }

            // Check stock
            let stockOk = true;
            for (const item of cartItems) {
              const product = productList.find(p => p.id === item.product_id);
              if (product && product.stock < item.quantity) {
                lineMessages.push({ 
                  type: "text", 
                  text: `ขออภัยค่ะ สินค้า "${item.product_name}" มีไม่เพียงพอ (เหลือ ${product.stock} ชิ้น) กรุณาปรับจำนวนค่ะ` 
                });
                stockOk = false;
                break;
              }
            }

            if (stockOk) {
              // Create order
              const { data: order, error: orderError } = await supabase
                .from('orders')
                .insert({
                  customer_name: cartAction.customerName,
                  customer_address: cartAction.customerAddress,
                  customer_phone: cartAction.customerPhone,
                  customer_line_id: userId,
                  platform: 'line',
                  total_amount: totalAmount,
                  discount_amount: discountAmount,
                  coupon_code: cartAction.couponCode || null,
                  status: 'pending'
                })
                .select()
                .single();

              if (orderError || !order) {
                console.error("Order creation error:", orderError);
                lineMessages.push({ type: "text", text: "ขออภัยค่ะ ไม่สามารถสร้างออเดอร์ได้ กรุณาลองใหม่ค่ะ" });
              } else {
                // Create order items
                const orderItems = cartItems.map(item => ({
                  order_id: order.id,
                  product_id: item.product_id,
                  product_name: item.product_name,
                  quantity: item.quantity,
                  price: item.price
                }));

                await supabase.from('order_items').insert(orderItems);

                // Deduct stock
                for (const item of cartItems) {
                  const product = productList.find(p => p.id === item.product_id);
                  if (product) {
                    await supabase
                      .from('products')
                      .update({ stock: product.stock - item.quantity })
                      .eq('id', product.id);
                  }
                }

                // Clear cart
                await supabase
                  .from('shopping_carts')
                  .delete()
                  .eq('platform_user_id', userId);

                // Update conversation with customer info
                await supabase
                  .from('chat_conversations')
                  .update({
                    customer_name: cartAction.customerName,
                    customer_phone: cartAction.customerPhone,
                    customer_address: cartAction.customerAddress
                  })
                  .eq('id', conversation.id);

                // Send confirmation
                lineMessages.push({
                  type: "flex",
                  altText: `สั่งซื้อสำเร็จ! ${order.order_number}`,
                  contents: buildOrderConfirmationFlex({
                    orderNumber: order.order_number,
                    totalAmount: totalAmount,
                    discountAmount: discountAmount,
                    customerName: cartAction.customerName!,
                    customerPhone: cartAction.customerPhone!,
                    customerAddress: cartAction.customerAddress!,
                    items: cartItems.map(item => ({
                      product_name: item.product_name,
                      quantity: item.quantity,
                      price: item.price,
                      variants: item.variants || undefined
                    })),
                    couponCode: cartAction.couponCode || undefined
                  })
                });
              }
            }
          }
        }
      }

      // Add product display if needed (only if no cart action handled)
      if (!cartAction) {
        if (specificProduct) {
          lineMessages.push({
            type: "flex",
            altText: specificProduct.name,
            contents: buildProductFlexMessage(specificProduct)
          });
        } else if (showPromotions && promotionProducts.length > 0) {
          // Show promotion products carousel
          lineMessages.push(buildProductCarousel(promotionProducts));
        } else if (showProducts && productList.length > 0) {
          lineMessages.push(buildProductCarousel(productList));
        }
      }

      // Ensure at least one message
      if (lineMessages.length === 0) {
        lineMessages.push({ type: "text", text: aiContent });
      }

      // Save assistant response
      await supabase.from('chat_messages').insert({
        conversation_id: conversation.id,
        role: 'assistant',
        content: text || aiContent
      });

      // Update conversation
      await supabase
        .from('chat_conversations')
        .update({
          last_message: text || aiContent,
          last_message_at: new Date().toISOString(),
          customer_name: conversation.customer_name
        })
        .eq('id', conversation.id);

      // Send reply to LINE
      console.log("Sending LINE reply...");
      const replyResponse = await fetch("https://api.line.me/v2/bot/message/reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lineAccessToken}`,
        },
        body: JSON.stringify({
          replyToken,
          messages: lineMessages.slice(0, 5) // LINE allows max 5 messages
        }),
      });

      if (!replyResponse.ok) {
        console.error("LINE reply error:", await replyResponse.text());
      } else {
        console.log("LINE reply sent successfully");
      }
      } // End of text message handling
    } // End of event loop
    
    // Handle image messages for payment slips
    for (const event of webhook.events || []) {
      if (event.type === "message" && event.message?.type === "image") {
        const userId = event.source?.userId;
        const replyToken = event.replyToken;
        const messageId = event.message.id;

        if (!userId || !replyToken || !messageId) continue;

        console.log(`Image message from ${userId}`);

        // Get conversation
        let { data: conversation } = await supabase
          .from('chat_conversations')
          .select('*')
          .eq('platform', 'line')
          .eq('platform_user_id', userId)
          .maybeSingle();

        if (!conversation) {
          const { data: newConv } = await supabase
            .from('chat_conversations')
            .insert({ platform: 'line', platform_user_id: userId })
            .select()
            .single();
          conversation = newConv;
        }

        // Download the image from LINE
        const imageResponse = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
          headers: {
            Authorization: `Bearer ${lineAccessToken}`
          }
        });

        if (!imageResponse.ok) {
          console.error("Failed to download image from LINE");
          continue;
        }

        const imageBlob = await imageResponse.blob();
        const imageBuffer = await imageBlob.arrayBuffer();
        const fileName = `${userId}_${Date.now()}.jpg`;

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('payment-slips')
          .upload(fileName, new Uint8Array(imageBuffer), {
            contentType: 'image/jpeg'
          });

        if (uploadError) {
          console.error("Upload error:", uploadError);
          await fetch("https://api.line.me/v2/bot/message/reply", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${lineAccessToken}`,
            },
            body: JSON.stringify({
              replyToken,
              messages: [{ type: "text", text: "ขออภัยค่ะ ไม่สามารถอัปโหลดรูปได้ กรุณาลองใหม่อีกครั้งค่ะ 😔" }]
            }),
          });
          continue;
        }

        // Get public URL
        const { data: publicUrlData } = supabase.storage
          .from('payment-slips')
          .getPublicUrl(fileName);

        const imageUrl = publicUrlData.publicUrl;

        // Find customer's latest pending/confirmed order
        const { data: pendingOrder } = await supabase
          .from('orders')
          .select('*')
          .eq('customer_line_id', userId)
          .in('status', ['pending', 'confirmed'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!pendingOrder) {
          await fetch("https://api.line.me/v2/bot/message/reply", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${lineAccessToken}`,
            },
            body: JSON.stringify({
              replyToken,
              messages: [{ 
                type: "text", 
                text: "ขอบคุณค่ะ! 📸\n\nขณะนี้ไม่พบออเดอร์ที่รอชำระเงินค่ะ\n\nหากต้องการสั่งซื้อสินค้า พิมพ์ \"ดูสินค้า\" ได้เลยค่ะ 😊" 
              }]
            }),
          });
          continue;
        }

        // Save payment slip
        const { data: newSlip, error: slipError } = await supabase.from('payment_slips').insert({
          order_id: pendingOrder.id,
          platform: 'line',
          platform_user_id: userId,
          image_url: imageUrl,
          status: 'pending'
        }).select().single();

        if (slipError) {
          console.error("Error saving payment slip:", slipError);
        }

        // Save to chat messages
        await supabase.from('chat_messages').insert({
          conversation_id: conversation.id,
          role: 'user',
          content: '[รูปภาพสลิปโอนเงิน]'
        });

        // Call AI to analyze the payment slip
        let autoVerified = false;
        let analysisMessage = "";
        
        if (newSlip) {
          try {
            console.log("Analyzing payment slip with AI...");
            
            const analysisResponse = await fetch(`${SUPABASE_URL}/functions/v1/analyze-payment-slip`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
              },
              body: JSON.stringify({
                image_url: imageUrl,
                expected_amount: Number(pendingOrder.total_amount),
                payment_slip_id: newSlip.id,
                order_id: pendingOrder.id
              })
            });

            if (analysisResponse.ok) {
              const analysisResult = await analysisResponse.json();
              console.log("AI Analysis result:", analysisResult);
              
              if (analysisResult.auto_verified) {
                autoVerified = true;
                analysisMessage = `\n\n🤖 AI ตรวจสอบสลิปแล้ว:\n• ยอดเงิน: ฿${analysisResult.analyzed_amount?.toLocaleString() || 'ไม่ทราบ'}\n• ธนาคาร: ${analysisResult.analyzed_bank || 'ไม่ทราบ'}\n• ความมั่นใจ: ${analysisResult.confidence_score}%\n\n✅ ยืนยันการชำระเงินอัตโนมัติแล้ว!`;
                
                // Send notification to customer about auto-confirmation
                try {
                  await supabase.functions.invoke('send-order-notification', {
                    body: {
                      order_id: pendingOrder.id,
                      notification_type: 'payment_confirmed'
                    }
                  });
                } catch (notifError) {
                  console.error("Error sending auto-confirm notification:", notifError);
                }
              } else if (analysisResult.analyzed_amount) {
                analysisMessage = `\n\n🤖 AI วิเคราะห์สลิป:\n• ยอดเงิน: ฿${analysisResult.analyzed_amount?.toLocaleString() || 'อ่านไม่ได้'}\n• ธนาคาร: ${analysisResult.analyzed_bank || 'ไม่ทราบ'}\n• ความมั่นใจ: ${analysisResult.confidence_score}%\n\nรอเจ้าหน้าที่ตรวจสอบเพิ่มเติมค่ะ`;
              }
            }
          } catch (analysisError) {
            console.error("Error calling analyze-payment-slip:", analysisError);
          }
        }

        await supabase.from('chat_messages').insert({
          conversation_id: conversation.id,
          role: 'assistant',
          content: `รับสลิปเรียบร้อย - ออเดอร์ ${pendingOrder.order_number}${autoVerified ? ' (ยืนยันอัตโนมัติ)' : ''}`
        });

        // Send confirmation
        let confirmText = "";
        if (autoVerified) {
          confirmText = `✅ รับสลิปและยืนยันการชำระเงินเรียบร้อยค่ะ!\n━━━━━━━━━━━━━━━\n\n📋 ออเดอร์: ${pendingOrder.order_number}\n💰 ยอดเงิน: ฿${Number(pendingOrder.total_amount).toLocaleString()}${analysisMessage}\n\nทางร้านจะจัดส่งสินค้าให้เร็วที่สุดค่ะ 🚚\n\nขอบคุณที่ไว้วางใจค่ะ 💕`;
        } else {
          confirmText = `✅ รับสลิปเรียบร้อยค่ะ!\n━━━━━━━━━━━━━━━\n\n📋 ออเดอร์: ${pendingOrder.order_number}\n💰 ยอดเงิน: ฿${Number(pendingOrder.total_amount).toLocaleString()}${analysisMessage}\n\nเจ้าหน้าที่จะตรวจสอบและยืนยันการชำระเงินโดยเร็วค่ะ 🙏\n\nขอบคุณที่ไว้วางใจค่ะ 💕`;
        }

        await fetch("https://api.line.me/v2/bot/message/reply", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${lineAccessToken}`,
          },
          body: JSON.stringify({
            replyToken,
            messages: [{ type: "text", text: confirmText }]
          }),
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("LINE webhook error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
