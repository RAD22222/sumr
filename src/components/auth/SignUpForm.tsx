"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
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

  // Pre-warm: trigger Vercel challenge on page load so form submit works
  useEffect(() => {
    fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => {})
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteCode) {
      toast.error("Invite code is required")
      return
    }
    setLoading(true)

    try {
      await e2ee.initialize(password)
      const { publicKey, encryptedPrivateKey } = await e2ee.createKeys()

      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          email,
          password,
          displayName: displayName || email.split("@")[0],
          inviteCode,
          publicKey,
          encryptedPrivateKey,
        }),
      })

      if (!res.ok) {
        const text = await res.text()
        let data
        try { data = JSON.parse(text) } catch { data = {} }
        toast.error(data.error || "Signup failed (check console)")
        setLoading(false)
        return
      }

      const data = await res.json()

      if (data.valid === false) {
        toast.error("Invalid or used invite code")
        setLoading(false)
        return
      }

      if (data.error) {
        toast.error(data.error)
        setLoading(false)
        return
      }

      if (data.success) {
        sessionStorage.setItem("sumr_master_password", password)
      }

      toast.success("Account created! Check your email to verify.")
      router.push("/")
    } catch {
      toast.error("Signup failed. Try refreshing the page.")
    }

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
          onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
          required
          className="uppercase tracking-widest"
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
