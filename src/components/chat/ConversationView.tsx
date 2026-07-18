"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { getSupabaseClient } from "@/lib/supabase/client"
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

  const supabase = getSupabaseClient()

  useEffect(() => {
    initConversation()
  }, [conversationId])

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

      const other = participants.find((p: any) => p.user_id !== user.id) as any
      if (other?.profiles) {
        const profile = Array.isArray(other.profiles)
          ? other.profiles[0]
          : other.profiles
        setOtherUser(profile)
      }

      await loadMessages()
    } catch (err) {
      console.error("Init error:", err)
    } finally {
      setLoading(false)
    }
  }

  async function loadMessages() {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })

    if (!data) return

    const enriched = await enrichMessages(data as Message[])
    setMessages(enriched)
  }

  async function enrichMessages(msgs: Message[]): Promise<Message[]> {
    const replyIds = msgs
      .map((m) => m.nonce?.startsWith("reply:") ? m.nonce.slice(6) : null)
      .filter(Boolean) as string[]

    if (replyIds.length === 0) return msgs.map((m) => ({ ...m, decrypted_content: m.encrypted_content }))

    const { data: replyMsgs } = await supabase
      .from("messages")
      .select("id, sender_id, encrypted_content")
      .in("id", replyIds)

    const replyMap = new Map<string, any>()
    if (replyMsgs) {
      for (const rm of replyMsgs) {
        const { data: senderProfile } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", rm.sender_id)
          .single() as any

        replyMap.set(rm.id, {
          id: rm.id,
          content: rm.encrypted_content,
          senderName: senderProfile?.display_name || "Unknown",
        })
      }
    }

    return msgs.map((m) => {
      const replyId = m.nonce?.startsWith("reply:") ? m.nonce.slice(6) : null
      return {
        ...m,
        decrypted_content: m.encrypted_content,
        replyTo: replyId ? replyMap.get(replyId) || undefined : undefined,
      }
    })
  }

  useEffect(() => {
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
          const newMsg = payload.new as Message
          const enriched = await enrichMessages([newMsg])
          setMessages((prev) => [...prev, enriched[0]])
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, supabase])

  const handleScroll = () => {
    const el = scrollAnchorRef.current?.parentElement
    if (!el) return
    shouldAutoScroll.current = el.scrollTop < 100
  }

  useEffect(() => {
    if (shouldAutoScroll.current) {
      scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages])

  const handleSend = useCallback(
    async (content: string) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const msg: any = {
        conversation_id: conversationId,
        sender_id: user.id,
        encrypted_content: content,
        nonce: replyTarget ? `reply:${replyTarget.id}` : "",
      }

      await supabase.from("messages").insert(msg)
      setReplyTarget(null)
    },
    [conversationId, supabase, replyTarget],
  )

  function handleReply(msg: ReplyTo) {
    setReplyTarget(msg)
  }

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
