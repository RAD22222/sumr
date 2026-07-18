import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import LandingPage from "@/components/auth/LandingPage"

export default async function Home() {
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (session) {
    redirect("/chats")
  }

  return <LandingPage />
}
