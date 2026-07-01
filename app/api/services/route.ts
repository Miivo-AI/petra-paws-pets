/**
 * GET /api/services
 *
 * Returns active services with their pricing matrix — consumed by the
 * public booking flow to populate the service selector and price display.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const [{ data: services }, { data: prices }] = await Promise.all([
    supabase
      .from("services")
      .select("id, name, description, features, duration_minutes, sort_order")
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("service_prices")
      .select("pet_type, service_id, size, amount"),
  ]);

  return NextResponse.json({ services: services ?? [], prices: prices ?? [] });
}
