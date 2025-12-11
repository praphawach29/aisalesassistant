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

interface ProductVariant {
  name: string;
  options: string[];
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
  variants?: ProductVariant[] | null;
}

interface Coupon {
  id: string;
  code: string;
  name: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_amount: number;
  max_uses: number | null;
  used_count: number;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
}

interface CouponValidationResult {
  valid: boolean;
  coupon?: Coupon;
  discountAmount?: number;
  errorMessage?: string;
}

// Validate and apply coupon
async function validateCoupon(code: string, orderAmount: number, supabase: any): Promise<CouponValidationResult> {
  const { data: coupon, error } = await supabase
    .from("coupons")
    .select("*")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (error || !coupon) {
    return { valid: false, errorMessage: `ไม่พบโค้ดส่วนลด "${code}" ค่ะ` };
  }

  if (!coupon.is_active) {
    return { valid: false, errorMessage: "โค้ดส่วนลดนี้ถูกปิดใช้งานแล้วค่ะ" };
  }

  const now = new Date();
  if (coupon.valid_from && new Date(coupon.valid_from) > now) {
    return { valid: false, errorMessage: "โค้ดส่วนลดนี้ยังไม่เริ่มใช้งานค่ะ" };
  }

  if (coupon.valid_until && new Date(coupon.valid_until) < now) {
    return { valid: false, errorMessage: "โค้ดส่วนลดนี้หมดอายุแล้วค่ะ" };
  }

  if (coupon.max_uses && coupon.used_count >= coupon.max_uses) {
    return { valid: false, errorMessage: "โค้ดส่วนลดนี้ถูกใช้ครบจำนวนแล้วค่ะ" };
  }

  if (coupon.min_order_amount && orderAmount < coupon.min_order_amount) {
    return { valid: false, errorMessage: `ยอดสั่งซื้อขั้นต่ำสำหรับโค้ดนี้คือ ฿${coupon.min_order_amount.toLocaleString()} ค่ะ` };
  }

  // Calculate discount
  let discountAmount = 0;
  if (coupon.discount_type === 'percentage') {
    discountAmount = (orderAmount * coupon.discount_value) / 100;
  } else {
    discountAmount = coupon.discount_value;
  }

  // Discount cannot exceed order amount
  discountAmount = Math.min(discountAmount, orderAmount);

  return { valid: true, coupon, discountAmount };
}

// Update coupon usage count
async function updateCouponUsage(couponId: string, supabase: any): Promise<void> {
  await supabase
    .from("coupons")
    .update({ used_count: supabase.rpc ? undefined : 1 })
    .eq("id", couponId);
  
  // Use raw increment
  await supabase.rpc('increment_coupon_usage', { coupon_id: couponId }).catch(() => {
    // Fallback: direct update
    supabase
      .from("coupons")
      .select("used_count")
      .eq("id", couponId)
      .single()
      .then(({ data }: any) => {
        if (data) {
          supabase
            .from("coupons")
            .update({ used_count: data.used_count + 1 })
            .eq("id", couponId);
        }
      });
  });
}

async function verifySignature(body: string, signature: string, channelSecret: string): Promise<boolean> {
  if (!channelSecret) return false;
  
  const hmac = createHmac("sha256", channelSecret);
  hmac.update(body);
  const digest = hmac.digest("base64");
  return digest === signature;
}

function createProductFlexMessage(products: Product[]) {
  const bubbles = products.slice(0, 10).map(product => {
    const price = product.promotion_price || product.price;
    const originalPrice = product.promotion_price ? product.price : null;
    
    return {
      type: "bubble",
      hero: product.image_url ? {
        type: "image",
        url: product.image_url,
        size: "full",
        aspectRatio: "4:3",
        aspectMode: "cover"
      } : undefined,
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: product.name,
            weight: "bold",
            size: "lg",
            wrap: true
          },
          {
            type: "box",
            layout: "baseline",
            margin: "md",
            contents: [
              {
                type: "text",
                text: `฿${price.toLocaleString()}`,
                size: "xl",
                color: "#FF5551",
                weight: "bold"
              },
              ...(originalPrice ? [{
                type: "text",
                text: `฿${originalPrice.toLocaleString()}`,
                size: "sm",
                color: "#aaaaaa",
                decoration: "line-through",
                margin: "sm"
              }] : [])
            ]
          },
          ...(product.description ? [{
            type: "text",
            text: product.description.slice(0, 60) + (product.description.length > 60 ? "..." : ""),
            size: "sm",
            color: "#999999",
            margin: "md",
            wrap: true
          }] : []),
          {
            type: "text",
            text: product.stock > 0 ? `มีสินค้า ${product.stock} ชิ้น` : "สินค้าหมด",
            size: "xs",
            color: product.stock > 0 ? "#00B900" : "#FF0000",
            margin: "md"
          }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "primary",
            action: {
              type: "message",
              label: "สั่งซื้อ",
              text: `สั่งซื้อ ${product.name}`
            },
            color: "#00B900"
          }
        ]
      }
    };
  });

  // Filter out undefined hero images
  const cleanBubbles = bubbles.map(bubble => {
    if (!bubble.hero) {
      const { hero, ...rest } = bubble;
      return rest;
    }
    return bubble;
  });

  return {
    type: "flex",
    altText: "รายการสินค้า",
    contents: {
      type: "carousel",
      contents: cleanBubbles
    }
  };
}

function createSingleProductCard(product: Product) {
  const price = product.promotion_price || product.price;
  const originalPrice = product.promotion_price ? product.price : null;

  // Check if product has variants
  const hasVariants = product.variants && product.variants.length > 0;

  // Build variant info text
  let variantInfoText = "";
  if (hasVariants) {
    variantInfoText = product.variants!.map(v => 
      `${v.name}: ${v.options.join(", ")}`
    ).join("\n");
  }

  const bubble: any = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: product.name,
          weight: "bold",
          size: "xl",
          wrap: true
        },
        {
          type: "box",
          layout: "baseline",
          margin: "md",
          contents: [
            {
              type: "text",
              text: `฿${price.toLocaleString()}`,
              size: "xxl",
              color: "#FF5551",
              weight: "bold"
            },
            ...(originalPrice ? [{
              type: "text",
              text: `฿${originalPrice.toLocaleString()}`,
              size: "md",
              color: "#aaaaaa",
              decoration: "line-through",
              margin: "sm"
            }] : [])
          ]
        },
        ...(product.description ? [{
          type: "text",
          text: product.description,
          size: "sm",
          color: "#666666",
          margin: "lg",
          wrap: true
        }] : []),
        ...(hasVariants ? [{
          type: "separator",
          margin: "lg"
        },
        {
          type: "text",
          text: "ตัวเลือกสินค้า:",
          size: "sm",
          color: "#333333",
          weight: "bold",
          margin: "md"
        },
        {
          type: "text",
          text: variantInfoText,
          size: "sm",
          color: "#666666",
          margin: "sm",
          wrap: true
        }] : []),
        {
          type: "separator",
          margin: "lg"
        },
        {
          type: "box",
          layout: "horizontal",
          margin: "md",
          contents: [
            {
              type: "text",
              text: "สถานะ:",
              size: "sm",
              color: "#999999"
            },
            {
              type: "text",
              text: product.stock > 0 ? `มีสินค้า ${product.stock} ชิ้น` : "สินค้าหมด",
              size: "sm",
              color: product.stock > 0 ? "#00B900" : "#FF0000",
              align: "end"
            }
          ]
        }
      ]
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "button",
          style: "primary",
          action: {
            type: "message",
            label: "สั่งซื้อเลย",
            text: `สั่งซื้อ ${product.name}`
          },
          color: "#00B900"
        }
      ]
    }
  };

  if (product.image_url) {
    bubble.hero = {
      type: "image",
      url: product.image_url,
      size: "full",
      aspectRatio: "4:3",
      aspectMode: "cover"
    };
  }

  return {
    type: "flex",
    altText: `สินค้า: ${product.name}`,
    contents: bubble
  };
}

// Create variant selection card with Quick Reply buttons
function createVariantSelectionCard(product: Product, variantType: string, options: string[]) {
  const price = product.promotion_price || product.price;

  const optionButtons = options.slice(0, 4).map(option => ({
    type: "button",
    style: "secondary",
    action: {
      type: "message",
      label: option,
      text: `เลือก ${variantType}: ${option} สำหรับ ${product.name}`
    },
    height: "sm"
  }));

  const bubble: any = {
    type: "bubble",
    size: "kilo",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: `🎨 เลือก${variantType}`,
          weight: "bold",
          size: "lg",
          color: "#333333"
        },
        {
          type: "text",
          text: product.name,
          size: "md",
          color: "#666666",
          margin: "sm"
        },
        {
          type: "text",
          text: `ราคา ฿${price.toLocaleString()}`,
          size: "sm",
          color: "#FF5551",
          margin: "sm"
        },
        {
          type: "separator",
          margin: "lg"
        },
        {
          type: "text",
          text: `กรุณาเลือก${variantType}:`,
          size: "sm",
          color: "#333333",
          margin: "md"
        }
      ]
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: optionButtons
    }
  };

  return {
    type: "flex",
    altText: `เลือก${variantType}สำหรับ ${product.name}`,
    contents: bubble
  };
}

