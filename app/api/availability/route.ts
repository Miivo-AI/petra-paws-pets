import { NextRequest, NextResponse } from "next/server";
import { getAvailableSlots } from "@/lib/booking/availability";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const serviceId = searchParams.get("service_id");
  const zoneId = searchParams.get("zone_id");

  if (!date || !serviceId || !zoneId) {
    return NextResponse.json(
      { error: "date, service_id, and zone_id are required" },
      { status: 400 }
    );
  }

  // Basic date format check
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
  }

  // Reject past dates
  const today = new Date().toISOString().split("T")[0];
  if (date < today) {
    return NextResponse.json({ date, available_slots: [] });
  }

  try {
    const slots = await getAvailableSlots({ date, serviceId, zoneId });
    return NextResponse.json({ date, available_slots: slots });
  } catch (err) {
    console.error("[availability] error:", err);
    return NextResponse.json(
      { error: "Failed to compute availability" },
      { status: 500 }
    );
  }
}
