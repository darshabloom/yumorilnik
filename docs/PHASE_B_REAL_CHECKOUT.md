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

## 29 Oct Stripe account discovery and database next gate
- Stripe connector lists Yumorilnik sandbox `acct_1UVPo4AcPL3j1y7u` (test mode) and Matroshka sandbox `acct_1SXo5CPIwTIma6Ev` (test mode). **No live-mode Yumorilnik account is connected**. Do not use the Matroshka account for tickets.
- User's Yumorilnik SQL inventory confirms `seating_holds`, `payments`, `booking_test_checkouts` and RPCs `prepare_test_checkout`, `bind_test_checkout_session`, `complete_test_checkout_session`, `expire_test_checkout_session`, `abandon_unbound_test_checkout`.
- Before production SQL changes: retrieve column metadata, indexes, RLS, trigger definitions for the three tables and function definitions/privileges for these five RPCs. Current Supabase connector only accesses Matryoshka DB; user must run read-only SQL on Yumorilnik DB or grant separate connector access.
- Preserve `test_confirmed` as sandbox-only. Production paid state must come from signed live Stripe events and atomically validated payment/seat-hold database transaction.

## Database review from user-supplied SQL export (29 October)
- `booking_test_checkouts` has one row per `booking_id`, a UNIQUE `stripe_session_id`, state, price, currency, expiry, promotion and payment-intent fields. The sandbox's lifecycle methods acquire an event-level advisory transaction lock and update booking state accordingly.
- `prepare_test_checkout` calls `yumorilnik_internal.submit_family_booking_impl` to validate canonical ticket/guest/seat and price input, then `yumorilnik_internal.test_checkout_places_available`. The amount charged is recomputed on the server and supports real promo rules, but zero-priced **sandbox** orders become `test_confirmed`, not admission tickets.
- `complete_test_checkout_session` checks the bound session, amount and currency, then rechecks conflicting seats; it sets `needs_review` instead of issuing tickets if a conflict exists.
- `payments` and `seating_holds` use order_id/seat_id, NOT booking_id/seat_number. Their suitability for this event flow is unverified; DO NOT repurpose them based on names.
- **Security checkpoint**: all five public checkout RPCs are SECURITY DEFINER. Inspect EXECUTE grants and internal helper definitions before copying their design into live routines. Never expose privileged live completion functions to authenticated/anon/public clients.
- Production approach: separate `booking_live_checkouts` (booking_id, event_id, state, stripe_session_id, stripe_payment_intent_id, amount_cents, currency, expires_at, timestamps, review reason); secure server-only prepare/bind/complete/expire functions and explicit idempotent webhook event tracking. Shared seat availability must account for both active sandbox and live holds, confirmed bookings, and expiry consistently under the same event-level lock.
- Need further read-only discovery of `yumorilnik_internal.submit_family_booking_impl` and `yumorilnik_internal.test_checkout_places_available` plus grants and underlying constraints/triggers to avoid introducing double-booking.

## Internal function security + inventory observations (user SQL results)
- `yumorilnik_internal.submit_family_booking_impl` is SECURITY DEFINER and currently grants EXECUTE to `anon` and `authenticated` as well as postgres. The schema may be unexposed to Supabase Data API, but this is unnecessary privilege until callers and USAGE grants are verified. Do not revoke blindly without checking other DB functions; plan least-privilege permissions after dependency audit.
- `yumorilnik_internal.test_checkout_places_available` is SECURITY DEFINER, EXECUTE only postgres/service_role, and counts conflicting booking seats belonging to `confirmed`, `test_confirmed`, or test checkouts in `creating`/`open`, and ticket inventory against confirmed/test-confirmed and test holds.
- **Important:** the availability predicate does not consider future LIVE checkout holds at all. Live preparer and test preparer must use an updated shared availability predicate under the SAME per-event advisory transaction lock, or the two channels can sell the same seat.
- Existing requested rows outside active holds are not treated as reserved by this test helper; check normal booking RPC seat reservation separately.
- Existing test hold helper tests states rather than explicit expiry timestamps; inspect lifecycle and cleanup before reusing for live holds.
- Existing `test_confirmed` records reserve seats in the helper. Before launch, decide to expire/remove sandbox effects safely without destroying audit history.
- `submit_family_booking_impl` makes additional 3/6-hour childcare adjustment (NZ$30/60) after underlying `submit_booking_impl`. Never trust guest pricing supplied by client.
- Before writing/applying live DB functions, inspect `submit_booking_impl`, grants on internal schema + wrapper functions, and seat constraints/triggers to ensure all channels consistently reserve seats.

