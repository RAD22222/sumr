import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import SignUpForm from "@/components/auth/SignUpForm"

export default async function SignUpPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect("/chats")
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <SignUpForm />
    </div>
  )
}
