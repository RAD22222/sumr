export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          display_name: string | null
          avatar_url: string | null
          public_key: string | null
          created_at: string
        }
        Insert: {
          id: string
          email: string
          display_name?: string | null
          avatar_url?: string | null
          public_key?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          display_name?: string | null
          avatar_url?: string | null
          public_key?: string | null
          created_at?: string
        }
      }
      conversations: {
        Row: {
          id: string
          created_at: string
          last_message_at: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          last_message_at?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          last_message_at?: string | null
        }
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          user_id: string
          encrypted_symmetric_key: string
          joined_at: string
        }
        Insert: {
          conversation_id: string
          user_id: string
          encrypted_symmetric_key: string
          joined_at?: string
        }
        Update: {
          conversation_id?: string
          user_id?: string
          encrypted_symmetric_key?: string
          joined_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          sender_id: string
          encrypted_content: string
          nonce: string
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          sender_id: string
          encrypted_content: string
          nonce: string
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          sender_id?: string
          encrypted_content?: string
          nonce?: string
          created_at?: string
        }
      }
      invites: {
        Row: {
          id: string
          sender_id: string
          recipient_email: string
          code: string
          status: string
          created_at: string
          accepted_at: string | null
        }
        Insert: {
          id?: string
          sender_id: string
          recipient_email: string
          code: string
          status?: string
          created_at?: string
          accepted_at?: string | null
        }
        Update: {
          id?: string
          sender_id?: string
          recipient_email?: string
          code?: string
          status?: string
          created_at?: string
          accepted_at?: string | null
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
