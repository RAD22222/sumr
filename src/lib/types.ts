export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Profile {
  id: string
  email: string
  display_name: string | null
  avatar_url: string | null
  public_key: string | null
  encrypted_private_key: string | null
  created_at: string
}

export interface Conversation {
  id: string
  created_at: string
  last_message_at: string | null
  participants?: Profile[]
  last_message?: Message | null
  unread_count?: number
}

export interface ConversationParticipant {
  conversation_id: string
  user_id: string
  encrypted_symmetric_key: string
  joined_at: string
  profile?: Profile
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  encrypted_content: string
  nonce: string
  created_at: string
  sender?: Profile
  decrypted_content?: string
  status?: 'sending' | 'sent' | 'delivered' | 'read'
}

export interface Invite {
  id: string
  sender_id: string
  recipient_email: string
  code: string
  status: 'pending' | 'accepted' | 'expired'
  created_at: string
  accepted_at: string | null
  sender?: Profile
}

export interface CryptoKeyPair {
  publicKey: JsonWebKey
  privateKey: JsonWebKey
}

export interface SymmetricKeySet {
  key: CryptoKey
  raw: ArrayBuffer
}
