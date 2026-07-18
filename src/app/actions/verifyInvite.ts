"use server"

import { createAdminClient } from "@/lib/supabase/admin"

export async function verifyInviteCode(code: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("invites")
    .select("id, status")
    .eq("code", code.toUpperCase())
    .single()

  if (error || !data) {
    return { valid: false }
  }

  if (data.status !== "pending") {
    return { valid: false }
  }

  return { valid: true, inviteId: data.id }
}

export async function markInviteAccepted(inviteId: string) {
  const admin = createAdminClient()
  await admin
    .from("invites")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", inviteId)
}
