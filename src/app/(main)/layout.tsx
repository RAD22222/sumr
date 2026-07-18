import { createServerSupabaseClient } from "@/lib/supabase/server"
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single()

  return (
    <AppShell user={session.user} profile={profile}>
      {children}
    </AppShell>
  )
}