// Create order confirmation card
function createOrderConfirmationCard(
  orderNumber: string, 
  productName: string, 
  quantity: number, 
  totalAmount: number, 
  customerName: string, 
  customerAddress: string, 
  variants?: string,
  discountInfo?: { code: string; discount: number; originalTotal: number }
) {
  // Build price contents with optional discount
  const priceContents: any[] = [];
  
  if (discountInfo) {
    priceContents.push({
      type: "box",
      layout: "horizontal",
      contents: [
        { type: "text", text: "ราคาสินค้า:", size: "sm", color: "#666666", flex: 4 },
        { type: "text", text: `฿${discountInfo.originalTotal.toLocaleString()}`, size: "sm", color: "#666666", flex: 5, align: "end" }
      ]
    });
    priceContents.push({
      type: "box",
      layout: "horizontal",
      contents: [
        { type: "text", text: `🎟️ ${discountInfo.code}:`, size: "sm", color: "#00B900", flex: 4 },
        { type: "text", text: `-฿${discountInfo.discount.toLocaleString()}`, size: "sm", color: "#00B900", flex: 5, align: "end" }
      ]
    });
  }
  
  priceContents.push({
    type: "box",
    layout: "horizontal",
    contents: [
      { type: "text", text: "ยอดชำระ:", size: "sm", color: "#666666", flex: 4 },
      { type: "text", text: `฿${totalAmount.toLocaleString()}`, size: "sm", color: "#FF5551", weight: "bold", flex: 5, align: "end" }
    ]
  });

  const bubble: any = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "✅ ยืนยันการสั่งซื้อสำเร็จ!",
          weight: "bold",
          size: "lg",
          color: "#00B900"
        },
        {
          type: "separator",
          margin: "lg"
        },
        {
          type: "box",
          layout: "vertical",
          margin: "lg",
          spacing: "sm",
          contents: [
            {
              type: "box",
              layout: "horizontal",
              contents: [
                { type: "text", text: "หมายเลขออเดอร์:", size: "sm", color: "#666666", flex: 4 },
                { type: "text", text: orderNumber, size: "sm", color: "#333333", weight: "bold", flex: 5, align: "end" }
              ]
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                { type: "text", text: "สินค้า:", size: "sm", color: "#666666", flex: 4 },
                { type: "text", text: productName, size: "sm", color: "#333333", flex: 5, align: "end", wrap: true }
              ]
            },
            ...(variants ? [{
              type: "box",
              layout: "horizontal",
              contents: [
                { type: "text", text: "ตัวเลือก:", size: "sm", color: "#666666", flex: 4 },
                { type: "text", text: variants, size: "sm", color: "#333333", flex: 5, align: "end" }
              ]
            }] : []),
            {
              type: "box",
              layout: "horizontal",
              contents: [
                { type: "text", text: "จำนวน:", size: "sm", color: "#666666", flex: 4 },
                { type: "text", text: `${quantity} ชิ้น`, size: "sm", color: "#333333", flex: 5, align: "end" }
              ]
            },
            ...priceContents
          ]
        },
        {
          type: "separator",
          margin: "lg"
        },
        {
          type: "box",
          layout: "vertical",
          margin: "lg",
          spacing: "sm",
          contents: [
            {
              type: "text",
              text: "📦 ข้อมูลการจัดส่ง",
              size: "sm",
              color: "#333333",
              weight: "bold"
            },
            {
              type: "text",
              text: `ชื่อ: ${customerName}`,
              size: "sm",
              color: "#666666",
              margin: "sm"
            },
            {
              type: "text",
              text: `ที่อยู่: ${customerAddress}`,
              size: "sm",
              color: "#666666",
              wrap: true
            }
          ]
        },
        {
          type: "text",
          text: "ขอบคุณที่ใช้บริการค่ะ 🙏",
          size: "sm",
          color: "#00B900",
          margin: "lg",
          align: "center"
        }
      ]
    }
  };

  return {
    type: "flex",
    altText: `ยืนยันออเดอร์ ${orderNumber}`,
    contents: bubble
  };
}

// Create cart summary card
function createCartSummaryCard(cartItems: Array<{product_name: string; quantity: number; price: number; variants?: string}>, totalAmount: number) {
  const itemContents = cartItems.map(item => ({
    type: "box",
    layout: "horizontal",
    contents: [
      { 
        type: "text", 
        text: `${item.product_name}${item.variants ? ` (${item.variants})` : ''} x${item.quantity}`, 
        size: "sm", 
        color: "#333333", 
        flex: 7,
        wrap: true 
      },
      { 
        type: "text", 
        text: `฿${(item.price * item.quantity).toLocaleString()}`, 
        size: "sm", 
        color: "#FF5551", 
        flex: 3, 
        align: "end" 
      }
    ]
  }));

  const bubble: any = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "🛒 ตะกร้าสินค้าของคุณ",
          weight: "bold",
          size: "lg",
          color: "#333333"
        },
        {
          type: "separator",
          margin: "lg"
        },
        {
          type: "box",
          layout: "vertical",
          margin: "lg",
          spacing: "md",
          contents: itemContents.length > 0 ? itemContents : [{
            type: "text",
            text: "ไม่มีสินค้าในตะกร้า",
            size: "sm",
            color: "#999999",
            align: "center"
          }]
        },
        ...(cartItems.length > 0 ? [
          {
            type: "separator",
            margin: "lg"
          },
          {
            type: "box",
            layout: "horizontal",
            margin: "lg",
            contents: [
              { type: "text", text: "รวมทั้งหมด:", size: "md", color: "#333333", weight: "bold", flex: 5 },
              { type: "text", text: `฿${totalAmount.toLocaleString()}`, size: "lg", color: "#FF5551", weight: "bold", flex: 5, align: "end" }
            ]
          }
        ] : [])
      ]
    },
    footer: cartItems.length > 0 ? {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "button",
          style: "primary",
          action: {
            type: "message",
            label: "สั่งซื้อทั้งหมด",
            text: "ยืนยันสั่งซื้อตะกร้า"
          },
          color: "#00B900"
        },
        {
          type: "button",
          style: "secondary",
          action: {
            type: "message",
            label: "ล้างตะกร้า",
            text: "ล้างตะกร้า"
          }
        }
      ]
    } : undefined
  };

  return {
    type: "flex",
    altText: `ตะกร้าสินค้า (${cartItems.length} รายการ)`,
    contents: bubble
  };
}

// Create multi-item order confirmation card
function createMultiItemOrderCard(
  orderNumber: string, 
  items: Array<{product_name: string; quantity: number; price: number}>, 
  totalAmount: number, 
  customerName: string, 
  customerAddress: string,
  discountInfo?: { code: string; discount: number; originalTotal: number }
) {
  const itemContents = items.map(item => ({
    type: "box",
    layout: "horizontal",
    contents: [
      { type: "text", text: `${item.product_name} x${item.quantity}`, size: "sm", color: "#333333", flex: 7, wrap: true },
      { type: "text", text: `฿${(item.price * item.quantity).toLocaleString()}`, size: "sm", color: "#666666", flex: 3, align: "end" }
    ]
  }));

  // Add discount row if applicable
  const priceContents: any[] = [];
  
  if (discountInfo) {
    priceContents.push({
      type: "box",
      layout: "horizontal",
      margin: "sm",
      contents: [
        { type: "text", text: "ยอดรวมสินค้า:", size: "sm", color: "#666666", flex: 5 },
        { type: "text", text: `฿${discountInfo.originalTotal.toLocaleString()}`, size: "sm", color: "#666666", flex: 5, align: "end" }
      ]
    });
    priceContents.push({
      type: "box",
      layout: "horizontal",
      margin: "sm",
      contents: [
        { type: "text", text: `🎟️ โค้ด ${discountInfo.code}:`, size: "sm", color: "#00B900", flex: 5 },
        { type: "text", text: `-฿${discountInfo.discount.toLocaleString()}`, size: "sm", color: "#00B900", flex: 5, align: "end" }
      ]
    });
  }
  
  priceContents.push({
    type: "box",
    layout: "horizontal",
    margin: "md",
    contents: [
      { type: "text", text: "ยอดชำระ:", size: "md", color: "#333333", weight: "bold", flex: 5 },
      { type: "text", text: `฿${totalAmount.toLocaleString()}`, size: "lg", color: "#FF5551", weight: "bold", flex: 5, align: "end" }
    ]
  });

  const bubble: any = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "✅ ยืนยันการสั่งซื้อสำเร็จ!",
          weight: "bold",
          size: "lg",
          color: "#00B900"
        },
        {
          type: "box",
          layout: "horizontal",
          margin: "md",
          contents: [
            { type: "text", text: "หมายเลขออเดอร์:", size: "sm", color: "#666666", flex: 4 },
            { type: "text", text: orderNumber, size: "sm", color: "#333333", weight: "bold", flex: 6, align: "end" }
          ]
        },
        {
          type: "separator",
          margin: "lg"
        },
        {
          type: "text",
          text: "📦 รายการสินค้า",
          size: "sm",
          color: "#333333",
          weight: "bold",
          margin: "lg"
        },
        {
          type: "box",
          layout: "vertical",
          margin: "sm",
          spacing: "sm",
          contents: itemContents
        },
        {
          type: "separator",
          margin: "lg"
        },
        {
          type: "box",
          layout: "vertical",
          margin: "md",
          contents: priceContents
        },
        {
          type: "separator",
          margin: "lg"
        },
        {
          type: "text",
          text: "🚚 ข้อมูลจัดส่ง",
          size: "sm",
          color: "#333333",
          weight: "bold",
          margin: "lg"
        },
        {
          type: "text",
          text: `ชื่อ: ${customerName}`,
          size: "sm",
          color: "#666666",
          margin: "sm"
        },
        {
          type: "text",
          text: `ที่อยู่: ${customerAddress}`,
          size: "sm",
          color: "#666666",
          wrap: true
        },
        {
          type: "text",
          text: "ขอบคุณที่ใช้บริการค่ะ 🙏",
          size: "sm",
          color: "#00B900",
          margin: "lg",
          align: "center"
        }
      ]
    }
  };

  return {
    type: "flex",
    altText: `ยืนยันออเดอร์ ${orderNumber}`,
    contents: bubble
  };
}

