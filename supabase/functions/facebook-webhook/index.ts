import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hub-signature-256",
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
  console.log('[FB] Cache cleared due to invalidation');
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

// Decryption utilities
async function getKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
  return await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
}

async function decrypt(encryptedText: string): Promise<string> {
  if (!encryptedText) return '';
  
  try {
    const key = await getKey();
    const combined = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));
    
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );
    
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    return encryptedText;
  }
}

async function getDecryptedSetting(supabase: any, key: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  
  if (error || !data?.value) return null;
  
  return await decrypt(data.value);
}

// Verify Facebook webhook signature
async function verifyFacebookSignature(body: string, signature: string, appSecret: string): Promise<boolean> {
  try {
    const expectedSignature = "sha256=" + createHmac("sha256", appSecret)
      .update(body)
      .digest("hex");
    return signature === expectedSignature;
  } catch (error) {
    console.error("Facebook signature verification error:", error);
    return false;
  }
}

const statusMap: Record<string, { text: string; emoji: string }> = {
  'pending': { text: 'รอยืนยัน', emoji: '⏳' },
  'confirmed': { text: 'ยืนยันแล้ว', emoji: '✅' },
  'shipped': { text: 'จัดส่งแล้ว', emoji: '🚚' },
  'delivered': { text: 'ได้รับแล้ว', emoji: '📦' },
  'cancelled': { text: 'ยกเลิก', emoji: '❌' }
};

