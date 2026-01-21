export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  promotion_price: number | null;
  stock: number;
  image_url: string | null;
  category: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  customer_line_id: string | null;
  customer_facebook_id: string | null;
  platform: 'web' | 'line' | 'facebook';
  status: 'pending' | 'confirmed' | 'payment_confirmed' | 'shipped' | 'delivered' | 'cancelled';
  tracking_number: string | null;
  total_amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  price: number;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  image_url?: string | null;
  created_at: string;
}

export interface ChatConversation {
  id: string;
  platform: 'web' | 'line' | 'facebook';
  platform_user_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address?: string | null;
  last_message: string | null;
  last_message_at: string | null;
  created_at: string;
  is_human_takeover?: boolean;
  assigned_admin_id?: string | null;
  takeover_at?: string | null;
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  updated_at: string;
}
