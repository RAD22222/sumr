"use client"

import { useEffect, useState } from "react"
import { getSupabaseClient } from "@/lib/supabase/client"
import { e2ee } from "@/lib/crypto/encryption"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, MessageSquare, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useChatStore } from "@/store/chat-store"
import type { Profile } from "@/lib/types"

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const supabase = getSupabaseClient()
  const router = useRouter()

  useEffect(() => {
    loadContacts()
  }, [])

  async function loadContacts() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: acceptedInvites } = await supabase
      .from("invites")
      .select("sender_id, recipient_email, code")
      .eq("status", "accepted")
      .or(`sender_id.eq.${user.id},recipient_email.eq.${user.email}`) as any

    if (!acceptedInvites || !Array.isArray(acceptedInvites)) {
      setLoading(false)
      return
    }

    const emails: string[] = acceptedInvites.map((i: any) => i.recipient_email)
    const senderIds: string[] = acceptedInvites
      .filter((i: any) => i.recipient_email === user.email)
      .map((i: any) => i.sender_id)

    const orConditions: string[] = []
    if (emails.length > 0) {
      orConditions.push(`email.in.(${emails.map((e) => `"${e}"`).join(",")})`)
    }
    if (senderIds.length > 0) {
      orConditions.push(`id.in.(${senderIds.map((s) => `"${s}"`).join(",")})`)
    }

    if (orConditions.length === 0) {
      setLoading(false)
      return
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .or(orConditions.join(","))
      .neq("id", user.id)

    setContacts(profiles || [])
    setLoading(false)
  }

  async function startChat(contactId: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const password = sessionStorage.getItem("sumr_master_password")
    if (!password) {
      toast.error("Please unlock encryption first (re-login)")
      return
    }

    await e2ee.initialize(password)

    const { data: profile } = await supabase
      .from("profiles")
      .select("encrypted_private_key, public_key")
      .eq("id", user.id)
      .single() as any

    if (profile?.encrypted_private_key && profile?.public_key) {
      await e2ee.loadKeys(profile.encrypted_private_key, profile.public_key)
    }

    const { data: otherProfile } = await supabase
      .from("profiles")
      .select("public_key, id")
      .eq("id", contactId)
      .single() as any

    if (!otherProfile?.public_key) {
      toast.error("Contact hasn't set up encryption yet")
      return
    }

    const convKeys = await e2ee.createConversationKey(otherProfile.public_key)

    const { data: existing } = await (supabase.rpc as any)(
      "get_or_create_conversation",
      { user_id: user.id, other_user_id: contactId },
    )

    if (existing) {
      await supabase
        .from("conversation_participants")
        .update({ encrypted_symmetric_key: convKeys.encryptedForSelf })
        .eq("conversation_id", existing)
        .eq("user_id", user.id)

      await supabase
        .from("conversation_participants")
        .update({ encrypted_symmetric_key: convKeys.encryptedForOther })
        .eq("conversation_id", existing)
        .eq("user_id", contactId)

      const store = useChatStore.getState()
      store.setConversationKey(existing, convKeys.raw)

      router.push(`/chats/${existing}`)
    } else {
      toast.error("Could not create conversation")
    }
  }

  const filtered = contacts.filter(
    (c) =>
      c.display_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <h1 className="text-lg font-semibold mb-3">Contacts</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <p className="text-sm text-muted-foreground">No contacts found</p>
            <p className="text-xs text-muted-foreground mt-1">
              Invite friends to start chatting
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map((contact) => (
              <div
                key={contact.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors"
              >
                <Avatar>
                  <AvatarImage src={contact.avatar_url || ""} />
                  <AvatarFallback>
                    {(contact.display_name || contact.email).charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {contact.display_name || contact.email.split("@")[0]}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {contact.email}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => startChat(contact.id)}
                >
                  <MessageSquare className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
