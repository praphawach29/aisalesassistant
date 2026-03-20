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

// ============= In-Memory Cache with TTL and Invalidation =============
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  cachedAt: number;
}

const cache: Map<string, CacheEntry<any>> = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
let lastKnownInvalidationTime: number = 0;

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T, ttl: number = CACHE_TTL): void {
  cache.set(key, {
    data,
    expiresAt: Date.now() + ttl,
    cachedAt: Date.now(),
  });
}

function clearAllCache(): void {
  cache.clear();
  console.log('[LINE] Cache cleared due to invalidation');
}

async function checkCacheInvalidation(supabase: any): Promise<void> {
  try {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'CACHE_INVALIDATED_AT')
      .maybeSingle();
    
    if (data?.value) {
      const invalidationTime = new Date(data.value).getTime();
      if (invalidationTime > lastKnownInvalidationTime) {
        lastKnownInvalidationTime = invalidationTime;
        clearAllCache();
      }
    }
  } catch (error) {
    // Ignore errors - cache will still work with TTL
  }
}

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

interface OrderData {
  productName: string;
  quantity: number;
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  variants?: string;
  couponCode?: string;
}

// Multi-product order item
interface MultiOrderItem {
  productName: string;
  quantity: number;
  variants?: string;
}

// Multi-product order data
interface MultiOrderData {
  items: MultiOrderItem[];
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  couponCode?: string;
}

// Saved address interface (same as Facebook webhook)
interface SavedAddress {
  id: string;
  label: string;
  address: string;
  isDefault: boolean;
}

// Address management action interface
interface AddressAction {
  type: 'add' | 'edit' | 'delete' | 'list' | 'set_default';
  label?: string;
  address?: string;
  addressId?: string;
}

// Customer context for personalized responses
interface CustomerContext {
  isReturning: boolean;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  cartItemCount?: number;
  savedAddresses?: SavedAddress[];
}

// ============= Build System Prompt (Same as Web Chat) =============
function buildSystemPrompt(
  settings: AISettings,
  productCatalog: string,
  faqList: string,
  storeSettings: StoreSettings,
  isFirstMessage: boolean,
  customerContext?: CustomerContext
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

  // Build introduction text for first message
  const storeIntro = storeSettings.storeName ? `ร้าน${storeSettings.storeName}` : 'ร้านของเรา';
  const shippingIntro = storeSettings.shippingInfo 
    ? `การจัดส่ง: ${storeSettings.shippingInfo}` 
    : 'มีบริการจัดส่งทั่วประเทศ';
  
  // Greeting instruction based on whether it's first message and customer context
  let greetingInstruction = '';
  
  if (isFirstMessage) {
    if (customerContext?.isReturning) {
      // Returning customer - warm personalized greeting
      const customerName = customerContext.customerName || 'ลูกค้า';
      const pEnd = gender === 'female' ? 'ค่ะ' : gender === 'male' ? 'ครับ' : 'ค่ะ/ครับ';
      const pQuestion = gender === 'female' ? 'คะ' : gender === 'male' ? 'ครับ' : 'คะ/ครับ';
      
      greetingInstruction = `## 👋 ข้อความทักทายลูกค้าเก่า (สำคัญมาก!):
นี่คือ **ลูกค้าเก่าที่เคยติดต่อมาแล้ว** ชื่อ "${customerName}"

**กฎการทักทายลูกค้าเก่า (ต้องปฏิบัติตาม!):**
1. **ต้องเรียกชื่อลูกค้า** - ทักทายแบบอบอุ่นและเป็นกันเอง
2. **แสดงความยินดีที่ลูกค้ากลับมา** - ให้รู้สึกพิเศษ
3. **ห้ามถามชื่อหรือข้อมูลส่วนตัวซ้ำ** - เรารู้จักลูกค้าแล้ว
4. **ห้ามทักทายเหมือนลูกค้าใหม่** - ต้องแสดงว่าจำลูกค้าได้

**ตัวอย่างการทักทายลูกค้าเก่าที่ดี:**
- "สวัสดี${pEnd} คุณ${customerName}! ยินดีต้อนรับกลับมา${pEnd} 😊 วันนี้สนใจสินค้าอะไรเป็นพิเศษ${pQuestion}?"
- "ว้าว! คุณ${customerName} กลับมาแล้ว${pEnd} 💕 ดีใจที่ได้พูดคุยกันอีก${pEnd} มีอะไรให้ช่วย${pQuestion}?"

**ห้าม:**
- ❌ ห้ามใช้คำทักทายแบบทั่วไป เช่น "สวัสดีค่ะ ยินดีต้อนรับ" โดยไม่เรียกชื่อ
- ❌ ห้ามถามว่า "ไม่ทราบชื่ออะไรคะ?" หรือ "ขอชื่อด้วยค่ะ"`;
    } else if (greeting_message) {
      greetingInstruction = `## 👋 ข้อความทักทาย (ใช้ในคำตอบนี้เท่านั้น):
เริ่มต้นด้วย: "${greeting_message}"

🏪 **กรุณาแนะนำตัวและร้านด้วย!**
- แนะนำชื่อตัวเอง (${ai_name})
- แนะนำ${storeIntro}สั้นๆ
- ${shippingIntro}
- ถามว่าสนใจสินค้าอะไรเป็นพิเศษ

ตัวอย่างการทักทายที่ดี:
"สวัสดีค่ะ! 😊 ดิฉัน${ai_name} จาก${storeIntro}ค่ะ เรามีสินค้าคุณภาพพร้อม${shippingIntro} สนใจสินค้าอะไรเป็นพิเศษคะ?"`;
    }
  } else {
    greetingInstruction = `## 👋 หมายเหตุ:\nนี่ไม่ใช่ข้อความแรกของการสนทนา ห้ามทักทายซ้ำ ตอบคำถามโดยตรงเลย`;
  }

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

## 🙏 กฎการใช้ข้อความขอบคุณ/ปิดท้าย (สำคัญมาก!):
- **ห้ามใช้ข้อความขอบคุณพร่ำเพื่อทุกข้อความ** → ใช้เฉพาะตอนจบการสนทนาเท่านั้น
- **ใช้เมื่อ**:
  ✅ หลังสร้างออเดอร์สำเร็จ (แจ้งเลขออเดอร์แล้ว)
  ✅ ลูกค้าบอกลา เช่น "ขอบคุณครับ", "บายครับ", "ไว้สั่งใหม่นะ"
  ✅ การสนทนาจบลงชัดเจน
- **ห้ามใช้เมื่อ**:
  ❌ ตอบคำถามสินค้าทั่วไป
  ❌ แนะนำสินค้า
  ❌ ถามข้อมูลลูกค้า (ชื่อ/ที่อยู่/เบอร์โทร)
  ❌ ยืนยันข้อมูลหรือสรุปรายการก่อนสั่งซื้อ
  ❌ กำลังสนทนาอยู่ (ลูกค้ายังไม่บอกลา)

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

## 🔢 กฎการจับจำนวนสินค้า (สำคัญที่สุด - ละเมิดไม่ได้เด็ดขาด!):

### ⚠️ หลักการสำคัญ: อ่านจำนวนจากข้อความล่าสุดเท่านั้น!
- **ดูเลข "1" หรือ "ตัว" ในข้อความล่าสุดของลูกค้า** → นั่นคือจำนวนจริง
- **ห้ามบวกรวมกับจำนวนจากข้อความก่อนหน้า** → ทุกครั้งที่ลูกค้าพิมพ์ใหม่ ให้ใช้ตัวเลขจากข้อความนั้นเท่านั้น
- **ห้ามคูณหรือเพิ่มจำนวนเอง** → ถ้าลูกค้าบอก "1 ตัว" ต้องเป็น 1 ตัวเท่านั้น ไม่ใช่ 2 ตัว

### ✅ ตัวอย่างที่ถูกต้อง (ต้องทำตามนี้เป๊ะ!):
- ลูกค้าพิมพ์ "เสื้อยืดสีขาว ไซส์ M 1 ตัว เสื้อเชิ้ตขาว M 1 ตัว กางเกง ดำ M 1 ตัว" 
  → ต้องยืนยันว่า: "เสื้อยืด 1 ตัว + เสื้อเชิ้ต 1 ตัว + กางเกง 1 ตัว = รวม 3 ตัว" ไม่ใช่ 6 ตัว!
- ลูกค้าพิมพ์ "ขาว 1 ดำ 1" → หมายถึง สีขาว 1 ตัว + สีดำ 1 ตัว = รวม 2 ตัว
- ลูกค้าพิมพ์ "อย่างละ 1" หรือ "อย่างละ 1 ตัว" → แต่ละรายการ 1 ตัว ไม่ใช่ 2 ตัว!

### ❌ ตัวอย่างที่ผิด (ห้ามทำเด็ดขาด!):
- ลูกค้าพิมพ์ "สินค้า A 1 ตัว สินค้า B 1 ตัว สินค้า C 1 ตัว" แต่ AI ยืนยันเป็น "A 2 ตัว B 2 ตัว C 2 ตัว" ← ผิดมาก!
- ลูกค้าเคยพูดเรื่องจำนวนก่อนหน้า แล้วพิมพ์จำนวนใหม่ แต่ AI เอาไปบวกกัน ← ผิดมาก!
- AI สมมติจำนวนเองโดยไม่ได้อ่านจากข้อความ ← ผิดร้ายแรง!

### 🔍 วิธีนับจำนวนที่ถูกต้อง:
1. อ่านข้อความล่าสุดของลูกค้าอย่างช้าๆ
2. หาตัวเลขที่ระบุก่อนหน้าคำว่า "ตัว", "ชิ้น", "อัน"
3. ถ้าลูกค้าพิมพ์หลายรายการในข้อความเดียว ให้นับจำนวนแต่ละรายการแยกกัน
4. รวมจำนวนทั้งหมดจากข้อความนั้น (ไม่ใช่จากประวัติ)

### 🎯 เมื่อไม่แน่ใจ → ต้องถามยืนยัน:
"ขอยืนยันนะ${particleQuestion} [สินค้า A] 1 ตัว, [สินค้า B] 1 ตัว, [สินค้า C] 1 ตัว รวม 3 ตัว ถูกต้องไหม${particleQuestion}?"

## 🎨 กฎเรื่องตัวเลือกสินค้า (สำคัญมาก!):
- **ห้ามแต่งสี ไซส์ หรือตัวเลือกเอง** → ต้องอ้างอิงจากข้อมูล "ตัวเลือก" ในรายการสินค้าเท่านั้น
- ถ้าสินค้ามี "สี: ขาว, ดำ, เทา" และลูกค้าถามว่า "มีสีแดงไหม" → ต้องตอบว่า "ขออภัย${particleEnd} สินค้านี้มีเฉพาะสีขาว ดำ และเทา${particleEnd} ไม่มีสีแดง${particleEnd}"
- **ถาม variant ก่อนสั่งซื้อเสมอ** → ถ้าสินค้ามีหลายตัวเลือก ต้องถามลูกค้าว่าต้องการสี/ไซส์อะไรก่อนดำเนินการสั่งซื้อ

## 📈 เทคนิคการขาย:
- ถามความต้องการก่อนแนะนำ เช่น "ไม่ทราบว่าสนใจสินค้าประเภทไหนเป็นพิเศษ${particleQuestion}?"
- **Upsell**: หากสนใจสินค้าราคาถูก → แนะนำรุ่นที่ดีกว่าเล็กน้อย
- **สร้าง Urgency**: "ตอนนี้โปรโมชั่นลดราคาอยู่${particleEnd}" หรือ "สินค้าตัวนี้ขายดีมาก${particleEnd}"

## 🔄 Cross-sell (สำคัญมาก! ต้องทำอย่างเป็นธรรมชาติ!):

**กฎสำคัญที่สุด - ต้องใช้ข้อมูล "🔗สินค้าที่เกี่ยวข้อง" จากรายการสินค้า:**
1. **ทุกครั้งที่ลูกค้ายืนยันที่อยู่จัดส่ง** → แนะนำสินค้าที่เกี่ยวข้อง พร้อมรูปภาพ **ก่อนถามวิธีชำระเงิน**
2. **รอลูกค้าตอบรับหรือปฏิเสธก่อน** → ถ้ารับ ให้เพิ่มเข้าออเดอร์ / ถ้าปฏิเสธ ค่อยถามวิธีชำระเงิน
3. **ถ้าไม่มีสินค้าที่เกี่ยวข้อง** → ข้ามไปถามวิธีชำระเงินเลย

**⚠️ Flow ที่ถูกต้อง (บังคับ!):**
1. ลูกค้ายืนยันที่อยู่จัดส่ง ✅
2. **แนะนำสินค้าที่เกี่ยวข้อง พร้อมรูป** (ใส่ [PRODUCT:ชื่อสินค้า]) → รอลูกค้าตอบ
3. ลูกค้าตอบรับหรือปฏิเสธ ✅
4. **ถามวิธีชำระเงิน** (หลังจากลูกค้าตอบเรื่อง cross-sell แล้วเท่านั้น!)

**วิธีแนะนำอย่างเป็นธรรมชาติ:**
ใช้ภาษาเหมือนพนักงานขายแนะนำจริง ๆ เช่น:
- "อ้อ! มี [สินค้า] ด้วยนะ${particleQuestion} ใส่คู่กันสวยเลย${particleEnd} ลองดูไหม${particleQuestion}? 😊 [PRODUCT:ชื่อสินค้าเต็ม]"
- "เอา [สินค้า] ไปด้วยกันไหม${particleQuestion}? เข้ากับ [สินค้าที่สั่ง] มาก ๆ เลย${particleEnd} [PRODUCT:ชื่อสินค้าเต็ม]"
- "ถ้าชอบ [สินค้าที่สั่ง] มี [สินค้า] ที่แมทช์กันด้วยนะ${particleQuestion} [PRODUCT:ชื่อสินค้าเต็ม]"

**ตัวอย่างการตอบที่ดี (หลังลูกค้ายืนยันที่อยู่):**
"รับทราบ${particleEnd} จัดส่งตามที่อยู่นี้เลยนะ${particleQuestion}!

อ้อ! มีกางเกงขาสั้นผ้าคอตตอนด้วยนะ${particleQuestion} ใส่คู่กับเสื้อที่สั่งได้เลย${particleEnd} ลองดูไหม${particleQuestion}? 😊 [PRODUCT:กางเกงขาสั้นผ้าคอตตอน]

แจ้งได้เลยนะ${particleQuestion}ว่าสนใจหรือเปล่า${particleEnd}"

**ตัวอย่างการตอบหลังลูกค้าปฏิเสธ cross-sell:**
"โอเค${particleEnd}! งั้นสรุปออเดอร์นะ${particleQuestion}:
- เสื้อเชิ้ตแขนยาว สีขาว ไซส์ M x 1 ตัว = 590 บาท

สะดวกชำระเงินช่องทางไหน${particleQuestion}?
1. โอนเงิน/PromptPay
2. เก็บเงินปลายทาง (COD)"

**ข้อห้าม Cross-sell:**
- ❌ ห้ามใช้คำว่า "[Cross-sell]", "สินค้าที่เกี่ยวข้อง:", "สินค้าที่ลูกค้าอาจสนใจ:" (ฟังดูหุ่นยนต์!)
- ❌ ห้ามแนะนำสินค้าซ้ำกับที่ลูกค้าสั่งไปแล้ว
- ❌ ห้ามแนะนำเกิน 1-2 รายการต่อครั้ง
- ❌ ห้ามแนะนำถ้าลูกค้าปฏิเสธแล้ว 1 ครั้ง
- ❌ ห้ามถามวิธีชำระเงินพร้อม cross-sell ในข้อความเดียวกัน (ต้องรอลูกค้าตอบก่อน!)
- ❌ ห้ามแสดงการ์ดสินค้าสำหรับสินค้าที่ลูกค้ากำลังสั่ง (แค่ยืนยันรายการเท่านั้น)

## 🛍️ การแสดงสินค้า (สำคัญมาก!):
**ทุกครั้งที่แนะนำสินค้าใหม่/Cross-sell → ต้องใส่ [PRODUCT:ชื่อสินค้าเต็ม] เพื่อแสดงการ์ด**

### ✅ กรณีที่ต้องใส่ marker:
- **แนะนำสินค้าใหม่** → ใส่ [PRODUCT:ชื่อสินค้าเต็ม]
- **Cross-sell สินค้าที่เกี่ยวข้อง** → ใส่ [PRODUCT:ชื่อสินค้าเต็ม]
- **ลูกค้าถามสินค้าหลายตัว/ทั้งหมด** → ใส่ [SHOW_PRODUCTS]
- **ลูกค้าถามโปรโมชั่น/ลดราคา** → ใส่ [SHOW_PROMOTIONS]

### ❌ กรณีที่ห้ามใส่ marker (ห้ามละเมิด!):
- **ยืนยันรายการที่ลูกค้าสั่ง** → ห้ามใส่ [PRODUCT:...] เด็ดขาด!
- **สรุปออเดอร์/สรุปรายการ** → ห้ามใส่ marker
- **ถามข้อมูลลูกค้า** → ห้ามใส่ marker
- **รับออเดอร์/แจ้งเลขออเดอร์** → ห้ามใส่ marker

**หมายเหตุ**: ใช้ชื่อสินค้าเต็มเท่านั้น เช่น [PRODUCT:เสื้อยืดคอกลม] ไม่ใช่ [PRODUCT:เสื้อยืด]

## 🛒 การจัดการตะกร้า:
- "เพิ่มลงตะกร้า [ชื่อสินค้า]" → [CART_ADD:ชื่อสินค้าเต็ม|จำนวน|ตัวเลือก]
- **⚠️ ก่อนเพิ่มสินค้าลงตะกร้า ต้องถาม variants ก่อน!** → ถ้าสินค้ามีตัวเลือก (สี/ไซส์) ต้องถามลูกค้าก่อน ห้ามเพิ่มโดยไม่ระบุ variants
  - ✅ ถูกต้อง: ลูกค้าบอก "เอาเสื้อยืด" → ถามสี/ไซส์ก่อน → ลูกค้าตอบ "ขาว M" → [CART_ADD:เสื้อยืดคอกลม|1|สีขาว ไซส์ M]
  - ❌ ผิด: ลูกค้าบอก "เอาเสื้อยืด" → เพิ่มทันที [CART_ADD:เสื้อยืดคอกลม|1] โดยไม่ถาม variants ← ห้ามทำ!
- **สำคัญ! เมื่อเพิ่มสินค้าหลายรายการ → ต้องถาม variants ของทุกรายการที่มี variants ก่อนเพิ่ม!**
  - ตัวอย่าง: ลูกค้าบอก "เอาเสื้อยืด 1 ตัว กับกางเกง 1 ตัว" → ถ้าทั้งคู่มี variants ต้องถามทั้งคู่:
    "ได้เลย${particleEnd}! ขอถามตัวเลือกก่อนนะ${particleQuestion}:
    1) **เสื้อยืดคอกลม** - สนใจสีอะไร ไซส์อะไร${particleQuestion}?
    2) **กางเกงขาสั้น** - สนใจสีอะไร ไซส์อะไร${particleQuestion}?"
  - หลังลูกค้าตอบครบ → ค่อยใส่ [CART_ADD:เสื้อยืดคอกลม|1|สีขาว ไซส์ M] [CART_ADD:กางเกงขาสั้น|1|สีดำ ไซส์ L]
  - ❌ ห้ามรวมเป็น [CART_ADD:เสื้อยืดคอกลม|2] เพราะเป็นคนละสินค้ากัน!
