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
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          record_id: string | null
          record_type: string | null
          school_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          record_id?: string | null
          record_type?: string | null
          school_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          record_id?: string | null
          record_type?: string | null
          school_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          account: string
          amount: number
          category: string
          created_at: string
          description: string
          id: string
          method: string
          recorded_by: string
          school_id: string
          spent_on: string
          voucher_reference: string | null
        }
        Insert: {
          account?: string
          amount: number
          category: string
          created_at?: string
          description: string
          id?: string
          method?: string
          recorded_by: string
          school_id: string
          spent_on?: string
          voucher_reference?: string | null
        }
        Update: {
          account?: string
          amount?: number
          category?: string
          created_at?: string
          description?: string
          id?: string
          method?: string
          recorded_by?: string
          school_id?: string
          spent_on?: string
          voucher_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_types: {
        Row: {
          account: string
          active: boolean
          amount: number
          applies_to: string[]
          boarding_only: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          school_id: string
          term: number
          year: number
        }
        Insert: {
          account?: string
          active?: boolean
          amount: number
          applies_to?: string[]
          boarding_only?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          school_id: string
          term: number
          year: number
        }
        Update: {
          account?: string
          active?: boolean
          amount?: number
          applies_to?: string[]
          boarding_only?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          school_id?: string
          term?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "fee_types_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_allocations: {
        Row: {
          amount: number
          fee_type_id: string
          id: string
          receipt_id: string
          school_id: string
          student_id: string
        }
        Insert: {
          amount: number
          fee_type_id: string
          id?: string
          receipt_id: string
          school_id: string
          student_id: string
        }
        Update: {
          amount?: number
          fee_type_id?: string
          id?: string
          receipt_id?: string
          school_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "payment_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_school_id_fee_type_id_fkey"
            columns: ["school_id", "fee_type_id"]
            isOneToOne: false
            referencedRelation: "fee_types"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "payment_allocations_school_id_student_id_fkey"
            columns: ["school_id", "student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["school_id", "id"]
          },
        ]
      }
      payment_receipts: {
        Row: {
          created_at: string
          id: string
          method: string
          notes: string | null
          paid_on: string
          receipt_number: string
          received_by: string
          received_by_name: string | null
          reference: string | null
          school_id: string
          student_id: string
          term: number
          total: number
          void_reason: string | null
          voided: boolean
          voided_at: string | null
          voided_by: string | null
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          method: string
          notes?: string | null
          paid_on?: string
          receipt_number: string
          received_by: string
          received_by_name?: string | null
          reference?: string | null
          school_id: string
          student_id: string
          term: number
          total: number
          void_reason?: string | null
          voided?: boolean
          voided_at?: string | null
          voided_by?: string | null
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          method?: string
          notes?: string | null
          paid_on?: string
          receipt_number?: string
          received_by?: string
          received_by_name?: string | null
          reference?: string | null
          school_id?: string
          student_id?: string
          term?: number
          total?: number
          void_reason?: string | null
          voided?: boolean
          voided_at?: string | null
          voided_by?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "payment_receipts_school_id_student_id_fkey"
            columns: ["school_id", "student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["school_id", "id"]
          },
        ]
      }
      profiles: {
        Row: {
          id: string
          username: string
        }
        Insert: {
          id: string
          username: string
        }
        Update: {
          id?: string
          username?: string
        }
        Relationships: []
      }
      school_members: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["school_role"]
          school_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          role: Database["public"]["Enums"]["school_role"]
          school_id: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["school_role"]
          school_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_members_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          address: string | null
          bank_details: string | null
          code: string
          created_at: string
          created_by: string
          currency: string
          current_term: number
          current_year: number
          email: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          slogan: string | null
        }
        Insert: {
          address?: string | null
          bank_details?: string | null
          code: string
          created_at?: string
          created_by: string
          currency?: string
          current_term?: number
          current_year?: number
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          slogan?: string | null
        }
        Update: {
          address?: string | null
          bank_details?: string | null
          code?: string
          created_at?: string
          created_by?: string
          currency?: string
          current_term?: number
          current_year?: number
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          slogan?: string | null
        }
        Relationships: []
      }
      student_academic_records: {
        Row: {
          created_at: string
          grade: string
          id: string
          note: string | null
          recorded_by: string | null
          school_id: string
          student_id: string
          term: number
          year: number
        }
        Insert: {
          created_at?: string
          grade: string
          id?: string
          note?: string | null
          recorded_by?: string | null
          school_id: string
          student_id: string
          term: number
          year: number
        }
        Update: {
          created_at?: string
          grade?: string
          id?: string
          note?: string | null
          recorded_by?: string | null
          school_id?: string
          student_id?: string
          term?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "student_academic_records_school_id_student_id_fkey"
            columns: ["school_id", "student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["school_id", "id"]
          },
        ]
      }
      students: {
        Row: {
          boarding: boolean
          class_name: string | null
          created_at: string
          first_name: string
          gender: string | null
          grade: string
          guardian_name: string | null
          guardian_phone: string | null
          id: string
          last_name: string
          opening_balance: number
          reg_number: string
          school_id: string
          status: string
        }
        Insert: {
          boarding?: boolean
          class_name?: string | null
          created_at?: string
          first_name: string
          gender?: string | null
          grade: string
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          last_name: string
          opening_balance?: number
          reg_number: string
          school_id: string
          status?: string
        }
        Update: {
          boarding?: boolean
          class_name?: string | null
          created_at?: string
          first_name?: string
          gender?: string | null
          grade?: string
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          last_name?: string
          opening_balance?: number
          reg_number?: string
          school_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_attendance: {
        Row: {
          check_in: string | null
          check_out: string | null
          created_at: string
          day: string
          id: string
          notes: string | null
          recorded_by: string
          school_id: string
          status: string
          teacher_id: string
        }
        Insert: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          day?: string
          id?: string
          notes?: string | null
          recorded_by: string
          school_id: string
          status: string
          teacher_id: string
        }
        Update: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          day?: string
          id?: string
          notes?: string | null
          recorded_by?: string
          school_id?: string
          status?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_attendance_school_id_teacher_id_fkey"
            columns: ["school_id", "teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["school_id", "id"]
          },
        ]
      }
      teachers: {
        Row: {
          active: boolean
          created_at: string
          ec_number: string | null
          email: string | null
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          school_id: string
          subject: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          ec_number?: string | null
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          school_id: string
          subject?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          ec_number?: string | null
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          school_id?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teachers_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      collect_payment: {
        Args: {
          _items: Json
          _method: string
          _notes: string
          _paid_on: string
          _reference: string
          _student: string
        }
        Returns: string
      }
      create_student_with_arrears: {
        Args: { _arrears: Json; _student: Json }
        Returns: string
      }
      create_school: {
        Args: {
          _address: string
          _currency: string
          _email: string
          _full_name: string
          _name: string
          _phone: string
          _term: number
          _year: number
        }
        Returns: string
      }
      debtors: {
        Args: { _school: string }
        Returns: {
          balance: number
          due: number
          full_name: string
          grade: string
          guardian_phone: string
          paid: number
          reg_number: string
          student_id: string
        }[]
      }
      debtors_by_fee: {
        Args: { _school: string }
        Returns: {
          account: string
          balance: number
          due: number
          fee_name: string
          fee_type_id: string
          full_name: string
          grade: string
          guardian_phone: string
          paid: number
          reg_number: string
          student_id: string
        }[]
      }
      has_perm: { Args: { _perm: string; _school: string }; Returns: boolean }
      member_role: {
        Args: { _school: string }
        Returns: Database["public"]["Enums"]["school_role"]
      }
      promote_students: {
        Args: { _from: string; _school: string; _to: string }
        Returns: number
      }
      request_membership: {
        Args: {
          _code: string
          _full_name: string
          _role: Database["public"]["Enums"]["school_role"]
        }
        Returns: string
      }
      student_balances: {
        Args: { _student: string }
        Returns: {
          account: string
          balance: number
          due: number
          fee_type_id: string
          name: string
          paid: number
        }[]
      }
      void_receipt: {
        Args: { _reason: string; _receipt: string }
        Returns: undefined
      }
    }
    Enums: {
      school_role:
        | "head"
        | "bursar"
        | "deputy_head"
        | "admin"
        | "teacher"
        | "headmaster"
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
      school_role: [
        "head",
        "bursar",
        "deputy_head",
        "admin",
        "teacher",
        "headmaster",
      ],
    },
  },
} as const
