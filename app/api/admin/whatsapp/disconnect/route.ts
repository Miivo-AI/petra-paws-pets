/**
 * POST /api/admin/whatsapp/disconnect
 *
 * Used both for the "test with my own number, then remove it" workflow
 * and for swapping in a different number later — clears the stored
 * connection so /admin/whatsapp goes back to a clean "not connected"
 * state ready for another Embedded Signup run.
 */

import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/supabase/server";
import { getWhatsAppConnection, clearWhatsAppConnection } from "@/lib/whatsapp/connection";

const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION ?? "v21.0";

export async function POST() {
  const user = await requireAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const connection = await getWhatsAppConnection();
  if (!connection) {
    return NextResponse.json({ ok: true });
  }

  // Best-effort — un-registers our app as a webhook subscriber for this
  // WABA on Meta's side. Not required for our own state to be clean, so
  // a failure here (e.g. token already revoked) shouldn't block removal.
  try {
    await fetch(`https://graph.facebook.com/${WHATSAPP_API_VERSION}/${connection.wabaId}/subscribed_apps`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${connection.accessToken}` },
    });
  } catch (err) {
    console.error("[whatsapp/disconnect] unsubscribe failed (continuing):", err);
  }

  await clearWhatsAppConnection();
  return NextResponse.json({ ok: true });
}
