/**
 * Core availability engine — §3.3
 *
 * Server-side only. The client never computes or trusts slot availability.
 *
 * Algorithm:
 *   1. Reject past dates, Mondays, and full-day blackouts.
 *   2. Build working window 9:00–17:00.
 *   3. Fetch confirmed + non-expired pending_payment bookings + partial blackouts.
 *   4. Generate candidate start times on 5-minute grid, dropping any that have
 *      already passed if the date is today (Asia/Dubai wall-clock time).
 *   5. For each candidate T at location L, keep it only if:
 *      a. T ≤ 17:00  (may start until close; the job itself may run past it)
 *      b. No overlap with any occupied interval
 *      c. T ≥ prev.end + travelTime(prev.zone, L)  (travel-in OK)
 *      d. T + duration + travelTime(L, next.zone) ≤ next.start  (travel-out OK)
 *   6. Return surviving times as ["HH:MM", …].
 *
 * Blackouts have no zone, so they block time but impose no travel buffer (§3.3 note).
 */

import { createClient } from "@/lib/supabase/server";
import { travelTime } from "./travel";
import {
  OPERATING_HOURS,
  SLOT_GRID_MINUTES,
  HOLD_TTL_MINUTES,
} from "@/lib/types";

// ── Time helpers ─────────────────────────────────────────────

function toMin(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

function toTimeStr(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// The business operates in Dubai; "today" and "now" must reflect Dubai wall
// clock regardless of where the server process itself is running (Vercel
// defaults to UTC). UAE has no DST, but we still go through Intl rather than
// a hardcoded +4h offset so this doesn't silently drift if that ever changes.
export function getDubaiNow(): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

// ── Types ────────────────────────────────────────────────────

interface OccupiedInterval {
  start: number;  // minutes since midnight
  end: number;
  zoneId: string | null; // null for blackouts
}

// ── Main export ──────────────────────────────────────────────

export async function getAvailableSlots(params: {
  date: string;     // YYYY-MM-DD
  serviceId: string;
  zoneId: string;
}): Promise<string[]> {
  const { date, serviceId, zoneId } = params;

  // 1. Reject past dates and Mondays (getDay() returns 1 for Monday in UTC; parse as UTC)
  const { date: todayDubai, minutes: nowMinutesDubai } = getDubaiNow();
  if (date < todayDubai) return [];
  const [year, month, day] = date.split("-").map(Number);
  const jsDate = new Date(Date.UTC(year, month - 1, day));
  if (jsDate.getUTCDay() === 1) return [];

  const supabase = await createClient();

  // Fetch service duration
  const { data: service } = await supabase
    .from("services")
    .select("duration_minutes")
    .eq("id", serviceId)
    .single();

  if (!service) return [];
  const duration = service.duration_minutes;
  // Appointments may START any time up to 17:00; the job itself may run past
  // close. Only the start time is bounded by operating hours.
  const latestStart = OPERATING_HOURS.close;

  // 2. Check full-day blackout
  const { data: blackouts } = await supabase
    .from("blackouts")
    .select("start_time, end_time")
    .eq("date", date);

  const fullDayBlocked = blackouts?.some(
    (b) => b.start_time === null && b.end_time === null
  );
  if (fullDayBlocked) return [];

  // 3. Fetch active bookings for the day
  const holdCutoff = new Date().toISOString();
  const { data: bookings } = await supabase
    .from("appointments")
    .select("start_time, end_time, zone_id, status, hold_expires_at")
    .eq("date", date)
    .in("status", ["confirmed", "pending_payment"]);

  // Filter out expired holds at read time (§3.6)
  const activeBookings = (bookings ?? []).filter(
    (b) =>
      b.status === "confirmed" ||
      (b.status === "pending_payment" &&
        b.hold_expires_at &&
        b.hold_expires_at > holdCutoff)
  );

  // 4. Build sorted occupied intervals
  const occupied: OccupiedInterval[] = [
    ...activeBookings.map((b) => ({
      start: toMin(b.start_time),
      end: toMin(b.end_time),
      zoneId: b.zone_id as string | null,
    })),
    ...(blackouts ?? [])
      .filter((b) => b.start_time !== null)
      .map((b) => ({
        start: toMin(b.start_time!),
        end: toMin(b.end_time!),
        zoneId: null,
      })),
  ].sort((a, b) => a.start - b.start);

  // 5. Pre-fetch travel times for all unique zone pairs involved
  const involvedZones = [
    ...new Set([
      ...activeBookings.map((b) => b.zone_id).filter(Boolean) as string[],
      zoneId,
    ]),
  ];

  const travelMatrix: Record<string, Record<string, number>> = {};
  await Promise.all(
    involvedZones.flatMap((from) =>
      involvedZones
        .filter((to) => to !== from)
        .map(async (to) => {
          const mins = await travelTime(from, to);
          travelMatrix[from] ??= {};
          travelMatrix[from][to] = mins;
        })
    )
  );

  function getTravelMin(from: string | null, to: string | null): number {
    if (!from || !to || from === to) return 0;
    return travelMatrix[from]?.[to] ?? 30; // safe fallback
  }

  // 6. Generate candidates and filter
  const available: string[] = [];

  for (
    let t = OPERATING_HOURS.open;
    t <= latestStart;
    t += SLOT_GRID_MINUTES
  ) {
    // Same-day booking: drop any slot that has already started/passed.
    if (date === todayDubai && t <= nowMinutesDubai) continue;

    const tEnd = t + duration;

    // a. Overlap check
    const overlaps = occupied.some((o) => o.start < tEnd && o.end > t);
    if (overlaps) continue;

    // b. Travel-in: find the occupied interval that ends latest before t
    const prev = occupied.filter((o) => o.end <= t).at(-1) ?? null;
    if (prev?.zoneId) {
      const needed = prev.end + getTravelMin(prev.zoneId, zoneId);
      if (t < needed) continue;
    }

    // c. Travel-out: find the earliest occupied interval that starts at or after tEnd
    const next = occupied.find((o) => o.start >= tEnd) ?? null;
    if (next?.zoneId) {
      const needed = tEnd + getTravelMin(zoneId, next.zoneId);
      if (needed > next.start) continue;
    }

    available.push(toTimeStr(t));
  }

  return available;
}

/**
 * Re-validate a specific slot before creating a hold — §3.6
 * Returns true if the slot is still available.
 */
export async function validateSlot(params: {
  date: string;
  startTime: string;
  serviceId: string;
  zoneId: string;
}): Promise<boolean> {
  const slots = await getAvailableSlots({
    date: params.date,
    serviceId: params.serviceId,
    zoneId: params.zoneId,
  });
  return slots.includes(params.startTime);
}
