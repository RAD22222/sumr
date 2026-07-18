"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getSupabaseClient } from "@/lib/supabase/client"
import { e2ee } from "@/lib/crypto/encryption"
import { Loader2, Send, Lock, Shield, Users } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

export default function LandingPage() {
  const [showLogin, setShowLogin] = useState(false)
  const [showSignup, setShowSignup] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [inviteCode, setInviteCode] = useState("")
  const [loading, setLoading] = useState(false)

  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const supabase = getSupabaseClient()
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }

    router.push("/chats")
    router.refresh()
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteCode) {
      toast.error("Invite code is required")
      return
    }
    setLoading(true)

    const supabase = getSupabaseClient()

    const { data: invite, error: inviteError } = await supabase
      .from("invites")
      .select("id, status, sender_id")
      .eq("code", inviteCode)
      .eq("recipient_email", email)
      .single()

    if (inviteError || !invite || invite.status !== "pending") {
      toast.error("Invalid or used invite code")
      setLoading(false)
      return
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
        },
      },
    })

    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }

    if (data.user) {
      await e2ee.initialize(password)
      const { publicKey, encryptedPrivateKey } = await e2ee.createKeys()

      await supabase.from("profiles").insert({
        id: data.user.id,
        email,
        display_name: displayName || email.split("@")[0],
        public_key: publicKey,
        encrypted_private_key: encryptedPrivateKey,
      })

      await supabase
        .from("invites")
        .update({ status: "accepted", accepted_at: new Date().toISOString() })
        .eq("id", invite.id)

      sessionStorage.setItem("sumr_master_password", password)
    }

    toast.success("Account created! Check your email to verify.")
    setShowSignup(false)
    setLoading(false)
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-4 py-3 sm:px-6">
        <h1 className="text-xl font-bold text-primary">Sumr</h1>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setShowLogin(true)}>
            Log in
          </Button>
          <Button onClick={() => setShowSignup(true)}>Sign up</Button>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 text-center">
        <div className="mx-auto max-w-md space-y-6">
          <div className="rounded-full bg-primary/10 p-4 mx-auto w-fit">
            <Lock className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight">
            Private messaging that&apos;s truly yours
          </h2>
          <p className="text-muted-foreground text-lg">
            End-to-end encrypted. Invite-only. No phone number needed.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6">
            <div className="rounded-lg border p-4 text-left">
              <Shield className="h-5 w-5 text-primary mb-2" />
              <h3 className="font-semibold text-sm">E2E Encrypted</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Only you and the recipient can read messages
              </p>
            </div>
            <div className="rounded-lg border p-4 text-left">
              <Users className="h-5 w-5 text-primary mb-2" />
              <h3 className="font-semibold text-sm">Invite Only</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Join by personal invitation from a friend
              </p>
            </div>
            <div className="rounded-lg border p-4 text-left">
              <Send className="h-5 w-5 text-primary mb-2" />
              <h3 className="font-semibold text-sm">No Phone Number</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Just email. Your privacy matters.
              </p>
            </div>
          </div>
        </div>
      </main>

      <Dialog open={showLogin} onOpenChange={setShowLogin}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Welcome back</DialogTitle>
            <DialogDescription>Sign in to your Sumr account</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign in
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showSignup} onOpenChange={setShowSignup}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create account</DialogTitle>
            <DialogDescription>
              You need an invite code from a friend to join
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSignup} className="space-y-4">
            <Input
              type="text"
              placeholder="Invite code"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              required
            />
            <Input
              type="text"
              placeholder="Display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="Master password (used for encryption)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
            <p className="text-xs text-muted-foreground">
              Your master password never leaves your device. It derives the
              encryption keys locally. Choose a strong, memorable password.
            </p>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create account
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
