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
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect("/")
  }

  let { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single()

  if (!profile) {
    const admin = createAdminClient()
    await admin.from("profiles").upsert({
      id: session.user.id,
      email: session.user.email,
      display_name: session.user.email?.split("@")[0],
      public_key: "",
      encrypted_private_key: "",
    })

    const { data: newProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single()

    profile = newProfile
  }

  return (
    <AppShell user={session.user} profile={profile}>
      {children}
    </AppShell>
  )
}