interface Product {
  id: string;
  name: string;
  price: number;
  promotion_price?: number;
  description?: string;
  image_url?: string;
  category?: string;
  stock: number;
  variants?: { name: string; options: string[] }[] | null;
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

// Validate coupon
async function validateCoupon(code: string, orderAmount: number, supabase: any): Promise<{ valid: boolean; coupon?: any; discountAmount?: number; errorMessage?: string }> {
  const { data: coupon } = await supabase
    .from("coupons")
    .select("*")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (!coupon) return { valid: false, errorMessage: `ไม่พบโค้ดส่วนลด "${code}" ค่ะ` };
  if (!coupon.is_active) return { valid: false, errorMessage: "โค้ดส่วนลดนี้ถูกปิดใช้งานแล้วค่ะ" };
  
  const now = new Date();
  if (coupon.valid_from && new Date(coupon.valid_from) > now) return { valid: false, errorMessage: "โค้ดส่วนลดนี้ยังไม่เริ่มใช้งานค่ะ" };
  if (coupon.valid_until && new Date(coupon.valid_until) < now) return { valid: false, errorMessage: "โค้ดส่วนลดนี้หมดอายุแล้วค่ะ" };
  if (coupon.max_uses && coupon.used_count >= coupon.max_uses) return { valid: false, errorMessage: "โค้ดส่วนลดนี้ถูกใช้ครบจำนวนแล้วค่ะ" };
  if (coupon.min_order_amount && orderAmount < coupon.min_order_amount) return { valid: false, errorMessage: `ยอดสั่งซื้อขั้นต่ำสำหรับโค้ดนี้คือ ฿${coupon.min_order_amount.toLocaleString()} ค่ะ` };

  let discountAmount = coupon.discount_type === 'percentage' ? (orderAmount * coupon.discount_value) / 100 : coupon.discount_value;
  discountAmount = Math.min(discountAmount, orderAmount);

  return { valid: true, coupon, discountAmount };
}

interface ProductAction {
  action: 'show_all' | 'show_single' | 'show_promotions';
  productName?: string;
}

interface SavedAddress {
  id: string;
  label: string;
  address: string;
  isDefault: boolean;
}

interface SaveAddressAction {
  label: string;
  address: string;
}

interface CustomerContext {
  isReturning: boolean;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  messageCount?: number;
  cartItemCount?: number;
  savedAddresses?: SavedAddress[];
}

// ============= Build System Prompt (Same as LINE and Web Chat) =============
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

## 📝 การรับออเดอร์ (ถามทีละข้อ - สำคัญมาก!):
1. **ถามตัวเลือกก่อน** → ถ้าสินค้ามีหลายสี/ไซส์ ต้องถามว่าต้องการแบบไหน
2. **ยืนยันจำนวนและรายการก่อนถามข้อมูลจัดส่ง (บังคับ!)** → ต้องสรุปและถามยืนยันจำนวนทุกครั้ง
   - ตัวอย่าง: "ขอยืนยันนะ${particleQuestion} สั่งเสื้อยืดคอกลม สีขาว ไซส์ M 1 ตัว และสีดำ ไซส์ M 1 ตัว รวม 2 ตัว ถูกต้องไหม${particleQuestion}?"
   - **ห้ามข้ามขั้นตอนนี้** → ต้องได้รับการยืนยันจากลูกค้าก่อนถามข้อมูลจัดส่ง
3. (หลังลูกค้ายืนยันจำนวนแล้ว) ถามชื่อ-นามสกุล
4. ถามที่อยู่จัดส่ง (พร้อมรหัสไปรษณีย์)
5. ถามเบอร์โทรศัพท์
6. สรุปออเดอร์และยอดรวม
7. **สร้างออเดอร์โดยใส่ [CREATE_ORDER:ชื่อสินค้าเต็ม|จำนวน|ชื่อลูกค้า|ที่อยู่|เบอร์โทร|ตัวเลือก] ต่อท้ายข้อความ** → ระบบจะสร้างออเดอร์และแจ้งเลขออเดอร์ให้อัตโนมัติ

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

## 📦 การตรวจสอบสต็อก (สำคัญมาก!):
- **ตรวจสอบสต็อกก่อนยืนยัน**: ถ้าจำนวนสต็อกในข้อมูลสินค้า (stock) น้อยกว่าที่ลูกค้าสั่ง → แจ้งลูกค้าทันที
- **ถ้าสินค้าหมด (stock = 0)**: ตอบว่า "ขออภัย${particleEnd} สินค้า [ชื่อสินค้า] หมดชั่วคราว${particleEnd}" แล้ว **แนะนำสินค้าทดแทนในหมวดหมู่เดียวกัน** (ดูจากข้อมูลสินค้าที่มี category เดียวกันและ stock > 0)
  - ตัวอย่าง: "ขออภัย${particleEnd} สินค้าหมดชั่วคราว${particleEnd} แนะนำ [ชื่อสินค้าทดแทน] ในหมวดเดียวกัน ราคา ฿[ราคา] สนใจไหม${particleQuestion}?"
  - **ถ้าไม่มีสินค้าทดแทน** → ตอบว่า "ขออภัย${particleEnd} สินค้าหมดชั่วคราว ยังไม่มีสินค้าทดแทนในขณะนี้${particleEnd} สนใจสินค้าอื่นไหม${particleQuestion}?"
- **ถ้าสินค้าไม่พอ**: ตอบว่า "ขออภัย${particleEnd} สินค้า [ชื่อสินค้า] เหลือ [จำนวน] ชิ้นสุดท้าย${particleEnd} ต้องการสั่ง [จำนวนที่มี] ชิ้นไหม${particleQuestion}?" พร้อม **แนะนำสินค้าทดแทน** ถ้ามี
- **อย่าแจ้งจำนวนสต็อกถ้าลูกค้าไม่ได้สั่งเกิน** → ตอบแค่ "สินค้ามีพร้อมจำหน่าย${particleEnd}"

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
- **ถ้าลูกค้ายืนยันโอนเงิน/ชำระเงิน และข้อมูลครบแล้ว** → ต้องใส่คำสั่งสร้างออเดอร์ในข้อความตอบกลับ

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

// Format order status message
function formatOrderStatusMessage(order: any, orderItems: any[]): string {
  const statusInfo = statusMap[order.status] || statusMap['pending'];
  
  let message = `${statusInfo.emoji} สถานะออเดอร์\n`;
  message += `━━━━━━━━━━━━━━━\n`;
  message += `📋 ${order.order_number}\n`;
  message += `สถานะ: ${statusInfo.text}\n`;
  
  if (order.tracking_number) {
    message += `🚚 เลขพัสดุ: ${order.tracking_number}\n`;
  }
  
  message += `\n📦 รายการสินค้า:\n`;
  for (const item of orderItems) {
    message += `• ${item.product_name} x${item.quantity} = ฿${(item.price * item.quantity).toLocaleString()}\n`;
  }
  
  message += `\n💰 ยอดรวม: ฿${Number(order.total_amount).toLocaleString()}\n`;
  message += `🕐 สั่งเมื่อ: ${new Date(order.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  
  return message;
}

// Format order history message
function formatOrderHistoryMessage(orders: any[]): string {
  let message = `📋 ประวัติออเดอร์ของคุณ (${orders.length} รายการล่าสุด)\n`;
  message += `━━━━━━━━━━━━━━━\n\n`;
  
  for (const order of orders) {
    const statusInfo = statusMap[order.status] || statusMap['pending'];
    message += `${statusInfo.emoji} ${order.order_number}\n`;
    message += `   สถานะ: ${statusInfo.text}\n`;
    message += `   ยอดรวม: ฿${Number(order.total_amount).toLocaleString()}\n`;
    if (order.tracking_number) {
      message += `   เลขพัสดุ: ${order.tracking_number}\n`;
    }
    message += `   วันที่: ${new Date(order.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}\n\n`;
  }
  
  message += `💡 พิมพ์เลขออเดอร์เพื่อดูรายละเอียดค่ะ`;
  return message;
}

// Format cart summary message with better quantity display
function formatCartSummaryMessage(cartItems: Array<{product_name: string; quantity: number; price: number; variants?: string}>, totalAmount: number): string {
  if (cartItems.length === 0) {
    return `🛒 ตะกร้าว่างเปล่าค่ะ\n\nพิมพ์ "ดูสินค้า" เพื่อเลือกสินค้าได้เลยค่ะ 😊`;
  }

  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  
  let message = `🛒 ตะกร้าสินค้าของคุณ (${totalItems} ชิ้น)\n`;
  message += `━━━━━━━━━━━━━━━\n\n`;
  
  for (const item of cartItems) {
    message += `• ${item.product_name}`;
    if (item.variants) message += ` (${item.variants})`;
    message += `\n`;
    message += `   จำนวน: ${item.quantity} ชิ้น × ฿${item.price.toLocaleString()} = ฿${(item.price * item.quantity).toLocaleString()}\n\n`;
  }
  
  message += `━━━━━━━━━━━━━━━\n`;
  message += `📦 รวม: ${totalItems} ชิ้น\n`;
  message += `💰 ยอดรวม: ฿${totalAmount.toLocaleString()}\n\n`;
  message += `📝 พิมพ์ "สั่งซื้อตะกร้า ชื่อ ที่อยู่ เบอร์โทร" เพื่อสั่งซื้อ\n`;
  message += `🗑️ พิมพ์ "ล้างตะกร้า" เพื่อล้างตะกร้า`;
  
  return message;
}

// Enhanced order confirmation message interface
interface OrderConfirmationData {
  orderNumber: string;
  items: Array<{
    product_name: string;
    quantity: number;
    price: number;
    variants?: string;
  }>;
  totalAmount: number;
  discountAmount?: number;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  couponCode?: string;
  bankAccounts?: string;
}

// Format order confirmation message (enhanced to match LINE)
function formatOrderConfirmationMessage(data: OrderConfirmationData): string {
  const { orderNumber, items, totalAmount, discountAmount, customerName, customerPhone, customerAddress, couponCode, bankAccounts } = data;
  
  let message = `✅ ยืนยันการสั่งซื้อสำเร็จ!\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  
  // Order number
  message += `📋 หมายเลขออเดอร์: ${orderNumber}\n\n`;
  
  // Items list with details
  message += `📦 รายการสินค้า:\n`;
  message += `──────────────────\n`;
  for (const item of items) {
    const itemTotal = item.price * item.quantity;
    message += `• ${item.product_name}\n`;
    if (item.variants) {
      message += `  🎨 ${item.variants}\n`;
    }
    message += `  📦 จำนวน: ${item.quantity} ชิ้น\n`;
    message += `  💵 ราคา: ฿${itemTotal.toLocaleString()}\n\n`;
  }
  
  // Price summary
  message += `──────────────────\n`;
  message += `💰 สรุปยอดชำระ:\n`;
  
  // Calculate subtotal
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  message += `   รวมสินค้า: ฿${subtotal.toLocaleString()}\n`;
  
  // Show discount if applicable
  if (discountAmount && discountAmount > 0) {
    message += `   🎉 ส่วนลด${couponCode ? ` (${couponCode})` : ''}: -฿${discountAmount.toLocaleString()}\n`;
  }
  
  message += `   ──────────────\n`;
  message += `   💎 ยอดชำระสุทธิ: ฿${totalAmount.toLocaleString()}\n\n`;
  
  // Customer information
  message += `🚚 ข้อมูลจัดส่ง:\n`;
  message += `──────────────────\n`;
  message += `👤 ชื่อ: ${customerName}\n`;
  message += `📞 เบอร์โทร: ${customerPhone}\n`;
  message += `📍 ที่อยู่: ${customerAddress}\n\n`;
  
  // Payment information
  message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `💳 ช่องทางชำระเงิน:\n`;
  message += `──────────────────\n`;
  if (bankAccounts) {
    // Parse and format bank accounts nicely
    const lines = bankAccounts.split('\n');
    for (const line of lines) {
      if (line.trim()) {
        message += `${line.trim()}\n`;
      }
    }
  } else {
    message += `กรุณาติดต่อร้านค้าเพื่อสอบถามช่องทางชำระเงิน\n`;
  }
  
  message += `\n🔔 หลังโอนเงินแล้ว กรุณาส่งสลิปมาในแชทนี้ค่ะ\n`;
  message += `📝 พิมพ์ "ประวัติออเดอร์" เพื่อดูออเดอร์ทั้งหมด\n\n`;
  message += `ขอบคุณที่ใช้บริการค่ะ 🙏✨`;
  
  return message;
}

// Send text message to Facebook with optional quick replies
async function sendToFacebook(recipientId: string, message: string, accessToken: string, quickReplies?: Array<{ title: string; payload: string }>) {
  if (!accessToken) {
    console.error("FB_PAGE_ACCESS_TOKEN not configured");
    return;
  }

  const messagePayload: any = { text: message };
  
  // Add quick replies if provided
  if (quickReplies && quickReplies.length > 0) {
    messagePayload.quick_replies = quickReplies.map(qr => ({
      content_type: "text",
      title: qr.title,
      payload: qr.payload
    }));
  }

  const response = await fetch(
    `https://graph.facebook.com/v18.0/me/messages?access_token=${accessToken}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: messagePayload,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("Facebook send error:", error);
  }
}

// Send Product Carousel (Generic Template) to Facebook
async function sendProductCarouselToFacebook(recipientId: string, products: Product[], accessToken: string) {
  if (!accessToken || products.length === 0) return;

  const elements = products.slice(0, 10).map(product => {
    const price = product.promotion_price || product.price;
    const originalPrice = product.promotion_price ? product.price : null;
    const hasPromotion = originalPrice && product.promotion_price && product.promotion_price < product.price;
    const discountPercent = hasPromotion 
      ? Math.round(((product.price - product.promotion_price!) / product.price) * 100) 
      : 0;
    const savingsAmount = hasPromotion ? product.price - product.promotion_price! : 0;
    const isLowStock = product.stock > 0 && product.stock <= 5;
    const isOutOfStock = product.stock === 0;
    
    let subtitle = '';
    
    // Price with promotion info
    if (hasPromotion) {
      subtitle = `🔥 ลด ${discountPercent}% | ฿${price.toLocaleString()} (เดิม ฿${originalPrice.toLocaleString()})`;
    } else {
      subtitle = `💰 ฿${price.toLocaleString()}`;
    }
    
    // Add variant info if exists
    if (product.variants && Array.isArray(product.variants) && product.variants.length > 0) {
      const variantTexts: string[] = [];
      for (const v of product.variants) {
        if (v && v.name && v.options && Array.isArray(v.options)) {
          variantTexts.push(`${v.name}: ${v.options.join(', ')}`);
        }
      }
      if (variantTexts.length > 0) {
        subtitle += `\n🎨 ${variantTexts.join(' | ')}`;
      }
    }
    
    // Stock status
    if (isOutOfStock) {
      subtitle += `\n❌ สินค้าหมด`;
    } else if (isLowStock) {
      subtitle += `\n⚡ เหลือ ${product.stock} ชิ้น`;
    } else {
      subtitle += `\n✅ พร้อมส่ง`;
    }

    const element: any = {
      title: `${product.name}${product.category ? ` • ${product.category}` : ''}`.slice(0, 80),
      subtitle: subtitle.slice(0, 80),
      buttons: [
        {
          type: "postback",
          title: isOutOfStock ? "สินค้าหมด" : "🛒 สั่งซื้อเลย",
          payload: `ORDER_${product.id}`
        },
        {
          type: "postback", 
          title: "📦 ดูรายละเอียด",
          payload: `DETAIL_${product.id}`
        }
      ]
    };

    if (product.image_url) {
      element.image_url = product.image_url;
    }

    return element;
  });

  const response = await fetch(
    `https://graph.facebook.com/v18.0/me/messages?access_token=${accessToken}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: {
          attachment: {
            type: "template",
            payload: {
              template_type: "generic",
              elements: elements
            }
          }
        }
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("Facebook carousel send error:", error);
  }
}

// Send Single Product Card to Facebook
async function sendSingleProductToFacebook(recipientId: string, product: Product, accessToken: string) {
  if (!accessToken) return;

  const price = product.promotion_price || product.price;
  const originalPrice = product.promotion_price ? product.price : null;
  const hasPromotion = originalPrice && product.promotion_price && product.promotion_price < product.price;
  const discountPercent = hasPromotion 
    ? Math.round(((product.price - product.promotion_price!) / product.price) * 100) 
    : 0;
  const savingsAmount = hasPromotion ? product.price - product.promotion_price! : 0;
  const isLowStock = product.stock > 0 && product.stock <= 5;
  const isOutOfStock = product.stock === 0;

  let subtitle = "";
  
  // Price section
  if (hasPromotion) {
    subtitle += `🔥 ลด ${discountPercent}% | ฿${price.toLocaleString()} (เดิม ฿${originalPrice.toLocaleString()})\n`;
    subtitle += `💰 ประหยัด ฿${savingsAmount.toLocaleString()}\n`;
  } else {
    subtitle += `💰 ราคา: ฿${price.toLocaleString()}\n`;
  }
  
  // Description
  if (product.description) {
    subtitle += `📝 ${product.description.slice(0, 30)}\n`;
  }

  // Add variant info if exists
  if (product.variants && product.variants.length > 0) {
    const variantText = product.variants.map(v => `${v.name}: ${v.options.join(', ')}`).join(' | ');
    subtitle += `🎨 ${variantText}\n`;
  }
  
  // Stock status
  if (isOutOfStock) {
    subtitle += `❌ สินค้าหมด`;
  } else if (isLowStock) {
    subtitle += `⚡ เหลือ ${product.stock} ชิ้นสุดท้าย!`;
  } else {
    subtitle += `✅ พร้อมจัดส่ง`;
  }

  const element: any = {
    title: `${product.name}${product.category ? ` • ${product.category}` : ''}`.slice(0, 80),
    subtitle: subtitle.slice(0, 80),
    buttons: [
      {
        type: "postback",
        title: isOutOfStock ? "สินค้าหมด" : "🛒 สั่งซื้อเลย",
        payload: `ORDER_${product.id}`
      },
      {
        type: "postback",
        title: "🛍️ เพิ่มลงตะกร้า",
        payload: `ADD_CART_${product.id}`
      }
    ]
  };

  if (product.image_url) {
    element.image_url = product.image_url;
  }

  const response = await fetch(
    `https://graph.facebook.com/v18.0/me/messages?access_token=${accessToken}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: {
          attachment: {
            type: "template",
            payload: {
              template_type: "generic",
              elements: [element]
            }
          }
        }
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("Facebook single product send error:", error);
  }
}

// Send Promotion Products Carousel to Facebook
async function sendPromotionCarouselToFacebook(recipientId: string, products: Product[], accessToken: string) {
  const promotionProducts = products.filter(p => p.promotion_price && p.promotion_price < p.price);
  if (promotionProducts.length === 0) {
    await sendToFacebook(recipientId, "ขออภัยค่ะ ตอนนี้ไม่มีสินค้าโปรโมชั่นค่ะ 😊", accessToken);
    return;
  }
  await sendProductCarouselToFacebook(recipientId, promotionProducts, accessToken);
}

async function getAIResponse(
  messages: Array<{ role: string; content: string }>, 
  supabase: any,
  customerContext: CustomerContext,
  isFirstMessage: boolean = false,
  senderId: string = ''
): Promise<{ text: string; createOrder?: OrderData; createMultiOrder?: MultiOrderData; cartAction?: CartAction; productAction?: ProductAction; saveAddress?: SaveAddressAction }> {
  if (!LOVABLE_API_KEY) {
    return { text: "ขออภัยครับ ระบบยังไม่พร้อมให้บริการ" };
  }

  // Check for cache invalidation before using cache
  await checkCacheInvalidation(supabase);

  // ============= Try to get data from cache first =============
  let aiSettingsData = getCached<any>('fb_ai_settings');
  let products = getCached<any[]>('fb_products');
  let faqs = getCached<any[]>('fb_faqs');
  let settingsData = getCached<any[]>('fb_settings');

  const needsAiSettings = !aiSettingsData;
  const needsProducts = !products;
  const needsFaqs = !faqs;
  const needsSettings = !settingsData;

  if (needsAiSettings || needsProducts || needsFaqs || needsSettings) {
    const cacheMisses = [];
    if (needsAiSettings) cacheMisses.push('ai_settings');
    if (needsProducts) cacheMisses.push('products');
    if (needsFaqs) cacheMisses.push('faqs');
    if (needsSettings) cacheMisses.push('settings');
    console.log(`[FB] Cache miss: ${cacheMisses.join(', ')}`);

    const [
      aiSettingsResult,
      productsResult,
      faqsResult,
      settingsResult
    ] = await Promise.all([
      needsAiSettings ? supabase.from("ai_settings").select("*").eq("is_active", true).maybeSingle() : Promise.resolve({ data: aiSettingsData }),
      needsProducts ? supabase.from("products").select("*").eq("is_active", true) : Promise.resolve({ data: products }),
      needsFaqs ? supabase.from("faqs").select("question, answer").eq("is_active", true) : Promise.resolve({ data: faqs }),
      needsSettings ? supabase.from("settings").select("key, value").in("key", ["STORE_NAME", "SHIPPING_INFO", "BANK_ACCOUNTS", "PAYMENT_METHODS", "RETURN_POLICY"]) : Promise.resolve({ data: settingsData })
    ]);

    if (needsAiSettings && aiSettingsResult.data) {
      aiSettingsData = aiSettingsResult.data;
      setCache('fb_ai_settings', aiSettingsData, 2 * 60 * 1000); // 2 min
    }
    if (needsProducts) {
      products = productsResult.data || [];
      setCache('fb_products', products);
    }
    if (needsFaqs) {
      faqs = faqsResult.data || [];
      setCache('fb_faqs', faqs);
    }
    if (needsSettings) {
      settingsData = settingsResult.data || [];
      setCache('fb_settings', settingsData);
    }
  } else {
    console.log('[FB] All data served from cache!');
  }

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
  faqs = faqs || [];
  settingsData = settingsData || [];
  const faqList = faqs.map((f: any) => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n');

  // Build product catalog with variants info for AI
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
    
    return info;
  }).join('\n') || 'ยังไม่มีสินค้า';

  // Process store settings
  const settingsMap: Map<string, string> = new Map(settingsData.map((s: any) => [s.key, s.value as string]));
  const storeSettings: StoreSettings = {
    storeName: settingsMap.get("STORE_NAME") || "",
    shippingInfo: settingsMap.get("SHIPPING_INFO") || "",
    bankAccounts: settingsMap.get("BANK_ACCOUNTS") || "",
    paymentMethods: settingsMap.get("PAYMENT_METHODS") || "",
    returnPolicy: settingsMap.get("RETURN_POLICY") || "",
  };

  // Build system prompt using the same function as LINE and web chat
  const systemPrompt = buildSystemPrompt(aiSettings, productCatalog, faqList, storeSettings, isFirstMessage);

  // ============= Extract Last Discussed Product from History =============
  // This is CRITICAL to avoid product confusion (e.g., เสื้อยืด vs เสื้อเชิ้ต)
  let lastDiscussedProduct: Product | null = null;
  if (messages && messages.length > 0) {
    // Scan history from newest to oldest to find the last product mentioned
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
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

  // Build AI messages with context reminder
  const aiMessages: Array<{ role: string; content: string }> = [...messages];
  
  // Get the last user message for quantity parsing reminder
  const lastUserMessage = messages.length > 0 ? messages[messages.length - 1]?.content : '';
  
  // Pre-analyze quantities from the last user message to include in the reminder
  const quantityAnalysis: string[] = [];
  if (lastUserMessage) {
    // Match patterns like "สินค้า 1 ตัว", "1 ตัว", "อย่างละ 1"
    const lines = lastUserMessage.split(/[\n,และ]/);
    let totalItems = 0;
    for (const line of lines) {
      // Match patterns: "X ตัว", "X ชิ้น", "จำนวน X"
      const qtyMatch = line.match(/(\d+)\s*(ตัว|ชิ้น|คู่|อัน|ชุด|กล่อง|แพ็ค)/);
      if (qtyMatch) {
        const qty = parseInt(qtyMatch[1]);
        totalItems += qty;
        quantityAnalysis.push(`พบ "${qtyMatch[0]}" = ${qty}`);
      }
    }
    if (quantityAnalysis.length > 0) {
      quantityAnalysis.push(`รวมทั้งหมด = ${totalItems} ชิ้น`);
    }
  }
  
  // Add critical quantity reminder BEFORE the AI processes the message
  // Include pre-analyzed quantities to make it explicit
  const analysisText = quantityAnalysis.length > 0 ? `\n\n🔢 การวิเคราะห์จำนวนจากระบบ:\n${quantityAnalysis.join('\n')}\n\n⚠️ คุณต้องใช้ตัวเลขตามที่ระบบวิเคราะห์นี้เท่านั้น! ห้ามเพิ่มหรือบวกจำนวนเอง!` : '';
  
  const quantityReminder = `[🚨 คำสั่งบังคับที่ต้องปฏิบัติตามเด็ดขาด - ละเมิดไม่ได้!]

ข้อความล่าสุดของลูกค้า: "${lastUserMessage}"
${analysisText}

📋 กฎที่ต้องทำตามเป๊ะ:
1. ถ้าลูกค้าพิมพ์ "1 ตัว" → ต้องยืนยัน 1 ตัว ห้ามเป็น 2 ตัว!
2. ถ้าลูกค้าพิมพ์ "อย่างละ 1" → แต่ละรายการ 1 ตัว ไม่ใช่ 2 ตัว!
3. ถ้ามีหลายรายการ เช่น "A 1 ตัว B 1 ตัว C 1 ตัว" → A=1, B=1, C=1 รวม 3 ตัว ไม่ใช่ 6 ตัว!
4. ห้ามบวกจำนวนจากประวัติสนทนาเก่า
5. ห้ามคูณจำนวนโดยไม่มีเหตุผล

❌ ถ้าคุณยืนยันจำนวนผิด (เช่น พิมพ์ "1 ตัว" แต่ยืนยัน "2 ตัว") ถือว่าล้มเหลว!`;
  
  // Insert quantity reminder before processing
  if (aiMessages.length > 0) {
    aiMessages.splice(aiMessages.length - 1, 0, { role: "system", content: quantityReminder });
    console.log(`[FB] Quantity reminder added. Analysis: ${quantityAnalysis.join(', ')}`);
  }
  
  // Add context reminder about last discussed product BEFORE user's new message
  // This explicitly tells AI what product context to use
  if (lastDiscussedProduct && aiMessages.length > 0) {
    const contextReminder = `[CONTEXT: กำลังคุยเรื่องสินค้า "${lastDiscussedProduct.name}" - ถ้าลูกค้าบอกแค่สี/ไซส์/จำนวน ให้อ้างอิงถึงสินค้านี้เสมอ ห้ามเปลี่ยนเป็นสินค้าอื่น!]`;
    // Insert context before the last user message
    const lastUserIndex = aiMessages.length - 1;
    aiMessages.splice(lastUserIndex, 0, { role: "system", content: contextReminder });
    console.log(`[FB] Context reminder: Currently discussing "${lastDiscussedProduct.name}"`);
  }

  try {
    // Use google/gemini-2.5-flash for faster response (typically 2-5 seconds vs 15-30 seconds)
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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

    if (!response.ok) {
      console.error("AI error:", await response.text());
      return { text: "ขออภัยครับ ระบบมีปัญหาชั่วคราว กรุณาลองใหม่อีกครั้ง" };
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || "ขออภัยครับ ไม่สามารถประมวลผลได้";

    // Parse special commands
    const createOrderMatch = content.match(/\[CREATE_ORDER:([^\]]+)\]/);
    const createMultiOrderMatch = content.match(/\[CREATE_MULTI_ORDER:([^\]]+)\]/);
    const addCartMatch = content.match(/\[CART_ADD:([^\]]+)\]/) || content.match(/\[ADD_CART:([^\]]+)\]/);
    const removeCartMatch = content.match(/\[CART_REMOVE:([^\]]+)\]/);
    const updateCartMatch = content.match(/\[CART_UPDATE:([^\]]+)\]/);
    const viewCartMatch = content.match(/\[CART_VIEW\]/) || content.match(/\[VIEW_CART\]/);
    const clearCartMatch = content.match(/\[CART_CLEAR\]/) || content.match(/\[CLEAR_CART\]/);
    const checkoutCartMatch = content.match(/\[CART_CHECKOUT:([^\]]+)\]/) || content.match(/\[CHECKOUT_CART:([^\]]+)\]/);
    const showProductsMatch = content.match(/\[SHOW_PRODUCTS\]/);
    const showPromotionsMatch = content.match(/\[SHOW_PROMOTIONS\]/);
    const showSingleProductMatch = content.match(/\[PRODUCT:([^\]]+)\]/) || content.match(/\[SHOW_PRODUCT:([^\]]+)\]/);
    const outOfStockMatch = content.match(/\[NOTIFY_OUT_OF_STOCK:([^\]]+)\]/);

    // Handle out of stock notification
    if (outOfStockMatch) {
      const parts = outOfStockMatch[1].split('|');
      if (parts.length >= 3) {
        const productName = parts[0].trim();
        const requestedQty = parseInt(parts[1].trim()) || 0;
        const remainingStock = parseInt(parts[2].trim()) || 0;
        
        console.log(`[FB] Out of stock notification: ${productName}, requested: ${requestedQty}, remaining: ${remainingStock}`);
        
        // Create admin notification
        await supabase.from('admin_notifications').insert({
          type: 'out_of_stock_request',
          title: '⚠️ ลูกค้าสั่งสินค้าที่สต็อกไม่พอ',
          message: `ลูกค้าต้องการสั่ง "${productName}" จำนวน ${requestedQty} ชิ้น แต่คงเหลือเพียง ${remainingStock} ชิ้น`,
          data: {
            product_name: productName,
            requested_quantity: requestedQty,
            remaining_stock: remainingStock,
            platform: 'facebook',
            customer_id: senderId
          }
        });
      }
    }
    // Parse order data if present
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
          console.log('[FB] Parsed multi-order:', createMultiOrder);
        }
      }
    } else if (createOrderMatch) {
      const orderParts = createOrderMatch[1].split('|');
      if (orderParts.length >= 5) {
        createOrder = {
          productName: orderParts[0].trim(),
          quantity: parseInt(orderParts[1].trim()) || 1,
          customerName: orderParts[2].trim(),
          customerAddress: orderParts[3].trim(),
          customerPhone: orderParts[4].trim(),
          variants: orderParts[5]?.trim() || undefined
        };
      }
    }

    // Parse cart action if present
    let cartAction: CartAction | undefined;
    if (addCartMatch) {
      const parts = addCartMatch[1].split('|');
      cartAction = {
        type: 'add',
        productName: parts[0]?.trim(),
        quantity: parseInt(parts[1]?.trim()) || 1,
        variants: parts[2]?.trim() || undefined
      };
    } else if (removeCartMatch) {
      cartAction = {
        type: 'remove',
        productName: removeCartMatch[1].trim()
      };
    } else if (updateCartMatch) {
      const parts = updateCartMatch[1].split('|');
      cartAction = {
        type: 'update',
        productName: parts[0]?.trim(),
        quantity: parseInt(parts[1]?.trim()) || 1
      };
    } else if (viewCartMatch) {
      cartAction = { type: 'view' };
    } else if (clearCartMatch) {
      cartAction = { type: 'clear' };
    } else if (checkoutCartMatch) {
      const parts = checkoutCartMatch[1].split('|');
      cartAction = {
        type: 'checkout',
        customerName: parts[0]?.trim(),
        customerAddress: parts[1]?.trim(),
        customerPhone: parts[2]?.trim(),
        couponCode: parts[3]?.trim() || undefined
      };
    }

    // Parse product action if present
    let productAction: ProductAction | undefined;
    if (showPromotionsMatch) {
      productAction = { action: 'show_promotions' };
    } else if (showProductsMatch) {
      productAction = { action: 'show_all' };
    } else if (showSingleProductMatch) {
      productAction = { 
        action: 'show_single', 
        productName: showSingleProductMatch[1].trim() 
      };
    }

    // Parse save address action if present
    const saveAddressMatch = content.match(/\[SAVE_ADDRESS:([^\]]+)\]/);
    let saveAddress: SaveAddressAction | undefined;
    if (saveAddressMatch) {
      const parts = saveAddressMatch[1].split('|');
      if (parts.length >= 2) {
        saveAddress = {
          label: parts[0].trim(),
          address: parts[1].trim()
        };
      }
    }

    // Clean up the response
    content = content
      .replace(/\[CREATE_MULTI_ORDER:[^\]]+\]/g, '')
      .replace(/\[CREATE_ORDER:[^\]]+\]/g, '')
      .replace(/\[CART_ADD:[^\]]+\]/g, '')
      .replace(/\[ADD_CART:[^\]]+\]/g, '')
      .replace(/\[CART_REMOVE:[^\]]+\]/g, '')
      .replace(/\[CART_UPDATE:[^\]]+\]/g, '')
      .replace(/\[CART_VIEW\]/g, '')
      .replace(/\[VIEW_CART\]/g, '')
      .replace(/\[CART_CLEAR\]/g, '')
      .replace(/\[CLEAR_CART\]/g, '')
      .replace(/\[CART_CHECKOUT:[^\]]+\]/g, '')
      .replace(/\[CHECKOUT_CART:[^\]]+\]/g, '')
      .replace(/\[SHOW_PRODUCTS\]/g, '')
      .replace(/\[SHOW_PROMOTIONS\]/g, '')
      .replace(/\[PRODUCT:[^\]]+\]/g, '')
      .replace(/\[SHOW_PRODUCT:[^\]]+\]/g, '')
      .replace(/\[SAVE_ADDRESS:[^\]]+\]/g, '')
      .replace(/\[NOTIFY_OUT_OF_STOCK:[^\]]+\]/g, '')
      .trim();

    return { text: content, createOrder, createMultiOrder, cartAction, productAction, saveAddress };

  } catch (error) {
    console.error("AI call error:", error);
    return { text: "ขออภัยครับ ระบบมีปัญหา กรุณาลองใหม่ภายหลัง" };
  }
}

serve(async (req) => {
  const url = new URL(req.url);

  // Handle webhook verification (GET request from Facebook)
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    console.log("Facebook verification:", { mode, token, challenge });

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    // Get and decrypt verify token from settings
    const FB_VERIFY_TOKEN = await getDecryptedSetting(supabase, "FACEBOOK_VERIFY_TOKEN");
    console.log("Decrypted verify token:", FB_VERIFY_TOKEN ? "***configured***" : "not set");

    if (mode === "subscribe" && token === FB_VERIFY_TOKEN) {
      console.log("Facebook webhook verified");
      return new Response(challenge, { status: 200 });
    }

    return new Response("Forbidden", { status: 403 });
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const bodyText = await req.text();
    const body = JSON.parse(bodyText);
    console.log("Facebook webhook received:", JSON.stringify(body, null, 2));

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Read and decrypt Facebook tokens from database
    const FB_PAGE_ACCESS_TOKEN = await getDecryptedSetting(supabase, 'FACEBOOK_PAGE_ACCESS_TOKEN');
    const FB_APP_SECRET = await getDecryptedSetting(supabase, 'FACEBOOK_APP_SECRET');

    // Verify Facebook signature - MANDATORY for security
    const signature = req.headers.get("x-hub-signature-256");
    
    if (!signature) {
      console.error("Missing Facebook signature header");
      return new Response(
        JSON.stringify({ error: "Missing x-hub-signature-256 header" }), 
        { 
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    if (!FB_APP_SECRET) {
      console.error("FACEBOOK_APP_SECRET not configured in settings");
      return new Response(
        JSON.stringify({ error: "Webhook not properly configured" }), 
        { 
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    const isValidSignature = await verifyFacebookSignature(bodyText, signature, FB_APP_SECRET);
    if (!isValidSignature) {
      console.error("Invalid Facebook signature");
      return new Response(
        JSON.stringify({ error: "Invalid signature" }), 
        { 
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
    console.log("Facebook signature verified successfully");

    if (!FB_PAGE_ACCESS_TOKEN) {
      console.error("FACEBOOK_PAGE_ACCESS_TOKEN not configured in settings");
      return new Response(JSON.stringify({ error: "Facebook token not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Track processed message IDs to prevent duplicate processing
    // Facebook sometimes sends the same webhook multiple times
    const processedMessageIds = new Set<string>();
    
    // Process messaging events
    for (const entry of body.entry || []) {
      for (const event of entry.messaging || []) {
        const senderId = event.sender?.id;
        if (!senderId) continue;
        
        // Deduplication: Check if this message was already processed
        const messageId = event.message?.mid || event.postback?.mid || `${senderId}_${event.timestamp}`;
        if (processedMessageIds.has(messageId)) {
          console.log(`Skipping duplicate message: ${messageId}`);
          continue;
        }
        processedMessageIds.add(messageId);
        
        // Also check in database for cross-request deduplication
        if (event.message?.mid) {
          const { data: existingMessage } = await supabase
            .from("chat_messages")
            .select("id")
            .eq("content", event.message.text || "")
            .gte("created_at", new Date(Date.now() - 60000).toISOString()) // Last 60 seconds
            .limit(1);
          
          if (existingMessage && existingMessage.length > 0) {
            console.log(`Skipping already processed message (found in DB): ${event.message.mid}`);
            continue;
          }
        }

        // Handle postback events (button clicks)
        if (event.postback) {
          const payload = event.postback.payload;
          console.log(`Facebook postback from ${senderId}: ${payload}`);

          // Handle DETAIL_ postback - show product details as text
          if (payload && payload.startsWith('DETAIL_')) {
            const productId = payload.replace('DETAIL_', '');
            console.log(`Detail request for product ID: ${productId}`);

            // Fetch product
            const { data: product } = await supabase
              .from("products")
              .select("*")
              .eq("id", productId)
              .eq("is_active", true)
              .maybeSingle();

            if (product) {
              // Find or create conversation
              let { data: conversation } = await supabase
                .from("chat_conversations")
                .select("*")
                .eq("platform", "facebook")
                .eq("platform_user_id", senderId)
                .maybeSingle();

              if (!conversation) {
                const { data: newConv } = await supabase
                  .from("chat_conversations")
                  .insert({
                    platform: "facebook",
                    platform_user_id: senderId,
                  })
                  .select()
                  .single();
                conversation = newConv;
              }

              // Build detailed text response (same as LINE)
              let detailText = `📦 ${product.name}\n\n`;
              
              if (product.description) {
                detailText += `📝 รายละเอียด:\n${product.description}\n\n`;
              }
              
              // Price info
              if (product.promotion_price && product.promotion_price < product.price) {
                const discountPercent = Math.round((1 - product.promotion_price / product.price) * 100);
                const savings = product.price - product.promotion_price;
                detailText += `💰 ราคา: ฿${product.promotion_price.toLocaleString()} (ปกติ ฿${product.price.toLocaleString()})\n`;
                detailText += `🔥 ลดราคา ${discountPercent}% ประหยัด ฿${savings.toLocaleString()}\n`;
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
                for (const variant of product.variants as any[]) {
                  if (variant.name && variant.options && Array.isArray(variant.options)) {
                    detailText += `• ${variant.name}: ${variant.options.join(', ')}\n`;
                  }
                }
              }
              
              // Stock status
              if (product.stock > 0) {
                if (product.stock <= 5) {
                  detailText += `\n⚡ เหลือเพียง ${product.stock} ชิ้นสุดท้าย!\n`;
                } else {
                  detailText += `\n✅ สินค้าพร้อมจัดส่ง\n`;
                }
              } else {
                detailText += `\n❌ สินค้าหมดชั่วคราว\n`;
              }
              
              // Call to action
              detailText += `\n━━━━━━━━━━━━━━━━\n`;
              detailText += `สนใจสั่งซื้อไหมคะ? 😊\n`;
              detailText += `พิมพ์บอกสี/ไซส์/จำนวนที่ต้องการได้เลยค่ะ`;

              // Save messages
              if (conversation) {
                await supabase.from("chat_messages").insert({
                  conversation_id: conversation.id,
                  role: "user",
                  content: `ขอดูรายละเอียด ${product.name}`
                });
                
                await supabase.from("chat_messages").insert({
                  conversation_id: conversation.id,
                  role: "assistant",
                  content: detailText
                });
                
                await supabase
                  .from("chat_conversations")
                  .update({
                    last_message: detailText.substring(0, 100),
                    last_message_at: new Date().toISOString()
                  })
                  .eq("id", conversation.id);
              }

              // Send text response
              await sendToFacebook(senderId, detailText, FB_PAGE_ACCESS_TOKEN);
            } else {
              await sendToFacebook(senderId, "ขออภัยค่ะ ไม่พบสินค้านี้ในระบบ", FB_PAGE_ACCESS_TOKEN);
            }
            
            continue; // Skip to next event
          }

          // Handle ADD_CART_ postback
          if (payload && payload.startsWith('ADD_CART_')) {
            const productId = payload.replace('ADD_CART_', '');
            // Convert to a message for AI to process
            const { data: product } = await supabase
              .from("products")
              .select("name")
              .eq("id", productId)
              .maybeSingle();
            
            if (product) {
              // Treat as if user typed "เพิ่มลงตะกร้า [product name]"
              event.message = { text: `เพิ่ม ${product.name} ลงตะกร้า` };
            } else {
              continue;
            }
          }

          // Handle ORDER_ postback
          if (payload && payload.startsWith('ORDER_')) {
            const productId = payload.replace('ORDER_', '');
            const { data: product } = await supabase
              .from("products")
              .select("name")
              .eq("id", productId)
              .maybeSingle();
            
            if (product) {
              // Treat as if user typed "สั่งซื้อ [product name]"
              event.message = { text: `สั่งซื้อ ${product.name}` };
            } else {
              continue;
            }
          }
        }

        const message = event.message;
        
        // Handle image attachments (payment slips)
        if (message?.attachments && message.attachments.length > 0) {
          const imageAttachment = message.attachments.find((att: any) => att.type === 'image');
          
          if (imageAttachment?.payload?.url) {
            console.log(`Image received from Facebook user ${senderId}`);
            const imageUrl = imageAttachment.payload.url;
            
            // Find or create conversation
            let { data: conversation } = await supabase
              .from("chat_conversations")
              .select("*")
              .eq("platform", "facebook")
              .eq("platform_user_id", senderId)
              .maybeSingle();

            if (!conversation) {
              const { data: newConv } = await supabase
                .from("chat_conversations")
                .insert({
                  platform: "facebook",
                  platform_user_id: senderId,
                })
                .select()
                .single();
              conversation = newConv;
            }

            // Find customer's latest pending/confirmed order
            const { data: pendingOrder } = await supabase
              .from("orders")
              .select("*")
              .eq("customer_facebook_id", senderId)
              .in("status", ["pending", "confirmed"])
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (!pendingOrder) {
              await sendToFacebook(
                senderId,
                "ขอบคุณค่ะ! 📸\n\nขณะนี้ไม่พบออเดอร์ที่รอชำระเงินค่ะ\n\nหากต้องการสั่งซื้อสินค้า พิมพ์ \"ดูสินค้า\" ได้เลยค่ะ 😊",
                FB_PAGE_ACCESS_TOKEN
              );
              continue;
            }

            // Save payment slip
            const { data: newSlip, error: slipError } = await supabase
              .from("payment_slips")
              .insert({
                order_id: pendingOrder.id,
                platform: "facebook",
                platform_user_id: senderId,
                image_url: imageUrl,
                status: "pending",
              })
              .select()
              .single();

            if (slipError) {
              console.error("Error saving payment slip:", slipError);
            }

            // Save to chat messages
            if (conversation) {
              await supabase.from("chat_messages").insert({
                conversation_id: conversation.id,
                role: "user",
                content: "[รูปภาพสลิปโอนเงิน]",
              });
            }

            // Call AI to analyze the payment slip
            let autoVerified = false;
            let analysisMessage = "";

            if (newSlip) {
              try {
                console.log("Analyzing payment slip with AI...");

                const analysisResponse = await fetch(
                  `${SUPABASE_URL}/functions/v1/analyze-payment-slip`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                    },
                    body: JSON.stringify({
                      image_url: imageUrl,
                      expected_amount: Number(pendingOrder.total_amount),
                      payment_slip_id: newSlip.id,
                      order_id: pendingOrder.id,
                    }),
                  }
                );

                if (analysisResponse.ok) {
                  const analysisResult = await analysisResponse.json();
                  console.log("AI Analysis result:", analysisResult);

                  if (analysisResult.auto_verified) {
                    autoVerified = true;
                    analysisMessage = `\n\n🤖 AI ตรวจสอบสลิปแล้ว:\n• ยอดเงิน: ฿${
                      analysisResult.analyzed_amount?.toLocaleString() || "ไม่ทราบ"
                    }\n• ธนาคาร: ${
                      analysisResult.analyzed_bank || "ไม่ทราบ"
                    }\n• ความมั่นใจ: ${analysisResult.confidence_score}%\n\n✅ ยืนยันการชำระเงินอัตโนมัติแล้ว!`;

                    // Send notification to customer about auto-confirmation
                    try {
                      await supabase.functions.invoke("send-order-notification", {
                        body: {
                          order_id: pendingOrder.id,
                          notification_type: "payment_confirmed",
                        },
                      });
                    } catch (notifError) {
                      console.error("Error sending auto-confirm notification:", notifError);
                    }
                  } else if (analysisResult.analyzed_amount) {
                    analysisMessage = `\n\n🤖 AI วิเคราะห์สลิป:\n• ยอดเงิน: ฿${
                      analysisResult.analyzed_amount?.toLocaleString() || "อ่านไม่ได้"
                    }\n• ธนาคาร: ${
                      analysisResult.analyzed_bank || "ไม่ทราบ"
                    }\n• ความมั่นใจ: ${analysisResult.confidence_score}%\n\nรอเจ้าหน้าที่ตรวจสอบเพิ่มเติมค่ะ`;
                  }
                }
              } catch (analysisError) {
                console.error("Error calling analyze-payment-slip:", analysisError);
              }
            }

            if (conversation) {
              await supabase.from("chat_messages").insert({
                conversation_id: conversation.id,
                role: "assistant",
                content: `รับสลิปเรียบร้อย - ออเดอร์ ${pendingOrder.order_number}${
                  autoVerified ? " (ยืนยันอัตโนมัติ)" : ""
                }`,
              });
            }

            // Send confirmation
            let confirmText = "";
            if (autoVerified) {
              confirmText = `✅ รับสลิปและยืนยันการชำระเงินเรียบร้อยค่ะ!\n━━━━━━━━━━━━━━━\n\n📋 ออเดอร์: ${
                pendingOrder.order_number
              }\n💰 ยอดเงิน: ฿${Number(pendingOrder.total_amount).toLocaleString()}${analysisMessage}\n\nทางร้านจะจัดส่งสินค้าให้เร็วที่สุดค่ะ 🚚\n\nขอบคุณที่ไว้วางใจค่ะ 💕`;
            } else {
              confirmText = `✅ รับสลิปเรียบร้อยค่ะ!\n━━━━━━━━━━━━━━━\n\n📋 ออเดอร์: ${
                pendingOrder.order_number
              }\n💰 ยอดเงิน: ฿${Number(pendingOrder.total_amount).toLocaleString()}${analysisMessage}\n\nเจ้าหน้าที่จะตรวจสอบและยืนยันการชำระเงินโดยเร็วค่ะ 🙏\n\nขอบคุณที่ไว้วางใจค่ะ 💕`;
            }

            await sendToFacebook(senderId, confirmText, FB_PAGE_ACCESS_TOKEN);
            continue;
          }
        }
        
        if (!message?.text) continue;

        const userMessage = message.text;
        console.log(`Facebook message from ${senderId}: ${userMessage}`);

        // Find or create conversation
        let { data: conversation } = await supabase
          .from("chat_conversations")
          .select("*")
          .eq("platform", "facebook")
          .eq("platform_user_id", senderId)
          .maybeSingle();

        if (!conversation) {
          const { data: newConv } = await supabase
            .from("chat_conversations")
            .insert({
              platform: "facebook",
              platform_user_id: senderId,
            })
            .select()
            .single();
          conversation = newConv;
        }

        if (!conversation) {
          await sendToFacebook(senderId, "ขออภัยครับ เกิดข้อผิดพลาด", FB_PAGE_ACCESS_TOKEN);
          continue;
        }

        // Save user message
        await supabase.from("chat_messages").insert({
          conversation_id: conversation.id,
          role: "user",
          content: userMessage,
        });

        // Check for order number pattern to check order status
        const orderNumberMatch = userMessage.match(/ORD-\d{8}-\d{4}/i);
        if (orderNumberMatch) {
          const orderNumber = orderNumberMatch[0].toUpperCase();
          console.log("Order status check requested for:", orderNumber);

          const { data: order } = await supabase
            .from("orders")
            .select("*")
            .eq("order_number", orderNumber)
            .maybeSingle();

          if (order) {
            const { data: orderItems } = await supabase
              .from("order_items")
              .select("*")
              .eq("order_id", order.id);

            const statusMessage = formatOrderStatusMessage(order, orderItems || []);

            await supabase.from("chat_messages").insert({
              conversation_id: conversation.id,
              role: "assistant",
              content: `สถานะออเดอร์ ${orderNumber}: ${order.status}`,
            });

            await supabase
              .from("chat_conversations")
              .update({
                last_message: `สถานะ: ${order.status}`,
                last_message_at: new Date().toISOString(),
              })
              .eq("id", conversation.id);

            await sendToFacebook(senderId, statusMessage, FB_PAGE_ACCESS_TOKEN);
            continue;
          } else {
            await supabase.from("chat_messages").insert({
              conversation_id: conversation.id,
              role: "assistant",
              content: `ไม่พบออเดอร์หมายเลข ${orderNumber}`,
            });

            await sendToFacebook(
              senderId, 
              `ขออภัยค่ะ ไม่พบออเดอร์หมายเลข ${orderNumber} ในระบบ 😔\n\nกรุณาตรวจสอบหมายเลขออเดอร์อีกครั้งค่ะ`,
              FB_PAGE_ACCESS_TOKEN
            );
            continue;
          }
        }

        // Check for order history request
        const orderHistoryKeywords = ['ประวัติออเดอร์', 'ประวัติคำสั่งซื้อ', 'ออเดอร์ทั้งหมด', 'ดูออเดอร์', 'รายการสั่งซื้อ'];
        const isOrderHistoryRequest = orderHistoryKeywords.some(keyword => 
          userMessage.toLowerCase().includes(keyword.toLowerCase())
        );

        if (isOrderHistoryRequest) {
          console.log("Order history requested for Facebook user:", senderId);

          const { data: orders } = await supabase
            .from("orders")
            .select("*")
            .eq("customer_facebook_id", senderId)
            .order("created_at", { ascending: false })
            .limit(10);

          if (orders && orders.length > 0) {
            const historyMessage = formatOrderHistoryMessage(orders);

            await supabase.from("chat_messages").insert({
              conversation_id: conversation.id,
              role: "assistant",
              content: `แสดงประวัติออเดอร์ ${orders.length} รายการ`,
            });

            await supabase
              .from("chat_conversations")
              .update({
                last_message: `ประวัติออเดอร์ ${orders.length} รายการ`,
                last_message_at: new Date().toISOString(),
              })
              .eq("id", conversation.id);

            await sendToFacebook(senderId, historyMessage, FB_PAGE_ACCESS_TOKEN);
            continue;
          } else {
            await supabase.from("chat_messages").insert({
              conversation_id: conversation.id,
              role: "assistant",
              content: "ไม่พบประวัติออเดอร์",
            });

            await sendToFacebook(
              senderId, 
              `📋 ยังไม่มีประวัติออเดอร์ค่ะ\n\nพิมพ์ "ดูสินค้า" เพื่อเลือกสินค้าได้เลยค่ะ 😊`,
              FB_PAGE_ACCESS_TOKEN
            );
            continue;
          }
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

          const { data: order } = await supabase
            .from("orders")
            .select("*")
            .eq("order_number", orderNumber)
            .eq("customer_facebook_id", senderId)
            .maybeSingle();

          if (order && order.status === 'shipped') {
            await supabase.from("orders").update({ status: 'delivered' }).eq("id", order.id);
            await sendToFacebook(
              senderId,
              `✅ ยืนยันรับสินค้าเรียบร้อยค่ะ\n━━━━━━━━━━━━━━━\n\n📋 หมายเลข: ${orderNumber}\n📦 สถานะ: ส่งสำเร็จ\n\nขอบคุณที่ไว้วางใจร้านเรานะคะ! 🙏😊`,
              FB_PAGE_ACCESS_TOKEN
            );
            continue;
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
            .eq("customer_facebook_id", senderId)
            .maybeSingle();

          if (!order) {
            await supabase.from("chat_messages").insert({
              conversation_id: conversation.id,
              role: "assistant",
              content: `ไม่พบออเดอร์หมายเลข ${orderNumber}`,
            });

            await sendToFacebook(
              senderId, 
              `ขออภัยค่ะ ไม่พบออเดอร์หมายเลข ${orderNumber} ในระบบของคุณ 😔\n\nกรุณาตรวจสอบหมายเลขออเดอร์อีกครั้งค่ะ`,
              FB_PAGE_ACCESS_TOKEN
            );
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
              role: "assistant",
              content: `ไม่สามารถยกเลิกออเดอร์ ${orderNumber} ได้ (สถานะ: ${order.status})`,
            });

            await sendToFacebook(
              senderId, 
              `ขออภัยค่ะ ${statusMessages[order.status] || 'ไม่สามารถยกเลิกออเดอร์นี้ได้ค่ะ'}\n\nหากมีปัญหา กรุณาติดต่อเจ้าหน้าที่ค่ะ`,
              FB_PAGE_ACCESS_TOKEN
            );
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
                await supabase
                  .from("products")
                  .update({ stock: (item.products as any).stock + item.quantity })
                  .eq("id", item.product_id);
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
            await sendToFacebook(
              senderId, 
              `ขออภัยค่ะ เกิดข้อผิดพลาดในการยกเลิกออเดอร์ กรุณาลองใหม่อีกครั้งค่ะ`,
              FB_PAGE_ACCESS_TOKEN
            );
            continue;
          }

          const cancelMessage = `❌ ยกเลิกออเดอร์สำเร็จ\n━━━━━━━━━━━━━━━\n\n📋 หมายเลข: ${orderNumber}\n💰 ยอดเงิน: ฿${Number(order.total_amount).toLocaleString()} (ยกเลิก)\n📦 สต็อกสินค้าได้คืนเรียบร้อยแล้ว\n\nหากต้องการสั่งซื้อใหม่ พิมพ์ "ดูสินค้า" ค่ะ 😊`;

          await supabase.from("chat_messages").insert({
            conversation_id: conversation.id,
            role: "assistant",
            content: `ยกเลิกออเดอร์ ${orderNumber} สำเร็จ`,
          });

          await supabase
            .from("chat_conversations")
            .update({
              last_message: `ยกเลิกออเดอร์ ${orderNumber}`,
              last_message_at: new Date().toISOString(),
            })
            .eq("id", conversation.id);

          await sendToFacebook(senderId, cancelMessage, FB_PAGE_ACCESS_TOKEN);
          continue;
        }

        // Get cart items count
        const { count: cartItemCount } = await supabase
          .from("shopping_carts")
          .select("*", { count: "exact", head: true })
          .eq("conversation_id", conversation.id);

        // Fetch saved addresses for the customer
        let savedAddresses: SavedAddress[] = [];
        const { data: addressesData } = await supabase
          .from("customer_addresses")
          .select("*")
          .eq("platform_user_id", senderId)
          .eq("platform", "facebook")
          .order("is_default", { ascending: false });

        if (addressesData && addressesData.length > 0) {
          savedAddresses = addressesData.map((a: any) => ({
            id: a.id,
            label: a.label,
            address: a.address,
            isDefault: a.is_default
          }));
          console.log(`Found ${savedAddresses.length} saved addresses for Facebook user ${senderId}`);
        }

        // Build customer context
        const customerContext: CustomerContext = {
          isReturning: !!conversation.customer_name,
          customerName: conversation.customer_name || undefined,
          customerPhone: conversation.customer_phone || undefined,
          customerAddress: conversation.customer_address || undefined,
          cartItemCount: cartItemCount || 0,
          savedAddresses: savedAddresses.length > 0 ? savedAddresses : undefined
        };

        // Get conversation history
        // CRITICAL: Order by descending to get NEWEST messages, then reverse for AI
        const { data: rawHistory } = await supabase
          .from("chat_messages")
          .select("*")
          .eq("conversation_id", conversation.id)
          .order("created_at", { ascending: false })
          .limit(20);
        
        // Reverse to get chronological order (oldest to newest) for AI
        const history = rawHistory ? [...rawHistory].reverse() : [];

        // Check if this is effectively a new session (no messages OR last message was more than 1 hour ago)
        let isNewSession = !history || history.length === 0;
        if (!isNewSession && history.length > 0) {
          const lastMessageTime = new Date(history[history.length - 1].created_at);
          const hoursSinceLastMessage = (Date.now() - lastMessageTime.getTime()) / (1000 * 60 * 60);
          if (hoursSinceLastMessage > 1) {
            isNewSession = true;
            console.log(`New session detected: ${hoursSinceLastMessage.toFixed(1)} hours since last message`);
          }
        }

        const isFirstMessage = isNewSession;

        // Detect greeting messages
        const greetingPatterns = /^(สวัสดี|หวัดดี|ดี|hello|hi|hey|hola|หวัดดีครับ|หวัดดีค่ะ|สวัสดีครับ|สวัสดีค่ะ|ดีครับ|ดีค่ะ|ดีจ้า|สวัสดีจ้า|หวัดดีจ้า)[ๆ]*[\s]*[ครับค่ะคะจ้านะ]*$/i;
        const isGreeting = greetingPatterns.test(userMessage.trim());
        
        if (isGreeting) {
          console.log("Greeting detected - will respond with greeting only");
        }

        // Detect if user is specifying new product list (contains quantity patterns)
        const productListPattern = /(\d+\s*(ตัว|ชิ้น|คู่|อัน|ชุด|กล่อง|แพ็ค))|((ตัว|ชิ้น|คู่|อัน|ชุด|กล่อง|แพ็ค)\s*\d+)|(อย่างละ\s*\d+)|(\d+\s*(สี|ไซส์|size|s|m|l|xl))/i;
        const isNewProductList = productListPattern.test(userMessage);
        
        // Build messages - skip history if new session or greeting
        let messages: Array<{ role: string; content: string }> = [];
        
        // CRITICAL FIX: When user specifies new product list, CLEAR old history that contains quantities
        // This prevents AI from adding old quantities with new ones
        if (!isNewSession && !isGreeting && history && history.length > 0) {
          if (isNewProductList) {
            // Only keep very recent messages (last 4) and filter out any that mention quantities
            const recentHistory = history.slice(-4);
            const filteredHistory = recentHistory.filter((m: any) => {
              // Filter out assistant messages that contain quantity confirmations
              if (m.role === 'assistant') {
                const hasQuantityConfirmation = /จำนวน\s*\d+\s*(ตัว|ชิ้น)|(\d+)\s*(ตัว|ชิ้น|คู่)/i.test(m.content);
                const hasOrderConfirmation = /ยืนยันรายการ|รายการสินค้า|รวม.*ชิ้น/i.test(m.content);
                if (hasQuantityConfirmation || hasOrderConfirmation) {
                  console.log(`[FB] Filtered out old quantity message: ${m.content.substring(0, 50)}...`);
                  return false;
                }
              }
              return true;
            });
            messages = filteredHistory.map((m: any) => ({
              role: m.role,
              content: m.content,
            }));
            console.log(`[FB] New product list detected. History filtered: ${history.length} -> ${messages.length} messages`);
          } else {
            messages = history.map((m: any) => ({
              role: m.role,
              content: m.content,
            }));
          }
        }
        
        // For greetings, add instruction to NOT repeat greetings
        if (isGreeting) {
          messages.push({ role: "system", content: `[INSTRUCTION: ลูกค้าทักทายเข้ามา
⚠️ กฎสำคัญ - ห้ามทักทายซ้ำซ้อน!
- ตอบทักทายแค่ครั้งเดียว สั้นๆ เช่น "สวัสดีค่ะ 😊 สนใจสินค้าอะไรเป็นพิเศษคะ?"
- ห้ามพูดว่า "ยินดีต้อนรับ" หรือ "ขอต้อนรับ" ซ้ำ 2 ครั้งในข้อความเดียว
- ห้ามแนะนำตัวซ้ำ 2 ครั้ง
- ห้ามพูดถึงสินค้าเก่าหรือถามรายละเอียดที่อยู่/ชื่อ/เบอร์
- ข้อความทักทายต้องไม่เกิน 2 ประโยค]` });
        }
        
        // CRITICAL: When user specifies a new product list, add ABSOLUTE instruction
        if (isNewProductList) {
          // Extract quantities from CURRENT message only
          const quantityMatches: string[] = userMessage.match(/(\d+)\s*(ตัว|ชิ้น|คู่|อัน|ชุด)/gi) || [];
          const quantities: number[] = quantityMatches.map((m: string) => {
            const num = m.match(/\d+/)?.[0] || '1';
            return parseInt(num);
          });
          const totalFromMessage = quantities.reduce((sum: number, q: number) => sum + q, 0);
          
          messages.push({ 
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
        }
        
        // Add current user message
        messages.push({ role: "user", content: userMessage });

        // Send typing indicator to Facebook
        try {
          await fetch(
            `https://graph.facebook.com/v18.0/me/messages?access_token=${FB_PAGE_ACCESS_TOKEN}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                recipient: { id: senderId },
                sender_action: "typing_on"
              }),
            }
          );
          console.log("Facebook typing indicator sent");
        } catch (typingError) {
          console.log("Typing indicator error (non-critical):", typingError);
        }

        // Get AI response
        const aiResult = await getAIResponse(messages, supabase, customerContext, isFirstMessage, senderId);
        console.log("AI response generated:", aiResult);

        let responseMessage = aiResult.text;

        // Handle save address action
        if (aiResult.saveAddress) {
          const { label, address } = aiResult.saveAddress;
          console.log(`Saving address for Facebook user ${senderId}: ${label} - ${address}`);
          
          // Check if this label already exists for this user
          const { data: existingAddress } = await supabase
            .from("customer_addresses")
            .select("id")
            .eq("platform_user_id", senderId)
            .eq("platform", "facebook")
            .eq("label", label)
            .maybeSingle();

          if (existingAddress) {
            // Update existing address
            await supabase
              .from("customer_addresses")
              .update({ address, updated_at: new Date().toISOString() })
              .eq("id", existingAddress.id);
          } else {
            // Check if this is the first address (make it default)
            const isFirst = savedAddresses.length === 0;
            
            await supabase.from("customer_addresses").insert({
              platform_user_id: senderId,
              platform: "facebook",
              label,
              address,
              is_default: isFirst
            });
          }
        }

        // Handle cart actions
        if (aiResult.cartAction) {
          const cartAction = aiResult.cartAction;
          console.log("Cart action:", cartAction);

          if (cartAction.type === 'add' && cartAction.productName) {
            // Find product
            const { data: products } = await supabase
              .from("products")
              .select("*")
              .eq("is_active", true)
              .ilike("name", `%${cartAction.productName}%`)
              .limit(1);

            if (products && products.length > 0) {
              const product = products[0];
              const price = product.promotion_price || product.price;

              // Check if item already in cart
              const { data: existingItem } = await supabase
                .from("shopping_carts")
                .select("*")
                .eq("conversation_id", conversation.id)
                .eq("product_id", product.id)
                .eq("variants", cartAction.variants || '')
                .maybeSingle();

              if (existingItem) {
                await supabase
                  .from("shopping_carts")
                  .update({ quantity: existingItem.quantity + (cartAction.quantity || 1) })
                  .eq("id", existingItem.id);
              } else {
                await supabase.from("shopping_carts").insert({
                  conversation_id: conversation.id,
                  platform_user_id: senderId,
                  product_id: product.id,
                  product_name: product.name,
                  quantity: cartAction.quantity || 1,
                  price: price,
                  variants: cartAction.variants || ''
                });
              }
            } else {
              responseMessage = "ขออภัยค่ะ ไม่พบสินค้าที่ต้องการ";
            }
          } else if (cartAction.type === 'remove' && cartAction.productName) {
            // Find item in cart by product name
            const { data: cartItems } = await supabase
              .from("shopping_carts")
              .select("*")
              .eq("conversation_id", conversation.id);

            const itemToRemove = cartItems?.find((item: any) => 
              item.product_name.toLowerCase().includes(cartAction.productName!.toLowerCase()) ||
              cartAction.productName!.toLowerCase().includes(item.product_name.toLowerCase())
            );

            if (itemToRemove) {
              await supabase.from("shopping_carts").delete().eq("id", itemToRemove.id);
              responseMessage = `🗑️ ลบ "${itemToRemove.product_name}" ออกจากตะกร้าแล้วค่ะ`;
            } else {
              responseMessage = `ไม่พบสินค้า "${cartAction.productName}" ในตะกร้าค่ะ`;
            }
          } else if (cartAction.type === 'update' && cartAction.productName) {
            const { data: cartItems } = await supabase
              .from("shopping_carts")
              .select("*")
              .eq("conversation_id", conversation.id);

            const itemToUpdate = cartItems?.find((item: any) => 
              item.product_name.toLowerCase().includes(cartAction.productName!.toLowerCase()) ||
              cartAction.productName!.toLowerCase().includes(item.product_name.toLowerCase())
            );

            if (itemToUpdate) {
              const newQty = cartAction.quantity || 1;
              if (newQty <= 0) {
                await supabase.from("shopping_carts").delete().eq("id", itemToUpdate.id);
                responseMessage = `🗑️ ลบ "${itemToUpdate.product_name}" ออกจากตะกร้าแล้วค่ะ`;
              } else {
                await supabase.from("shopping_carts").update({ quantity: newQty }).eq("id", itemToUpdate.id);
                responseMessage = `✅ เปลี่ยนจำนวน "${itemToUpdate.product_name}" เป็น ${newQty} ชิ้นแล้วค่ะ`;
              }
            } else {
              responseMessage = `ไม่พบสินค้า "${cartAction.productName}" ในตะกร้าค่ะ`;
            }
          } else if (cartAction.type === 'view') {
            const { data: cartItems } = await supabase
              .from("shopping_carts")
              .select("*")
              .eq("conversation_id", conversation.id);

            const totalAmount = cartItems?.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0) || 0;
            responseMessage = formatCartSummaryMessage(cartItems || [], totalAmount);
          } else if (cartAction.type === 'clear') {
            await supabase
              .from("shopping_carts")
              .delete()
              .eq("conversation_id", conversation.id);

            responseMessage = "🗑️ ล้างตะกร้าเรียบร้อยแล้วค่ะ";
          } else if (cartAction.type === 'checkout' && cartAction.customerName && cartAction.customerAddress && cartAction.customerPhone) {
            const { data: cartItems } = await supabase
              .from("shopping_carts")
              .select("*, products(*)")
              .eq("conversation_id", conversation.id);

            if (cartItems && cartItems.length > 0) {
              const totalAmount = cartItems.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);

              // Create order
              const { data: order, error: orderError } = await supabase
                .from("orders")
                .insert({
                  customer_name: cartAction.customerName,
                  customer_address: cartAction.customerAddress,
                  customer_phone: cartAction.customerPhone,
                  customer_facebook_id: senderId,
                  platform: "facebook",
                  total_amount: totalAmount
                })
                .select()
                .single();

              if (order && !orderError) {
                // Create order items and update stock
                const orderItems = [];
                for (const cartItem of cartItems) {
                  await supabase.from("order_items").insert({
                    order_id: order.id,
                    product_id: cartItem.product_id,
                    product_name: cartItem.product_name + (cartItem.variants ? ` (${cartItem.variants})` : ''),
                    quantity: cartItem.quantity,
                    price: cartItem.price
                  });

                  orderItems.push({
                    product_name: cartItem.product_name + (cartItem.variants ? ` (${cartItem.variants})` : ''),
                    quantity: cartItem.quantity,
                    price: cartItem.price
                  });

                  // Update stock
                  if (cartItem.products) {
                    await supabase
                      .from("products")
                      .update({ stock: cartItem.products.stock - cartItem.quantity })
                      .eq("id", cartItem.product_id);
                  }
                }

                // Clear cart
                await supabase
                  .from("shopping_carts")
                  .delete()
                  .eq("conversation_id", conversation.id);

                // Update conversation
                await supabase
                  .from("chat_conversations")
                  .update({
                    customer_name: cartAction.customerName,
                    customer_phone: cartAction.customerPhone
                  })
                  .eq("id", conversation.id);

                console.log(`Facebook cart order created: ${order.order_number}`);

                // Fetch bank accounts for payment info
                const { data: bankSettingCart } = await supabase
                  .from("settings")
                  .select("value")
                  .eq("key", "BANK_ACCOUNTS")
                  .maybeSingle();

                responseMessage = formatOrderConfirmationMessage({
                  orderNumber: order.order_number,
                  items: orderItems,
                  totalAmount: totalAmount,
                  discountAmount: undefined,
                  customerName: cartAction.customerName,
                  customerPhone: cartAction.customerPhone,
                  customerAddress: cartAction.customerAddress,
                  couponCode: cartAction.couponCode,
                  bankAccounts: bankSettingCart?.value || undefined
                });
              } else {
                console.error("Error creating order:", orderError);
                responseMessage = "ขออภัยค่ะ เกิดข้อผิดพลาดในการสร้างออเดอร์ กรุณาลองใหม่อีกครั้ง";
              }
            } else {
              responseMessage = "🛒 ตะกร้าว่างเปล่าค่ะ กรุณาเพิ่มสินค้าก่อนสั่งซื้อ";
            }
          }
        }

        // Handle direct order creation
        if (aiResult.createOrder) {
          const orderData = aiResult.createOrder;
          console.log("Creating direct order:", orderData);

          // Find product
          const { data: products } = await supabase
            .from("products")
            .select("*")
            .eq("is_active", true)
            .ilike("name", `%${orderData.productName}%`)
            .limit(1);

          if (products && products.length > 0) {
            const product = products[0];
            const price = product.promotion_price || product.price;
            const totalAmount = price * orderData.quantity;

            // Create order
            const { data: order, error: orderError } = await supabase
              .from("orders")
              .insert({
                customer_name: orderData.customerName,
                customer_address: orderData.customerAddress,
                customer_phone: orderData.customerPhone,
                customer_facebook_id: senderId,
                platform: "facebook",
                total_amount: totalAmount
              })
              .select()
              .single();

            if (order && !orderError) {
              await supabase.from("order_items").insert({
                order_id: order.id,
                product_id: product.id,
                product_name: product.name + (orderData.variants ? ` (${orderData.variants})` : ''),
                quantity: orderData.quantity,
                price: price
              });

              // Update stock
              await supabase
                .from("products")
                .update({ stock: product.stock - orderData.quantity })
                .eq("id", product.id);

              // Update conversation
              await supabase
                .from("chat_conversations")
                .update({
                  customer_name: orderData.customerName,
                  customer_phone: orderData.customerPhone
                })
                .eq("id", conversation.id);

              console.log(`Facebook direct order created: ${order.order_number}`);

              // Fetch bank accounts for payment info
              const { data: bankSetting } = await supabase
                .from("settings")
                .select("value")
                .eq("key", "BANK_ACCOUNTS")
                .maybeSingle();

              responseMessage = formatOrderConfirmationMessage({
                orderNumber: order.order_number,
                items: [{
                  product_name: product.name,
                  quantity: orderData.quantity,
                  price: price,
                  variants: orderData.variants
                }],
                totalAmount: totalAmount,
                discountAmount: undefined,
                customerName: orderData.customerName,
                customerPhone: orderData.customerPhone,
                customerAddress: orderData.customerAddress,
                couponCode: orderData.couponCode,
                bankAccounts: bankSetting?.value || undefined
              });
            }
          } else {
            responseMessage = "ขออภัยค่ะ ไม่พบสินค้าที่ต้องการ";
          }
        }

        // Handle multi-product order creation
        if (aiResult.createMultiOrder) {
          const multiOrderData = aiResult.createMultiOrder;
          console.log("Creating multi-product order:", multiOrderData);

          // Find all products
          const orderItemsToCreate: Array<{
            product_id: string;
            product_name: string;
            quantity: number;
            price: number;
            variants?: string;
          }> = [];
          let totalAmount = 0;

          for (const item of multiOrderData.items) {
            const { data: products } = await supabase
              .from("products")
              .select("*")
              .eq("is_active", true)
              .ilike("name", `%${item.productName}%`)
              .limit(1);

            if (products && products.length > 0) {
              const product = products[0];
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
            }
          }

          if (orderItemsToCreate.length > 0) {
            // Create order
            const { data: order, error: orderError } = await supabase
              .from("orders")
              .insert({
                customer_name: multiOrderData.customerName,
                customer_address: multiOrderData.customerAddress,
                customer_phone: multiOrderData.customerPhone,
                customer_facebook_id: senderId,
                platform: "facebook",
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
                  customer_name: multiOrderData.customerName,
                  customer_phone: multiOrderData.customerPhone
                })
                .eq("id", conversation.id);

              console.log(`Facebook multi-product order created: ${order.order_number}`);

              // Fetch bank accounts for payment info
              const { data: bankSettingMulti } = await supabase
                .from("settings")
                .select("value")
                .eq("key", "BANK_ACCOUNTS")
                .maybeSingle();

              responseMessage = formatOrderConfirmationMessage({
                orderNumber: order.order_number,
                items: orderItemsToCreate.map(item => ({
                  product_name: item.product_name.replace(/ \([^)]+\)$/, ''),
                  quantity: item.quantity,
                  price: item.price,
                  variants: item.variants
                })),
                totalAmount: totalAmount,
                discountAmount: undefined,
                customerName: multiOrderData.customerName,
                customerPhone: multiOrderData.customerPhone,
                customerAddress: multiOrderData.customerAddress,
                couponCode: multiOrderData.couponCode,
                bankAccounts: bankSettingMulti?.value || undefined
              });
            } else {
              console.error("Error creating multi-order:", orderError);
              responseMessage = "ขออภัยค่ะ เกิดข้อผิดพลาดในการสร้างออเดอร์ กรุณาลองใหม่อีกครั้ง";
            }
          } else {
            responseMessage = "ขออภัยค่ะ ไม่พบสินค้าที่ต้องการ";
          }
        }

        // Handle product actions (show products with images)
        let productCarouselSent = false;
        if (aiResult.productAction) {
          const productAction = aiResult.productAction;
          console.log("Product action:", productAction);

          if (productAction.action === 'show_promotions') {
            // Fetch promotion products only
            const { data: products } = await supabase
              .from("products")
              .select("*")
              .eq("is_active", true)
              .not("promotion_price", "is", null);

            if (products && products.length > 0) {
              // Filter products with actual promotion
              const promoProducts = products.filter(p => p.promotion_price && p.promotion_price < p.price);
              if (promoProducts.length > 0) {
                // Send text message first
                if (responseMessage) {
                  await sendToFacebook(senderId, responseMessage, FB_PAGE_ACCESS_TOKEN);
                }
                // Then send promotion carousel
                await sendProductCarouselToFacebook(senderId, promoProducts, FB_PAGE_ACCESS_TOKEN);
                productCarouselSent = true;
              } else {
                responseMessage = "ขออภัยค่ะ ตอนนี้ไม่มีสินค้าโปรโมชั่นค่ะ 😊";
              }
            } else {
              responseMessage = "ขออภัยค่ะ ตอนนี้ไม่มีสินค้าโปรโมชั่นค่ะ 😊";
            }
          } else if (productAction.action === 'show_all') {
            // Fetch all active products
            const { data: products } = await supabase
              .from("products")
              .select("*")
              .eq("is_active", true)
              .limit(10);

            if (products && products.length > 0) {
              // Send text message first
              if (responseMessage) {
                await sendToFacebook(senderId, responseMessage, FB_PAGE_ACCESS_TOKEN);
              }
              // Then send product carousel
              await sendProductCarouselToFacebook(senderId, products, FB_PAGE_ACCESS_TOKEN);
              productCarouselSent = true;
            }
          } else if (productAction.action === 'show_single' && productAction.productName) {
            // Find specific product
            const { data: products } = await supabase
              .from("products")
              .select("*")
              .eq("is_active", true)
              .ilike("name", `%${productAction.productName}%`)
              .limit(1);

            if (products && products.length > 0) {
              // Send text message first
              if (responseMessage) {
                await sendToFacebook(senderId, responseMessage, FB_PAGE_ACCESS_TOKEN);
              }
              // Then send single product card
              await sendSingleProductToFacebook(senderId, products[0], FB_PAGE_ACCESS_TOKEN);
              productCarouselSent = true;
            } else {
              responseMessage = `ขออภัยค่ะ ไม่พบสินค้า "${productAction.productName}" ในระบบ 😔\n\nพิมพ์ "ดูสินค้า" เพื่อดูสินค้าทั้งหมดค่ะ`;
            }
          }
        }

        // Save AI response
        await supabase.from("chat_messages").insert({
          conversation_id: conversation.id,
          role: "assistant",
          content: responseMessage,
        });

        // Update conversation
        await supabase
          .from("chat_conversations")
          .update({
            last_message: responseMessage.slice(0, 100),
            last_message_at: new Date().toISOString(),
          })
          .eq("id", conversation.id);

        // Send response to Facebook (only if not already sent with product carousel)
        if (!productCarouselSent) {
          await sendToFacebook(senderId, responseMessage, FB_PAGE_ACCESS_TOKEN);
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Facebook webhook error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
