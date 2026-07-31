# Accounts Needed From Client

Please create an account with each service below, then send over the
credentials listed (via a password manager or secure share — not plain
email/chat). We'll handle all the technical setup from there.

| Service | Sign up at | Send us |
|---|---|---|
| **Vercel** (hosting) | vercel.com | Invite us as a collaborator on the project |
| **Domain / DNS** | your registrar | Login, or DNS-editing access |
| **Supabase** (database & login) | supabase.com | Project URL, `anon` key, `service_role` key (Project Settings → API). Pro plan recommended so the DB doesn't pause. |
| **Resend** (email) | resend.com | API key. Also verify your sending domain under Domains — we'll give you the DNS records to add. |
| **Ziina** (payments) | ziina.com | API key + webhook secret (business/KYC signup required — trade license & ID on hand) |
| **Cron scheduler** | cron-job.org | Sign up (free) and point a job at `https://<your-domain>/api/cron/reconcile-bookings` every 5 minutes, with header `Authorization: Bearer <CRON_SECRET>`. Vercel's own Cron is Hobby-plan limited to once a day, so cron-job.org is the primary trigger unless you're on Vercel Pro. |

## Also send us

- Real business phone number (footer currently shows a placeholder)
- Email address for booking alerts (owner) and admin notices
- WhatsApp Business number, if you want a WhatsApp contact link added
- For the WhatsApp **booking bot** (customers book directly in a WhatsApp chat) see `WHATSAPP-BOOKING-CLIENT-SETUP.md` — a separate set of Meta accounts is needed for that

## Not needed for launch

- **Google Maps API key** — travel-time estimates work without it. Only
  relevant later if you want real traffic-aware drive times.
