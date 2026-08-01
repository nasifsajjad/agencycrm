import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

type Inquiry = {
  kind?: unknown
  firstName?: unknown
  lastName?: unknown
  name?: unknown
  email?: unknown
  agency?: unknown
  message?: unknown
  teamSize?: unknown
}

const text = (value: unknown, maxLength: number) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : ""

export async function POST(request: NextRequest) {
  const input = (await request.json().catch(() => null)) as Inquiry | null
  if (!input || (input.kind !== "contact" && input.kind !== "demo")) {
    return NextResponse.json({ error: "Invalid inquiry." }, { status: 400 })
  }

  const email = text(input.email, 320).toLowerCase()
  const agency = text(input.agency, 200)
  const firstName = text(input.firstName, 120)
  const lastName = text(input.lastName, 120)
  const name = text(input.name, 240)
  const message = text(input.message, 4000)
  const teamSize = text(input.teamSize, 32)

  if (
    !email.includes("@") ||
    !agency ||
    (input.kind === "contact" && (!firstName || !lastName || !message)) ||
    (input.kind === "demo" && !name)
  ) {
    return NextResponse.json({ error: "Please complete all required fields." }, { status: 400 })
  }

  const supabase = await createServerClient()
  if (!supabase) {
    return NextResponse.json({ error: "Service is temporarily unavailable." }, { status: 503 })
  }

  const { error } = await supabase.from("marketing_inquiries").insert({
    kind: input.kind,
    first_name: input.kind === "contact" ? firstName : null,
    last_name: input.kind === "contact" ? lastName : null,
    name: input.kind === "demo" ? name : null,
    email,
    agency,
    message: input.kind === "contact" ? message : null,
    team_size: input.kind === "demo" ? teamSize : null,
  })
  if (error) {
    return NextResponse.json({ error: "Unable to submit inquiry." }, { status: 503 })
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}
