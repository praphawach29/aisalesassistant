import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Globe, Plus, Trash2, RefreshCw, Loader2, ExternalLink, FileText, Clock, CalendarClock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ScrapedContent {
  id: string;
  url: string;
  title: string | null;
  content: string | null;
  summary: string | null;
  source_name: string | null;
  is_active: boolean;
  last_scraped_at: string | null;
  created_at: string;
  scrape_interval: string;
  next_scrape_at: string | null;
}

const INTERVAL_OPTIONS = [
  { value: "manual", label: "ดึงเอง (Manual)" },
  { value: "hourly", label: "ทุกชั่วโมง" },
  { value: "daily", label: "ทุกวัน" },
  { value: "weekly", label: "ทุกสัปดาห์" },
  { value: "monthly", label: "ทุกเดือน" },
];

export default function AdminWebScraping() {
  const [scrapedContent, setScrapedContent] = useState<ScrapedContent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScraping, setIsScraping] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedContent, setSelectedContent] = useState<ScrapedContent | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [newUrl, setNewUrl] = useState("");
  const [newSourceName, setNewSourceName] = useState("");
  const [newInterval, setNewInterval] = useState("manual");
  const { toast } = useToast();

  useEffect(() => {
    fetchScrapedContent();
  }, []);

  const fetchScrapedContent = async () => {
    try {
      const { data, error } = await supabase
        .from("scraped_content")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setScrapedContent(data || []);
    } catch (error) {
      console.error("Error fetching scraped content:", error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถโหลดข้อมูลได้",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleScrape = async () => {
    if (!newUrl.trim()) {
      toast({
        title: "กรุณากรอก URL",
        variant: "destructive",
      });
      return;
    }

    setIsScraping(true);
    try {
      const { data, error } = await supabase.functions.invoke("scrape-website", {
        body: { url: newUrl, sourceName: newSourceName || undefined, interval: newInterval },
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "ดึงข้อมูลสำเร็จ",
          description: `ดึงข้อมูลจาก ${newUrl} เรียบร้อยแล้ว`,
        });
        setIsAddDialogOpen(false);
        setNewUrl("");
        setNewSourceName("");
        setNewInterval("manual");
        fetchScrapedContent();
      } else {
        throw new Error(data.error || "Failed to scrape");
      }
    } catch (error) {
      console.error("Error scraping:", error);
      toast({
        title: "ดึงข้อมูลไม่สำเร็จ",
        description: error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการดึงข้อมูล",
        variant: "destructive",
      });
    } finally {
      setIsScraping(false);
    }
  };

  const handleRefresh = async (item: ScrapedContent) => {
    setIsScraping(true);
    try {
      const { data, error } = await supabase.functions.invoke("scrape-website", {
        body: { url: item.url, sourceName: item.source_name || undefined },
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "อัพเดทข้อมูลสำเร็จ",
          description: `อัพเดทข้อมูลจาก ${item.source_name || item.url} เรียบร้อยแล้ว`,
        });
        fetchScrapedContent();
      } else {
        throw new Error(data.error || "Failed to refresh");
      }
    } catch (error) {
      console.error("Error refreshing:", error);
      toast({
        title: "อัพเดทไม่สำเร็จ",
        description: error instanceof Error ? error.message : "เกิดข้อผิดพลาด",
        variant: "destructive",
      });
    } finally {
      setIsScraping(false);
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from("scraped_content")
        .update({ is_active: isActive })
        .eq("id", id);

      if (error) throw error;

      setScrapedContent(prev =>
        prev.map(item => item.id === id ? { ...item, is_active: isActive } : item)
      );

      toast({
        title: isActive ? "เปิดใช้งานแล้ว" : "ปิดใช้งานแล้ว",
      });
    } catch (error) {
      console.error("Error toggling active:", error);
      toast({
        title: "เกิดข้อผิดพลาด",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const { error } = await supabase
        .from("scraped_content")
        .delete()
        .eq("id", deleteId);

      if (error) throw error;

      setScrapedContent(prev => prev.filter(item => item.id !== deleteId));
      toast({ title: "ลบข้อมูลเรียบร้อยแล้ว" });
    } catch (error) {
      console.error("Error deleting:", error);
      toast({
        title: "ลบไม่สำเร็จ",
        variant: "destructive",
      });
    } finally {
      setDeleteId(null);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString("th-TH");
  };

  return (
    <AdminLayout title="Web Scraping">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Web Scraping</h1>
            <p className="text-muted-foreground">
              ดึงข้อมูลจากเว็บไซต์ภายนอกเพื่อให้บอทตอบได้
            </p>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            เพิ่มเว็บไซต์
          </Button>
        </div>

        {/* Info Card */}
        <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
          <CardContent className="pt-4">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>วิธีใช้งาน:</strong> เพิ่ม URL ของเว็บไซต์ที่ต้องการให้บอทใช้เป็นข้อมูลอ้างอิง 
              ระบบจะดึงเนื้อหาและสรุปอัตโนมัติ เมื่อลูกค้าถามคำถามที่เกี่ยวข้อง บอทจะใช้ข้อมูลเหล่านี้ในการตอบ
            </p>
          </CardContent>
        </Card>

        {/* Content List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : scrapedContent.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Globe className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                ยังไม่มีเว็บไซต์ที่ดึงข้อมูล<br />
                คลิก "เพิ่มเว็บไซต์" เพื่อเริ่มต้น
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {scrapedContent.map((item) => (
              <Card key={item.id} className={!item.is_active ? "opacity-60" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-lg truncate">
                          {item.source_name || item.title || "Untitled"}
                        </CardTitle>
                        <Badge variant={item.is_active ? "default" : "secondary"}>
                          {item.is_active ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                        </Badge>
                      </div>
                      <CardDescription className="truncate">
                        <a 
                          href={item.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="hover:underline flex items-center gap-1"
                        >
                          {item.url}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={item.is_active}
                        onCheckedChange={(checked) => handleToggleActive(item.id, checked)}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {item.summary && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {item.summary}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        อัพเดท: {formatDate(item.last_scraped_at)}
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {item.content?.length || 0} ตัวอักษร
                      </span>
                      <span className="flex items-center gap-1">
                        <CalendarClock className="w-3 h-3" />
                        {INTERVAL_OPTIONS.find(o => o.value === item.scrape_interval)?.label || "ดึงเอง"}
                        {item.scrape_interval !== "manual" && item.next_scrape_at && (
                          <span className="text-muted-foreground/70">
                            (ครั้งถัดไป: {formatDate(item.next_scrape_at)})
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedContent(item);
                          setIsDetailDialogOpen(true);
                        }}
                      >
                        <FileText className="w-4 h-4 mr-1" />
                        ดูรายละเอียด
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRefresh(item)}
                        disabled={isScraping}
                      >
                        <RefreshCw className={`w-4 h-4 mr-1 ${isScraping ? "animate-spin" : ""}`} />
                        อัพเดท
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleteId(item.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>เพิ่มเว็บไซต์ใหม่</DialogTitle>
            <DialogDescription>
              กรอก URL ของเว็บไซต์ที่ต้องการดึงข้อมูล
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="url">URL เว็บไซต์ *</Label>
              <Input
                id="url"
                placeholder="https://example.com"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="sourceName">ชื่อแหล่งข้อมูล (ไม่บังคับ)</Label>
              <Input
                id="sourceName"
                placeholder="เช่น บริษัท ABC - หน้าแรก"
                value={newSourceName}
                onChange={(e) => setNewSourceName(e.target.value)}
              />
            </div>
            <div>
              <Label>ตั้งเวลาดึงข้อมูลอัตโนมัติ</Label>
              <Select value={newInterval} onValueChange={setNewInterval}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกรอบการดึงข้อมูล" />
                </SelectTrigger>
                <SelectContent>
                  {INTERVAL_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleScrape} disabled={isScraping}>
              {isScraping ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  กำลังดึงข้อมูล...
                </>
              ) : (
                <>
                  <Globe className="w-4 h-4 mr-2" />
                  ดึงข้อมูล
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedContent?.source_name || selectedContent?.title}</DialogTitle>
            <DialogDescription>
              <a 
                href={selectedContent?.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:underline flex items-center gap-1"
              >
                {selectedContent?.url}
                <ExternalLink className="w-3 h-3" />
              </a>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedContent?.summary && (
              <div>
                <Label className="text-sm font-medium">สรุปเนื้อหา (AI)</Label>
                <p className="mt-1 text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                  {selectedContent.summary}
                </p>
              </div>
            )}
            <div>
              <Label className="text-sm font-medium">เนื้อหาที่ดึงมา</Label>
              <Textarea
                readOnly
                value={selectedContent?.content || ""}
                className="mt-1 h-64 font-mono text-xs"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบ?</AlertDialogTitle>
            <AlertDialogDescription>
              ข้อมูลนี้จะถูกลบอย่างถาวร ไม่สามารถกู้คืนได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
