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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      companies: {
        Row: {
          additional_notes: string | null
          annual_revenue: string | null
          company_name: string
          created_at: string
          current_challenges: string | null
          employee_count: string | null
          headquarters: string | null
          id: string
          industry: string | null
          kam_count: string | null
          main_competitors: string | null
          main_customer_segments: string | null
          main_products: string | null
          operating_regions: string | null
          sales_channels: string | null
          sales_team_size: string | null
          strategic_goals: string | null
          sub_sector: string | null
          updated_at: string
        }
        Insert: {
          additional_notes?: string | null
          annual_revenue?: string | null
          company_name: string
          created_at?: string
          current_challenges?: string | null
          employee_count?: string | null
          headquarters?: string | null
          id?: string
          industry?: string | null
          kam_count?: string | null
          main_competitors?: string | null
          main_customer_segments?: string | null
          main_products?: string | null
          operating_regions?: string | null
          sales_channels?: string | null
          sales_team_size?: string | null
          strategic_goals?: string | null
          sub_sector?: string | null
          updated_at?: string
        }
        Update: {
          additional_notes?: string | null
          annual_revenue?: string | null
          company_name?: string
          created_at?: string
          current_challenges?: string | null
          employee_count?: string | null
          headquarters?: string | null
          id?: string
          industry?: string | null
          kam_count?: string | null
          main_competitors?: string | null
          main_customer_segments?: string | null
          main_products?: string | null
          operating_regions?: string | null
          sales_channels?: string | null
          sales_team_size?: string | null
          strategic_goals?: string | null
          sub_sector?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      company_contacts: {
        Row: {
          company_id: string
          created_at: string
          department: string
          email: string
          id: string
          is_default_handler: boolean
          name: string
          notes: string | null
          role: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          department?: string
          email?: string
          id?: string
          is_default_handler?: boolean
          name?: string
          notes?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          department?: string
          email?: string
          id?: string
          is_default_handler?: boolean
          name?: string
          notes?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_content: {
        Row: {
          alternative_versions: Json | null
          body: string
          call_to_action: string | null
          company_id: string
          content_type: string
          created_at: string
          hashtags: string[] | null
          id: string
          intelligence_sources: Json | null
          platform: string
          published_at: string | null
          scheduled_at: string | null
          status: string
          suggested_image_description: string | null
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          alternative_versions?: Json | null
          body?: string
          call_to_action?: string | null
          company_id: string
          content_type?: string
          created_at?: string
          hashtags?: string[] | null
          id?: string
          intelligence_sources?: Json | null
          platform?: string
          published_at?: string | null
          scheduled_at?: string | null
          status?: string
          suggested_image_description?: string | null
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          alternative_versions?: Json | null
          body?: string
          call_to_action?: string | null
          company_id?: string
          content_type?: string
          created_at?: string
          hashtags?: string[] | null
          id?: string
          intelligence_sources?: Json | null
          platform?: string
          published_at?: string | null
          scheduled_at?: string | null
          status?: string
          suggested_image_description?: string | null
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_content_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          company_id: string
          contact: string | null
          contract_prob: number | null
          country: string | null
          created_at: string
          customer_name: string | null
          est_purchasing_quarter: string | null
          est_purchasing_year: string | null
          est_revenue: number | null
          id: string
          kam: string | null
          margin: number | null
          opp_number: string | null
          product_family: string | null
          region: string | null
          scope: string | null
          segment: string | null
          status: string | null
        }
        Insert: {
          company_id: string
          contact?: string | null
          contract_prob?: number | null
          country?: string | null
          created_at?: string
          customer_name?: string | null
          est_purchasing_quarter?: string | null
          est_purchasing_year?: string | null
          est_revenue?: number | null
          id?: string
          kam?: string | null
          margin?: number | null
          opp_number?: string | null
          product_family?: string | null
          region?: string | null
          scope?: string | null
          segment?: string | null
          status?: string | null
        }
        Update: {
          company_id?: string
          contact?: string | null
          contract_prob?: number | null
          country?: string | null
          created_at?: string
          customer_name?: string | null
          est_purchasing_quarter?: string | null
          est_purchasing_year?: string | null
          est_revenue?: number | null
          id?: string
          kam?: string | null
          margin?: number | null
          opp_number?: string | null
          product_family?: string | null
          region?: string | null
          scope?: string | null
          segment?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          company_id: string
          country: string | null
          created_at: string
          customer_name: string | null
          first_offer_date: string | null
          id: string
          kam: string | null
          margin: number | null
          opp_number: string | null
          po_date: string | null
          product_family: string | null
          purchasing_month: string | null
          purchasing_quarter: string | null
          purchasing_year: string | null
          region: string | null
          scope: string | null
          segment: string | null
          selling_price: number | null
        }
        Insert: {
          company_id: string
          country?: string | null
          created_at?: string
          customer_name?: string | null
          first_offer_date?: string | null
          id?: string
          kam?: string | null
          margin?: number | null
          opp_number?: string | null
          po_date?: string | null
          product_family?: string | null
          purchasing_month?: string | null
          purchasing_quarter?: string | null
          purchasing_year?: string | null
          region?: string | null
          scope?: string | null
          segment?: string | null
          selling_price?: number | null
        }
        Update: {
          company_id?: string
          country?: string | null
          created_at?: string
          customer_name?: string | null
          first_offer_date?: string | null
          id?: string
          kam?: string | null
          margin?: number | null
          opp_number?: string | null
          po_date?: string | null
          product_family?: string | null
          purchasing_month?: string | null
          purchasing_quarter?: string | null
          purchasing_year?: string | null
          region?: string | null
          scope?: string | null
          segment?: string | null
          selling_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          average_value: number | null
          comments: string | null
          company_id: string
          created_at: string
          id: string
          name: string | null
          type: string | null
        }
        Insert: {
          average_value?: number | null
          comments?: string | null
          company_id: string
          created_at?: string
          id?: string
          name?: string | null
          type?: string | null
        }
        Update: {
          average_value?: number | null
          comments?: string | null
          company_id?: string
          created_at?: string
          id?: string
          name?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      social_media_accounts: {
        Row: {
          account_name: string
          api_credentials: Json | null
          company_id: string
          created_at: string
          id: string
          is_enabled: boolean
          notes: string | null
          platform: string
          posting_preferences: Json | null
          profile_url: string
          updated_at: string
        }
        Insert: {
          account_name?: string
          api_credentials?: Json | null
          company_id: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          notes?: string | null
          platform?: string
          posting_preferences?: Json | null
          profile_url?: string
          updated_at?: string
        }
        Update: {
          account_name?: string
          api_credentials?: Json | null
          company_id?: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          notes?: string | null
          platform?: string
          posting_preferences?: Json | null
          profile_url?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_media_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      strategy: {
        Row: {
          company_id: string
          created_at: string
          est_purchasing_quarter: string | null
          est_revenue: number | null
          id: string
          kam: string | null
          margin: number | null
          number_of_segment: string | null
          product_family: string | null
          region: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          est_purchasing_quarter?: string | null
          est_revenue?: number | null
          id?: string
          kam?: string | null
          margin?: number | null
          number_of_segment?: string | null
          product_family?: string | null
          region?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          est_purchasing_quarter?: string | null
          est_revenue?: number | null
          id?: string
          kam?: string | null
          margin?: number | null
          number_of_segment?: string | null
          product_family?: string | null
          region?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "strategy_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          action_content: Json | null
          action_result: Json | null
          assignee: string | null
          category: string
          company_id: string
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          notes: Json | null
          pillar: string
          priority: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          action_content?: Json | null
          action_result?: Json | null
          assignee?: string | null
          category?: string
          company_id: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          notes?: Json | null
          pillar?: string
          priority?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          action_content?: Json | null
          action_result?: Json | null
          assignee?: string | null
          category?: string
          company_id?: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          notes?: Json | null
          pillar?: string
          priority?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      upload_log: {
        Row: {
          company_id: string
          created_at: string
          detected_type: string
          errors: Json | null
          file_name: string
          id: string
          row_count: number | null
          status: string
        }
        Insert: {
          company_id: string
          created_at?: string
          detected_type: string
          errors?: Json | null
          file_name: string
          id?: string
          row_count?: number | null
          status?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          detected_type?: string
          errors?: Json | null
          file_name?: string
          id?: string
          row_count?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "upload_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
