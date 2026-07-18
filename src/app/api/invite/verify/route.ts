import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(request: Request) {
  try {
    const { code } = await request.json()

    if (!code) {
      return NextResponse.json({ valid: false, error: "Code required" }, { status: 400 })
    }

    const adminClient = createAdminClient()
    const { data, error } = await adminClient
      .from("invites")
      .select("id, status")
      .eq("code", code)
      .single()

    if (error || !data || data.status !== "pending") {
      return NextResponse.json({ valid: false }, { status: 200 })
    }

    return NextResponse.json({ valid: true, inviteId: data.id }, { status: 200 })
  } catch (err) {
    console.error("Verify error:", err)
    return NextResponse.json({ valid: false, error: "Internal error" }, { status: 500 })
  }
}
