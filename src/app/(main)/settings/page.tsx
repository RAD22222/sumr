"use client"

import { useEffect, useState, useRef } from "react"
import { getSupabaseClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { toast } from "sonner"
import { Loader2, Sun, Moon, Monitor, Shield, Copy, Check } from "lucide-react"
import { useTheme } from "next-themes"
import type { Profile } from "@/lib/types"
import { getMyFriendCode } from "@/app/actions/friendCode"

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [displayName, setDisplayName] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [friendCode, setFriendCode] = useState("")
  const [expiresIn, setExpiresIn] = useState(0)
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const supabase = getSupabaseClient()
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    loadProfile()
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  useEffect(() => {
    if (profile) {
      fetchCode()
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = setInterval(fetchCode, 5000)
    }
  }, [profile])

  async function fetchCode() {
    const result = await getMyFriendCode()
    if ("error" in result) return
    setFriendCode(result.code)
    setExpiresIn(result.expiresIn)
  }

  async function loadProfile() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single()

    if (data) {
      setProfile(data)
      setDisplayName(data.display_name || "")
    }
    setLoading(false)
  }

  async function handleSave() {
    if (!profile) return
    setSaving(true)

    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName })
      .eq("id", profile.id)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success("Profile updated")
    }
    setSaving(false)
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !profile) return

    setSaving(true)
    const fileExt = file.name.split(".").pop()
    const filePath = `avatars/${profile.id}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true })

    if (uploadError) {
      toast.error(uploadError.message)
      setSaving(false)
      return
    }

    const { data: urlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath)

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: urlData.publicUrl })
      .eq("id", profile.id)

    if (updateError) {
      toast.error(updateError.message)
    } else {
      setProfile({ ...profile, avatar_url: urlData.publicUrl })
      toast.success("Avatar updated")
    }
    setSaving(false)
  }

  function handleCopy() {
    navigator.clipboard.writeText(friendCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center flex-1">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="p-4 border-b">
        <h1 className="text-lg font-semibold">Settings</h1>
      </div>

      <div className="flex-1 p-4 space-y-6 max-w-lg">
        <section className="space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Friend Code
          </h2>

          <div className="rounded-lg border p-4 text-center">
            <p className="text-xs text-muted-foreground mb-2">
              Share this code with friends to connect. It changes every 60 seconds.
            </p>
            <div className="flex items-center justify-center gap-3">
              <span className="text-3xl font-mono font-bold tracking-widest">
                {friendCode}
              </span>
              <Button variant="ghost" size="icon" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <div className="mt-2 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <div className="h-1.5 w-24 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-1000 rounded-full"
                  style={{ width: `${(expiresIn / 60) * 100}%` }}
                />
              </div>
              <span>{expiresIn}s</span>
            </div>
          </div>
        </section>

        <hr className="border-t" />

        <section className="space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Profile
          </h2>

          <div className="flex items-center gap-4">
            <label className="cursor-pointer relative group">
              <Avatar size="lg">
                <AvatarImage src={profile?.avatar_url || ""} />
                <AvatarFallback className="text-lg">
                  {(profile?.display_name || profile?.email || "U")
                    .charAt(0)
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-xs text-white font-medium">Change</span>
              </div>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </label>
            <div>
              <p className="font-medium">
                {profile?.display_name || "Unnamed"}
              </p>
              <p className="text-sm text-muted-foreground">{profile?.email}</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Display name</label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your display name"
            />
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </section>

        <hr className="border-t" />

        <section className="space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Appearance
          </h2>
          <div className="flex gap-2">
            <Button
              variant={theme === "light" ? "default" : "outline"}
              size="sm"
              onClick={() => setTheme("light")}
              className="flex-1 gap-2"
            >
              <Sun className="h-4 w-4" />
              Light
            </Button>
            <Button
              variant={theme === "dark" ? "default" : "outline"}
              size="sm"
              onClick={() => setTheme("dark")}
              className="flex-1 gap-2"
            >
              <Moon className="h-4 w-4" />
              Dark
            </Button>
            <Button
              variant={theme === "system" ? "default" : "outline"}
              size="sm"
              onClick={() => setTheme("system")}
              className="flex-1 gap-2"
            >
              <Monitor className="h-4 w-4" />
              System
            </Button>
          </div>
        </section>

        <hr className="border-t" />

        <section className="space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Security
          </h2>
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <Shield className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="text-sm font-medium">End-to-End Encrypted</p>
              <p className="text-xs text-muted-foreground mt-1">
                All messages are encrypted with AES-256-GCM. Your master
                password derives the encryption keys locally and never leaves
                your device.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
