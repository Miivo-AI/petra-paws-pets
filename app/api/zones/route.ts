/**
 * GET /api/zones
 *
 * Returns the list of serviceable zones for the area dropdown (§3.5).
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const { data: zones } = await supabase
    .from("service_zones")
    .select("id, name")
    .eq("active", true)
    .order("name");

  return NextResponse.json({ zones: zones ?? [] });
}
