"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase/client"
import { e2ee } from "@/lib/crypto/encryption"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import Link from "next/link"

export default function SignUpForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [inviteCode, setInviteCode] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteCode) {
      toast.error("Invite code is required")
      return
    }
    setLoading(true)

    const supabase = getSupabaseClient()

    const verifyRes = await fetch("/api/invite/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: inviteCode, email }),
    })
    const verify = await verifyRes.json()

    if (!verify.valid) {
      toast.error("Invalid or used invite code")
      setLoading(false)
      return
    }

    const inviteId = verify.inviteId

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
        .eq("id", inviteId)

      sessionStorage.setItem("sumr_master_password", password)
    }

    toast.success("Account created! Check your email to verify.")
    router.push("/")
    setLoading(false)
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Create account</h1>
        <p className="text-sm text-muted-foreground mt-1">
          You need an invite code from a friend
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
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
          placeholder="Master password (min 8 chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
        <p className="text-xs text-muted-foreground">
          Your password never leaves your device. It derives encryption keys
          locally via PBKDF2. Memorize it — it cannot be reset.
        </p>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create account
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
