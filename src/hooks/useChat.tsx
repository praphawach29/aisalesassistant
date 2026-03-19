import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ChatMessage } from '@/types';

const CONVERSATION_STORAGE_KEY = 'chat_conversation_id';
const WEB_USER_ID_KEY = 'chat_web_user_id';
const LAST_ORDER_ID_KEY = 'chat_last_order_id';
const LAST_ORDER_NUMBER_KEY = 'chat_last_order_number';

interface UseChatOptions {
  conversationId?: string;
  autoLoadHistory?: boolean;
}

// Get or create a persistent web user ID
function getOrCreateWebUserId(): string {
  let webUserId = localStorage.getItem(WEB_USER_ID_KEY);
  if (!webUserId) {
    webUserId = 'web_' + crypto.randomUUID();
    localStorage.setItem(WEB_USER_ID_KEY, webUserId);
  }
  return webUserId;
}

// Parse address commands from AI response
function parseAddressCommands(text: string): { cleanText: string; addressAction?: { type: string; label?: string; address?: string } } {
  let cleanText = text;
  let addressAction: { type: string; label?: string; address?: string } | undefined;

  // Check for ADDRESS_LIST
  if (text.includes('[ADDRESS_LIST]')) {
    addressAction = { type: 'list' };
    cleanText = cleanText.replace(/\[ADDRESS_LIST\]/g, '');
  }

  // Check for ADDRESS_ADD
  const addMatch = text.match(/\[ADDRESS_ADD:([^|]+)\|([^\]]+)\]/);
  if (addMatch) {
    addressAction = { type: 'add', label: addMatch[1].trim(), address: addMatch[2].trim() };
    cleanText = cleanText.replace(/\[ADDRESS_ADD:[^\]]+\]/g, '');
  }

  // Check for ADDRESS_EDIT
  const editMatch = text.match(/\[ADDRESS_EDIT:([^|]+)\|([^\]]+)\]/);
  if (editMatch) {
    addressAction = { type: 'edit', label: editMatch[1].trim(), address: editMatch[2].trim() };
    cleanText = cleanText.replace(/\[ADDRESS_EDIT:[^\]]+\]/g, '');
  }

  // Check for ADDRESS_DELETE
  const deleteMatch = text.match(/\[ADDRESS_DELETE:([^\]]+)\]/);
  if (deleteMatch) {
    addressAction = { type: 'delete', label: deleteMatch[1].trim() };
    cleanText = cleanText.replace(/\[ADDRESS_DELETE:[^\]]+\]/g, '');
  }

  // Check for ADDRESS_DEFAULT
  const defaultMatch = text.match(/\[ADDRESS_DEFAULT:([^\]]+)\]/);
  if (defaultMatch) {
    addressAction = { type: 'set_default', label: defaultMatch[1].trim() };
    cleanText = cleanText.replace(/\[ADDRESS_DEFAULT:[^\]]+\]/g, '');
  }

  return { cleanText: cleanText.trim(), addressAction };
}

// Parse order creation command from AI response
interface OrderData {
  items: { name: string; quantity: number; price: number }[];
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  totalAmount: number;
}

function parseOrderCommand(text: string): { cleanText: string; orderData?: OrderData; checkOrderNumber?: string } {
  let cleanText = text;
  let orderData: OrderData | undefined;
  let checkOrderNumber: string | undefined;

  // Match CHECK_ORDER command
  const checkMatch = text.match(/\[CHECK_ORDER:([^\]]+)\]/);
  if (checkMatch) {
    checkOrderNumber = checkMatch[1].trim();
    cleanText = cleanText.replace(/\[CHECK_ORDER:[^\]]+\]/g, '');
  }

  // Match CREATE_ORDER command
  // Format: [CREATE_ORDER:item1|qty|price,item2|qty|price|name|phone|address|total]
  const orderMatch = text.match(/\[CREATE_ORDER:([^\]]+)\]/);
  if (orderMatch) {
    try {
      const parts = orderMatch[1].split('|');
      
      // Last 4 parts are: customerName, phone, address, total
      const totalAmount = parseFloat(parts[parts.length - 1]) || 0;
      const customerAddress = parts[parts.length - 2] || '';
      const customerPhone = parts[parts.length - 3] || '';
      const customerName = parts[parts.length - 4] || '';
      
      // Parse items from the beginning
      const itemsString = parts.slice(0, parts.length - 4).join('|');
      const items: { name: string; quantity: number; price: number }[] = [];
      
      // Split by comma for multiple items, then by | for item details
      const itemParts = itemsString.split(',');
      for (const itemPart of itemParts) {
        const itemDetails = itemPart.split('|');
        if (itemDetails.length >= 3) {
          items.push({
            name: itemDetails[0].trim(),
            quantity: parseInt(itemDetails[1]) || 1,
            price: parseFloat(itemDetails[2]) || 0
          });
        }
      }

      if (items.length > 0 && customerName && customerPhone && customerAddress) {
        orderData = {
          items,
          customerName,
          customerPhone,
          customerAddress,
          totalAmount
        };
      }
    } catch (error) {
      console.error('Error parsing order command:', error);
    }
    
    cleanText = cleanText.replace(/\[CREATE_ORDER:[^\]]+\]/g, '');
  }

  return { cleanText: cleanText.trim(), orderData, checkOrderNumber };
}

