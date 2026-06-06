export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      billing: {
        Row: {
          current_period_end: number | null;
          plan_id: string | null;
          polar_customer_id: string | null;
          status: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          current_period_end?: number | null;
          plan_id?: string | null;
          polar_customer_id?: string | null;
          status?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          current_period_end?: number | null;
          plan_id?: string | null;
          polar_customer_id?: string | null;
          status?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "billing_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "billing_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      categories: {
        Row: {
          created_at: string;
          description: string;
          id: string;
          name: string;
          slug: string;
        };
        Insert: {
          created_at?: string;
          description?: string;
          id?: string;
          name: string;
          slug: string;
        };
        Update: {
          created_at?: string;
          description?: string;
          id?: string;
          name?: string;
          slug?: string;
        };
        Relationships: [];
      };
      certificates: {
        Row: {
          course_id: string;
          course_title: string;
          id: string;
          issued_at: string;
          recipient_name: string;
          serial: string;
          user_id: string;
        };
        Insert: {
          course_id: string;
          course_title?: string;
          id?: string;
          issued_at?: string;
          recipient_name?: string;
          serial: string;
          user_id: string;
        };
        Update: {
          course_id?: string;
          course_title?: string;
          id?: string;
          issued_at?: string;
          recipient_name?: string;
          serial?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "certificates_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "certificates_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      comments: {
        Row: {
          ai_reason: string | null;
          author_image: string | null;
          author_name: string;
          body: string;
          created_at: string;
          id: string;
          status: string;
          user_id: string;
          video_id: string;
        };
        Insert: {
          ai_reason?: string | null;
          author_image?: string | null;
          author_name?: string;
          body: string;
          created_at?: string;
          id?: string;
          status?: string;
          user_id: string;
          video_id: string;
        };
        Update: {
          ai_reason?: string | null;
          author_image?: string | null;
          author_name?: string;
          body?: string;
          created_at?: string;
          id?: string;
          status?: string;
          user_id?: string;
          video_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "comments_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_video_id_fkey";
            columns: ["video_id"];
            isOneToOne: false;
            referencedRelation: "videos";
            referencedColumns: ["id"];
          },
        ];
      };
      course_progress: {
        Row: {
          completed_at: string | null;
          completed_lessons: number;
          course_id: string;
          last_lesson_id: string | null;
          percent: number;
          total_lessons: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          completed_at?: string | null;
          completed_lessons?: number;
          course_id: string;
          last_lesson_id?: string | null;
          percent?: number;
          total_lessons?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          completed_at?: string | null;
          completed_lessons?: number;
          course_id?: string;
          last_lesson_id?: string | null;
          percent?: number;
          total_lessons?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "course_progress_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "course_progress_last_lesson_id_fkey";
            columns: ["last_lesson_id"];
            isOneToOne: false;
            referencedRelation: "lessons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "course_progress_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      course_purchases: {
        Row: {
          amount: number;
          course_id: string;
          created_at: string;
          currency: string;
          polar_order_id: string | null;
          user_id: string;
        };
        Insert: {
          amount?: number;
          course_id: string;
          created_at?: string;
          currency?: string;
          polar_order_id?: string | null;
          user_id: string;
        };
        Update: {
          amount?: number;
          course_id?: string;
          created_at?: string;
          currency?: string;
          polar_order_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "course_purchases_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "course_purchases_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      courses: {
        Row: {
          access: string;
          body: string;
          category_id: string | null;
          created_at: string;
          custom_poster_url: string | null;
          description: string;
          drip_enabled: boolean;
          id: string;
          polar_product_id: string | null;
          price_amount: number | null;
          publish_at: string | null;
          publish_status: string;
          published_at: string | null;
          required_plan_ids: string[];
          search: unknown;
          slug: string;
          tags: string[];
          title: string;
          updated_at: string;
          visibility: string;
        };
        Insert: {
          access?: string;
          body?: string;
          category_id?: string | null;
          created_at?: string;
          custom_poster_url?: string | null;
          description?: string;
          drip_enabled?: boolean;
          id?: string;
          polar_product_id?: string | null;
          price_amount?: number | null;
          publish_at?: string | null;
          publish_status?: string;
          published_at?: string | null;
          required_plan_ids?: string[];
          search?: unknown;
          slug: string;
          tags?: string[];
          title: string;
          updated_at?: string;
          visibility?: string;
        };
        Update: {
          access?: string;
          body?: string;
          category_id?: string | null;
          created_at?: string;
          custom_poster_url?: string | null;
          description?: string;
          drip_enabled?: boolean;
          id?: string;
          polar_product_id?: string | null;
          price_amount?: number | null;
          publish_at?: string | null;
          publish_status?: string;
          published_at?: string | null;
          required_plan_ids?: string[];
          search?: unknown;
          slug?: string;
          tags?: string[];
          title?: string;
          updated_at?: string;
          visibility?: string;
        };
        Relationships: [
          {
            foreignKeyName: "courses_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      daily_views: {
        Row: {
          count: number;
          day: string;
        };
        Insert: {
          count?: number;
          day: string;
        };
        Update: {
          count?: number;
          day?: string;
        };
        Relationships: [];
      };
      lesson_progress: {
        Row: {
          completed_at: string | null;
          course_id: string;
          created_at: string;
          duration_seconds: number | null;
          lesson_id: string;
          position_seconds: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          completed_at?: string | null;
          course_id: string;
          created_at?: string;
          duration_seconds?: number | null;
          lesson_id: string;
          position_seconds?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          completed_at?: string | null;
          course_id?: string;
          created_at?: string;
          duration_seconds?: number | null;
          lesson_id?: string;
          position_seconds?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lesson_progress_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey";
            columns: ["lesson_id"];
            isOneToOne: false;
            referencedRelation: "lessons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lesson_progress_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      lessons: {
        Row: {
          course_id: string;
          created_at: string;
          description: string;
          drip_days: number;
          id: string;
          module_id: string;
          position: number;
          publish_status: string;
          slug: string;
          title: string;
          updated_at: string;
          video_id: string | null;
        };
        Insert: {
          course_id: string;
          created_at?: string;
          description?: string;
          drip_days?: number;
          id?: string;
          module_id: string;
          position?: number;
          publish_status?: string;
          slug: string;
          title: string;
          updated_at?: string;
          video_id?: string | null;
        };
        Update: {
          course_id?: string;
          created_at?: string;
          description?: string;
          drip_days?: number;
          id?: string;
          module_id?: string;
          position?: number;
          publish_status?: string;
          slug?: string;
          title?: string;
          updated_at?: string;
          video_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "lessons_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lessons_module_id_fkey";
            columns: ["module_id"];
            isOneToOne: false;
            referencedRelation: "modules";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lessons_video_id_fkey";
            columns: ["video_id"];
            isOneToOne: false;
            referencedRelation: "videos";
            referencedColumns: ["id"];
          },
        ];
      };
      likes: {
        Row: {
          created_at: string;
          user_id: string;
          video_id: string;
        };
        Insert: {
          created_at?: string;
          user_id: string;
          video_id: string;
        };
        Update: {
          created_at?: string;
          user_id?: string;
          video_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "likes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "likes_video_id_fkey";
            columns: ["video_id"];
            isOneToOne: false;
            referencedRelation: "videos";
            referencedColumns: ["id"];
          },
        ];
      };
      modules: {
        Row: {
          course_id: string;
          created_at: string;
          description: string;
          id: string;
          position: number;
          title: string;
          updated_at: string;
        };
        Insert: {
          course_id: string;
          created_at?: string;
          description?: string;
          id?: string;
          position?: number;
          title: string;
          updated_at?: string;
        };
        Update: {
          course_id?: string;
          created_at?: string;
          description?: string;
          id?: string;
          position?: number;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "modules_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
        ];
      };
      plans: {
        Row: {
          amount: number;
          created_at: string;
          currency: string;
          description: string;
          id: string;
          interval: string;
          name: string;
          polar_product_id: string;
        };
        Insert: {
          amount?: number;
          created_at?: string;
          currency?: string;
          description?: string;
          id?: string;
          interval?: string;
          name: string;
          polar_product_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          currency?: string;
          description?: string;
          id?: string;
          interval?: string;
          name?: string;
          polar_product_id?: string;
        };
        Relationships: [];
      };
      processed_webhooks: {
        Row: {
          created_at: string;
          id: string;
          provider: string;
        };
        Insert: {
          created_at?: string;
          id: string;
          provider: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          provider?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          banned: boolean;
          created_at: string;
          email: string | null;
          id: string;
          image: string | null;
          name: string;
          role: string;
        };
        Insert: {
          banned?: boolean;
          created_at?: string;
          email?: string | null;
          id: string;
          image?: string | null;
          name?: string;
          role?: string;
        };
        Update: {
          banned?: boolean;
          created_at?: string;
          email?: string | null;
          id?: string;
          image?: string | null;
          name?: string;
          role?: string;
        };
        Relationships: [];
      };
      purchases: {
        Row: {
          amount: number;
          created_at: string;
          currency: string;
          polar_order_id: string | null;
          user_id: string;
          video_id: string;
        };
        Insert: {
          amount?: number;
          created_at?: string;
          currency?: string;
          polar_order_id?: string | null;
          user_id: string;
          video_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          currency?: string;
          polar_order_id?: string | null;
          user_id?: string;
          video_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "purchases_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchases_video_id_fkey";
            columns: ["video_id"];
            isOneToOne: false;
            referencedRelation: "videos";
            referencedColumns: ["id"];
          },
        ];
      };
      rate_counters: {
        Row: {
          count: number;
          key: string;
          window_start: string;
        };
        Insert: {
          count?: number;
          key: string;
          window_start?: string;
        };
        Update: {
          count?: number;
          key?: string;
          window_start?: string;
        };
        Relationships: [];
      };
      settings: {
        Row: {
          data: Json;
          id: number;
          updated_at: string;
        };
        Insert: {
          data?: Json;
          id?: number;
          updated_at?: string;
        };
        Update: {
          data?: Json;
          id?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      tags: {
        Row: {
          created_at: string;
          name: string;
          slug: string;
        };
        Insert: {
          created_at?: string;
          name: string;
          slug: string;
        };
        Update: {
          created_at?: string;
          name?: string;
          slug?: string;
        };
        Relationships: [];
      };
      videos: {
        Row: {
          access: string;
          aspect_ratio: string | null;
          category_id: string | null;
          comment_count: number;
          created_at: string;
          custom_poster_url: string | null;
          description: string;
          duration: number | null;
          id: string;
          like_count: number;
          playback_policy: string;
          polar_product_id: string | null;
          price_amount: number | null;
          processing_status: string;
          publish_at: string | null;
          publish_status: string;
          published_at: string | null;
          required_plan_ids: string[];
          search: unknown;
          slug: string;
          stream_uid: string | null;
          tags: string[];
          thumbnail_time: number | null;
          title: string;
          transcript: string | null;
          updated_at: string;
          view_count: number;
          visibility: string;
        };
        Insert: {
          access?: string;
          aspect_ratio?: string | null;
          category_id?: string | null;
          comment_count?: number;
          created_at?: string;
          custom_poster_url?: string | null;
          description?: string;
          duration?: number | null;
          id?: string;
          like_count?: number;
          playback_policy?: string;
          polar_product_id?: string | null;
          price_amount?: number | null;
          processing_status?: string;
          publish_at?: string | null;
          publish_status?: string;
          published_at?: string | null;
          required_plan_ids?: string[];
          search?: unknown;
          slug: string;
          stream_uid?: string | null;
          tags?: string[];
          thumbnail_time?: number | null;
          title: string;
          transcript?: string | null;
          updated_at?: string;
          view_count?: number;
          visibility?: string;
        };
        Update: {
          access?: string;
          aspect_ratio?: string | null;
          category_id?: string | null;
          comment_count?: number;
          created_at?: string;
          custom_poster_url?: string | null;
          description?: string;
          duration?: number | null;
          id?: string;
          like_count?: number;
          playback_policy?: string;
          polar_product_id?: string | null;
          price_amount?: number | null;
          processing_status?: string;
          publish_at?: string | null;
          publish_status?: string;
          published_at?: string | null;
          required_plan_ids?: string[];
          search?: unknown;
          slug?: string;
          stream_uid?: string | null;
          tags?: string[];
          thumbnail_time?: number | null;
          title?: string;
          transcript?: string | null;
          updated_at?: string;
          view_count?: number;
          visibility?: string;
        };
        Relationships: [
          {
            foreignKeyName: "videos_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      check_rate_limit: {
        Args: { p_key: string; p_max: number; p_window_seconds: number };
        Returns: boolean;
      };
      current_profile_banned: { Args: never; Returns: boolean };
      current_profile_role: { Args: never; Returns: string };
      dashboard_stats: {
        Args: never;
        Returns: {
          flagged_comments: number;
          total_comments: number;
          total_likes: number;
          total_videos: number;
          total_views: number;
        }[];
      };
      increment_view: { Args: { p_video_id: string }; Returns: number };
      is_admin: { Args: never; Returns: boolean };
      issue_certificate: {
        Args: { p_course_id: string; p_user_id: string };
        Returns: {
          issued_at: string;
          serial: string;
        }[];
      };
      recompute_course_progress: {
        Args: { p_course_id: string; p_user_id: string };
        Returns: undefined;
      };
      save_lesson_progress: {
        Args: {
          p_duration: number;
          p_lesson_id: string;
          p_position: number;
          p_user_id: string;
        };
        Returns: {
          completed: boolean;
          course_id: string;
          percent: number;
        }[];
      };
      views_timeseries: {
        Args: { p_days: number };
        Returns: {
          day: string;
          views: number;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
