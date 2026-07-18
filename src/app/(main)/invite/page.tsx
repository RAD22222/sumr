"use client"

import { useState } from "react"
import { getSupabaseClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { Loader2, Send, Copy, Check } from "lucide-react"

export default function InvitePage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sentInvites, setSentInvites] = useState<string[]>([])
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const supabase = getSupabaseClient()

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast.error("Not authenticated")
      setLoading(false)
      return
    }

    const code = crypto.randomUUID().slice(0, 8).toUpperCase()

    const { error } = await supabase.from("invites").insert({
      sender_id: user.id,
      recipient_email: email,
      code,
      status: "pending",
    })

    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }

    setSentInvites((prev) => [...prev, email])
    setEmail("")
    toast.success(`Invite sent to ${email}`)
    setLoading(false)
  }

  const copyCode = (code: string, index: number) => {
    navigator.clipboard.writeText(code)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
    toast.success("Code copied!")
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <h1 className="text-lg font-semibold">Invite Friends</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Invite someone to join Sumr via email
        </p>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-6">
        <form onSubmit={handleSendInvite} className="space-y-3">
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="Friend's email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="flex-1"
            />
            <Button type="submit" disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Your friend will receive an invite code they can use to sign up
          </p>
        </form>

        {sentInvites.length > 0 && (
          <div>
            <h2 className="text-sm font-medium mb-2">Sent invites</h2>
            <div className="space-y-2">
              {sentInvites.map((inviteEmail, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <span className="text-sm">{inviteEmail}</span>
                  <span className="text-xs text-green-600 dark:text-green-400">
                    Sent
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-lg border border-dashed p-6 text-center">
          <p className="text-sm text-muted-foreground">
            An email will be sent with the invite link once you connect a
            transactional email service (Resend).
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            For now, invite codes are generated and you can share them manually
            with friends.
          </p>
        </div>
      </div>
    </div>
  )
}
