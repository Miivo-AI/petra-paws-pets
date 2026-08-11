/**
 * POST /api/admin/whatsapp/disconnect
 *
 * Drops the stored credentials so this app stops sending. Note what it
 * does *not* do: a coexistence number cannot be deregistered through the
 * API, so the number itself stays linked to Cloud API on Meta's side
 * until the owner disconnects from the phone (WhatsApp Business app →
 * Settings → Account → Business Platform → Disconnect). The response
 * says so, because assuming otherwise leaves the owner thinking they've
 * fully unwound something they haven't.
 */

import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/supabase/server";
import { deleteWhatsAppConnection, getWhatsAppConnection } from "@/lib/whatsapp/connection";

export async function POST() {
  const user = await requireAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const connection = await getWhatsAppConnection();
    const wasCoexistence = connection?.isOnBizApp === true;

    await deleteWhatsAppConnection();

    return NextResponse.json({
      disconnected: true,
      coexistenceNotice: wasCoexistence
        ? "This app will stop sending immediately. The number stays linked to the " +
          "Cloud API on Meta's side until you disconnect it in the WhatsApp Business " +
          "app under Settings → Account → Business Platform."
        : null,
    });
  } catch (err) {
    console.error("[whatsapp/disconnect] failed:", err);
    return NextResponse.json({ error: "Failed to disconnect WhatsApp." }, { status: 500 });
  }
}
