import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { Resend } from "resend"

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { email } = await request.json()

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    const code = crypto.randomUUID().slice(0, 8).toUpperCase()

    const adminClient = createAdminClient()
    const { error: insertError } = await adminClient.from("invites").insert({
      sender_id: session.user.id,
      recipient_email: email,
      code,
      status: "pending",
    })

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Send email via Resend (optional - works without it too)
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const { data: sender } = await supabase
        .from("profiles")
        .select("display_name, email")
        .eq("id", session.user.id)
        .single()

      const senderName = sender?.display_name || sender?.email || "A friend"

      await resend.emails.send({
        from: "Sumr <onboarding@resend.dev>",
        to: email,
        subject: `${senderName} invited you to Sumr`,
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h1 style="color: #3390ec;">Sumr</h1>
            <p>Hi,</p>
            <p><strong>${senderName}</strong> has invited you to join Sumr — a private, end-to-end encrypted messaging app.</p>
            <p style="font-size: 24px; letter-spacing: 4px; font-weight: bold; text-align: center; padding: 16px; background: #f0f2f4; border-radius: 8px;">
              ${code}
            </p>
            <p>Use this code when signing up at <a href="${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}">Sumr</a>.</p>
            <p style="color: #666; font-size: 12px;">No phone number needed. Your messages are end-to-end encrypted.</p>
          </div>
        `,
      })
    }

    return NextResponse.json({ success: true, code })
  } catch (err) {
    console.error("Invite error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