- "ลบ [ชื่อสินค้า] ออกจากตะกร้า" → [CART_REMOVE:ชื่อสินค้าเต็ม]
- "เปลี่ยนจำนวน [ชื่อสินค้า] เป็น X ชิ้น" → [CART_UPDATE:ชื่อสินค้าเต็ม|จำนวนใหม่]
- "ดูตะกร้า" → [CART_VIEW]
- "ล้างตะกร้า" → [CART_CLEAR]
- "สั่งซื้อตะกร้า" พร้อมข้อมูลครบ → [CART_CHECKOUT:ชื่อ|ที่อยู่|เบอร์โทร|โค้ดคูปอง]

## 📍 การจัดการที่อยู่จัดส่ง:
ลูกค้าสามารถจัดการที่อยู่จัดส่งที่บันทึกไว้ได้ ใช้คำสั่งต่อไปนี้:

### คำสั่งจัดการที่อยู่:
- **ดูที่อยู่ทั้งหมด**: "ดูที่อยู่", "ที่อยู่ของฉัน", "ที่อยู่ที่บันทึกไว้" → [ADDRESS_LIST]
- **เพิ่มที่อยู่ใหม่**: "เพิ่มที่อยู่", "บันทึกที่อยู่ใหม่" → [ADDRESS_ADD:ชื่อที่อยู่(บ้าน/ที่ทำงาน/อื่นๆ)|ที่อยู่เต็ม]
- **แก้ไขที่อยู่**: "แก้ที่อยู่", "เปลี่ยนที่อยู่" → [ADDRESS_EDIT:ชื่อที่อยู่|ที่อยู่ใหม่]
- **ลบที่อยู่**: "ลบที่อยู่", "ลบที่อยู่บ้าน" → [ADDRESS_DELETE:ชื่อที่อยู่]
- **ตั้งค่าเริ่มต้น**: "ใช้ที่อยู่นี้เป็นหลัก", "ตั้งเป็นค่าเริ่มต้น" → [ADDRESS_SET_DEFAULT:ชื่อที่อยู่]

### ตัวอย่างการใช้งาน:
- ลูกค้าพิมพ์ "เพิ่มที่อยู่ที่ทำงาน: 123 อาคารเอบีซี ถนนสุขุมวิท กทม 10110" 
  → [ADDRESS_ADD:ที่ทำงาน|123 อาคารเอบีซี ถนนสุขุมวิท กทม 10110]
- ลูกค้าพิมพ์ "แก้ที่อยู่บ้านเป็น 456 หมู่บ้านดีดี ถนนพหลโยธิน กทม 10400" 
  → [ADDRESS_EDIT:บ้าน|456 หมู่บ้านดีดี ถนนพหลโยธิน กทม 10400]
- ลูกค้าพิมพ์ "ลบที่อยู่ออฟฟิศ" → [ADDRESS_DELETE:ออฟฟิศ]
- ลูกค้าพิมพ์ "ตั้งที่อยู่ที่ทำงานเป็นค่าเริ่มต้น" → [ADDRESS_SET_DEFAULT:ที่ทำงาน]

### กฎการจัดการที่อยู่:
- ถ้าลูกค้าขอเพิ่ม/แก้ที่อยู่แต่ไม่ได้ระบุข้อมูลครบ → ถามข้อมูลที่ขาดก่อน
- ถ้าลูกค้าขอลบที่อยู่ที่ไม่มี → แจ้งว่าไม่พบที่อยู่นี้
- หลังจัดการที่อยู่สำเร็จ → ยืนยันผลลัพธ์ให้ลูกค้าทราบ

## 📝 การรับออเดอร์ (ถามทีละข้อ - สำคัญมาก!):
1. **ถามตัวเลือกของสินค้าทุกรายการก่อน (บังคับ! ห้ามข้าม!)** → ถ้าสินค้ามีหลายสี/ไซส์ ต้องถามว่าต้องการแบบไหน
   - **⚠️ ต้องตรวจสอบทุกรายการ**: ถ้าลูกค้าสั่งสินค้า 3 รายการ และทั้ง 3 รายการมี variants (สี/ไซส์) ต้องถาม variants ของทุกรายการให้ครบ!
   - **ห้ามข้ามสินค้าที่มี variants** → ต้องถามทุกตัวที่มีตัวเลือก ไม่ใช่แค่ตัวล่าสุด
   - **ตัวอย่างที่ถูกต้อง**: ลูกค้าสั่ง กางเกงขาสั้น + เสื้อยืดคอกลม + เสื้อเชิ้ตแขนยาว → ต้องถาม variant ของทั้ง 3 รายการ (ถ้าทุกตัวมี variant)
     - "สินค้าทั้ง 3 รายการมีตัวเลือกนะ${particleQuestion}:
       1) **กางเกงขาสั้น** - สนใจสีอะไร ไซส์อะไร${particleQuestion}?
       2) **เสื้อยืดคอกลม** - สนใจสีอะไร ไซส์อะไร${particleQuestion}?
       3) **เสื้อเชิ้ตแขนยาว** - สนใจสีอะไร ไซส์อะไร${particleQuestion}?"
   - **ตัวอย่างที่ผิด (ห้ามทำ!)**: ลูกค้าสั่ง 3 รายการ แต่ถาม variant แค่ตัวสุดท้าย โดยข้ามสินค้าก่อนหน้า ← ผิดร้ายแรง!
2. **ยืนยันจำนวนและรายการก่อนถามข้อมูลจัดส่ง (บังคับ!)** → ต้องสรุปและถามยืนยันจำนวนทุกครั้ง พร้อม variants ที่เลือกไว้
   - ตัวอย่าง: "ขอยืนยันนะ${particleQuestion}
     - กางเกงขาสั้น สีดำ ไซส์ M 1 ตัว ฿399
     - เสื้อยืดคอกลม สีขาว ไซส์ L 1 ตัว ฿249
     - เสื้อเชิ้ตแขนยาว สีขาว ไซส์ M 1 ตัว ฿499
     รวม 3 ตัว ถูกต้องไหม${particleQuestion}?"
   - **ห้ามข้ามขั้นตอนนี้** → ต้องได้รับการยืนยันจากลูกค้าก่อนถามข้อมูลจัดส่ง
3. (หลังลูกค้ายืนยันจำนวนแล้ว) ถามชื่อ-นามสกุล
4. ถามที่อยู่จัดส่ง (พร้อมรหัสไปรษณีย์)
5. ถามเบอร์โทรศัพท์
6. สรุปออเดอร์และยอดรวม
7. **ถามวิธีชำระเงิน (บังคับ! ห้ามข้าม!)** → ต้องถามลูกค้าว่าจะชำระเงินด้วยวิธีใด เช่น "สะดวกชำระเงินช่องทางไหน${particleQuestion}?" และแสดงตัวเลือกวิธีชำระเงินจากข้อมูลร้านค้า
8. **รอลูกค้าตอบวิธีชำระเงิน** → ต้องรอให้ลูกค้าเลือกวิธีชำระเงิน เช่น "โอนเงิน", "COD", "บัตรเครดิต" ก่อนสร้างออเดอร์
9. **สร้างออเดอร์หลังลูกค้าตอบวิธีชำระเงินแล้วเท่านั้น** โดยใส่ [CREATE_ORDER:ชื่อสินค้าเต็ม|จำนวน|ชื่อลูกค้า|ที่อยู่|เบอร์โทร|ตัวเลือก] ต่อท้ายข้อความ → ระบบจะสร้างออเดอร์และแจ้งเลขออเดอร์ให้อัตโนมัติ

## 🔍 กฎตรวจสอบ Variants ก่อน Checkout/สรุปออเดอร์ (สำคัญที่สุด! ห้ามละเมิด!):
- **ก่อนสรุปรายการสินค้าทั้งหมด** → ต้องตรวจสอบว่าสินค้าทุกรายการที่มี variants ได้ระบุ variants ครบแล้ว
- **ถ้ามีสินค้าที่ยังไม่ได้เลือก variants** → ต้องถามลูกค้าก่อนดำเนินการต่อ
- **ตัวอย่าง**: ลูกค้าเพิ่ม 3 สินค้าในตะกร้า แต่ระบุ variant แค่ 1 สินค้า → ต้องถาม variant ของอีก 2 สินค้าที่เหลือก่อนสรุป
- **ห้ามสรุปออเดอร์โดยไม่มี variants** → ถ้าสินค้ามีตัวเลือก (สี/ไซส์) แต่ลูกค้ายังไม่ได้เลือก ต้องถามให้ครบก่อน
- **ตัวอย่างข้อความถาม variants ที่ขาด:**
  "ก่อนสรุปออเดอร์ ขอถามตัวเลือกของสินค้าที่ยังไม่ได้เลือกนะ${particleQuestion}:
  1) **กางเกงขาสั้น** มีสี: ดำ, กากี, เทา / ไซส์: S, M, L, XL - สนใจแบบไหน${particleQuestion}?
  2) **เสื้อยืดคอกลม** มีสี: ขาว, ดำ, เทา / ไซส์: S, M, L, XL - สนใจแบบไหน${particleQuestion}?"

