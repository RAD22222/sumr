"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { getSupabaseClient } from "@/lib/supabase/client"
import { e2ee } from "@/lib/crypto/encryption"
import { useChatStore } from "@/store/chat-store"
import ConversationHeader from "./ConversationHeader"
import MessageBubble from "./MessageBubble"
import MessageInput from "./MessageInput"
import { Loader2 } from "lucide-react"
import type { Profile, Message, ReplyTo } from "@/lib/types"

interface ConversationViewProps {
  conversationId: string
}

export default function ConversationView({
  conversationId,
}: ConversationViewProps) {
  const [otherUser, setOtherUser] = useState<Profile | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [replyTarget, setReplyTarget] = useState<ReplyTo | null>(null)
  const scrollAnchorRef = useRef<HTMLDivElement>(null)
  const shouldAutoScroll = useRef(true)

  const { conversationKeys, setConversationKey } = useChatStore()
  const supabase = getSupabaseClient()

  // ---------------------------------------------------------------------------
  // E2EE helpers
  // ---------------------------------------------------------------------------

  /**
   * Attempt to decrypt a message's content.
   * Falls back to showing a "🔒 Encrypted message" placeholder if:
   *  - the conversation key isn't loaded yet
   *  - decryption fails (e.g., old message from before key exchange)
   */
  const decryptContent = useCallback(
    async (msg: Message, convKey: string | undefined): Promise<string> => {
      if (!convKey || !msg.encrypted_content || !msg.nonce) {
        return "🔒 Encrypted message"
      }
      try {
        return await e2ee.decryptMessage(convKey, msg.encrypted_content, msg.nonce)
      } catch {
        return "🔒 Encrypted message"
      }
    },
    [],
  )

  /**
   * Ensure the conversation's symmetric key is loaded into the store.
   * Performs E2EE key exchange on the first open if the key is missing.
   */
  const ensureConversationKey = useCallback(
    async (userId: string): Promise<string | undefined> => {
      const existingKey = conversationKeys[conversationId]
      if (existingKey) return existingKey

      // Fetch our encrypted key from the DB.
      const { data: participantRow } = await supabase
        .from("conversation_participants")
        .select("encrypted_symmetric_key")
        .eq("conversation_id", conversationId)
        .eq("user_id", userId)
        .single()

      const encKey = participantRow?.encrypted_symmetric_key
      if (!encKey) return undefined

      try {
        const rawKey = await e2ee.getConversationKey(encKey)
        setConversationKey(conversationId, rawKey)
        return rawKey
      } catch {
        // Key exchange not yet completed for this conversation.
        return undefined
      }
    },
    [conversationId, conversationKeys, setConversationKey, supabase],
  )

  // ---------------------------------------------------------------------------
  // Message loading & enrichment
  // ---------------------------------------------------------------------------

  /**
   * Batch-fetch all reply-to messages in a single query (no N+1).
   * Also batch-fetches the sender profiles for those reply messages.
   */
  async function enrichMessages(
    msgs: Message[],
    convKey: string | undefined,
  ): Promise<Message[]> {
    // Collect all reply_to_id values (deduplicated).
    const replyIds = [
      ...new Set(
        msgs
          .map((m) => m.reply_to_id)
          .filter((id): id is string => !!id),
      ),
    ]

    // Build a map of reply message id → ReplyTo.
    const replyMap = new Map<string, ReplyTo>()

    if (replyIds.length > 0) {
      // Single query for all reply target messages.
      const { data: replyMsgs } = await supabase
        .from("messages")
        .select("id, sender_id, encrypted_content, nonce")
        .in("id", replyIds)

      if (replyMsgs && replyMsgs.length > 0) {
        // Batch-fetch all sender profiles in one query (avoids N+1).
        const senderIds = [...new Set(replyMsgs.map((m: any) => m.sender_id))]
        const { data: senderProfiles } = await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", senderIds)

        const profileMap = new Map(
          (senderProfiles ?? []).map((p: any) => [p.id, p]),
        )

        for (const rm of replyMsgs as any[]) {
          let replyContent: string
          try {
            replyContent = convKey
              ? await e2ee.decryptMessage(convKey, rm.encrypted_content, rm.nonce)
              : "🔒 Encrypted message"
          } catch {
            replyContent = "🔒 Encrypted message"
          }

          const profile = profileMap.get(rm.sender_id) as any
          replyMap.set(rm.id, {
            id: rm.id,
            content: replyContent,
            senderName: profile?.display_name ?? "Unknown",
          })
        }
      }
    }

    // Decrypt all messages and attach reply metadata.
    return Promise.all(
      msgs.map(async (m) => ({
        ...m,
        decrypted_content: await decryptContent(m, convKey),
        replyTo: m.reply_to_id ? (replyMap.get(m.reply_to_id) ?? null) : null,
      })),
    )
  }

  async function loadMessages(userId: string) {
    const convKey = await ensureConversationKey(userId)

    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })

    if (!data) return

    const enriched = await enrichMessages(data as Message[], convKey)
    setMessages(enriched)
  }

  // ---------------------------------------------------------------------------
  // Initialisation
  // ---------------------------------------------------------------------------

  useEffect(() => {
    initConversation()
  }, [conversationId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function initConversation() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUserId(user.id)

      const { data: participants } = await supabase
        .from("conversation_participants")
        .select("*, profiles!inner(*)")
        .eq("conversation_id", conversationId)

      if (!participants) {
        setLoading(false)
        return
      }

      // Find the other participant (not the current user).
      const otherParticipant = participants.find(
        (p: any) => p.user_id !== user.id,
      ) as any
      if (otherParticipant?.profiles) {
        const profile = Array.isArray(otherParticipant.profiles)
          ? otherParticipant.profiles[0]
          : otherParticipant.profiles
        setOtherUser(profile)
      }

      await loadMessages(user.id)
    } catch (err) {
      console.error("Init error:", err)
    } finally {
      setLoading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Real-time subscription
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload: any) => {
          if (cancelled) return
          const newMsg = payload.new as Message

          // Decrypt the incoming message with the current key from the store.
          const convKey = useChatStore.getState().conversationKeys[conversationId]
          const enriched = await enrichMessages([newMsg], convKey)
          if (!cancelled) {
            setMessages((prev) => [...prev, enriched[0]])
          }
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [conversationId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Auto-scroll
  // ---------------------------------------------------------------------------

  const handleScroll = () => {
    const el = scrollAnchorRef.current?.parentElement
    if (!el) return
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    shouldAutoScroll.current = distFromBottom < 100
  }

  useEffect(() => {
    if (shouldAutoScroll.current) {
      scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages])

  // ---------------------------------------------------------------------------
  // Send
  // ---------------------------------------------------------------------------

  const handleSend = useCallback(
    async (content: string) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const convKey = conversationKeys[conversationId]
      let encrypted_content = content
      let nonce = ""

      // Encrypt the message if we have the conversation key.
      if (convKey) {
        try {
          const payload = await e2ee.encryptMessage(convKey, content)
          encrypted_content = payload.encrypted_content
          nonce = payload.nonce
        } catch {
          // Fall through — send plaintext if encryption fails (should not happen).
        }
      }

      await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: user.id,
        encrypted_content,
        nonce,
        reply_to_id: replyTarget?.id ?? null,
      })

      setReplyTarget(null)
    },
    [conversationId, supabase, replyTarget, conversationKeys],
  )

  function handleReply(msg: ReplyTo) {
    setReplyTarget(msg)
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const displayName =
    otherUser?.display_name || otherUser?.email || "Unknown"

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <ConversationHeader
        name={displayName}
        avatarUrl={otherUser?.avatar_url}
      />

      <div
        className="flex-1 min-h-0 overflow-y-auto flex flex-col-reverse bg-muted/20"
        onScroll={handleScroll}
      >
        <div className="flex flex-col gap-0.5 px-4 py-2">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm text-muted-foreground">
                No messages yet
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Send a message to start the conversation
              </p>
            </div>
          )}
          {messages.map((msg, i) => {
            const prevMsg = i > 0 ? messages[i - 1] : null
            const showHeader = !prevMsg || prevMsg.sender_id !== msg.sender_id

            return (
              <div key={msg.id} className="animate-in slide-in-from-bottom-2 fade-in duration-200">
                {showHeader && !msg.replyTo && (
                  <div className="h-1" />
                )}
                <MessageBubble
                  message={msg}
                  isOwn={msg.sender_id === currentUserId}
                  onReply={handleReply}
                  currentUserId={currentUserId}
                />
              </div>
            )
          })}
          <div ref={scrollAnchorRef} className="h-px" />
        </div>
      </div>

      <MessageInput
        onSend={handleSend}
        replyTo={replyTarget}
        onCancelReply={() => setReplyTarget(null)}
      />
    </div>
  )
}
