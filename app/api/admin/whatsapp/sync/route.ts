/**
 * POST /api/admin/whatsapp/sync
 *
 * Retries the coexistence onboarding steps (WABA subscription, then the
 * contacts and history syncs) when the attempt made during connect
 * failed. Worth having as its own action because the 24-hour window is
 * unforgiving and a transient Graph API error during connect would
 * otherwise cost the owner the entire Embedded Signup flow.
 *
 * Safe to call repeatedly: syncs already requested are reported as such
 * rather than requested again, since Meta permits exactly one of each
 * per onboarding.
 */

import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/supabase/server";
import { runCoexistenceOnboarding } from "@/lib/whatsapp/onboarding";

export async function POST() {
  const user = await requireAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const outcome = await runCoexistenceOnboarding();
  return NextResponse.json(outcome, { status: outcome.ok ? 200 : 207 });
}
