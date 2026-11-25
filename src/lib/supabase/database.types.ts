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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      rooms: {
        Row: {
          aliases: string[]
          bookable_for_teaching: boolean
          capacity: number
          code: string
          complexity: Database["public"]["Enums"]["room_acquisition_complexity"]
          created_at: string
          event_types: string[]
          updated_at: string
        }
        Insert: {
          aliases?: string[]
          bookable_for_teaching?: boolean
          capacity: number
          code: string
          complexity?: Database["public"]["Enums"]["room_acquisition_complexity"]
          created_at?: string
          event_types?: string[]
          updated_at?: string
        }
        Update: {
          aliases?: string[]
          bookable_for_teaching?: boolean
          capacity?: number
          code?: string
          complexity?: Database["public"]["Enums"]["room_acquisition_complexity"]
          created_at?: string
          event_types?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      saved_groups: {
        Row: {
          created_at: string
          id: string
          items: Json
          kind: Database["public"]["Enums"]["saved_group_kind"]
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          items: Json
          kind: Database["public"]["Enums"]["saved_group_kind"]
          name: string
          owner_id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          items?: Json
          kind?: Database["public"]["Enums"]["saved_group_kind"]
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      searches: {
        Row: {
          attendees: number | null
          complexity_weights: Json
          created_at: string
          csv_filename: string | null
          curricula: Json | null
          duration_minutes: number
          error: string | null
          event_type: string
          id: string
          name: string | null
          owner_id: string
          result: Json | null
          room_items: Json
          source_curriculum_group_id: string | null
          source_room_group_id: string | null
          status: Database["public"]["Enums"]["search_status"]
          time_windows: Json
          updated_at: string
        }
        Insert: {
          attendees?: number | null
          complexity_weights?: Json
          created_at?: string
          csv_filename?: string | null
          curricula?: Json | null
          duration_minutes: number
          error?: string | null
          event_type: string
          id?: string
          name?: string | null
          owner_id?: string
          result?: Json | null
          room_items: Json
          source_curriculum_group_id?: string | null
          source_room_group_id?: string | null
          status?: Database["public"]["Enums"]["search_status"]
          time_windows: Json
          updated_at?: string
        }
        Update: {
          attendees?: number | null
          complexity_weights?: Json
          created_at?: string
          csv_filename?: string | null
          curricula?: Json | null
          duration_minutes?: number
          error?: string | null
          event_type?: string
          id?: string
          name?: string | null
          owner_id?: string
          result?: Json | null
          room_items?: Json
          source_curriculum_group_id?: string | null
          source_room_group_id?: string | null
          status?: Database["public"]["Enums"]["search_status"]
          time_windows?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "searches_source_curriculum_group_fk"
            columns: ["source_curriculum_group_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "saved_groups"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "searches_source_room_group_fk"
            columns: ["source_room_group_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "saved_groups"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      event_type_popularity: {
        Args: never
        Returns: {
          event_type: string
          use_count: number
        }[]
      }
      is_utc_instant: { Args: { value: Json }; Returns: boolean }
      is_valid_complexity_weights: { Args: { weights: Json }; Returns: boolean }
      is_valid_group_items: {
        Args: {
          items: Json
          kind: Database["public"]["Enums"]["saved_group_kind"]
        }
        Returns: boolean
      }
      is_valid_json_text: {
        Args: { key: string; max_length: number; obj: Json; required: boolean }
        Returns: boolean
      }
      is_valid_label_array: {
        Args: { labels: string[]; max_count: number; max_length: number }
        Returns: boolean
      }
      is_valid_time_children: {
        Args: { key: string; min_count: number; node: Json }
        Returns: boolean
      }
      is_valid_time_node: {
        Args: {
          allowed_keys: string[]
          node: Json
          parent_end: string
          parent_start: string
        }
        Returns: boolean
      }
      is_valid_time_windows: { Args: { windows: Json }; Returns: boolean }
    }
    Enums: {
      room_acquisition_complexity:
        | "google_form"
        | "institute_permission"
        | "university_permission"
        | "contact_owner"
        | "other"
      saved_group_kind: "room" | "curriculum"
      search_status: "pending" | "running" | "done" | "failed"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      room_acquisition_complexity: [
        "google_form",
        "institute_permission",
        "university_permission",
        "contact_owner",
        "other",
      ],
      saved_group_kind: ["room", "curriculum"],
      search_status: ["pending", "running", "done", "failed"],
    },
  },
} as const
