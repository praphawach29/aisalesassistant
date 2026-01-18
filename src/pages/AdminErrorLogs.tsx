import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { Search, Eye, AlertTriangle, CheckCircle, RefreshCw, Bug } from "lucide-react";
import { toast } from "sonner";
import { Json } from "@/integrations/supabase/types";

interface ErrorLog {
  id: string;
  error_type: string;
  error_code: string | null;
  error_message: string;
  error_stack: string | null;
  context: Json | null;
  source: string | null;
  url: string | null;
  session_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  user_id: string | null;
  severity: string | null;
  resolved: boolean | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
}

const AdminErrorLogs = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [resolvedFilter, setResolvedFilter] = useState<string>("all");
  const queryClient = useQueryClient();

  const { data: errorLogs, isLoading, refetch } = useQuery({
    queryKey: ['error-logs', typeFilter, severityFilter, resolvedFilter],
    queryFn: async () => {
      let query = supabase
        .from('error_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (typeFilter !== 'all') {
        query = query.eq('error_type', typeFilter);
      }
      if (severityFilter !== 'all') {
        query = query.eq('severity', severityFilter);
      }
      if (resolvedFilter !== 'all') {
        query = query.eq('resolved', resolvedFilter === 'resolved');
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ErrorLog[];
    }
  });

  const resolveMutation = useMutation({
    mutationFn: async (errorId: string) => {
      const { error } = await supabase
        .from('error_logs')
        .update({ 
          resolved: true, 
          resolved_at: new Date().toISOString() 
        })
        .eq('id', errorId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['error-logs'] });
      toast.success("ทำเครื่องหมายว่าแก้ไขแล้ว");
    },
    onError: () => {
      toast.error("เกิดข้อผิดพลาด");
    }
  });

  const filteredLogs = errorLogs?.filter(log => 
    log.error_message.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.source?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.url?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getSeverityBadgeVariant = (severity: string | null) => {
    switch (severity) {
      case 'error': return 'destructive';
      case 'warning': return 'secondary';
      case 'info': return 'outline';
      default: return 'default';
    }
  };

  const getSeverityIcon = (severity: string | null) => {
    switch (severity) {
      case 'error': return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default: return <Bug className="h-4 w-4" />;
    }
  };

  const unresolvedCount = errorLogs?.filter(log => !log.resolved).length || 0;

  return (
    <AdminLayout title="Error Logs">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Errors ทั้งหมด</p>
                  <p className="text-2xl font-bold">{errorLogs?.length || 0}</p>
                </div>
                <Bug className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">ยังไม่แก้ไข</p>
                  <p className="text-2xl font-bold text-destructive">{unresolvedCount}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">แก้ไขแล้ว</p>
                  <p className="text-2xl font-bold text-green-600">
                    {(errorLogs?.length || 0) - unresolvedCount}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5" />
              Error Logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="ค้นหา error message, source, URL..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="ประเภท" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกประเภท</SelectItem>
                  <SelectItem value="frontend">Frontend</SelectItem>
                  <SelectItem value="backend">Backend</SelectItem>
                  <SelectItem value="api">API</SelectItem>
                </SelectContent>
              </Select>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุก Severity</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>
              <Select value={resolvedFilter} onValueChange={setResolvedFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="สถานะ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกสถานะ</SelectItem>
                  <SelectItem value="unresolved">ยังไม่แก้ไข</SelectItem>
                  <SelectItem value="resolved">แก้ไขแล้ว</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                รีเฟรช
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Logs List */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">
                กำลังโหลด...
              </div>
            ) : filteredLogs?.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                ไม่พบข้อมูล
              </div>
            ) : (
              <div className="divide-y">
                {filteredLogs?.map((log) => (
                  <div key={log.id} className={`p-4 hover:bg-muted/50 transition-colors ${log.resolved ? 'opacity-60' : ''}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {getSeverityIcon(log.severity)}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant={getSeverityBadgeVariant(log.severity)}>
                              {log.severity || 'error'}
                            </Badge>
                            <Badge variant="outline">{log.error_type}</Badge>
                            {log.resolved && (
                              <Badge variant="secondary" className="bg-green-100 text-green-800">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                แก้ไขแล้ว
                              </Badge>
                            )}
                          </div>
                          <p className="mt-1 text-sm font-medium truncate">
                            {log.error_message}
                          </p>
                          {log.source && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Source: {log.source}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(log.created_at), "d MMM HH:mm", { locale: th })}
                        </span>
                        {!log.resolved && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => resolveMutation.mutate(log.id)}
                            disabled={resolveMutation.isPending}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl max-h-[80vh]">
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-2">
                                {getSeverityIcon(log.severity)}
                                Error Details
                              </DialogTitle>
                            </DialogHeader>
                            <ScrollArea className="max-h-[60vh]">
                              <div className="space-y-4 p-1">
                                <div>
                                  <p className="text-sm text-muted-foreground">Error Message</p>
                                  <p className="font-medium">{log.error_message}</p>
                                </div>
                                {log.error_code && (
                                  <div>
                                    <p className="text-sm text-muted-foreground">Error Code</p>
                                    <p className="font-mono">{log.error_code}</p>
                                  </div>
                                )}
                                <div>
                                  <p className="text-sm text-muted-foreground">เวลา</p>
                                  <p>{format(new Date(log.created_at), "d MMM yyyy HH:mm:ss", { locale: th })}</p>
                                </div>
                                {log.url && (
                                  <div>
                                    <p className="text-sm text-muted-foreground">URL</p>
                                    <p className="font-mono text-sm break-all">{log.url}</p>
                                  </div>
                                )}
                                {log.source && (
                                  <div>
                                    <p className="text-sm text-muted-foreground">Source</p>
                                    <p>{log.source}</p>
                                  </div>
                                )}
                                {log.ip_address && (
                                  <div>
                                    <p className="text-sm text-muted-foreground">IP Address</p>
                                    <p className="font-mono">{log.ip_address}</p>
                                  </div>
                                )}
                                {log.user_agent && (
                                  <div>
                                    <p className="text-sm text-muted-foreground">User Agent</p>
                                    <p className="text-xs break-all">{log.user_agent}</p>
                                  </div>
                                )}
                                {log.error_stack && (
                                  <div>
                                    <p className="text-sm text-muted-foreground">Stack Trace</p>
                                    <pre className="bg-muted p-3 rounded text-xs overflow-x-auto whitespace-pre-wrap">
                                      {log.error_stack}
                                    </pre>
                                  </div>
                                )}
                                {log.context && (
                                  <div>
                                    <p className="text-sm text-muted-foreground">Context</p>
                                    <pre className="bg-muted p-3 rounded text-xs overflow-x-auto whitespace-pre-wrap">
                                      {JSON.stringify(log.context, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            </ScrollArea>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminErrorLogs;
