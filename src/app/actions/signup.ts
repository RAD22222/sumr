"use server"

import { createAdminClient } from "@/lib/supabase/admin"

export async function signupWithInvite(data: {
  email: string
  password: string
  displayName: string
  inviteCode: string
  publicKey?: string
  encryptedPrivateKey?: string
}) {
  const admin = createAdminClient()

  const { data: invite, error: inviteError } = await admin
    .from("invites")
    .select("id, status")
    .eq("code", data.inviteCode.toUpperCase())
    .single()

  if (inviteError || !invite || invite.status !== "pending") {
    return { error: "Invalid or used invite code" }
  }

  const { data: authData, error: signUpError } = await admin.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
    user_metadata: { display_name: data.displayName },
  })

  if (signUpError) {
    return { error: signUpError.message }
  }

  if (!authData.user) {
    return { error: "Failed to create user" }
  }

  const userId = authData.user.id

  if (data.publicKey && data.encryptedPrivateKey) {
    await admin.from("profiles").insert({
      id: userId,
      email: data.email,
      display_name: data.displayName,
      public_key: data.publicKey,
      encrypted_private_key: data.encryptedPrivateKey,
    }).catch(e => console.error("Profile error:", e))
  }

  await admin
    .from("invites")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", invite.id)

  return { success: true }
}
