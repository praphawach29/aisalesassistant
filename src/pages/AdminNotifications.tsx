import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bell,
  RefreshCw,
  ShoppingCart,
  Package,
  AlertTriangle,
  Check,
  Trash2,
  CheckCheck
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';

export default function AdminNotifications() {
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold">{notifications.length}</p>
              <p className="text-sm text-muted-foreground">ทั้งหมด</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{unreadCount}</p>
              <p className="text-sm text-muted-foreground">ยังไม่อ่าน</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {notifications.filter(n => n.type === 'new_order').length}
              </p>
              <p className="text-sm text-muted-foreground">ออเดอร์ใหม่</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">
                {notifications.filter(n => n.type === 'low_stock' || n.type === 'out_of_stock').length}
              </p>
              <p className="text-sm text-muted-foreground">สต็อก</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={refetch}
          disabled={isLoadingNotifications}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoadingNotifications ? 'animate-spin' : ''}`} />
          รีเฟรช
        </Button>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllAsRead}>
            <CheckCheck className="w-4 h-4 mr-2" />
            อ่านทั้งหมด
          </Button>
        )}
      </div>

      {/* Notifications List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            ประวัติการแจ้งเตือน
          </CardTitle>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>ยังไม่มีการแจ้งเตือน</p>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-3">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`flex items-start gap-4 p-4 rounded-lg border transition-colors cursor-pointer hover:bg-muted/50 ${
                      !notification.is_read ? 'bg-primary/5 border-primary/20' : 'bg-card'
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    {/* Icon */}
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      {getNotificationIcon(notification.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {getNotificationBadge(notification.type)}
                        {!notification.is_read && (
                          <span className="w-2 h-2 rounded-full bg-primary" />
                        )}
                      </div>
                      <h4 className="font-medium">{notification.title}</h4>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true,
                          locale: th
                        })}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1 flex-shrink-0">
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
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
