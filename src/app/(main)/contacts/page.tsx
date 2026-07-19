"use client"

import { useEffect, useState } from "react"
import { getSupabaseClient } from "@/lib/supabase/client"
import { e2ee } from "@/lib/crypto/encryption"
import { useChatStore } from "@/store/chat-store"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, MessageSquare, Loader2, UserPlus, X } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import {
  addFriendByCode,
  findConversationBetween,
  updateConversationKey,
} from "@/app/actions/friendCode"
import type { Profile } from "@/lib/types"

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showAddFriend, setShowAddFriend] = useState(false)
  const [addUsername, setAddUsername] = useState("")
  const [addCode, setAddCode] = useState("")
  const [adding, setAdding] = useState(false)
  const supabase = getSupabaseClient()
  const router = useRouter()

  useEffect(() => {
    loadContacts()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadContacts() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: conversations } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", user.id)

    if (!conversations || conversations.length === 0) {
      setLoading(false)
      return
    }

    const convIds = conversations.map((c: any) => c.conversation_id)

    // Fetch the OTHER participants (exclude current user).
    const { data: otherParticipants } = await supabase
      .from("conversation_participants")
      .select("user_id")
      .in("conversation_id", convIds)
      .neq("user_id", user.id)

    if (!otherParticipants || otherParticipants.length === 0) {
      setLoading(false)
      return
    }

    const userIds = [...new Set(otherParticipants.map((p: any) => p.user_id))]

    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .in("id", userIds)

    setContacts(profiles || [])
    setLoading(false)
  }

  async function handleAddFriend() {
    if (!addUsername.trim() || !addCode.trim()) {
      toast.error("Fill in both fields")
      return
    }

    setAdding(true)
    // addFriendByCode is a server action that reads the current user's ID
    // from the session — we no longer pass it from the client.
    const result = await addFriendByCode(addUsername.trim(), addCode.trim())

    if (result.error && result.error !== "Already connected") {
      toast.error(result.error)
      setAdding(false)
      return
    }

    toast.success("Connected!")
    setShowAddFriend(false)
    setAddUsername("")
    setAddCode("")
    loadContacts()
    setAdding(false)
  }

  async function startChat(contactId: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Look up the existing conversation — created by addFriendByCode.
    const { conversationId, error: findError } = await findConversationBetween(contactId)

    if (findError) {
      toast.error(findError)
      return
    }

    if (!conversationId) {
      toast.error("No conversation found. Add this person as a friend first.")
      return
    }

    // Fetch the other user's public key for the E2EE key exchange.
    const { data: otherProfile } = await supabase
      .from("profiles")
      .select("public_key")
      .eq("id", contactId)
      .single() as any

    if (!otherProfile?.public_key) {
      // No public key — navigate anyway (key exchange can't be done yet).
      router.push(`/chats/${conversationId}`)
      return
    }

    // Check if we already have a key for this conversation.
    const { data: myParticipant } = await supabase
      .from("conversation_participants")
      .select("encrypted_symmetric_key")
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id)
      .single() as any

    const hasKey = !!myParticipant?.encrypted_symmetric_key

    if (!hasKey) {
      // Perform E2EE key exchange — create a new symmetric key and encrypt it
      // for both parties.  E2EE should already be initialized from login, but
      // we load the RSA keys here if they aren't present yet.
      try {
        if (!e2ee.isInitialized()) {
          toast.error("Please re-login to set up encryption for this chat.")
          return
        }

        const { data: myProfile } = await supabase
          .from("profiles")
          .select("encrypted_private_key, public_key")
          .eq("id", user.id)
          .single() as any

        if (myProfile?.encrypted_private_key && myProfile?.public_key) {
          await e2ee.loadKeys(myProfile.encrypted_private_key, myProfile.public_key)
        }

        const convKeys = await e2ee.createConversationKey(otherProfile.public_key)

        const keyResult = await updateConversationKey(
          conversationId,
          convKeys.encryptedForSelf,
          contactId,
          convKeys.encryptedForOther,
        )

        if (keyResult.error) {
          toast.error("Failed to set up encryption: " + keyResult.error)
          return
        }

        // Cache the raw key in the store.
        const store = useChatStore.getState()
        store.setConversationKey(conversationId, convKeys.raw)
      } catch (err) {
        console.error("E2EE key exchange failed:", err)
        toast.error("Encryption setup failed. Please try again.")
        return
      }
    }

    router.push(`/chats/${conversationId}`)
  }

  const filtered = contacts.filter(
    (c) =>
      c.display_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Contacts</h1>
          <Button variant="outline" size="sm" onClick={() => setShowAddFriend(true)}>
            <UserPlus className="h-4 w-4 mr-1" />
            Add friend
          </Button>
        </div>
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

      {showAddFriend && (
        <div className="p-4 border-b bg-muted/30">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium">Add a friend</h2>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowAddFriend(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-2">
            <Input
              placeholder="Their username (display name)"
              value={addUsername}
              onChange={(e) => setAddUsername(e.target.value)}
            />
            <Input
              placeholder="Their 6-digit code (from settings)"
              value={addCode}
              onChange={(e) => setAddCode(e.target.value)}
              maxLength={6}
              className="font-mono tracking-widest"
            />
            <Button className="w-full" size="sm" onClick={handleAddFriend} disabled={adding}>
              {adding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add friend
            </Button>
          </div>
        </div>
      )}

      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <p className="text-sm text-muted-foreground">No contacts yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Share your friend code from Settings to connect
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setShowAddFriend(true)}
            >
              <UserPlus className="h-4 w-4 mr-1" />
              Add a friend
            </Button>
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
