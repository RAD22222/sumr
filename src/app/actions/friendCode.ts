"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { generateFriendCode, getCodeExpiry, verifyFriendCode } from "@/lib/crypto/totp"

export async function getMyFriendCode(userId: string) {
  return {
    code: generateFriendCode(userId),
    expiresIn: getCodeExpiry(),
  }
}

export async function addFriendByCode(myUserId: string, username: string, code: string) {
  const admin = createAdminClient()

  const { data: target } = await admin
    .from("profiles")
    .select("id, display_name, public_key")
    .eq("display_name", username.trim())
    .maybeSingle()

  if (!target) {
    return { error: "User not found" }
  }

  if (target.id === myUserId) {
    return { error: "Cannot add yourself" }
  }

  if (!verifyFriendCode(target.id, code)) {
    return { error: "Invalid code" }
  }

  // Check if conversation already exists
  const { data: existing } = await admin
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", myUserId)

  if (existing && existing.length > 0) {
    const convIds = existing.map((c: any) => c.conversation_id)
    const { data: alreadyJoined } = await admin
      .from("conversation_participants")
      .select("conversation_id")
      .in("conversation_id", convIds)
      .eq("user_id", target.id)
      .maybeSingle()

    if (alreadyJoined) {
      return { error: "Already connected" }
    }
  }

  // Create conversation
  const { data: conv, error: convError } = await admin
    .from("conversations")
    .insert({})
    .select()
    .single()

  if (convError || !conv) {
    return { error: "Failed to create conversation" }
  }

  // Add both participants (empty keys for now, E2EE setup happens on first message)
  await admin.from("conversation_participants").insert([
    { conversation_id: conv.id, user_id: myUserId, encrypted_symmetric_key: "" },
    { conversation_id: conv.id, user_id: target.id, encrypted_symmetric_key: "" },
  ])

  return { success: true, conversationId: conv.id }
}
