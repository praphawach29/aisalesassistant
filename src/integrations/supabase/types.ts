export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_notifications: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          is_read: boolean
          message: string
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean
          message: string
          title: string
          type: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean
          message?: string
          title?: string
          type?: string
        }
        Relationships: []
      }
      ai_personality_templates: {
        Row: {
          ai_name: string
          avatar_url: string | null
          closing_message: string | null
          created_at: string
          custom_rules: string | null
          description: string | null
          formality_level: number
          gender: string
          greeting_message: string | null
          id: string
          is_system: boolean
          name: string
          personality: string | null
          response_length: string
          updated_at: string
          use_emoji: boolean
        }
        Insert: {
          ai_name: string
          avatar_url?: string | null
          closing_message?: string | null
          created_at?: string
          custom_rules?: string | null
          description?: string | null
          formality_level?: number
          gender?: string
          greeting_message?: string | null
          id?: string
          is_system?: boolean
          name: string
          personality?: string | null
          response_length?: string
          updated_at?: string
          use_emoji?: boolean
        }
        Update: {
          ai_name?: string
          avatar_url?: string | null
          closing_message?: string | null
          created_at?: string
          custom_rules?: string | null
          description?: string | null
          formality_level?: number
          gender?: string
          greeting_message?: string | null
          id?: string
          is_system?: boolean
          name?: string
          personality?: string | null
          response_length?: string
          updated_at?: string
          use_emoji?: boolean
        }
        Relationships: []
      }
      ai_provider_keys: {
        Row: {
          created_at: string
          encrypted_api_key: string | null
          id: string
          is_active: boolean | null
          provider: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          encrypted_api_key?: string | null
          id?: string
          is_active?: boolean | null
          provider: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          encrypted_api_key?: string | null
          id?: string
          is_active?: boolean | null
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_settings: {
        Row: {
          ai_name: string
          ai_provider: string | null
          avatar_url: string | null
          closing_message: string | null
          created_at: string
          custom_rules: string | null
          default_store_type: string | null
          formality_level: number
          gender: string
          greeting_message: string | null
          id: string
          is_active: boolean
          personality: string | null
          response_length: string
          template_id: string | null
          updated_at: string
          use_auto_detect: boolean | null
          use_emoji: boolean
        }
        Insert: {
          ai_name?: string
          ai_provider?: string | null
          avatar_url?: string | null
          closing_message?: string | null
          created_at?: string
          custom_rules?: string | null
          default_store_type?: string | null
          formality_level?: number
          gender?: string
          greeting_message?: string | null
          id?: string
          is_active?: boolean
          personality?: string | null
          response_length?: string
          template_id?: string | null
          updated_at?: string
          use_auto_detect?: boolean | null
          use_emoji?: boolean
        }
        Update: {
          ai_name?: string
          ai_provider?: string | null
          avatar_url?: string | null
          closing_message?: string | null
          created_at?: string
          custom_rules?: string | null
          default_store_type?: string | null
          formality_level?: number
          gender?: string
          greeting_message?: string | null
          id?: string
          is_active?: boolean
          personality?: string | null
          response_length?: string
          template_id?: string | null
          updated_at?: string
          use_auto_detect?: boolean | null
          use_emoji?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ai_settings_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "ai_personality_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_events: {
        Row: {
          browser: string | null
          created_at: string
          device_type: string | null
          event_data: Json | null
          event_type: string
          id: string
          page_url: string | null
          platform: string | null
          platform_user_id: string | null
          referrer: string | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          browser?: string | null
          created_at?: string
          device_type?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          page_url?: string | null
          platform?: string | null
          platform_user_id?: string | null
          referrer?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          browser?: string | null
          created_at?: string
          device_type?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          page_url?: string | null
          platform?: string | null
          platform_user_id?: string | null
          referrer?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          changed_fields: string[] | null
          created_at: string
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changed_fields?: string[] | null
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_fields?: string[] | null
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      booking_settings: {
        Row: {
          auto_confirm: boolean
          booking_rules: string | null
          business_hours: Json
          created_at: string
          id: string
          is_enabled: boolean
          max_advance_days: number
          service_name: string
          slot_duration_minutes: number
          updated_at: string
        }
        Insert: {
          auto_confirm?: boolean
          booking_rules?: string | null
          business_hours?: Json
          created_at?: string
          id?: string
          is_enabled?: boolean
          max_advance_days?: number
          service_name?: string
          slot_duration_minutes?: number
          updated_at?: string
        }
        Update: {
          auto_confirm?: boolean
          booking_rules?: string | null
          business_hours?: Json
          created_at?: string
          id?: string
          is_enabled?: boolean
          max_advance_days?: number
          service_name?: string
          slot_duration_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      booking_slots: {
        Row: {
          created_at: string
          current_bookings: number
          end_time: string
          id: string
          is_available: boolean
          max_bookings: number
          note: string | null
          slot_date: string
          start_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_bookings?: number
          end_time: string
          id?: string
          is_available?: boolean
          max_bookings?: number
          note?: string | null
          slot_date: string
          start_time: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_bookings?: number
          end_time?: string
          id?: string
          is_available?: boolean
          max_bookings?: number
          note?: string | null
          slot_date?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          booking_date: string
          booking_number: string
          booking_time: string
          conversation_id: string | null
          created_at: string
          customer_facebook_id: string | null
          customer_line_id: string | null
          customer_name: string
          customer_phone: string
          id: string
          notes: string | null
          platform: string
          service_name: string
          slot_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          booking_date: string
          booking_number: string
          booking_time: string
          conversation_id?: string | null
          created_at?: string
          customer_facebook_id?: string | null
          customer_line_id?: string | null
          customer_name: string
          customer_phone: string
          id?: string
          notes?: string | null
          platform?: string
          service_name?: string
          slot_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          booking_date?: string
          booking_number?: string
          booking_time?: string
          conversation_id?: string | null
          created_at?: string
          customer_facebook_id?: string | null
          customer_line_id?: string | null
          customer_name?: string
          customer_phone?: string
          id?: string
          notes?: string | null
          platform?: string
          service_name?: string
          slot_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "booking_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcast_messages: {
        Row: {
          completed_at: string | null
          content: string
          created_at: string
          failed_count: number | null
          id: string
          image_url: string | null
          message_type: string
          platform: string
          scheduled_at: string | null
          sent_by: string | null
          sent_count: number | null
          status: string
          success_count: number | null
          target_audience: string
        }
        Insert: {
          completed_at?: string | null
          content: string
          created_at?: string
          failed_count?: number | null
          id?: string
          image_url?: string | null
          message_type?: string
          platform?: string
          scheduled_at?: string | null
          sent_by?: string | null
          sent_count?: number | null
          status?: string
          success_count?: number | null
          target_audience?: string
        }
        Update: {
          completed_at?: string | null
          content?: string
          created_at?: string
          failed_count?: number | null
          id?: string
          image_url?: string | null
          message_type?: string
          platform?: string
          scheduled_at?: string | null
          sent_by?: string | null
          sent_count?: number | null
          status?: string
          success_count?: number | null
          target_audience?: string
        }
        Relationships: []
      }
      category_expertise: {
        Row: {
          category: string
          common_questions: string | null
          created_at: string
          expertise_name: string
          expertise_prompt: string
          id: string
          is_active: boolean | null
          is_system: boolean | null
          selling_tips: string | null
          store_type: string | null
          terminology: string | null
          updated_at: string
        }
        Insert: {
          category: string
          common_questions?: string | null
          created_at?: string
          expertise_name: string
          expertise_prompt: string
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          selling_tips?: string | null
          store_type?: string | null
          terminology?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          common_questions?: string | null
          created_at?: string
          expertise_name?: string
          expertise_prompt?: string
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          selling_tips?: string | null
          store_type?: string | null
          terminology?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      chat_conversations: {
        Row: {
          assigned_admin_id: string | null
          created_at: string
          customer_address: string | null
          customer_name: string | null
          customer_phone: string | null
          id: string
          is_human_takeover: boolean
          last_message: string | null
          last_message_at: string | null
          platform: string
          platform_user_id: string | null
          takeover_at: string | null
        }
        Insert: {
          assigned_admin_id?: string | null
          created_at?: string
          customer_address?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          is_human_takeover?: boolean
          last_message?: string | null
          last_message_at?: string | null
          platform?: string
          platform_user_id?: string | null
          takeover_at?: string | null
        }
        Update: {
          assigned_admin_id?: string | null
          created_at?: string
          customer_address?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          is_human_takeover?: boolean
          last_message?: string | null
          last_message_at?: string | null
          platform?: string
          platform_user_id?: string | null
          takeover_at?: string | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          image_url: string | null
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          image_url?: string | null
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          description: string | null
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean
          max_uses: number | null
          min_order_amount: number | null
          name: string
          updated_at: string
          used_count: number
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_order_amount?: number | null
          name: string
          updated_at?: string
          used_count?: number
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_order_amount?: number | null
          name?: string
          updated_at?: string
          used_count?: number
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      customer_addresses: {
        Row: {
          address: string
          created_at: string
          id: string
          is_default: boolean
          label: string
          platform: string
          platform_user_id: string
          updated_at: string
        }
        Insert: {
          address: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          platform?: string
          platform_user_id: string
          updated_at?: string
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          platform?: string
          platform_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      embed_settings: {
        Row: {
          auto_open: boolean
          bot_name: string
          button_size: string
          created_at: string
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          position: string
          primary_color: string
          quick_actions: Json
          updated_at: string
          welcome_message: string | null
          window_height: string
          window_width: string
        }
        Insert: {
          auto_open?: boolean
          bot_name?: string
          button_size?: string
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          position?: string
          primary_color?: string
          quick_actions?: Json
          updated_at?: string
          welcome_message?: string | null
          window_height?: string
          window_width?: string
        }
        Update: {
          auto_open?: boolean
          bot_name?: string
          button_size?: string
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          position?: string
          primary_color?: string
          quick_actions?: Json
          updated_at?: string
          welcome_message?: string | null
          window_height?: string
          window_width?: string
        }
        Relationships: []
      }
      error_logs: {
        Row: {
          context: Json | null
          created_at: string
          error_code: string | null
          error_message: string
          error_stack: string | null
          error_type: string
          id: string
          ip_address: string | null
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
          session_id: string | null
          severity: string | null
          source: string | null
          url: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string
          error_code?: string | null
          error_message: string
          error_stack?: string | null
          error_type: string
          id?: string
          ip_address?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          session_id?: string | null
          severity?: string | null
          source?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string
          error_code?: string | null
          error_message?: string
          error_stack?: string | null
          error_type?: string
          id?: string
          ip_address?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          session_id?: string | null
          severity?: string | null
          source?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      faqs: {
        Row: {
          answer: string
          category: string | null
          created_at: string
          id: string
          is_active: boolean
          question: string
        }
        Insert: {
          answer: string
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          question: string
        }
        Update: {
          answer?: string
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          question?: string
        }
        Relationships: []
      }
      knowledge_base: {
        Row: {
          category: string | null
          created_at: string
          file_type: string
          file_url: string
          id: string
          is_active: boolean
          original_content: string | null
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          file_type?: string
          file_url: string
          id?: string
          is_active?: boolean
          original_content?: string | null
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          file_type?: string
          file_url?: string
          id?: string
          is_active?: boolean
          original_content?: string | null
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      message_templates: {
        Row: {
          category: string | null
          content: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          price: number
          product_id: string | null
          product_name: string
          quantity: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          price: number
          product_id?: string | null
          product_name: string
          quantity?: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          price?: number
          product_id?: string | null
          product_name?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          coupon_code: string | null
          created_at: string
          customer_address: string
          customer_facebook_id: string | null
          customer_line_id: string | null
          customer_name: string
          customer_phone: string
          discount_amount: number | null
          id: string
          notes: string | null
          order_number: string
          platform: string
          status: Database["public"]["Enums"]["order_status"]
          total_amount: number
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          coupon_code?: string | null
          created_at?: string
          customer_address: string
          customer_facebook_id?: string | null
          customer_line_id?: string | null
          customer_name: string
          customer_phone: string
          discount_amount?: number | null
          id?: string
          notes?: string | null
          order_number: string
          platform?: string
          status?: Database["public"]["Enums"]["order_status"]
          total_amount?: number
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          coupon_code?: string | null
          created_at?: string
          customer_address?: string
          customer_facebook_id?: string | null
          customer_line_id?: string | null
          customer_name?: string
          customer_phone?: string
          discount_amount?: number | null
          id?: string
          notes?: string | null
          order_number?: string
          platform?: string
          status?: Database["public"]["Enums"]["order_status"]
          total_amount?: number
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payment_slips: {
        Row: {
          admin_notes: string | null
          analyzed_account: string | null
          analyzed_amount: number | null
          analyzed_bank: string | null
          analyzed_date: string | null
          auto_verified: boolean
          confidence_score: number | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          id: string
          image_url: string
          order_id: string
          platform: string
          platform_user_id: string
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          analyzed_account?: string | null
          analyzed_amount?: number | null
          analyzed_bank?: string | null
          analyzed_date?: string | null
          auto_verified?: boolean
          confidence_score?: number | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          image_url: string
          order_id: string
          platform?: string
          platform_user_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          analyzed_account?: string | null
          analyzed_amount?: number | null
          analyzed_bank?: string | null
          analyzed_date?: string | null
          auto_verified?: boolean
          confidence_score?: number | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          image_url?: string
          order_id?: string
          platform?: string
          platform_user_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_slips_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      product_faqs: {
        Row: {
          answer: string
          created_at: string
          id: string
          is_active: boolean
          product_id: string
          question: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          is_active?: boolean
          product_id: string
          question: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          is_active?: boolean
          product_id?: string
          question?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_faqs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          price: number
          promotion_price: number | null
          specifications: string | null
          stock: number
          updated_at: string
          variants: Json | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          price?: number
          promotion_price?: number | null
          specifications?: string | null
          stock?: number
          updated_at?: string
          variants?: Json | null
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          price?: number
          promotion_price?: number | null
          specifications?: string | null
          stock?: number
          updated_at?: string
          variants?: Json | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          identifier: string
          request_count: number
          window_start: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          identifier: string
          request_count?: number
          window_start?: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          identifier?: string
          request_count?: number
          window_start?: string
        }
        Relationships: []
      }
      related_products: {
        Row: {
          created_at: string
          id: string
          product_id: string
          related_product_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          related_product_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          related_product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "related_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "related_products_related_product_id_fkey"
            columns: ["related_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      scraped_content: {
        Row: {
          content: string | null
          created_at: string
          id: string
          is_active: boolean
          last_scraped_at: string | null
          next_scrape_at: string | null
          scrape_interval: string | null
          source_name: string | null
          summary: string | null
          title: string | null
          updated_at: string
          url: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          last_scraped_at?: string | null
          next_scrape_at?: string | null
          scrape_interval?: string | null
          source_name?: string | null
          summary?: string | null
          title?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          last_scraped_at?: string | null
          next_scrape_at?: string | null
          scrape_interval?: string | null
          source_name?: string | null
          summary?: string | null
          title?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      shopping_carts: {
        Row: {
          conversation_id: string | null
          created_at: string
          id: string
          platform_user_id: string
          price: number
          product_id: string | null
          product_name: string
          quantity: number
          updated_at: string
          variants: string | null
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          platform_user_id: string
          price: number
          product_id?: string | null
          product_name: string
          quantity?: number
          updated_at?: string
          variants?: string | null
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          platform_user_id?: string
          price?: number
          product_id?: string | null
          product_name?: string
          quantity?: number
          updated_at?: string
          variants?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shopping_carts_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_carts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      store_subscription: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          messages_reset_at: string
          messages_used: number
          plan_id: string
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          messages_reset_at?: string
          messages_used?: number
          plan_id: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          messages_reset_at?: string
          messages_used?: number
          plan_id?: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_subscription_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          billing_period: string
          created_at: string
          features: Json
          id: string
          is_active: boolean
          max_messages_per_month: number | null
          max_platforms: number
          max_products: number | null
          name: string
          name_th: string
          price: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          billing_period?: string
          created_at?: string
          features?: Json
          id?: string
          is_active?: boolean
          max_messages_per_month?: number | null
          max_platforms?: number
          max_products?: number | null
          name: string
          name_th: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          billing_period?: string
          created_at?: string
          features?: Json
          id?: string
          is_active?: boolean
          max_messages_per_month?: number | null
          max_platforms?: number
          max_products?: number | null
          name?: string
          name_th?: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_rate_limit: {
        Args: {
          p_endpoint: string
          p_identifier: string
          p_max_requests?: number
          p_window_seconds?: number
        }
        Returns: Json
      }
      cleanup_rate_limits: { Args: never; Returns: undefined }
      create_admin_notification: {
        Args: {
          p_data?: Json
          p_message: string
          p_title: string
          p_type: string
        }
        Returns: string
      }
      get_conversation_platform_user_id: {
        Args: { conv_id: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      order_status:
        | "pending"
        | "confirmed"
        | "payment_confirmed"
        | "shipped"
        | "delivered"
        | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      order_status: [
        "pending",
        "confirmed",
        "payment_confirmed",
        "shipped",
        "delivered",
        "cancelled",
      ],
    },
  },
} as const
