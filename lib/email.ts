import { Resend } from "resend";
import type { Appointment, Service, ServiceZone } from "@/lib/types";

// Lazily instantiated — importing this module must not crash when
// RESEND_API_KEY isn't configured yet (e.g. local/build environments).
let resend: Resend | null = null;
function getResend() {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}
const FROM = process.env.EMAIL_FROM ?? "noreply@petrapaws.com";
const OWNER = process.env.OWNER_EMAIL ?? "";
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://petrapaws.com";

function formatCurrency(n: number) {
  return `AED ${n.toFixed(2)}`;
}

// ── Customer confirmation email ──────────────────────────────

export async function sendBookingConfirmation(
  appt: Appointment,
  service: Pick<Service, "name">,
  zone: Pick<ServiceZone, "name">
) {
  const statusUrl = `${SITE}/bookings/${appt.lookup_token}`;

  await getResend().emails.send({
    from: FROM,
    to: appt.customer_email,
    subject: `Booking Confirmed — ${appt.booking_reference} | Petra Paws`,
    html: `
      <h2>Your booking is confirmed!</h2>
      <p>Hi ${appt.customer_name},</p>
      <p>We've received your payment and confirmed your appointment. Here are your details:</p>
      <table style="border-collapse:collapse;width:100%">
        <tr><td><strong>Reference</strong></td><td>${appt.booking_reference}</td></tr>
        <tr><td><strong>Service</strong></td><td>${service.name}</td></tr>
        <tr><td><strong>Pet</strong></td><td>${appt.pet_name}${appt.pet_breed ? ` (${appt.pet_breed})` : ""}</td></tr>
        <tr><td><strong>Date</strong></td><td>${appt.date}</td></tr>
        <tr><td><strong>Time</strong></td><td>${appt.start_time}</td></tr>
        <tr><td><strong>Location</strong></td><td>${zone.name}</td></tr>
        <tr><td><strong>Total Paid</strong></td><td>${formatCurrency(appt.total)}</td></tr>
      </table>
      <p>
        <a href="${statusUrl}" style="background:#f97316;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;display:inline-block;margin-top:16px">
          View Booking Status
        </a>
      </p>
      <p>We come to you — see you on ${appt.date}!</p>
      <p>— The Petra Paws Team</p>
    `,
  });
}

// ── Owner alert email ────────────────────────────────────────

export async function sendOwnerBookingAlert(
  appt: Appointment,
  service: Pick<Service, "name">,
  zone: Pick<ServiceZone, "name">
) {
  if (!OWNER) return;

  await getResend().emails.send({
    from: FROM,
    to: OWNER,
    subject: `New Booking — ${appt.booking_reference} (${appt.date} ${appt.start_time})`,
    html: `
      <h2>New Booking Alert</h2>
      <table style="border-collapse:collapse;width:100%">
        <tr><td><strong>Reference</strong></td><td>${appt.booking_reference}</td></tr>
        <tr><td><strong>Customer</strong></td><td>${appt.customer_name} — ${appt.customer_email} — ${appt.customer_phone}</td></tr>
        <tr><td><strong>Pet</strong></td><td>${appt.pet_name}${appt.pet_breed ? ` (${appt.pet_breed})` : ""} — ${appt.pet_type}${appt.size ? `, ${appt.size}` : ""}</td></tr>
        <tr><td><strong>Service</strong></td><td>${service.name}</td></tr>
        <tr><td><strong>Date</strong></td><td>${appt.date}</td></tr>
        <tr><td><strong>Time</strong></td><td>${appt.start_time} – ${appt.end_time}</td></tr>
        <tr><td><strong>Zone</strong></td><td>${zone.name}</td></tr>
        ${appt.customer_address ? `<tr><td><strong>Address</strong></td><td>${appt.customer_address}</td></tr>` : ""}
        ${appt.special_notes ? `<tr><td><strong>Notes</strong></td><td>${appt.special_notes}</td></tr>` : ""}
        <tr><td><strong>Total</strong></td><td>${formatCurrency(appt.total)} (incl. 5% VAT)</td></tr>
      </table>
    `,
  });
}
