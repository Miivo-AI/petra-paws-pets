export type PetType = "dog" | "cat";
export type PetSize = "small" | "medium" | "large";
export type BookingStatus = "pending_payment" | "confirmed" | "cancelled";
export type PaymentMethod = "online" | "pay_on_arrival";
export type PaymentStatus = "unpaid" | "paid";

export interface Service {
  id: string;
  name: string;
  description: string | null;
  features: string[];
  duration_minutes: number;
  active: boolean;
  image_url: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ServiceZone {
  id: string;
  name: string;
  centroid_lat: number;
  centroid_lng: number;
  active: boolean;
  created_at: string;
}

export interface ServicePrice {
  id: string;
  pet_type: PetType;
  service_id: string;
  size: PetSize | null;
  amount: number;
}

export interface Blackout {
  id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
  created_at: string;
  created_by: string | null;
}

export interface Appointment {
  id: string;
  booking_reference: string;
  lookup_token: string;

  date: string;
  start_time: string;
  end_time: string;

  pet_type: PetType;
  service_id: string | null;
  size: PetSize | null;

  zone_id: string | null;
  customer_address: string | null;

  customer_name: string;
  customer_email: string;
  customer_phone: string;
  pet_name: string;
  pet_breed: string | null;
  special_notes: string | null;

  subtotal: number;
  vat: number;
  total: number;

  status: BookingStatus;
  hold_expires_at: string | null;
  ziina_payment_id: string | null;
  ziina_redirect_url: string | null;
  ziina_claimed_at: string | null;
  confirmation_sent_at: string | null;
  idempotency_key: string | null;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;

  created_at: string;
  updated_at: string;

  // Joined
  service?: Pick<Service, "id" | "name" | "duration_minutes"> | null;
  zone?: Pick<ServiceZone, "id" | "name"> | null;
}

// ── Cart item (client-side cart store) ───────────────────────
export interface CartItem {
  service: {
    id: string;
    name: string;
    price: number;
  };
  petType: PetType;
  size?: PetSize;
}

// ── Booking request (client → POST /api/bookings) ────────────
export interface CreateBookingRequest {
  date: string;          // YYYY-MM-DD
  start_time: string;    // HH:MM
  pet_type: PetType;
  service_id: string;
  size?: PetSize;
  zone_id: string;
  customer_address?: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  pet_name: string;
  pet_breed?: string;
  special_notes?: string;
  payment_method: PaymentMethod;
  idempotency_key?: string;
}

// ── Availability response (GET /api/availability) ────────────
export interface AvailabilityResponse {
  date: string;
  available_slots: string[]; // ["10:00", "10:05", ...]
}

export const VAT_RATE = 0.05;
export const OPERATING_HOURS = { open: 10 * 60, close: 17 * 60 } as const;
export const SLOT_GRID_MINUTES = 5;
export const HOLD_TTL_MINUTES = 10;
export const SETUP_BUFFER_MINUTES = 10;
