# WhatsApp Booking Confirmations — Meta Cloud API

Every booking sends the customer a WhatsApp confirmation alongside email —
but only if they ticked the WhatsApp box on the booking form and haven't
replied STOP. Email always goes out regardless.

There are two ways to connect a number. Pick one before doing anything in
Meta, because they need different things.

## Path A — Coexistence (recommended: keep using the phone)

The number stays fully usable in the WhatsApp Business app on the owner's
phone, while this site sends confirmations from the same number.

**This cannot be set up with credentials alone.** Meta only ever links a
Business-app number to the Cloud API through Embedded Signup, which means:

1. The Meta app must be a **Tech Provider** — app type Business, business
   portfolio verified, Tech Provider onboarding complete, and App Review
   granting **advanced access** to `whatsapp_business_messaging` and
   `whatsapp_business_management`. Budget weeks, not days. The App Review
   screencast should show `/admin/whatsapp` and the booking form's
   WhatsApp consent checkbox.
2. The webhook must be live **before** the coexistence option appears in
   Embedded Signup. In App Dashboard → WhatsApp → Configuration →
   Webhooks, point the callback at `https://<your-domain>/api/webhooks/whatsapp`,
   enter the same value as `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, and subscribe
   to **messages, account_update, history, smb_app_state_sync,
   smb_message_echoes**.
3. Register the production domain under both **Allowed Domains** and
   **Valid OAuth Redirect URIs**, or the signup popup returns nothing.
4. An admin then clicks **Connect WhatsApp** on `/admin/whatsapp` and
   completes the flow on the phone.

Note: Embedded Signup v2 is deprecated on **15 October 2026**; anything
built here should target v4.

### The owner must know these before connecting

Connecting changes the WhatsApp Business app on their phone, permanently:

- All linked devices are unlinked and have to be paired again.
- Broadcast lists become read-only; no new ones can be created.
- Disappearing messages, view-once, and live location are turned off for
  all 1:1 chats.
- Group chats never sync to the API. WhatsApp for Windows and WearOS
  aren't supported as companions.
- **Do not uninstall the app** — that disconnects the account.
- **Open the app at least once every ~13 days.** Meta disconnects after
  roughly 14 days of primary-device inactivity.
- Registering that number on consumer WhatsApp disconnects it too.

Also: messages sent from the phone stay free, but every send from this
site is billed at Cloud API rates, so a payment method must be attached
to the WABA. An unverified business is capped at 250 unique recipients
per 24 hours until business verification completes.

### The 24-hour sync window

Once an admin finishes Embedded Signup, Meta allows exactly **24 hours**
to pull the owner's contacts and chat history, and exactly **one attempt
at each**. `/admin/whatsapp` runs both automatically right after
connecting, shows how much of the window is left, and offers **Retry
sync** if a step failed. Miss the window and the number must be
disconnected from the phone and reconnected from scratch.

Tell the owner to keep the WhatsApp Business app open while this runs.

### UAE eligibility

Coexistence is unavailable for numbers with country codes in Australia,
Japan, Nigeria, Philippines, Russia, South Korea, South Africa, Turkey,
or in the EEA/EU/UK. **+971 is eligible.**

## Path B — API-only number

Simpler, but the number stops working in the WhatsApp Business app. Only
worth it for a dedicated notifications number.

1. Complete number setup and payment in Meta.
2. Create a permanent **system user token**:
   Business Settings → Users → System users → Generate token, permission
   `whatsapp_business_messaging`, never expire.
3. Note the **Phone Number ID** (WhatsApp → API Setup) — not the phone
   digits.
4. Set `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID`.

These env credentials are also the fallback whenever no number has been
connected through `/admin/whatsapp`.

## The message template (both paths)

Create a **Utility** template in WhatsApp Manager with this body:

> Hi {{1}}, your Petra Paws booking {{2}} is confirmed for {{3}} at {{4}}
> ({{5}} for {{6}}). We'll contact you shortly to confirm the details.
> Reply STOP to stop WhatsApp updates.

The placeholders matter. A template with no variables and no booking
detail reads as *Marketing* to Meta's category review, not Utility —
which brings per-user marketing limits, opt-in enforcement, higher
per-message cost, and pausing when quality dips.

After approval, set the name, language, and parameter order:

```env
WHATSAPP_TEMPLATE_NAME=booking_confirmed
WHATSAPP_TEMPLATE_LANGUAGE=en
WHATSAPP_TEMPLATE_VARIABLES=customer_name,booking_reference,date,time,service,pet_name
```

Two failure modes worth knowing, because both fail *every* send:

- Approving the template as `en_US` while `WHATSAPP_TEMPLATE_LANGUAGE=en`
  → Meta error **132001**.
- A parameter list that doesn't match the placeholders → error **132000**.

Use **Send a test message** on `/admin/whatsapp` after any template
change. It sends the real template with real parameters, so both errors
surface there rather than on a customer's booking.

## Consent and STOP

- The booking form has a WhatsApp consent checkbox directly under the
  phone field, naming both WhatsApp and Petra Paws. It's pre-ticked;
  unticking it means no WhatsApp is ever sent to that number.
- The exact wording agreed to, plus its version and timestamp, is stored
  per phone number in `whatsapp_contacts` — that record is the evidence
  App Review asks for.
- A customer replying **STOP** (or UNSUBSCRIBE, OPT OUT, and the Arabic
  equivalents) is opted out automatically by the webhook. **CANCEL is
  deliberately not a keyword** — for a grooming business that means
  "cancel my appointment", and muting that customer would be worse than
  useless. Replying **START** re-subscribes.
- Opting out always beats a later opt-in from the booking form. Someone
  who said STOP is not re-subscribed just by booking again.

## Checking it actually works

`/admin/whatsapp` shows whether Meta still accepts the stored token,
whether the number is genuinely in coexistence (`is_on_biz_app`), the
current quality rating, and the **last 10 failed or skipped sends** with
Meta's error code. "Skipped" means this app declined to send — no
opt-in, opted out, or an unusable number. "Failed" means Meta rejected
it.

Every send is recorded in `whatsapp_messages`, and delivery webhooks
update each row through sent → delivered → read, so "Meta accepted it" is
never mistaken for "the customer got it".

## Env reference

See `.env.example` for the annotated list. Until a number is connected
(or `WHATSAPP_TOKEN` is set) and an approved template is configured,
WhatsApp sends are logged as skipped and email still goes out normally.

## Database

Requires migration `009_whatsapp_coexistence.sql`
(`whatsapp_connection`, `whatsapp_contacts`, `whatsapp_messages`, and
`appointments.whatsapp_sent_at`). Apply it with `npm run db:migrate` — see
the Database section of the README, including the one-time
`npm run db:baseline -- --through 008` needed the first time you run it
against the existing production database.

New bookings store phone numbers as E.164 (`+9715…`). Rows created before
that migration keep whatever the customer typed and are normalized
best-effort at send time — deliberately not machine-rewritten, since a
wrong guess would message a stranger.
