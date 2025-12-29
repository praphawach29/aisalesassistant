import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ENCRYPTION_KEY = Deno.env.get("ENCRYPTION_KEY") || "";

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
  console.log('[Chat] Cache cleared due to invalidation');
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
  const keyData = encoder.encode(ENCRYPTION_KEY.padEnd(32, "0").slice(0, 32));
  return await crypto.subtle.importKey("raw", keyData, { name: "AES-GCM" }, false, ["decrypt"]);
}

async function decrypt(encryptedText: string): Promise<string> {
  if (!encryptedText) return "";
  try {
    const key = await getKey();
    const combined = Uint8Array.from(atob(encryptedText), (c) => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted);
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error("Decryption failed:", error);
    return encryptedText;
  }
}

// AI Provider configuration
interface ProviderConfig {
  url: string;
  model: string;
  getHeaders: (apiKey: string) => Record<string, string>;
}

const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  lovable: {
    url: "https://ai.gateway.lovable.dev/v1/chat/completions",
    model: "google/gemini-2.5-flash",
    getHeaders: (apiKey) => ({
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    }),
  },
  openai: {
    url: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o",
    getHeaders: (apiKey) => ({
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    }),
  },
  gemini: {
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    model: "gemini-2.0-flash",
    getHeaders: (apiKey) => ({
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    }),
  },
  deepseek: {
    url: "https://api.deepseek.com/chat/completions",
    model: "deepseek-chat",
    getHeaders: (apiKey) => ({
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    }),
  },
  claude: {
    url: "https://api.anthropic.com/v1/messages",
    model: "claude-sonnet-4-20250514",
    getHeaders: (apiKey) => ({
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    }),
  },
};

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
  ai_provider?: string;
}

interface SavedAddress {
  id: string;
  label: string;
  address: string;
  isDefault: boolean;
}

interface CustomerContext {
  isReturning: boolean;
  savedAddresses?: SavedAddress[];
  customerName?: string;
}

interface AddressAction {
  type: 'list' | 'add' | 'edit' | 'delete' | 'set_default';
  label?: string;
  address?: string;
}

interface StoreSettings {
  storeName: string;
  storePhone: string;
  storeAddress: string;
  storeEmail: string;
  returnPolicy: string;
  shippingInfo: string;
  businessHours: string;
  lineId: string;
  facebookPage: string;
  instagram: string;
  bankAccounts: string;
  paymentMethods: string;
  warrantyInfo: string;
  privacyPolicy: string;
  termsConditions: string;
}

