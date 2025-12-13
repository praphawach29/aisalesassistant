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
  MessageCircle, 
  RefreshCw,
  Search,
  User,
  Phone,
  Calendar,
  Clock
} from 'lucide-react';
import { ChatConversation, ChatMessage } from '@/types';

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

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/admin');
    }
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchConversations();
      
      // Subscribe to realtime updates
      const channel = supabase
        .channel('chats-admin-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'chat_conversations' },
          () => fetchConversations()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, isAdmin]);

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
        <Button variant="outline" size="icon" onClick={fetchConversations} disabled={isLoadingData} className="h-9 w-9 sm:h-10 sm:w-10 shrink-0">
          <RefreshCw className={`w-4 h-4 ${isLoadingData ? 'animate-spin' : ''}`} />
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
              <div className="space-y-1.5 sm:space-y-3 px-3 sm:px-4 lg:px-0 pb-4">
                {filteredConversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    onClick={() => openConversationDetail(conversation)}
                    className="flex items-center gap-2 sm:gap-4 p-2 sm:p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    {/* Platform Icon */}
                    <div className="text-lg sm:text-2xl flex-shrink-0">
                      {getPlatformIcon(conversation.platform)}
                    </div>

                    {/* Conversation Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <span className="font-medium text-xs sm:text-sm truncate max-w-[120px] sm:max-w-none">
                          {conversation.customer_name || 'ไม่ระบุชื่อ'}
                        </span>
                        <Badge variant="outline" className="text-[10px] sm:text-xs px-1 sm:px-2 hidden sm:inline-flex">
                          {getPlatformLabel(conversation.platform)}
                        </Badge>
                      </div>
                      {conversation.customer_phone && (
                        <div className="hidden sm:flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                          <Phone className="w-3 h-3" />
                          {conversation.customer_phone}
                        </div>
                      )}
                      {conversation.last_message && (
                        <p className="text-[10px] sm:text-sm text-muted-foreground mt-0.5 sm:mt-1 truncate">
                          {conversation.last_message}
                        </p>
                      )}
                    </div>

                    {/* Time */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">
                        {getTimeAgo(conversation.last_message_at)}
                      </p>
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
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
                    <span>{selectedConversation.customer_name || 'ไม่ระบุชื่อ'}</span>
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
            </div>
          )}
        </SheetContent>
      </Sheet>
    </AdminLayout>
  );
}
