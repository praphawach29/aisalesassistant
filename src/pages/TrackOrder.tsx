import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Package, Truck, CheckCircle, Clock, Search, MapPin, Phone, User, ShoppingBag, XCircle } from "lucide-react";

interface OrderData {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  status: string;
  total_amount: number;
  tracking_number: string | null;
  created_at: string;
  updated_at: string;
  platform: string;
  discount_amount: number | null;
  notes: string | null;
}

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  price: number;
}

const statusSteps = [
  { key: "pending", label: "รอดำเนินการ", icon: Clock },
  { key: "confirmed", label: "ยืนยันแล้ว", icon: CheckCircle },
  { key: "payment_confirmed", label: "ชำระเงินแล้ว", icon: CheckCircle },
  { key: "shipped", label: "จัดส่งแล้ว", icon: Truck },
  { key: "delivered", label: "ได้รับสินค้า", icon: Package },
];

const getStatusIndex = (status: string) => {
  if (status === "cancelled") return -1;
  return statusSteps.findIndex((s) => s.key === status);
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "delivered": return "bg-green-500";
    case "shipped": return "bg-blue-500";
    case "payment_confirmed": return "bg-emerald-500";
    case "confirmed": return "bg-yellow-500";
    case "cancelled": return "bg-destructive";
    default: return "bg-muted-foreground";
  }
};

export default function TrackOrder() {
  const { orderNumber } = useParams();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState(orderNumber || "");
  const [order, setOrder] = useState<OrderData | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async (query?: string) => {
    const q = (query || searchQuery).trim().toUpperCase();
    if (!q) return;

    setIsLoading(true);
    setError("");
    setSearched(true);

    try {
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("*")
        .eq("order_number", q)
        .maybeSingle();

      if (orderError) throw orderError;

      if (!orderData) {
        setOrder(null);
        setItems([]);
        setError("ไม่พบออเดอร์นี้ กรุณาตรวจสอบเลขออเดอร์อีกครั้ง");
        return;
      }

      setOrder(orderData as OrderData);

      const { data: itemsData } = await supabase
        .from("order_items")
        .select("id, product_name, quantity, price")
        .eq("order_id", orderData.id);

      setItems((itemsData as OrderItem[]) || []);

      // Update URL
      if (!orderNumber || orderNumber !== q) {
        navigate(`/track/${q}`, { replace: true });
      }
    } catch (err) {
      setError("เกิดข้อผิดพลาด กรุณาลองอีกครั้ง");
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-search if URL has order number
  useState(() => {
    if (orderNumber) {
      handleSearch(orderNumber);
    }
  });

  const currentIndex = order ? getStatusIndex(order.status) : -1;
  const isCancelled = order?.status === "cancelled";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-background border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Package className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">ติดตามสถานะออเดอร์</h1>
          </div>
          <p className="text-muted-foreground text-sm">กรอกเลขออเดอร์เพื่อตรวจสอบสถานะการจัดส่ง</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-2">
              <Input
                placeholder="เลขออเดอร์ เช่น ORD-20260319-0001"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="flex-1"
              />
              <Button onClick={() => handleSearch()} disabled={isLoading}>
                <Search className="h-4 w-4 mr-1" />
                {isLoading ? "กำลังค้นหา..." : "ค้นหา"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {error && searched && (
          <Card className="border-destructive/50">
            <CardContent className="pt-6 text-center text-destructive">
              <XCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>{error}</p>
            </CardContent>
          </Card>
        )}

        {order && (
          <>
            {/* Status Timeline */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{order.order_number}</CardTitle>
                  <Badge className={`${getStatusColor(order.status)} text-white`}>
                    {isCancelled ? "ยกเลิกแล้ว" : statusSteps[currentIndex]?.label || order.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  สั่งเมื่อ {new Date(order.created_at).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              </CardHeader>
              <CardContent>
                {isCancelled ? (
                  <div className="text-center py-4 text-destructive">
                    <XCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="font-medium">ออเดอร์นี้ถูกยกเลิกแล้ว</p>
                  </div>
                ) : (
                  <div className="relative py-4">
                    {/* Timeline */}
                    <div className="flex justify-between relative">
                      {/* Progress line */}
                      <div className="absolute top-5 left-0 right-0 h-0.5 bg-muted" />
                      <div
                        className="absolute top-5 left-0 h-0.5 bg-primary transition-all duration-500"
                        style={{ width: `${(currentIndex / (statusSteps.length - 1)) * 100}%` }}
                      />

                      {statusSteps.map((step, i) => {
                        const Icon = step.icon;
                        const isActive = i <= currentIndex;
                        const isCurrent = i === currentIndex;
                        return (
                          <div key={step.key} className="flex flex-col items-center relative z-10" style={{ width: "20%" }}>
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                                isCurrent
                                  ? "bg-primary border-primary text-primary-foreground scale-110 shadow-lg"
                                  : isActive
                                  ? "bg-primary border-primary text-primary-foreground"
                                  : "bg-background border-muted text-muted-foreground"
                              }`}
                            >
                              <Icon className="h-4 w-4" />
                            </div>
                            <span className={`text-[10px] mt-1.5 text-center leading-tight ${isActive ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                              {step.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Tracking Number */}
                {order.tracking_number && (
                  <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-800 dark:text-blue-200">เลขพัสดุ:</span>
                      <span className="text-sm font-mono text-blue-700 dark:text-blue-300">{order.tracking_number}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Order Items */}
            {items.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4" />
                    รายการสินค้า
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {items.map((item) => (
                    <div key={item.id} className="flex justify-between items-center py-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">{item.product_name}</p>
                        <p className="text-xs text-muted-foreground">x{item.quantity}</p>
                      </div>
                      <p className="text-sm font-medium text-foreground">
                        ฿{(item.price * item.quantity).toLocaleString()}
                      </p>
                    </div>
                  ))}
                  <Separator />
                  <div className="flex justify-between items-center pt-1">
                    {order.discount_amount && order.discount_amount > 0 ? (
                      <>
                        <span className="text-xs text-muted-foreground">ส่วนลด</span>
                        <span className="text-xs text-green-600">-฿{order.discount_amount.toLocaleString()}</span>
                      </>
                    ) : null}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-foreground">รวมทั้งหมด</span>
                    <span className="font-bold text-primary text-lg">฿{order.total_amount.toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Customer Info */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">ข้อมูลการจัดส่ง</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground">{order.customer_name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground">{order.customer_phone.replace(/(\d{3})(\d{3})(\d{4})/, "$1-***-$2")}</span>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <span className="text-foreground">{order.customer_address}</span>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {!searched && !orderNumber && (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p>กรอกเลขออเดอร์ด้านบนเพื่อเริ่มติดตาม</p>
          </div>
        )}
      </div>
    </div>
  );
}
