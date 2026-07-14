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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      budgets: {
        Row: {
          category: string
          created_at: string
          id: string
          limit: number
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          limit: number
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          limit?: number
          user_id?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          event_date: string | null
          event_time: string | null
          id: string
          legacy_meeting_date: string | null
          participants: number | null
          reminder_1h_sent: boolean | null
          reminder_sent: boolean | null
          status: string
          title: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          event_date?: string | null
          event_time?: string | null
          id?: string
          legacy_meeting_date?: string | null
          participants?: number | null
          reminder_1h_sent?: boolean | null
          reminder_sent?: boolean | null
          status?: string
          title: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          event_date?: string | null
          event_time?: string | null
          id?: string
          legacy_meeting_date?: string | null
          participants?: number | null
          reminder_1h_sent?: boolean | null
          reminder_sent?: boolean | null
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      family_groups: {
        Row: {
          created_at: string | null
          id: string
          max_members: number
          owner_id: string
          plan: string
          stripe_subscription_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          max_members?: number
          owner_id: string
          plan?: string
          stripe_subscription_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          max_members?: number
          owner_id?: string
          plan?: string
          stripe_subscription_id?: string | null
        }
        Relationships: []
      }
      family_members: {
        Row: {
          family_id: string
          id: string
          joined_at: string | null
          role: string
          user_id: string
        }
        Insert: {
          family_id: string
          id?: string
          joined_at?: string | null
          role?: string
          user_id: string
        }
        Update: {
          family_id?: string
          id?: string
          joined_at?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_members_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "family_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      folders: {
        Row: {
          created_at: string | null
          description: string | null
          emoji: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          emoji?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          emoji?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          category: string | null
          created_at: string | null
          current_amount: number | null
          deadline: string | null
          description: string | null
          id: string
          status: string | null
          target_amount: number
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          current_amount?: number | null
          deadline?: string | null
          description?: string | null
          id?: string
          status?: string | null
          target_amount: number
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          current_amount?: number | null
          deadline?: string | null
          description?: string | null
          id?: string
          status?: string | null
          target_amount?: number
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      google_calendar_tokens: {
        Row: {
          access_token: string
          calendar_id: string | null
          created_at: string | null
          id: string
          refresh_token: string | null
          sync_enabled: boolean | null
          token_expiry: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          calendar_id?: string | null
          created_at?: string | null
          id?: string
          refresh_token?: string | null
          sync_enabled?: boolean | null
          token_expiry?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          calendar_id?: string | null
          created_at?: string | null
          id?: string
          refresh_token?: string | null
          sync_enabled?: boolean | null
          token_expiry?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      inbox_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          response: string | null
          source: string
          status: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          response?: string | null
          source?: string
          status?: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          response?: string | null
          source?: string
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      lid_mappings: {
        Row: {
          created_at: string | null
          id: string
          lid: string
          phone: string
          push_name: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          lid: string
          phone: string
          push_name?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          lid?: string
          phone?: string
          push_name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      pending_payments: {
        Row: {
          amount_paid: number | null
          claimed: boolean | null
          claimed_at: string | null
          claimed_by: string | null
          created_at: string | null
          customer_name: string | null
          email: string
          id: string
          plan: string
          stripe_customer_id: string | null
          stripe_session_id: string | null
          stripe_subscription_id: string | null
        }
        Insert: {
          amount_paid?: number | null
          claimed?: boolean | null
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string | null
          customer_name?: string | null
          email: string
          id?: string
          plan: string
          stripe_customer_id?: string | null
          stripe_session_id?: string | null
          stripe_subscription_id?: string | null
        }
        Update: {
          amount_paid?: number | null
          claimed?: boolean | null
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string | null
          customer_name?: string | null
          email?: string
          id?: string
          plan?: string
          stripe_customer_id?: string | null
          stripe_session_id?: string | null
          stripe_subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_payments_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          last_payment_date: string | null
          onboarding_completed: boolean
          phone: string | null
          plan: string
          status: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_date: string | null
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          last_payment_date?: string | null
          onboarding_completed?: boolean
          phone?: string | null
          plan?: string
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_date?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          last_payment_date?: string | null
          onboarding_completed?: boolean
          phone?: string | null
          plan?: string
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_date?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          referral_code: string
          referred_id: string | null
          referrer_id: string
          reward_applied_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          referral_code: string
          referred_id?: string | null
          referrer_id: string
          reward_applied_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          referral_code?: string
          referred_id?: string | null
          referrer_id?: string
          reward_applied_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      refunds: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          reason: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          reason?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          reason?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          created_at: string
          due_date: string | null
          id: string
          priority: string
          project: string | null
          status: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          due_date?: string | null
          id?: string
          priority?: string
          project?: string | null
          status?: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          due_date?: string | null
          id?: string
          priority?: string
          project?: string | null
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          description: string
          folder_id: string | null
          id: string
          transaction_date: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          description: string
          folder_id?: string | null
          id?: string
          transaction_date?: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          description?: string
          folder_id?: string | null
          id?: string
          transaction_date?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_family_members: {
        Args: { p_family_id: string }
        Returns: {
          email: string
          full_name: string
          joined_at: string
          phone: string
          role: string
          user_id: string
        }[]
      }
      get_family_owner_id: { Args: { member_user_id: string }; Returns: string }
      get_remaining_spots: { Args: never; Returns: number }
      invite_family_member: {
        Args: { p_contact: string; p_family_id: string }
        Returns: Json
      }
      update_user_plan: {
        Args: {
          p_plan: string
          p_stripe_customer_id?: string
          p_stripe_subscription_id?: string
          p_user_id: string
        }
        Returns: undefined
      }
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
