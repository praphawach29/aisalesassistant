import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  Bell,
  RefreshCw,
  ShoppingCart,
  Package,
  AlertTriangle,
  Check,
  Trash2,
  CheckCheck,
  Filter
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';

const typeOptions = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'new_order', label: 'ออเดอร์ใหม่' },
  { value: 'low_stock', label: 'สินค้าใกล้หมด' },
  { value: 'out_of_stock', label: 'สินค้าหมด' },
];

export default function AdminNotifications() {
  const [typeFilter, setTypeFilter] = useState('all');
  const [readFilter, setReadFilter] = useState('all');
  const { user, isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    isLoading: isLoadingNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refetch
  } = useNotifications();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/admin');
    }
  }, [user, isLoading, navigate]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'new_order':
        return <ShoppingCart className="w-5 h-5 text-primary" />;
      case 'low_stock':
        return <Package className="w-5 h-5 text-yellow-500" />;
      case 'out_of_stock':
        return <AlertTriangle className="w-5 h-5 text-destructive" />;
      default:
        return <Bell className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getNotificationBadge = (type: string) => {
    switch (type) {
      case 'new_order':
        return <Badge variant="default">ออเดอร์ใหม่</Badge>;
      case 'low_stock':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">สินค้าใกล้หมด</Badge>;
      case 'out_of_stock':
        return <Badge variant="destructive">สินค้าหมด</Badge>;
      default:
        return <Badge variant="outline">แจ้งเตือน</Badge>;
    }
  };

  const handleNotificationClick = (notification: typeof notifications[0]) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }

    // Navigate based on notification type
    if (notification.type === 'new_order' && notification.data?.order_id) {
      navigate('/admin/orders');
    } else if ((notification.type === 'low_stock' || notification.type === 'out_of_stock') && notification.data?.product_id) {
      navigate('/admin/products');
    }
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
              <Bell className="w-8 h-8 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
            <p className="text-muted-foreground">
              คุณยังไม่ได้รับสิทธิ์ Admin กรุณาติดต่อผู้ดูแลระบบ
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <AdminLayout title="การแจ้งเตือน">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
        <Card>
          <CardContent className="p-3 sm:pt-6">
            <div className="text-center">
              <p className="text-xl sm:text-2xl font-bold">{notifications.length}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">ทั้งหมด</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:pt-6">
            <div className="text-center">
              <p className="text-xl sm:text-2xl font-bold text-primary">{unreadCount}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">ยังไม่อ่าน</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:pt-6">
            <div className="text-center">
              <p className="text-xl sm:text-2xl font-bold text-green-600">
                {notifications.filter(n => n.type === 'new_order').length}
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground">ออเดอร์ใหม่</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:pt-6">
            <div className="text-center">
              <p className="text-xl sm:text-2xl font-bold text-yellow-600">
                {notifications.filter(n => n.type === 'low_stock' || n.type === 'out_of_stock').length}
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground">สต็อก</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Actions */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-4 sm:mb-6">
        <div className="flex gap-2 flex-1">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="flex-1 sm:w-[180px] h-9 sm:h-10">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="ประเภท" />
            </SelectTrigger>
            <SelectContent>
              {typeOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={readFilter} onValueChange={setReadFilter}>
            <SelectTrigger className="flex-1 sm:w-[150px] h-9 sm:h-10">
              <SelectValue placeholder="สถานะ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทั้งหมด</SelectItem>
              <SelectItem value="unread">ยังไม่อ่าน</SelectItem>
              <SelectItem value="read">อ่านแล้ว</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refetch}
            disabled={isLoadingNotifications}
            className="h-9 sm:h-10 flex-1 sm:flex-none"
          >
            <RefreshCw className={`w-4 h-4 sm:mr-2 ${isLoadingNotifications ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">รีเฟรช</span>
          </Button>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllAsRead} className="h-9 sm:h-10 flex-1 sm:flex-none">
              <CheckCheck className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">อ่านทั้งหมด</span>
            </Button>
          )}
        </div>
      </div>

      {/* Filtered Notifications */}
      {(() => {
        const filteredNotifications = notifications.filter(n => {
          const matchesType = typeFilter === 'all' || n.type === typeFilter;
          const matchesRead = readFilter === 'all' || 
            (readFilter === 'unread' && !n.is_read) || 
            (readFilter === 'read' && n.is_read);
          return matchesType && matchesRead;
        });

        return (
          <Card>
            <CardHeader className="py-3 sm:py-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                ประวัติการแจ้งเตือน ({filteredNotifications.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-6 pt-0 sm:pt-0">
              {filteredNotifications.length === 0 ? (
                <div className="text-center py-8 sm:py-12 text-muted-foreground">
                  <Bell className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 opacity-50" />
                  <p className="text-sm sm:text-base">{notifications.length === 0 ? 'ยังไม่มีการแจ้งเตือน' : 'ไม่พบการแจ้งเตือนที่ตรงกับตัวกรอง'}</p>
                </div>
              ) : (
                <ScrollArea className="h-[calc(100vh-380px)] sm:h-[600px]">
                  <div className="space-y-2 sm:space-y-3">
                    {filteredNotifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`p-3 sm:p-4 rounded-lg border transition-colors cursor-pointer hover:bg-muted/50 ${
                          !notification.is_read ? 'bg-primary/5 border-primary/20' : 'bg-card'
                        }`}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <div className="flex items-start gap-3 sm:gap-4">
                          {/* Icon - hidden on mobile */}
                          <div className="hidden sm:flex flex-shrink-0 w-10 h-10 rounded-full bg-muted items-center justify-center">
                            {getNotificationIcon(notification.type)}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                {getNotificationBadge(notification.type)}
                                {!notification.is_read && (
                                  <span className="w-2 h-2 rounded-full bg-primary" />
                                )}
                              </div>
                              {/* Actions - mobile: top right */}
                              <div className="flex gap-1 sm:hidden flex-shrink-0">
                                {!notification.is_read && (
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      markAsRead(notification.id);
                                    }}
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteNotification(notification.id);
                                  }}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>
                            <h4 className="font-medium text-sm sm:text-base">{notification.title}</h4>
                            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                              {notification.message}
                            </p>
                            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1.5 sm:mt-2">
                              {formatDistanceToNow(new Date(notification.created_at), {
                                addSuffix: true,
                                locale: th
                              })}
                            </p>
                          </div>

                          {/* Actions - desktop: right side */}
                          <div className="hidden sm:flex gap-1 flex-shrink-0">
                            {!notification.is_read && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markAsRead(notification.id);
                                }}
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNotification(notification.id);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        );
      })()}
    </AdminLayout>
  );
}
