/**
 * travelTime(fromZoneId, toZoneId) — swappable dependency (§3.4)
 *
 * Returns estimated travel + setup time in minutes between two service zones.
 * All availability logic calls this function; swap internals freely.
 *
 * Strategy:
 *   1. Fetch zone centroids from service_zones.
 *   2. Compute straight-line (haversine) distance between centroids.
 *   3. Apply ROUTE_FACTOR to approximate real road distance, then convert
 *      to minutes at AVG_SPEED_KMH.
 *   4. Add SETUP_BUFFER_MINUTES (parking + van setup).
 *
 * No external API/key required — Dubai zones are close enough together
 * that this estimate is accurate enough for scheduling buffers.
 */

import { createAdminClient } from "@/lib/supabase/server";
import { SETUP_BUFFER_MINUTES } from "@/lib/types";

const FALLBACK_MINUTES = 25; // used if zone centroids can't be found

const AVG_SPEED_KMH = 30; // conservative city-traffic estimate
const ROUTE_FACTOR = 1.3; // roads aren't straight lines
const EARTH_RADIUS_KM = 6371;

interface ZoneCoordinates {
  lat: number;
  lng: number;
}

function haversineKm(a: ZoneCoordinates, b: ZoneCoordinates): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

function estimateDriveMinutes(
  origin: ZoneCoordinates,
  destination: ZoneCoordinates
): number {
  const straightLineKm = haversineKm(origin, destination);
  const roadKm = straightLineKm * ROUTE_FACTOR;
  return Math.ceil((roadKm / AVG_SPEED_KMH) * 60);
}

export async function travelTime(
  fromZoneId: string,
  toZoneId: string
): Promise<number> {
  if (fromZoneId === toZoneId) return SETUP_BUFFER_MINUTES;

  const supabase = await createAdminClient();

  const { data: zones } = await supabase
    .from("service_zones")
    .select("id, centroid_lat, centroid_lng")
    .in("id", [fromZoneId, toZoneId]);

  const from = zones?.find((z) => z.id === fromZoneId);
  const to = zones?.find((z) => z.id === toZoneId);

  if (!from || !to) return FALLBACK_MINUTES;

  const driveMinutes = estimateDriveMinutes(
    { lat: from.centroid_lat, lng: from.centroid_lng },
    { lat: to.centroid_lat, lng: to.centroid_lng }
  );

  return driveMinutes + SETUP_BUFFER_MINUTES;
}
