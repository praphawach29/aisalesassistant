import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Chat from "./pages/Chat";
import ProductDetail from "./pages/ProductDetail";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import AdminProducts from "./pages/AdminProducts";
import AdminOrders from "./pages/AdminOrders";
import AdminChats from "./pages/AdminChats";
import AdminFAQs from "./pages/AdminFAQs";
import AdminIntegrations from "./pages/AdminIntegrations";
import AdminSettings from "./pages/AdminSettings";
import AdminNotifications from "./pages/AdminNotifications";
import AdminTemplates from "./pages/AdminTemplates";
import AdminAISettings from "./pages/AdminAISettings";
import AdminCoupons from "./pages/AdminCoupons";
import AdminAddresses from "./pages/AdminAddresses";
import WidgetDemo from "./pages/WidgetDemo";
import Embed from "./pages/Embed";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Chat />} />
            <Route path="/products/:id" element={<ProductDetail />} />
            <Route path="/admin" element={<AdminLogin />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/products" element={<AdminProducts />} />
            <Route path="/admin/orders" element={<AdminOrders />} />
            <Route path="/admin/chats" element={<AdminChats />} />
            <Route path="/admin/faqs" element={<AdminFAQs />} />
            <Route path="/admin/integrations" element={<AdminIntegrations />} />
            <Route path="/admin/settings" element={<AdminSettings />} />
            <Route path="/admin/notifications" element={<AdminNotifications />} />
            <Route path="/admin/templates" element={<AdminTemplates />} />
            <Route path="/admin/ai-settings" element={<AdminAISettings />} />
            <Route path="/admin/coupons" element={<AdminCoupons />} />
            <Route path="/admin/addresses" element={<AdminAddresses />} />
            <Route path="/widget-demo" element={<WidgetDemo />} />
            <Route path="/embed" element={<Embed />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
