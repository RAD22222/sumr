"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { getSupabaseClient } from "@/lib/supabase/client"
import { useChatStore } from "@/store/chat-store"
import { e2ee } from "@/lib/crypto/encryption"
import { decryptKeyWithMasterKey, base64ToArrayBuffer } from "@/lib/crypto/keyDerivation"
import ConversationHeader from "./ConversationHeader"
import MessageBubble from "./MessageBubble"
import MessageInput from "./MessageInput"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Lock } from "lucide-react"
import { toast } from "sonner"
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
  const [conversationKey, setConversationKey] = useState<string | null>(null)
  const [e2eeReady, setE2eeReady] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const scrollAnchorRef = useRef<HTMLDivElement>(null)
  const shouldAutoScroll = useRef(true)

  const supabase = getSupabaseClient()
  const { setActiveConversation, setConversationKey: storeKey } = useChatStore()

  useEffect(() => {
    setActiveConversation(conversationId)
    return () => setActiveConversation(null)
  }, [conversationId, setActiveConversation])

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

      const myParticipation = participants.find(
        (p: any) => p.user_id === user.id,
      ) as any

      let key = useChatStore.getState().conversationKeys[conversationId]

      if (!key && myParticipation?.encrypted_symmetric_key) {
        const password = sessionStorage.getItem("sumr_master_password")
        if (password) {
          await e2ee.initialize(password)
          const { data: profile } = await supabase
            .from("profiles")
            .select("encrypted_private_key, public_key")
            .eq("id", user.id)
            .single() as any
          if (profile?.encrypted_private_key && profile?.public_key) {
            await e2ee.loadKeys(profile.encrypted_private_key, profile.public_key)
          }
          key = await e2ee.getConversationKey(
            myParticipation.encrypted_symmetric_key,
          )
          storeKey(conversationId, key)
          setConversationKey(key)
          setE2eeReady(true)
        }
      } else if (key) {
        setConversationKey(key)
        setE2eeReady(true)
      }

      if (key) {
        await loadMessages(key)
      }
    } catch (err) {
      console.error("Init error:", err)
    } finally {
      setLoading(false)
    }
  }

  async function loadMessages(key: string) {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })

    if (!data) return

    if (key && e2ee.isInitialized()) {
      const decrypted = await Promise.all(
        data.map(async (msg: any) => {
          try {
            const content = await e2ee.decryptMessage(
              key,
              msg.encrypted_content,
              msg.nonce,
            )
            return { ...msg, decrypted_content: content } as Message
          } catch {
            return {
              ...msg,
              decrypted_content: "[Decryption failed]",
            } as Message
          }
        }),
      )
      setMessages(decrypted)
    } else {
      setMessages(data as Message[])
    }
  }

  useEffect(() => {
    if (!e2eeReady || !conversationKey) return

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
          if (conversationKey && e2ee.isInitialized()) {
            try {
              const content = await e2ee.decryptMessage(
                conversationKey,
                newMsg.encrypted_content,
                newMsg.nonce,
              )
              setMessages((prev) => [
                ...prev,
                { ...newMsg, decrypted_content: content },
              ])
            } catch {
              setMessages((prev) => [
                ...prev,
                { ...newMsg, decrypted_content: "[Decryption failed]" },
              ])
            }
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [e2eeReady, conversationKey, conversationId, supabase])

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
      if (!user || !conversationKey) {
        toast.error("Unlock the conversation first (enter your master password)")
        return
      }

      if (!e2ee.isInitialized()) {
        const password = sessionStorage.getItem("sumr_master_password")
        if (!password) {
          toast.error("Session expired. Please re-login.")
          return
        }
        await e2ee.initialize(password)
      }

      const encrypted = await e2ee.encryptMessage(conversationKey, content)

      await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: user.id,
        encrypted_content: encrypted.encrypted_content,
        nonce: encrypted.nonce,
      })
    },
    [conversationId, conversationKey, supabase],
  )

  const [passwordInput, setPasswordInput] = useState("")

  const handleUnlock = async () => {
    try {
      await e2ee.initialize(passwordInput)
      sessionStorage.setItem("sumr_master_password", passwordInput)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from("profiles")
        .select("encrypted_private_key, public_key")
        .eq("id", user.id)
        .single() as any

      if (profile?.encrypted_private_key && profile?.public_key) {
        await e2ee.loadKeys(
          profile.encrypted_private_key,
          profile.public_key,
        )
      }

      const { data: participants } = await supabase
        .from("conversation_participants")
        .select("*")
        .eq("conversation_id", conversationId)

      const myParticipation = (participants as any[])?.find(
        (p: any) => p.user_id === user.id,
      )

      if (myParticipation?.encrypted_symmetric_key) {
        const key = await e2ee.getConversationKey(
          myParticipation.encrypted_symmetric_key,
        )
        setConversationKey(key)
        storeKey(conversationId, key)
      } else {
        const otherParticipation = (participants as any[])?.find(
          (p: any) => p.user_id !== user.id,
        )
        if (otherParticipation?.encrypted_symmetric_key) {
          const key = await e2ee.decryptConversationKeyForOther(
            otherParticipation.encrypted_symmetric_key,
          )
          setConversationKey(key)
          storeKey(conversationId, key)
        }
      }

      setE2eeReady(true)
      setLoading(true)

      const storedKey = useChatStore.getState().conversationKeys[conversationId]
      if (storedKey) {
        await loadMessages(storedKey)
      }
      setLoading(false)
    } catch {
      setPasswordInput("")
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!e2eeReady) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-muted/20">
        <div className="max-w-sm w-full space-y-6 text-center">
          <div className="rounded-full bg-primary/10 p-4 mx-auto w-fit">
            <Lock className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Unlock conversation</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Enter your master password to decrypt this conversation
            </p>
          </div>
          <div className="space-y-3">
            <Input
              type="password"
              placeholder="Master password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
            />
            <Button
              onClick={handleUnlock}
              className="w-full"
              disabled={!passwordInput}
            >
              Unlock
            </Button>
          </div>
        </div>
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
              content={msg.decrypted_content || "[Encrypted]"}
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
