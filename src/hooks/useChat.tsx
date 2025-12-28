import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ChatMessage } from '@/types';

const CONVERSATION_STORAGE_KEY = 'chat_conversation_id';
const WEB_USER_ID_KEY = 'chat_web_user_id';

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

export function useChat(options: UseChatOptions = { autoLoadHistory: true }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(options.conversationId || null);
  const [webUserId] = useState<string>(getOrCreateWebUserId);

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

  const sendMessage = useCallback(async (userMessage: string) => {
    setIsLoading(true);

    try {
      let currentConversationId = conversationId;
      if (!currentConversationId) {
        currentConversationId = await createConversation();
        if (!currentConversationId) {
          throw new Error('Failed to create conversation');
        }
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

      // Parse address commands from the response
      const { cleanText, addressAction } = parseAddressCommands(assistantContent);
      
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
  }, [conversationId, webUserId]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    localStorage.removeItem(CONVERSATION_STORAGE_KEY);
  }, []);

  return {
    messages,
    isLoading,
    isLoadingHistory,
    conversationId,
    sendMessage,
    loadMessages,
    clearChat
  };
}
