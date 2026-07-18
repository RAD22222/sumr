"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase/client"
import { e2ee } from "@/lib/crypto/encryption"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { Loader2, ShieldCheck, RefreshCw } from "lucide-react"
import Link from "next/link"
import { verifyFriendCodeAction } from "@/app/actions/verifyFriendCode"

export default function SignUpForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [friendUsername, setFriendUsername] = useState("")
  const [friendCode, setFriendCode] = useState("")
  const [codeVerified, setCodeVerified] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleVerifyCode = async () => {
    if (!friendUsername.trim() || !friendCode.trim()) {
      toast.error("Enter friend's username and code")
      return
    }
    setVerifying(true)
    const result = await verifyFriendCodeAction(friendUsername.trim(), friendCode.trim())
    if (result.valid) {
      setCodeVerified(true)
      toast.success("Friend code verified!")
    } else {
      toast.error(result.error || "Invalid code. Ask your friend for their current code.")
    }
    setVerifying(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!displayName.trim()) {
      toast.error("Display name is required")
      return
    }
    if (!codeVerified) {
      toast.error("Verify a friend's code first")
      return
    }
    setLoading(true)

    try {
      await e2ee.initialize(password)
      const { publicKey, encryptedPrivateKey } = await e2ee.createKeys()

      const supabase = getSupabaseClient()

      const { data: check } = await supabase
        .from("profiles")
        .select("id")
        .eq("display_name", displayName.trim())
        .maybeSingle()

      if (check) {
        toast.error("Display name already taken")
        setLoading(false)
        return
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName.trim() },
        },
      })

      if (error) {
        toast.error(error.message)
        setLoading(false)
        return
      }

      if (data.user) {
        await supabase.from("profiles").upsert({
          id: data.user.id,
          email,
          display_name: displayName.trim(),
          public_key: publicKey,
          encrypted_private_key: encryptedPrivateKey,
        })
      }

      if (!data.session) {
        await supabase.auth.signInWithPassword({ email, password })
      }

      sessionStorage.setItem("sumr_master_password", password)
      toast.success("Account created!")
      router.push("/chats")
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
          Need a 6-digit code from a friend who&apos;s already using Sumr
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Friend code section */}
        <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
          <p className="text-xs font-medium text-muted-foreground">
            Ask a friend for their current code (Settings → Friend Code)
          </p>
          <Input
            type="text"
            placeholder="Friend's username"
            value={friendUsername}
            onChange={(e) => { setFriendUsername(e.target.value); setCodeVerified(false) }}
            disabled={codeVerified}
            required
          />
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="6-digit code"
              value={friendCode}
              onChange={(e) => { setFriendCode(e.target.value); setCodeVerified(false) }}
              maxLength={6}
              className="font-mono tracking-widest"
              disabled={codeVerified}
              required
            />
            {codeVerified ? (
              <Button type="button" variant="outline" size="icon" className="shrink-0 text-green-600 border-green-600" disabled>
                <ShieldCheck className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={handleVerifyCode} disabled={verifying}>
                {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </div>

        <Input
          type="text"
          placeholder="Your display name (username)"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          minLength={2}
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
        <Button type="submit" className="w-full" disabled={loading || !codeVerified}>
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
