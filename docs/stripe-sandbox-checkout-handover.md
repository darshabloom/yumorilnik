# Stripe Sandbox Checkout — Yumorilnik implementation handover
Date: 28 October 2026. Branch: feature/stripe-sandbox-checkout-20261028.

**Status:** Feature code and SQL prepared. No Stripe account configured, no SQL applied, no payment test performed, no automated tests/build/lint/CI run, no real checkout enabled. Do not merge or enable until the preflight and manual code review are complete.

## Authorised use

- NYE 2026 event: 3f6fa4d1-aaca-4326-9c01-5774cffca2f5.
- Database: vzzabkviwyarrdkevqco.supabase.co **only**. NEVER use Matryoshka or UniOS Supabase.
- Stripe: separate **Yumorilnik** test account. The currently connected Matroshka sandbox (acct_1SXo5CPIwTIma6Ev) is blocked by code. No live-mode keys accepted.
- One-time NZD Checkout, Stripe-hosted UI and card-only test payments.
- Child without assigned adult seat: 3h NZ$30 / 6h NZ$60; child with adult-priced table seat pays only the table-seat price. Actual guardian recorded.
- Promotions: validated against admin-configured booking_promotions. Supports percent_off, per-ticket amount_off and fixed_price, for all/adult/child/selected ticket types, with limits, time windows and caps. TEST12 explicitly excluded. **Sandbox redemptions do not increment the real times_used counter; cancelled sandbox orders no longer count against sandbox usage limits.**
- Real booking feature flag remains OFF. Even a *paid* Stripe sandbox Checkout ends at bookings.status='test_confirmed', **not** 'confirmed'; does not emit confirmation email or permit staff check-in. The result page always says it is not a valid ticket.
- Seats are held in separate booking_test_checkouts, state 'creating' or 'open'. Concurrent holds and confirmed/test-confirmed reservations on the same seat are prohibited by database advisory-lock checks. Holds are not released merely because a local timer passed; a verified Stripe expiration or a 90-minute unbound-session recovery is required.

## Preflight SQL: read only

Run in **Yumorilnik** SQL Editor before applying the migration:

\`\`\`sql
select e.id,e.seating_mode,e.table_booking_mode
from public.events e
where e.id='3f6fa4d1-aaca-4326-9c01-5774cffca2f5';

select column_name,data_type,udt_name
from information_schema.columns
where table_schema='public' and table_name='booking_promotions'
 and column_name in ('code','enabled','discount_type','percent_off','amount_cents',
 'event_id','max_uses','times_used','applies_to','ticket_type_ids',
 'starts_at','ends_at','min_tickets','max_discount_cents')
order by column_name;

select to_regprocedure(
 'yumorilnik_internal.submit_family_booking_impl(uuid,uuid,jsonb,jsonb,jsonb)'
) is not null as family_booking_function_ready;
\`\`\`

Expected: NYE event has seating_mode='tables', table_booking_mode='individual_seats'. All promotion columns should exist, ticket_type_ids should be uuid[]. If differences, **do not apply the migration until reviewed**.

## Database changes NOT YET APPLIED

One migration: \`supabase/migrations/20261028_stripe_sandbox_checkout.sql\`.

Creates:
- booking_test_checkouts (private, RLS, no anonymous grants)
- public.prepare_test_checkout (server secret role only)
- public.bind_test_checkout_session (server secret role only)
- public.complete_test_checkout_session (server secret role only)
- public.expire_test_checkout_session (server secret role only)
- public.abandon_unbound_test_checkout (server secret role only)
- internal seat & ticket availability guard
- bookings.status='test_confirmed' (never a live ticket)
- admin cancellation guard against cancelling active Stripe holds

Price is always recalculated from existing Yumorilnik ticket and table rows on the server; no customer-submitted amount is used. The database cross-checks summed assigned-seat and childcare prices against the canonical total and rejects non-NZD ticket currencies. A 100% discount skips Stripe but still creates only a sandbox record.

Suggested post-apply read-only SQL:
\`\`\`sql
select
 to_regclass('public.booking_test_checkouts') is not null as holds_table_ready,
 to_regprocedure('public.prepare_test_checkout(uuid,uuid,jsonb,jsonb,jsonb,text)') is not null as prepare_ready,
 to_regprocedure('public.bind_test_checkout_session(uuid,text,timestamptz)') is not null as bind_ready,
 to_regprocedure('public.complete_test_checkout_session(uuid,text,text,bigint,text)') is not null as completion_ready,
 to_regprocedure('public.expire_test_checkout_session(uuid,text)') is not null as expiry_ready,
 to_regprocedure('public.abandon_unbound_test_checkout(uuid)') is not null as recovery_ready,
 (select enabled from public.booking_promotions where code='TEST12') as test12_enabled;
\`\`\`
Expected six true, final false.

## Environment variables

Add to Vercel ONLY after obtaining a dedicated Yumorilnik Stripe sandbox:

- \`STRIPE_TEST_SECRET_KEY\`: sk_test_... for the Yumorilnik test account; never NEXT_PUBLIC.
- \`STRIPE_TEST_ACCOUNT_ID\`: exact account ID acct_... of the separate Yumorilnik Stripe account. Matroshka account ID is forbidden.
- \`STRIPE_TEST_WEBHOOK_SECRET\`: whsec_... from the destination below.
- \`STRIPE_TEST_ALLOWED_EMAILS\`: comma-separated tester emails, not publicly exposed.
- \`STRIPE_TEST_ACCESS_CODE\`: a private, random 16+ character test gate, provided manually to authorised testers, never NEXT_PUBLIC.
- \`STRIPE_TEST_RECONCILE_SECRET\`: random internal operator token for hold reconciliation.
- \`STRIPE_TEST_CHECKOUT_ENABLED\`: "true" for server sandbox checkout, only when everything is ready.
- \`NEXT_PUBLIC_STRIPE_TEST_CHECKOUT_ENABLED\`: "true" to show sandbox checkout CTA after setup.
- \`SUPABASE_URL\` and \`SUPABASE_SECRET_KEY\`: must point to Yumorilnik, server only.
- \`NEXT_PUBLIC_SUPABASE_URL\`, \`NEXT_PUBLIC_SUPABASE_ANON_KEY\`: runtime for site navigation, public publishable key only.
- Keep \`NEXT_PUBLIC_REAL_BOOKINGS_ENABLED=false\` and \`BOOKING_EMAILS_ENABLED=false\` until a **separate production launch decision**.

On 28 October, Vercel preview deployments failed to collect booking-page data because NEXT_PUBLIC_SUPABASE_URL was absent from preview. Its variables were configured for production only. Do not copy secret production keys to an unprotected preview accidentally. Configure an appropriately protected preview environment for Yumorilnik before trying the sandbox checkout.

## Stripe dashboard setup

In the dedicated Yumorilnik test account, create a webhook event destination:
\`https://<the intended protected Yumorilnik origin>/api/stripe/test/webhook\`

Subscribe to:
- checkout.session.completed
- checkout.session.expired
- checkout.session.async_payment_succeeded

The handler verifies the **raw Stripe-Signature** (five-minute tolerance), re-fetches the session from Stripe, validates payment_status, event ID, booking ID, test-mode account and server-calculated amount. It alone transitions a paid booking to test_confirmed.

Checkout starts at \`POST /api/checkout/test\`; the server requires an allowlisted tester email plus a private access code. It verifies exact Stripe account and Yumorilnik Supabase project before creating a hold. Stripe test sessions expire in ~31 minutes, with recovery controls.

Return pages:
- \`/booking/test/complete\` with Stripe's \`session_id\` query argument — status is fetched server side; no real ticket issued
- \`/booking/test/cancelled\` — a cancellation does not falsely release a still-payable session

Operational reconciliation: protected \`POST /api/checkout/test/reconcile\` with header
\`Authorization: Bearer <STRIPE_TEST_RECONCILE_SECRET>\`.
Reconciles up to 30 expired-age open/creating holds in one call, consulting Stripe first; responds with counts. Set up a platform scheduled invocation when the sandbox is enabled, after explicitly approving that deployment. It is not currently scheduled.

## Application files

- \`lib/stripeTestCheckout.ts\`: test account guard, environment validation, Stripe REST client, signature verification.
- \`app/api/checkout/test/route.ts\`: origin, allowlist, access-code gating, canonical booking & seat hold, Stripe session creation and binding.
- \`app/api/stripe/test/webhook/route.ts\`: signed, verified payment/expiry transitions.
- \`app/api/checkout/test/status/route.ts\`: read-only payment-status lookup; no PII.
- \`app/api/checkout/test/reconcile/route.ts\`: protected provider-verified cleanup.
- \`app/booking/test/complete/page.tsx\`, \`app/booking/test/cancelled/page.tsx\`, \`components/TestCheckoutResult.tsx\`: bilingual, explicit sandbox results.
- \`components/BookingExperience.tsx\`: Stripe test CTA after guest details / adult seats / promo, sandbox access code, no automatic marketing opt-in.
- \`app/admin/bookings/page.tsx\`: visibly labels test_confirmed as not a real ticket.
- \`app/admin/promotions/page.tsx\`: tells Marina discount redemption remains sandbox-only.
- \`app/api/internal/send-booking-confirmations/route.ts\`: now allows future paid *confirmed* bookings but continues to ignore test_confirmed.

## Manual review before any rollout

1. Inspect correct Supabase project and voucher schemas with the read-only preflight above.
2. Review security grants: public functions callable only by service_role; anon/authenticated cannot call sandbox payment RPCs.
3. Review seat and ticket capacity: different testers cannot hold/pay the same table seat; an expired Stripe session can release it; test paid tickets never become real tickets.
4. Review 1 adult + child with adult-priced seat (no childcare fee), 3h child (NZ$30), 6h child (NZ$60), and mixed party.
5. Review valid/expired/disabled/overused promotion, full discount without Stripe, non-applicable code.
6. Review payment success, redirect without webhook, duplicate webhook, expired session, missing webhook, and inconsistent paid session.
7. Confirm secrets are absent from NEXT_PUBLIC variables and Matroshka account cannot be used.
8. Confirm real payment/booking/email flags remain OFF.
9. Review Vercel preview environment (currently missing NEXT_PUBLIC_SUPABASE_URL) and manually inspect the UI.
10. Do NOT run automated test suites, lint, builds or CI as part of this project; request user's separate approval before a launch.

## Explicitly out of scope

- Actual card charges and production Stripe account activation.
- Paid refunds and live-payment cancellation workflows.
- Generating real event tickets or QR codes from a sandbox payment.
- Automatic customer emails for sandbox payments.
- Attendee account history, rate-limiting beyond protected sandbox gates, or production-grade telemetry.
- Activation of public guest checkout and paid tickets.

A separate audited production-paid-booking migration and payment policy are required before a live launch.