// Parse booking commands from AI response
interface BookingData {
  customerName: string;
  customerPhone: string;
  bookingDate: string;
  bookingTime: string;
  serviceName: string;
  notes: string;
}

function parseBookingCommand(text: string): { cleanText: string; bookingData?: BookingData; checkBookingNumber?: string } {
  let cleanText = text;
  let bookingData: BookingData | undefined;
  let checkBookingNumber: string | undefined;

  // Match CHECK_BOOKING command
  const checkMatch = text.match(/\[CHECK_BOOKING:([^\]]+)\]/);
  if (checkMatch) {
    checkBookingNumber = checkMatch[1].trim();
    cleanText = cleanText.replace(/\[CHECK_BOOKING:[^\]]+\]/g, '');
  }

  // Match CREATE_BOOKING command
  const bookingMatch = text.match(/\[CREATE_BOOKING:([^\]]+)\]/);
  if (bookingMatch) {
    try {
      const parts = bookingMatch[1].split('|');
      if (parts.length >= 5) {
        bookingData = {
          customerName: parts[0].trim(),
          customerPhone: parts[1].trim(),
          bookingDate: parts[2].trim(),
          bookingTime: parts[3].trim(),
          serviceName: parts[4].trim(),
          notes: parts[5]?.trim() || ''
        };
      }
    } catch (error) {
      console.error('Error parsing booking command:', error);
    }
    cleanText = cleanText.replace(/\[CREATE_BOOKING:[^\]]+\]/g, '');
  }

  return { cleanText: cleanText.trim(), bookingData, checkBookingNumber };
}

// Order status labels in Thai
const ORDER_STATUS_LABELS: Record<string, { label: string; emoji: string }> = {
  pending: { label: 'รอยืนยัน', emoji: '⏳' },
  confirmed: { label: 'ยืนยันแล้ว', emoji: '✅' },
  payment_confirmed: { label: 'ชำระเงินแล้ว', emoji: '💳' },
  shipped: { label: 'จัดส่งแล้ว', emoji: '🚚' },
  delivered: { label: 'จัดส่งสำเร็จ', emoji: '📦' },
  cancelled: { label: 'ยกเลิก', emoji: '❌' }
};

// Create receipt message for webchat
function createWebChatReceipt(orderNumber: string, orderData: OrderData): string {
  const itemsList = orderData.items.map(item => 
    `   • ${item.name} x${item.quantity} = ฿${(item.price * item.quantity).toLocaleString()}`
  ).join('\n');

  const subtotal = orderData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  let receipt = `\n\n🧾 **ใบเสร็จออเดอร์**\n`;
  receipt += `━━━━━━━━━━━━━━━━━━\n`;
  receipt += `📋 เลขที่: **${orderNumber}**\n`;
  receipt += `👤 ชื่อ: ${orderData.customerName}\n`;
  receipt += `📞 เบอร์: ${orderData.customerPhone}\n`;
  receipt += `📍 ที่อยู่: ${orderData.customerAddress}\n`;
  receipt += `━━━━━━━━━━━━━━━━━━\n`;
  receipt += `📦 **รายการสินค้า:**\n`;
  receipt += itemsList + '\n';
  receipt += `━━━━━━━━━━━━━━━━━━\n`;
  receipt += `💰 **ยอดรวม: ฿${subtotal.toLocaleString()}**\n`;
  receipt += `━━━━━━━━━━━━━━━━━━\n`;
  receipt += `\n💳 กรุณาโอนเงินและกดปุ่ม 📎 เพื่อแนบสลิปโอนเงินค่ะ`;
  
  return receipt;
}

