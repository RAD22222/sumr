import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import LoginForm from "@/components/auth/LoginForm"

export default async function LoginPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (session) {
    redirect("/chats")
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <LoginForm />
    </div>
  )
}
