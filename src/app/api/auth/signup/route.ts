import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type { Database } from "@/lib/supabase/types"

export async function POST(request: Request) {
  try {
    const { email, password, displayName, inviteCode, publicKey, encryptedPrivateKey } =
      await request.json()

    if (!email || !password || !inviteCode) {
      return NextResponse.json({ error: "Email, password, and invite code required" }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data: invite, error: inviteError } = await admin
      .from("invites")
      .select("id, status")
      .eq("code", inviteCode.toUpperCase())
      .single()

    if (inviteError || !invite || invite.status !== "pending") {
      return NextResponse.json({ valid: false, error: "Invalid or used invite code" }, { status: 200 })
    }

    const { data: authData, error: signUpError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName || email.split("@")[0] },
    })

    if (signUpError) {
      return NextResponse.json({ error: signUpError.message }, { status: 400 })
    }

    if (!authData.user) {
      return NextResponse.json({ error: "Failed to create user" }, { status: 500 })
    }

    const userId = authData.user.id

    if (publicKey && encryptedPrivateKey) {
      const { error: profileError } = await admin.from("profiles").insert({
        id: userId,
        email,
        display_name: displayName || email.split("@")[0],
        public_key: publicKey,
        encrypted_private_key: encryptedPrivateKey,
      })

      if (profileError) {
        console.error("Profile insert error:", profileError)
      }
    }

    await admin
      .from("invites")
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", invite.id)

    return NextResponse.json({ success: true, userId })
  } catch (err) {
    console.error("Signup error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
