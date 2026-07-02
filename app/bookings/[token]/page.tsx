import Link from "next/link";
import {
  CalendarDays,
  Check,
  Clock,
  CreditCard,
  MapPin,
  Wallet,
  XCircle,
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import Navbar from "@/components/public/Navbar";
import Footer from "@/components/public/Footer";
import DownloadBookingPdf from "@/components/public/DownloadBookingPdf";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import type { Appointment, BookingStatus } from "@/lib/types";

export const metadata = {
  title: "Booking Status | Petra Paws",
};

const STATUS_COPY: Record<
  BookingStatus,
  { label: string; className: string; icon: typeof Check }
> = {
  pending_payment: {
    label: "Awaiting Payment",
    className: "bg-yellow-50 text-yellow-800 border-yellow-200",
    icon: Clock,
  },
  confirmed: {
    label: "Confirmed",
    className: "bg-green-50 text-green-800 border-green-200",
    icon: Check,
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-red-50 text-red-800 border-red-200",
    icon: XCircle,
  },
};

const SIZE_LABELS = { small: "Small", medium: "Medium", large: "Large" };

export default async function BookingStatusPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let appt = null;
  try {
    const supabase = await createAdminClient();
    const { data } = await supabase
      .from("appointments")
      .select("*, service:services(id,name,duration_minutes), zone:service_zones(id,name)")
      .eq("lookup_token", token)
      .single();
    appt = data;
  } catch {
    // Supabase not configured — fall through to "not found" state
  }

  return (
    <div className="min-h-screen bg-petra-sand">
      <Navbar />
      <main className="pt-24 pb-20">
        <div className="container-petra max-w-xl">
          {!appt ? (
            <div className="rounded-2xl border border-petra-green/10 bg-white p-8 text-center shadow-sm">
              <h1 className="mb-2 font-serif text-2xl font-bold text-petra-green">
                Booking Not Found
              </h1>
              <p className="mb-6 text-petra-green/60">
                We couldn&apos;t find a booking with that link. It may have expired or
                the link is incorrect.
              </p>
              <Link
                href="/book"
                className="inline-flex items-center justify-center rounded-full bg-petra-gold px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90"
              >
                Book a Grooming
              </Link>
            </div>
          ) : (
            <BookingStatusCard appt={appt as Appointment} />
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

function BookingStatusCard({ appt }: { appt: Appointment }) {
  const status = STATUS_COPY[appt.status];
  const StatusIcon = status.icon;
  const isPayOnArrival = appt.payment_method === "pay_on_arrival";

  return (
    <div className="rounded-2xl border border-petra-green/10 bg-white p-6 sm:p-8 shadow-sm">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-petra-green/50">
            Booking Reference
          </p>
          <p className="font-mono text-lg font-semibold text-petra-green">
            {appt.booking_reference}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${status.className}`}
          >
            <StatusIcon className="h-3.5 w-3.5" />
            {status.label}
          </span>
          <DownloadBookingPdf appt={appt} />
        </div>
      </div>

      {appt.status === "pending_payment" && (
        <div className="mb-6 rounded-lg bg-yellow-50 p-4 text-sm text-yellow-900">
          We&apos;re still waiting for your payment to be confirmed. If you
          completed payment and this doesn&apos;t update shortly, contact us
          with your booking reference.
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-petra-green/50">
            Pet
          </p>
          <p className="mt-0.5 font-medium text-petra-green">
            {appt.pet_name}
            {appt.pet_breed ? ` (${appt.pet_breed})` : ""}
          </p>
          <p className="text-sm capitalize text-petra-green/60">
            {appt.pet_type}
            {appt.size ? ` · ${SIZE_LABELS[appt.size]}` : ""}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-petra-green/50">
            Service
          </p>
          <p className="mt-0.5 font-medium text-petra-green">
            {appt.service?.name ?? "—"}
          </p>
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-petra-green/50">
            <CalendarDays className="h-3.5 w-3.5" /> Date & Time
          </p>
          <p className="mt-0.5 text-petra-green">{formatDate(appt.date)}</p>
          <p className="text-sm text-petra-green/60">
            {formatTime(appt.start_time)} – {formatTime(appt.end_time)}
          </p>
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-petra-green/50">
            <MapPin className="h-3.5 w-3.5" /> Location
          </p>
          <p className="mt-0.5 text-petra-green">{appt.zone?.name ?? "—"}</p>
          {appt.customer_address && (
            <p className="text-sm text-petra-green/60">{appt.customer_address}</p>
          )}
        </div>
      </div>

      {/* Payment */}
      <div className="mb-6 rounded-lg border border-petra-green/10 p-4">
        <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-petra-green/50">
          {isPayOnArrival ? (
            <Wallet className="h-3.5 w-3.5" />
          ) : (
            <CreditCard className="h-3.5 w-3.5" />
          )}
          Payment
        </p>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-petra-green/60">Subtotal</span>
            <span>{formatCurrency(appt.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-petra-green/60">VAT (5%)</span>
            <span>{formatCurrency(appt.vat)}</span>
          </div>
          <div className="flex justify-between border-t pt-1.5 font-semibold text-petra-green">
            <span>
              {isPayOnArrival
                ? appt.payment_status === "paid"
                  ? "Total Paid"
                  : "Due on Arrival"
                : "Total"}
            </span>
            <span className="text-petra-gold">{formatCurrency(appt.total)}</span>
          </div>
        </div>
        <p className="mt-3 text-xs text-petra-green/60">
          {isPayOnArrival
            ? appt.payment_status === "paid"
              ? "Payment collected on-site."
              : "You chose to pay on arrival — please have cash or card ready for the groomer."
            : appt.payment_status === "paid"
              ? "Paid online."
              : "Payment is being processed."}
        </p>
      </div>

      {appt.special_notes && (
        <div className="mb-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-petra-green/50">
            Special Notes
          </p>
          <p className="mt-0.5 text-sm text-petra-green/70">{appt.special_notes}</p>
        </div>
      )}
    </div>
  );
}
