# WhatsApp Booking — What We Need From You

Customers will be able to book an appointment entirely inside WhatsApp —
no app, no website — by replying to numbered prompts (e.g. "1. Dog,
2. Cat"). The booking, pricing, availability and payment logic is
already built and reuses the exact same engine as the website. To turn
it on, we need a few things from Meta (WhatsApp's owner) that only you
can provide, since they require your business's own accounts.

## What to set up, in order

| Step | Where | What to do |
|---|---|---|
| 1. Business account | [business.facebook.com](https://business.facebook.com) | Create or log into your Meta Business Suite account for the company. |
| 2. Developer app | [developers.facebook.com](https://developers.facebook.com) | Create a new app, choose "Business" type, then add the **WhatsApp** product to it. |
| 3. Phone number | Same app → **WhatsApp → API Setup** | Either use Meta's free test number to try things out first, or add your real business number. **Important:** a number added here can no longer be used in the regular WhatsApp / WhatsApp Business phone app at the same time. |
| 4. Permanent access token | App → **Business Settings → Users → System Users** | Create a System User, generate a permanent token for it with `whatsapp_business_messaging` permission. (The temporary token shown on the API Setup page expires in 24 hours — don't send us that one.) |
| 5. App Secret | App → **App Settings → Basic** | Copy the "App Secret" value (click "Show"). |

## Send us

- **Phone Number ID** (from step 3 — a long number, not the phone number itself)
- **Permanent access token** (from step 4)
- **App Secret** (from step 5)
- The **real phone number** you want customers texting for bookings

Send these via a password manager or secure share — not plain email/chat.

## What happens after that

We'll add your values to the site, give you a webhook URL and a verify
code to paste back into the Meta App Dashboard (**WhatsApp → Configuration
→ Webhook**), and test the full booking flow end-to-end before it goes
live for customers.

## Good to know

- **Business verification:** to message more than a handful of test
  numbers, Meta requires verifying your business — this can take a
  few business days, so it's worth starting early rather than at launch.
- **Cost:** Meta gives a free monthly allowance of conversations, then
  charges per conversation after that — check current pricing at
  [business.whatsapp.com](https://business.whatsapp.com) before launch.
- **24-hour reply window:** this only affects free-form replies more
  than 24 hours after a customer's last message (e.g. a reminder) — it
  doesn't affect the booking flow itself, which is always customer-initiated.