function buildDynamicPrompt(settings: AISettings, productCatalog: string, faqList: string, storeSettings: StoreSettings, isFirstMessage: boolean, scrapedContent: string, customerContext?: CustomerContext): string {
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

  // Formality description
  const formalityDescriptions: Record<number, string> = {
    1: "เป็นกันเองมาก ใช้ภาษาสบายๆ พูดคุยเหมือนเพื่อน",
    2: "เป็นกันเอง สุภาพแต่ไม่เครียด พูดจาน่ารัก",
    3: "ปานกลาง สุภาพพอประมาณ เป็นมืออาชีพแต่ไม่แข็งทื่อ",
    4: "เป็นทางการ สุภาพเรียบร้อย ใช้ภาษาที่เหมาะสม",
    5: "เป็นทางการมาก ใช้ภาษาสุภาพสูง เหมาะกับลูกค้าองค์กร",
  };

  // Response length guide
  const responseLengthGuide: Record<string, string> = {
    short: "ตอบสั้นกระชับ 1-2 ประโยค ตรงประเด็น",
    medium: "ตอบปานกลาง 3-4 ประโยค ให้ข้อมูลครบถ้วน",
    long: "ตอบละเอียด 5+ ประโยค อธิบายเจาะลึก",
  };

  // Emoji guide
  const emojiGuide = use_emoji 
    ? "ใช้ emoji เล็กน้อยเพื่อความเป็นกันเอง เช่น 😊 🙏 ✨ 🔥 💕" 
    : "ไม่ใช้ emoji ในการสนทนา";

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
- "หวัดดี${pEnd} คุณ${customerName}! เป็นอย่างไรบ้าง${pQuestion}? 😊 วันนี้มาดูสินค้าอะไรดี${pQuestion}?"
- "สวัสดี${pEnd} คุณ${customerName}! ยินดีที่ได้เจอกันอีก${pEnd} ✨ มีสินค้าใหม่น่าสนใจหลายตัวเลย${pEnd} สนใจดูไหม${pQuestion}?"

**ห้าม:**
- ❌ ห้ามใช้คำทักทายแบบทั่วไป เช่น "สวัสดีค่ะ ยินดีต้อนรับ" โดยไม่เรียกชื่อ
- ❌ ห้ามถามว่า "ไม่ทราบชื่ออะไรคะ?" หรือ "ขอชื่อด้วยค่ะ"
- ❌ ห้ามทักทายซ้ำซากเหมือนกันทุกครั้ง - ต้องมีความหลากหลาย`;
    } else if (greeting_message) {
      // New customer with greeting message
      greetingInstruction = `## 👋 ข้อความทักทาย (ใช้ในคำตอบนี้เท่านั้น เพราะเป็นการสนทนาใหม่):\nเริ่มต้นด้วย: "${greeting_message}"`;
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

## 🏪 ข้อมูลร้านค้าอย่างเป็นทางการ (สำคัญที่สุด - ใช้ข้อมูลนี้เป็นหลัก):
${storeSettings.storeName ? `- ชื่อร้าน: ${storeSettings.storeName}` : ''}
${storeSettings.storePhone ? `- เบอร์โทร: ${storeSettings.storePhone}` : ''}
${storeSettings.storeAddress ? `- ที่อยู่: ${storeSettings.storeAddress}` : ''}
${storeSettings.storeEmail ? `- อีเมล: ${storeSettings.storeEmail}` : ''}
${storeSettings.businessHours ? `- เวลาทำการ: ${storeSettings.businessHours}` : ''}

${storeSettings.lineId || storeSettings.facebookPage || storeSettings.instagram ? `## 📱 ช่องทางติดต่อเพิ่มเติม:
${storeSettings.lineId ? `- LINE: ${storeSettings.lineId}` : ''}
${storeSettings.facebookPage ? `- Facebook: ${storeSettings.facebookPage}` : ''}
${storeSettings.instagram ? `- Instagram: ${storeSettings.instagram}` : ''}` : ''}

${storeSettings.shippingInfo ? `## 🚚 ข้อมูลการจัดส่ง (สำคัญ - ใช้ข้อมูลนี้เท่านั้น ห้ามใช้ข้อมูลจาก FAQ):\n${storeSettings.shippingInfo}` : ''}

${storeSettings.bankAccounts || storeSettings.paymentMethods ? `## 💰 ข้อมูลการชำระเงินของร้าน (สำคัญมาก - ใช้ข้อมูลนี้เท่านั้น!):
${storeSettings.bankAccounts ? `บัญชีธนาคาร:\n${storeSettings.bankAccounts}` : ''}
${storeSettings.paymentMethods ? `\nวิธีการชำระเงินที่รับ:\n${storeSettings.paymentMethods}` : ''}

**กฎการแจ้งข้อมูลชำระเงิน (สำคัญมาก!):**
- แจ้งเลขบัญชีหรือ PromptPay เพียงครั้งเดียวต่อการสนทนา ไม่แจ้งซ้ำ
- ใช้ format นี้เท่านั้น: [COPY:เลขบัญชี] เช่น [COPY:1234567890] เพื่อให้ลูกค้าคัดลอกได้ง่าย
- ถ้าลูกค้าส่งเลขมาแล้วตรงกับข้อมูลร้าน → ยืนยันว่าถูกต้อง
- ถ้าลูกค้าส่งเลขมาแล้วไม่ตรงกับข้อมูลร้าน → แจ้งว่าไม่ใช่บัญชีของร้าน และแจ้งบัญชีที่ถูกต้องพร้อม format [COPY:xxx]
- ห้ามแสดงหลายบัญชีพร้อมกันถ้าลูกค้าไม่ได้ถาม` : ''}

${storeSettings.returnPolicy ? `## 📋 นโยบายการคืนสินค้า (สำคัญ - ใช้ข้อมูลนี้เท่านั้น):\n${storeSettings.returnPolicy}` : ''}

${storeSettings.warrantyInfo ? `## 🛡️ การรับประกัน (สำคัญ - ใช้ข้อมูลนี้เท่านั้น):\n${storeSettings.warrantyInfo}` : ''}

${storeSettings.privacyPolicy ? `## 🔒 นโยบายความเป็นส่วนตัว:\n${storeSettings.privacyPolicy}` : ''}

${storeSettings.termsConditions ? `## 📜 ข้อกำหนดและเงื่อนไข:\n${storeSettings.termsConditions}` : ''}

${scrapedContent ? `## 🌐 ข้อมูลจากเว็บไซต์ภายนอก (ใช้อ้างอิงเพิ่มเติม):\n${scrapedContent}` : ''}

${faqList ? `## ❓ คำถามที่พบบ่อย (ใช้เป็นข้อมูลเสริมเท่านั้น - ถ้าข้อมูลขัดแย้งกับข้อมูลร้านค้าด้านบน ให้ใช้ข้อมูลร้านค้าเป็นหลัก):\n${faqList}` : ''}

## 🚫 กฎเรื่องสต็อก (สำคัญมาก - ห้ามบอกลูกค้า!):
**⚠️ กฎสำคัญ: ห้ามแจ้งสถานะสต็อกให้ลูกค้าทราบเด็ดขาด**
- **ห้ามบอกจำนวนสต็อก** หรือบอกว่า "สินค้ามีพร้อมจำหน่าย" "สินค้ามีสต็อก" เด็ดขาด
- **ห้ามใส่ข้อความหมายเหตุ** เช่น "[หมายเหตุ: สินค้ามีสต็อก...]" เด็ดขาด
- **ถ้าสินค้าพอ** → ดำเนินการปกติ ไม่ต้องบอกลูกค้าเรื่องสต็อกเลย
- หากสั่งเกินสต็อก → แจ้งว่า "ขออภัย${particleEnd} สินค้านี้เหลือเพียง X ชิ้น" (เฉพาะกรณีนี้)
- หากหมดสต็อก (0) → แจ้ง "ขออภัย${particleEnd} สินค้าหมดชั่วคราว" และแนะนำสินค้าใกล้เคียง

## 🎨 กฎเรื่องตัวเลือกสินค้า (สำคัญมาก - ห้ามละเมิดเด็ดขาด!):
- **ห้ามแต่งสี ไซส์ หรือตัวเลือกเอง** - ต้องอ้างอิงจากข้อมูล "ตัวเลือก" ในรายการสินค้าด้านบนเท่านั้น
- ถ้าลูกค้าถามว่า "มีสีแดงไหม" และสินค้านั้นมีตัวเลือก "สี: ขาว, ดำ, เทา" → ต้องตอบว่า "ขออภัย${particleEnd} สินค้านี้มีเฉพาะสีขาว ดำ และเทาค่ะ ไม่มีสีแดง${particleEnd}"
- ถ้าสินค้าไม่มีข้อมูลตัวเลือก → บอกว่า "สินค้านี้มีแบบเดียว${particleEnd}" หรือ "รบกวนสอบถามทางร้านเพิ่มเติมนะ${particleQuestion}"
- **ห้ามยืนยันว่ามีสี/ไซส์ที่ไม่ได้ระบุในข้อมูลสินค้า**

## ⚠️ กฎสำคัญที่สุด - ห้ามแต่งข้อมูลเอง (ละเมิดแล้วผิดร้ายแรง!):
- **ห้ามแต่งเลขบัญชีธนาคาร PromptPay หรือวิธีชำระเงินเอง** - ใช้เฉพาะข้อมูลที่ให้ไว้ด้านบนเท่านั้น
- **ห้ามแต่งสี ไซส์ หรือตัวเลือกสินค้าเอง** - ใช้เฉพาะที่ระบุใน "ตัวเลือก" ของแต่ละสินค้าเท่านั้น ถ้าไม่มีข้อมูลตัวเลือกให้บอกว่าไม่มี ห้ามเดาเอง
- ห้ามสร้างข้อมูลใหม่ที่ไม่มีใน context นี้ เช่น เลขโทรศัพท์ ที่อยู่ ราคา ที่ไม่ได้ระบุไว้
- ถ้าไม่มีข้อมูล ให้ตอบว่า "ขออภัย${particleEnd} ไม่มีข้อมูลในส่วนนี้ รบกวนติดต่อทางร้านโดยตรงนะ${particleQuestion}"

## 💬 สไตล์การสื่อสาร:
- **ความเป็นทางการ**: ${formalityDescriptions[formality_level] || formalityDescriptions[3]}
- **คำลงท้าย**: ใช้ "${particleEnd}" และ "${particleQuestion}" อย่างสม่ำเสมอ
- **ความยาวคำตอบ**: ${responseLengthGuide[response_length] || responseLengthGuide["medium"]}
- **Emoji**: ${emojiGuide}
- ถามความต้องการก่อนแนะนำ เช่น "ไม่ทราบว่าสนใจสินค้าประเภทไหนเป็นพิเศษ${particleQuestion}?"
- ไม่พูดซ้ำซาก หรือแนะนำสินค้าซ้ำๆ

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

## 🛒 กฎการสร้างออเดอร์ใหม่ (สำคัญมาก - ห้ามละเมิด!):
- **เมื่อลูกค้าขอสร้างออเดอร์ใหม่** → ต้องเริ่มนับรายการสินค้าใหม่ทั้งหมดจากศูนย์
- **ห้ามนำสินค้าจากออเดอร์เก่าหรือการสนทนาก่อนหน้ามารวมในออเดอร์ใหม่**
- **สินค้าที่นับในออเดอร์ใหม่** → เฉพาะสินค้าที่ลูกค้าระบุหลังจากพูดว่า "สร้างใหม่" หรือ "ออเดอร์ใหม่" เท่านั้น
- ตัวอย่าง:
  - ลูกค้า: "กระเป๋าเกินอยู่แล้ว สร้างใหม่ก็ได้ครับ" → สินค้าก่อนหน้านี้ทั้งหมดถูกยกเลิก
  - ลูกค้า: "เอากระเป๋าเป้ 1 ใบ" → ออเดอร์ใหม่มีเฉพาะกระเป๋าเป้ 1 ใบเท่านั้น
- **ก่อนสรุปออเดอร์ ต้องยืนยันว่ามีสินค้าอะไรบ้างที่ลูกค้าต้องการในออเดอร์นี้**

## ⚠️ กฎเรื่องการถามสินค้าเพิ่มหลังสั่งซื้อแล้ว (สำคัญมาก!):
- **เมื่อลูกค้าสั่งซื้อสินค้าและได้เลขออเดอร์ไปแล้ว** → ออเดอร์นั้นถือว่า "ปิดแล้ว" จะแก้ไขหรือเพิ่มสินค้าไม่ได้
- **ห้ามรวมสินค้าใหม่กับออเดอร์ที่สั่งไปแล้ว** → ถ้าลูกค้าถามสินค้าใหม่ ให้เริ่มต้นใหม่เป็นออเดอร์แยกต่างหาก
- **เมื่อลูกค้าถามสินค้าใหม่หลังสั่งซื้อ**:
  - ถ้าแค่ถาม/สนใจ → แนะนำสินค้าได้ตามปกติ แต่ไม่บอกว่า "รวมกับออเดอร์เดิม"
  - ถ้าต้องการซื้อ → ต้องสร้างออเดอร์ใหม่และเก็บข้อมูล (ชื่อ/เบอร์/ที่อยู่) ใหม่ หรือใช้ที่อยู่ที่บันทึกไว้
- **การถามสินค้าไม่ได้หมายความว่าลูกค้าต้องการซื้อ** → ถ้าลูกค้าถามราคา/รายละเอียด ให้ถามยืนยันก่อนว่า "สนใจสั่งซื้อไหม${particleQuestion}?"
- **ห้ามสมมติว่าลูกค้าจะซื้อสินค้าที่ถาม** → รอลูกค้ายืนยันก่อนว่าต้องการซื้อจริงๆ
- ตัวอย่าง:
  - ลูกค้าสั่งออเดอร์ A ไปแล้ว ถามว่า "มีรองเท้าไหม" → แค่แนะนำสินค้า ไม่รวมกับออเดอร์ A
  - ลูกค้าบอก "เอารองเท้าด้วย" → ต้องถามว่า "ต้องการสร้างออเดอร์ใหม่เลยไหม${particleQuestion}?" แล้วเก็บข้อมูลใหม่

${custom_rules ? `## ⚠️ กฎพิเศษที่ต้องปฏิบัติตาม:\n${custom_rules.split(',').map(rule => `- ${rule.trim()}`).join('\n')}` : ''}

## 🛍️ การแสดงสินค้า (สำคัญมาก!):
การ์ดสินค้าช่วยให้ลูกค้าเห็นภาพ แต่ต้องใช้อย่างเหมาะสม ไม่ใช่ทุกครั้งที่พูดถึงสินค้า

### ✅ กรณีที่ต้องใส่ marker แสดงสินค้า:
- **ลูกค้าถาม/ขอดูสินค้า** → ใส่ [PRODUCT:ชื่อสินค้าเต็ม]
- **แนะนำสินค้าใหม่ให้ลูกค้า** → ใส่ [PRODUCT:ชื่อสินค้าเต็ม]
- **ลูกค้าถามสินค้าหลายตัว/ทั้งหมด** → ใส่ [SHOW_PRODUCTS]
- **ลูกค้าถามโปรโมชั่น/ลดราคา** → ใส่ [SHOW_PROMOTIONS]

### ❌ กรณีที่ห้ามใส่ marker (สำคัญที่สุด! ห้ามละเมิดเด็ดขาด!):
- **ยืนยันรายการที่ลูกค้าสั่ง** → ห้ามใส่ [PRODUCT:...] เด็ดขาด! ลูกค้าบอกว่าจะซื้ออะไร ให้ยืนยันด้วยข้อความเท่านั้น
- **สรุปออเดอร์/สรุปรายการ** → ห้ามใส่ marker เด็ดขาด! แค่พิมพ์สรุปรายการ
- **ถามข้อมูลลูกค้า (ชื่อ/เบอร์/ที่อยู่)** → ห้ามใส่ marker
- **ลูกค้าบอกสี/ไซส์/จำนวน** → ห้ามใส่ marker เพราะแค่ยืนยันข้อมูล
- **รับออเดอร์/แจ้งเลขออเดอร์** → ห้ามใส่ marker
- **ลูกค้ายืนยัน "ถูกต้อง/ตกลง/โอเค"** → ห้ามใส่ marker
- **สรุปราคา/คำนวณยอดรวม** → ห้ามใส่ marker
- **กำลังเก็บข้อมูลสำหรับสร้างออเดอร์** → ห้ามใส่ marker

**เน้นย้ำ**: เมื่อลูกค้าบอกว่าจะซื้อสินค้า ให้ยืนยันรายการด้วยข้อความเท่านั้น ห้ามส่งการ์ดสินค้า!

### ตัวอย่างที่ถูกต้อง:
- ลูกค้า: "อยากได้นาฬิกา" → "ร้านมีนาฬิกาข้อมือแฟชั่นสวยมาก${particleEnd} ราคา 999 บาท สนใจไหม${particleQuestion}? [PRODUCT:นาฬิกาข้อมือแฟชั่น]"
- ลูกค้า: "เอาสีดำ ไซส์ M" → "รับทราบ${particleEnd} สีดำ ไซส์ M นะ${particleQuestion} ขอชื่อ-ที่อยู่จัดส่งด้วย${particleEnd}" (ไม่มี marker!)
- ลูกค้า: "ถูกต้องครับ" → "สรุปรายการ: เสื้อยืด 1 ตัว สีดำ ไซส์ M รวม 299 บาท${particleEnd}" (ไม่มี marker!)

**หมายเหตุ**: ใช้ชื่อสินค้าเต็มเท่านั้น เช่น [PRODUCT:เสื้อยืดคอกลม] ไม่ใช่ [PRODUCT:เสื้อยืด]

## 📈 เทคนิคการขาย (สำคัญมาก - ใช้ทุกครั้งที่เหมาะสม!):

### 🔼 Up-sell (แนะนำสินค้าที่ดีกว่า):
- หากลูกค้าสนใจสินค้าราคาถูก → แนะนำรุ่นที่ดีกว่าในราคาที่สูงขึ้นเล็กน้อย
- ตัวอย่าง: "ร้านมี [สินค้ารุ่นพรีเมียม] ที่คุณภาพดีกว่า ราคาต่างกันแค่ xx บาท${particleEnd} สนใจดูไหม${particleQuestion}?"

### 🔄 Cross-sell (สำคัญมาก! ต้องทำอย่างเป็นธรรมชาติ!):

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

### ⏰ สร้าง Urgency:
- "ตอนนี้โปรโมชั่นลดราคาอยู่${particleEnd}"
- "สินค้าตัวนี้ขายดีมาก${particleEnd}"
- "สินค้าใหม่เพิ่งเข้า${particleEnd}"

## 📝 การรับออเดอร์ (ถามทีละข้อ และสร้างออเดอร์จริง!):
1. ยืนยันรายการสินค้าและจำนวน (จดจำไว้ในใจ)
2. ถามชื่อ-นามสกุล ของลูกค้า
3. ถามที่อยู่จัดส่ง (พร้อมรหัสไปรษณีย์)${customerContext?.savedAddresses && customerContext.savedAddresses.length > 0 ? ' - แนะนำที่อยู่ที่บันทึกไว้ให้ลูกค้า' : ''}
4. ถามเบอร์โทรศัพท์
5. สรุปออเดอร์และยอดรวม แล้วถามยืนยัน
6. **เมื่อลูกค้ายืนยัน** → สร้างออเดอร์โดยใส่คำสั่ง:
   [CREATE_ORDER:ชื่อสินค้า1|จำนวน|ราคา,ชื่อสินค้า2|จำนวน|ราคา|ชื่อลูกค้า|เบอร์โทร|ที่อยู่|ยอดรวม]
   
   ตัวอย่าง: [CREATE_ORDER:รองเท้าผ้าใบ|2|990,เสื้อยืด|1|299|สมชาย ใจดี|0812345678|123 ถ.สุขุมวิท กทม 10110|2279]
   
7. หลังสร้างออเดอร์ ระบบจะแจ้งเลขออเดอร์ให้ลูกค้าอัตโนมัติ
8. แนะนำให้ลูกค้าแนบสลิปโอนเงินโดยใช้ปุ่ม 📎 ด้านซ้ายของช่องพิมพ์ข้อความ

## ⚠️ กฎการสร้างออเดอร์ (สำคัญมาก!):
- **ต้องได้ข้อมูลครบ** ก่อนสร้างออเดอร์: รายการสินค้า, ชื่อ, เบอร์โทร, ที่อยู่
- **ห้ามสร้างออเดอร์** ถ้าลูกค้ายังไม่ยืนยัน
- ราคาต้องตรงกับราคาสินค้าในระบบ (ใช้ราคาโปรโมชั่นถ้ามี)
- หลังสร้างออเดอร์สำเร็จ แจ้งเลขออเดอร์และบอกให้แนบสลิป

## 🛒 การถามซื้อสินค้าเพิ่มหลังสั่งซื้อ (Cross-sell):
**หลังสร้างออเดอร์สำเร็จ** → ต้องถามลูกค้าว่าสนใจสินค้าอื่นเพิ่มเติมหรือไม่
- ถามด้วยความเป็นกันเอง เช่น "สนใจดูสินค้าอื่นเพิ่มเติมไหม${particleQuestion}?" หรือ "มีสินค้าอื่นที่สนใจอีกไหม${particleQuestion}?"
- **ห้ามแนะนำสินค้าทันที** → รอลูกค้าตอบก่อน
- ถ้าลูกค้าตอบว่า "ไม่" / "ไม่ครับ" / "พอแล้ว" → ขอบคุณและปิดการสนทนา
- ถ้าลูกค้าสนใจ → แนะนำสินค้าอื่นที่เข้าคู่หรือสินค้าขายดี
- **การซื้อเพิ่มต้องสร้างออเดอร์ใหม่** → ไม่สามารถรวมกับออเดอร์เดิมได้

### ตัวอย่าง:
- หลังสร้างออเดอร์: "รับทราบ${particleEnd} ออเดอร์ของคุณคือ ORD-XXXXXX กรุณาโอนเงินและแนบสลิปโดยใช้ปุ่ม 📎 ด้านซ้ายช่องพิมพ์ข้อความนะ${particleQuestion} 🙏 สนใจดูสินค้าอื่นเพิ่มเติมไหม${particleQuestion}?"
- ลูกค้า: "ไม่ครับ" → "ขอบคุณมาก${particleEnd} หากมีข้อสงสัยเพิ่มเติมสามารถสอบถามได้ตลอดนะ${particleQuestion} 🙏"
- ลูกค้า: "มีอะไรแนะนำบ้าง" → แนะนำสินค้าพร้อม [SHOW_PRODUCTS]

## 📦 การติดตามสถานะออเดอร์:
เมื่อลูกค้าต้องการเช็คสถานะออเดอร์ หรือถามว่า "ออเดอร์ของฉัน", "ติดตามสถานะ", "สถานะการจัดส่ง":
- ใส่คำสั่ง [CHECK_ORDER:เลขออเดอร์] เช่น [CHECK_ORDER:ORD-20250101-1234]
- ถ้าลูกค้าไม่ได้ระบุเลขออเดอร์ ให้ถามก่อน: "รบกวนแจ้งเลขที่ออเดอร์ด้วยนะ${particleQuestion}?"
- ระบบจะดึงข้อมูลสถานะมาแสดงให้อัตโนมัติ

สถานะออเดอร์:
- pending = รอยืนยัน (รอตรวจสอบการชำระเงิน)
- confirmed = ยืนยันแล้ว (กำลังเตรียมสินค้า)
- shipped = จัดส่งแล้ว (พร้อมเลขพัสดุถ้ามี)
- delivered = จัดส่งสำเร็จ
- cancelled = ยกเลิก

${customerContext?.savedAddresses && customerContext.savedAddresses.length > 0 ? `## 📍 ที่อยู่ที่บันทึกไว้ของลูกค้า:
${customerContext.savedAddresses.map((a, i) => (i + 1) + '. ' + a.label + ': ' + a.address + (a.isDefault ? ' ⭐ (ค่าเริ่มต้น)' : '')).join('\n')}

### กฎการใช้ที่อยู่:
- เมื่อถามที่อยู่จัดส่ง ให้แนะนำที่อยู่ที่บันทึกไว้ เช่น "จะส่งไปที่อยู่เดิมไหม${particleQuestion}? มีที่อยู่บันทึกไว้: [รายการที่อยู่]"
- ถ้าลูกค้าพิมพ์ "ที่เดิม", "เหมือนเดิม", "ที่อยู่เดิม" → ใช้ที่อยู่ค่าเริ่มต้น (⭐) หรือที่อยู่แรก
- ถ้าลูกค้าระบุป้ายกำกับ เช่น "ส่งที่ทำงาน" → ใช้ที่อยู่ตามป้ายกำกับนั้น
` : ''}

## 📍 การจัดการที่อยู่จัดส่ง:
เมื่อลูกค้าต้องการจัดการที่อยู่ ให้ใส่คำสั่งในรูปแบบนี้:
- ดูที่อยู่ทั้งหมด: [ADDRESS_LIST]
- เพิ่มที่อยู่ใหม่: [ADDRESS_ADD:ป้ายกำกับ|ที่อยู่เต็ม]
- แก้ไขที่อยู่: [ADDRESS_EDIT:ป้ายกำกับ|ที่อยู่ใหม่]
- ลบที่อยู่: [ADDRESS_DELETE:ป้ายกำกับ]
- ตั้งค่าเริ่มต้น: [ADDRESS_DEFAULT:ป้ายกำกับ]

ตัวอย่าง:
- "เพิ่มที่อยู่บ้าน: 123 ถ.สุขุมวิท กทม" → ตอบ: "บันทึกที่อยู่เรียบร้อยแล้ว${particleEnd}" พร้อมใส่ [ADDRESS_ADD:บ้าน|123 ถ.สุขุมวิท กทม]
- "ดูที่อยู่ของฉัน" → ใส่ [ADDRESS_LIST] แล้ว AI จะแสดงรายการ

## ❌ สิ่งที่ห้ามทำ:
- ห้ามตอบคำถามที่ไม่เกี่ยวกับสินค้าหรือการซื้อขาย
- ห้ามให้ข้อมูลที่ไม่แน่ใจ ถ้าไม่รู้ให้ตอบว่า "ขออภัย${particleEnd} ไม่มีข้อมูลในส่วนนี้ รบกวนติดต่อทางร้านโดยตรงนะ${particleQuestion}"
- ห้ามพูดถึงเรื่องการเมือง ศาสนา หรือเรื่องละเอียดอ่อน
- ห้ามแกล้งทำเป็นมนุษย์ ถ้าถามว่าเป็น AI ให้ยอมรับว่า "ใช่${particleEnd} เป็น AI ผู้ช่วยขาย${particleEnd}"`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, conversationId, webUserId } = await req.json();
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Check for cache invalidation before using cache
    await checkCacheInvalidation(supabase);

    // ============= Try to get data from cache first =============
    let products = getCached<any[]>('products');
    let faqs = getCached<any[]>('faqs');
    let settingsData = getCached<any[]>('settings');
    let scrapedData = getCached<any[]>('scraped_content');
    let knowledgeData = getCached<any[]>('knowledge_base');
    let aiSettingsData = getCached<any>('ai_settings');
    let relatedProductsData = getCached<any[]>('related_products');

    // Check what needs to be fetched
    const needsAiSettings = !aiSettingsData;
    const needsProducts = !products;
    const needsFaqs = !faqs;
    const needsSettings = !settingsData;
    const needsScraped = !scrapedData;
    const needsKnowledge = !knowledgeData;
    const needsRelatedProducts = !relatedProductsData;

    const cacheHits = [];
    const cacheMisses = [];
    if (needsAiSettings) cacheMisses.push('ai_settings'); else cacheHits.push('ai_settings');
    if (needsProducts) cacheMisses.push('products'); else cacheHits.push('products');
    if (needsFaqs) cacheMisses.push('faqs'); else cacheHits.push('faqs');
    if (needsSettings) cacheMisses.push('settings'); else cacheHits.push('settings');
    if (needsScraped) cacheMisses.push('scraped'); else cacheHits.push('scraped');
    if (needsKnowledge) cacheMisses.push('knowledge'); else cacheHits.push('knowledge');
    if (needsRelatedProducts) cacheMisses.push('related_products'); else cacheHits.push('related_products');

    if (cacheMisses.length > 0) {
      console.log(`Cache miss: ${cacheMisses.join(', ')} | Cache hit: ${cacheHits.join(', ')}`);
      
      // Fetch all missing data in parallel
      const [
        aiSettingsResult,
        productsResult,
        faqsResult,
        settingsResult,
        scrapedResult,
        knowledgeResult,
        relatedProductsResult
      ] = await Promise.all([
        needsAiSettings ? supabase.from("ai_settings").select("*").eq("is_active", true).maybeSingle() : Promise.resolve({ data: aiSettingsData }),
        needsProducts ? supabase.from("products").select("*").eq("is_active", true) : Promise.resolve({ data: products }),
        needsFaqs ? supabase.from("faqs").select("question, answer").eq("is_active", true) : Promise.resolve({ data: faqs }),
        needsSettings ? supabase.from("settings").select("key, value").in("key", ["STORE_NAME", "STORE_PHONE", "STORE_ADDRESS", "STORE_EMAIL", "RETURN_POLICY", "SHIPPING_INFO", "BUSINESS_HOURS", "LINE_ID", "FACEBOOK_PAGE", "INSTAGRAM", "BANK_ACCOUNTS", "PAYMENT_METHODS", "WARRANTY_INFO", "PRIVACY_POLICY", "TERMS_CONDITIONS"]) : Promise.resolve({ data: settingsData }),
        needsScraped ? supabase.from("scraped_content").select("source_name, summary, content").eq("is_active", true) : Promise.resolve({ data: scrapedData }),
        needsKnowledge ? supabase.from("knowledge_base").select("title, summary, original_content, category").eq("is_active", true) : Promise.resolve({ data: knowledgeData }),
        needsRelatedProducts ? supabase.from("related_products").select("product_id, related_product_id") : Promise.resolve({ data: relatedProductsData })
      ]);

      // Update cache for fetched data
      if (needsAiSettings && aiSettingsResult.data) {
        aiSettingsData = aiSettingsResult.data;
        setCache('ai_settings', aiSettingsData, 2 * 60 * 1000); // 2 min for AI settings
      }
      if (needsProducts) {
        products = productsResult.data || [];
        setCache('products', products);
      }
      if (needsFaqs) {
        faqs = faqsResult.data || [];
        setCache('faqs', faqs);
      }
      if (needsSettings) {
        settingsData = settingsResult.data || [];
        setCache('settings', settingsData);
      }
      if (needsScraped) {
        scrapedData = scrapedResult.data || [];
        setCache('scraped_content', scrapedData);
      }
      if (needsKnowledge) {
        knowledgeData = knowledgeResult.data || [];
        setCache('knowledge_base', knowledgeData);
      }
      if (needsRelatedProducts) {
        relatedProductsData = relatedProductsResult.data || [];
        setCache('related_products', relatedProductsData);
      }
    } else {
      console.log('All data served from cache!');
    }

    // Process AI settings
    const aiSettings: AISettings = aiSettingsData || {
      ai_name: "น้องช้อป",
      gender: "female",
      personality: "ร่าเริง เป็นกันเอง สนุกสนาน กระตือรือร้น ชอบช่วยเหลือลูกค้า",
      formality_level: 2,
      use_emoji: true,
      response_length: "medium",
      greeting_message: "สวัสดีค่ะ! 😊 ยินดีต้อนรับค่ะ",
      closing_message: "ขอบคุณมากค่ะ! 🙏",
      custom_rules: "ห้ามพูดเรื่องการเมือง, ห้ามเปิดเผยสต็อก",
    };

    console.log("Using AI settings:", aiSettings.ai_name);

    // Ensure arrays are initialized
    products = products || [];
    faqs = faqs || [];
    scrapedData = scrapedData || [];
    knowledgeData = knowledgeData || [];
    settingsData = settingsData || [];
    relatedProductsData = relatedProductsData || [];

    // Build related products map for cross-sell
    const relatedProductsMap = new Map<string, string[]>();
    for (const rp of relatedProductsData) {
      const existing = relatedProductsMap.get(rp.product_id) || [];
      existing.push(rp.related_product_id);
      relatedProductsMap.set(rp.product_id, existing);
    }

    // Process store settings
    const storeSettingsMap = new Map(settingsData.map((s: any) => [s.key, s.value]));
    const storeSettings: StoreSettings = {
      storeName: storeSettingsMap.get("STORE_NAME") || "",
      storePhone: storeSettingsMap.get("STORE_PHONE") || "",
      storeAddress: storeSettingsMap.get("STORE_ADDRESS") || "",
      storeEmail: storeSettingsMap.get("STORE_EMAIL") || "",
      returnPolicy: storeSettingsMap.get("RETURN_POLICY") || "",
      shippingInfo: storeSettingsMap.get("SHIPPING_INFO") || "",
      businessHours: storeSettingsMap.get("BUSINESS_HOURS") || "",
      lineId: storeSettingsMap.get("LINE_ID") || "",
      facebookPage: storeSettingsMap.get("FACEBOOK_PAGE") || "",
      instagram: storeSettingsMap.get("INSTAGRAM") || "",
      bankAccounts: storeSettingsMap.get("BANK_ACCOUNTS") || "",
      paymentMethods: storeSettingsMap.get("PAYMENT_METHODS") || "",
      warrantyInfo: storeSettingsMap.get("WARRANTY_INFO") || "",
      privacyPolicy: storeSettingsMap.get("PRIVACY_POLICY") || "",
      termsConditions: storeSettingsMap.get("TERMS_CONDITIONS") || "",
    };

    console.log("Store settings loaded:", { 
      hasStoreName: !!storeSettings.storeName,
      hasReturnPolicy: !!storeSettings.returnPolicy,
      hasShippingInfo: !!storeSettings.shippingInfo
    });

    // Build product catalog with image URLs, variants, and related products
    const productCatalog = products.map((p: any) => {
      let productInfo = `- ${p.name}: ${p.description || 'ไม่มีรายละเอียด'} | ราคา: ฿${p.price}${p.promotion_price ? ` (โปรโมชั่น: ฿${p.promotion_price})` : ''} | รูป: ${p.image_url ? 'มี' : 'ไม่มี'} | [สต็อกภายใน: ${p.stock}]`;
      
      // Add variants info
      if (p.variants && Array.isArray(p.variants) && p.variants.length > 0) {
        const variantTexts: string[] = [];
        for (const v of p.variants) {
          if (v && v.name && v.options && Array.isArray(v.options) && v.options.length > 0) {
            variantTexts.push(`${v.name}: ${v.options.join(', ')}`);
          }
        }
        if (variantTexts.length > 0) {
          productInfo += ` | ตัวเลือก: [${variantTexts.join(' | ')}]`;
        }
      }

      // Add related products info (from admin configuration)
      const relatedIds = relatedProductsMap.get(p.id) || [];
      if (relatedIds.length > 0) {
        const relatedNames = relatedIds
          .map(id => products.find((prod: any) => prod.id === id)?.name)
          .filter(Boolean);
        if (relatedNames.length > 0) {
          productInfo += ` | สินค้าที่เกี่ยวข้อง: [${relatedNames.join(', ')}]`;
        }
      }
      
      return productInfo;
    }).join('\n') || 'ยังไม่มีสินค้าในระบบ';

    console.log("Related products configured:", relatedProductsData.length, "pairs");

    // Build FAQ list
    const faqList = faqs.map((f: any) => 
      `Q: ${f.question}\nA: ${f.answer}`
    ).join('\n\n') || '';

    // Process scraped content
    const scrapedContentList = scrapedData.map((s: any) => {
      const text = s.summary || (s.content ? s.content.substring(0, 1000) + '...' : '');
      return `### ${s.source_name || 'แหล่งข้อมูล'}:\n${text}`;
    }).join('\n\n') || '';

    console.log("Scraped content loaded:", scrapedData.length, "items");

    // Process knowledge base
    const knowledgeBaseList = knowledgeData.map((k: any) => {
      const text = k.summary || (k.original_content ? k.original_content.substring(0, 2000) : '');
      return `### ${k.title}${k.category ? ` (${k.category})` : ''}:\n${text}`;
    }).join('\n\n') || '';

    console.log("Knowledge base loaded:", knowledgeData.length, "items");

    // Combine scraped content and knowledge base
    let combinedExternalContent = scrapedContentList;
    if (knowledgeBaseList) {
      combinedExternalContent += (combinedExternalContent ? '\n\n' : '') + `## 📚 ฐานความรู้ (Knowledge Base):\n${knowledgeBaseList}`;
    }

    // Determine if this is the first message in the conversation
    const userMessages = messages.filter((m: { role: string }) => m.role === 'user');
    const isFirstMessage = userMessages.length <= 1;

    // Fetch saved addresses and customer info for web user if webUserId is provided
    let customerContext: CustomerContext = { isReturning: false };
    if (webUserId) {
      // Fetch addresses and conversation info in parallel
      const [addressesResult, conversationResult] = await Promise.all([
        supabase
          .from("customer_addresses")
          .select("*")
          .eq("platform_user_id", webUserId)
          .eq("platform", "web")
          .order("is_default", { ascending: false }),
        supabase
          .from("chat_conversations")
          .select("customer_name")
          .eq("platform_user_id", webUserId)
          .eq("platform", "web")
          .not("customer_name", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      ]);

      const addressesData = addressesResult.data;
      const conversationData = conversationResult.data;

      if ((addressesData && addressesData.length > 0) || conversationData?.customer_name) {
        customerContext = {
          isReturning: true,
          customerName: conversationData?.customer_name || undefined,
          savedAddresses: addressesData?.map((a: any) => ({
            id: a.id,
            label: a.label,
            address: a.address,
            isDefault: a.is_default
          })) || []
        };
        console.log(`Returning customer: ${conversationData?.customer_name || 'unknown'}, ${addressesData?.length || 0} saved addresses`);
      }
    }

    // Build dynamic system prompt
    const systemPrompt = buildDynamicPrompt(aiSettings, productCatalog, faqList, storeSettings, isFirstMessage, combinedExternalContent, customerContext);
    
    console.log("Is first message:", isFirstMessage);

    // Determine which provider to use
    const provider = aiSettings.ai_provider || 'lovable';
    const providerConfig = PROVIDER_CONFIGS[provider] || PROVIDER_CONFIGS.lovable;
    
    let apiKey = LOVABLE_API_KEY;
    
    // If using external provider, fetch the API key
    if (provider !== 'lovable') {
      const { data: keyData } = await supabase
        .from('ai_provider_keys')
        .select('encrypted_api_key')
        .eq('provider', provider)
        .eq('is_active', true)
        .maybeSingle();
      
      if (keyData?.encrypted_api_key) {
        apiKey = await decrypt(keyData.encrypted_api_key);
      } else {
        // Fallback to lovable if no key found
        console.log(`No API key found for ${provider}, falling back to Lovable AI`);
      }
    }

    console.log(`Calling ${provider} AI...`);
    
    // Build request based on provider
    let requestBody: any;
    if (provider === 'claude') {
      // Claude uses different format
      requestBody = {
        model: providerConfig.model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: messages.map((m: any) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        })),
        stream: true,
      };
    } else {
      requestBody = {
        model: providerConfig.model,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      };
    }
    
    const response = await fetch(providerConfig.url, {
      method: "POST",
      headers: providerConfig.getHeaders(apiKey!),
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`${provider} API error:`, response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: `${provider} API error` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (error) {
    console.error("Chat function error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});