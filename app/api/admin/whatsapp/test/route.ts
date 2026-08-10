/**
 * POST /api/admin/whatsapp/test
 *
 * Sends a one-off test message through whichever number is currently
 * connected, to the phone number the admin typed in on /admin/whatsapp
 * — lets them verify the connection actually works with their own
 * phone before pointing it at real customers.
 */

import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/supabase/server";
import { sendWhatsAppMessageResult } from "@/lib/whatsapp/client";

const TEST_MESSAGE =
  "This is a test message from Petra Paws — if you received this, your WhatsApp connection is working.";

export async function POST(request: Request) {
  const user = await requireAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  if (!phone) {
    return NextResponse.json({ error: "Enter a phone number to test." }, { status: 400 });
  }

  const result = await sendWhatsAppMessageResult(phone, TEST_MESSAGE);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
