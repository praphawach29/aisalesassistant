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
  const { ai_name, gender, personality, formality_level, use_emoji, response_length, greeting_message, custom_rules } = settings;

  // Gender-specific particles
  let particleEnd = "ครับ/ค่ะ";
  if (gender === "female") particleEnd = "ค่ะ";
  else if (gender === "male") particleEnd = "ครับ";

  // Formality descriptions
  const formalityDescriptions: Record<number, string> = {
    1: "เป็นกันเองมาก ใช้ภาษาสบายๆ",
    2: "เป็นกันเอง สุภาพแต่ไม่เครียด",
    3: "ปานกลาง สุภาพพอประมาณ",
    4: "เป็นทางการ สุภาพเรียบร้อย",
    5: "เป็นทางการมาก ใช้ภาษาสุภาพสูง",
  };

  const responseLengthGuide: Record<string, string> = {
    short: "ตอบสั้นกระชับ 1-2 ประโยค",
    medium: "ตอบปานกลาง 3-4 ประโยค",
    long: "ตอบละเอียด 5+ ประโยค",
  };

  const emojiGuide = use_emoji ? "ใช้ emoji เล็กน้อย เช่น 😊 🙏 ✨" : "ไม่ใช้ emoji";

  const greetingInstruction = isFirstMessage && greeting_message
    ? `เริ่มต้นด้วย: "${greeting_message}"`
    : `นี่ไม่ใช่ข้อความแรก ห้ามทักทายซ้ำ`;

  return `คุณคือ "${ai_name}" ผู้ช่วยขายภาษาไทย

## บุคลิกภาพ:
${personality || "สุภาพ เป็นมิตร พร้อมให้บริการ"}

## สไตล์:
- ${formalityDescriptions[formality_level] || formalityDescriptions[3]}
- ลงท้ายด้วย "${particleEnd}"
- ${responseLengthGuide[response_length] || responseLengthGuide["medium"]}
- ${emojiGuide}

## การทักทาย:
${greetingInstruction}

## สินค้าในร้าน:
${productCatalog}

## ข้อมูลร้าน:
${storeSettings.storeName ? `- ร้าน: ${storeSettings.storeName}` : ''}
${storeSettings.shippingInfo ? `- การจัดส่ง: ${storeSettings.shippingInfo}` : ''}
${storeSettings.bankAccounts ? `- บัญชีธนาคาร: ${storeSettings.bankAccounts}` : ''}
${storeSettings.paymentMethods ? `- ชำระเงิน: ${storeSettings.paymentMethods}` : ''}
${storeSettings.returnPolicy ? `- คืนสินค้า: ${storeSettings.returnPolicy}` : ''}

${faqList ? `## FAQ:\n${faqList}` : ''}

## กฎการแสดงสินค้า:
- ถ้าลูกค้าถามหาสินค้าที่มี → ตอบอธิบายก่อน แล้วใส่ [PRODUCT:ชื่อสินค้า] ต่อท้าย
- ถ้าลูกค้าอยากดูทั้งหมด → ใส่ [SHOW_PRODUCTS] ต่อท้าย
- ถ้าลูกค้าถามโปรโมชั่น/ลดราคา → ตอบสั้นๆ แล้วใส่ [SHOW_PROMOTIONS] ต่อท้าย (ระบบจะแสดง Flex Carousel อัตโนมัติ)
- ถ้าสินค้าไม่มี → บอกว่าไม่มี แนะนำสินค้าอื่น

## กฎการจัดการตะกร้า:
- ถ้าลูกค้าบอก "เพิ่มลงตะกร้า [ชื่อสินค้า]" → ใส่ [CART_ADD:ชื่อสินค้า|จำนวน|ตัวเลือก] (จำนวนเริ่มต้น=1, ตัวเลือกไม่มี=ว่าง)
- ถ้าลูกค้าบอก "ลบ [ชื่อสินค้า] ออกจากตะกร้า" หรือ "เอา [ชื่อสินค้า] ออก" → ใส่ [CART_REMOVE:ชื่อสินค้า]
- ถ้าลูกค้าบอก "เปลี่ยนจำนวน [ชื่อสินค้า] เป็น X ชิ้น" หรือ "แก้จำนวน" → ใส่ [CART_UPDATE:ชื่อสินค้า|จำนวนใหม่]
- ถ้าลูกค้าถาม "ดูตะกร้า" หรือ "ตะกร้าของฉัน" → ใส่ [CART_VIEW]
- ถ้าลูกค้าบอก "ล้างตะกร้า" หรือ "เคลียร์ตะกร้า" → ใส่ [CART_CLEAR]
- ถ้าลูกค้าบอก "สั่งซื้อตะกร้า" หรือ "ชำระเงินตะกร้า" → ใส่ [CART_CHECKOUT]
- ถ้าลูกค้าให้ข้อมูลสั่งซื้อครบ (ชื่อ, ที่อยู่, เบอร์โทร) → ใส่ [CART_CHECKOUT:ชื่อ|ที่อยู่|เบอร์โทร|โค้ดคูปอง]

