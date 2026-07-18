import { create } from "zustand"
import type { Conversation, Message, Profile } from "@/lib/types"

interface ChatState {
  conversations: Conversation[]
  activeConversationId: string | null
  conversationKeys: Record<string, string>
  pendingMessages: Record<string, Message[]>
  contacts: Profile[]
  onlineUsers: Set<string>

  setConversations: (conversations: Conversation[]) => void
  setActiveConversation: (id: string | null) => void
  setConversationKey: (conversationId: string, key: string) => void
  addPendingMessage: (conversationId: string, message: Message) => void
  removePendingMessage: (conversationId: string, messageId: string) => void
  setContacts: (contacts: Profile[]) => void
  setOnlineUsers: (userIds: string[]) => void
  addOnlineUser: (userId: string) => void
  removeOnlineUser: (userId: string) => void
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  activeConversationId: null,
  conversationKeys: {},
  pendingMessages: {},
  contacts: [],
  onlineUsers: new Set(),

  setConversations: (conversations) => set({ conversations }),

  setActiveConversation: (id) => set({ activeConversationId: id }),

  setConversationKey: (conversationId, key) =>
    set((state) => ({
      conversationKeys: { ...state.conversationKeys, [conversationId]: key },
    })),

  addPendingMessage: (conversationId, message) =>
    set((state) => ({
      pendingMessages: {
        ...state.pendingMessages,
        [conversationId]: [
          ...(state.pendingMessages[conversationId] || []),
          message,
        ],
      },
    })),

  removePendingMessage: (conversationId, messageId) =>
    set((state) => ({
      pendingMessages: {
        ...state.pendingMessages,
        [conversationId]: (
          state.pendingMessages[conversationId] || []
        ).filter((m) => m.id !== messageId),
      },
    })),

  setContacts: (contacts) => set({ contacts }),

  setOnlineUsers: (userIds) => set({ onlineUsers: new Set(userIds) }),

  addOnlineUser: (userId) =>
    set((state) => {
      const next = new Set(state.onlineUsers)
      next.add(userId)
      return { onlineUsers: next }
    }),

  removeOnlineUser: (userId) =>
    set((state) => {
      const next = new Set(state.onlineUsers)
      next.delete(userId)
      return { onlineUsers: next }
    }),
}))
