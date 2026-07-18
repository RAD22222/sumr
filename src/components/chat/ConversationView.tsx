"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { getSupabaseClient } from "@/lib/supabase/client"
import ConversationHeader from "./ConversationHeader"
import MessageBubble from "./MessageBubble"
import MessageInput from "./MessageInput"
import { Loader2 } from "lucide-react"
import type { Profile, Message } from "@/lib/types"

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

    setMessages(
      data.map((msg: any) => ({
        ...msg,
        decrypted_content: msg.encrypted_content,
      })),
    )
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
        (payload: any) => {
          const newMsg = payload.new as Message
          setMessages((prev) => [
            ...prev,
            { ...newMsg, decrypted_content: newMsg.encrypted_content },
          ])
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

      await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: user.id,
        encrypted_content: content,
        nonce: "",
      })
    },
    [conversationId, supabase],
  )

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
    <div className="flex-1 flex flex-col h-dvh">
      <ConversationHeader
        name={displayName}
        avatarUrl={otherUser?.avatar_url}
      />

      <div
        className="flex-1 min-h-0 overflow-y-auto flex flex-col-reverse bg-muted/20"
        onScroll={handleScroll}
      >
        <div className="flex flex-col gap-1 px-4 py-2">
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
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              content={msg.decrypted_content || ""}
              isOwn={msg.sender_id === currentUserId}
              timestamp={msg.created_at}
              senderName={
                msg.sender_id !== currentUserId
                  ? displayName
                  : undefined
              }
              showSenderName={false}
            />
          ))}
          <div ref={scrollAnchorRef} className="h-px" />
        </div>
      </div>

      <MessageInput onSend={handleSend} />
    </div>
  )
}
