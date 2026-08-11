/**
 * POST /api/admin/whatsapp/connect
 *
 * Finishes the Embedded Signup flow started by
 * components/admin/WhatsAppConnect.tsx: the browser hands over the
 * one-time `code` from the Facebook JS SDK popup plus the WABA ID (and,
 * for a brand-new number, the Phone Number ID), and this route exchanges
 * the code for an access token server-side — META_APP_SECRET must never
 * reach the browser — then stores the connection.
 *
 * The coexistence flow (featureType "whatsapp_business_app_onboarding")
 * returns only a waba_id, since the number isn't newly selected there.
 * When phoneNumberId is missing it's looked up from the WABA instead.
 *
 * Onboarding continues inline rather than being left to the owner: Meta
 * gives 24 hours from here to pull contacts and message history, each
 * request is one-shot, and missing the window means disconnecting and
 * redoing the whole flow.
 */

import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/supabase/server";
import { saveWhatsAppConnection } from "@/lib/whatsapp/connection";
import {
  exchangeCodeForToken,
  getFirstPhoneNumber,
  getPhoneNumberDetails,
} from "@/lib/whatsapp/coexistence";
import { runCoexistenceOnboarding } from "@/lib/whatsapp/onboarding";

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
  const providedPhoneNumberId: string | undefined = body?.phoneNumberId;

  if (!code || !wabaId) {
    return NextResponse.json(
      { error: "Missing code or wabaId from the signup flow." },
      { status: 400 }
    );
  }

  try {
    const tokenResult = await exchangeCodeForToken({ appId, appSecret, code });
    if (!tokenResult.ok) {
      console.error("[whatsapp/connect] token exchange failed:", tokenResult.error);
      return NextResponse.json({ error: tokenResult.error }, { status: 502 });
    }
    const accessToken = tokenResult.data;

    const detailsResult = providedPhoneNumberId
      ? await getPhoneNumberDetails({ phoneNumberId: providedPhoneNumberId, token: accessToken })
      : await getFirstPhoneNumber({ wabaId, token: accessToken });

    if (!detailsResult.ok) {
      console.error("[whatsapp/connect] phone number lookup failed:", detailsResult.error);
      return NextResponse.json({ error: detailsResult.error }, { status: 502 });
    }
    const details = detailsResult.data;

    await saveWhatsAppConnection({
      wabaId,
      phoneNumberId: providedPhoneNumberId ?? details.id,
      accessToken,
      displayPhoneNumber: details.display_phone_number ?? null,
      verifiedName: details.verified_name ?? null,
      isOnBizApp: details.is_on_biz_app ?? null,
      platformType: details.platform_type ?? null,
      connectedBy: user.id,
    });

    // Saved before onboarding runs, deliberately: if a sync call fails
    // the token is still on disk, so the owner can hit "Retry sync"
    // instead of starting Embedded Signup over from scratch.
    const onboarding = await runCoexistenceOnboarding();

    return NextResponse.json(
      {
        connected: true,
        displayPhoneNumber: details.display_phone_number ?? null,
        verifiedName: details.verified_name ?? null,
        isOnBizApp: details.is_on_biz_app ?? null,
        platformType: details.platform_type ?? null,
        onboarding,
      },
      { status: onboarding.ok ? 200 : 207 }
    );
  } catch (err) {
    console.error("[whatsapp/connect] unexpected error:", err);
    return NextResponse.json({ error: "Unexpected error connecting WhatsApp." }, { status: 500 });
  }
}
