# Yumorilnik booking requests — setup and safety

**Current scope:** Customers can **submit a booking request** after the bilingual guest and seating preview. Marina's authorised admins can **search, open, and cancel** requests in `/admin/bookings`. This phase does not issue tickets, reserve inventory, accept payment or support check-in.

## Price rules (confirmed 26 October 2026)

- One adult place is priced from the **table** chosen. All numbered places at a table share its **`seating_tables.seat_price_cents`** value. No individual chair has its own price and no adult admission surcharge is added.
- Marina edits this field in the seating builder as **“Adult price per place at this table”**. `table_price_cents` is separate: it prices buying the **whole table** instead.
- An adult ticket on a seated event has no separate upfront price. The customer sees the price after choosing a table/place. A child pays the child admission ticket and, only if a separate numbered place is chosen, the adult price for that table.
- A general-admission event does use admission ticket prices and does not request seats.
- The SQL RPC always recalculates costs from database ticket types and table prices; customers cannot submit prices in their payload. Missing prices are stored as a **pending quote (NULL)**, not incorrectly as zero.

## Database and configuration

1. Connect the **actual Yumorilnik Supabase project**. The currently connected Supabase account exposes **UniOS only**, which is unrelated. Never run this migration there.
2. Inspect production tables, auth configuration and existing RLS policies. Apply Yumorilnik's prerequisite migrations in the correct order where needed. Confirm the role membership in `admin_users` belongs to Marina's intended identity, without granting arbitrary accounts admin rights.
3. Review and run `supabase/migrations/20261026_booking_requests.sql` in **Yumorilnik's** SQL editor. It creates four RLS-protected tables and narrow RPCs. Check that the `public` Data API exposes the RPCs and allows the intended `EXECUTE` grants.
4. Verify the database with real test calls: valid parent/child booking, missing table price, duplicate seat within a request, wrong event, wrong ticket type, idempotency retry, anonymous SELECT/UPDATE denial, legitimate admin SELECT, anonymous cancellation denial and legitimate admin cancellation.
5. Configure the Yumorilnik-specific `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. **Never** put a secret/service-role key in a `NEXT_PUBLIC_` variable.
6. The booking button is **off by default**. Enable `NEXT_PUBLIC_BOOKING_REQUESTS_ENABLED=true` only after integration testing, an appropriate privacy notice/retention policy, and anti-spam/rate limiting have been implemented. Redeploy after changing the flag.
7. Test both English and Russian, mobile first, then ensure Marina can load `/admin/bookings` and cancel a sample request.

## Data model

- `bookings`: unique reference, event, status, price snapshot, submission key, cancellation audit.
- `booking_items`: ticket type and quantities, including price of admission (zero adult admission for seated events).
- `booking_guests`: named adults and children, adult contact details, parent relationships, stable guest UUIDs for **later check-in**.
- `booking_selections`: selected table and optionally numbered chair, linked to a named guest, snapshot of the table-level price at request time.

Security: anonymous customers **cannot read or directly write** personal booking tables. Only the narrowly scoped submission RPC accepts customer data. RLS allows registered owner/admin users to read booking details. Only an authenticated, authorised admin may cancel through a dedicated RPC; cancellation does not erase the audit record. No web-accessible secret key is used. Access control must be verified on the actual database before launching.

## Meaning of statuses and future work

`requested` = a received **unconfirmed request**. Selected seats are **not blocked from other requests** yet. `cancelled` = removed from Marina's active queue, retained for investigation and privacy/legal handling. There are no paid/confirmed/check-in statuses in this phase.

Before using this as a ticket-selling service, build and test concurrency-safe seat reservation, payment confirmation, ticket delivery and cancellation/refund handling. The next event-helper phase should use restricted staff identities and individual `booking_guests.id` records to prevent duplicate check-in, and should reject requests that are not confirmed. The nullable `checked_in_at` field is reserved for that future functionality; clients have no permission to update it now.

**Testing evidence:** GitHub CI verifies the front-end logic and (with mocks) customer submission. It does **not** prove that the SQL migration has run successfully or that genuine records can be saved in Yumorilnik Supabase. That must be tested against the correct project.

## Future-event invitations: separate and optional

The booking form has a **second, unticked checkbox** offering email invitations to future Yumorilnik and Marina events. Customers must explicitly opt in and identify which adult email should receive invitations. This has no effect on their booking request.

- Add marketing consent storage only after applying the first booking migration, using `supabase/migrations/20261026_marketing_optin.sql` in the **Yumorilnik** project (never UniOS).
- Each opted-in adult has one `marketing_contacts` record with email, name, explicit-consent timestamp, source booking and event, status and a cryptographically random unsubscribe token.
- If consent is not ticked, no marketing RPC is called. Other adults, children, non-consenting contacts and all existing customer data are **not** automatically copied into the marketing list.
- Anonymous visitors have no SELECT permission for contacts. Only owner/admin may view `/admin/contacts`, search, export the active consent list, or process an opt-out reported by phone or email. The CSV includes source consent details and each recipient's unique opt-out link.
- The public `/unsubscribe?token=...` page offers explicit one-click consent withdrawal, without account login; simply opening the link never changes a database record. A recorded opt-out is not silently reversed by future bookings.
- The optional opt-in is recorded separately **after** a successful saved booking request, not in a transaction with it. If saving consent fails, the booking is still received and the customer can retry the optional signup.
- **No marketing emails are sent by this implementation.** A future mailing solution must include the sender's correct identifying information, valid unsubscribe links or equivalent and opt-out processing; comply with the NZ Unsolicited Electronic Messages Act 2007 and Privacy Act 2020. Do not send invitations using `bookings` guest contacts: only `marketing_contacts` with `status='subscribed'`.
- Live activation remains behind `NEXT_PUBLIC_BOOKING_REQUESTS_ENABLED` and depends on a configured Yumorilnik Supabase project, anti-spam controls, privacy notice and real permission checks. Current CI verifies an isolated PostgreSQL database, *not* Yumorilnik production.
- Before launching real invitations, consider email-address verification/double opt-in to prevent subscribers adding an address they do not own, enforce retention/deletion handling, and select a permitted mail delivery provider.

The NZ Department of Internal Affairs guidance: https://www.dia.govt.nz/Spam-Three-Steps
