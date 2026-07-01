import type { PetType, PetSize, ServicePrice } from "@/lib/types";
import { VAT_RATE } from "@/lib/types";

/**
 * Look up the subtotal from the price matrix.
 * Dogs: keyed on (pet_type='dog', service_id, size)
 * Cats: keyed on (pet_type='cat', service_id, size=null)
 */
export function lookupPrice(
  prices: ServicePrice[],
  petType: PetType,
  serviceId: string,
  size?: PetSize
): number | null {
  const match = prices.find(
    (p) =>
      p.pet_type === petType &&
      p.service_id === serviceId &&
      (petType === "cat" ? p.size === null : p.size === (size ?? null))
  );
  return match?.amount ?? null;
}

export function calculateTotals(subtotal: number): {
  subtotal: number;
  vat: number;
  total: number;
} {
  const vat = parseFloat((subtotal * VAT_RATE).toFixed(2));
  const total = parseFloat((subtotal + vat).toFixed(2));
  return { subtotal, vat, total };
}

export function generateBookingReference(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  let ref = "PP-";
  for (let i = 0; i < 6; i++) {
    ref += chars[Math.floor(Math.random() * chars.length)];
  }
  return ref;
}
