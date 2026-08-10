/**
 * POST /api/admin/whatsapp/connect
 *
 * Finishes the WhatsApp Embedded Signup flow started by
 * components/admin/WhatsAppConnect.tsx: the browser gets a one-time
 * `code` from the Facebook JS SDK popup plus the WABA ID (and, for a
 * brand-new number, the Phone Number ID) the client picked, and this
 * route exchanges that code for an access token server-side (needs
 * META_APP_SECRET, which must never reach the browser) and stores the
 * connection.
 *
 * The coexistence flow (featureType: "whatsapp_business_app_onboarding"
 * — a number already active in the WhatsApp Business mobile app) only
 * returns a waba_id, not a phone_number_id, since the number isn't
 * newly selected in that flow. When phoneNumberId is missing, it's
 * looked up here via the WABA's phone_numbers list instead.
 */

import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/supabase/server";
import { saveWhatsAppConnection } from "@/lib/whatsapp/connection";

const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION ?? "v21.0";

export async function POST(request: Request) {
  const user = await requireAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const appId = process.env.NEXT_PUBLIC_META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_META_APP_ID / META_APP_SECRET not configured on the server." },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => null);
  const code = body?.code;
  const wabaId = body?.wabaId;
  let phoneNumberId: string | undefined = body?.phoneNumberId;
  if (!code || !wabaId) {
    return NextResponse.json(
      { error: "Missing code or wabaId from the signup flow." },
      { status: 400 }
    );
  }

  try {
    const tokenRes = await fetch(
      `https://graph.facebook.com/${WHATSAPP_API_VERSION}/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&code=${encodeURIComponent(code)}`
    );
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error("[whatsapp/connect] token exchange failed:", tokenData);
      return NextResponse.json(
        { error: tokenData?.error?.message ?? "Failed to exchange code for an access token." },
        { status: 502 }
      );
    }
    const accessToken: string = tokenData.access_token;

    let displayPhoneNumber: string | null = null;
    let verifiedName: string | null = null;

    if (!phoneNumberId) {
      const phoneNumbersRes = await fetch(
        `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const phoneNumbersData = phoneNumbersRes.ok ? await phoneNumbersRes.json() : {};
      const phoneNumber = phoneNumbersData?.data?.[0];
      if (!phoneNumber?.id) {
        console.error("[whatsapp/connect] no phone number found for WABA:", wabaId, phoneNumbersData);
        return NextResponse.json(
          { error: "Connected to Meta, but couldn't find a phone number on that WhatsApp Business Account." },
          { status: 502 }
        );
      }
      phoneNumberId = phoneNumber.id;
      displayPhoneNumber = phoneNumber.display_phone_number ?? null;
      verifiedName = phoneNumber.verified_name ?? null;
    } else {
      const detailsRes = await fetch(
        `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${phoneNumberId}?fields=display_phone_number,verified_name`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const details = detailsRes.ok ? await detailsRes.json() : {};
      displayPhoneNumber = details.display_phone_number ?? null;
      verifiedName = details.verified_name ?? null;
    }

    // Best-effort — lets Meta deliver webhooks (message status, quality
    // rating changes) for this number to our app. Not required for
    // sending, so a failure here shouldn't block the connection.
    fetch(`https://graph.facebook.com/${WHATSAPP_API_VERSION}/${wabaId}/subscribed_apps`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch((err) => console.error("[whatsapp/connect] subscribed_apps failed:", err));

    await saveWhatsAppConnection({
      wabaId,
      // Always set by this point: either passed in directly, or resolved
      // via the phone_numbers lookup above (which returns early on failure).
      phoneNumberId: phoneNumberId!,
      accessToken,
      displayPhoneNumber,
      verifiedName,
      connectedBy: user.id,
    });

    return NextResponse.json({ connected: true, displayPhoneNumber, verifiedName });
  } catch (err) {
    console.error("[whatsapp/connect] unexpected error:", err);
    return NextResponse.json({ error: "Unexpected error connecting WhatsApp." }, { status: 500 });
  }
}
