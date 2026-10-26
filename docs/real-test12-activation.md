# Real free bookings with TEST12 — activation checklist (27 October 2026)

**Work prepared, not activated.** This branch includes a database-side 100% discount for `TEST12`, a confirmed-free-booking RPC, an email outbox (NOT a sender), a bilingual email content template, and booking/admin UI wiring. The user has explicitly requested **manual testing only**, so no automated tests, lint or builds were run or claimed.

## Confirmed business decisions

- Anyone who enters `TEST12` may use it **when Marina enables it**. There is no pre-approved email list.
- Adults pay their selected table's per-place price; no upfront adult admission charge. Children pay admission and use spare children's seating, with no paid child table-seat step.
- With the 100% promo, **NZ$0 payable**. Payment integration is not needed for free transactions.
- Free bookings are **real confirmed reservations** only after the database RPC succeeds; the database checks for already confirmed seats/tables and rejects conflicts.
- A real booking may not claim a confirmation email was sent until a configured provider successfully delivers it.
- Matryoshka food-ordering redirect is deliberately deferred until after this critical path.

## What to do to activate — in order

1. **Connect the correct existing Yumorilnik Supabase project.** Current plugin can only see the unrelated UniOS project. Do not apply either migration or copy credentials from UniOS. Obtain the Yumorilnik project URL/ref through a connected project; never paste service_role keys into chat or GitHub.
2. Review/apply prerequisite schema and `supabase/migrations/20261026_booking_requests.sql` on Yumorilnik ONLY, then the additive `supabase/migrations/20261026_test12_confirmed_bookings.sql`. Review admin auth/RLS and customer API permissions in that project first.
3. Decide/identify the **email provider**, the sending domain, and its authenticated FROM address. Configure sender domain verification (SPF/DKIM). Wire the outbox to an authenticated, private server-side sender with retries, a provider message ID, and delivery error recording. Send to the adults' emails, including child names/parent link where appropriate. Use `lib/bookingConfirmationEmail.ts` for bilingual content. A provider credential must be in server-only environment variables, never `NEXT_PUBLIC_`. Do not mark an outbox row sent before the provider reports acceptance.
4. Add a practical rate limit / bot protection to public confirmation RPC calls before opening code to anyone. Otherwise an individual can reserve many free seats or generate unwanted emails. Since TEST12 is unrestricted by email per user decision, avoid making it publicly available without controls.
5. Verify a real booking and an email received at an intended recipient, Marina's admin view, seat conflicts, cancellation releasing seats, repeat submits not duplicating entries, missing price rejection, and unexpected failures. User will perform manual UI testing; backend deployer still needs to verify schema/security in real Supabase.
6. Once safeguards work, set `public.booking_promotions.enabled=true` **for TEST12 only**, then `NEXT_PUBLIC_REAL_BOOKINGS_ENABLED=true` in the Yumorilnik deployment and restart/redeploy. This flag also bypasses the old localhost fictional saver. Do not enable prior to DB + email verification.
7. Provide Marina an admin login and ensure she can see reference, guest name, selected table/seat, promo, confirmation email status and cancellation. Never publicise this admin page without its existing authentication checks.

## Status semantics

`requested`: unconfirmed; no seat hold.
`confirmed`: free TEST12 promotion applied by the database; table places reserved.
`cancelled`: seat released for another confirmation; historical record remains.
`confirmation_email_status='pending'`: not yet sent; a queue entry awaiting a working email provider.
`sent`: only after a successful provider call, which is not implemented in this branch.

**Blocked:** actual sending of confirmation emails and live booking activation until the correct Supabase project and mail provider/domain are known. Neither UniOS nor a simulated email can substitute. Payment processing for non-TEST12 orders is intentionally not added.

**Manually test only.** Do not automatically activate CI workflows, migrate databases or email actual people as part of this change.
