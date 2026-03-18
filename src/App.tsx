import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { SubscriptionProvider } from "@/hooks/useSubscription";
import ErrorBoundary from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import Chat from "./pages/Chat";
import ProductDetail from "./pages/ProductDetail";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import AdminProducts from "./pages/AdminProducts";
import AdminProductFAQs from "./pages/AdminProductFAQs";
import AdminOrders from "./pages/AdminOrders";
import AdminPaymentSlips from "./pages/AdminPaymentSlips";
import AdminChats from "./pages/AdminChats";
import AdminFAQs from "./pages/AdminFAQs";
import AdminIntegrations from "./pages/AdminIntegrations";
import AdminSettings from "./pages/AdminSettings";
import AdminNotifications from "./pages/AdminNotifications";
import AdminTemplates from "./pages/AdminTemplates";
import AdminAISettings from "./pages/AdminAISettings";
import AdminCategoryExpertise from "./pages/AdminCategoryExpertise";
import AdminCoupons from "./pages/AdminCoupons";
import AdminAddresses from "./pages/AdminAddresses";
import AdminBroadcast from "./pages/AdminBroadcast";
import AdminEmbedCode from "./pages/AdminEmbedCode";
import AdminWebScraping from "./pages/AdminWebScraping";
import AdminKnowledgeBase from "./pages/AdminKnowledgeBase";
import AdminRelatedProducts from "./pages/AdminRelatedProducts";
import AdminBackupReset from "./pages/AdminBackupReset";
import AdminAuditLogs from "./pages/AdminAuditLogs";
import AdminErrorLogs from "./pages/AdminErrorLogs";
import AdminAnalytics from "./pages/AdminAnalytics";
import WidgetDemo from "./pages/WidgetDemo";
import AdminSubscription from "./pages/AdminSubscription";
import Embed from "./pages/Embed";
import EmbedWidget from "./pages/EmbedWidget";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <SubscriptionProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/products/:id" element={<ProductDetail />} />
              <Route path="/admin" element={<AdminLogin />} />
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/products" element={<AdminProducts />} />
              <Route path="/admin/product-faqs" element={<AdminProductFAQs />} />
              <Route path="/admin/orders" element={<AdminOrders />} />
              <Route path="/admin/payment-slips" element={<AdminPaymentSlips />} />
              <Route path="/admin/chats" element={<AdminChats />} />
              <Route path="/admin/faqs" element={<AdminFAQs />} />
              <Route path="/admin/integrations" element={<AdminIntegrations />} />
              <Route path="/admin/settings" element={<AdminSettings />} />
              <Route path="/admin/notifications" element={<AdminNotifications />} />
              <Route path="/admin/templates" element={<AdminTemplates />} />
              <Route path="/admin/ai-settings" element={<AdminAISettings />} />
              <Route path="/admin/category-expertise" element={<AdminCategoryExpertise />} />
              <Route path="/admin/coupons" element={<AdminCoupons />} />
              <Route path="/admin/addresses" element={<AdminAddresses />} />
              <Route path="/admin/broadcast" element={<AdminBroadcast />} />
              <Route path="/admin/embed-code" element={<AdminEmbedCode />} />
              <Route path="/admin/web-scraping" element={<AdminWebScraping />} />
              <Route path="/admin/knowledge-base" element={<AdminKnowledgeBase />} />
              <Route path="/admin/related-products" element={<AdminRelatedProducts />} />
              <Route path="/admin/backup-reset" element={<AdminBackupReset />} />
              <Route path="/admin/audit-logs" element={<AdminAuditLogs />} />
              <Route path="/admin/error-logs" element={<AdminErrorLogs />} />
              <Route path="/admin/analytics" element={<AdminAnalytics />} />
              <Route path="/widget-demo" element={<WidgetDemo />} />
              <Route path="/embed" element={<Embed />} />
              <Route path="/embed-widget" element={<EmbedWidget />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/terms-of-service" element={<TermsOfService />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
