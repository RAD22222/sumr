import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import AppShell from "@/components/layout/AppShell"

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerSupabaseClient()

  /**
   * Use getUser() — not getSession() — to verify the JWT against Supabase's
   * auth server.  getSession() is unauthenticated (reads the cookie only) and
   * can be spoofed by manipulating the cookie value.
   */
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect("/")
  }

  let { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  if (!profile) {
    // Fallback: create a profile for users who signed up before the trigger
    // was in place (e.g., via OAuth or a prior schema version).
    const admin = createAdminClient()
    await admin.from("profiles").upsert({
      id: user.id,
      email: user.email,
      display_name: user.email?.split("@")[0] ?? null,
      public_key: "",
      encrypted_private_key: "",
    })

    const { data: newProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single()

    profile = newProfile
  }

  return (
    <AppShell user={user} profile={profile}>
      {children}
    </AppShell>
  )
}
