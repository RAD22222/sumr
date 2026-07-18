"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { verifyFriendCode } from "@/lib/crypto/totp"

export async function verifyFriendCodeAction(username: string, code: string) {
  const admin = createAdminClient()

  const { data: user } = await admin
    .from("profiles")
    .select("id")
    .eq("display_name", username.trim())
    .maybeSingle()

  if (!user) {
    return { valid: false, error: "User not found" }
  }

  if (!verifyFriendCode(user.id, code)) {
    return { valid: false, error: "Invalid or expired code" }
  }

  return { valid: true }
}