export function useChat(options: UseChatOptions = { autoLoadHistory: true }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(options.conversationId || null);
  const [webUserId] = useState<string>(getOrCreateWebUserId);
  const [lastOrderNumber, setLastOrderNumber] = useState<string | null>(() => {
    return localStorage.getItem(LAST_ORDER_NUMBER_KEY);
  });
  const [lastOrderId, setLastOrderId] = useState<string | null>(() => {
    return localStorage.getItem(LAST_ORDER_ID_KEY);
  });

  // Load conversation from localStorage on mount
  useEffect(() => {
    if (options.autoLoadHistory !== false) {
      const savedConversationId = localStorage.getItem(CONVERSATION_STORAGE_KEY);
      if (savedConversationId) {
        loadMessages(savedConversationId);
      }
    }
  }, []);

  // Save conversationId to localStorage when it changes
  useEffect(() => {
    if (conversationId) {
      localStorage.setItem(CONVERSATION_STORAGE_KEY, conversationId);
    }
  }, [conversationId]);

  const createConversation = async (platform: string = 'web') => {
    // Generate ID on client so we don't need SELECT permission on this table
    const newId = crypto.randomUUID();

    const { error } = await supabase
      .from('chat_conversations')
      .insert({ id: newId, platform });

    if (error) {
      console.error('Error creating conversation:', error);
      return null;
    }

    setConversationId(newId);
    return newId;
  };

  const loadMessages = useCallback(async (convId: string) => {
    setIsLoadingHistory(true);
    
    // First verify the conversation exists
    const { data: conversation, error: convError } = await supabase
      .from('chat_conversations')
      .select('id')
      .eq('id', convId)
      .maybeSingle();

    if (convError || !conversation) {
      console.log('Conversation not found, starting fresh');
      localStorage.removeItem(CONVERSATION_STORAGE_KEY);
      setIsLoadingHistory(false);
      return;
    }

    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading messages:', error);
      setIsLoadingHistory(false);
      return;
    }

    if (data && data.length > 0) {
      setMessages(data as ChatMessage[]);
      setConversationId(convId);
    } else {
      // Conversation exists but has no messages, just set the ID
      setConversationId(convId);
    }
    
    setIsLoadingHistory(false);
  }, []);

  // Upload payment slip and analyze with AI
  const uploadPaymentSlip = useCallback(async (file: File, orderId: string, expectedAmount?: number): Promise<{ slipUrl: string | null; analysisResult?: any }> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${orderId}_${Date.now()}.${fileExt}`;
      const filePath = `${webUserId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('payment-slips')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Error uploading payment slip:', uploadError);
        return { slipUrl: null };
      }

      const { data: { publicUrl } } = supabase.storage
        .from('payment-slips')
        .getPublicUrl(filePath);

      // Create payment slip record
      const { data: slipRecord, error: insertError } = await supabase
        .from('payment_slips')
        .insert([{
          order_id: orderId,
          platform_user_id: webUserId,
          platform: 'web',
          image_url: publicUrl,
          status: 'pending'
        }])
        .select('id')
        .single();

      if (insertError) {
        console.error('Error creating payment slip record:', insertError);
        return { slipUrl: publicUrl };
      }

      // Analyze the slip with AI
      const analyzeUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-payment-slip`;
      
      // Get order data for verification and notification
      const { data: orderData } = await supabase
        .from('orders')
        .select('total_amount, order_number, customer_name')
        .eq('id', orderId)
        .single();

      const response = await fetch(analyzeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
        },
        body: JSON.stringify({
          image_url: publicUrl,
          expected_amount: expectedAmount || orderData?.total_amount,
          payment_slip_id: slipRecord?.id,
          order_id: orderId
        })
      });

      let analysisResult = null;
      if (response.ok) {
        analysisResult = await response.json();
        console.log('AI slip analysis result:', analysisResult);
      } else {
        console.error('Error analyzing slip:', await response.text());
      }

      // Create admin notification for new payment slip
      const notificationTitle = analysisResult?.auto_verified 
        ? 'สลิปโอนเงินได้รับการยืนยันอัตโนมัติ!' 
        : 'มีสลิปโอนเงินใหม่รอตรวจสอบ';
      
      let notificationMessage = `ออเดอร์ ${orderData?.order_number || orderId} จาก ${orderData?.customer_name || 'ลูกค้า'}\n`;
      notificationMessage += `ยอดออเดอร์: ฿${orderData?.total_amount?.toLocaleString() || '-'}`;
      
      if (analysisResult?.success) {
        notificationMessage += `\n\n🔍 ผลวิเคราะห์ AI:`;
        if (analysisResult.analyzed_amount) {
          notificationMessage += `\n💰 ยอดโอน: ฿${analysisResult.analyzed_amount.toLocaleString()}`;
        }
        if (analysisResult.analyzed_bank) {
          notificationMessage += `\n🏦 ธนาคาร: ${analysisResult.analyzed_bank}`;
        }
        notificationMessage += `\n📊 ความมั่นใจ: ${analysisResult.confidence_score}%`;
        
        if (analysisResult.auto_verified) {
          notificationMessage += `\n\n✅ ยืนยันอัตโนมัติสำเร็จ`;
        }
      }

      await supabase.from('admin_notifications').insert({
        type: analysisResult?.auto_verified ? 'payment_verified' : 'new_payment_slip',
        title: notificationTitle,
        message: notificationMessage,
        data: {
          order_id: orderId,
          order_number: orderData?.order_number,
          customer_name: orderData?.customer_name,
          slip_id: slipRecord?.id,
          analyzed_amount: analysisResult?.analyzed_amount,
          analyzed_bank: analysisResult?.analyzed_bank,
          confidence_score: analysisResult?.confidence_score,
          auto_verified: analysisResult?.auto_verified,
          image_url: publicUrl
        }
      });

      return { slipUrl: publicUrl, analysisResult };
    } catch (error) {
      console.error('Error in uploadPaymentSlip:', error);
      return { slipUrl: null };
    }
  }, [webUserId]);

  // Create order in database
  const createOrder = useCallback(async (orderData: OrderData): Promise<{ orderNumber: string; orderId: string } | null> => {
    try {
      const { data: orderResult, error: orderError } = await supabase
        .from('orders')
        .insert([{
          order_number: `ORD-${Date.now()}`,
          customer_name: orderData.customerName,
          customer_phone: orderData.customerPhone,
          customer_address: orderData.customerAddress,
          total_amount: orderData.totalAmount,
          platform: 'web'
        }])
        .select('id, order_number')
        .single();

      if (orderError) {
        console.error('Error creating order:', orderError);
        return null;
      }

      const createdOrderId = orderResult?.id;
      const orderNumber = orderResult?.order_number || `ORD-${Date.now()}`;

      // Insert order items
      const orderItems = orderData.items.map(item => ({
        order_id: createdOrderId,
        product_name: item.name,
        quantity: item.quantity,
        price: item.price
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) {
        console.error('Error creating order items:', itemsError);
      }

      setLastOrderNumber(orderNumber);
      setLastOrderId(createdOrderId);
      
      // Persist to localStorage
      localStorage.setItem(LAST_ORDER_NUMBER_KEY, orderNumber);
      localStorage.setItem(LAST_ORDER_ID_KEY, createdOrderId);
      
      return { orderNumber, orderId: createdOrderId };
    } catch (error) {
      console.error('Error in createOrder:', error);
      return null;
    }
  }, []);

  const sendMessage = useCallback(async (userMessage: string, imageFile?: File) => {
    setIsLoading(true);

    try {
      let currentConversationId = conversationId;
      if (!currentConversationId) {
        currentConversationId = await createConversation();
        if (!currentConversationId) {
          throw new Error('Failed to create conversation');
        }
      }

      // Handle payment slip upload
      if (imageFile && lastOrderId) {
        const { slipUrl, analysisResult } = await uploadPaymentSlip(imageFile, lastOrderId);
        if (slipUrl) {
          // Add user message about slip
          const slipMessage = userMessage || `ส่งสลิปโอนเงินสำหรับออเดอร์ ${lastOrderNumber}`;
          const userMsg: ChatMessage = {
            id: crypto.randomUUID(),
            conversation_id: currentConversationId,
            role: 'user',
            content: slipMessage,
            image_url: slipUrl,
            created_at: new Date().toISOString()
          };
          setMessages(prev => [...prev, userMsg]);

          // Save to database with image_url
          await supabase.from('chat_messages').insert({
            conversation_id: currentConversationId,
            role: 'user',
            content: slipMessage,
            image_url: slipUrl
          });

          // Build confirmation message based on AI analysis
          let confirmContent = `ได้รับสลิปโอนเงินเรียบร้อยแล้วค่ะ! 📸✨\n\nออเดอร์: ${lastOrderNumber}\n\n`;
          
          if (analysisResult?.success) {
            confirmContent += `🔍 **ผลการวิเคราะห์อัตโนมัติ:**\n`;
            if (analysisResult.analyzed_amount) {
              confirmContent += `💰 ยอดโอน: ฿${analysisResult.analyzed_amount.toLocaleString()}\n`;
            }
            if (analysisResult.analyzed_bank) {
              confirmContent += `🏦 ธนาคาร: ${analysisResult.analyzed_bank}\n`;
            }
            if (analysisResult.analyzed_date) {
              confirmContent += `📅 วันที่: ${analysisResult.analyzed_date}\n`;
            }
            confirmContent += `📊 ความมั่นใจ: ${analysisResult.confidence_score}%\n\n`;
            
            if (analysisResult.auto_verified) {
              confirmContent += `✅ **ยืนยันการชำระเงินอัตโนมัติสำเร็จ!**\n\nออเดอร์ของคุณได้รับการยืนยันแล้วค่ะ ทางร้านจะจัดส่งสินค้าให้เร็วที่สุดนะคะ 🚚💕`;
            } else {
              confirmContent += `⏳ ทางร้านจะตรวจสอบและยืนยันการชำระเงินให้เร็วที่สุดนะคะ ขอบคุณมากค่ะ! 🙏💕`;
            }
          } else {
            confirmContent += `⏳ ทางร้านจะตรวจสอบและยืนยันการชำระเงินให้เร็วที่สุดนะคะ ขอบคุณมากค่ะ! 🙏💕`;
          }

          const confirmMsg: ChatMessage = {
            id: crypto.randomUUID(),
            conversation_id: currentConversationId,
            role: 'assistant',
            content: confirmContent,
            created_at: new Date().toISOString()
          };
          setMessages(prev => [...prev, confirmMsg]);

          // Save confirmation to database
          await supabase.from('chat_messages').insert({
            conversation_id: currentConversationId,
            role: 'assistant',
            content: confirmMsg.content
          });

          setIsLoading(false);
          return;
        }
      } else if (imageFile && !lastOrderId) {
        // No order in localStorage, try to find a pending order for this user from database
        console.log('[WebChat] No lastOrderId, searching for pending orders...');
        
        const { data: pendingOrder, error: pendingOrderError } = await supabase
          .from('orders')
          .select('id, order_number, total_amount')
          .eq('platform', 'web')
          .in('status', ['pending', 'confirmed'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (pendingOrder && !pendingOrderError) {
          console.log('[WebChat] Found pending order:', pendingOrder.order_number);
          // Set this order as the current order
          setLastOrderId(pendingOrder.id);
          setLastOrderNumber(pendingOrder.order_number);
          localStorage.setItem(LAST_ORDER_ID_KEY, pendingOrder.id);
          localStorage.setItem(LAST_ORDER_NUMBER_KEY, pendingOrder.order_number);
          
          // Now upload the slip
          const { slipUrl, analysisResult } = await uploadPaymentSlip(imageFile, pendingOrder.id, pendingOrder.total_amount);
          if (slipUrl) {
            const slipMessage = userMessage || `ส่งสลิปโอนเงินสำหรับออเดอร์ ${pendingOrder.order_number}`;
            const userMsg: ChatMessage = {
              id: crypto.randomUUID(),
              conversation_id: currentConversationId,
              role: 'user',
              content: slipMessage,
              image_url: slipUrl,
              created_at: new Date().toISOString()
            };
            setMessages(prev => [...prev, userMsg]);

            await supabase.from('chat_messages').insert({
              conversation_id: currentConversationId,
              role: 'user',
              content: slipMessage,
              image_url: slipUrl
            });

            let confirmContent = `ได้รับสลิปโอนเงินเรียบร้อยแล้วค่ะ! 📸✨\n\nออเดอร์: ${pendingOrder.order_number}\n\n`;
            
            if (analysisResult?.success) {
              confirmContent += `🔍 **ผลการวิเคราะห์อัตโนมัติ:**\n`;
              if (analysisResult.analyzed_amount) {
                confirmContent += `💰 ยอดโอน: ฿${analysisResult.analyzed_amount.toLocaleString()}\n`;
              }
              if (analysisResult.analyzed_bank) {
                confirmContent += `🏦 ธนาคาร: ${analysisResult.analyzed_bank}\n`;
              }
              confirmContent += `📊 ความมั่นใจ: ${analysisResult.confidence_score}%\n\n`;
              
              if (analysisResult.auto_verified) {
                confirmContent += `✅ **ยืนยันการชำระเงินอัตโนมัติสำเร็จ!**\n\nออเดอร์ของคุณได้รับการยืนยันแล้วค่ะ ทางร้านจะจัดส่งสินค้าให้เร็วที่สุดนะคะ 🚚💕`;
              } else {
                confirmContent += `⏳ ทางร้านจะตรวจสอบและยืนยันการชำระเงินให้เร็วที่สุดนะคะ ขอบคุณมากค่ะ! 🙏💕`;
              }
            } else {
              confirmContent += `⏳ ทางร้านจะตรวจสอบและยืนยันการชำระเงินให้เร็วที่สุดนะคะ ขอบคุณมากค่ะ! 🙏💕`;
            }

            const confirmMsg: ChatMessage = {
              id: crypto.randomUUID(),
              conversation_id: currentConversationId,
              role: 'assistant',
              content: confirmContent,
              created_at: new Date().toISOString()
            };
            setMessages(prev => [...prev, confirmMsg]);

            await supabase.from('chat_messages').insert({
              conversation_id: currentConversationId,
              role: 'assistant',
              content: confirmContent
            });

            setIsLoading(false);
            return;
          }
        }
        
        // Still no order found - prompt to create one
        const userMsgContent = userMessage || 'ส่งสลิปโอนเงิน';
        const userMsg: ChatMessage = {
          id: crypto.randomUUID(),
          conversation_id: currentConversationId,
          role: 'user',
          content: userMsgContent,
          created_at: new Date().toISOString()
        };
        setMessages(prev => [...prev, userMsg]);

        await supabase.from('chat_messages').insert({
          conversation_id: currentConversationId,
          role: 'user',
          content: userMsgContent
        });

        const promptContent = 'ขออภัยค่ะ ยังไม่มีออเดอร์ที่รอชำระเงินค่ะ 😅\n\nรบกวนสั่งซื้อสินค้าก่อนนะคะ แล้วค่อยส่งสลิปโอนเงินมาได้เลยค่ะ! มีสินค้าอะไรที่สนใจไหมคะ? ✨';
        const promptMsg: ChatMessage = {
          id: crypto.randomUUID(),
          conversation_id: currentConversationId,
          role: 'assistant',
          content: promptContent,
          created_at: new Date().toISOString()
        };
        setMessages(prev => [...prev, promptMsg]);

        await supabase.from('chat_messages').insert({
          conversation_id: currentConversationId,
          role: 'assistant',
          content: promptContent
        });

        setIsLoading(false);
        return;
      }

      // Add user message to UI immediately
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        conversation_id: currentConversationId,
        role: 'user',
        content: userMessage,
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, userMsg]);

      // Save user message to database
      await supabase.from('chat_messages').insert({
        conversation_id: currentConversationId,
        role: 'user',
        content: userMessage
      });

      // Update conversation last message
      await supabase
        .from('chat_conversations')
        .update({
          last_message: userMessage,
          last_message_at: new Date().toISOString()
        })
        .eq('id', currentConversationId);

      // Get all messages for context (full conversation history)
      const { data: allMessages } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', currentConversationId)
        .order('created_at', { ascending: true });

      console.log(`Sending ${allMessages?.length || 0} messages as context to AI`);

      // Call AI edge function with full conversation history
      const chatUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
      const response = await fetch(chatUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
        },
        body: JSON.stringify({
          messages: allMessages?.map(m => ({
            role: m.role,
            content: m.content
          })) || [{ role: 'user', content: userMessage }],
          conversationId: currentConversationId,
          webUserId: webUserId
        })
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('ขณะนี้ระบบไม่ว่าง กรุณารอสักครู่แล้วลองใหม่');
        }
        if (response.status === 402) {
          throw new Error('เกิดข้อผิดพลาดในระบบ กรุณาติดต่อผู้ดูแล');
        }
        throw new Error('ไม่สามารถเชื่อมต่อกับ AI ได้');
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let assistantContent = '';
      let assistantMsgId = crypto.randomUUID();

      // Add assistant message placeholder
      setMessages(prev => [...prev, {
        id: assistantMsgId,
        conversation_id: currentConversationId,
        role: 'assistant',
        content: '',
        created_at: new Date().toISOString()
      }]);

      let textBuffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setMessages(prev => prev.map(m =>
                m.id === assistantMsgId ? { ...m, content: assistantContent } : m
              ));
            }
          } catch {
            // Incomplete JSON, will get more data
          }
        }
      }

      // Parse order command from the response
      const { cleanText: orderCleanText, orderData, checkOrderNumber } = parseOrderCommand(assistantContent);
      
      // Handle order status check
      if (checkOrderNumber) {
        console.log('[WebChat] Checking order status:', checkOrderNumber);
        const { data: orderInfo, error: orderFetchError } = await supabase
          .from('orders')
          .select('id, order_number, status, total_amount, tracking_number, created_at, customer_name')
          .eq('order_number', checkOrderNumber)
          .maybeSingle();

        if (orderInfo && !orderFetchError) {
          const statusInfo = ORDER_STATUS_LABELS[orderInfo.status] || { label: orderInfo.status, emoji: '📋' };
          let statusMessage = `\n\n📦 **ข้อมูลออเดอร์: ${orderInfo.order_number}**\n`;
          statusMessage += `${statusInfo.emoji} สถานะ: **${statusInfo.label}**\n`;
          statusMessage += `💰 ยอดรวม: ฿${orderInfo.total_amount?.toLocaleString()}\n`;
          statusMessage += `📅 วันที่สั่ง: ${new Date(orderInfo.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}\n`;
          
          if (orderInfo.tracking_number) {
            statusMessage += `🚚 เลขพัสดุ: **${orderInfo.tracking_number}**\n`;
          }
          
          if (orderInfo.status === 'pending') {
            statusMessage += `\n💳 หากยังไม่ได้ชำระเงิน กรุณาโอนเงินและกดปุ่ม 📎 เพื่อแนบสลิปค่ะ`;
          } else if (orderInfo.status === 'shipped' && orderInfo.tracking_number) {
            statusMessage += `\n📍 สามารถติดตามพัสดุได้ที่เว็บไซต์ขนส่งค่ะ`;
          }
          
          assistantContent = orderCleanText + statusMessage;
        } else {
          assistantContent = orderCleanText + `\n\n❌ ไม่พบออเดอร์หมายเลข ${checkOrderNumber} ค่ะ\nรบกวนตรวจสอบเลขที่ออเดอร์อีกครั้งนะคะ`;
        }
        
        setMessages(prev => prev.map(m =>
          m.id === assistantMsgId ? { ...m, content: assistantContent } : m
        ));
      }
      
      // Handle order creation
      if (orderData) {
        console.log('[WebChat] Creating order:', orderData);
        const orderResult = await createOrder(orderData);
        
        if (orderResult) {
          // Create receipt with order details
          const receiptMessage = createWebChatReceipt(orderResult.orderNumber, orderData);
          const orderConfirmation = `\n\n🎉 **สร้างออเดอร์สำเร็จ!**${receiptMessage}`;
          assistantContent = orderCleanText + orderConfirmation;
        } else {
          assistantContent = orderCleanText + '\n\n❌ ขออภัยค่ะ เกิดข้อผิดพลาดในการสร้างออเดอร์ กรุณาลองใหม่อีกครั้งนะคะ';
        }
        
        setMessages(prev => prev.map(m =>
          m.id === assistantMsgId ? { ...m, content: assistantContent } : m
        ));
      }

      // Parse address commands from the response
      const { cleanText, addressAction } = parseAddressCommands(orderData ? assistantContent : assistantContent);
      
      // Handle address actions
      if (addressAction) {
        console.log('[WebChat] Address action:', addressAction);
        
        if (addressAction.type === 'list') {
          const { data: addresses } = await supabase
            .from('customer_addresses')
            .select('*')
            .eq('platform_user_id', webUserId)
            .eq('platform', 'web')
            .order('is_default', { ascending: false });
          
          if (addresses && addresses.length > 0) {
            const addressList = addresses.map((a, i) => 
              `${i + 1}. ${a.label}: ${a.address}${a.is_default ? ' ⭐' : ''}`
            ).join('\n');
            // Append address list to the message
            const updatedContent = cleanText + '\n\n📍 ที่อยู่จัดส่งของคุณ:\n' + addressList;
            setMessages(prev => prev.map(m =>
              m.id === assistantMsgId ? { ...m, content: updatedContent } : m
            ));
            assistantContent = updatedContent;
          } else {
            const updatedContent = cleanText + '\n\n📍 ยังไม่มีที่อยู่จัดส่งที่บันทึกไว้';
            setMessages(prev => prev.map(m =>
              m.id === assistantMsgId ? { ...m, content: updatedContent } : m
            ));
            assistantContent = updatedContent;
          }
        } else if (addressAction.type === 'add' && addressAction.label && addressAction.address) {
          const { data: existing } = await supabase
            .from('customer_addresses')
            .select('id')
            .eq('platform_user_id', webUserId)
            .eq('platform', 'web')
            .eq('label', addressAction.label)
            .maybeSingle();
          
          if (existing) {
            await supabase
              .from('customer_addresses')
              .update({ address: addressAction.address, updated_at: new Date().toISOString() })
              .eq('id', existing.id);
          } else {
            const { count } = await supabase
              .from('customer_addresses')
              .select('*', { count: 'exact', head: true })
              .eq('platform_user_id', webUserId)
              .eq('platform', 'web');
            
            await supabase.from('customer_addresses').insert({
              platform_user_id: webUserId,
              platform: 'web',
              label: addressAction.label,
              address: addressAction.address,
              is_default: count === 0
            });
          }
          // Update message to show clean text
          setMessages(prev => prev.map(m =>
            m.id === assistantMsgId ? { ...m, content: cleanText } : m
          ));
          assistantContent = cleanText;
        } else if (addressAction.type === 'edit' && addressAction.label && addressAction.address) {
          const { data: existing } = await supabase
            .from('customer_addresses')
            .select('id')
            .eq('platform_user_id', webUserId)
            .eq('platform', 'web')
            .eq('label', addressAction.label)
            .maybeSingle();
          
          if (existing) {
            await supabase
              .from('customer_addresses')
              .update({ address: addressAction.address, updated_at: new Date().toISOString() })
              .eq('id', existing.id);
          }
          setMessages(prev => prev.map(m =>
            m.id === assistantMsgId ? { ...m, content: cleanText } : m
          ));
          assistantContent = cleanText;
        } else if (addressAction.type === 'delete' && addressAction.label) {
          await supabase
            .from('customer_addresses')
            .delete()
            .eq('platform_user_id', webUserId)
            .eq('platform', 'web')
            .eq('label', addressAction.label);
          
          setMessages(prev => prev.map(m =>
            m.id === assistantMsgId ? { ...m, content: cleanText } : m
          ));
          assistantContent = cleanText;
        } else if (addressAction.type === 'set_default' && addressAction.label) {
          // Clear all defaults first
          await supabase
            .from('customer_addresses')
            .update({ is_default: false })
            .eq('platform_user_id', webUserId)
            .eq('platform', 'web');
          // Set new default
          await supabase
            .from('customer_addresses')
            .update({ is_default: true })
            .eq('platform_user_id', webUserId)
            .eq('platform', 'web')
            .eq('label', addressAction.label);
          
          setMessages(prev => prev.map(m =>
            m.id === assistantMsgId ? { ...m, content: cleanText } : m
          ));
          assistantContent = cleanText;
        }
      }

      // Parse booking commands from the response
      const { cleanText: bookingCleanText, bookingData: bookingInfo, checkBookingNumber } = parseBookingCommand(assistantContent);

      if (checkBookingNumber) {
        console.log('[WebChat] Checking booking status:', checkBookingNumber);
        const { data: bookingRecord } = await supabase
          .from('bookings')
          .select('*')
          .eq('booking_number', checkBookingNumber)
          .maybeSingle();

        if (bookingRecord) {
          const statusMap: Record<string, string> = {
            pending: '⏳ รอยืนยัน',
            confirmed: '✅ ยืนยันแล้ว',
            completed: '🎉 เสร็จสิ้น',
            cancelled: '❌ ยกเลิก',
            no_show: '🚫 ไม่มา'
          };
          let bookingMsg = `\n\n📅 **ข้อมูลการจอง: ${bookingRecord.booking_number}**\n`;
          bookingMsg += `${statusMap[bookingRecord.status] || bookingRecord.status}\n`;
          bookingMsg += `📋 บริการ: ${bookingRecord.service_name}\n`;
          bookingMsg += `📆 วันที่: ${bookingRecord.booking_date}\n`;
          bookingMsg += `🕐 เวลา: ${bookingRecord.booking_time}\n`;
          bookingMsg += `👤 ชื่อ: ${bookingRecord.customer_name}\n`;
          if (bookingRecord.notes) bookingMsg += `📝 หมายเหตุ: ${bookingRecord.notes}\n`;
          assistantContent = bookingCleanText + bookingMsg;
        } else {
          assistantContent = bookingCleanText + `\n\n❌ ไม่พบการจองหมายเลข ${checkBookingNumber}`;
        }
        setMessages(prev => prev.map(m =>
          m.id === assistantMsgId ? { ...m, content: assistantContent } : m
        ));
      }

      if (bookingInfo) {
        console.log('[WebChat] Creating booking:', bookingInfo);
        
        // Find matching slot
        const { data: matchingSlot } = await supabase
          .from('booking_slots')
          .select('*')
          .eq('slot_date', bookingInfo.bookingDate)
          .eq('start_time', bookingInfo.bookingTime)
          .eq('is_available', true)
          .maybeSingle();

        // Check if auto-confirm is enabled
        const { data: bSettings } = await supabase
          .from('booking_settings')
          .select('auto_confirm')
          .limit(1)
          .maybeSingle();

        const status = bSettings?.auto_confirm ? 'confirmed' : 'pending';

        const { data: newBooking, error: bookingError } = await supabase
          .from('bookings')
          .insert({
            customer_name: bookingInfo.customerName,
            customer_phone: bookingInfo.customerPhone,
            booking_date: bookingInfo.bookingDate,
            booking_time: bookingInfo.bookingTime,
            service_name: bookingInfo.serviceName,
            notes: bookingInfo.notes || null,
            platform: 'web',
            slot_id: matchingSlot?.id || null,
            status,
            conversation_id: conversationId || null,
          })
          .select('booking_number')
          .single();

        if (newBooking && !bookingError) {
          let confirmMsg = `\n\n🎉 **จองสำเร็จ!**\n`;
          confirmMsg += `━━━━━━━━━━━━━━━━━━\n`;
          confirmMsg += `📋 เลขจอง: **${newBooking.booking_number}**\n`;
          confirmMsg += `👤 ชื่อ: ${bookingInfo.customerName}\n`;
          confirmMsg += `📞 เบอร์: ${bookingInfo.customerPhone}\n`;
          confirmMsg += `📆 วันที่: ${bookingInfo.bookingDate}\n`;
          confirmMsg += `🕐 เวลา: ${bookingInfo.bookingTime}\n`;
          confirmMsg += `📋 บริการ: ${bookingInfo.serviceName}\n`;
          if (bookingInfo.notes) confirmMsg += `📝 หมายเหตุ: ${bookingInfo.notes}\n`;
          confirmMsg += `━━━━━━━━━━━━━━━━━━\n`;
          confirmMsg += status === 'confirmed' 
            ? `✅ การจองยืนยันเรียบร้อยแล้ว!`
            : `⏳ การจองอยู่ระหว่างรอยืนยันจากทางร้าน`;
          assistantContent = bookingCleanText + confirmMsg;
        } else {
          assistantContent = bookingCleanText + '\n\n❌ ขออภัย เกิดข้อผิดพลาดในการจอง กรุณาลองใหม่';
        }
        setMessages(prev => prev.map(m =>
          m.id === assistantMsgId ? { ...m, content: assistantContent } : m
        ));
      }

      // Save assistant message to database (with cleaned text)
      await supabase.from('chat_messages').insert({
        conversation_id: currentConversationId,
        role: 'assistant',
        content: assistantContent
      });

      // Update conversation last message
      await supabase
        .from('chat_conversations')
        .update({
          last_message: assistantContent.slice(0, 100),
          last_message_at: new Date().toISOString()
        })
        .eq('id', currentConversationId);

    } catch (error) {
      console.error('Error sending message:', error);
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        conversation_id: conversationId || '',
        role: 'assistant',
        content: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, webUserId, lastOrderId, lastOrderNumber, createOrder, uploadPaymentSlip]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setLastOrderNumber(null);
    setLastOrderId(null);
    localStorage.removeItem(CONVERSATION_STORAGE_KEY);
    localStorage.removeItem(LAST_ORDER_ID_KEY);
    localStorage.removeItem(LAST_ORDER_NUMBER_KEY);
  }, []);

  // Check last order status
  const checkLastOrder = useCallback(async () => {
    if (!lastOrderId) {
      return null;
    }

    try {
      const { data: order, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items(product_name, quantity, price)
        `)
        .eq('id', lastOrderId)
        .single();

      if (error || !order) {
        console.error('Error fetching order:', error);
        return null;
      }

      // Build order status message
      const statusInfo = ORDER_STATUS_LABELS[order.status] || { label: order.status, emoji: '📋' };
      
      let orderMessage = `📋 **สถานะออเดอร์ล่าสุด**\n`;
      orderMessage += `━━━━━━━━━━━━━━━━━━\n`;
      orderMessage += `🔢 เลขที่: **${order.order_number}**\n`;
      orderMessage += `${statusInfo.emoji} สถานะ: **${statusInfo.label}**\n`;
      orderMessage += `━━━━━━━━━━━━━━━━━━\n`;
      orderMessage += `👤 ชื่อ: ${order.customer_name}\n`;
      orderMessage += `📞 เบอร์: ${order.customer_phone}\n`;
      orderMessage += `📍 ที่อยู่: ${order.customer_address}\n`;
      orderMessage += `━━━━━━━━━━━━━━━━━━\n`;
      orderMessage += `📦 **รายการสินค้า:**\n`;
      
      const items = order.order_items as { product_name: string; quantity: number; price: number }[] || [];
      items.forEach(item => {
        orderMessage += `   • ${item.product_name} x${item.quantity} = ฿${(Number(item.price) * item.quantity).toLocaleString()}\n`;
      });
      
      orderMessage += `━━━━━━━━━━━━━━━━━━\n`;
      orderMessage += `💰 **ยอดรวม: ฿${Number(order.total_amount).toLocaleString()}**\n`;

      if (order.tracking_number) {
        orderMessage += `━━━━━━━━━━━━━━━━━━\n`;
        orderMessage += `🚚 เลขพัสดุ: [COPY:${order.tracking_number}]\n`;
      }

      // Add the order status message to chat
      let currentConversationId = conversationId;
      if (!currentConversationId) {
        currentConversationId = await createConversation();
      }

      if (currentConversationId) {
        const statusMsg: ChatMessage = {
          id: crypto.randomUUID(),
          conversation_id: currentConversationId,
          role: 'assistant',
          content: orderMessage,
          created_at: new Date().toISOString()
        };
        setMessages(prev => [...prev, statusMsg]);

        // Save to database
        await supabase.from('chat_messages').insert({
          conversation_id: currentConversationId,
          role: 'assistant',
          content: orderMessage
        });
      }

      return order;
    } catch (error) {
      console.error('Error in checkLastOrder:', error);
      return null;
    }
  }, [lastOrderId, conversationId, createConversation]);

  return {
    messages,
    isLoading,
    isLoadingHistory,
    conversationId,
    lastOrderNumber,
    lastOrderId,
    sendMessage,
    loadMessages,
    clearChat,
    checkLastOrder
  };
}