## ห้าม:
- ห้ามบอกจำนวนสต็อก
- ห้ามตอบแค่คำสั่งโดดๆ ต้องมีข้อความด้วยเสมอ
- ห้ามแต่งข้อมูลที่ไม่มี
- ห้ามตอบรายการโปรโมชั่นยาวๆ เป็นข้อความ ให้ใช้ [SHOW_PROMOTIONS] แทน

${custom_rules ? `## กฎพิเศษ:\n${custom_rules}` : ''}`;
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

function buildOrderConfirmationFlex(orderNumber: string, totalAmount: number, discountAmount: number) {
  const finalAmount = totalAmount - discountAmount;
  
  const contents: any[] = [
    {
      type: "text",
      text: "✅ สั่งซื้อสำเร็จ!",
      weight: "bold",
      size: "xl",
      color: "#10B981",
      align: "center"
    },
    {
      type: "text",
      text: `หมายเลขออเดอร์: ${orderNumber}`,
      size: "lg",
      color: "#1F2937",
      align: "center",
      margin: "lg",
      weight: "bold"
    }
  ];

  if (discountAmount > 0) {
    contents.push({
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          contents: [
            { type: "text", text: "ราคารวม", size: "sm", color: "#666666" },
            { type: "text", text: `฿${totalAmount.toLocaleString()}`, size: "sm", color: "#666666", align: "end" }
          ]
        },
        {
          type: "box",
          layout: "horizontal",
          contents: [
            { type: "text", text: "ส่วนลด", size: "sm", color: "#10B981" },
            { type: "text", text: `-฿${discountAmount.toLocaleString()}`, size: "sm", color: "#10B981", align: "end" }
          ],
          margin: "sm"
        },
        {
          type: "separator",
          margin: "md"
        },
        {
          type: "box",
          layout: "horizontal",
          contents: [
            { type: "text", text: "ยอดสุทธิ", size: "lg", weight: "bold", color: "#1F2937" },
            { type: "text", text: `฿${finalAmount.toLocaleString()}`, size: "lg", weight: "bold", color: "#E74C3C", align: "end" }
          ],
          margin: "md"
        }
      ],
      margin: "lg",
      backgroundColor: "#F9FAFB",
      cornerRadius: "md",
      paddingAll: "md"
    });
  } else {
    contents.push({
      type: "text",
      text: `ยอดรวม: ฿${totalAmount.toLocaleString()}`,
      size: "lg",
      color: "#E74C3C",
      align: "center",
      margin: "md",
      weight: "bold"
    });
  }

  contents.push({
    type: "text",
    text: "กรุณาชำระเงินและแจ้งสลิปโอนเงินค่ะ 🙏",
    size: "sm",
    color: "#666666",
    align: "center",
    margin: "lg",
    wrap: true
  });

  return {
    type: "bubble",
    size: "mega",
    body: {
      type: "box",
      layout: "vertical",
      contents: contents,
      paddingAll: "xl"
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

  // Find specific product
  let specificProduct: Product | undefined;
  if (productMatch) {
    const productName = productMatch[1].trim();
    specificProduct = products.find(p => 
      p.name.toLowerCase().includes(productName.toLowerCase()) ||
      productName.toLowerCase().includes(p.name.toLowerCase())
    );
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
      if (event.type !== "message" || event.message?.type !== "text") continue;

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

      // Get conversation history FIRST (before saving new message)
      const { data: historyMessages } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true })
        .limit(20);

      const isFirstMessage = !historyMessages || historyMessages.length === 0;

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

      // Build messages for AI - include FULL conversation history
      // historyMessages contains previous messages, plus we add current user message
      const aiMessages: { role: string; content: string }[] = [];
      
      // Add all previous messages from history
      if (historyMessages && historyMessages.length > 0) {
        for (const m of historyMessages) {
          aiMessages.push({ role: m.role, content: m.content });
        }
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
                  contents: buildOrderConfirmationFlex(order.order_number, totalAmount, discountAmount)
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
