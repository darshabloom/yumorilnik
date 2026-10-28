# New Year's Eve family booking + staff access — implementation handover
Updated: 28 October 2026. Scope: Yumorilnik New Year's Eve only.

## Confirmed decisions

- Customers see an optional Google sign-in first, with a prominent **Continue as guest** alternative.
- An adult-priced ticket may represent a child occupying an assigned numbered table place. Mark this in the guest form. **Charge only the table's price**; any babysitting for that child is arranged at the event and not charged online.
- For ordinary child admission tickets, choose **3 hours at NZ$30** or **6 hours at NZ$60**, replacing the old NZ$30 flat child admission. Record each child's chosen duration and accompanying adult.
- Customers with ordinary child admission do not choose table seats; spare seating is available.
- Door staff log in separately using Google, with check-in-only permissions granted by an event administrator.
- All customer-facing strings added are available in English and Russian.

## Changes in source

- `components/BookingExperience.tsx`: Google/guest choice; childcare selector; adult-priced child marker; guardian; totals and review.
- `lib/bookingRules.ts`: guardian and per-child-duration validation.
- `lib/bookingSubmission.ts`: child and guardian metadata, and server-safe submission (client never supplies booking prices).
- `lib/newYearsBooking.ts`: single-event launch ID and childcare amounts.
- `app/admin/bookings/page.tsx`: child/guardian and childcare details, staged fallback before migrations.
- `app/admin/events/[id]/tickets/page.tsx`: explanation of childcare pricing to Marina.
- `app/staff/login/page.tsx`: staff Google login.
- `app/staff/check-in/page.tsx`: event-specific confirmed guest list, search by name/reference, check in/undo.
- `app/admin/check-in-staff/page.tsx`: admin grant/revoke event-scoped staff access by existing Google-account email.
- `components/SiteHeader.tsx` and `app/admin/page.tsx`: direct links to staff login, check-in and staff permissions.
- `app/api/internal/send-booking-confirmations/route.ts`, `lib/bookingConfirmationEmail.ts`: include child details while delivering email once per actual adult guardian.

## Yumorilnik-only migrations — NOT yet applied

The connected Supabase tool changed to a project named `matryoshka-nz`, so **no SQL was executed**. Do not use any unrelated project.

Apply only to the Yumorilnik project `vzzabkviwyarrdkevqco`, in this order:

1. `supabase/migrations/20261028_family_booking_metadata.sql` — add metadata and price adjustments to the existing booking RPC.
2. `supabase/migrations/20261028_test12_family_adapter.sql` — make future TEST12 free bookings preserve family metadata and enforce code limits. **TEST12 stays disabled.**
3. `supabase/migrations/20261028_family_confirmation_recipients.sql` — queue email only for true adult guardians.
4. `supabase/migrations/20261028_event_staff_checkin.sql` — staff access grants and limited RPCs.

Do not set `NEXT_PUBLIC_REAL_BOOKINGS_ENABLED=true`, `BOOKING_EMAILS_ENABLED=true`, or enable promotional codes until the database, payment confirmation and email-sending flow are ready.

## Staff invitation sequence

1. Staff member opens `/staff/login` and signs in once through Google.
2. Marina opens `/admin/check-in-staff`, selects the event and enters the same email.
3. Marina grants access. The account gets event-specific check-in access but **not** booking-admin, payment or personal-contact access.
4. Staff member opens `/staff/check-in`, searches a booking and marks each confirmed guest arrived.
5. Marina can revoke access from the same admin page.

## Manual user-journey scenarios (user will do testing)

- Guest vs Google login before buying tickets; Google does not become mandatory.
- One adult + one child with an adult-priced seat (guardian required): only two adult table-place prices, no childcare charge for the seated child.
- One adult + one ordinary child selecting 3h: table seat + NZ$30.
- Same selecting 6h: table seat + NZ$60.
- Mixed booking with adult, adult-priced child, 3h child and 6h child.
- Changing ticket quantities resets guest and seating assignments.
- Child with no actual adult guardian cannot proceed.
- Marina sees who is a child, who sits where and 3h/6h data.
- Staff sees confirmed-only guest information without contact information, payments or admin settings.
- Check-in, undo, and removal of event staff access.
- Eventually verify real paid transactions, seat conflicts, cancellation and Resend mail only after payment connection. **Not implemented or tested in this change.**

## Limitations

- Stripe Checkout, payment webhooks and actual paid reservations remain unfinished.
- The older TEST12-only API remains gated and TEST12 is not active.
- Customer Google sign-in is optional convenience. Full customer order history is separate work.
- These migrations require direct Yumorilnik project access, currently not available through the connected Supabase account.
- No automated tests, lint, builds or CI checks were intentionally run, in accordance with the user's instructions.
