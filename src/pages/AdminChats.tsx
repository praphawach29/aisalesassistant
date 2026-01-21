import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  MessageCircle, 
  RefreshCw,
  Search,
  User,
  Phone,
  Calendar,
  Clock,
  Trash2,
  UserCheck,
  Bot,
  UserCog,
  Send,
  Zap,
  ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';
import { ChatConversation, ChatMessage } from '@/types';
import { Textarea } from '@/components/ui/textarea';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface MessageTemplate {
  id: string;
  name: string;
  content: string;
  category: string | null;
}

export default function AdminChats() {
  const { user, isAdmin, isLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [selectedConversation, setSelectedConversation] = useState<ChatConversation | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<ChatConversation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingNames, setIsUpdatingNames] = useState(false);
  const [adminMessage, setAdminMessage] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isTogglingTakeover, setIsTogglingTakeover] = useState(false);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [isTemplatePopoverOpen, setIsTemplatePopoverOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/admin');
    }
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchConversations();
      
      // Subscribe to realtime updates for conversations
      const conversationsChannel = supabase
        .channel('chats-admin-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'chat_conversations' },
          () => fetchConversations()
        )
        .subscribe();
      
      // Subscribe to realtime updates for messages
      const messagesChannel = supabase
        .channel('chats-messages-changes')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'chat_messages' },
          (payload) => {
            // If viewing a conversation and new message arrives, refresh messages
            if (selectedConversation && payload.new && 
                (payload.new as any).conversation_id === selectedConversation.id) {
              fetchMessages(selectedConversation.id);
            }
            // Also refresh conversations to update last_message
            fetchConversations();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(conversationsChannel);
        supabase.removeChannel(messagesChannel);
      };
    }
  }, [user, isAdmin, selectedConversation?.id]);

  // Fetch message templates
  useEffect(() => {
    const fetchTemplates = async () => {
      const { data } = await supabase
        .from('message_templates')
        .select('id, name, content, category')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      
      if (data) {
        setTemplates(data);
      }
    };
    fetchTemplates();
  }, []);

  const fetchConversations = async () => {
    setIsLoadingData(true);
    
    const { data, error } = await supabase
      .from('chat_conversations')
      .select('*')
      .order('last_message_at', { ascending: false });

    if (error) {
      console.error('Error fetching conversations:', error);
    } else {
      const typedConversations = (data || []).map(conv => ({
        ...conv,
        platform: conv.platform as 'web' | 'line' | 'facebook'
      }));
      setConversations(typedConversations);
    }
    
    setIsLoadingData(false);
  };

  const fetchMessages = async (conversationId: string) => {
    setIsLoadingMessages(true);
    
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
    } else {
      setMessages(data as ChatMessage[] || []);
    }
    
    setIsLoadingMessages(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin');
  };

  const openConversationDetail = async (conversation: ChatConversation) => {
    setSelectedConversation(conversation);
    setIsDetailOpen(true);
    await fetchMessages(conversation.id);
  };

  const handleDeleteConversation = async () => {
    if (!conversationToDelete) return;
    
    setIsDeleting(true);
    try {
      // Delete messages first (due to foreign key)
      const { error: messagesError } = await supabase
        .from('chat_messages')
        .delete()
        .eq('conversation_id', conversationToDelete.id);
      
      if (messagesError) throw messagesError;
      
      // Delete shopping cart items related to this conversation
      await supabase
        .from('shopping_carts')
        .delete()
        .eq('conversation_id', conversationToDelete.id);
      
      // Delete the conversation
      const { error: convError } = await supabase
        .from('chat_conversations')
        .delete()
        .eq('id', conversationToDelete.id);
      
      if (convError) throw convError;
      
      toast.success('ลบการสนทนาเรียบร้อยแล้ว');
      
      // Close sheet if deleting currently viewed conversation
      if (selectedConversation?.id === conversationToDelete.id) {
        setIsDetailOpen(false);
        setSelectedConversation(null);
      }
      
      fetchConversations();
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast.error('เกิดข้อผิดพลาดในการลบการสนทนา');
    } finally {
      setIsDeleting(false);
      setConversationToDelete(null);
    }
  };

  const handleUpdateCustomerNames = async () => {
    setIsUpdatingNames(true);
    try {
      const { data, error } = await supabase.functions.invoke('update-customer-names', {
        body: {}
      });

      if (error) throw error;

      if (data.updated > 0) {
        toast.success(`อัปเดตชื่อลูกค้าแล้ว ${data.updated} รายการ`);
        fetchConversations();
      } else {
        toast.info('ไม่มีการสนทนาที่ต้องอัปเดตชื่อ');
      }
    } catch (error) {
      console.error('Error updating customer names:', error);
      toast.error('เกิดข้อผิดพลาดในการอัปเดตชื่อลูกค้า');
    } finally {
      setIsUpdatingNames(false);
    }
  };

  const handleToggleTakeover = async (takeover: boolean) => {
    if (!selectedConversation || !user) return;
    
    setIsTogglingTakeover(true);
    try {
      const { error } = await supabase
        .from('chat_conversations')
        .update({
          is_human_takeover: takeover,
          assigned_admin_id: takeover ? user.id : null,
          takeover_at: takeover ? new Date().toISOString() : null
        })
        .eq('id', selectedConversation.id);
      
      if (error) throw error;
      
      // Update local state
      setSelectedConversation({
        ...selectedConversation,
        is_human_takeover: takeover,
        assigned_admin_id: takeover ? user.id : null,
        takeover_at: takeover ? new Date().toISOString() : null
      });
      
      toast.success(takeover ? 'เข้าร่วมแชทเรียบร้อย คุณสามารถตอบข้อความได้แล้ว' : 'คืนให้บอทเรียบร้อย AI จะตอบข้อความต่อไป');
      fetchConversations();
    } catch (error) {
      console.error('Error toggling takeover:', error);
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setIsTogglingTakeover(false);
    }
  };

  const handleSendAdminMessage = async () => {
    if (!selectedConversation || !user || !adminMessage.trim()) return;
    
    setIsSendingMessage(true);
    try {
      // Insert message to chat_messages
      const { error: msgError } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: selectedConversation.id,
          role: 'assistant',
          content: adminMessage.trim()
        });
      
      if (msgError) throw msgError;

      // Update conversation last message
      await supabase
        .from('chat_conversations')
        .update({
          last_message: adminMessage.trim(),
          last_message_at: new Date().toISOString()
        })
        .eq('id', selectedConversation.id);
      
      toast.success('ส่งข้อความเรียบร้อย');
      setAdminMessage('');
      
      // Refresh messages
      await fetchMessages(selectedConversation.id);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('เกิดข้อผิดพลาดในการส่งข้อความ');
    } finally {
      setIsSendingMessage(false);
    }
  };

  const confirmDeleteConversation = (e: React.MouseEvent, conversation: ChatConversation) => {
    e.stopPropagation();
    setConversationToDelete(conversation);
  };

  const getPlatformIcon = (platform: ChatConversation['platform']) => {
    switch (platform) {
      case 'line': return '🟢';
      case 'facebook': return '🔵';
      default: return '🌐';
    }
  };

  const getPlatformLabel = (platform: ChatConversation['platform']) => {
    switch (platform) {
      case 'line': return 'LINE';
      case 'facebook': return 'Facebook';
      default: return 'Web';
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTimeAgo = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'เมื่อสักครู่';
    if (diffMins < 60) return `${diffMins} นาทีที่แล้ว`;
    if (diffHours < 24) return `${diffHours} ชม.ที่แล้ว`;
    if (diffDays < 7) return `${diffDays} วันที่แล้ว`;
    return formatDate(dateString);
  };

  const filteredConversations = conversations.filter(conv => {
    const matchesSearch = 
      conv.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.customer_phone?.includes(searchQuery) ||
      conv.last_message?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.platform_user_id?.includes(searchQuery);
    
    const matchesPlatform = platformFilter === 'all' || conv.platform === platformFilter;
    
    return matchesSearch && matchesPlatform;
  });

  const stats = {
    total: conversations.length,
    web: conversations.filter(c => c.platform === 'web').length,
    line: conversations.filter(c => c.platform === 'line').length,
    facebook: conversations.filter(c => c.platform === 'facebook').length,
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin && !isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="w-8 h-8 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
            <p className="text-muted-foreground mb-4">
              คุณยังไม่ได้รับสิทธิ์ Admin กรุณาติดต่อผู้ดูแลระบบ
            </p>
            <Button onClick={handleSignOut} variant="outline">
              ออกจากระบบ
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <AdminLayout title="ประวัติการสนทนา">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
        <Card>
          <CardContent className="p-2 sm:p-4 sm:pt-6">
            <div className="text-center">
              <p className="text-lg sm:text-2xl font-bold">{stats.total}</p>
              <p className="text-[10px] sm:text-sm text-muted-foreground">ทั้งหมด</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-2 sm:p-4 sm:pt-6">
            <div className="text-center">
              <p className="text-lg sm:text-2xl font-bold">{stats.web}</p>
              <p className="text-[10px] sm:text-sm text-muted-foreground">🌐 Web</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-2 sm:p-4 sm:pt-6">
            <div className="text-center">
              <p className="text-lg sm:text-2xl font-bold text-green-600">{stats.line}</p>
              <p className="text-[10px] sm:text-sm text-muted-foreground">🟢 LINE</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-2 sm:p-4 sm:pt-6">
            <div className="text-center">
              <p className="text-lg sm:text-2xl font-bold text-blue-600">{stats.facebook}</p>
              <p className="text-[10px] sm:text-sm text-muted-foreground">🔵 FB</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2 sm:gap-4 mb-4 sm:mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="ค้นหา..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-9 sm:h-10"
          />
        </div>
        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="w-[100px] sm:w-[180px] h-9 sm:h-10">
            <SelectValue placeholder="ทั้งหมด" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทั้งหมด</SelectItem>
            <SelectItem value="web">🌐 Web</SelectItem>
            <SelectItem value="line">🟢 LINE</SelectItem>
            <SelectItem value="facebook">🔵 Facebook</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={fetchConversations} disabled={isLoadingData} className="h-9 w-9 sm:h-10 sm:w-10 shrink-0" title="รีเฟรช">
          <RefreshCw className={`w-4 h-4 ${isLoadingData ? 'animate-spin' : ''}`} />
        </Button>
        <Button 
          variant="outline" 
          size="icon" 
          onClick={handleUpdateCustomerNames} 
          disabled={isUpdatingNames} 
          className="h-9 w-9 sm:h-10 sm:w-10 shrink-0"
          title="อัปเดตชื่อลูกค้า"
        >
          <UserCheck className={`w-4 h-4 ${isUpdatingNames ? 'animate-pulse' : ''}`} />
        </Button>
      </div>

      {/* Conversations List */}
      <Card>
        <CardHeader className="py-3 px-3 sm:px-6 sm:py-4">
          <CardTitle className="text-sm sm:text-base lg:text-lg">รายการสนทนา ({filteredConversations.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-4 lg:p-6 lg:pt-0">
          {filteredConversations.length === 0 ? (
            <div className="text-center py-8 sm:py-12 text-muted-foreground">
              <MessageCircle className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 opacity-50" />
              <p className="text-sm sm:text-base">{searchQuery || platformFilter !== 'all' ? 'ไม่พบการสนทนาที่ค้นหา' : 'ยังไม่มีการสนทนา'}</p>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-320px)] sm:h-[calc(100vh-340px)]">
              <div className="space-y-1.5 sm:space-y-3 px-2 sm:px-4 lg:px-0 pb-4">
                {filteredConversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    onClick={() => openConversationDetail(conversation)}
                    className="flex items-start gap-2 sm:gap-4 p-2 sm:p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer overflow-hidden group"
                  >
                    {/* Platform Icon */}
                    <div className="text-base sm:text-2xl flex-shrink-0 pt-0.5">
                      {getPlatformIcon(conversation.platform)}
                    </div>

                    {/* Conversation Info */}
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="font-medium text-xs sm:text-sm truncate">
                          {conversation.customer_name || 'ไม่ระบุชื่อ'}
                        </span>
                        <Badge variant="outline" className="text-[10px] sm:text-xs px-1 sm:px-2 hidden sm:inline-flex flex-shrink-0">
                          {getPlatformLabel(conversation.platform)}
                        </Badge>
                        {/* Takeover indicator */}
                        {conversation.is_human_takeover && (
                          <Badge className="bg-green-500 text-white text-[10px] px-1 hidden sm:inline-flex flex-shrink-0">
                            <UserCog className="w-2.5 h-2.5 mr-0.5" />
                            แอดมิน
                          </Badge>
                        )}
                        <span className="text-[10px] sm:hidden text-muted-foreground flex-shrink-0 ml-auto">
                          {getTimeAgo(conversation.last_message_at)}
                        </span>
                      </div>
                      {conversation.customer_phone && (
                        <div className="hidden sm:flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                          <Phone className="w-3 h-3" />
                          {conversation.customer_phone}
                        </div>
                      )}
                      {conversation.last_message && (
                        <p className="text-[10px] sm:text-sm text-muted-foreground mt-0.5 sm:mt-1 line-clamp-2 break-words">
                          {conversation.last_message}
                        </p>
                      )}
                    </div>

                    {/* Time & Delete */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-muted-foreground whitespace-nowrap">
                          {getTimeAgo(conversation.last_message_at)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 sm:h-8 sm:w-8 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => confirmDeleteConversation(e, conversation)}
                      >
                        <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
      

      {/* Conversation Detail Sheet */}
      <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-hidden flex flex-col p-4 sm:p-6">
          <SheetHeader className="pb-2">
            <SheetTitle className="flex items-center gap-2 text-base sm:text-lg">
              <span className="text-base sm:text-lg">{selectedConversation && getPlatformIcon(selectedConversation.platform)}</span>
              <span>ประวัติการสนทนา</span>
            </SheetTitle>
          </SheetHeader>
          
          {selectedConversation && (
            <div className="flex-1 flex flex-col overflow-hidden mt-2 sm:mt-4">
              {/* Customer Info */}
              <Card className="flex-shrink-0 mb-3 sm:mb-4">
                <CardContent className="p-3 sm:pt-4 sm:p-4 space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
                      <span>{selectedConversation.customer_name || 'ไม่ระบุชื่อ'}</span>
                    </div>
                    {/* Takeover Status Badge */}
                    {selectedConversation.is_human_takeover ? (
                      <Badge className="bg-green-500 text-white">
                        <UserCog className="w-3 h-3 mr-1" />
                        แอดมินดูแล
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <Bot className="w-3 h-3 mr-1" />
                        AI ดูแล
                      </Badge>
                    )}
                  </div>
                  {selectedConversation.customer_phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
                      <span>{selectedConversation.customer_phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
                    <span className="truncate">เริ่ม: {formatDate(selectedConversation.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
                    <span className="truncate">ล่าสุด: {formatDate(selectedConversation.last_message_at)}</span>
                  </div>
                  
                  {/* Takeover Toggle Button */}
                  <div className="pt-2 border-t">
                    {selectedConversation.is_human_takeover ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-2"
                        onClick={() => handleToggleTakeover(false)}
                        disabled={isTogglingTakeover}
                      >
                        {isTogglingTakeover ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Bot className="w-4 h-4" />
                        )}
                        คืนให้บอท AI ดูแล
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="w-full gap-2"
                        onClick={() => handleToggleTakeover(true)}
                        disabled={isTogglingTakeover}
                      >
                        {isTogglingTakeover ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <UserCog className="w-4 h-4" />
                        )}
                        เข้ามาตอบแชทเอง
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Messages */}
              <div className="flex-1 overflow-hidden">
                <p className="text-xs sm:text-sm font-medium mb-2">ข้อความ ({messages.length})</p>
                <ScrollArea className="h-[calc(100vh-380px)] sm:h-[400px] pr-2 sm:pr-4">
                  {isLoadingMessages ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="w-5 h-5 sm:w-6 sm:h-6 animate-spin text-primary" />
                    </div>
                  ) : messages.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8 text-sm">ไม่มีข้อความ</p>
                  ) : (
                    <div className="space-y-2 sm:space-y-3">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl px-3 py-1.5 sm:px-4 sm:py-2 ${
                              message.role === 'user'
                                ? 'bg-primary text-primary-foreground rounded-br-md'
                                : 'bg-muted rounded-bl-md'
                            }`}
                          >
                            <p className="text-xs sm:text-sm whitespace-pre-wrap break-words">{message.content}</p>
                            <p className={`text-[10px] sm:text-xs mt-0.5 sm:mt-1 ${
                              message.role === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                            }`}>
                              {new Date(message.created_at).toLocaleTimeString('th-TH', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>

              {/* Admin Message Input - Only show when in takeover mode */}
              {selectedConversation.is_human_takeover && (
                <div className="pt-3 border-t mt-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium flex items-center gap-1.5">
                      <UserCog className="w-3.5 h-3.5" />
                      ตอบข้อความในฐานะแอดมิน
                    </p>
                    
                    {/* Quick Reply Templates Popover */}
                    <Popover open={isTemplatePopoverOpen} onOpenChange={setIsTemplatePopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
                          <Zap className="w-3 h-3" />
                          ข้อความด่วน
                          <ChevronDown className="w-3 h-3" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-2" align="end">
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground px-2 py-1">
                            เลือกข้อความเทมเพลต
                          </p>
                          <ScrollArea className="h-[200px]">
                            {templates.length === 0 ? (
                              <p className="text-xs text-muted-foreground text-center py-4">
                                ยังไม่มีเทมเพลต
                              </p>
                            ) : (
                              <div className="space-y-1">
                                {templates.map((template) => (
                                  <button
                                    key={template.id}
                                    onClick={() => {
                                      setAdminMessage(template.content);
                                      setIsTemplatePopoverOpen(false);
                                    }}
                                    className="w-full text-left p-2 rounded-md hover:bg-muted transition-colors"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-medium">{template.name}</span>
                                      {template.category && (
                                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                          {template.category}
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">
                                      {template.content}
                                    </p>
                                  </button>
                                ))}
                              </div>
                            )}
                          </ScrollArea>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="พิมพ์ข้อความตอบลูกค้า..."
                      value={adminMessage}
                      onChange={(e) => setAdminMessage(e.target.value)}
                      className="min-h-[60px] text-sm resize-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendAdminMessage();
                        }
                      }}
                    />
                    <Button
                      size="icon"
                      className="h-[60px] w-10 shrink-0"
                      onClick={handleSendAdminMessage}
                      disabled={isSendingMessage || !adminMessage.trim()}
                    >
                      {isSendingMessage ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Delete Button in Sheet */}
              <div className="pt-3 sm:pt-4 border-t mt-3 sm:mt-4">
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={(e) => {
                    if (selectedConversation) {
                      confirmDeleteConversation(e, selectedConversation);
                    }
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  ลบการสนทนานี้
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!conversationToDelete} onOpenChange={(open) => !open && setConversationToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบการสนทนา</AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการลบการสนทนากับ "{conversationToDelete?.customer_name || 'ไม่ระบุชื่อ'}" ใช่หรือไม่? 
              ข้อความทั้งหมดจะถูกลบถาวรและไม่สามารถกู้คืนได้ 
              <span className="block mt-2 font-medium text-foreground">
                ⚠️ บอทจะไม่จำบทสนทนาเก่าได้อีกต่อไป
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConversation}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  กำลังลบ...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  ลบการสนทนา
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
