/**
 * GET /api/admin/whatsapp/status
 *
 * Reports whether a WhatsApp number is connected (whatsapp_connection
 * table) and, if so, actually pings the Graph API with the stored token
 * to confirm it still works — a stored token can go stale (revoked,
 * WABA disconnected on Meta's side) without us hearing about it any
 * other way.
 */

import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/supabase/server";
import { getWhatsAppConnection } from "@/lib/whatsapp/connection";

const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION ?? "v21.0";

export async function GET() {
  const user = await requireAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const connection = await getWhatsAppConnection();
  if (!connection) {
    return NextResponse.json({ connected: false });
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${connection.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`,
      { headers: { Authorization: `Bearer ${connection.accessToken}` } }
    );

    if (!res.ok) {
      return NextResponse.json({
        connected: true,
        working: false,
        error: `Meta API rejected the stored credentials (${res.status}). Reconnect below.`,
        connectedAt: connection.connectedAt,
      });
    }

    const data = await res.json();
    return NextResponse.json({
      connected: true,
      working: true,
      displayPhoneNumber: data.display_phone_number ?? connection.displayPhoneNumber,
      verifiedName: data.verified_name ?? connection.verifiedName,
      qualityRating: data.quality_rating ?? null,
      connectedAt: connection.connectedAt,
    });
  } catch (err) {
    return NextResponse.json({
      connected: true,
      working: false,
      error: err instanceof Error ? err.message : "Failed to reach the Meta API.",
      connectedAt: connection.connectedAt,
    });
  }
}
