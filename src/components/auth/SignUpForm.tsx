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
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!displayName.trim()) {
      toast.error("Display name is required")
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
          Anyone can join — no code needed
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          type="text"
          placeholder="Display name (username)"
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
