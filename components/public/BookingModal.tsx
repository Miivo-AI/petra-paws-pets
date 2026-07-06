"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Cat, Check, Dog, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBookingModalStore } from "@/lib/store/booking-modal";
import { lookupPrice, calculateTotals } from "@/lib/booking/pricing";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import type {
  PaymentMethod,
  PetSize,
  PetType,
  Service,
  ServicePrice,
  ServiceZone,
} from "@/lib/types";

const DOG_SIZES: { value: PetSize; label: string }[] = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9\s-]{7,15}$/;

const REDIRECT_ERROR_MESSAGES: Record<string, string> = {
  payment_failed: "Your payment didn't go through. Please try again.",
  payment_not_verified:
    "We couldn't verify your payment yet. If you were charged, contact us with your booking reference.",
  hold_expired:
    "Your booking hold expired before payment completed. Please book again.",
  booking_not_found: "That booking could not be found.",
};

type ServiceOption = Pick<Service, "id" | "name" | "features">;

// ── Field error helper ───────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-destructive">{message}</p>;
}

function fieldClass(hasError?: string) {
  return hasError ? "border-destructive focus-visible:ring-destructive" : "";
}

function isMonday(dateStr: string): boolean {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 1;
}

// Reads ?error= from a Ziina redirect-back and surfaces it in the modal.
// Wrapped in Suspense below since useSearchParams requires it.
function RedirectErrorWatcher({ onError }: { onError: (message: string) => void }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const openBooking = useBookingModalStore((s) => s.open);

  useEffect(() => {
    const error = searchParams.get("error");
    if (!error) return;
    openBooking();
    onError(REDIRECT_ERROR_MESSAGES[error] ?? "Something went wrong. Please try again.");

    const url = new URL(window.location.href);
    url.searchParams.delete("error");
    url.searchParams.delete("booking_id");
    router.replace(url.pathname + url.search, { scroll: false });
    // Only ever react to the params present on initial load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

export default function BookingModal() {
  const isOpen = useBookingModalStore((s) => s.isOpen);
  const close = useBookingModalStore((s) => s.close);

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // ── Reference data ──────────────────────────────────────────────
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [prices, setPrices] = useState<ServicePrice[]>([]);
  const [zones, setZones] = useState<Pick<ServiceZone, "id" | "name">[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  // ── Step 1 ───────────────────────────────────────────────────────
  const [petType, setPetType] = useState<PetType>("dog");
  const [size, setSize] = useState<PetSize | undefined>(undefined);
  const [serviceId, setServiceId] = useState("");
  const [step1Touched, setStep1Touched] = useState(false);

  // ── Step 2 ───────────────────────────────────────────────────────
  const [petName, setPetName] = useState("");
  const [petBreed, setPetBreed] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [address, setAddress] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [notes, setNotes] = useState("");
  const [step2Touched, setStep2Touched] = useState(false);

  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // ── Submission ───────────────────────────────────────────────────
  const [submittingMethod, setSubmittingMethod] = useState<PaymentMethod | null>(
    null
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [bookingResult, setBookingResult] = useState<{
    reference: string;
    redirectUrl: string;
  } | null>(null);

  // Stable per booking-attempt key so a network-level retry of the
  // same submit doesn't create a second booking / second Ziina
  // payment intent server-side. Set (and regenerated on close) by the
  // reset effect below — deferred to an effect, not a useState
  // initializer, so crypto.randomUUID() never runs during SSR.
  const [idempotencyKey, setIdempotencyKey] = useState("");

  const today = useMemo(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split("T")[0];
  }, []);

  // Reset everything when the modal closes
  useEffect(() => {
    if (isOpen) return;
    setStep(1);
    setPetType("dog");
    setSize(undefined);
    setServiceId("");
    setStep1Touched(false);
    setPetName("");
    setPetBreed("");
    setOwnerName("");
    setPhone("");
    setEmail("");
    setZoneId("");
    setAddress("");
    setDate("");
    setStartTime("");
    setNotes("");
    setStep2Touched(false);
    setSlots([]);
    setSubmitError(null);
    setSubmittingMethod(null);
    setBookingResult(null);
    setInitError(null);
    setIdempotencyKey(crypto.randomUUID());
  }, [isOpen]);

  // Fetch services + zones once when opened
  useEffect(() => {
    if (!isOpen) return;
    setLoadingData(true);
    Promise.all([
      fetch("/api/services").then((r) => {
        if (!r.ok) throw new Error("Failed to load services");
        return r.json();
      }),
      fetch("/api/zones").then((r) => {
        if (!r.ok) throw new Error("Failed to load zones");
        return r.json();
      }),
    ])
      .then(([svc, zn]) => {
        setServices(svc.services ?? []);
        setPrices(svc.prices ?? []);
        setZones(zn.zones ?? []);
      })
      .catch(() => {
        setInitError("Failed to load booking data. Please try again.");
      })
      .finally(() => setLoadingData(false));
  }, [isOpen]);

  // Reset size when switching to cat
  useEffect(() => {
    if (petType === "cat") setSize(undefined);
  }, [petType]);

  // Fetch available slots whenever date/service/zone are all chosen
  useEffect(() => {
    setStartTime("");
    if (!date || !serviceId || !zoneId) {
      setSlots([]);
      return;
    }
    let cancelled = false;
    setLoadingSlots(true);
    fetch(`/api/availability?date=${date}&service_id=${serviceId}&zone_id=${zoneId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setSlots(data.available_slots ?? []);
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date, serviceId, zoneId]);

  // ── Validation ────────────────────────────────────────────────────
  const step1Errors = useMemo(() => {
    const errors: { size?: string; service?: string } = {};
    if (petType === "dog" && !size) errors.size = "Please select your dog's size.";
    if (!serviceId) errors.service = "Please choose a service.";
    return errors;
  }, [petType, size, serviceId]);

  const step2Errors = useMemo(() => {
    const errors: Record<string, string> = {};
    if (!petName.trim()) errors.petName = "Pet name is required.";
    if (!ownerName.trim()) errors.ownerName = "Owner name is required.";
    if (!email.trim()) errors.email = "Email is required.";
    else if (!EMAIL_RE.test(email.trim())) errors.email = "Enter a valid email address.";
    if (!phone.trim()) errors.phone = "Phone number is required.";
    else if (!PHONE_RE.test(phone.trim()))
      errors.phone = "Enter a valid phone number.";
    if (!zoneId) errors.zoneId = "Please select your area.";
    if (!address.trim()) errors.address = "Full address is required.";
    if (!date) errors.date = "Please pick a date.";
    else if (date < today) errors.date = "Date can't be in the past.";
    else if (isMonday(date)) errors.date = "We're closed on Mondays — please pick another date.";
    if (!startTime) errors.startTime = "Please pick an available time.";
    return errors;
  }, [petName, ownerName, email, phone, zoneId, address, date, startTime, today]);

  const step1Valid = Object.keys(step1Errors).length === 0;
  const step2Valid = Object.keys(step2Errors).length === 0;

  const selectedService = services.find((s) => s.id === serviceId);
  const subtotal =
    serviceId && (petType === "cat" || size)
      ? lookupPrice(prices, petType, serviceId, size)
      : null;
  const totals = subtotal !== null ? calculateTotals(subtotal) : null;

  function priceLabel(service: ServiceOption) {
    if (petType === "cat") {
      const amount = lookupPrice(prices, "cat", service.id);
      return amount !== null ? formatCurrency(amount) : "—";
    }
    if (size) {
      const amount = lookupPrice(prices, "dog", service.id, size);
      return amount !== null ? formatCurrency(amount) : "—";
    }
    const cheapest = DOG_SIZES.map((s) => lookupPrice(prices, "dog", service.id, s.value)).filter(
      (v): v is number => v !== null
    );
    return cheapest.length > 0 ? `From ${formatCurrency(Math.min(...cheapest))}` : "—";
  }

  function handleContinueStep1() {
    setStep1Touched(true);
    if (step1Valid) setStep(2);
  }

  function handleContinueStep2() {
    setStep2Touched(true);
    if (step2Valid) setStep(3);
  }

  async function handleSubmit(method: PaymentMethod) {
    if (!step1Valid || !step2Valid) return;
    setSubmittingMethod(method);
    setSubmitError(null);

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          start_time: startTime,
          pet_type: petType,
          service_id: serviceId,
          size: petType === "dog" ? size : undefined,
          zone_id: zoneId,
          customer_address: address,
          customer_name: ownerName,
          customer_email: email,
          customer_phone: phone,
          pet_name: petName,
          pet_breed: petBreed || undefined,
          special_notes: notes || undefined,
          payment_method: method,
          idempotency_key: idempotencyKey,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSubmitError(data.error ?? "Failed to create booking. Please try again.");
        setSubmittingMethod(null);
        if (res.status === 409) {
          // Someone else took the slot between selection and submit —
          // send them back to re-pick a time rather than letting them
          // retry into the same conflict.
          setStartTime("");
          setStep(2);
        }
        return;
      }

      if (method === "online") {
        window.location.href = data.redirectUrl;
        return;
      }

      setBookingResult({ reference: data.bookingReference, redirectUrl: data.redirectUrl });
      setSubmittingMethod(null);
    } catch {
      setSubmitError("Network error. Please check your connection and try again.");
      setSubmittingMethod(null);
    }
  }

  const stepTitle =
    step === 1
      ? "Choose Your Service"
      : step === 2
        ? "Tell Us About Your Pet"
        : "Review & Confirm";

  return (
    <>
      <Suspense fallback={null}>
        <RedirectErrorWatcher onError={setInitError} />
      </Suspense>
      <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
        <DialogContent
          className="max-w-md gap-0 overflow-hidden rounded-2xl p-0 max-h-[90vh] overflow-y-auto"
          onPointerDownOutside={(e) => e.preventDefault()}
        >
        <div className="p-6">
          {/* Step indicator */}
          <div className="mb-5 flex items-center gap-2">
            {[1, 2, 3].map((n, i) => (
              <div key={n} className="flex items-center gap-2">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                    n <= step
                      ? "bg-petra-green text-white"
                      : "border border-gray-300 text-gray-400"
                  }`}
                >
                  {n}
                </div>
                {i < 2 && (
                  <div
                    className={`h-px w-8 ${n < step ? "bg-petra-green" : "bg-gray-200"}`}
                  />
                )}
              </div>
            ))}
          </div>

          <DialogTitle className="font-serif text-2xl font-bold text-petra-green">
            {bookingResult ? "Booking Confirmed" : stepTitle}
          </DialogTitle>
          {step === 1 && !bookingResult && (
            <p className="mt-1 text-sm text-petra-green/60">
              What does your pet need today?
            </p>
          )}

          {initError && !bookingResult && (
            <p className="mt-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {initError}
            </p>
          )}

          {loadingData ? (
            <div className="flex items-center justify-center py-16 text-petra-green/50">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : bookingResult ? (
            /* ── Success (pay on arrival) ─────────────────────────── */
            <div className="mt-5 space-y-4">
              <div className="rounded-lg bg-green-50 p-4 text-sm text-green-900">
                Your booking <span className="font-mono font-semibold">{bookingResult.reference}</span> is
                confirmed. Please have cash or card ready — your groomer will collect
                payment on arrival.
              </div>
              <Button asChild className="w-full bg-petra-gold hover:bg-petra-gold-light">
                <Link href={bookingResult.redirectUrl}>View My Booking</Link>
              </Button>
              <Button variant="outline" className="w-full" onClick={close}>
                Close
              </Button>
            </div>
          ) : (
            <>
              {/* ── Step 1 — Choose Your Service ───────────────────── */}
              {step === 1 && (
                <div className="mt-5 space-y-5">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-petra-green/50">
                      Pet Type
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPetType("dog")}
                        className={`flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition-colors ${
                          petType === "dog"
                            ? "border-petra-green text-petra-green"
                            : "border-gray-200 text-petra-green/50 hover:border-petra-green/30"
                        }`}
                      >
                        <Dog className="h-4 w-4" /> Dog
                      </button>
                      <button
                        type="button"
                        onClick={() => setPetType("cat")}
                        className={`flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition-colors ${
                          petType === "cat"
                            ? "border-petra-green text-petra-green"
                            : "border-gray-200 text-petra-green/50 hover:border-petra-green/30"
                        }`}
                      >
                        <Cat className="h-4 w-4" /> Cat
                      </button>
                    </div>
                  </div>

                  <div>
                    {services.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Services are unavailable right now.
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        {services.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setServiceId(s.id)}
                            className={`rounded-lg border p-3 text-left transition-colors ${
                              serviceId === s.id
                                ? "border-petra-green shadow-sm"
                                : "border-gray-200 hover:border-petra-green/40"
                            }`}
                          >
                            <p className="mb-1.5 text-sm font-semibold text-petra-green">
                              {s.name}
                            </p>
                            <ul className="mb-3 space-y-0.5">
                              {s.features.slice(0, 5).map((f) => (
                                <li
                                  key={f}
                                  className="flex items-center gap-1 text-xs text-petra-green/60"
                                >
                                  <Check className="h-3 w-3 shrink-0 text-green-600" />
                                  {f}
                                </li>
                              ))}
                            </ul>
                            <p className="text-xs font-bold text-petra-green">
                              {priceLabel(s)}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                    <FieldError message={step1Touched ? step1Errors.service : undefined} />
                  </div>

                  {petType === "dog" && (
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-petra-green/50">
                        Pet Size
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {DOG_SIZES.map((s) => (
                          <button
                            key={s.value}
                            type="button"
                            onClick={() => setSize(s.value)}
                            className={`rounded-lg border py-2 text-sm font-medium transition-colors ${
                              size === s.value
                                ? "border-petra-gold bg-petra-gold/10 text-petra-green"
                                : "border-gray-200 text-petra-green/60 hover:border-petra-gold/40"
                            }`}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                      <FieldError message={step1Touched ? step1Errors.size : undefined} />
                    </div>
                  )}

                  <Button
                    className="w-full bg-petra-gold hover:bg-petra-gold-light"
                    size="lg"
                    onClick={handleContinueStep1}
                  >
                    Continue →
                  </Button>
                </div>
              )}

              {/* ── Step 2 — Tell Us About Your Pet ────────────────── */}
              {step === 2 && (
                <div className="mt-5 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-petra-green/50">
                        Pet Name
                      </p>
                      <Input
                        value={petName}
                        onChange={(e) => setPetName(e.target.value)}
                        placeholder="e.g. Luna"
                        className={fieldClass(step2Touched ? step2Errors.petName : undefined)}
                      />
                      <FieldError message={step2Touched ? step2Errors.petName : undefined} />
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-petra-green/50">
                        Pet Breed
                      </p>
                      <Input
                        value={petBreed}
                        onChange={(e) => setPetBreed(e.target.value)}
                        placeholder="e.g. Persian Cat"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-petra-green/50">
                        Owner Name
                      </p>
                      <Input
                        value={ownerName}
                        onChange={(e) => setOwnerName(e.target.value)}
                        placeholder="John Doe"
                        className={fieldClass(step2Touched ? step2Errors.ownerName : undefined)}
                      />
                      <FieldError message={step2Touched ? step2Errors.ownerName : undefined} />
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-petra-green/50">
                        Phone Number
                      </p>
                      <Input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+971 5X XXX XXXX"
                        className={fieldClass(step2Touched ? step2Errors.phone : undefined)}
                      />
                      <FieldError message={step2Touched ? step2Errors.phone : undefined} />
                    </div>
                  </div>

                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-petra-green/50">
                      Email
                    </p>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="john@example.com"
                      className={fieldClass(step2Touched ? step2Errors.email : undefined)}
                    />
                    <FieldError message={step2Touched ? step2Errors.email : undefined} />
                  </div>

                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-petra-green/50">
                      Area / Neighbourhood
                    </p>
                    <Select value={zoneId} onValueChange={setZoneId}>
                      <SelectTrigger
                        className={fieldClass(step2Touched ? step2Errors.zoneId : undefined)}
                      >
                        <SelectValue placeholder="Select your area" />
                      </SelectTrigger>
                      <SelectContent>
                        {zones.map((z) => (
                          <SelectItem key={z.id} value={z.id}>
                            {z.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError message={step2Touched ? step2Errors.zoneId : undefined} />
                  </div>

                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-petra-green/50">
                      Full Address
                    </p>
                    <Input
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Building, apartment/villa number, street"
                      className={fieldClass(step2Touched ? step2Errors.address : undefined)}
                    />
                    <FieldError message={step2Touched ? step2Errors.address : undefined} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-petra-green/50">
                        Preferred Date
                      </p>
                      <Input
                        type="date"
                        min={today}
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className={fieldClass(
                          step2Touched || date ? step2Errors.date : undefined
                        )}
                      />
                      <FieldError
                        message={step2Touched || date ? step2Errors.date : undefined}
                      />
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-petra-green/50">
                        Preferred Time
                      </p>
                      <Select
                        value={startTime}
                        onValueChange={setStartTime}
                        disabled={!date || !serviceId || !zoneId || loadingSlots}
                      >
                        <SelectTrigger
                          className={fieldClass(step2Touched ? step2Errors.startTime : undefined)}
                        >
                          <SelectValue
                            placeholder={
                              loadingSlots
                                ? "Loading…"
                                : !date || !serviceId || !zoneId
                                  ? "Pick date & area first"
                                  : slots.length === 0
                                    ? "No times available"
                                    : "Select a time"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {slots.map((t) => (
                            <SelectItem key={t} value={t}>
                              {formatTime(t)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FieldError message={step2Touched ? step2Errors.startTime : undefined} />
                    </div>
                  </div>

                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-petra-green/50">
                      Special Notes
                    </p>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Any specific requirements or behaviors we should know about…"
                      rows={2}
                    />
                  </div>

                  <Button
                    className="w-full bg-petra-gold hover:bg-petra-gold-light"
                    size="lg"
                    onClick={handleContinueStep2}
                  >
                    Continue →
                  </Button>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="block w-full text-center text-sm text-petra-green/50 hover:text-petra-green"
                  >
                    ← Back to Step 1
                  </button>
                </div>
              )}

              {/* ── Step 3 — Review & Confirm ──────────────────────── */}
              {step === 3 && totals && (
                <div className="mt-5 space-y-4">
                  <div className="rounded-lg border-l-4 border-petra-gold bg-petra-cream p-4">
                    <p className="mb-2 text-sm font-semibold text-petra-green">
                      Booking Summary
                    </p>
                    <dl className="space-y-1.5 text-sm">
                      {[
                        ["Service", selectedService?.name ?? "—"],
                        [
                          "Pet Type",
                          `${petType === "dog" ? "Dog" : "Cat"}${size ? ` — ${size[0].toUpperCase()}${size.slice(1)}` : ""}`,
                        ],
                        ["Pet Name", petName],
                        ["Owner", ownerName],
                        ["Phone", phone],
                        ["Location", zones.find((z) => z.id === zoneId)?.name ?? "—"],
                        ["Date", formatDate(date)],
                        ["Time", formatTime(startTime)],
                      ].map(([label, value]) => (
                        <div key={label} className="flex justify-between gap-4">
                          <dt className="text-petra-green/55">{label}</dt>
                          <dd className="text-right font-medium text-petra-green">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>

                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-petra-green/55">Subtotal</span>
                      <span>{formatCurrency(totals.subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-petra-green/55">VAT (5%)</span>
                      <span>{formatCurrency(totals.vat)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-1.5 text-base font-bold text-petra-green">
                      <span>Total Amount</span>
                      <span className="text-petra-gold">{formatCurrency(totals.total)}</span>
                    </div>
                  </div>

                  {submitError && (
                    <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                      {submitError}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      className="bg-petra-gold hover:bg-petra-gold-light"
                      disabled={submittingMethod !== null}
                      onClick={() => handleSubmit("online")}
                    >
                      {submittingMethod === "online" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Pay Now"
                      )}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={submittingMethod !== null}
                      onClick={() => handleSubmit("pay_on_arrival")}
                    >
                      {submittingMethod === "pay_on_arrival" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Order Now & Pay Later"
                      )}
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center text-xs text-petra-green/50">
                    <span className="inline-flex items-center gap-1">
                      <Check className="h-3 w-3 text-green-600" /> Replies in ~1 min
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Check className="h-3 w-3 text-green-600" /> We come to you
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Check className="h-3 w-3 text-green-600" /> Free rescheduling
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="block w-full text-center text-sm text-petra-green/50 hover:text-petra-green"
                  >
                    ← Back to Step 2
                  </button>
                </div>
              )}
            </>
          )}
        </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
