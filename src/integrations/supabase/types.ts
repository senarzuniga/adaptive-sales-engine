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
      after_sales_opportunities: {
        Row: {
          ai_generated: boolean | null
          asset_id: string | null
          company_id: string
          created_at: string
          customer_name: string | null
          description: string | null
          estimated_value: number | null
          id: string
          opportunity_type: string
          probability: number | null
          recommended_action: string | null
          status: string
          title: string
          trigger_signal: string | null
          updated_at: string
        }
        Insert: {
          ai_generated?: boolean | null
          asset_id?: string | null
          company_id: string
          created_at?: string
          customer_name?: string | null
          description?: string | null
          estimated_value?: number | null
          id?: string
          opportunity_type?: string
          probability?: number | null
          recommended_action?: string | null
          status?: string
          title?: string
          trigger_signal?: string | null
          updated_at?: string
        }
        Update: {
          ai_generated?: boolean | null
          asset_id?: string | null
          company_id?: string
          created_at?: string
          customer_name?: string | null
          description?: string | null
          estimated_value?: number | null
          id?: string
          opportunity_type?: string
          probability?: number | null
          recommended_action?: string | null
          status?: string
          title?: string
          trigger_signal?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "after_sales_opportunities_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "installed_base_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "after_sales_opportunities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
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
      cost_breakdowns: {
        Row: {
          category: string
          created_at: string
          days: number | null
          hourly_rate: number | null
          hours: number | null
          id: string
          line_item: string
          notes: string | null
          offer_item_id: string
          quantity: number
          resources: number | null
          surcharge_pct: number | null
          total_cost: number
          unit_cost: number
        }
        Insert: {
          category?: string
          created_at?: string
          days?: number | null
          hourly_rate?: number | null
          hours?: number | null
          id?: string
          line_item?: string
          notes?: string | null
          offer_item_id: string
          quantity?: number
          resources?: number | null
          surcharge_pct?: number | null
          total_cost?: number
          unit_cost?: number
        }
        Update: {
          category?: string
          created_at?: string
          days?: number | null
          hourly_rate?: number | null
          hours?: number | null
          id?: string
          line_item?: string
          notes?: string | null
          offer_item_id?: string
          quantity?: number
          resources?: number | null
          surcharge_pct?: number | null
          total_cost?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "cost_breakdowns_offer_item_id_fkey"
            columns: ["offer_item_id"]
            isOneToOne: false
            referencedRelation: "offer_items"
            referencedColumns: ["id"]
          },
        ]
      }
      installed_base_assets: {
        Row: {
          asset_name: string
          asset_type: string | null
          company_id: string
          configuration: Json | null
          connection_status: string
          country: string | null
          created_at: string
          customer_name: string | null
          customer_value_segment: string | null
          id: string
          installation_date: string | null
          last_service_date: string | null
          lifecycle_stage: string
          location: string | null
          next_service_due: string | null
          notes: string | null
          region: string | null
          risk_level: string | null
          serial_number: string
          updated_at: string
          usage_intensity: string | null
          warranty_expiry: string | null
        }
        Insert: {
          asset_name?: string
          asset_type?: string | null
          company_id: string
          configuration?: Json | null
          connection_status?: string
          country?: string | null
          created_at?: string
          customer_name?: string | null
          customer_value_segment?: string | null
          id?: string
          installation_date?: string | null
          last_service_date?: string | null
          lifecycle_stage?: string
          location?: string | null
          next_service_due?: string | null
          notes?: string | null
          region?: string | null
          risk_level?: string | null
          serial_number?: string
          updated_at?: string
          usage_intensity?: string | null
          warranty_expiry?: string | null
        }
        Update: {
          asset_name?: string
          asset_type?: string | null
          company_id?: string
          configuration?: Json | null
          connection_status?: string
          country?: string | null
          created_at?: string
          customer_name?: string | null
          customer_value_segment?: string | null
          id?: string
          installation_date?: string | null
          last_service_date?: string | null
          lifecycle_stage?: string
          location?: string | null
          next_service_due?: string | null
          notes?: string | null
          region?: string | null
          risk_level?: string | null
          serial_number?: string
          updated_at?: string
          usage_intensity?: string | null
          warranty_expiry?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "installed_base_assets_company_id_fkey"
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
      offer_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          item_name: string
          item_type: string
          offer_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          item_name?: string
          item_type?: string
          offer_id: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          item_name?: string
          item_type?: string
          offer_id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_items_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_scenarios: {
        Row: {
          ai_analysis: Json | null
          created_at: string
          id: string
          margin_amount: number
          margin_pct: number
          offer_id: string
          risk_level: string | null
          scenario_type: string
          selling_price: number
          total_cost: number
          updated_at: string
        }
        Insert: {
          ai_analysis?: Json | null
          created_at?: string
          id?: string
          margin_amount?: number
          margin_pct?: number
          offer_id: string
          risk_level?: string | null
          scenario_type?: string
          selling_price?: number
          total_cost?: number
          updated_at?: string
        }
        Update: {
          ai_analysis?: Json | null
          created_at?: string
          id?: string
          margin_amount?: number
          margin_pct?: number
          offer_id?: string
          risk_level?: string | null
          scenario_type?: string
          selling_price?: number
          total_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_scenarios_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_scores: {
        Row: {
          ai_explanation: string | null
          created_at: string
          global_score: number | null
          id: string
          margin_score: string | null
          offer_id: string
          recommendations: Json | null
          risk_factors: Json | null
          risk_score: string | null
          updated_at: string
        }
        Insert: {
          ai_explanation?: string | null
          created_at?: string
          global_score?: number | null
          id?: string
          margin_score?: string | null
          offer_id: string
          recommendations?: Json | null
          risk_factors?: Json | null
          risk_score?: string | null
          updated_at?: string
        }
        Update: {
          ai_explanation?: string | null
          created_at?: string
          global_score?: number | null
          id?: string
          margin_score?: string | null
          offer_id?: string
          recommendations?: Json | null
          risk_factors?: Json | null
          risk_score?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_scores_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          company_id: string
          created_at: string
          currency: string
          customer_name: string
          id: string
          notes: string | null
          offer_number: string
          project_description: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          currency?: string
          customer_name?: string
          id?: string
          notes?: string | null
          offer_number?: string
          project_description?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          currency?: string
          customer_name?: string
          id?: string
          notes?: string | null
          offer_number?: string
          project_description?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_company_id_fkey"
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
      service_contracts: {
        Row: {
          annual_value: number | null
          asset_id: string | null
          company_id: string
          contract_name: string
          contract_type: string
          created_at: string
          customer_name: string | null
          end_date: string | null
          id: string
          includes_parts: boolean | null
          includes_predictive: boolean | null
          includes_remote: boolean | null
          kpis: Json | null
          notes: string | null
          recurring_revenue_type: string | null
          sla_response_hours: number | null
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          annual_value?: number | null
          asset_id?: string | null
          company_id: string
          contract_name?: string
          contract_type?: string
          created_at?: string
          customer_name?: string | null
          end_date?: string | null
          id?: string
          includes_parts?: boolean | null
          includes_predictive?: boolean | null
          includes_remote?: boolean | null
          kpis?: Json | null
          notes?: string | null
          recurring_revenue_type?: string | null
          sla_response_hours?: number | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          annual_value?: number | null
          asset_id?: string | null
          company_id?: string
          contract_name?: string
          contract_type?: string
          created_at?: string
          customer_name?: string | null
          end_date?: string | null
          id?: string
          includes_parts?: boolean | null
          includes_predictive?: boolean | null
          includes_remote?: boolean | null
          kpis?: Json | null
          notes?: string | null
          recurring_revenue_type?: string | null
          sla_response_hours?: number | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_contracts_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "installed_base_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_contracts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      service_interventions: {
        Row: {
          asset_id: string | null
          company_id: string
          completed_date: string | null
          cost: number | null
          created_at: string
          description: string | null
          duration_hours: number | null
          id: string
          intervention_type: string
          notes: string | null
          parts_used: Json | null
          resolution: string | null
          scheduled_date: string | null
          technician: string | null
          was_remote: boolean | null
        }
        Insert: {
          asset_id?: string | null
          company_id: string
          completed_date?: string | null
          cost?: number | null
          created_at?: string
          description?: string | null
          duration_hours?: number | null
          id?: string
          intervention_type?: string
          notes?: string | null
          parts_used?: Json | null
          resolution?: string | null
          scheduled_date?: string | null
          technician?: string | null
          was_remote?: boolean | null
        }
        Update: {
          asset_id?: string | null
          company_id?: string
          completed_date?: string | null
          cost?: number | null
          created_at?: string
          description?: string | null
          duration_hours?: number | null
          id?: string
          intervention_type?: string
          notes?: string | null
          parts_used?: Json | null
          resolution?: string | null
          scheduled_date?: string | null
          technician?: string | null
          was_remote?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "service_interventions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "installed_base_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_interventions_company_id_fkey"
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
      spare_parts: {
        Row: {
          asset_type: string | null
          category: string
          company_id: string
          created_at: string
          criticality: string | null
          demand_trend: string | null
          description: string | null
          dynamic_price: number | null
          id: string
          is_active: boolean
          last_ordered_at: string | null
          lead_time_days: number | null
          margin_pct: number | null
          min_stock_level: number
          part_name: string
          part_number: string
          predicted_demand_monthly: number | null
          reorder_point: number
          reorder_quantity: number
          selling_price: number
          stock_quantity: number
          supplier: string | null
          total_units_sold: number | null
          unit_cost: number
          updated_at: string
        }
        Insert: {
          asset_type?: string | null
          category?: string
          company_id: string
          created_at?: string
          criticality?: string | null
          demand_trend?: string | null
          description?: string | null
          dynamic_price?: number | null
          id?: string
          is_active?: boolean
          last_ordered_at?: string | null
          lead_time_days?: number | null
          margin_pct?: number | null
          min_stock_level?: number
          part_name?: string
          part_number?: string
          predicted_demand_monthly?: number | null
          reorder_point?: number
          reorder_quantity?: number
          selling_price?: number
          stock_quantity?: number
          supplier?: string | null
          total_units_sold?: number | null
          unit_cost?: number
          updated_at?: string
        }
        Update: {
          asset_type?: string | null
          category?: string
          company_id?: string
          created_at?: string
          criticality?: string | null
          demand_trend?: string | null
          description?: string | null
          dynamic_price?: number | null
          id?: string
          is_active?: boolean
          last_ordered_at?: string | null
          lead_time_days?: number | null
          margin_pct?: number | null
          min_stock_level?: number
          part_name?: string
          part_number?: string
          predicted_demand_monthly?: number | null
          reorder_point?: number
          reorder_quantity?: number
          selling_price?: number
          stock_quantity?: number
          supplier?: string | null
          total_units_sold?: number | null
          unit_cost?: number
          updated_at?: string
        }
        Relationships: []
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
