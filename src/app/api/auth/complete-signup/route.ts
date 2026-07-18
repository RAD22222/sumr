import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(request: Request) {
  try {
    const { publicKey, encryptedPrivateKey, displayName, inviteId } = await request.json()

    const supabase = await createServerSupabaseClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const adminClient = createAdminClient()

    const { error: profileError } = await adminClient.from("profiles").upsert({
      id: session.user.id,
      email: session.user.email,
      display_name: displayName || session.user.email?.split("@")[0],
      public_key: publicKey || "",
      encrypted_private_key: encryptedPrivateKey || "",
    })

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    if (inviteId) {
      await adminClient
        .from("invites")
        .update({ status: "accepted", accepted_at: new Date().toISOString() })
        .eq("id", inviteId)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Complete signup error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
