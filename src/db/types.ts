// Database schema types for Supabase
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          google_id: string;
          email: string;
          name: string;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          google_id: string;
          email: string;
          name: string;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          google_id?: string;
          email?: string;
          name?: string;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      scans: {
        Row: {
          id: string;
          user_id: string;
          content: string;
          scan_type: 'qr' | 'barcode';
          format: string | null;
          scanned_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          content: string;
          scan_type: 'qr' | 'barcode';
          format?: string | null;
          scanned_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          content?: string;
          scan_type?: 'qr' | 'barcode';
          format?: string | null;
          scanned_at?: string;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      scan_type: 'qr' | 'barcode';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

// Convenience type aliases
export type User = Database['public']['Tables']['users']['Row'];
export type UserInsert = Database['public']['Tables']['users']['Insert'];
export type UserUpdate = Database['public']['Tables']['users']['Update'];

export type Scan = Database['public']['Tables']['scans']['Row'];
export type ScanInsert = Database['public']['Tables']['scans']['Insert'];
export type ScanUpdate = Database['public']['Tables']['scans']['Update'];

export type ScanType = Database['public']['Enums']['scan_type'];