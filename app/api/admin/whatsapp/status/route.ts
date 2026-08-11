/**
 * GET /api/admin/whatsapp/status
 *
 * Reports whether a number is connected and pings the Graph API with the
 * stored token to confirm it still works — a stored token can go stale
 * (revoked, WABA disconnected on Meta's side) without us hearing about
 * it any other way.
 *
 * Also surfaces the three things that make a coexistence setup either
 * genuinely working or quietly broken: whether Meta agrees the number is
 * on both the Business app and Cloud API (is_on_biz_app / platform_type),
 * whether the one-shot contact and history syncs completed, and how much
 * of the 24-hour sync window is left. Plus recent send failures, since
 * "connected" and "customers are actually receiving messages" are not
 * the same claim.
 */

import { NextResponse } from "next/server";
import { createAdminClient, requireAdminUser } from "@/lib/supabase/server";
import { getWhatsAppConnection, syncWindowRemainingMs } from "@/lib/whatsapp/connection";
import { getPhoneNumberDetails } from "@/lib/whatsapp/coexistence";
import { templateVariableOrder } from "@/lib/whatsapp/messages";

export async function GET() {
  const user = await requireAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const template = {
    name: process.env.WHATSAPP_TEMPLATE_NAME ?? null,
    language: process.env.WHATSAPP_TEMPLATE_LANGUAGE ?? "en",
    variables: templateVariableOrder(),
  };

  const recentFailures = await getRecentFailures();
  const connection = await getWhatsAppConnection();

  if (!connection) {
    // Env credentials still work for a plain API-only number, so
    // "no connection row" isn't necessarily "not configured".
    const envConfigured = Boolean(
      process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID
    );
    return NextResponse.json({
      connected: false,
      envFallbackConfigured: envConfigured,
      template,
      recentFailures,
    });
  }

  const sync = {
    windowRemainingMs: syncWindowRemainingMs(connection),
    contactsRequestedAt: connection.contactsSyncRequestedAt,
    contactsError: connection.contactsSyncError,
    historyRequestedAt: connection.historySyncRequestedAt,
    historyError: connection.historySyncError,
    historyReceivedAt: connection.historyReceivedAt,
  };

  if (connection.disconnectedAt) {
    return NextResponse.json({
      connected: true,
      working: false,
      error:
        `Meta reported this number as disconnected (${connection.disconnectReason ?? "unknown reason"}). ` +
        `Reconnect it below.`,
      displayPhoneNumber: connection.displayPhoneNumber,
      verifiedName: connection.verifiedName,
      connectedAt: connection.connectedAt,
      sync,
      template,
      recentFailures,
    });
  }

  const details = await getPhoneNumberDetails({
    phoneNumberId: connection.phoneNumberId,
    token: connection.accessToken,
  });

  if (!details.ok) {
    return NextResponse.json({
      connected: true,
      working: false,
      error: `Meta rejected the stored credentials: ${details.error}. Reconnect below.`,
      displayPhoneNumber: connection.displayPhoneNumber,
      verifiedName: connection.verifiedName,
      connectedAt: connection.connectedAt,
      sync,
      template,
      recentFailures,
    });
  }

  return NextResponse.json({
    connected: true,
    working: true,
    displayPhoneNumber: details.data.display_phone_number ?? connection.displayPhoneNumber,
    verifiedName: details.data.verified_name ?? connection.verifiedName,
    qualityRating: details.data.quality_rating ?? null,
    isOnBizApp: details.data.is_on_biz_app ?? connection.isOnBizApp,
    platformType: details.data.platform_type ?? connection.platformType,
    connectedAt: connection.connectedAt,
    sync,
    template,
    recentFailures,
  });
}

async function getRecentFailures() {
  try {
    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .from("whatsapp_messages")
      .select("to_e164, status, skip_reason, error_code, error_message, created_at")
      .in("status", ["failed", "skipped"])
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      console.error("[whatsapp/status] failure lookup error:", error.message);
      return [];
    }
    return data ?? [];
  } catch {
    // Migration 009 not applied yet — not a reason to fail the page.
    return [];
  }
}
