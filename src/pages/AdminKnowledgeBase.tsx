import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { 
  Upload, 
  FileText, 
  Image, 
  Trash2, 
  Eye, 
  Loader2,
  BookOpen,
  RefreshCw,
  X
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

interface KnowledgeItem {
  id: string;
  title: string;
  file_url: string;
  file_type: string;
  original_content: string | null;
  summary: string | null;
  category: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function AdminKnowledgeBase() {
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [selectedItem, setSelectedItem] = useState<KnowledgeItem | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Fetch knowledge base items
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['knowledge-base'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('knowledge_base')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as KnowledgeItem[];
    },
  });

  // Toggle active status
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('knowledge_base')
        .update({ is_active })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-base'] });
      toast.success('อัพเดทสถานะสำเร็จ');
    },
    onError: (error) => {
      toast.error('เกิดข้อผิดพลาด: ' + error.message);
    },
  });

  // Delete item
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const item = items.find(i => i.id === id);
      if (item) {
        // Delete file from storage
        const urlParts = item.file_url.split('/knowledge-files/');
        if (urlParts.length > 1) {
          const filePath = urlParts[1].split('?')[0];
          await supabase.storage.from('knowledge-files').remove([filePath]);
        }
      }
      
      const { error } = await supabase
        .from('knowledge_base')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-base'] });
      toast.success('ลบเอกสารสำเร็จ');
      setDeleteItemId(null);
    },
    onError: (error) => {
      toast.error('เกิดข้อผิดพลาด: ' + error.message);
    },
  });

  // Handle file upload
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
    
    if (!allowedTypes.includes(file.type)) {
      toast.error('รองรับเฉพาะไฟล์ PDF, PNG, JPG, WEBP');
      return;
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast.error('ไฟล์ต้องมีขนาดไม่เกิน 10MB');
      return;
    }

    setIsUploading(true);
    setUploadProgress('กำลังอัพโหลดไฟล์...');

    try {
      // Upload to storage
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'pdf';
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('knowledge-files')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get signed URL
      const { data: signedData } = await supabase.storage
        .from('knowledge-files')
        .createSignedUrl(fileName, 3600 * 24 * 365); // 1 year

      if (!signedData?.signedUrl) {
        throw new Error('Failed to get file URL');
      }

      setUploadProgress('กำลังให้ AI อ่านและสรุปเนื้อหา...');

      // Process with AI
      const { data: functionData, error: functionError } = await supabase.functions.invoke('process-knowledge-file', {
        body: {
          fileUrl: signedData.signedUrl,
          fileType: fileExt,
          title: file.name.replace(/\.[^/.]+$/, ''),
          category: null,
        },
      });

      if (functionError) throw functionError;
      if (!functionData.success) throw new Error(functionData.error);

      queryClient.invalidateQueries({ queryKey: ['knowledge-base'] });
      toast.success('อัพโหลดและประมวลผลสำเร็จ');

    } catch (error) {
      console.error('Upload error:', error);
      toast.error('เกิดข้อผิดพลาด: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsUploading(false);
      setUploadProgress('');
    }
  };

  // Drag and drop handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFileUpload(e.dataTransfer.files);
  }, []);

  const getFileIcon = (fileType: string) => {
    if (['png', 'jpg', 'jpeg', 'webp'].includes(fileType)) {
      return <Image className="w-5 h-5" />;
    }
    return <FileText className="w-5 h-5" />;
  };

  return (
    <AdminLayout title="ฐานความรู้">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BookOpen className="w-6 h-6" />
              ฐานความรู้ (Knowledge Base)
            </h1>
            <p className="text-muted-foreground">
              อัพโหลดเอกสารให้ AI อ่านและใช้ตอบคำถามลูกค้า
            </p>
          </div>
          <Button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['knowledge-base'] })}
            variant="outline"
            size="sm"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            รีเฟรช
          </Button>
        </div>

        {/* Upload Area */}
        <Card>
          <CardContent className="pt-6">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
              } ${isUploading ? 'pointer-events-none opacity-50' : ''}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {isUploading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-10 h-10 animate-spin text-primary" />
                  <p className="text-lg font-medium">{uploadProgress}</p>
                </div>
              ) : (
                <>
                  <Upload className="w-10 h-10 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg font-medium mb-2">
                    ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    รองรับ PDF, PNG, JPG, WEBP (สูงสุด 10MB)
                  </p>
                  <Label htmlFor="file-upload" className="cursor-pointer">
                    <Button asChild>
                      <span>
                        <Upload className="w-4 h-4 mr-2" />
                        เลือกไฟล์
                      </span>
                    </Button>
                    <Input
                      id="file-upload"
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.webp"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e.target.files)}
                    />
                  </Label>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Documents List */}
        <Card>
          <CardHeader>
            <CardTitle>เอกสารทั้งหมด ({items.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>ยังไม่มีเอกสารในฐานความรู้</p>
                <p className="text-sm">อัพโหลดเอกสารเพื่อให้ AI ใช้ตอบคำถามลูกค้า</p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        {getFileIcon(item.file_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate">{item.title}</h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Badge variant="outline" className="text-xs">
                            {item.file_type.toUpperCase()}
                          </Badge>
                          {item.category && (
                            <Badge variant="secondary" className="text-xs">
                              {item.category}
                            </Badge>
                          )}
                          <span className="hidden sm:inline">
                            {new Date(item.created_at).toLocaleDateString('th-TH')}
                          </span>
                        </div>
                        {item.summary && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                            {item.summary}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Switch
                        checked={item.is_active}
                        onCheckedChange={(checked) => 
                          toggleActiveMutation.mutate({ id: item.id, is_active: checked })
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedItem(item);
                          setIsViewDialogOpen(true);
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteItemId(item.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedItem && getFileIcon(selectedItem.file_type)}
              {selectedItem?.title}
            </DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">สรุปเนื้อหา</Label>
                <div className="mt-1 p-3 bg-muted rounded-lg">
                  <p className="text-sm">{selectedItem.summary || 'ไม่มีข้อมูลสรุป'}</p>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium">เนื้อหาที่อ่านได้</Label>
                <Textarea
                  readOnly
                  value={selectedItem.original_content || 'ไม่มีข้อมูล'}
                  className="mt-1 min-h-[300px] font-mono text-sm"
                />
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>ประเภท: {selectedItem.file_type.toUpperCase()}</span>
                <span>สถานะ: {selectedItem.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}</span>
                <span>อัพโหลด: {new Date(selectedItem.created_at).toLocaleString('th-TH')}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteItemId} onOpenChange={() => setDeleteItemId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบ</AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการลบเอกสารนี้ออกจากฐานความรู้หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteItemId && deleteMutation.mutate(deleteItemId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
