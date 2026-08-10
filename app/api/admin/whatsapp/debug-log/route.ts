/**
 * TEMP DEBUG ROUTE — remove once the Embedded Signup flow is confirmed
 * working (see components/admin/WhatsAppConnect.tsx debug logging).
 *
 * The signup flow's important events happen in the browser (FB.login
 * callback, window "message" events from the popup), which only show up
 * in the browser console. This relays them into the server console too,
 * so they're visible in the terminal running `next dev`.
 */

import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const user = await requireAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  console.log(`[whatsapp debug] ${body?.label ?? "(no label)"}`, ...(body?.args ?? []));

  return NextResponse.json({ ok: true });
}
