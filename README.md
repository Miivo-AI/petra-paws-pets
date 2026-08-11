# Petra Paws — Mobile Pet Grooming

Marketing site + booking engine + admin dashboard for a mobile dog & cat grooming
service in Dubai. Customers book a time slot and a groomer comes to their door;
the app handles scheduling, travel-time-aware availability, pricing, payment
(online or on arrival), and day-of-route management for the owner.

## Tech stack

- **Framework:** Next.js 15 (App Router, React 19, TypeScript)
- **Database / Auth:** Supabase (Postgres + Row Level Security + Auth)
- **Payments:** [Ziina](https://ziina.com) (UAE payment gateway) — plus a
  pay-on-arrival option for customers who can't/won't pay online
- **Email:** Resend (booking confirmations, owner alerts)
- **Maps:** Google Distance Matrix API (drive-time between service zones)
- **UI:** Tailwind CSS, Radix UI primitives, shadcn-style components
- **State:** Zustand (client cart store)

## Getting started

```bash
npm install
cp .env.example .env   # fill in the values below
npm run dev
```

Runs at `http://localhost:3000`. The site renders with fallback content if
Supabase isn't configured, but booking, availability, and the admin dashboard
all require it.

### Environment variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project — public client (RLS-scoped) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only admin client — bypasses RLS, used for confirm/lookup/zone reads |
| `ZIINA_API_KEY` / `ZIINA_API_URL` | Online payment intents + verification |
| `RESEND_API_KEY` / `EMAIL_FROM` / `OWNER_EMAIL` | Transactional email (customer confirmation + owner alert) |
| `NEXT_PUBLIC_SITE_URL` | Used to build redirect/callback URLs (Ziina, magic links) |

See [`.env.example`](.env.example) for the full list.

### Database

Migrations live in [`supabase/migrations/`](supabase/migrations/) and run in
filename order:

1. `001_initial_schema.sql` — base tables
2. `002_prd_schema.sql` — services, zones, pricing matrix, blackouts,
   appointments, travel-time cache, RLS policies, seed data
3. `003_pay_on_arrival.sql` — adds `payment_method` / `payment_status` to
   appointments
4. `004_booking_integrity.sql` — atomic booking RPC, idempotency,
   confirmation dedupe
5. `005`–`008` — the WhatsApp booking bot and Embedded Signup tables,
   added and then removed again
6. `009_whatsapp_coexistence.sql` — WhatsApp coexistence connection,
   consent ledger, and outbound delivery log

#### Applying them

[`scripts/migrate.mjs`](scripts/migrate.mjs) applies whatever hasn't run
yet, tracked in a `schema_migrations` table. Each migration runs in its own
transaction, so a failure rolls back cleanly instead of leaving half a
schema change behind.

```bash
npm run db:status                    # what's applied, what's pending
npm run db:migrate                   # apply everything pending
npm run db:migrate -- --dry-run      # show what would run, change nothing
```

Needs `SUPABASE_DB_URL` in `.env` (or `.env.local`). Get it from the
Supabase Dashboard: press **Connect** at the top of the project page and
copy the URI under **Session pooler** — then fill in the database password.
Use the **session-mode pooler (port 5432)** or the direct connection; the
transaction-mode pooler on 6543 can't run DDL reliably. Nothing else in the
app uses this variable.

> **First run against an existing database.** Production was migrated by
> hand through the SQL Editor, so the tracking table starts empty and
> running `db:migrate` would try to re-apply `001`. Record what already ran
> first, naming the last migration that was applied:
>
> ```bash
> npm run db:baseline -- --through 008   # marks 001–008 applied, doesn't run them
> npm run db:migrate                     # applies 009 onwards for real
> ```
>
> `db:migrate` detects this situation and refuses rather than failing
> mid-way. Double-check the cutoff in the Supabase Table Editor —
> anything baselined by mistake will never run.

Editing a migration that has already been applied is flagged on the next
run via a checksum mismatch. Add a new file instead.

## Project structure

```
app/
  page.tsx                       Homepage (marketing sections)
  book/                          Public booking form
  bookings/                      Booking lookup + status/tracking page
    [token]/page.tsx
  admin/                         Owner dashboard (auth-gated)
    appointments/  availability/  services/
  api/
    bookings/                    Create / confirm / lookup a booking
    availability/                Slot availability engine
    services/  zones/            Public read endpoints for the booking form
  login/                         Admin sign-in
  auth/callback/                 Supabase auth callback

lib/
  booking/
    availability.ts              Core slot-availability algorithm
    pricing.ts                   Price lookup + VAT calculation
    travel.ts                    Zone-to-zone drive time (Google Maps + cache)
  email.ts                       Resend templates (confirmation, owner alert)
  supabase/                      Browser / server / admin Supabase clients
  types.ts                       Shared domain types

components/
  public/                        Marketing site sections
  admin/                         Dashboard managers (appointments, services, availability)
  ui/                            Shared design-system primitives

supabase/migrations/             SQL migrations (source of truth for schema)
```

## How booking works

1. **Browse & configure** — `/book` fetches active services (`GET
   /api/services`) and zones (`GET /api/zones`), lets the customer pick a
   pet type/size, service, zone, address, and date.
2. **Availability** — `GET /api/availability?date=&service_id=&zone_id=`
   runs [`getAvailableSlots`](lib/booking/availability.ts): builds a 5-minute
   grid across the 10:00–17:00 working day (closed Mondays), removes slots
   that overlap a confirmed booking, a live payment hold, or an admin
   blackout, and enforces **travel buffers** so two jobs are never scheduled
   closer together than the drive time between their zones (via
   [`travelTime`](lib/booking/travel.ts), estimated from zone centroid
   distance — no external API required).
3. **Submit** — `POST /api/bookings` re-validates the slot server-side
   (never trusts the client), looks up the price from the
   `(pet_type, service_id, size)` matrix, computes VAT, and creates the
   appointment. What happens next depends on payment method:
   - **Pay online** — the booking is created as `pending_payment` with a
     10-minute hold, a Ziina payment intent is created, and the customer is
     redirected to Ziina's checkout.
   - **Pay on arrival** — no gateway call, no hold. The booking is created
     directly as `confirmed` with `payment_status: 'unpaid'`, and the
     customer is redirected straight to their tracking page. The groomer
     collects cash or card on-site.
4. **Confirm (online only)** — Ziina redirects back to
   `GET /api/bookings/[id]/confirm`, which re-verifies the payment directly
   with Ziina's API (never trusts the redirect alone), flips the booking to
   `confirmed` + `payment_status: 'paid'`, and fires the confirmation +
   owner-alert emails.
5. **Track** — `/bookings/[token]` (a UUID magic link, also emailed to the
   customer) shows live status, and for pay-on-arrival bookings, whether the
   amount is still due or has been collected. Customers without the email
   can look themselves up by reference + email at `/bookings`
   (`GET /api/bookings/lookup`).

### Payment methods

| | Pay Online | Pay on Arrival |
|---|---|---|
| Gateway | Ziina payment intent | None |
| Initial status | `pending_payment` (10 min hold) | `confirmed` immediately |
| `payment_status` | `unpaid` → `paid` once Ziina confirms | `unpaid` until the owner marks it collected |
| Where it's marked paid | Automatic, via `/api/bookings/[id]/confirm` | Manually, by the owner in `/admin/appointments` |

The admin dashboard surfaces a **"Cash to Collect"** stat and tags
pay-on-arrival jobs in Today's Route so the owner knows to bring change.

## Admin dashboard

`/admin/*` is gated by [`middleware.ts`](middleware.ts), which redirects
unauthenticated requests to `/login` (Supabase Auth session cookies).

- **Dashboard** (`/admin`) — today's route, upcoming bookings, stats
  (confirmed, awaiting payment, cash to collect, active services)
- **Appointments** (`/admin/appointments`) — search/filter bookings, view
  full details, manually confirm/cancel, mark pay-on-arrival bookings as
  paid once cash is collected
- **Availability** (`/admin/availability`) — manage blackout dates/times
- **Services** (`/admin/services`) — manage services and the pricing matrix

## Scripts

```bash
npm run dev          # start dev server
npm run build        # production build
npm run start        # run the production build
npm run lint         # eslint

npm run db:status    # list applied / pending migrations
npm run db:migrate   # apply pending migrations
npm run db:baseline  # record migrations as applied without running them
```
