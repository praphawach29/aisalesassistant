import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
}

// Generate or get session ID for error tracking
function getSessionId(): string {
  let sessionId = sessionStorage.getItem('error_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('error_session_id', sessionId);
  }
  return sessionId;
}

// Log error to backend
async function logErrorToBackend(error: Error, errorInfo: ErrorInfo): Promise<string | null> {
  try {
    const { data, error: fetchError } = await supabase.functions.invoke('log-error', {
      body: {
        error_type: 'frontend',
        error_message: error.message,
        error_stack: error.stack,
        context: {
          componentStack: errorInfo.componentStack,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight
          }
        },
        source: 'ErrorBoundary',
        url: window.location.href,
        session_id: getSessionId(),
        severity: 'error'
      }
    });

    if (fetchError) {
      console.error('Failed to log error to backend:', fetchError);
      return null;
    }

    return data?.error_id || null;
  } catch (e) {
    console.error('Failed to log error:', e);
    return null;
  }
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorId: null
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
    
    // Log to backend
    logErrorToBackend(error, errorInfo).then(errorId => {
      if (errorId) {
        this.setState({ errorId });
      }
    });
  }

  private handleRefresh = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="flex justify-center">
              <div className="p-4 bg-destructive/10 rounded-full">
                <AlertTriangle className="w-12 h-12 text-destructive" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground">
                เกิดข้อผิดพลาด
              </h1>
              <p className="text-muted-foreground">
                ขออภัย เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่อีกครั้ง
              </p>
              {this.state.errorId && (
                <p className="text-xs text-muted-foreground mt-2">
                  รหัสอ้างอิง: {this.state.errorId}
                </p>
              )}
            </div>

            <div className="flex gap-3 justify-center">
              <Button onClick={this.handleRefresh} variant="default">
                <RefreshCw className="w-4 h-4 mr-2" />
                รีเฟรชหน้า
              </Button>
              <Button onClick={this.handleGoHome} variant="outline">
                กลับหน้าแรก
              </Button>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-6 text-left">
                <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                  รายละเอียดข้อผิดพลาด (Dev Mode)
                </summary>
                <pre className="mt-2 p-4 bg-muted rounded-lg text-xs overflow-auto max-h-48">
                  {this.state.error.message}
                  {'\n\n'}
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
