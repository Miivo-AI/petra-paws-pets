# WhatsApp Booking Confirmations — Client Setup Guide

Every booking now sends the customer an automatic WhatsApp message
("Your booking has been confirmed. We will contact you as soon as
possible to confirm the details of your appointment.") alongside the
email confirmation. To turn this on we need three things from a Meta
(Facebook) Business account you control: an access token, a Phone
Number ID, and an approved message template.

## 1. Create or find your Meta Business Account

Go to [business.facebook.com](https://business.facebook.com). If you
don't already have a Business Account for the company, create one —
it's free.

## 2. Create a Meta App with the WhatsApp product

- Go to [developers.facebook.com/apps](https://developers.facebook.com/apps)
  → **Create App** → choose **Business** as the app type → link it to
  your Business Account.
- In the app dashboard, add the **WhatsApp** product.

## 3. Connect your WhatsApp Business phone number

- On the **WhatsApp → API Setup** page, click **Add phone number** and
  register your real business number (the free test number is fine for
  trying things out, but customers should see messages arrive from your
  real number at launch).
- Note the **Phone Number ID** shown on this page — this is a separate
  ID Meta assigns, not the phone number itself. This is `WHATSAPP_PHONE_NUMBER_ID`.

## 4. Generate a permanent access token

- The token shown by default on the API Setup page is **temporary and
  expires after 24 hours** — it will silently break booking
  confirmations the next day, so don't send us that one.
- Instead: **Business Settings → Users → System Users → Add** → create
  a system user with the **Admin** role → **Add Assets** → assign your
  app → **Generate New Token** → select the app, set expiration to
  **Never**, and check the `whatsapp_business_messaging` permission.
- Send us this token — it's `WHATSAPP_TOKEN`.

## 5. ⚠️ Approve a message template (required)

WhatsApp only lets a business message a customer *first* — before the
customer has messaged it — using a **pre-approved message template**.
A plain free-text message fails to deliver to anyone who hasn't
messaged your WhatsApp number within the last 24 hours, which is true
for most customers booking through the website. This step is required
for the confirmations to actually arrive.

- In the app dashboard: **WhatsApp → Message Templates → Create Template**.
- Category: **Utility**.
- Body text: "Your booking has been confirmed. We will contact you as
  soon as possible to confirm the details of your appointment."
- Submit for review — Meta typically approves utility templates within
  a few minutes to a few hours.
- Let us know the template's **name** and **language** once approved
  so we can wire it in.

## Send us

- `WHATSAPP_TOKEN` — permanent system-user token (step 4)
- `WHATSAPP_PHONE_NUMBER_ID` (step 3)
- Approved template name + language code (step 5)
