# Phase B — real booking and Stripe checkout (29 October 2026)

## Confirmed evidence
- Production domain yumorilnik.com works; signed ticket PDF generates with Cyrillic and QR.
- iPhone staff camera scanner opened successfully; first- and second-scan admission outcomes are **not yet verified**.
- Production Vercel has Supabase server credentials and ticket signing secret.
- Production Vercel is **missing** STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET.
- Production NEXT_PUBLIC_REAL_BOOKINGS_ENABLED=false and BOOKING_EMAILS_ENABLED=false.
- Existing app/api/checkout/test/route.ts explicitly uses testServices, Stripe test key, test access restrictions, cs_test sessions and prepare_test_checkout RPC; **not suitable for live money**.
- Existing booking client falls back to submit_test12_booking when not sandbox, **not an implemented live Stripe payment flow**.
- Explicitly authorised organiser admission test YMR-QRTEST-8E03583489 is confirmed with table C seat 2; its payment was not taken and it must be cancelled/released after testing.

## Hard launch gates
- [ ] Confirm correct separate Yumorilnik live Stripe account (account ID and ownership; do not mix with Matryoshka).
- [ ] Securely configure STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET for Vercel production. Never paste secrets into source/chat.
- [ ] Inspect existing DB checkout RPCs, temporary holds, payment and webhook tables, privileges and policies (Yumorilnik Supabase is not accessible through current connector).
- [ ] Implement separate /api/checkout/live, fail-closed when live secrets/flag absent; strictly server-side quote and seat reservation; idempotency keys; no price from browser.
- [ ] Validate Stripe live checkout mode, account ID, currency NZD, DB binding of checkout session and expiry.
- [ ] Signed Stripe webhook with idempotent paid confirmation + strict session reference, amount, currency, status, event checks; seat hold fulfilment.
- [ ] Retry-safe email/PDF issuance and customer My Bookings; no valid QR for unpaid/expired bookings.
- [ ] Expiry/recovery and refund/cancellation release; no double seat assignment.
- [ ] E2E live low-value transaction, signed paid webhook, ticket delivery, first scan accepted, duplicate scan rejected, wrong-event code rejected, refund and reversal.
- [ ] Only then set NEXT_PUBLIC_REAL_BOOKINGS_ENABLED=true and BOOKING_EMAILS_ENABLED=true.

## Deferred feature
Marina's real-time labelled seating map with guest names and arrival states is explicitly post-launch; do not distract Phase B.

## Minimum read-only DB inventory query for SQL Editor
```sql
SELECT n.nspname AS schema_name, p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
  AND (p.proname ILIKE '%checkout%' OR p.proname ILIKE '%hold%' OR p.proname ILIKE '%payment%' OR p.proname ILIKE '%stripe%')
ORDER BY function_name;
SELECT table_name
FROM information_schema.tables
WHERE table_schema='public'
  AND (table_name ILIKE '%checkout%' OR table_name ILIKE '%payment%' OR table_name ILIKE '%hold%' OR table_name ILIKE '%stripe%')
ORDER BY table_name;
```
