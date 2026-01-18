import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { Search, Eye, FileText, RefreshCw } from "lucide-react";

interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  action: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_fields: string[] | null;
  user_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

const AdminAuditLogs = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const { data: auditLogs, isLoading, refetch } = useQuery({
    queryKey: ['audit-logs', tableFilter, actionFilter],
    queryFn: async () => {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (tableFilter !== 'all') {
        query = query.eq('table_name', tableFilter);
      }
      if (actionFilter !== 'all') {
        query = query.eq('action', actionFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AuditLog[];
    }
  });

  const filteredLogs = auditLogs?.filter(log => 
    log.record_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.table_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getActionBadgeVariant = (action: string) => {
    switch (action) {
      case 'INSERT': return 'default';
      case 'UPDATE': return 'secondary';
      case 'DELETE': return 'destructive';
      default: return 'outline';
    }
  };

  const renderJsonDiff = (oldData: Record<string, unknown> | null, newData: Record<string, unknown> | null, changedFields: string[] | null) => {
    if (!changedFields || changedFields.length === 0) {
      return <p className="text-muted-foreground">ไม่มีการเปลี่ยนแปลง</p>;
    }

    return (
      <div className="space-y-2">
        {changedFields.map(field => (
          <div key={field} className="border rounded p-2">
            <p className="font-medium text-sm">{field}</p>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <div className="bg-destructive/10 p-2 rounded text-xs">
                <span className="text-destructive">- </span>
                {JSON.stringify(oldData?.[field] ?? null, null, 2)}
              </div>
              <div className="bg-green-500/10 p-2 rounded text-xs">
                <span className="text-green-600">+ </span>
                {JSON.stringify(newData?.[field] ?? null, null, 2)}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <AdminLayout title="Audit Logs">
      <div className="space-y-6">
        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              ประวัติการเปลี่ยนแปลงข้อมูล
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="ค้นหา Record ID หรือ Table..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={tableFilter} onValueChange={setTableFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="เลือก Table" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุก Table</SelectItem>
                  <SelectItem value="orders">orders</SelectItem>
                  <SelectItem value="products">products</SelectItem>
                  <SelectItem value="payment_slips">payment_slips</SelectItem>
                  <SelectItem value="settings">settings</SelectItem>
                  <SelectItem value="ai_provider_keys">ai_provider_keys</SelectItem>
                </SelectContent>
              </Select>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="เลือก Action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุก Action</SelectItem>
                  <SelectItem value="INSERT">INSERT</SelectItem>
                  <SelectItem value="UPDATE">UPDATE</SelectItem>
                  <SelectItem value="DELETE">DELETE</SelectItem>
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
                  <div key={log.id} className="p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant={getActionBadgeVariant(log.action)}>
                          {log.action}
                        </Badge>
                        <span className="font-medium">{log.table_name}</span>
                        <span className="text-muted-foreground text-sm">
                          #{log.record_id.slice(0, 8)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(log.created_at), "d MMM yyyy HH:mm", { locale: th })}
                        </span>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl max-h-[80vh]">
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-2">
                                <Badge variant={getActionBadgeVariant(log.action)}>
                                  {log.action}
                                </Badge>
                                {log.table_name}
                              </DialogTitle>
                            </DialogHeader>
                            <ScrollArea className="max-h-[60vh]">
                              <div className="space-y-4 p-1">
                                <div>
                                  <p className="text-sm text-muted-foreground">Record ID</p>
                                  <p className="font-mono text-sm">{log.record_id}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">เวลา</p>
                                  <p>{format(new Date(log.created_at), "d MMM yyyy HH:mm:ss", { locale: th })}</p>
                                </div>
                                {log.ip_address && (
                                  <div>
                                    <p className="text-sm text-muted-foreground">IP Address</p>
                                    <p className="font-mono text-sm">{log.ip_address}</p>
                                  </div>
                                )}
                                <div>
                                  <p className="text-sm text-muted-foreground mb-2">การเปลี่ยนแปลง</p>
                                  {log.action === 'INSERT' ? (
                                    <div className="bg-green-500/10 p-3 rounded">
                                      <pre className="text-xs whitespace-pre-wrap">
                                        {JSON.stringify(log.new_data, null, 2)}
                                      </pre>
                                    </div>
                                  ) : log.action === 'DELETE' ? (
                                    <div className="bg-destructive/10 p-3 rounded">
                                      <pre className="text-xs whitespace-pre-wrap">
                                        {JSON.stringify(log.old_data, null, 2)}
                                      </pre>
                                    </div>
                                  ) : (
                                    renderJsonDiff(log.old_data, log.new_data, log.changed_fields)
                                  )}
                                </div>
                              </div>
                            </ScrollArea>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                    {log.changed_fields && log.changed_fields.length > 0 && (
                      <div className="mt-2 flex gap-1 flex-wrap">
                        {log.changed_fields.map(field => (
                          <Badge key={field} variant="outline" className="text-xs">
                            {field}
                          </Badge>
                        ))}
                      </div>
                    )}
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

export default AdminAuditLogs;
