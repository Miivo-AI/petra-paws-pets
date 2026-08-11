/**
 * The booking-confirmation template contract.
 *
 * The old template body — "Your booking has been confirmed. We will
 * contact you as soon as possible…" — had no variables at all. Meta's
 * category review reads a message with no transaction detail as
 * Marketing rather than Utility, which brings per-user marketing limits,
 * stricter opt-in enforcement, higher per-message cost and pausing on
 * quality drops. It also left the customer unable to tell which booking
 * the message referred to.
 *
 * So the template takes parameters, and which parameters (and their
 * order) is declared in one place here rather than being implied by the
 * shape of the API call. WHATSAPP_TEMPLATE_VARIABLES overrides the order
 * to match whatever Meta actually approved; setting it to an empty
 * string sends a parameter-less template, which is what an already
 * approved no-variable template needs.
 */

import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import type { Appointment } from "@/lib/types";

/**
 * Submit this body to WhatsApp Manager as a **Utility** template. The
 * numbered placeholders must line up with DEFAULT_TEMPLATE_VARIABLES.
 */
export const BOOKING_CONFIRMED_TEMPLATE_BODY =
  "Hi {{1}}, your Petra Paws booking {{2}} is confirmed for {{3}} at {{4}} " +
  "({{5}} for {{6}}). We'll contact you shortly to confirm the details. " +
  "Reply STOP to stop WhatsApp updates.";

export const DEFAULT_TEMPLATE_VARIABLES = [
  "customer_name",
  "booking_reference",
  "date",
  "time",
  "service",
  "pet_name",
] as const;

export type TemplateVariable =
  | "customer_name"
  | "pet_name"
  | "booking_reference"
  | "date"
  | "time"
  | "service"
  | "zone"
  | "total";

export type TemplateContext = {
  appointment: Appointment;
  serviceName: string | null;
  zoneName: string | null;
};

/**
 * Meta rejects parameters containing newlines, tabs, or runs of 4+
 * spaces with error 132000, and silently truncates nothing — so
 * everything is flattened and a never-empty fallback is used, since an
 * empty string is also rejected.
 */
function clean(value: string | null | undefined, fallback: string): string {
  const flattened = (value ?? "").replace(/\s+/g, " ").trim();
  return flattened || fallback;
}

function resolveVariable(name: TemplateVariable, ctx: TemplateContext): string {
  const { appointment: a } = ctx;
  switch (name) {
    case "customer_name":
      return clean(a.customer_name.split(" ")[0], "there");
    case "pet_name":
      return clean(a.pet_name, "your pet");
    case "booking_reference":
      return clean(a.booking_reference, "-");
    case "date":
      return clean(formatDate(a.date), a.date);
    case "time":
      return clean(formatTime(a.start_time), a.start_time);
    case "service":
      return clean(ctx.serviceName ?? a.service?.name, "grooming");
    case "zone":
      return clean(ctx.zoneName ?? a.zone?.name, "your area");
    case "total":
      return clean(formatCurrency(a.total), String(a.total));
  }
}

const KNOWN_VARIABLES = new Set<string>([
  "customer_name",
  "pet_name",
  "booking_reference",
  "date",
  "time",
  "service",
  "zone",
  "total",
]);

/**
 * Reads WHATSAPP_TEMPLATE_VARIABLES. Unset falls back to the default
 * order; explicitly empty means "template takes no parameters".
 */
export function templateVariableOrder(): TemplateVariable[] {
  const raw = process.env.WHATSAPP_TEMPLATE_VARIABLES;
  if (raw === undefined) return [...DEFAULT_TEMPLATE_VARIABLES];

  const names = raw
    .split(",")
    .map((n) => n.trim().toLowerCase())
    .filter(Boolean);

  const unknown = names.filter((n) => !KNOWN_VARIABLES.has(n));
  if (unknown.length > 0) {
    console.error(
      `[whatsapp] WHATSAPP_TEMPLATE_VARIABLES contains unknown name(s): ${unknown.join(", ")}. ` +
        `Valid names: ${[...KNOWN_VARIABLES].join(", ")}.`
    );
  }

  return names.filter((n): n is TemplateVariable => KNOWN_VARIABLES.has(n));
}

/**
 * Stand-in booking for the admin test message, so the test exercises the
 * exact same parameter count and ordering as a real send — a test that
 * skipped the parameters would pass while every real confirmation failed
 * with 132000.
 */
export function sampleTemplateContext(): TemplateContext {
  const today = new Date().toISOString().slice(0, 10);
  return {
    appointment: {
      customer_name: "Test",
      pet_name: "Bella",
      booking_reference: "TEST-0000",
      date: today,
      start_time: "10:00",
      total: 0,
    } as Appointment,
    serviceName: "Full Grooming",
    zoneName: "Test Area",
  };
}

/**
 * Returns undefined for a parameter-less template — the Cloud API
 * rejects an empty `components` array rather than ignoring it.
 */
export function buildTemplateComponents(ctx: TemplateContext) {
  const order = templateVariableOrder();
  if (order.length === 0) return undefined;

  return [
    {
      type: "body",
      parameters: order.map((name) => ({
        type: "text",
        text: resolveVariable(name, ctx),
      })),
    },
  ];
}