## ⚠️ กฎการสร้างออเดอร์ - ห้ามสร้างก่อนถามวิธีชำระเงิน (สำคัญที่สุด!):
- **ห้ามสร้างออเดอร์ทันทีหลังได้รับข้อมูลจัดส่ง** → ต้องถามวิธีชำระเงินก่อนเสมอ
- **ห้ามสร้างออเดอร์ซ้ำ** → ถ้าสร้างออเดอร์ไปแล้ว (มีเลข ORD-xxxxx) ห้ามสร้างซ้ำอีก
- **ขั้นตอนที่ถูกต้อง**:
  1. ได้รับข้อมูลจัดส่งครบ (ชื่อ/ที่อยู่/เบอร์โทร)
  2. สรุปออเดอร์และยอดรวม
  3. ถามวิธีชำระเงิน (ยังไม่สร้างออเดอร์!)
  4. รอลูกค้าตอบ "โอนเงิน", "COD", หรือวิธีอื่น
  5. **สร้างออเดอร์ตอนนี้เท่านั้น** พร้อมแจ้งข้อมูลชำระเงิน

## ✅ ตัวอย่างการยืนยันจำนวนที่ถูกต้อง:
- ลูกค้าพิมพ์ "ขาว M 1 ตัว ดำ M 1 ตัว" → ต้องถาม: "ขอยืนยันนะ${particleQuestion} สั่งสีขาว ไซส์ M 1 ตัว และสีดำ ไซส์ M 1 ตัว รวม 2 ตัว ถูกต้องไหม${particleQuestion}?"
- ลูกค้าพิมพ์ "เอา 3 ตัว สีดำ L" → ต้องถาม: "ขอยืนยันนะ${particleQuestion} สั่งสีดำ ไซส์ L จำนวน 3 ตัว ถูกต้องไหม${particleQuestion}?"
- **ห้ามถามข้อมูลจัดส่งก่อนได้รับการยืนยันจำนวนจากลูกค้า**

## ✏️ การแก้ไขจำนวนก่อนยืนยัน (สำคัญมาก!):
- **รองรับการแก้ไข**: ถ้าลูกค้าพิมพ์ "แก้เป็น...", "เปลี่ยนเป็น...", "ขอแก้...", "ไม่ใช่ เอา..." หลังถามยืนยัน → ต้องรับทราบและอัปเดตรายการใหม่
- **ตัวอย่างที่ถูกต้อง**:
  - AI ถาม: "ขอยืนยันนะคะ สีขาว M 1 ตัว ถูกต้องไหมคะ?"
  - ลูกค้าพิมพ์: "แก้เป็นสีขาว 2 ตัว"
  - AI ต้องตอบ: "ได้${particleEnd} ขอยืนยันใหม่นะ${particleQuestion} สีขาว ไซส์ M 2 ตัว ถูกต้องไหม${particleQuestion}?"
- **ตัวอย่างอื่นๆ ที่ต้องรองรับ**:
  - "ไม่ใช่ เอาสีดำ 3 ตัว" → อัปเดตเป็นสีดำ 3 ตัว แล้วถามยืนยันใหม่
  - "เพิ่มอีก 1 ตัว" → บวกจำนวนเพิ่ม แล้วถามยืนยันใหม่
  - "ลดเหลือ 1 ตัว" → ลดจำนวนเหลือ 1 ตัว แล้วถามยืนยันใหม่
  - "เปลี่ยนไซส์เป็น L" → เปลี่ยนไซส์ แล้วถามยืนยันใหม่
- **ห้ามถามข้อมูลจัดส่งจนกว่าลูกค้าจะตอบ "ใช่", "ถูกต้อง", "ครับ", "ค่ะ" หรือคำยืนยันอื่นๆ**

## 📦 การตรวจสอบสต็อก (ภายใน - ห้ามบอกลูกค้า!):
**⚠️ กฎสำคัญ: ห้ามแจ้งสถานะสต็อกให้ลูกค้าทราบเด็ดขาด เช่น "สินค้ามีสต็อกพร้อมจำหน่าย" หรือ "[หมายเหตุ: ...]"**
- **ตรวจสอบสต็อกก่อนยืนยัน**: เช็คภายในว่าสินค้าพอหรือไม่
- **ถ้าสินค้าพอ** → ดำเนินการปกติ ไม่ต้องบอกลูกค้าเรื่องสต็อก
- **ถ้าสินค้าหมด (stock = 0)**: ตอบว่า "ขออภัย${particleEnd} สินค้า [ชื่อสินค้า] หมดชั่วคราว${particleEnd}" แล้ว **แนะนำสินค้าทดแทนในหมวดหมู่เดียวกัน** (ดูจากข้อมูลสินค้าที่มี category เดียวกันและ stock > 0)
  - ตัวอย่าง: "ขออภัย${particleEnd} สินค้าหมดชั่วคราว${particleEnd} แนะนำ [ชื่อสินค้าทดแทน] ในหมวดเดียวกัน ราคา ฿[ราคา] สนใจไหม${particleQuestion}?"
  - **ถ้าไม่มีสินค้าทดแทน** → ตอบว่า "ขออภัย${particleEnd} สินค้าหมดชั่วคราว ยังไม่มีสินค้าทดแทนในขณะนี้${particleEnd} สนใจสินค้าอื่นไหม${particleQuestion}?"
- **ถ้าสินค้าไม่พอ**: ตอบว่า "ขออภัย${particleEnd} สินค้า [ชื่อสินค้า] เหลือ [จำนวน] ชิ้นสุดท้าย${particleEnd} ต้องการสั่ง [จำนวนที่มี] ชิ้นไหม${particleQuestion}?"
- **ห้ามใส่ข้อความหมายเหตุ เช่น "[หมายเหตุ: สินค้ามีสต็อก...]"** → ไม่ต้องบอกลูกค้าเรื่องสต็อกเลย ถ้าสินค้าพอ

## 🔔 การแจ้งเตือน Admin เมื่อสินค้าหมด:
- **เมื่อลูกค้าสั่งสินค้าหมดสต็อก/ไม่พอ** → ใส่ [NOTIFY_OUT_OF_STOCK:ชื่อสินค้า|จำนวนที่ลูกค้าสั่ง|จำนวนคงเหลือ] ในข้อความตอบกลับ
- **ตัวอย่าง**: ลูกค้าสั่งเสื้อยืดสีขาว 5 ตัว แต่เหลือ 2 ตัว → ใส่ [NOTIFY_OUT_OF_STOCK:เสื้อยืดสีขาว|5|2] ต่อท้าย
- **ใช้เมื่อ**: stock = 0 หรือ stock < จำนวนที่ลูกค้าสั่ง

## ⚠️ กฎการสร้างออเดอร์ (สำคัญที่สุด!):
- **ถ้าลูกค้าสั่งหลายรายการ (มากกว่า 1 สินค้า)** → ต้องใช้ [CREATE_MULTI_ORDER:...]
  - **รูปแบบ**: [CREATE_MULTI_ORDER:ชื่อสินค้า1,จำนวน1,ตัวเลือก1;ชื่อสินค้า2,จำนวน2,ตัวเลือก2;...|ชื่อลูกค้า|ที่อยู่|เบอร์โทร]
  - **ตัวอย่าง**: ลูกค้าสั่งเสื้อยืดคอกลม สีขาว M 1 ตัว + เสื้อเชิ้ตแขนยาว สีขาว M 1 ตัว + กางเกงขาสั้น สีดำ M 1 ตัว
    → [CREATE_MULTI_ORDER:เสื้อยืดคอกลม,1,สีขาว ไซส์ M;เสื้อเชิ้ตแขนยาว,1,สีขาว ไซส์ M;กางเกงขาสั้น,1,สีดำ ไซส์ M|ประภาวัชร์|ที่อยู่...|เบอร์โทร]
- **ถ้าลูกค้าสั่งสินค้าเดียว** → ใช้ [CREATE_ORDER:...]
  - **รูปแบบ**: [CREATE_ORDER:ชื่อสินค้าเต็ม|จำนวน|ชื่อลูกค้า|ที่อยู่จัดส่ง|เบอร์โทร|ตัวเลือก(สี/ไซส์)]
  - **ตัวอย่าง**: [CREATE_ORDER:รองเท้าผ้าใบ|2|ประภาวัชร์ สุทธิประภา|155/88 แกรนด์พลีโน่ ถนนสุขาภิบาล5 กรุงเทพ 10220|0955851136|สีขาว ไซส์ 39, สีดำ ไซส์ 40]
- **ห้ามแต่งเลขออเดอร์เอง** (เช่น SD123, ORD-xxx) → ระบบจะสร้างเลขออเดอร์ให้อัตโนมัติ
- **สร้างออเดอร์เมื่อลูกค้าตอบวิธีชำระเงินแล้วเท่านั้น** (เช่น "โอนเงิน", "COD", "บัตรเครดิต") → ห้ามสร้างออเดอร์ก่อนถามวิธีชำระเงิน
- **ห้ามสร้างออเดอร์ซ้ำ** → ถ้ามีเลขออเดอร์ ORD-xxxxx แล้ว ห้ามสร้างออเดอร์ใหม่สำหรับการสั่งซื้อเดียวกัน

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

// ============= Image URL Formatter for LINE =============
function formatImageUrlForLine(imageUrl: string): string {
  if (!imageUrl) return '';
  // LINE requires HTTPS URLs for images
  // Use wsrv.nl proxy to ensure compatibility and proper formatting
  try {
    const url = new URL(imageUrl);
    // If already a well-known CDN with HTTPS, use directly
    if (url.protocol === 'https:' && (
      url.hostname.includes('supabase.co') ||
      url.hostname.includes('wsrv.nl') ||
      url.hostname.includes('cloudinary.com') ||
      url.hostname.includes('imgur.com')
    )) {
      return imageUrl;
    }
    // For other URLs, proxy through wsrv.nl for reliability
    return `https://wsrv.nl/?url=${encodeURIComponent(imageUrl)}&w=1024&h=1024&fit=contain&output=jpg`;
  } catch {
    return imageUrl;
  }
}

