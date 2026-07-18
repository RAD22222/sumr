"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase/client"
import { useChatStore } from "@/store/chat-store"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { formatDistanceToNow } from "date-fns"
import { MessageSquare, Loader2 } from "lucide-react"
import type { Conversation } from "@/lib/types"

export default function ChatListSidebar() {
  const { conversations, setConversations } = useChatStore()
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = getSupabaseClient()

  useEffect(() => {
    loadConversations()

    const channel = supabase
      .channel("conversations")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        () => {
          loadConversations()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function loadConversations() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from("conversation_participants")
      .select(
        `
        conversation_id,
        conversations!inner(
          id, created_at, last_message_at
        )
      `,
      )
      .eq("user_id", user.id)
      .order("conversations(last_message_at)", { ascending: false })

    if (!data) {
      setLoading(false)
      return
    }

    const conversationIds = data.map((d: any) => d.conversation_id)

    const { data: participants } = await supabase
      .from("conversation_participants")
      .select(
        `
        conversation_id,
        user_id,
        profiles!inner(id, email, display_name, avatar_url)
      `,
      )
      .in("conversation_id", conversationIds)

    const { data: messages } = await supabase
      .from("messages")
      .select("*")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: false })

    const latestMessages: Record<string, any> = {}
    messages?.forEach((msg) => {
      if (!latestMessages[msg.conversation_id]) {
        latestMessages[msg.conversation_id] = msg
      }
    })

    const convs: Conversation[] = data.map((d: any) => {
      const convParticipant = participants?.find(
        (p: any) => p.conversation_id === d.conversation_id,
      )
      const profile = (convParticipant as any)?.profiles
      const otherProfile = Array.isArray(profile) ? profile[0] : profile

      return {
        id: d.conversation_id,
        created_at: (d.conversations as any).created_at,
        last_message_at: (d.conversations as any).last_message_at,
        participants: otherProfile ? [otherProfile] : [],
        last_message: latestMessages[d.conversation_id] || null,
      }
    })

    setConversations(convs)
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <MessageSquare className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">No conversations yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Invite a friend to start chatting
        </p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="divide-y">
        {conversations.map((conv) => {
          const other = conv.participants?.[0]
          const isActive = pathname === `/chats/${conv.id}`
          const displayName = other?.display_name || other?.email || "Unknown"

          return (
            <button
              key={conv.id}
              onClick={() => {
                router.push(`/chats/${conv.id}`)
              }}
              className={cn(
                "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50",
                isActive && "bg-accent",
              )}
            >
              <Avatar>
                <AvatarImage src={other?.avatar_url || ""} />
                <AvatarFallback>
                  {displayName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium truncate">{displayName}</p>
                  {conv.last_message_at && (
                    <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                      {formatDistanceToNow(new Date(conv.last_message_at), {
                        addSuffix: true,
                      })}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {conv.last_message
                    ? conv.last_message.encrypted_content
                    : "No messages yet"}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </ScrollArea>
  )
}
