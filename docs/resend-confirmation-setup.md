# Resend confirmation-email integration — needs account and domain setup

Resend was selected on 26 October 2026. The sender domain is **not yet known**. The project URL is `https://vzzabkviwyarrdkevqco.supabase.co` (ref: `vzzabkviwyarrdkevqco`). The ChatGPT Supabase plugin still has access only to **UniOS**, not this project; a direct Yumorilnik lookup returned permission denied. **Do not apply migrations to UniOS.**

## Email implementation prepared

- `supabase/migrations/20261026_resend_delivery_queue.sql`: one pending email record per adult on a confirmed booking, private from anonymous browsing.
- `lib/bookingConfirmationEmail.ts`: bilingual text for booking reference, adult and their accompanying children, table/seat, amount and code.
- `app/api/internal/send-booking-confirmations/route.ts`: server-only Resend HTTP integration; each adult gets a separate bilingual email; attempts and provider IDs are recorded. The route does not run on its own. It requires an authenticated server-to-server POST.
- All email processing is **disabled** until `BOOKING_EMAILS_ENABLED=true`. The configured FROM must be a verified non-`resend.dev` domain.
- Provider API acknowledgement does **not** guarantee inbox delivery; Resend dashboard and webhooks are needed to inspect actual delivery/bounce status.
- In this phase email delivery is best-effort; provider-success/db-write failure can require careful manual reconciliation rather than blindly resending and risking duplicate emails.

## Configure securely after Marina identifies the domain

1. Create or sign in to the Yumorilnik Resend account at https://resend.com. Add a domain controlled by Yumorilnik and verify the SPF/DKIM records Resend provides.
2. Decide sender identity, e.g. `Yumorilnik Tickets <tickets@verified-domain.example>`. **Example only; don't invent Marina's domain.**
3. Set secret values in the website hosting platform's environment-variable dashboard (never in ChatGPT messages or Git):
   - `SUPABASE_URL=https://vzzabkviwyarrdkevqco.supabase.co`
   - `SUPABASE_SECRET_KEY` (server-only from Yumorilnik Supabase; **never** `NEXT_PUBLIC_`)
   - `RESEND_API_KEY` (server-only)
   - `RESEND_FROM_EMAIL` (verified sender address)
   - `BOOKING_EMAIL_PROCESSOR_SECRET` (long random server-to-server bearer secret)
   - `BOOKING_EMAILS_ENABLED=true` **only after manual approval and verification**
4. Apply **only to Yumorilnik** the booking-request migration, then the TEST12 confirmation migration, then the Resend delivery-queue migration. Confirm schema compatibility and Marina's admin role.
5. Configure a trusted scheduler or authorised admin service to POST `/api/internal/send-booking-confirmations` with `Authorization: Bearer <BOOKING_EMAIL_PROCESSOR_SECRET>`. There is deliberately no public button for triggering email sends. Set a sensible cadence and retry limits before launch.
6. Manually book with TEST12, then inspect the booking in Marina's dashboard, queue rows and Resend. Confirm the right intended adults receive messages, the guests/tables are correct, cancellations release seats, and duplicate booking attempts fail. No automated tests were run on these changes per user's request.

### Sender-domain restriction

Until Resend verifies a domain, `onboarding@resend.dev` is for limited testing to the Resend account email, not arbitrary real customer recipients. The route **refuses to send** from `resend.dev` to real booking addresses to prevent misleading confirmations.

## Launch gates — not yet satisfied

- [ ] Supabase plugin is connected to project `vzzabkviwyarrdkevqco`.
- [ ] Marina confirms sender domain/address; Resend verified.
- [ ] SQL migrations are safely applied to the correct project.
- [ ] Public TEST12 free reservations have rate limits and anti-bot controls.
- [ ] Private email worker is configured, manually invoked and verified.
- [ ] Marina's admin login and full booking/cancel journey manually checked.
- [ ] Only then enable `booking_promotions.enabled`, `NEXT_PUBLIC_REAL_BOOKINGS_ENABLED` and `BOOKING_EMAILS_ENABLED`.

No paid ticket gateway or Matryoshka food-ordering redirect is enabled in this phase.