## Follow-up permission audit (29 October)
- User verified `has_schema_privilege(..., 'yumorilnik_internal','USAGE')` is TRUE for `anon`, `authenticated` and `service_role`; `CREATE` is FALSE for all three.
- As `submit_family_booking_impl` also has direct EXECUTE grants for `anon` and `authenticated`, the function is broadly callable at the database privilege layer; whether exposed via REST depends on exposed schemas and reachable wrapper functions. Review before changing privileges; do not blindly revoke functions used by active booking flows.
- Still waiting for body of `yumorilnik_internal.submit_booking_impl` to check pricing/seat reservation consistency before live migration.

## Base booking SQL inspected (user response, 29 October)
- `yumorilnik_internal.submit_booking_impl` serialises on `pg_advisory_xact_lock(hashtextextended(event_id::text,0))`; checks idempotency by `client_request_id`, valid event, tickets, guests, named seats and table prices.
- Base adult admission is zero for assigned seating and table/seat prices are added; child base comes from active ticket, then family wrapper applies the 3/6-hour childcare model. Thus seat prices must be server-authoritative.
- **Critical:** `submit_booking_impl` validates duplicate seats *within the new request* but does **not** check seats occupied by OTHER bookings. That protection currently comes from checkout-specific `test_checkout_places_available` after insertion. Live checkout must atomically call an updated cross-channel conflict predicate before making a charge and again on payment confirmation.
- The helper currently recognises `confirmed` and `test_confirmed` as occupied; active `booking_test_checkouts` in `creating/open`. Production should count active live holds, confirmed seats and sandbox holds consistently under the same event lock, with explicit expiry treatment.
- We have now received the full base booking function; no more base function dumps are needed. The next implementation deliverable is the staged live-checkout database migration and its API/webhook, then secure production Stripe configuration and paid end-to-end tests.

## Release progress from current run
- Matryoshka policy: public event menus; any attempt to place a food order now must validate a Yumorilnik ticket reference and matching email at checkout, regardless of optional per-event ticket_required flag; interface calls it Ticket Number, reserving Order Number for food purchases. Webhook/payment authorisation remains server-side.
- Yumorilnik booking client: when NEXT_PUBLIC_REAL_BOOKINGS_ENABLED=true it now calls /api/checkout/live rather than public submit_test12_booking. Dedicated live route currently responds 503 LIVE_CHECKOUT_NOT_READY (safe intentional guard), so no real money can be taken or admission ticket issued accidentally. Sandbox checkout remains separated.
- **Phase B is not closed**: production live hold/seat conflict migration, privileged RPC security, live Stripe credentials and account linkage, signed webhook, fulfilment and refund, and real paid transaction tests are outstanding.
- Before accepting live bookings, reconcile NYE start time 19:00 in description vs 20:00 event record, and verify ticket/seat totals as shown to customers.

## Phase B continued implementation (29 Oct)
- Added `lib/stripeLiveCheckout.ts` with strict `sk_live_` credentials, Yumorilnik Supabase ref, separate live `acct_` verification (reject both known sandbox accounts), and Stripe session paid metadata/amount/mode checks.
- Replaced `/api/checkout/live` placeholder with server-driven `prepare_live_checkout` → Stripe Checkout → `bind_live_checkout_session` flow (validates origin, quote/amount, session id, expiry, returns only Stripe-hosted HTTPS URL). The endpoint remains OFF because STRIPE_LIVE_CHECKOUT_ENABLED is not set and required RPCs are not installed.
- Added `/api/stripe/live/webhook` with raw-body Stripe signature validation, server-fetched session, currency/metadata checks, `complete_live_checkout_session` and `expire_live_checkout_session` RPC hooks, and 500 retry on failures. Email fulfilment explicitly NOT claimed or enabled.
- Added bilingual conservative /booking/complete and /booking/cancelled customer return pages (no false paid confirmation).
- Staged `docs/PHASE_B_LIVE_SCHEMA_DRAFT.sql`; it is NOT an approved or applied migration and lacks RPCs/cross-channel availability predicates.
- Production Vercel deployment of gated code is READY, but no live charges or paid tickets have been tested.
- Hard activation blockers: secure live Stripe account access and keys, tested SQL RPCs with cross-channel seat safety, automatic email fulfilment, price/time reconciliation, paid and refund integration tests.
