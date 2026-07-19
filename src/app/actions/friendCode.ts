"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { generateFriendCode, getCodeExpiry, verifyFriendCode } from "@/lib/crypto/totp"

/**
 * Returns the current friend code and time-until-expiry for the authenticated user.
 * The userId is read from the server session — never trusted from the client.
 */
export async function getMyFriendCode() {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return { error: "Not authenticated" }
  }

  return {
    code: generateFriendCode(user.id),
    expiresIn: getCodeExpiry(),
  }
}

/**
 * Add a friend by their display name + current friend code.
 *
 * Security notes:
 *  - `myUserId` is derived from the server session, never from the client.
 *  - The admin client is only used for operations the current user cannot
 *    perform themselves (inserting the target user's participant row).
 *  - Duplicate conversation detection uses a proper two-sided join query.
 */
export async function addFriendByCode(username: string, code: string) {
  // Always resolve the acting user from the server session.
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: "Not authenticated" }
  }
  const myUserId = user.id

  const admin = createAdminClient()

  // Look up the target user by display name.
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
    return { error: "Invalid or expired code" }
  }

  // Check for an existing 1-on-1 conversation between these two users using
  // a proper two-sided join — avoids the broken "find any conv of mine then
  // check if target is in it" pattern that could return false negatives.
  const { data: existing } = await admin
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", myUserId)

  if (existing && existing.length > 0) {
    const convIds = existing.map((c: { conversation_id: string }) => c.conversation_id)

    const { data: sharedConv } = await admin
      .from("conversation_participants")
      .select("conversation_id")
      .in("conversation_id", convIds)
      .eq("user_id", target.id)
      .limit(1)
      .maybeSingle()

    if (sharedConv) {
      return { error: "Already connected", conversationId: sharedConv.conversation_id }
    }
  }

  // Create the conversation.
  const { data: conv, error: convError } = await admin
    .from("conversations")
    .insert({})
    .select()
    .single()

  if (convError || !conv) {
    return { error: "Failed to create conversation" }
  }

  // Add both participants.  Encrypted keys start empty — E2EE key exchange
  // is completed client-side when the first message is sent.
  await admin.from("conversation_participants").insert([
    { conversation_id: conv.id, user_id: myUserId, encrypted_symmetric_key: "" },
    { conversation_id: conv.id, user_id: target.id, encrypted_symmetric_key: "" },
  ])

  return { success: true, conversationId: conv.id }
}

/**
 * Given two user IDs, find their existing shared conversation (if any).
 * Used by the contacts page to navigate to an existing chat without
 * creating a duplicate.
 */
export async function findConversationBetween(otherUserId: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: "Not authenticated" }
  }

  const admin = createAdminClient()

  const { data: myConvs } = await admin
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", user.id)

  if (!myConvs || myConvs.length === 0) {
    return { conversationId: null }
  }

  const convIds = myConvs.map((c: { conversation_id: string }) => c.conversation_id)

  const { data: shared } = await admin
    .from("conversation_participants")
    .select("conversation_id")
    .in("conversation_id", convIds)
    .eq("user_id", otherUserId)
    .limit(1)
    .maybeSingle()

  return { conversationId: shared?.conversation_id ?? null }
}

/**
 * Update the encrypted symmetric key for the current user in a conversation.
 * This is called during E2EE key exchange when a conversation is first opened.
 */
export async function updateConversationKey(
  conversationId: string,
  encryptedKeyForSelf: string,
  otherUserId: string,
  encryptedKeyForOther: string,
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: "Not authenticated" }
  }

  // The current user can update their own key directly via the anon client
  // (RLS allows participants to update their own row).
  const { error: selfError } = await supabase
    .from("conversation_participants")
    .update({ encrypted_symmetric_key: encryptedKeyForSelf })
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id)

  if (selfError) {
    return { error: selfError.message }
  }

  // Updating the other participant's key requires the admin client because
  // RLS would block updating another user's row.
  const admin = createAdminClient()
  const { error: otherError } = await admin
    .from("conversation_participants")
    .update({ encrypted_symmetric_key: encryptedKeyForOther })
    .eq("conversation_id", conversationId)
    .eq("user_id", otherUserId)

  if (otherError) {
    return { error: otherError.message }
  }

  return { success: true }
}
