import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  if (!code) return new Response("Missing code param", { status: 400 })

  try {
    const adminClient = createAdminClient()
    const { data } = await adminClient
      .from("invites")
      .select("id, status, recipient_email, created_at")
      .eq("code", code.toUpperCase())
      .single()

    const status = data?.status || "not_found"
    return new Response(
      `<html><body style="font-family:sans-serif;padding:40px">
        <h2>Invite Check</h2>
        <p><b>Code:</b> ${code.toUpperCase()}</p>
        <p><b>Status:</b> ${status}</p>
        <p><b>Valid:</b> ${status === "pending" ? "✅ YES" : "❌ NO"}</p>
        ${data ? `<p><b>Created:</b> ${data.created_at}</p>` : ""}
      </body></html>`,
      { headers: { "Content-Type": "text/html" } },
    )
  } catch {
    return new Response("Error checking code", { status: 500 })
  }
}

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
      .eq("code", code.toUpperCase())
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
