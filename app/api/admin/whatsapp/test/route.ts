/**
 * POST /api/admin/whatsapp/test
 *
 * Sends the real booking-confirmation template, with real parameters, to
 * a number the admin types in — so a template/parameter mismatch (Meta
 * error 132000) or a wrong language code (132001) surfaces here rather
 * than silently on a customer's booking.
 *
 * Consent is not required for this one path: the admin is deliberately
 * messaging a number they control. The send is still logged, so a test
 * is distinguishable from a customer send after the fact.
 */

import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/supabase/server";
import { sendTemplateMessage } from "@/lib/whatsapp/client";
import { sampleTemplateContext } from "@/lib/whatsapp/messages";
import { parsePhone, PHONE_ERROR_MESSAGE } from "@/lib/whatsapp/phone";

export async function POST(request: Request) {
  const user = await requireAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const phone: string | undefined = body?.phone;
  if (!phone?.trim()) {
    return NextResponse.json({ error: "Enter a phone number to test." }, { status: 400 });
  }

  const parsed = parsePhone(phone);
  if (!parsed.ok) {
    return NextResponse.json({ error: PHONE_ERROR_MESSAGE }, { status: 400 });
  }

  const result = await sendTemplateMessage({
    phone: parsed.e164,
    context: sampleTemplateContext(),
    requireConsent: false,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, ...("errorCode" in result ? { errorCode: result.errorCode } : {}) },
      { status: 502 }
    );
  }

  return NextResponse.json({ sent: true, to: parsed.e164, wamid: result.wamid });
}
