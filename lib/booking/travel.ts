/**
 * travelTime(fromZoneId, toZoneId) — swappable dependency (§3.4)
 *
 * Returns estimated travel + setup time in minutes between two service zones.
 * All availability logic calls this function; swap internals freely.
 *
 * Strategy:
 *   1. Check travel_time_cache table — return cached value if present.
 *   2. Call Google Maps Distance Matrix API using zone centroids.
 *   3. Add SETUP_BUFFER_MINUTES (parking + van setup).
 *   4. Persist result to cache.
 *
 * Fallback: if GOOGLE_MAPS_API_KEY is not set, returns FALLBACK_MINUTES so
 * the availability engine still works during development.
 */

import { createAdminClient } from "@/lib/supabase/server";
import { SETUP_BUFFER_MINUTES } from "@/lib/types";

const FALLBACK_MINUTES = 25; // used when Maps API is not configured

interface ZoneCoordinates {
  lat: number;
  lng: number;
}

async function fetchFromMapsAPI(
  origin: ZoneCoordinates,
  destination: ZoneCoordinates
): Promise<number> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return FALLBACK_MINUTES;

  const url =
    `https://maps.googleapis.com/maps/api/distancematrix/json` +
    `?origins=${origin.lat},${origin.lng}` +
    `&destinations=${destination.lat},${destination.lng}` +
    `&mode=driving&key=${key}`;

  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return FALLBACK_MINUTES;

  const json = await res.json();
  const element = json?.rows?.[0]?.elements?.[0];
  if (element?.status !== "OK") return FALLBACK_MINUTES;

  const driveSeconds: number = element.duration.value;
  return Math.ceil(driveSeconds / 60);
}

export async function travelTime(
  fromZoneId: string,
  toZoneId: string
): Promise<number> {
  if (fromZoneId === toZoneId) return SETUP_BUFFER_MINUTES;

  const supabase = await createAdminClient();

  // 1. Check cache
  const { data: cached } = await supabase
    .from("travel_time_cache")
    .select("travel_minutes")
    .eq("zone_a_id", fromZoneId)
    .eq("zone_b_id", toZoneId)
    .single();

  if (cached) {
    return cached.travel_minutes;
  }

  // 2. Fetch zone centroids
  const { data: zones } = await supabase
    .from("service_zones")
    .select("id, centroid_lat, centroid_lng")
    .in("id", [fromZoneId, toZoneId]);

  const from = zones?.find((z) => z.id === fromZoneId);
  const to = zones?.find((z) => z.id === toZoneId);

  if (!from || !to) return FALLBACK_MINUTES;

  // 3. Call Maps API
  const driveMinutes = await fetchFromMapsAPI(
    { lat: from.centroid_lat, lng: from.centroid_lng },
    { lat: to.centroid_lat, lng: to.centroid_lng }
  );

  const total = driveMinutes + SETUP_BUFFER_MINUTES;

  // 4. Cache result (upsert both directions)
  await supabase.from("travel_time_cache").upsert([
    { zone_a_id: fromZoneId, zone_b_id: toZoneId, travel_minutes: total },
  ]);

  return total;
}
