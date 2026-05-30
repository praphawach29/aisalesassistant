import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { RefreshCw, Lock } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireSubscriptionFeature?: string;
}

export function ProtectedRoute({ children, requireSubscriptionFeature }: ProtectedRouteProps) {
  const { user, isAdmin, isLoading } = useAuth();
  const { hasFeature, isLoading: subLoading } = useSubscription();

  if (isLoading || subLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  if (requireSubscriptionFeature && !hasFeature(requireSubscriptionFeature)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 p-8">
          <Lock className="w-12 h-12 mx-auto text-muted-foreground" />
          <h2 className="text-xl font-semibold">ฟีเจอร์นี้ไม่พร้อมใช้งาน</h2>
          <p className="text-muted-foreground">กรุณาอัปเกรดแผนการสมัครสมาชิกเพื่อเข้าถึงฟีเจอร์นี้</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