// Create order status card
function createOrderStatusCard(order: any, orderItems: Array<{product_name: string; quantity: number; price: number}>) {
  const statusMap: Record<string, { text: string; color: string; emoji: string }> = {
    'pending': { text: 'รอยืนยัน', color: '#FFA500', emoji: '⏳' },
    'confirmed': { text: 'ยืนยันแล้ว', color: '#00B900', emoji: '✅' },
    'shipped': { text: 'จัดส่งแล้ว', color: '#1E90FF', emoji: '🚚' },
    'delivered': { text: 'ได้รับสินค้าแล้ว', color: '#32CD32', emoji: '📦' },
    'cancelled': { text: 'ยกเลิก', color: '#FF0000', emoji: '❌' }
  };

  const statusInfo = statusMap[order.status] || statusMap['pending'];

  const itemContents = orderItems.map(item => ({
    type: "box",
    layout: "horizontal",
    contents: [
      { type: "text", text: `${item.product_name} x${item.quantity}`, size: "sm", color: "#333333", flex: 7, wrap: true },
      { type: "text", text: `฿${(item.price * item.quantity).toLocaleString()}`, size: "sm", color: "#666666", flex: 3, align: "end" }
    ]
  }));

  const bubble: any = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: `${statusInfo.emoji} สถานะออเดอร์`,
          weight: "bold",
          size: "lg",
          color: "#333333"
        },
        {
          type: "box",
          layout: "horizontal",
          margin: "md",
          contents: [
            { type: "text", text: "หมายเลข:", size: "sm", color: "#666666", flex: 3 },
            { type: "text", text: order.order_number, size: "sm", color: "#333333", weight: "bold", flex: 7, align: "end" }
          ]
        },
        {
          type: "box",
          layout: "horizontal",
          margin: "sm",
          contents: [
            { type: "text", text: "สถานะ:", size: "sm", color: "#666666", flex: 3 },
            { type: "text", text: statusInfo.text, size: "sm", color: statusInfo.color, weight: "bold", flex: 7, align: "end" }
          ]
        },
        ...(order.tracking_number ? [{
          type: "box",
          layout: "horizontal",
          margin: "sm",
          contents: [
            { type: "text", text: "เลขพัสดุ:", size: "sm", color: "#666666", flex: 3 },
            { type: "text", text: order.tracking_number, size: "sm", color: "#1E90FF", weight: "bold", flex: 7, align: "end" }
          ]
        }] : []),
        {
          type: "separator",
          margin: "lg"
        },
        {
          type: "text",
          text: "📦 รายการสินค้า",
          size: "sm",
          color: "#333333",
          weight: "bold",
          margin: "lg"
        },
        {
          type: "box",
          layout: "vertical",
          margin: "sm",
          spacing: "sm",
          contents: itemContents
        },
        {
          type: "separator",
          margin: "lg"
        },
        {
          type: "box",
          layout: "horizontal",
          margin: "md",
          contents: [
            { type: "text", text: "ยอดรวม:", size: "md", color: "#333333", weight: "bold", flex: 5 },
            { type: "text", text: `฿${Number(order.total_amount).toLocaleString()}`, size: "lg", color: "#FF5551", weight: "bold", flex: 5, align: "end" }
          ]
        },
        {
          type: "separator",
          margin: "lg"
        },
        {
          type: "text",
          text: `🕐 สั่งเมื่อ ${new Date(order.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
          size: "xs",
          color: "#999999",
          margin: "md",
          align: "center"
        }
      ]
    }
  };

  return {
    type: "flex",
    altText: `สถานะออเดอร์ ${order.order_number}: ${statusInfo.text}`,
    contents: bubble
  };
}

// Create order history carousel
function createOrderHistoryCarousel(orders: any[]) {
  const statusMap: Record<string, { text: string; color: string; emoji: string }> = {
    'pending': { text: 'รอยืนยัน', color: '#FFA500', emoji: '⏳' },
    'confirmed': { text: 'ยืนยันแล้ว', color: '#00B900', emoji: '✅' },
    'shipped': { text: 'จัดส่งแล้ว', color: '#1E90FF', emoji: '🚚' },
    'delivered': { text: 'ได้รับแล้ว', color: '#32CD32', emoji: '📦' },
    'cancelled': { text: 'ยกเลิก', color: '#FF0000', emoji: '❌' }
  };

  const bubbles = orders.slice(0, 10).map(order => {
    const statusInfo = statusMap[order.status] || statusMap['pending'];
    
    return {
      type: "bubble",
      size: "kilo",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: order.order_number,
            weight: "bold",
            size: "md",
            color: "#333333"
          },
          {
            type: "box",
            layout: "horizontal",
            margin: "md",
            contents: [
              { type: "text", text: "สถานะ:", size: "sm", color: "#666666", flex: 3 },
              { type: "text", text: `${statusInfo.emoji} ${statusInfo.text}`, size: "sm", color: statusInfo.color, weight: "bold", flex: 7, align: "end" }
            ]
          },
          {
            type: "box",
            layout: "horizontal",
            margin: "sm",
            contents: [
              { type: "text", text: "ยอดรวม:", size: "sm", color: "#666666", flex: 3 },
              { type: "text", text: `฿${Number(order.total_amount).toLocaleString()}`, size: "sm", color: "#FF5551", weight: "bold", flex: 7, align: "end" }
            ]
          },
          ...(order.tracking_number ? [{
            type: "box",
            layout: "horizontal",
            margin: "sm",
            contents: [
              { type: "text", text: "เลขพัสดุ:", size: "xs", color: "#666666", flex: 3 },
              { type: "text", text: order.tracking_number, size: "xs", color: "#1E90FF", flex: 7, align: "end" }
            ]
          }] : []),
          {
            type: "text",
            text: new Date(order.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }),
            size: "xs",
            color: "#999999",
            margin: "md",
            align: "center"
          }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            style: "primary",
            height: "sm",
            action: {
              type: "message",
              label: "ดูรายละเอียด",
              text: order.order_number
            },
            color: "#00B900"
          }
        ]
      }
    };
  });

  return {
    type: "flex",
    altText: `ประวัติออเดอร์ ${orders.length} รายการ`,
    contents: {
      type: "carousel",
      contents: bubbles
    }
  };
}

async function replyToLine(replyToken: string, messages: Array<any>, accessToken: string) {
  if (!accessToken) {
    console.error("LINE_CHANNEL_ACCESS_TOKEN not configured");
    return;
  }

  console.log("Sending LINE reply:", JSON.stringify(messages, null, 2));

  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      replyToken,
      messages,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("LINE reply error:", error);
  } else {
    console.log("LINE reply sent successfully");
  }
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

interface CartAction {
  action: 'add' | 'view' | 'clear' | 'checkout';
  productName?: string;
  quantity?: number;
  variants?: string;
  customerName?: string;
  customerAddress?: string;
  customerPhone?: string;
  couponCode?: string;
}

interface OrderHistory {
  orderNumber: string;
  productName: string;
  quantity: number;
  totalAmount: number;
  status: string;
  createdAt: string;
}

interface SavedAddress {
  id: string;
  label: string;
  address: string;
  isDefault: boolean;
}

interface CustomerContext {
  isReturning: boolean;
  customerName?: string;
  customerAddress?: string;
  customerPhone?: string;
  messageCount: number;
  lastVisit?: string;
  cartItemCount?: number;
  orderHistory?: OrderHistory[];
  savedAddresses?: SavedAddress[];
}

async function getAIResponse(
  messages: Array<{ role: string; content: string }>, 
  supabase: any,
  customerContext: CustomerContext
): Promise<{ text: string; showProducts?: boolean; specificProduct?: string; detectedName?: string; selectVariant?: string; createOrder?: OrderData; cartAction?: CartAction; applyCoupon?: string; recommendSimilar?: string; saveAddress?: { label: string; address: string } }> {
  if (!LOVABLE_API_KEY) {
    return { text: "ขออภัยครับ ระบบยังไม่พร้อมให้บริการ" };
  }

  // Fetch products for context with variants
  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true);

  // Fetch store settings
  const { data: settingsData } = await supabase
    .from("settings")
    .select("key, value")
    .in("key", ["STORE_NAME", "STORE_PHONE", "STORE_ADDRESS", "STORE_EMAIL", "RETURN_POLICY", "SHIPPING_INFO", "BUSINESS_HOURS", "LINE_ID", "FACEBOOK_PAGE", "INSTAGRAM", "BANK_ACCOUNTS", "PAYMENT_METHODS", "WARRANTY_INFO", "PRIVACY_POLICY", "TERMS_CONDITIONS"]);

  const settingsMap = new Map(settingsData?.map((s: any) => [s.key, s.value]) || []);
  const storeName = settingsMap.get("STORE_NAME") || "";
  const storePhone = settingsMap.get("STORE_PHONE") || "";
  const returnPolicy = settingsMap.get("RETURN_POLICY") || "";
  const shippingInfo = settingsMap.get("SHIPPING_INFO") || "";
  const businessHours = settingsMap.get("BUSINESS_HOURS") || "";
  const lineId = settingsMap.get("LINE_ID") || "";
  const facebookPage = settingsMap.get("FACEBOOK_PAGE") || "";
  const instagram = settingsMap.get("INSTAGRAM") || "";
  const bankAccounts = settingsMap.get("BANK_ACCOUNTS") || "";
  const paymentMethods = settingsMap.get("PAYMENT_METHODS") || "";
  const warrantyInfo = settingsMap.get("WARRANTY_INFO") || "";
  const privacyPolicy = settingsMap.get("PRIVACY_POLICY") || "";
  const termsConditions = settingsMap.get("TERMS_CONDITIONS") || "";

  // Build product catalog with stock and category info
  const productCatalog = products?.map((p: any) => {
    let variantInfo = "";
    if (p.variants && p.variants.length > 0) {
      variantInfo = ` [ตัวเลือก: ${p.variants.map((v: any) => `${v.name}(${v.options.join('/')})`).join(', ')}]`;
    }
    const stockStatus = p.stock <= 0 ? ' [หมด]' : p.stock <= 5 ? ` [เหลือ ${p.stock} ชิ้น]` : '';
    const categoryInfo = p.category ? ` (หมวด: ${p.category})` : '';
    return `- ${p.name}: ฿${p.price}${p.promotion_price ? ` (โปรโมชั่น: ฿${p.promotion_price})` : ''}${variantInfo}${categoryInfo}${stockStatus}`;
  }).join('\n') || 'ยังไม่มีสินค้า';

  const cartInfo = customerContext.cartItemCount && customerContext.cartItemCount > 0 
    ? `\n\n🛒 ลูกค้ามีสินค้าในตะกร้า ${customerContext.cartItemCount} รายการ`
    : '';

  // Build order history section
  let orderHistorySection = '';
  if (customerContext.orderHistory && customerContext.orderHistory.length > 0) {
    const historyItems = customerContext.orderHistory.map(o => 
      `- ${o.orderNumber}: ${o.productName} x${o.quantity} = ฿${o.totalAmount} (${o.status === 'delivered' ? 'ส่งแล้ว' : o.status === 'shipped' ? 'กำลังจัดส่ง' : o.status === 'confirmed' ? 'ยืนยันแล้ว' : o.status === 'cancelled' ? 'ยกเลิก' : 'รอดำเนินการ'})`
    ).join('\n');
    orderHistorySection = `\n\n📋 ประวัติการสั่งซื้อของลูกค้า (${customerContext.orderHistory.length} รายการล่าสุด):\n${historyItems}`;
  }

  // Build saved addresses info (multiple addresses)
  let savedAddressInfo = '';
  if (customerContext.savedAddresses && customerContext.savedAddresses.length > 0) {
    const addressList = customerContext.savedAddresses.map((addr, idx) => 
      `${idx + 1}. [${addr.label}]${addr.isDefault ? ' (ค่าเริ่มต้น)' : ''}: "${addr.address}"`
    ).join('\n');
    savedAddressInfo = `\n📍 ที่อยู่ที่บันทึกไว้ (${customerContext.savedAddresses.length} แห่ง):\n${addressList}`;
  }

  const customerGreeting = customerContext.isReturning 
    ? customerContext.customerName 
      ? `นี่คือลูกค้าเก่าชื่อ "${customerContext.customerName}" ที่กลับมาอีกครั้ง! ทักทายโดยเรียกชื่อลูกค้าอย่างเป็นกันเองและอบอุ่น${savedAddressInfo}${cartInfo}${orderHistorySection}`
      : `นี่คือลูกค้าเก่าที่กลับมาอีกครั้ง (เคยคุยกัน ${customerContext.messageCount} ข้อความ)! ทักทายอย่างเป็นกันเองและอบอุ่น${savedAddressInfo}${cartInfo}${orderHistorySection}`
    : 'นี่คือลูกค้าใหม่ ทักทายสุภาพและแนะนำตัว';

  // Build store info section
  const storeInfoSection = `
${storeName ? `🏪 ร้าน: ${storeName}` : ''}
${storePhone ? `📞 ติดต่อ: ${storePhone}` : ''}
${businessHours ? `🕐 เวลาทำการ: ${businessHours}` : ''}
${lineId ? `💬 LINE: ${lineId}` : ''}
${facebookPage ? `📘 Facebook: ${facebookPage}` : ''}
${instagram ? `📸 Instagram: ${instagram}` : ''}
${paymentMethods ? `💳 วิธีชำระเงิน: ${paymentMethods}` : ''}
${returnPolicy ? `📋 นโยบายคืนสินค้า: ${returnPolicy}` : ''}
${shippingInfo ? `🚚 การจัดส่ง: ${shippingInfo}` : ''}
${bankAccounts ? `🏦 บัญชีธนาคาร: ${bankAccounts}` : ''}
${warrantyInfo ? `🛡️ การรับประกัน: ${warrantyInfo}` : ''}
${privacyPolicy ? `🔒 ความเป็นส่วนตัว: ${privacyPolicy}` : ''}
`.trim();

  const systemPrompt = `คุณคือ "น้องช้อป" ผู้ช่วยขายอัจฉริยะทาง LINE พูดภาษาไทยสุภาพ น่ารัก ใช้อิโมจิบ้าง

${customerGreeting}

สินค้าที่มี:
${productCatalog}

${storeInfoSection ? `ข้อมูลร้านค้า:\n${storeInfoSection}` : ''}

## 🚨 กฎบังคับ (ต้องปฏิบัติตามก่อนกฎอื่นทั้งหมด):

### 🔴 กฎข้อที่ 1 - ตอบตามข้อความล่าสุดเสมอ!
**ข้อความล่าสุดของลูกค้าคือสิ่งสำคัญที่สุด**
- ถ้าลูกค้าถามเรื่องสินค้าใหม่ → ต้องค้นหาสินค้านั้นจากรายการสินค้า ห้ามใช้สินค้าจากบทสนทนาเดิม
- ถ้าลูกค้าถาม "รองเท้า" → หา "รองเท้า" ในรายการ ห้ามตอบเป็นสินค้าอื่นเด็ดขาด
- ถ้าลูกค้าถาม "เสื้อ" → หา "เสื้อ" ในรายการ
- ประวัติการสนทนาใช้เป็นข้อมูลประกอบเท่านั้น ไม่ใช่คำตอบ

### 🔴 กฎข้อที่ 2 - กฎทักทาย
**เมื่อข้อความล่าสุดของลูกค้าเป็นคำทักทายอย่างเดียว** เช่น:
"สวัสดี", "สวัสดีครับ", "สวัสดีค่ะ", "หวัดดี", "ดีครับ", "ดีค่ะ", "ดี", "hello", "hi", "หวัดดีครับ"

**→ ต้องตอบทักทายกลับเท่านั้น** เช่น: "สวัสดีค่ะ 😊 ยินดีให้บริการค่ะ มีอะไรให้ช่วยไหมคะ?"

**ห้ามเด็ดขาดเมื่อเจอคำทักทาย:**
❌ ห้ามพูดถึงสินค้า/สี/ไซส์/ราคา
❌ ห้ามตอบต่อจากบทสนทนาเดิม
❌ ห้ามใช้ [SHOW_PRODUCTS] หรือ [SHOW_PRODUCT:x]
❌ ห้ามถามว่าต้องการสินค้าอะไร

### กฎอื่นๆ:
- ทุกการตอบต้องมีข้อความ - ห้ามตอบเฉพาะ [] อย่างเดียว
- แสดงสินค้าเฉพาะเมื่อลูกค้าถามโดยตรง

## หลักการทั่วไป:
- ตอบสั้น ได้ใจความ ไม่เกิน 200 ตัวอักษร
- ใช้ภาษาเป็นกันเอง แต่สุภาพ
- ถ้าลูกค้าถามเรื่องการคืนสินค้าหรือการจัดส่ง ให้ตอบจากข้อมูลร้านค้า

## 📦 การแสดงสินค้า:
- "ดูสินค้า", "มีอะไรขายบ้าง" → ตอบ "นี่คือสินค้าของเราค่ะ 😊 [SHOW_PRODUCTS]"
- ถามเกี่ยวกับสินค้าเฉพาะ เช่น "สนใจรองเท้า" → หาสินค้าที่มีคำว่า "รองเท้า" ในรายการ แล้วตอบ "มีค่ะ 😊 [SHOW_PRODUCT:ชื่อเต็มของสินค้าจากรายการ]"
- **สำคัญ**: ชื่อใน [SHOW_PRODUCT:xxx] ต้องตรงกับชื่อสินค้าในรายการ เช่น ถ้ามี "รองเท้าผ้าใบ" ต้องใช้ [SHOW_PRODUCT:รองเท้าผ้าใบ]
- ถ้าลูกค้าบอกชื่อตัวเอง → ตอบ [NAME:ชื่อลูกค้า]

## 🚫 สินค้าหมด - แนะนำสินค้าทดแทน:
- ถ้าสินค้าที่ลูกค้าถามมีเครื่องหมาย [หมด] → แจ้งลูกค้าว่าสินค้าหมดและแนะนำสินค้าอื่นในหมวดเดียวกัน
- ตัวอย่าง: ลูกค้าถาม "รองเท้า" แต่รองเท้าผ้าใบหมด → ตอบ "ขออภัยค่ะ รองเท้าผ้าใบหมดชั่วคราว ขอแนะนำสินค้าอื่นในหมวดเดียวกันนะคะ [RECOMMEND_SIMILAR:หมวดหมู่]"
- ใช้ [RECOMMEND_SIMILAR:หมวดหมู่] เพื่อแสดงสินค้าในหมวดเดียวกันที่ยังมีสต็อก
- ถ้าไม่มีสินค้าในหมวดเดียวกัน ให้แนะนำสินค้ายอดนิยมอื่นแทน

## 📋 ประวัติการสั่งซื้อ:
- ถ้าลูกค้าเคยสั่งซื้อ สามารถอ้างอิงประวัติได้ เช่น "ครั้งก่อนคุณสั่งเสื้อยืด สนใจสั่งซ้ำไหมคะ?"
- ถ้าลูกค้าถามเรื่องออเดอร์เก่า สามารถบอกสถานะได้
- ลูกค้าพิมพ์ "สั่งซ้ำ" หรือ "สั่งเหมือนเดิม" → ถามว่าต้องการสั่งสินค้าเดิมไหม

## 🎟️ คูปอง: ใช้โค้ด → [APPLY_COUPON:โค้ด]

## 🛒 ตะกร้า:
- เพิ่มลงตะกร้า → [ADD_CART:ชื่อสินค้า|จำนวน|ตัวเลือก]
- ดูตะกร้า → [VIEW_CART]
- ล้างตะกร้า → [CLEAR_CART]
- สั่งซื้อตะกร้า พร้อมข้อมูล → [CHECKOUT_CART:ชื่อ|ที่อยู่|เบอร์|โค้ด]

## 🛍️ สั่งซื้อตรง:
- สั่งซื้อสินค้าที่มีตัวเลือก → [SELECT_VARIANT:ชื่อสินค้า]
- ข้อมูลครบ → [CREATE_ORDER:สินค้า|จำนวน|ชื่อ|ที่อยู่|เบอร์|ตัวเลือก|โค้ด]
- ห้ามบอกจำนวนสต็อกโดยตรง

## 📍 ที่อยู่จัดส่ง (รองรับหลายที่อยู่):
- ถ้าลูกค้ามีที่อยู่บันทึกไว้ → ถามว่าจะใช้ที่อยู่ไหน เช่น "ส่งที่บ้านหรือที่ทำงานดีคะ?" หรือ "ใช้ที่อยู่ [บ้าน] ไหมคะ?"
- ลูกค้าตอบ "ส่งที่บ้าน" หรือ "ใช้ที่อยู่บ้าน" → ใช้ที่อยู่ที่มี label "บ้าน"
- ลูกค้าตอบ "ส่งที่ทำงาน" → ใช้ที่อยู่ที่มี label "ที่ทำงาน"
- ลูกค้าต้องการเพิ่มที่อยู่ใหม่ → ถามที่อยู่และถามว่าจะบันทึกเป็นชื่ออะไร เช่น "บ้าน", "ที่ทำงาน", "บ้านแม่"
- ใช้ [SAVE_ADDRESS:label|ที่อยู่] เพื่อบันทึกที่อยู่ใหม่ เช่น [SAVE_ADDRESS:ที่ทำงาน|123 อาคารเอบีซี ถนนสุขุมวิท]`;

  try {
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
          ...messages,
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
    const showProductsMatch = content.match(/\[SHOW_PRODUCTS\]/);
    const specificProductMatch = content.match(/\[SHOW_PRODUCT:([^\]]+)\]/);
    const nameMatch = content.match(/\[NAME:([^\]]+)\]/);
    const selectVariantMatch = content.match(/\[SELECT_VARIANT:([^\]]+)\]/);
    const createOrderMatch = content.match(/\[CREATE_ORDER:([^\]]+)\]/);
    const addCartMatch = content.match(/\[ADD_CART:([^\]]+)\]/);
    const viewCartMatch = content.match(/\[VIEW_CART\]/);
    const clearCartMatch = content.match(/\[CLEAR_CART\]/);
    const checkoutCartMatch = content.match(/\[CHECKOUT_CART:([^\]]+)\]/);
    const applyCouponMatch = content.match(/\[APPLY_COUPON:([^\]]+)\]/);
    const recommendSimilarMatch = content.match(/\[RECOMMEND_SIMILAR:([^\]]+)\]/);
    const saveAddressMatch = content.match(/\[SAVE_ADDRESS:([^\]]+)\]/);

    // Parse order data if present
    let createOrder: OrderData | undefined;
    if (createOrderMatch) {
      const orderParts = createOrderMatch[1].split('|');
      if (orderParts.length >= 5) {
        createOrder = {
          productName: orderParts[0].trim(),
          quantity: parseInt(orderParts[1].trim()) || 1,
          customerName: orderParts[2].trim(),
          customerAddress: orderParts[3].trim(),
          customerPhone: orderParts[4].trim(),
          variants: orderParts[5]?.trim() || undefined,
          couponCode: orderParts[6]?.trim() || undefined
        };
      }
    }

    // Parse cart action if present
    let cartAction: CartAction | undefined;
    if (addCartMatch) {
      const parts = addCartMatch[1].split('|');
      cartAction = {
        action: 'add',
        productName: parts[0]?.trim(),
        quantity: parseInt(parts[1]?.trim()) || 1,
        variants: parts[2]?.trim() || undefined
      };
    } else if (viewCartMatch) {
      cartAction = { action: 'view' };
    } else if (clearCartMatch) {
      cartAction = { action: 'clear' };
    } else if (checkoutCartMatch) {
      const parts = checkoutCartMatch[1].split('|');
      cartAction = {
        action: 'checkout',
        customerName: parts[0]?.trim(),
        customerAddress: parts[1]?.trim(),
        customerPhone: parts[2]?.trim(),
        couponCode: parts[3]?.trim() || undefined
      };
    }

    // Parse save address if present
    let saveAddress: { label: string; address: string } | undefined;
    if (saveAddressMatch) {
      const parts = saveAddressMatch[1].split('|');
      if (parts.length >= 2) {
        saveAddress = {
          label: parts[0]?.trim(),
          address: parts[1]?.trim()
        };
      }
    }

    // Clean up the response
    content = content
      .replace(/\[SHOW_PRODUCTS\]/g, '')
      .replace(/\[SHOW_PRODUCT:[^\]]+\]/g, '')
      .replace(/\[NAME:[^\]]+\]/g, '')
      .replace(/\[SELECT_VARIANT:[^\]]+\]/g, '')
      .replace(/\[CREATE_ORDER:[^\]]+\]/g, '')
      .replace(/\[ADD_CART:[^\]]+\]/g, '')
      .replace(/\[VIEW_CART\]/g, '')
      .replace(/\[CLEAR_CART\]/g, '')
      .replace(/\[CHECKOUT_CART:[^\]]+\]/g, '')
      .replace(/\[APPLY_COUPON:[^\]]+\]/g, '')
      .replace(/\[RECOMMEND_SIMILAR:[^\]]+\]/g, '')
      .replace(/\[SAVE_ADDRESS:[^\]]+\]/g, '')
      .trim();

    return {
      text: content,
      showProducts: !!showProductsMatch,
      specificProduct: specificProductMatch ? specificProductMatch[1] : undefined,
      detectedName: nameMatch ? nameMatch[1].trim() : undefined,
      selectVariant: selectVariantMatch ? selectVariantMatch[1].trim() : undefined,
      createOrder,
      cartAction,
      applyCoupon: applyCouponMatch ? applyCouponMatch[1].trim() : undefined,
      recommendSimilar: recommendSimilarMatch ? recommendSimilarMatch[1].trim() : undefined,
      saveAddress
    };

  } catch (error) {
    console.error("AI call error:", error);
    return { text: "ขออภัยครับ ระบบมีปัญหา กรุณาลองใหม่ภายหลัง" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.text();
    const signature = req.headers.get("x-line-signature");

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Read and decrypt LINE tokens from database
    const LINE_CHANNEL_ACCESS_TOKEN = await getDecryptedSetting(supabase, 'LINE_CHANNEL_ACCESS_TOKEN');
    const LINE_CHANNEL_SECRET = await getDecryptedSetting(supabase, 'LINE_CHANNEL_SECRET');

    console.log("LINE tokens loaded from database:", {
      hasAccessToken: !!LINE_CHANNEL_ACCESS_TOKEN,
      hasChannelSecret: !!LINE_CHANNEL_SECRET
    });

    // Verify LINE signature - MANDATORY for security
    if (!signature) {
      console.error("Missing LINE signature header");
      return new Response(
        JSON.stringify({ error: "Missing x-line-signature header" }), 
        { 
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    if (!LINE_CHANNEL_SECRET) {
      console.error("LINE_CHANNEL_SECRET not configured");
      return new Response(
        JSON.stringify({ error: "Webhook not properly configured" }), 
        { 
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    const isValid = await verifySignature(body, signature, LINE_CHANNEL_SECRET);
    if (!isValid) {
      console.error("Invalid LINE signature");
      return new Response(
        JSON.stringify({ error: "Invalid signature" }), 
        { 
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
    console.log("LINE signature verified successfully");

    if (!LINE_CHANNEL_ACCESS_TOKEN) {
      console.error("LINE_CHANNEL_ACCESS_TOKEN not configured");
      return new Response(
        JSON.stringify({ error: "LINE access token not configured" }), 
        { 
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Type-safe token after validation
    const lineAccessToken: string = LINE_CHANNEL_ACCESS_TOKEN;

    const data = JSON.parse(body);
    console.log("LINE webhook received:", JSON.stringify(data, null, 2));

    // Process each event
    for (const event of data.events || []) {
      if (event.type !== "message" || event.message?.type !== "text") {
        continue;
      }

      const userId = event.source?.userId;
      const userMessage = event.message?.text;
      const replyToken = event.replyToken;

      if (!userId || !userMessage || !replyToken) continue;

      console.log(`LINE message from ${userId}: ${userMessage}`);

      // Find or create conversation
      let { data: conversation } = await supabase
        .from("chat_conversations")
        .select("*")
        .eq("platform", "line")
        .eq("platform_user_id", userId)
        .maybeSingle();

      const isReturningCustomer = !!conversation;
      let messageCount = 0;

      if (!conversation) {
        const { data: newConv } = await supabase
          .from("chat_conversations")
          .insert({
            platform: "line",
            platform_user_id: userId,
          })
          .select()
          .single();
        conversation = newConv;
      } else {
        // Get message count for returning customers
        const { count } = await supabase
          .from("chat_messages")
          .select("*", { count: "exact", head: true })
          .eq("conversation_id", conversation.id);
        messageCount = count || 0;
      }

      if (!conversation) {
        console.error("Failed to create conversation");
        await replyToLine(replyToken, [{ type: "text", text: "ขออภัยครับ เกิดข้อผิดพลาด" }], lineAccessToken);
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

        // Find order by order number
        const { data: order } = await supabase
          .from("orders")
          .select("*")
          .eq("order_number", orderNumber)
          .maybeSingle();

        if (order) {
          // Get order items
          const { data: orderItems } = await supabase
            .from("order_items")
            .select("*")
            .eq("order_id", order.id);

          const orderStatusCard = createOrderStatusCard(order, orderItems || []);

          // Save bot response
          await supabase.from("chat_messages").insert({
            conversation_id: conversation.id,
            role: "assistant",
            content: `สถานะออเดอร์ ${orderNumber}: ${order.status}`,
          });

          // Update last message
          await supabase
            .from("chat_conversations")
            .update({
              last_message: `สถานะ: ${order.status}`,
              last_message_at: new Date().toISOString(),
            })
            .eq("id", conversation.id);

          await replyToLine(replyToken, [
            { type: "text", text: `นี่คือสถานะออเดอร์ของคุณค่ะ 📋` },
            orderStatusCard
          ], lineAccessToken);
          continue;
        } else {
          // Order not found
          await supabase.from("chat_messages").insert({
            conversation_id: conversation.id,
            role: "assistant",
            content: `ไม่พบออเดอร์หมายเลข ${orderNumber}`,
          });

          await replyToLine(replyToken, [
            { type: "text", text: `ขออภัยค่ะ ไม่พบออเดอร์หมายเลข ${orderNumber} ในระบบ 😔\n\nกรุณาตรวจสอบหมายเลขออเดอร์อีกครั้ง หรือติดต่อเจ้าหน้าที่ค่ะ` }
          ], lineAccessToken);
          continue;
        }
      }

      // Check for order history request
      const orderHistoryKeywords = ['ประวัติออเดอร์', 'ประวัติคำสั่งซื้อ', 'ออเดอร์ทั้งหมด', 'ดูออเดอร์', 'รายการสั่งซื้อ'];
      const isOrderHistoryRequest = orderHistoryKeywords.some(keyword => 
        userMessage.toLowerCase().includes(keyword.toLowerCase())
      );

      if (isOrderHistoryRequest) {
        console.log("Order history requested for LINE user:", userId);

        // Find orders by customer LINE ID
        const { data: orders } = await supabase
          .from("orders")
          .select("*")
          .eq("customer_line_id", userId)
          .order("created_at", { ascending: false })
          .limit(10);

        if (orders && orders.length > 0) {
          const historyCarousel = createOrderHistoryCarousel(orders);

          // Save bot response
          await supabase.from("chat_messages").insert({
            conversation_id: conversation.id,
            role: "assistant",
            content: `แสดงประวัติออเดอร์ ${orders.length} รายการ`,
          });

          // Update last message
          await supabase
            .from("chat_conversations")
            .update({
              last_message: `ประวัติออเดอร์ ${orders.length} รายการ`,
              last_message_at: new Date().toISOString(),
            })
            .eq("id", conversation.id);

          await replyToLine(replyToken, [
            { type: "text", text: `📋 ประวัติออเดอร์ของคุณ (${orders.length} รายการล่าสุด)\n\nกดดูรายละเอียดหรือพิมพ์เลขออเดอร์เพื่อเช็คสถานะค่ะ` },
            historyCarousel
          ], lineAccessToken);
          continue;
        } else {
          // No orders found
          await supabase.from("chat_messages").insert({
            conversation_id: conversation.id,
            role: "assistant",
            content: "ไม่พบประวัติออเดอร์",
          });

          await replyToLine(replyToken, [
            { type: "text", text: `📋 ยังไม่มีประวัติออเดอร์ค่ะ\n\nหากต้องการสั่งซื้อสินค้า พิมพ์ "ดูสินค้า" หรือสอบถามได้เลยค่ะ 😊` }
          ], lineAccessToken);
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
          .eq("customer_line_id", userId)
          .maybeSingle();

        if (!order) {
          await supabase.from("chat_messages").insert({
            conversation_id: conversation.id,
            role: "assistant",
            content: `ไม่พบออเดอร์หมายเลข ${orderNumber}`,
          });

          await replyToLine(replyToken, [
            { type: "text", text: `ขออภัยค่ะ ไม่พบออเดอร์หมายเลข ${orderNumber} ในระบบของคุณ 😔\n\nกรุณาตรวจสอบหมายเลขออเดอร์อีกครั้งค่ะ` }
          ], lineAccessToken);
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

          await replyToLine(replyToken, [
            { type: "text", text: `ขออภัยค่ะ ${statusMessages[order.status] || 'ไม่สามารถยกเลิกออเดอร์นี้ได้ค่ะ'}\n\nหากมีปัญหา กรุณาติดต่อเจ้าหน้าที่ค่ะ` }
          ], lineAccessToken);
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
                .update({ stock: item.products.stock + item.quantity })
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
          await replyToLine(replyToken, [
            { type: "text", text: `ขออภัยค่ะ เกิดข้อผิดพลาดในการยกเลิกออเดอร์ กรุณาลองใหม่อีกครั้งค่ะ` }
          ], lineAccessToken);
          continue;
        }

        // Create cancellation confirmation flex message
        const cancelConfirmCard = {
          type: "flex",
          altText: `ยกเลิกออเดอร์ ${orderNumber} สำเร็จ`,
          contents: {
            type: "bubble",
            body: {
              type: "box",
              layout: "vertical",
              contents: [
                {
                  type: "text",
                  text: "❌ ยกเลิกออเดอร์สำเร็จ",
                  weight: "bold",
                  size: "lg",
                  color: "#FF0000"
                },
                {
                  type: "separator",
                  margin: "lg"
                },
                {
                  type: "box",
                  layout: "vertical",
                  margin: "lg",
                  spacing: "sm",
                  contents: [
                    {
                      type: "box",
                      layout: "horizontal",
                      contents: [
                        { type: "text", text: "หมายเลข:", size: "sm", color: "#666666", flex: 3 },
                        { type: "text", text: orderNumber, size: "sm", color: "#333333", weight: "bold", flex: 7, align: "end" }
                      ]
                    },
                    {
                      type: "box",
                      layout: "horizontal",
                      contents: [
                        { type: "text", text: "ยอดเงิน:", size: "sm", color: "#666666", flex: 3 },
                        { type: "text", text: `฿${Number(order.total_amount).toLocaleString()}`, size: "sm", color: "#999999", decoration: "line-through", flex: 7, align: "end" }
                      ]
                    }
                  ]
                },
                {
                  type: "text",
                  text: "หากต้องการสั่งซื้อใหม่ พิมพ์ \"ดูสินค้า\" ค่ะ 😊",
                  size: "sm",
                  color: "#00B900",
                  margin: "lg",
                  wrap: true
                }
              ]
            }
          }
        };

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

        await replyToLine(replyToken, [cancelConfirmCard], lineAccessToken);
        continue;
      }

      // Check if message is a greeting - don't include history to force fresh response
      // Pattern matches: สวัสดี, สวัสดีครับ, สวัสดีค่ะ, หวัดดี, ดีครับ, ดีค่ะ, ดี, hello, hi, hey, etc.
      const greetingPatterns = /^(สวัสดี(ครับ|ค่ะ|จ้า|นะ)?|หวัดดี(ครับ|ค่ะ|จ้า|นะ)?|ดีครับ|ดีค่ะ|ดีจ้า|ดี|hello|hi|hey|hola)[\s!]*$/i;
      const isGreeting = greetingPatterns.test(userMessage.trim());
      console.log(`Greeting check: message="${userMessage}", isGreeting=${isGreeting}`);
      
      let messages: Array<{ role: string; content: string }>;
      
      if (isGreeting) {
        // For greetings, only send the current message - no history
        console.log("Detected greeting message - sending without history");
        messages = [{ role: "user", content: userMessage }];
      } else {
        // Get conversation history for non-greeting messages
        const { data: history } = await supabase
          .from("chat_messages")
          .select("*")
          .eq("conversation_id", conversation.id)
          .order("created_at", { ascending: true })
          .limit(20);

        messages = history?.map((m: any) => ({
          role: m.role,
          content: m.content,
        })) || [{ role: "user", content: userMessage }];
      }

      // Get cart items count
      const { count: cartItemCount } = await supabase
        .from("shopping_carts")
        .select("*", { count: "exact", head: true })
        .eq("conversation_id", conversation.id);

      // Get customer order history
      let orderHistory: OrderHistory[] = [];
      const { data: ordersData } = await supabase
        .from("orders")
        .select(`
          order_number,
          total_amount,
          status,
          created_at,
          order_items (product_name, quantity)
        `)
        .eq("customer_line_id", userId)
        .order("created_at", { ascending: false })
        .limit(5);

      if (ordersData && ordersData.length > 0) {
        orderHistory = ordersData.map((o: any) => ({
          orderNumber: o.order_number,
          productName: o.order_items?.map((i: any) => i.product_name).join(', ') || 'ไม่ระบุ',
          quantity: o.order_items?.reduce((sum: number, i: any) => sum + i.quantity, 0) || 1,
          totalAmount: o.total_amount,
          status: o.status,
          createdAt: o.created_at
        }));
        console.log(`Found ${orderHistory.length} orders for customer ${userId}`);
      }

      // Fetch saved addresses for the customer
      let savedAddresses: SavedAddress[] = [];
      const { data: addressesData } = await supabase
        .from("customer_addresses")
        .select("*")
        .eq("platform_user_id", userId)
        .eq("platform", "line")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });

      if (addressesData && addressesData.length > 0) {
        savedAddresses = addressesData.map((a: any) => ({
          id: a.id,
          label: a.label,
          address: a.address,
          isDefault: a.is_default
        }));
        console.log(`Found ${savedAddresses.length} saved addresses for customer ${userId}`);
      }

      // Get AI response with customer context
      const customerContext: CustomerContext = {
        isReturning: isReturningCustomer,
        customerName: conversation.customer_name || undefined,
        customerAddress: conversation.customer_address || undefined,
        customerPhone: conversation.customer_phone || undefined,
        messageCount: messageCount,
        lastVisit: conversation.last_message_at || undefined,
        cartItemCount: cartItemCount || 0,
        orderHistory: orderHistory.length > 0 ? orderHistory : undefined,
        savedAddresses: savedAddresses.length > 0 ? savedAddresses : undefined
      };

      let aiResult = await getAIResponse(messages, supabase, customerContext);
      console.log("AI response generated:", aiResult);

      // CRITICAL: Force text-only response for greetings - override any product flags
      if (isGreeting) {
        console.log("Greeting detected - forcing text-only response, clearing all product flags");
        // Generate default greeting if AI didn't provide text
        const defaultGreeting = customerContext.isReturning && customerContext.customerName
          ? `สวัสดีค่ะ คุณ${customerContext.customerName}! ยินดีต้อนรับกลับมาค่ะ 😊 มีอะไรให้ช่วยไหมคะ?`
          : `สวัสดีค่ะ! ยินดีต้อนรับค่ะ 😊 มีอะไรให้ช่วยไหมคะ? สามารถสอบถามเกี่ยวกับสินค้าหรือพิมพ์ "ดูสินค้า" เพื่อดูสินค้าทั้งหมดได้เลยค่ะ`;
        
        // Override AI result to text-only
        aiResult = {
          text: aiResult.text || defaultGreeting,
          showProducts: false,
          specificProduct: undefined,
          selectVariant: undefined,
          createOrder: undefined,
          cartAction: undefined,
          applyCoupon: undefined,
          saveAddress: undefined,
          detectedName: aiResult.detectedName // Keep detected name if any
        };
        console.log("Overridden AI result for greeting:", aiResult);
      }

      // Prepare messages to send
      const messagesToSend: any[] = [];

      // Handle save address action
      if (aiResult.saveAddress) {
        const { label, address } = aiResult.saveAddress;
        console.log(`Saving new address: ${label} - ${address}`);

        // Check if address with same label already exists
        const { data: existingAddr } = await supabase
          .from("customer_addresses")
          .select("id")
          .eq("platform_user_id", userId)
          .eq("platform", "line")
          .eq("label", label)
          .maybeSingle();

        if (existingAddr) {
          // Update existing address
          await supabase
            .from("customer_addresses")
            .update({ address, updated_at: new Date().toISOString() })
            .eq("id", existingAddr.id);
          console.log(`Updated existing address: ${label}`);
        } else {
          // Check if this is the first address (set as default)
          const { count: addressCount } = await supabase
            .from("customer_addresses")
            .select("*", { count: "exact", head: true })
            .eq("platform_user_id", userId)
            .eq("platform", "line");

          await supabase.from("customer_addresses").insert({
            platform_user_id: userId,
            platform: "line",
            label,
            address,
            is_default: (addressCount || 0) === 0 // First address is default
          });
          console.log(`Created new address: ${label} (default: ${(addressCount || 0) === 0})`);
        }
      }

      // Handle cart actions first
      if (aiResult.cartAction) {
        const cartAction = aiResult.cartAction;
        console.log("Cart action:", cartAction);

        if (cartAction.action === 'add' && cartAction.productName) {
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
              // Update quantity
              await supabase
                .from("shopping_carts")
                .update({ quantity: existingItem.quantity + (cartAction.quantity || 1) })
                .eq("id", existingItem.id);
            } else {
              // Add new item
              await supabase.from("shopping_carts").insert({
                conversation_id: conversation.id,
                platform_user_id: userId,
                product_id: product.id,
                product_name: product.name,
                quantity: cartAction.quantity || 1,
                price: price,
                variants: cartAction.variants || ''
              });
            }

            if (aiResult.text) {
              messagesToSend.push({ type: "text", text: aiResult.text });
            }
          } else {
            messagesToSend.push({ type: "text", text: "ขออภัยค่ะ ไม่พบสินค้าที่ต้องการ" });
          }
        } else if (cartAction.action === 'view') {
          // Get cart items
          const { data: cartItems } = await supabase
            .from("shopping_carts")
            .select("*")
            .eq("conversation_id", conversation.id);

          const totalAmount = cartItems?.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0) || 0;

          if (aiResult.text) {
            messagesToSend.push({ type: "text", text: aiResult.text });
          }
          messagesToSend.push(createCartSummaryCard(cartItems || [], totalAmount));
        } else if (cartAction.action === 'clear') {
          // Clear cart
          await supabase
            .from("shopping_carts")
            .delete()
            .eq("conversation_id", conversation.id);

          if (aiResult.text) {
            messagesToSend.push({ type: "text", text: aiResult.text });
          } else {
            messagesToSend.push({ type: "text", text: "ล้างตะกร้าเรียบร้อยแล้วค่ะ 🛒" });
          }
        } else if (cartAction.action === 'checkout' && cartAction.customerName && cartAction.customerAddress && cartAction.customerPhone) {
          // Get cart items
          const { data: cartItems } = await supabase
            .from("shopping_carts")
            .select("*, products(*)")
            .eq("conversation_id", conversation.id);

          if (cartItems && cartItems.length > 0) {
            let totalAmount = cartItems.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
            let discountAmount = 0;
            let couponCode: string | null = null;
            let couponMessage = "";

            // Validate and apply coupon if provided
            if (cartAction.couponCode) {
              const couponResult = await validateCoupon(cartAction.couponCode, totalAmount, supabase);
              if (couponResult.valid && couponResult.coupon) {
                discountAmount = couponResult.discountAmount || 0;
                couponCode = couponResult.coupon.code;
                couponMessage = `\n🎟️ ใช้โค้ด ${couponCode} ลด ฿${discountAmount.toLocaleString()}`;
                
                // Update coupon usage
                await supabase
                  .from("coupons")
                  .update({ used_count: couponResult.coupon.used_count + 1 })
                  .eq("id", couponResult.coupon.id);
              } else {
                messagesToSend.push({ type: "text", text: couponResult.errorMessage || "โค้ดส่วนลดไม่ถูกต้อง" });
              }
            }

            const finalAmount = totalAmount - discountAmount;

            // Create order
            const { data: order, error: orderError } = await supabase
              .from("orders")
              .insert({
                customer_name: cartAction.customerName,
                customer_address: cartAction.customerAddress,
                customer_phone: cartAction.customerPhone,
                customer_line_id: userId,
                platform: "line",
                total_amount: finalAmount,
                discount_amount: discountAmount,
                coupon_code: couponCode
              })
              .select()
              .single();

            if (order && !orderError) {
              // Create order items and update stock
              for (const cartItem of cartItems) {
                await supabase.from("order_items").insert({
                  order_id: order.id,
                  product_id: cartItem.product_id,
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
              // Update conversation with customer info (including address)
              await supabase
                .from("chat_conversations")
                .update({
                  customer_name: cartAction.customerName,
                  customer_phone: cartAction.customerPhone,
                  customer_address: cartAction.customerAddress
                })
                .eq("id", conversation.id);
              console.log(`Saved customer address for cart checkout: ${cartAction.customerName}`);

              console.log(`Cart order created: ${order.order_number} with discount: ${discountAmount}`);

              if (aiResult.text) {
                messagesToSend.push({ type: "text", text: aiResult.text + couponMessage });
              }

              // Add multi-item order confirmation with discount info
              const orderItems = cartItems.map((item: any) => ({
                product_name: item.product_name + (item.variants ? ` (${item.variants})` : ''),
                quantity: item.quantity,
                price: item.price
              }));

              messagesToSend.push(createMultiItemOrderCard(
                order.order_number,
                orderItems,
                finalAmount,
                cartAction.customerName,
                cartAction.customerAddress,
                discountAmount > 0 ? { code: couponCode!, discount: discountAmount, originalTotal: totalAmount } : undefined
              ));
            } else {
              messagesToSend.push({ type: "text", text: "ขออภัยค่ะ ไม่สามารถสร้างออเดอร์ได้ กรุณาลองใหม่อีกครั้ง" });
            }
          } else {
            messagesToSend.push({ type: "text", text: "ไม่มีสินค้าในตะกร้าค่ะ กรุณาเพิ่มสินค้าก่อนนะคะ" });
          }
        }
      } else if (aiResult.createOrder) {
        const orderData = aiResult.createOrder;
        console.log("Creating order:", orderData);

        // Find product to get price
        const { data: products } = await supabase
          .from("products")
          .select("*")
          .eq("is_active", true)
          .ilike("name", `%${orderData.productName}%`)
          .limit(1);

        if (products && products.length > 0) {
          const product = products[0];
          const price = product.promotion_price || product.price;
          let totalAmount = price * orderData.quantity;
          let discountAmount = 0;
          let couponCode: string | null = null;

          // Validate and apply coupon if provided
          if (orderData.couponCode) {
            const couponResult = await validateCoupon(orderData.couponCode, totalAmount, supabase);
            if (couponResult.valid && couponResult.coupon) {
              discountAmount = couponResult.discountAmount || 0;
              couponCode = couponResult.coupon.code;
              
              // Update coupon usage
              await supabase
                .from("coupons")
                .update({ used_count: couponResult.coupon.used_count + 1 })
                .eq("id", couponResult.coupon.id);
            } else {
              messagesToSend.push({ type: "text", text: couponResult.errorMessage || "โค้ดส่วนลดไม่ถูกต้อง" });
            }
          }

          const finalAmount = totalAmount - discountAmount;

          // Create order
          const { data: order, error: orderError } = await supabase
            .from("orders")
            .insert({
              customer_name: orderData.customerName,
              customer_address: orderData.customerAddress,
              customer_phone: orderData.customerPhone,
              customer_line_id: userId,
              platform: "line",
              total_amount: finalAmount,
              discount_amount: discountAmount,
              coupon_code: couponCode,
              notes: orderData.variants ? `ตัวเลือก: ${orderData.variants}` : null
            })
            .select()
            .single();

          if (order && !orderError) {
            // Create order item
            await supabase.from("order_items").insert({
              order_id: order.id,
              product_id: product.id,
              product_name: product.name + (orderData.variants ? ` (${orderData.variants})` : ''),
              quantity: orderData.quantity,
              price: price
            });

            // Update product stock
            await supabase
              .from("products")
              .update({ stock: product.stock - orderData.quantity })
              .eq("id", product.id);

            // Update conversation with customer info (including address)
            await supabase
              .from("chat_conversations")
              .update({
                customer_name: orderData.customerName,
                customer_phone: orderData.customerPhone,
                customer_address: orderData.customerAddress
              })
              .eq("id", conversation.id);
            console.log(`Saved customer address for ${orderData.customerName}`);

            console.log(`Order created: ${order.order_number} with discount: ${discountAmount}`);

            // Add text response
            if (aiResult.text) {
              const couponMsg = discountAmount > 0 ? `\n🎟️ ใช้โค้ด ${couponCode} ลด ฿${discountAmount.toLocaleString()}` : '';
              messagesToSend.push({ type: "text", text: aiResult.text + couponMsg });
            }

            // Add order confirmation card
            messagesToSend.push(createOrderConfirmationCard(
              order.order_number,
              product.name,
              orderData.quantity,
              finalAmount,
              orderData.customerName,
              orderData.customerAddress,
              orderData.variants,
              discountAmount > 0 ? { code: couponCode!, discount: discountAmount, originalTotal: totalAmount } : undefined
            ));
          } else {
            console.error("Order creation error:", orderError);
            messagesToSend.push({ type: "text", text: "ขออภัยค่ะ ไม่สามารถสร้างออเดอร์ได้ กรุณาลองใหม่อีกครั้งนะคะ 🙏" });
          }
        } else {
          messagesToSend.push({ type: "text", text: "ขออภัยค่ะ ไม่พบสินค้าที่ต้องการ กรุณาตรวจสอบชื่อสินค้าอีกครั้งนะคะ" });
        }
      } else {
        // Add product cards if requested - with fallback text if AI didn't return text
        if (aiResult.showProducts) {
          // Always add text message first
          const textMsg = aiResult.text || "นี่คือสินค้าของเราค่ะ 😊";
          messagesToSend.push({ type: "text", text: textMsg });
          
          const { data: products } = await supabase
            .from("products")
            .select("*")
            .eq("is_active", true)
            .gt("stock", 0)
            .limit(10);

          if (products && products.length > 0) {
            messagesToSend.push(createProductFlexMessage(products));
          }
        } else if (aiResult.selectVariant) {
          // Always add text message first
          const textMsg = aiResult.text || "สินค้ามีหลายตัวเลือกค่ะ เลือกได้เลยนะคะ 😊";
          messagesToSend.push({ type: "text", text: textMsg });
          
          // Show variant selection card
          const { data: products } = await supabase
            .from("products")
            .select("*")
            .eq("is_active", true)
            .ilike("name", `%${aiResult.selectVariant}%`)
            .limit(1);

          if (products && products.length > 0) {
            const product = products[0] as Product;
            if (product.variants && product.variants.length > 0) {
              // Send variant selection cards for each variant type
              for (const variant of product.variants.slice(0, 2)) {
                messagesToSend.push(createVariantSelectionCard(product, variant.name, variant.options));
              }
            }
          }
        } else if (aiResult.specificProduct) {
          // Always add text message first
          const textMsg = aiResult.text || "นี่คือรายละเอียดสินค้าค่ะ 😊";
          messagesToSend.push({ type: "text", text: textMsg });
          
          const { data: products } = await supabase
            .from("products")
            .select("*")
            .eq("is_active", true)
            .ilike("name", `%${aiResult.specificProduct}%`)
            .limit(1);

          if (products && products.length > 0) {
            messagesToSend.push(createSingleProductCard(products[0]));
          }
        } else if (aiResult.recommendSimilar) {
          // Always add text message first
          const textMsg = aiResult.text || "ขอแนะนำสินค้าอื่นในหมวดเดียวกันค่ะ 😊";
          messagesToSend.push({ type: "text", text: textMsg });
          
          // Find products in the same category that are in stock
          const { data: similarProducts } = await supabase
            .from("products")
            .select("*")
            .eq("is_active", true)
            .eq("category", aiResult.recommendSimilar)
            .gt("stock", 0)
            .limit(10);

          if (similarProducts && similarProducts.length > 0) {
            console.log(`Found ${similarProducts.length} similar products in category: ${aiResult.recommendSimilar}`);
            messagesToSend.push(createProductFlexMessage(similarProducts));
          } else {
            // If no products in that category, show any available products
            const { data: availableProducts } = await supabase
              .from("products")
              .select("*")
              .eq("is_active", true)
              .gt("stock", 0)
              .limit(10);

            if (availableProducts && availableProducts.length > 0) {
              console.log(`No products in category ${aiResult.recommendSimilar}, showing ${availableProducts.length} available products`);
              messagesToSend.push(createProductFlexMessage(availableProducts));
            }
          }
        } else {
          // No product action - just send text response
          if (aiResult.text) {
            messagesToSend.push({ type: "text", text: aiResult.text });
          }
        }
      }

      // Save AI response
      await supabase.from("chat_messages").insert({
        conversation_id: conversation.id,
        role: "assistant",
        content: aiResult.text,
      });

      // Update conversation (including customer name if detected)
      const updateData: any = {
        last_message: aiResult.text.slice(0, 100),
        last_message_at: new Date().toISOString(),
      };

      if (aiResult.detectedName && !conversation.customer_name) {
        updateData.customer_name = aiResult.detectedName;
        console.log(`Saved customer name: ${aiResult.detectedName}`);
      }

      await supabase
        .from("chat_conversations")
        .update(updateData)
        .eq("id", conversation.id);

      // Reply to LINE
      if (messagesToSend.length > 0) {
        console.log("Sending reply to LINE...");
        await replyToLine(replyToken, messagesToSend.slice(0, 5), lineAccessToken);
      } else {
        console.error("Cannot reply - no messages to send");
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("LINE webhook error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