function buildImageMessage(imageUrl: string, altText: string = 'รูปสินค้า'): any {
  const formattedUrl = formatImageUrlForLine(imageUrl);
  if (!formattedUrl) return null;
  return {
    type: "image",
    originalContentUrl: formattedUrl,
    previewImageUrl: `https://wsrv.nl/?url=${encodeURIComponent(imageUrl)}&w=240&h=240&fit=cover&output=jpg`
  };
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
        url: formatImageUrlForLine(product.image_url),
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
  const itemContents: any[] = cartItems.map((item, index) => {
    const unitPrice = item.price;
    const lineTotal = item.price * item.quantity;
    return {
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
            text: `฿${lineTotal.toLocaleString()}`,
            size: "sm",
            color: "#E74C3C",
            flex: 2,
            align: "end",
            weight: "bold"
          }
        ]
      },
      {
        type: "text",
        text: `${item.quantity} ชิ้น × ฿${unitPrice.toLocaleString()} = ฿${lineTotal.toLocaleString()}`,
        size: "xs",
        color: "#999999",
        margin: "xs"
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
  }; });

  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

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
          text: `${cartItems.length} รายการ (รวม ${totalItems} ชิ้น)`,
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
              text: `📦 รวม ${totalItems} ชิ้น`,
              size: "md",
              color: "#666666"
            }
          ],
          margin: "lg"
        },
        {
          type: "box",
          layout: "horizontal",
          contents: [
            {
              type: "text",
              text: "💰 ยอดรวม",
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
          margin: "sm"
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
  bankInfo?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
  promptpayId?: string;
  isCOD?: boolean;
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
              size: "xs",
              color: "#E8F5E9",
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
        // COD Payment section
        ...(data.isCOD ? [
          {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: "📦 เก็บเงินปลายทาง (COD)",
                weight: "bold",
                size: "md",
                color: "#1F2937",
                margin: "none",
                align: "center"
              },
              {
                type: "box",
                layout: "vertical",
                contents: [
                  {
                    type: "text",
                    text: `฿${(data.totalAmount - data.discountAmount).toLocaleString()}`,
                    size: "xl",
                    weight: "bold",
                    color: "#10B981",
                    align: "center"
                  },
                  {
                    type: "text",
                    text: "ชำระเงินเมื่อรับสินค้า",
                    size: "sm",
                    color: "#666666",
                    align: "center",
                    margin: "sm"
                  }
                ],
                margin: "sm",
                backgroundColor: "#FFFFFF",
                cornerRadius: "md",
                paddingAll: "md",
                borderWidth: "1px",
                borderColor: "#E5E7EB"
              }
            ],
            margin: "none",
            paddingBottom: "md",
            backgroundColor: "#FEF3C7",
            cornerRadius: "lg",
            paddingAll: "md"
          },
          {
            type: "separator",
            margin: "md"
          }
        ] : []),
        // PromptPay QR Code section with image (primary payment method)
        ...(!data.isCOD && data.promptpayId ? [
          {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: "📱 ชำระเงินผ่าน PromptPay",
                weight: "bold",
                size: "md",
                color: "#1F2937",
                margin: "none",
                align: "center"
              },
              {
                type: "box",
                layout: "vertical",
                contents: [
                  {
                    type: "image",
                    url: `https://promptpay.io/${data.promptpayId}/${(data.totalAmount - data.discountAmount)}.png`,
                    size: "lg",
                    aspectMode: "fit",
                    aspectRatio: "1:1"
                  },
                  {
                    type: "text",
                    text: `฿${(data.totalAmount - data.discountAmount).toLocaleString()}`,
                    size: "xl",
                    weight: "bold",
                    color: "#1E88E5",
                    align: "center",
                    margin: "sm"
                  }
                ],
                margin: "sm",
                backgroundColor: "#FFFFFF",
                cornerRadius: "md",
                paddingAll: "md",
                borderWidth: "1px",
                borderColor: "#E5E7EB"
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "เลขพร้อมเพย์:", size: "sm", color: "#666666", flex: 2 },
                  { type: "text", text: data.promptpayId, size: "sm", color: "#1F2937", flex: 3, weight: "bold" }
                ],
                margin: "md"
              },
              {
                type: "button",
                action: {
                  type: "clipboard",
                  label: "📋 คัดลอกเลขพร้อมเพย์",
                  clipboardText: data.promptpayId
                },
                style: "secondary",
                height: "sm",
                margin: "sm"
              }
            ],
            margin: "none",
            paddingBottom: "md",
            backgroundColor: "#F0FDF4",
            cornerRadius: "lg",
            paddingAll: "md"
          },
          {
            type: "separator",
            margin: "md"
          }
        ] : (!data.isCOD && data.bankInfo ? [
          // Fallback to bank info only if no PromptPay and not COD
          {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: "🏦 ข้อมูลบัญชีโอนเงิน",
                weight: "bold",
                size: "md",
                color: "#1F2937",
                margin: "none"
              },
              {
                type: "box",
                layout: "vertical",
                contents: [
                  {
                    type: "box",
                    layout: "horizontal",
                    contents: [
                      { type: "text", text: "ธนาคาร:", size: "sm", color: "#666666", flex: 2 },
                      { type: "text", text: data.bankInfo.bankName, size: "sm", color: "#1F2937", flex: 4, weight: "bold" }
                    ]
                  },
                  {
                    type: "box",
                    layout: "horizontal",
                    contents: [
                      { type: "text", text: "เลขบัญชี:", size: "sm", color: "#666666", flex: 2 },
                      { type: "text", text: data.bankInfo.accountNumber, size: "sm", color: "#1F2937", flex: 4, weight: "bold" }
                    ],
                    margin: "xs"
                  },
                  {
                    type: "box",
                    layout: "horizontal",
                    contents: [
                      { type: "text", text: "ชื่อบัญชี:", size: "sm", color: "#666666", flex: 2 },
                      { type: "text", text: data.bankInfo.accountName, size: "sm", color: "#1F2937", flex: 4, weight: "bold", wrap: true }
                    ],
                    margin: "xs"
                  }
                ],
                margin: "sm",
                backgroundColor: "#EBF5FF",
                cornerRadius: "md",
                paddingAll: "sm"
              },
              {
                type: "button",
                action: {
                  type: "clipboard",
                  label: "📋 คัดลอกเลขบัญชี",
                  clipboardText: data.bankInfo.accountNumber
                },
                style: "secondary",
                height: "sm",
                margin: "sm"
              }
            ],
            margin: "none",
            paddingBottom: "md"
          },
          {
            type: "separator",
            margin: "md"
          }
        ] : [])),
        // Payment instruction text - different for COD
        {
          type: "text",
          text: data.isCOD ? "📦 กรุณาเตรียมเงินสดให้พร้อมเมื่อรับสินค้า" : "💳 กรุณาชำระเงินและแจ้งสลิปโอนเงิน",
          size: "sm",
          color: "#666666",
          align: "center",
          wrap: true,
          margin: (data.bankInfo || data.promptpayId || data.isCOD) ? "md" : "none"
        },
        // Show payment notification button only for non-COD
        ...(data.isCOD ? [] : [
          {
            type: "button",
            action: {
              type: "message",
              label: "💳 แจ้งชำระเงิน",
              text: `แจ้งชำระเงินออเดอร์ ${data.orderNumber}`
            },
            style: "primary",
            height: "sm",
            margin: "md",
            color: "#10B981"
          }
        ]),
        {
          type: "box",
          layout: "horizontal",
          contents: [
            {
              type: "button",
              action: {
                type: "message",
                label: "📋 เลขออเดอร์",
                text: `เลขออเดอร์ของฉัน: ${data.orderNumber}`
              },
              style: "secondary",
              height: "sm",
              flex: 1
            },
            {
              type: "button",
              action: {
                type: "message",
                label: "📝 ดูประวัติ",
                text: "ประวัติออเดอร์"
              },
              style: "secondary",
              height: "sm",
              flex: 1,
              margin: "sm"
            }
          ],
          margin: "sm"
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

// ============= Duplicate Order Detection =============
async function checkDuplicateOrder(
  supabase: any, 
  userId: string, 
  totalAmount: number, 
  customerPhone: string,
  timeWindowMinutes: number = 5
): Promise<{ isDuplicate: boolean; existingOrderNumber?: string }> {
  try {
    const timeWindow = new Date(Date.now() - timeWindowMinutes * 60 * 1000).toISOString();
    
    const { data: existingOrders } = await supabase
      .from('orders')
      .select('order_number, created_at, total_amount')
      .eq('customer_line_id', userId)
      .eq('total_amount', totalAmount)
      .eq('customer_phone', customerPhone)
      .gte('created_at', timeWindow)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (existingOrders && existingOrders.length > 0) {
      console.log(`[LINE] Duplicate order detected: ${existingOrders[0].order_number} (created ${existingOrders[0].created_at})`);
      return { isDuplicate: true, existingOrderNumber: existingOrders[0].order_number };
    }
    
    return { isDuplicate: false };
  } catch (error) {
    console.error('[LINE] Error checking duplicate order:', error);
    return { isDuplicate: false }; // Allow order creation on error
  }
}

// ============= AI Response Parser =============
function parseAIResponse(content: string, products: Product[]) {
  const showProducts = content.includes('[SHOW_PRODUCTS]');
  const showPromotions = content.includes('[SHOW_PROMOTIONS]');
  const productMatch = content.match(/\[PRODUCT:([^\]]+)\]/);
  
  // Cart commands - support multiple CART_ADD commands
  const cartAddMatches = [...content.matchAll(/\[CART_ADD:([^\]]+)\]/g)];
  const cartAddMatch = cartAddMatches.length > 0 ? cartAddMatches[0] : null;
  const cartRemoveMatch = content.match(/\[CART_REMOVE:([^\]]+)\]/);
  const cartUpdateMatch = content.match(/\[CART_UPDATE:([^\]]+)\]/);
  const cartView = content.includes('[CART_VIEW]') || content.trim() === 'CART_VIEW';
  const cartClear = content.includes('[CART_CLEAR]') || content.trim() === 'CART_CLEAR';
  const cartCheckoutMatch = content.match(/\[CART_CHECKOUT:?([^\]]*)\]/);
  const outOfStockMatch = content.match(/\[NOTIFY_OUT_OF_STOCK:([^\]]+)\]/);
  
  // Order commands
  const createOrderMatch = content.match(/\[CREATE_ORDER:([^\]]+)\]/);
  const createMultiOrderMatch = content.match(/\[CREATE_MULTI_ORDER:([^\]]+)\]/);

  // Address commands
  const addressListMatch = content.includes('[ADDRESS_LIST]');
  const addressAddMatch = content.match(/\[ADDRESS_ADD:([^\]]+)\]/);
  const addressEditMatch = content.match(/\[ADDRESS_EDIT:([^\]]+)\]/);
  const addressDeleteMatch = content.match(/\[ADDRESS_DELETE:([^\]]+)\]/);
  const addressSetDefaultMatch = content.match(/\[ADDRESS_SET_DEFAULT:([^\]]+)\]/);

  // Clean the text
  let text = content
    .replace(/\[SHOW_PRODUCTS\]/g, '')
    .replace(/\[SHOW_PROMOTIONS\]/g, '')
    .replace(/\[PRODUCT:[^\]]+\]/g, '')
    .replace(/\[CART_ADD:[^\]]+\]/g, '')
    .replace(/\[CART_REMOVE:[^\]]+\]/g, '')
    .replace(/\[CART_UPDATE:[^\]]+\]/g, '')
    .replace(/\[CART_VIEW\]/g, '')
    .replace(/^CART_VIEW$/gm, '')
    .replace(/\[CART_CLEAR\]/g, '')
    .replace(/^CART_CLEAR$/gm, '')
    .replace(/\[CART_CHECKOUT:[^\]]*\]/g, '')
    .replace(/\[NOTIFY_OUT_OF_STOCK:[^\]]+\]/g, '')
    .replace(/\[CREATE_ORDER:[^\]]+\]/g, '')
    .replace(/\[CREATE_MULTI_ORDER:[^\]]+\]/g, '')
    .replace(/\[ADDRESS_LIST\]/g, '')
    .replace(/\[ADDRESS_ADD:[^\]]+\]/g, '')
    .replace(/\[ADDRESS_EDIT:[^\]]+\]/g, '')
    .replace(/\[ADDRESS_DELETE:[^\]]+\]/g, '')
    .replace(/\[ADDRESS_SET_DEFAULT:[^\]]+\]/g, '')
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

  // Parse cart action - support multiple adds
  let cartAction: CartAction | undefined;
  let multiCartAdds: CartAction[] | undefined;
  
  if (cartAddMatches.length > 1) {
    // Multiple CART_ADD commands - store all of them
    multiCartAdds = cartAddMatches.map(match => {
      const parts = match[1].split('|');
      return {
        type: 'add' as const,
        productName: parts[0]?.trim(),
        quantity: parseInt(parts[1]) || 1,
        variants: parts[2]?.trim() || undefined
      };
    });
    // Also set single cartAction for backward compat
    cartAction = multiCartAdds[0];
  } else if (cartAddMatch) {
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

  // Parse out of stock notification
  let outOfStockNotification: { productName: string; requestedQty: number; remainingStock: number } | undefined;
  if (outOfStockMatch) {
    const parts = outOfStockMatch[1].split('|');
    if (parts.length >= 3) {
      outOfStockNotification = {
        productName: parts[0].trim(),
        requestedQty: parseInt(parts[1].trim()) || 0,
        remainingStock: parseInt(parts[2].trim()) || 0
      };
    }
  }

  // Parse order creation commands
  let createOrder: OrderData | undefined;
  let createMultiOrder: MultiOrderData | undefined;
  
  // Parse multi-order first (higher priority for multiple products)
  if (createMultiOrderMatch) {
    const mainParts = createMultiOrderMatch[1].split('|');
    // Format: items|customerName|customerAddress|customerPhone
    // items format: productName1,qty1,variants1;productName2,qty2,variants2;...
    if (mainParts.length >= 4) {
      const itemsStr = mainParts[0].trim();
      const items: MultiOrderItem[] = itemsStr.split(';').map((itemStr: string) => {
        const itemParts = itemStr.split(',');
        return {
          productName: itemParts[0]?.trim() || '',
          quantity: parseInt(itemParts[1]?.trim()) || 1,
          variants: itemParts[2]?.trim() || undefined
        };
      }).filter((item: MultiOrderItem) => item.productName);
      
      if (items.length > 0) {
        createMultiOrder = {
          items,
          customerName: mainParts[1].trim(),
          customerAddress: mainParts[2].trim(),
          customerPhone: mainParts[3].trim(),
          couponCode: mainParts[4]?.trim() || undefined
        };
        console.log('[LINE] Parsed multi-order:', createMultiOrder);
      }
    }
  } else if (createOrderMatch) {
    const orderParts = createOrderMatch[1].split('|');
    if (orderParts.length >= 5) {
      createOrder = {
        productName: orderParts[0].trim(),
        quantity: parseInt(orderParts[1]) || 1,
        customerName: orderParts[2].trim(),
        customerAddress: orderParts[3].trim(),
        customerPhone: orderParts[4].trim(),
        variants: orderParts[5]?.trim() || undefined,
        couponCode: orderParts[6]?.trim() || undefined
      };
      console.log('[LINE] Parsed single order:', createOrder);
    }
  }

  // Parse address action
  let addressAction: AddressAction | undefined;
  if (addressListMatch) {
    addressAction = { type: 'list' };
  } else if (addressAddMatch) {
    const parts = addressAddMatch[1].split('|');
    addressAction = {
      type: 'add',
      label: parts[0]?.trim(),
      address: parts[1]?.trim()
    };
  } else if (addressEditMatch) {
    const parts = addressEditMatch[1].split('|');
    addressAction = {
      type: 'edit',
      label: parts[0]?.trim(),
      address: parts[1]?.trim()
    };
  } else if (addressDeleteMatch) {
    addressAction = {
      type: 'delete',
      label: addressDeleteMatch[1]?.trim()
    };
  } else if (addressSetDefaultMatch) {
    addressAction = {
      type: 'set_default',
      label: addressSetDefaultMatch[1]?.trim()
    };
  }

  return { 
    text, 
    showProducts, 
    showPromotions, 
    specificProduct, 
    promotionProducts, 
    cartAction,
    multiCartAdds,
    outOfStockNotification,
    createOrder,
    createMultiOrder,
    addressAction
  };
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

    // Verify LINE signature - MANDATORY
    const body = await req.text();
    const signature = req.headers.get("x-line-signature");
    
    if (!signature) {
      console.error("Missing LINE signature header");
      return new Response(
        JSON.stringify({ error: "Missing x-line-signature header" }), 
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const hmac = createHmac("sha256", lineChannelSecret);
    hmac.update(body);
    const expectedSignature = hmac.digest("base64");
    
    if (signature !== expectedSignature) {
      console.error("Invalid LINE signature");
      return new Response(
        JSON.stringify({ error: "Invalid signature" }), 
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const webhook = JSON.parse(body);
    console.log("LINE webhook received");

    // Process each event
    for (const event of webhook.events || []) {
      // ============= Rate Limiting per user =============
      if (event.source?.userId) {
        try {
          const { data: rateLimitResult } = await supabase.rpc('check_rate_limit', {
            p_identifier: event.source.userId,
            p_endpoint: 'line-webhook',
            p_max_requests: 30,  // 30 messages per minute per user
            p_window_seconds: 60
          });

          if (rateLimitResult && !rateLimitResult.allowed) {
            console.log(`[LINE] Rate limit exceeded for user ${event.source.userId}`);
            // Skip processing this event but don't return error to LINE
            continue;
          }
        } catch (rateLimitError) {
          // Log but don't block on rate limit errors
          console.warn('[LINE] Rate limit check failed:', rateLimitError);
        }
      }

      // ============= Handle Follow Event (New Friend) =============
      if (event.type === "follow") {
        const userId = event.source?.userId;
        const replyToken = event.replyToken;
        if (!userId || !replyToken) continue;

        console.log(`[LINE] New friend follow event from: ${userId}`);

        // Fetch user profile
        let displayName = "เพื่อนใหม่";
        try {
          const profileResponse = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${lineAccessToken}` }
          });
          if (profileResponse.ok) {
            const profile = await profileResponse.json();
            displayName = profile.displayName || "เพื่อนใหม่";
          }
        } catch (e) {
          console.error('[LINE] Error fetching profile for follow event:', e);
        }

        // Fetch store settings & welcome message config
        const { data: welcomeSettings } = await supabase
          .from('settings')
          .select('key, value')
          .in('key', [
            'STORE_NAME', 'LINE_WELCOME_ENABLED', 'LINE_WELCOME_MESSAGE',
            'LINE_WELCOME_CTA_1', 'LINE_WELCOME_CTA_2', 'LINE_WELCOME_CTA_3',
            'BUSINESS_HOURS', 'SHIPPING_INFO'
          ]);

        const getVal = (key: string, fallback: string) =>
          welcomeSettings?.find((s: any) => s.key === key)?.value || fallback;

        const welcomeEnabled = getVal('LINE_WELCOME_ENABLED', 'true');
        if (welcomeEnabled === 'false') {
          console.log('[LINE] Welcome message disabled, skipping');
          continue;
        }

        const storeName = getVal('STORE_NAME', 'ร้านค้าของเรา');
        const welcomeMsg = getVal('LINE_WELCOME_MESSAGE', 
          `ยินดีต้อนรับสู่ ${storeName} ค่ะ! 🎉\n\nขอบคุณที่เพิ่มเพื่อนกับเรานะคะ เรายินดีให้บริการคุณเสมอค่ะ 😊`
        );
        const cta1 = getVal('LINE_WELCOME_CTA_1', '🛍️ ดูสินค้า');
        const cta2 = getVal('LINE_WELCOME_CTA_2', '💬 สอบถามข้อมูล');
        const cta3 = getVal('LINE_WELCOME_CTA_3', '📦 เช็คสถานะออเดอร์');
        const businessHours = getVal('BUSINESS_HOURS', '');
        const shippingInfo = getVal('SHIPPING_INFO', '');

        // Build info highlights
        const highlights: Array<{icon: string; label: string; value: string}> = [];
        if (businessHours) {
          highlights.push({ icon: "🕐", label: "เวลาทำการ", value: businessHours });
        }
        if (shippingInfo) {
          highlights.push({ icon: "🚚", label: "จัดส่ง", value: shippingInfo });
        }

        // Build Flex Message
        const bodyContents: any[] = [
          {
            type: "text",
            text: `สวัสดีคุณ ${displayName}! 👋`,
            weight: "bold",
            size: "xl",
            color: "#1DB446",
            wrap: true
          },
          {
            type: "separator",
            margin: "lg"
          },
          {
            type: "text",
            text: welcomeMsg,
            wrap: true,
            size: "sm",
            color: "#555555",
            margin: "lg"
          }
        ];

        // Add highlights if available
        if (highlights.length > 0) {
          bodyContents.push({
            type: "separator",
            margin: "lg"
          });
          for (const h of highlights) {
            bodyContents.push({
              type: "box",
              layout: "horizontal",
              margin: "md",
              contents: [
                { type: "text", text: `${h.icon} ${h.label}`, size: "xs", color: "#aaaaaa", flex: 3 },
                { type: "text", text: h.value, size: "xs", color: "#333333", flex: 5, wrap: true, align: "end" }
              ]
            });
          }
        }

        const welcomeFlex = {
          type: "flex",
          altText: `ยินดีต้อนรับสู่ ${storeName}!`,
          contents: {
            type: "bubble",
            size: "mega",
            header: {
              type: "box",
              layout: "vertical",
              backgroundColor: "#1DB446",
              paddingAll: "20px",
              contents: [
                {
                  type: "text",
                  text: `🏪 ${storeName}`,
                  color: "#FFFFFF",
                  weight: "bold",
                  size: "lg"
                },
                {
                  type: "text",
                  text: "ยินดีต้อนรับเพื่อนใหม่!",
                  color: "#FFFFFFBB",
                  size: "sm",
                  margin: "sm"
                }
              ]
            },
            body: {
              type: "box",
              layout: "vertical",
              paddingAll: "20px",
              spacing: "sm",
              contents: bodyContents
            },
            footer: {
              type: "box",
              layout: "vertical",
              spacing: "sm",
              paddingAll: "15px",
              contents: [
                {
                  type: "button",
                  action: { type: "message", label: cta1, text: cta1.replace(/^[^\w\u0E00-\u0E7F]*\s*/, '') },
                  style: "primary",
                  color: "#1DB446",
                  height: "sm"
                },
                {
                  type: "button",
                  action: { type: "message", label: cta2, text: cta2.replace(/^[^\w\u0E00-\u0E7F]*\s*/, '') },
                  style: "secondary",
                  height: "sm"
                },
                {
                  type: "button",
                  action: { type: "message", label: cta3, text: cta3.replace(/^[^\w\u0E00-\u0E7F]*\s*/, '') },
                  style: "secondary",
                  height: "sm"
                }
              ]
            }
          }
        };

        // Send welcome message
        try {
          await fetch("https://api.line.me/v2/bot/message/reply", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${lineAccessToken}`,
            },
            body: JSON.stringify({
              replyToken,
              messages: [welcomeFlex]
            }),
          });
          console.log(`[LINE] Welcome message sent to new friend: ${displayName}`);
        } catch (e) {
          console.error('[LINE] Error sending welcome message:', e);
        }

        // Create conversation for new friend
        const { data: existingConv } = await supabase
          .from('chat_conversations')
          .select('id')
          .eq('platform', 'line')
          .eq('platform_user_id', userId)
          .maybeSingle();

        if (!existingConv) {
          await supabase.from('chat_conversations').insert({
            platform: 'line',
            platform_user_id: userId,
            customer_name: displayName,
            last_message: '🆕 เพิ่มเพื่อนใหม่',
            last_message_at: new Date().toISOString()
          });
          console.log(`[LINE] Created conversation for new friend: ${displayName}`);
        }

        continue;
      }

      // ============= Handle Unfollow Event =============
      if (event.type === "unfollow") {
        const userId = event.source?.userId;
        if (userId) {
          console.log(`[LINE] User unfollowed: ${userId}`);
        }
        continue;
      }

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
          // Fetch user profile from LINE API to get display name
          let customerName: string | null = null;
          try {
            const profileResponse = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${lineAccessToken}`
              }
            });
            if (profileResponse.ok) {
              const profile = await profileResponse.json();
              customerName = profile.displayName || null;
              console.log(`[LINE] Got user profile: ${customerName}`);
            }
          } catch (profileError) {
            console.error('[LINE] Error fetching user profile:', profileError);
          }

          const { data: newConv } = await supabase
            .from('chat_conversations')
            .insert({ 
              platform: 'line', 
              platform_user_id: userId,
              customer_name: customerName
            })
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

      // ============= Fetch saved addresses for returning customers =============
      let savedAddresses: SavedAddress[] = [];
      const { data: addressesData } = await supabase
        .from("customer_addresses")
        .select("*")
        .eq("platform_user_id", userId)
        .eq("platform", "line")
        .order("is_default", { ascending: false });

      if (addressesData && addressesData.length > 0) {
        savedAddresses = addressesData.map((a: any) => ({
          id: a.id,
          label: a.label,
          address: a.address,
          isDefault: a.is_default
        }));
        console.log(`[LINE] Found ${savedAddresses.length} saved addresses for user ${userId}`);
      }

      // Build customer context for personalized responses
      const customerContext: CustomerContext = {
        isReturning: !!conversation.customer_name,
        customerName: conversation.customer_name || undefined,
        customerPhone: conversation.customer_phone || undefined,
        customerAddress: conversation.customer_address || undefined,
        savedAddresses: savedAddresses.length > 0 ? savedAddresses : undefined
      };

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

      // ============= Direct Cart Add Shortcut (from Flex "เพิ่มลงตะกร้า" button) =============
      const directCartAddMatch = userMessage.match(/^เพิ่มลงตะกร้า\s*(.+)$/);
      if (directCartAddMatch) {
        const productName = directCartAddMatch[1].trim();
        console.log('[LINE] Direct cart add shortcut triggered for:', productName);

        // Save user message
        await supabase.from('chat_messages').insert({
          conversation_id: conversation.id,
          role: 'user',
          content: userMessage
        });

        // Fetch products to find match
        const { data: allProducts } = await supabase
          .from('products')
          .select('*')
          .eq('is_active', true);

        let matchedProduct = allProducts?.find(p => p.name.toLowerCase() === productName.toLowerCase());
        if (!matchedProduct) {
          matchedProduct = allProducts?.find(p =>
            p.name.toLowerCase().includes(productName.toLowerCase()) ||
            productName.toLowerCase().includes(p.name.toLowerCase())
          );
        }

        if (matchedProduct) {
          const price = matchedProduct.promotion_price || matchedProduct.price;
          const hasVariants = matchedProduct.variants && Array.isArray(matchedProduct.variants) && matchedProduct.variants.length > 0;

          // Check stock
          if (matchedProduct.stock < 1) {
            const outMsg = `ขออภัยค่ะ สินค้า "${matchedProduct.name}" สินค้าหมดค่ะ 😢`;
            await supabase.from('chat_messages').insert({ conversation_id: conversation.id, role: 'assistant', content: outMsg });
            await fetch("https://api.line.me/v2/bot/message/reply", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${lineAccessToken}` },
              body: JSON.stringify({ replyToken, messages: [{ type: "text", text: outMsg }] }),
            });
            continue;
          }

          // Check if item already in cart (same product, no variants yet)
          const { data: existingItem } = await supabase
            .from('shopping_carts')
            .select('*')
            .eq('platform_user_id', userId)
            .eq('product_id', matchedProduct.id)
            .maybeSingle();

          if (existingItem) {
            await supabase.from('shopping_carts')
              .update({ quantity: existingItem.quantity + 1, updated_at: new Date().toISOString() })
              .eq('id', existingItem.id);
          } else {
            await supabase.from('shopping_carts').insert({
              platform_user_id: userId,
              conversation_id: conversation.id,
              product_id: matchedProduct.id,
              product_name: matchedProduct.name,
              quantity: 1,
              price: price,
              variants: null
            });
          }

          // Get updated cart
          const { data: cartAfterAdd } = await supabase
            .from('shopping_carts')
            .select('*')
            .eq('platform_user_id', userId);

          const cartCount = cartAfterAdd?.reduce((sum: number, item: any) => sum + item.quantity, 0) || 0;
          const totalAmount = cartAfterAdd?.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0) || 0;

          const cartMessages: any[] = [];

          // Confirmation text
          let confirmText = `✅ เพิ่ม "${matchedProduct.name}" ลงตะกร้าแล้วค่ะ! (ตะกร้ามี ${cartCount} ชิ้น)`;
          if (hasVariants) {
            // Build variant info string
            const variantOptions = (matchedProduct.variants as any[]).map((v: any) => {
              const name = v.name || v.label || '';
              const options = (v.options || v.values || []).join(', ');
              return `${name}: ${options}`;
            }).join(' | ');
            confirmText += `\n\n⚠️ สินค้านี้มีตัวเลือก (${variantOptions})\nกรุณาแจ้งตัวเลือกที่ต้องการด้วยนะคะ 😊`;
          }
          cartMessages.push({ type: "text", text: confirmText });

          // Show cart flex
          if (cartAfterAdd && cartAfterAdd.length > 0) {
            cartMessages.push({
              type: "flex",
              altText: "ตะกร้าสินค้า",
              contents: buildCartSummaryFlex(cartAfterAdd as CartItem[], totalAmount)
            });
          }

          const botContent = confirmText;
          await supabase.from('chat_messages').insert({ conversation_id: conversation.id, role: 'assistant', content: botContent });
          await supabase.from('chat_conversations').update({
            last_message: userMessage,
            last_message_at: new Date().toISOString()
          }).eq('id', conversation.id);

          await fetch("https://api.line.me/v2/bot/message/reply", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${lineAccessToken}` },
            body: JSON.stringify({ replyToken, messages: cartMessages.slice(0, 5) }),
          });
          continue;
        }
        // If product not found, fall through to AI
      }

      // ============= Direct Cart Operations Shortcut (skip AI) =============
      const cartViewKeywords = ['ดูตะกร้า', 'ตะกร้าของฉัน', 'ตะกร้า', 'cart', 'view cart'];
      const isDirectCartView = cartViewKeywords.some(kw => userMessage.trim().toLowerCase() === kw.toLowerCase());
      
      // Direct cart update: "เปลี่ยนจำนวน X เป็น Y ชิ้น"
      const directUpdateMatch = userMessage.match(/เปลี่ยนจำนวน\s*(.+?)\s*เป็น\s*(\d+)\s*ชิ้น/);
      // Direct cart remove: "ลบ X ออกจากตะกร้า"
      const directRemoveMatch = userMessage.match(/ลบ\s*(.+?)\s*ออกจากตะกร้า/);
      // Direct cart clear: "ล้างตะกร้า"
      const isDirectCartClear = ['ล้างตะกร้า', 'clear cart'].some(kw => userMessage.trim().toLowerCase() === kw.toLowerCase());

      if (isDirectCartView || directUpdateMatch || directRemoveMatch || isDirectCartClear) {
        console.log('[LINE] Direct cart operation shortcut triggered:', 
          isDirectCartView ? 'view' : directUpdateMatch ? 'update' : directRemoveMatch ? 'remove' : 'clear');
        
        // Quick typing indicator even for direct cart operations
        try {
          const loadingRes = await fetch("https://api.line.me/v2/bot/chat/loading/start", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${lineAccessToken}`,
            },
            body: JSON.stringify({ chatId: userId, loadingSeconds: 3 }),
          });
          if (!loadingRes.ok) {
            console.log("Typing indicator failed (non-critical):", await loadingRes.text());
          }
        } catch (typingError) {
          console.log("Typing indicator error (non-critical):", typingError);
        }

        // Save user message
        await supabase.from('chat_messages').insert({
          conversation_id: conversation.id,
          role: 'user',
          content: userMessage
        });

        let actionResultText = '';

        // Handle cart update
        if (directUpdateMatch) {
          const productName = directUpdateMatch[1].trim();
          const newQuantity = parseInt(directUpdateMatch[2]);

          const { data: cartItems } = await supabase
            .from('shopping_carts')
            .select('*')
            .eq('platform_user_id', userId);

          const itemToUpdate = cartItems?.find(item =>
            item.product_name.toLowerCase().includes(productName.toLowerCase()) ||
            productName.toLowerCase().includes(item.product_name.toLowerCase())
          );

          if (itemToUpdate) {
            if (newQuantity <= 0) {
              await supabase.from('shopping_carts').delete().eq('id', itemToUpdate.id);
              actionResultText = `🗑️ ลบ "${itemToUpdate.product_name}" ออกจากตะกร้าแล้วค่ะ!`;
            } else {
              await supabase.from('shopping_carts')
                .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
                .eq('id', itemToUpdate.id);
              actionResultText = `✅ เปลี่ยนจำนวน "${itemToUpdate.product_name}" เป็น ${newQuantity} ชิ้นแล้วค่ะ!`;
            }
          } else {
            actionResultText = `ไม่พบสินค้า "${productName}" ในตะกร้าค่ะ`;
          }
        }

        // Handle cart remove
        if (directRemoveMatch) {
          const productName = directRemoveMatch[1].trim();

          const { data: cartItems } = await supabase
            .from('shopping_carts')
            .select('*')
            .eq('platform_user_id', userId);

          const itemToRemove = cartItems?.find(item =>
            item.product_name.toLowerCase().includes(productName.toLowerCase()) ||
            productName.toLowerCase().includes(item.product_name.toLowerCase())
          );

          if (itemToRemove) {
            await supabase.from('shopping_carts').delete().eq('id', itemToRemove.id);
            actionResultText = `🗑️ ลบ "${itemToRemove.product_name}" ออกจากตะกร้าแล้วค่ะ!`;
          } else {
            actionResultText = `ไม่พบสินค้า "${productName}" ในตะกร้าค่ะ`;
          }
        }

        // Handle cart clear
        if (isDirectCartClear) {
          await supabase.from('shopping_carts').delete().eq('platform_user_id', userId);
          actionResultText = '🗑️ ล้างตะกร้าเรียบร้อยแล้วค่ะ!';
        }

        // Now fetch updated cart and show it
        const { data: updatedCartItems } = await supabase
          .from('shopping_carts')
          .select('*')
          .eq('platform_user_id', userId);

        const cartMessages: any[] = [];
        
        // Add action result text if there was an action (not just viewing)
        if (actionResultText) {
          // Don't send separate text - include info in the flex or show empty cart message
        }

        if (updatedCartItems && updatedCartItems.length > 0) {
          const totalAmount = updatedCartItems.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
          if (actionResultText) {
            cartMessages.push({ type: "text", text: actionResultText });
          }
          cartMessages.push({
            type: "flex",
            altText: "ตะกร้าสินค้า",
            contents: buildCartSummaryFlex(updatedCartItems as CartItem[], totalAmount)
          });
        } else {
          if (actionResultText) {
            cartMessages.push({ type: "text", text: actionResultText + "\n\nตะกร้าว่างเปล่าแล้ว พิมพ์ \"ดูสินค้า\" เพื่อเลือกสินค้าได้เลยค่ะ 🛍️" });
          } else {
            cartMessages.push({ type: "text", text: "ตะกร้าของคุณยังว่างเปล่าค่ะ 🛒\n\nพิมพ์ \"ดูสินค้า\" เพื่อเลือกสินค้าได้เลยค่ะ" });
          }
        }

        // Save bot response
        await supabase.from('chat_messages').insert({
          conversation_id: conversation.id,
          role: 'assistant',
          content: actionResultText || (updatedCartItems && updatedCartItems.length > 0 ? `แสดงตะกร้าสินค้า (${updatedCartItems.length} รายการ)` : 'ตะกร้าว่างเปล่า')
        });

        await supabase.from('chat_conversations').update({
          last_message: userMessage,
          last_message_at: new Date().toISOString()
        }).eq('id', conversation.id);

        await fetch("https://api.line.me/v2/bot/message/reply", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${lineAccessToken}`,
          },
          body: JSON.stringify({ replyToken, messages: cartMessages.slice(0, 5) }),
        });
        continue;
      }

      await supabase.from('chat_messages').insert({
        conversation_id: conversation.id,
        role: 'user',
        content: userMessage
      });

      // Check for cache invalidation before using cache
      await checkCacheInvalidation(supabase);

      // ============= Try to get data from cache first =============
      let aiSettingsData = getCached<any>('line_ai_settings');
      let products = getCached<any[]>('line_products');
      let faqsData = getCached<any[]>('line_faqs');
      let settingsData = getCached<any[]>('line_settings');

      // Also check for related_products cache
      let relatedProductsData = getCached<any[]>('line_related_products');
      
      const needsAiSettings = !aiSettingsData;
      const needsProducts = !products;
      const needsFaqs = !faqsData;
      const needsSettings = !settingsData;
      const needsRelatedProducts = !relatedProductsData;

      if (needsAiSettings || needsProducts || needsFaqs || needsSettings || needsRelatedProducts) {
        const cacheMisses = [];
        if (needsAiSettings) cacheMisses.push('ai_settings');
        if (needsProducts) cacheMisses.push('products');
        if (needsFaqs) cacheMisses.push('faqs');
        if (needsSettings) cacheMisses.push('settings');
        if (needsRelatedProducts) cacheMisses.push('related_products');
        console.log(`[LINE] Cache miss: ${cacheMisses.join(', ')}`);

        const [
          aiSettingsResult,
          productsResult,
          faqsResult,
          settingsResult,
          relatedProductsResult
        ] = await Promise.all([
          needsAiSettings ? supabase.from("ai_settings").select("*").eq("is_active", true).maybeSingle() : Promise.resolve({ data: aiSettingsData }),
          needsProducts ? supabase.from("products").select("*").eq("is_active", true) : Promise.resolve({ data: products }),
          needsFaqs ? supabase.from("faqs").select("question, answer").eq("is_active", true) : Promise.resolve({ data: faqsData }),
          needsSettings ? supabase.from("settings").select("key, value").in("key", ["STORE_NAME", "SHIPPING_INFO", "BANK_ACCOUNTS", "PAYMENT_METHODS", "RETURN_POLICY"]) : Promise.resolve({ data: settingsData }),
          needsRelatedProducts ? supabase.from("related_products").select("product_id, related_product_id") : Promise.resolve({ data: relatedProductsData })
        ]);

        if (needsAiSettings && aiSettingsResult.data) {
          aiSettingsData = aiSettingsResult.data;
          setCache('line_ai_settings', aiSettingsData, 2 * 60 * 1000); // 2 min
        }
        if (needsProducts) {
          products = productsResult.data || [];
          setCache('line_products', products);
        }
        if (needsFaqs) {
          faqsData = faqsResult.data || [];
          setCache('line_faqs', faqsData);
        }
        if (needsSettings) {
          settingsData = settingsResult.data || [];
          setCache('line_settings', settingsData);
        }
        if (needsRelatedProducts) {
          relatedProductsData = relatedProductsResult.data || [];
          setCache('line_related_products', relatedProductsData);
        }
      } else {
        console.log('[LINE] All data served from cache!');
      }
      
      // Ensure relatedProductsData is initialized
      relatedProductsData = relatedProductsData || [];

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

      const productList = products || [];
      const faqs = faqsData || [];
      settingsData = settingsData || [];
      const faqList = faqs.map((f: any) => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n');
      
      // Build related products map for cross-sell
      const relatedProductsMap = new Map<string, string[]>();
      for (const rp of relatedProductsData) {
        const existing = relatedProductsMap.get(rp.product_id) || [];
        existing.push(rp.related_product_id);
        relatedProductsMap.set(rp.product_id, existing);
      }
      console.log(`[LINE] Related products configured: ${relatedProductsData.length} pairs`);
      
      // Build product catalog with variants info AND related products for AI
      const productCatalog = productList.map((p: any) => {
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
        
        // Include related products info for cross-sell
        const relatedIds = relatedProductsMap.get(p.id) || [];
        if (relatedIds.length > 0) {
          const relatedNames = relatedIds
            .map(id => productList.find((prod: any) => prod.id === id)?.name)
            .filter(Boolean);
          if (relatedNames.length > 0) {
            info += ` | 🔗สินค้าที่เกี่ยวข้อง: [${relatedNames.join(', ')}]`;
          }
        }
        
        return info;
      }).join('\n') || 'ยังไม่มีสินค้า';

      // Process store settings
      const settingsMap = new Map(settingsData.map((s: any) => [s.key, s.value]));
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
      
      // Detect if user is specifying new product list (contains quantity patterns)
      const productListPattern = /(\d+\s*(ตัว|ชิ้น|คู่|อัน|ชุด|กล่อง|แพ็ค))|((ตัว|ชิ้น|คู่|อัน|ชุด|กล่อง|แพ็ค)\s*\d+)|(อย่างละ\s*\d+)|(\d+\s*(สี|ไซส์|size|s|m|l|xl))/i;
      const isNewProductList = productListPattern.test(userMessage);
      
      // CRITICAL FIX: When user specifies new product list, CLEAR old history that contains quantities
      // This prevents AI from adding old quantities with new ones
      if (!isNewSession && !isGreeting && historyMessages && historyMessages.length > 0) {
        if (isNewProductList) {
          // Only keep very recent messages (last 4) and filter out any that mention quantities
          const recentHistory = historyMessages.slice(-4);
          const filteredHistory = recentHistory.filter((m: any) => {
            // Filter out assistant messages that contain quantity confirmations
            if (m.role === 'assistant') {
              const hasQuantityConfirmation = /จำนวน\s*\d+\s*(ตัว|ชิ้น)|(\d+)\s*(ตัว|ชิ้น|คู่)/i.test(m.content);
              const hasOrderConfirmation = /ยืนยันรายการ|รายการสินค้า|รวม.*ชิ้น/i.test(m.content);
              if (hasQuantityConfirmation || hasOrderConfirmation) {
                console.log(`[LINE] Filtered out old quantity message: ${m.content.substring(0, 50)}...`);
                return false;
              }
            }
            return true;
          });
          for (const m of filteredHistory) {
            aiMessages.push({ role: m.role, content: m.content });
          }
          console.log(`[LINE] New product list detected. History filtered: ${historyMessages.length} -> ${filteredHistory.length} messages`);
        } else {
          for (const m of historyMessages) {
            aiMessages.push({ role: m.role, content: m.content });
          }
        }
      }
      
      // CRITICAL: When user specifies a new product list, add ABSOLUTE instruction
      if (isNewProductList && !isGreeting) {
        // Extract quantities from CURRENT message only
        const quantityMatches: string[] = userMessage.match(/(\d+)\s*(ตัว|ชิ้น|คู่|อัน|ชุด)/gi) || [];
        const quantities: number[] = quantityMatches.map((m: string) => {
          const num = m.match(/\d+/)?.[0] || '1';
          return parseInt(num);
        });
        const totalFromMessage = quantities.reduce((sum: number, q: number) => sum + q, 0);
        
        aiMessages.push({ 
          role: "system", 
          content: `[🚨 คำสั่งบังคับเด็ดขาด - จำนวนสินค้า 🚨]

⚠️ ลูกค้าพิมพ์ข้อความนี้: "${userMessage}"

📊 วิเคราะห์จำนวนจากข้อความนี้โดยตรง:
${quantityMatches.map((m: string) => `- "${m}"`).join('\n')}
รวมทั้งหมดจากข้อความนี้ = ${totalFromMessage} ชิ้น

🔴 กฎเด็ดขาด 100%:
1. ใช้เฉพาะจำนวนจากข้อความล่าสุดนี้เท่านั้น!
2. ลืมจำนวนทั้งหมดจากบทสนทนาก่อนหน้า!
3. ห้ามบวก ห้ามคูณ ห้ามเพิ่มจำนวน!
4. ถ้าลูกค้าพิมพ์ "1 ตัว" ต้องยืนยัน "1 ตัว" เท่านั้น!

ตัวอย่าง:
- ลูกค้าพิมพ์ "เสื้อ 1 ตัว กางเกง 1 ตัว" = ต้องยืนยัน "เสื้อ 1 ตัว + กางเกง 1 ตัว = รวม 2 ชิ้น"
- ห้ามยืนยันเป็น "เสื้อ 2 ตัว กางเกง 2 ตัว" เด็ดขาด!` 
        });
        console.log(`[LINE] Quantity override added. Analysis: ${quantityMatches.join(', ')} = ${totalFromMessage} ชิ้น`);
      }
      
      // Add context reminder about last discussed product ONLY if not greeting and not new session
      if (lastDiscussedProduct && !isGreeting && !isNewSession) {
        const contextReminder = `[CONTEXT: กำลังคุยเรื่องสินค้า "${lastDiscussedProduct.name}" - ถ้าลูกค้าบอกแค่สี/ไซส์/จำนวน ให้อ้างอิงถึงสินค้านี้เสมอ ห้ามเปลี่ยนเป็นสินค้าอื่น!]`;
        aiMessages.push({ role: "system", content: contextReminder });
        console.log(`[LINE] Context reminder: Currently discussing "${lastDiscussedProduct.name}"`);
      }
      
      // For greetings, add instruction with personalized message for returning customers
      if (isGreeting) {
        const isReturningWithName = customerContext.isReturning && customerContext.customerName;
        
        // Determine particles based on AI gender setting
        const gender = aiSettings.gender;
        let pEnd = "ครับ/ค่ะ";
        let pQuestion = "ครับ/คะ";
        if (gender === "female") {
          pEnd = "ค่ะ";
          pQuestion = "คะ";
        } else if (gender === "male") {
          pEnd = "ครับ";
          pQuestion = "ครับ";
        }
        
        const customerName = customerContext.customerName || '';
        const greetingInstruction = isReturningWithName 
          ? `[INSTRUCTION: ลูกค้าเก่าทักทายเข้ามา - ชื่อ: "${customerName}"

🎉 กฎทักทายลูกค้าเก่า (สำคัญมาก!):
- ต้องทักทายด้วยชื่อลูกค้าให้รู้สึกพิเศษและเป็นกันเอง!
- ใช้ภาษาสบายๆ เหมือนเพื่อนคุยกัน ไม่เป็นทางการเกินไป
- สร้างความรู้สึกอบอุ่น ต้อนรับ และดีใจที่ลูกค้ากลับมา

✅ ตัวอย่างคำทักทายที่ดี (เลือกใช้หรือดัดแปลงตามความเหมาะสม):
- "สวัสดี${pEnd} คุณ${customerName}! 😊 ดีใจที่กลับมาอีกครั้ง${pEnd} วันนี้มองหาอะไรอยู่${pQuestion}?"
- "โอ้! คุณ${customerName} มาแล้ว${pEnd} 🎉 คิดถึงจัง${pEnd} วันนี้มีอะไรให้ช่วยไหม${pQuestion}?"
- "ว้าว คุณ${customerName}! 😊 กลับมาช้อปอีกแล้ว${pEnd} มีสินค้าใหม่น่าสนใจเลยนะ${pQuestion}!"
- "หวัดดี${pEnd} คุณ${customerName}! 💕 ยินดีต้อนรับเหมือนเดิม${pEnd} สนใจอะไรเป็นพิเศษไหม${pQuestion}?"
- "เฮ้ย คุณ${customerName}! 🙌 นานไม่เจอเลย${pEnd} วันนี้มาดูอะไรกัน${pQuestion}?"

⚠️ กฎสำคัญ:
- ห้ามทักทายซ้ำซ้อน หรือแนะนำตัวซ้ำ
- ห้ามถามรายละเอียดที่อยู่/เบอร์
- ข้อความทักทายต้องไม่เกิน 2 ประโยค
- ให้บรรยากาศอบอุ่น เป็นมิตร เหมือนเพื่อนเจอกัน]`
          : `[INSTRUCTION: ลูกค้าใหม่ทักทายเข้ามา
⚠️ กฎสำคัญ - ห้ามทักทายซ้ำซ้อน!
- ตอบทักทายแค่ครั้งเดียว สั้นๆ เช่น "สวัสดี${pEnd}! 😊 สนใจสินค้าอะไรเป็นพิเศษ${pQuestion}?"
- ห้ามพูดว่า "ยินดีต้อนรับ" หรือ "ขอต้อนรับ" ซ้ำ 2 ครั้งในข้อความเดียว
- ห้ามแนะนำตัวซ้ำ 2 ครั้ง
- ห้ามพูดถึงสินค้าเก่าหรือถามรายละเอียดที่อยู่/ชื่อ/เบอร์
- ข้อความทักทายต้องไม่เกิน 2 ประโยค]`;
        
        aiMessages.push({ role: "system", content: greetingInstruction });
        console.log(`[LINE] Greeting instruction added. Returning customer: ${isReturningWithName}, Name: ${customerContext.customerName || 'none'}`);
      }
      
      // Add saved addresses context for returning customers - ALWAYS (including greeting)
      if (customerContext.savedAddresses && customerContext.savedAddresses.length > 0) {
        const addressList = customerContext.savedAddresses.map((a, i) => 
          `${i + 1}. "${a.label}": ${a.address}${a.isDefault ? ' ⭐(ค่าเริ่มต้น)' : ''}`
        ).join('\n');
        
        const savedAddressInstruction = `🚨🚨🚨 [กฎบังคับ - ลูกค้าเก่ามีที่อยู่บันทึกไว้แล้ว!] 🚨🚨🚨

📍 ที่อยู่จัดส่งที่บันทึกไว้:
${addressList}
${customerContext.customerName ? `👤 ชื่อเดิม: ${customerContext.customerName}` : ''}
${customerContext.customerPhone ? `📞 เบอร์โทรเดิม: ${customerContext.customerPhone}` : ''}

⚠️ กฎบังคับ (ห้ามละเมิดเด็ดขาด!):
**เมื่อถึงขั้นตอนถามข้อมูลจัดส่ง → ห้ามถามชื่อ/ที่อยู่/เบอร์โทรโดยตรง!**

✅ ต้องถามแบบนี้แทน:
"พบข้อมูลเดิมของคุณ${customerContext.customerName ? ` คุณ${customerContext.customerName}` : ''}นะคะ ต้องการจัดส่งไปที่อยู่เดิมไหมคะ?

📍 ${customerContext.savedAddresses[0].address}
${customerContext.customerPhone ? `📞 ${customerContext.customerPhone}` : ''}

ถ้าใช่ พิมพ์ 'ใช่' หรือ 'ที่เดิม' ได้เลยค่ะ
ถ้าต้องการเปลี่ยน รบกวนแจ้งที่อยู่ใหม่ค่ะ"

❌ ห้ามถามแบบนี้:
- "กรุณาแจ้งชื่อ-นามสกุล ที่อยู่ เบอร์โทร" ← ผิด! ต้องเสนอที่อยู่เดิมก่อน!

🔄 เมื่อลูกค้าตอบ:
- "ใช่", "ที่เดิม", "ตามเดิม", "เหมือนเดิม", "ครับ", "ค่ะ", "ok" → ใช้ที่อยู่⭐หรือรายการแรก
- "บ้าน", "ออฟฟิศ", "ที่ทำงาน" → ใช้ที่อยู่ที่ตรงกับ label นั้น
- ลูกค้าพิมพ์ที่อยู่ใหม่ → ใช้ที่อยู่ใหม่ที่ลูกค้าพิมพ์`;
        
        aiMessages.push({ role: "system", content: savedAddressInstruction });
        console.log(`[LINE] Added MANDATORY saved addresses instruction: ${customerContext.savedAddresses.length} addresses`);
      }
      
      // (productListPattern and isNewProductList already defined above at line 2062-2063)
      
      // Add current user message
      aiMessages.push({ role: "user", content: userMessage });
      
      console.log(`Sending ${aiMessages.length} messages to AI (including current)`);

      // Send typing indicator to LINE (shows loading animation while AI processes)
      try {
        await fetch("https://api.line.me/v2/bot/chat/loading/start", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${lineAccessToken}`,
          },
          body: JSON.stringify({
            chatId: userId,
            loadingSeconds: 20 // Increased to 20 seconds for longer AI responses
          }),
        });
        console.log("LINE typing indicator sent");
      } catch (typingError) {
        console.log("Typing indicator error (non-critical):", typingError);
      }

      // Call AI - using gemini-2.5-flash for faster response with better quality
      console.log("Calling Lovable AI (gemini-2.5-flash)...");
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
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
      const { text, showProducts, showPromotions, specificProduct, promotionProducts, cartAction, multiCartAdds, outOfStockNotification, createOrder, createMultiOrder, addressAction } = parseAIResponse(aiContent, productList);

      // Handle out of stock notification - create admin notification
      if (outOfStockNotification) {
        console.log(`[LINE] Out of stock notification: ${outOfStockNotification.productName}, requested: ${outOfStockNotification.requestedQty}, remaining: ${outOfStockNotification.remainingStock}`);
        
        await supabase.from('admin_notifications').insert({
          type: 'out_of_stock_request',
          title: '⚠️ ลูกค้าสั่งสินค้าที่สต็อกไม่พอ',
          message: `ลูกค้าต้องการสั่ง "${outOfStockNotification.productName}" จำนวน ${outOfStockNotification.requestedQty} ชิ้น แต่คงเหลือเพียง ${outOfStockNotification.remainingStock} ชิ้น`,
          data: {
            product_name: outOfStockNotification.productName,
            requested_quantity: outOfStockNotification.requestedQty,
            remaining_stock: outOfStockNotification.remainingStock,
            platform: 'line',
            customer_id: userId
          }
        });
      }

      // Build LINE messages
      const lineMessages: any[] = [];
      
      // Fetch payment settings for order confirmation
      let bankInfo: { bankName: string; accountNumber: string; accountName: string } | undefined;
      let promptpayId: string | undefined;
      let isCOD = false;
      
      // Detect payment method from conversation context (user message + AI response)
      const codPatterns = /เก็บเงินปลายทาง|เก็บปลายทาง|COD|cod|ปลายทาง|Cash on Delivery/i;
      const transferPatterns = /โอนเงิน|โอน|PromptPay|promptpay|พร้อมเพย์|QR/i;
      
      // Check user message and AI response for payment method choice
      const userChoseCOD = codPatterns.test(userMessage) || codPatterns.test(aiContent);
      const userChoseTransfer = transferPatterns.test(userMessage) || transferPatterns.test(aiContent);
      
      const { data: paymentSettings } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['primary_payment_method', 'bank_name', 'bank_account_number', 'bank_account_name', 'promptpay_id']);
      
      if (paymentSettings && paymentSettings.length > 0) {
        // Priority: customer's choice > store's primary method
        let effectiveMethod: string;
        if (userChoseCOD && !userChoseTransfer) {
          effectiveMethod = 'cod';
          console.log('[LINE] Customer chose COD payment');
        } else if (userChoseTransfer && !userChoseCOD) {
          effectiveMethod = paymentSettings.find(s => s.key === 'promptpay_id')?.value ? 'promptpay' : 'bank';
          console.log('[LINE] Customer chose transfer payment');
        } else {
          effectiveMethod = paymentSettings.find(s => s.key === 'primary_payment_method')?.value || 'promptpay';
          console.log(`[LINE] Using store primary payment method: ${effectiveMethod}`);
        }
        
        if (effectiveMethod === 'cod') {
          isCOD = true;
        } else if (effectiveMethod === 'bank') {
          const bankName = paymentSettings.find(s => s.key === 'bank_name')?.value;
          const accountNumber = paymentSettings.find(s => s.key === 'bank_account_number')?.value;
          const accountName = paymentSettings.find(s => s.key === 'bank_account_name')?.value;
          if (bankName && accountNumber && accountName) {
            bankInfo = { bankName, accountNumber, accountName };
          }
        } else {
          promptpayId = paymentSettings.find(s => s.key === 'promptpay_id')?.value;
        }
      }

      // Always add text message first if there's text
      if (text) {
        lineMessages.push({ type: "text", text });
      }

      // Handle address actions
      if (addressAction) {
        console.log("[LINE] Address action:", addressAction);
        
        if (addressAction.type === 'list') {
          const { data: addresses } = await supabase.from("customer_addresses").select("*").eq("platform_user_id", userId).eq("platform", "line").order("is_default", { ascending: false });
          if (addresses && addresses.length > 0) {
            const addressList = addresses.map((a: any, i: number) => `${i + 1}. ${a.label}: ${a.address}${a.is_default ? ' ⭐' : ''}`).join('\n');
            lineMessages.push({ type: "text", text: `📍 ที่อยู่จัดส่งของคุณ:\n${addressList}` });
          }
        } else if (addressAction.type === 'add' && addressAction.label && addressAction.address) {
          const { data: existing } = await supabase.from("customer_addresses").select("id").eq("platform_user_id", userId).eq("platform", "line").eq("label", addressAction.label).maybeSingle();
          if (existing) {
            await supabase.from("customer_addresses").update({ address: addressAction.address, updated_at: new Date().toISOString() }).eq("id", existing.id);
          } else {
            const { count } = await supabase.from("customer_addresses").select("*", { count: 'exact', head: true }).eq("platform_user_id", userId).eq("platform", "line");
            await supabase.from("customer_addresses").insert({ platform_user_id: userId, platform: "line", label: addressAction.label, address: addressAction.address, is_default: count === 0 });
          }
          lineMessages.push({ type: "text", text: `✅ บันทึกที่อยู่ "${addressAction.label}" เรียบร้อยแล้วค่ะ` });
        } else if (addressAction.type === 'edit' && addressAction.label && addressAction.address) {
          const { data: existing } = await supabase.from("customer_addresses").select("id").eq("platform_user_id", userId).eq("platform", "line").eq("label", addressAction.label).maybeSingle();
          if (existing) {
            await supabase.from("customer_addresses").update({ address: addressAction.address, updated_at: new Date().toISOString() }).eq("id", existing.id);
            lineMessages.push({ type: "text", text: `✅ แก้ไขที่อยู่ "${addressAction.label}" เรียบร้อยแล้วค่ะ` });
          } else {
            lineMessages.push({ type: "text", text: `❌ ไม่พบที่อยู่ "${addressAction.label}" ค่ะ` });
          }
        } else if (addressAction.type === 'delete' && addressAction.label) {
          const { data: existing } = await supabase.from("customer_addresses").select("id").eq("platform_user_id", userId).eq("platform", "line").eq("label", addressAction.label).maybeSingle();
          if (existing) {
            await supabase.from("customer_addresses").delete().eq("id", existing.id);
            lineMessages.push({ type: "text", text: `🗑️ ลบที่อยู่ "${addressAction.label}" เรียบร้อยแล้วค่ะ` });
          } else {
            lineMessages.push({ type: "text", text: `❌ ไม่พบที่อยู่ "${addressAction.label}" ค่ะ` });
          }
        } else if (addressAction.type === 'set_default' && addressAction.label) {
          const { data: existing } = await supabase.from("customer_addresses").select("id").eq("platform_user_id", userId).eq("platform", "line").eq("label", addressAction.label).maybeSingle();
          if (existing) {
            await supabase.from("customer_addresses").update({ is_default: false }).eq("platform_user_id", userId).eq("platform", "line");
            await supabase.from("customer_addresses").update({ is_default: true }).eq("id", existing.id);
            lineMessages.push({ type: "text", text: `⭐ ตั้งที่อยู่ "${addressAction.label}" เป็นค่าเริ่มต้นแล้วค่ะ` });
          } else {
            lineMessages.push({ type: "text", text: `❌ ไม่พบที่อยู่ "${addressAction.label}" ค่ะ` });
          }
        }
      }

      // Handle cart actions
      if (cartAction) {
        console.log("Cart action:", cartAction);

        if (cartAction.type === 'add' && cartAction.productName) {
          // Handle multiple cart adds if available
          const addsToProcess = multiCartAdds || [cartAction];
          const addedProducts: string[] = [];
          
          for (const addAction of addsToProcess) {
            if (!addAction.productName) continue;
            
            // Find product - use exact match first, then partial
            let product = productList.find(p => p.name.toLowerCase() === addAction.productName!.toLowerCase());
            if (!product) {
              product = productList.find(p => 
                p.name.toLowerCase().includes(addAction.productName!.toLowerCase()) ||
                addAction.productName!.toLowerCase().includes(p.name.toLowerCase())
              );
            }

            if (product) {
              if (product.stock < (addAction.quantity || 1)) {
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
                      quantity: existingItem.quantity + (addAction.quantity || 1),
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
                    quantity: addAction.quantity || 1,
                    price: price,
                    variants: addAction.variants || null
                  });
                }
                addedProducts.push(product.name);
              }
            } else {
              lineMessages.push({ type: "text", text: `ขออภัยค่ะ ไม่พบสินค้า "${addAction.productName}" ค่ะ` });
            }
          }

          // Show combined confirmation for all added products
          if (addedProducts.length > 0) {
            // Get updated cart
            const { data: cartItems } = await supabase
              .from('shopping_carts')
              .select('*')
              .eq('platform_user_id', userId);

            const cartCount = cartItems?.reduce((sum, item) => sum + item.quantity, 0) || 0;
            const addedText = addedProducts.length === 1 
              ? `"${addedProducts[0]}"` 
              : addedProducts.map(n => `"${n}"`).join(' และ ');
            lineMessages.push({ 
              type: "text", 
              text: `✅ เพิ่ม ${addedText} ลงตะกร้าแล้วค่ะ! (ตะกร้ามี ${cartCount} ชิ้น)\n\nพิมพ์ "ดูตะกร้า" เพื่อดูรายการทั้งหมดค่ะ 🛒` 
            });
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

                // Save address for future orders (if new)
                if (cartAction.customerAddress) {
                  const { data: existingAddress } = await supabase
                    .from("customer_addresses")
                    .select("id")
                    .eq("platform_user_id", userId)
                    .eq("platform", "line")
                    .eq("address", cartAction.customerAddress)
                    .maybeSingle();

                  if (!existingAddress) {
                    // Check if this is first address (make it default)
                    const { count: addressCount } = await supabase
                      .from("customer_addresses")
                      .select("*", { count: "exact", head: true })
                      .eq("platform_user_id", userId)
                      .eq("platform", "line");

                    await supabase.from("customer_addresses").insert({
                      platform_user_id: userId,
                      platform: "line",
                      label: "บ้าน",
                      address: cartAction.customerAddress,
                      is_default: (addressCount || 0) === 0
                    });
                    console.log(`[LINE] Saved new address for user ${userId}`);
                  }
                }

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
                    couponCode: cartAction.couponCode || undefined,
                    bankInfo,
                    promptpayId,
                    isCOD
                  })
                });
              }
            }
          }
        }
      }

      // Handle single product order creation
      if (createOrder) {
        console.log("[LINE] Creating single product order:", createOrder);
        
        // Find product
        const product = productList.find(p => 
          p.name.toLowerCase().includes(createOrder!.productName.toLowerCase()) ||
          createOrder!.productName.toLowerCase().includes(p.name.toLowerCase())
        );
        
        if (product) {
          const price = product.promotion_price || product.price;
          const totalAmount = price * createOrder.quantity;
          
          // Check stock
          if (product.stock < createOrder.quantity) {
            lineMessages.push({ 
              type: "text", 
              text: `ขออภัยค่ะ สินค้า "${product.name}" เหลือเพียง ${product.stock} ชิ้น กรุณาปรับจำนวนค่ะ` 
            });
          } else {
            // Check for duplicate order before creating
            const duplicateCheck = await checkDuplicateOrder(supabase, userId, totalAmount, createOrder.customerPhone);
            
            if (duplicateCheck.isDuplicate) {
              console.log(`[LINE] Skipping duplicate order creation, existing: ${duplicateCheck.existingOrderNumber}`);
              lineMessages.push({ 
                type: "text", 
                text: `ออเดอร์ของคุณถูกสร้างแล้วค่ะ หมายเลข: ${duplicateCheck.existingOrderNumber} 📦\n\nหากต้องการสั่งใหม่ กรุณารอสักครู่แล้วลองใหม่ค่ะ` 
              });
            } else {
            // Create order
            const { data: order, error: orderError } = await supabase
              .from("orders")
              .insert({
                customer_name: createOrder.customerName,
                customer_address: createOrder.customerAddress,
                customer_phone: createOrder.customerPhone,
                customer_line_id: userId,
                platform: "line",
                total_amount: totalAmount
              })
              .select()
              .single();
            
            if (order && !orderError) {
              // Create order item
              await supabase.from("order_items").insert({
                order_id: order.id,
                product_id: product.id,
                product_name: product.name + (createOrder.variants ? ` (${createOrder.variants})` : ''),
                quantity: createOrder.quantity,
                price: price
              });
              
              // Update stock
              await supabase
                .from("products")
                .update({ stock: product.stock - createOrder.quantity })
                .eq("id", product.id);
              
              // Update conversation
              await supabase
                .from("chat_conversations")
                .update({
                  customer_name: createOrder.customerName,
                  customer_phone: createOrder.customerPhone,
                  customer_address: createOrder.customerAddress
                })
                .eq("id", conversation.id);
              
              // Save address for future orders (if new)
              if (createOrder.customerAddress) {
                const { data: existingAddr } = await supabase
                  .from("customer_addresses")
                  .select("id")
                  .eq("platform_user_id", userId)
                  .eq("platform", "line")
                  .eq("address", createOrder.customerAddress)
                  .maybeSingle();

                if (!existingAddr) {
                  const { count: addrCount } = await supabase
                    .from("customer_addresses")
                    .select("*", { count: "exact", head: true })
                    .eq("platform_user_id", userId)
                    .eq("platform", "line");

                  await supabase.from("customer_addresses").insert({
                    platform_user_id: userId,
                    platform: "line",
                    label: "บ้าน",
                    address: createOrder.customerAddress,
                    is_default: (addrCount || 0) === 0
                  });
                  console.log(`[LINE] Saved new address for user ${userId} (single order)`);
                }
              }
              
              console.log(`[LINE] Single order created: ${order.order_number}`);
              
              // Clear cart after order creation
              await supabase.from('shopping_carts').delete().eq('platform_user_id', userId);
              console.log(`[LINE] Cart cleared after single order for user ${userId}`);
              
              // Build order confirmation message
              lineMessages.push({
                type: "flex",
                altText: `สั่งซื้อสำเร็จ! ${order.order_number}`,
                contents: buildOrderConfirmationFlex({
                  orderNumber: order.order_number,
                  totalAmount: totalAmount,
                  discountAmount: 0,
                  customerName: createOrder.customerName,
                  customerPhone: createOrder.customerPhone,
                  customerAddress: createOrder.customerAddress,
                  items: [{
                    product_name: product.name,
                    quantity: createOrder.quantity,
                    price: price,
                    variants: createOrder.variants
                  }],
                  couponCode: createOrder.couponCode || undefined,
                  bankInfo,
                  promptpayId,
                  isCOD
                })
              });
            } else {
              console.error("[LINE] Error creating order:", orderError);
              lineMessages.push({ type: "text", text: "ขออภัยค่ะ ไม่สามารถสร้างออเดอร์ได้ กรุณาลองใหม่ค่ะ" });
            }
            } // Close duplicate check else block
          }
        } else {
          lineMessages.push({ type: "text", text: `ขออภัยค่ะ ไม่พบสินค้า "${createOrder.productName}" ค่ะ` });
        }
      }
      
      // Handle multi-product order creation
      if (createMultiOrder) {
        console.log("[LINE] Creating multi-product order:", createMultiOrder);
        
        // Find all products
        const orderItemsToCreate: Array<{
          product_id: string;
          product_name: string;
          quantity: number;
          price: number;
          variants?: string;
        }> = [];
        let totalAmount = 0;
        let stockOk = true;
        
        for (const item of createMultiOrder.items) {
          const product = productList.find(p => 
            p.name.toLowerCase().includes(item.productName.toLowerCase()) ||
            item.productName.toLowerCase().includes(p.name.toLowerCase())
          );
          
          if (product) {
            if (product.stock < item.quantity) {
              lineMessages.push({ 
                type: "text", 
                text: `ขออภัยค่ะ สินค้า "${product.name}" เหลือเพียง ${product.stock} ชิ้น กรุณาปรับจำนวนค่ะ` 
              });
              stockOk = false;
              break;
            }
            
            const price = product.promotion_price || product.price;
            const itemTotal = price * item.quantity;
            totalAmount += itemTotal;
            
            orderItemsToCreate.push({
              product_id: product.id,
              product_name: product.name + (item.variants ? ` (${item.variants})` : ''),
              quantity: item.quantity,
              price: price,
              variants: item.variants
            });
          } else {
            lineMessages.push({ type: "text", text: `ขออภัยค่ะ ไม่พบสินค้า "${item.productName}" ค่ะ` });
            stockOk = false;
            break;
          }
        }
        
        if (stockOk && orderItemsToCreate.length > 0) {
          // Check for duplicate order before creating
          const duplicateMultiCheck = await checkDuplicateOrder(supabase, userId, totalAmount, createMultiOrder.customerPhone);
          
          if (duplicateMultiCheck.isDuplicate) {
            console.log(`[LINE] Skipping duplicate multi-order creation, existing: ${duplicateMultiCheck.existingOrderNumber}`);
            lineMessages.push({ 
              type: "text", 
              text: `ออเดอร์ของคุณถูกสร้างแล้วค่ะ หมายเลข: ${duplicateMultiCheck.existingOrderNumber} 📦\n\nหากต้องการสั่งใหม่ กรุณารอสักครู่แล้วลองใหม่ค่ะ` 
            });
          } else {
          // Create order
          const { data: order, error: orderError } = await supabase
            .from("orders")
            .insert({
              customer_name: createMultiOrder.customerName,
              customer_address: createMultiOrder.customerAddress,
              customer_phone: createMultiOrder.customerPhone,
              customer_line_id: userId,
              platform: "line",
              total_amount: totalAmount
            })
            .select()
            .single();
          
          if (order && !orderError) {
            // Insert all order items and update stock
            for (const item of orderItemsToCreate) {
              await supabase.from("order_items").insert({
                order_id: order.id,
                product_id: item.product_id,
                product_name: item.product_name,
                quantity: item.quantity,
                price: item.price
              });
              
              // Get current stock and update
              const { data: currentProduct } = await supabase
                .from("products")
                .select("stock")
                .eq("id", item.product_id)
                .single();
              
              if (currentProduct) {
                await supabase
                  .from("products")
                  .update({ stock: currentProduct.stock - item.quantity })
                  .eq("id", item.product_id);
              }
            }
            
            // Update conversation
            await supabase
              .from("chat_conversations")
              .update({
                customer_name: createMultiOrder.customerName,
                customer_phone: createMultiOrder.customerPhone,
                customer_address: createMultiOrder.customerAddress
              })
              .eq("id", conversation.id);
            
            // Save address for future orders (if new)
            if (createMultiOrder.customerAddress) {
              const { data: existingMultiAddr } = await supabase
                .from("customer_addresses")
                .select("id")
                .eq("platform_user_id", userId)
                .eq("platform", "line")
                .eq("address", createMultiOrder.customerAddress)
                .maybeSingle();

              if (!existingMultiAddr) {
                const { count: multiAddrCount } = await supabase
                  .from("customer_addresses")
                  .select("*", { count: "exact", head: true })
                  .eq("platform_user_id", userId)
                  .eq("platform", "line");

                await supabase.from("customer_addresses").insert({
                  platform_user_id: userId,
                  platform: "line",
                  label: "บ้าน",
                  address: createMultiOrder.customerAddress,
                  is_default: (multiAddrCount || 0) === 0
                });
                console.log(`[LINE] Saved new address for user ${userId} (multi order)`);
              }
            }
            
            console.log(`[LINE] Multi-product order created: ${order.order_number}`);
            
            // Clear cart after order creation
            await supabase.from('shopping_carts').delete().eq('platform_user_id', userId);
            console.log(`[LINE] Cart cleared after multi order for user ${userId}`);
            
            // Build order confirmation message
            lineMessages.push({
              type: "flex",
              altText: `สั่งซื้อสำเร็จ! ${order.order_number}`,
              contents: buildOrderConfirmationFlex({
                orderNumber: order.order_number,
                totalAmount: totalAmount,
                discountAmount: 0,
                customerName: createMultiOrder.customerName,
                customerPhone: createMultiOrder.customerPhone,
                customerAddress: createMultiOrder.customerAddress,
                items: orderItemsToCreate.map(item => ({
                  product_name: item.product_name.replace(/ \([^)]+\)$/, ''),
                  quantity: item.quantity,
                  price: item.price,
                  variants: item.variants
                })),
                couponCode: createMultiOrder.couponCode || undefined,
                bankInfo,
                promptpayId,
                isCOD
              })
            });
          } else {
            console.error("[LINE] Error creating multi-order:", orderError);
            lineMessages.push({ type: "text", text: "ขออภัยค่ะ เกิดข้อผิดพลาดในการสร้างออเดอร์ กรุณาลองใหม่ค่ะ" });
          }
          } // Close duplicate check else block
        }
      }

      // Add product display if needed (only if no cart action and no order creation handled)
      if (!cartAction && !createOrder && !createMultiOrder) {
        if (specificProduct) {
          // Send product image as standalone Image Message first (more visible on LINE)
          if (specificProduct.image_url) {
            const imgMsg = buildImageMessage(specificProduct.image_url, specificProduct.name);
            if (imgMsg) lineMessages.push(imgMsg);
          }
          lineMessages.push({
            type: "flex",
            altText: specificProduct.name,
            contents: buildProductFlexMessage(specificProduct)
          });
        } else if (showPromotions && promotionProducts.length > 0) {
          // Send first promotion product image as preview
          const firstPromo = promotionProducts.find(p => p.image_url);
          if (firstPromo?.image_url) {
            const imgMsg = buildImageMessage(firstPromo.image_url, 'สินค้าโปรโมชั่น');
            if (imgMsg) lineMessages.push(imgMsg);
          }
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
