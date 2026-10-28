# Ticket PDF + confirmation email release checklist

Status: **staged in GitHub, not deployed**. Do not enable live bookings or automatic emails.

## Code completed
- Signed per-guest admission credential and staff-only check-in validation.
- Organiser-only ticket previews and ticket PDF endpoint.
- PDF page per guest, QR generated only for real confirmed bookings.
- Organiser-only email preview can attach a PDF derived from a selected booking.
- Email includes event location and link to event details.
- Test email attachments are always marked invalid and have no admission QR.

## Known blockers before a deployment
1. GitHub Actions now generates a reconciled lockfile artifact. Download, review and commit the actual `package-lock.json`; it has not been committed yet.
2. Noto Sans Unicode embedding has been added via a build-time font download and `@pdf-lib/fontkit`; confirm the downloaded asset is included in both serverless functions and that a rendered Cyrillic sample is legible.
3. Run `npm ci && npm run build`, plus PDF generation regression tests.
4. Test organiser-only email PDF delivery in Resend with a sandbox booking.
5. Verify QR check-in with a real confirmed fixture, a duplicate scan, wrong-event code, forged code and forbidden role. Do not use sandbox bookings to issue admission codes.
6. Verify online customer ticket access with ownership checks (not yet implemented).
7. Implement real payment webhook-driven email sending with idempotency and retries (not yet implemented).
8. Implement secure cross-site Matryoshka ticket/order link (not yet implemented).

## Release acceptance
- Build succeeds with clean lockfile and no client bundle secrets.
- Real customer receipt contains correct event name, date/time, venue, event link, seats and valid attached PDF; Russian and English names render correctly.
- Staff scanning verifies and atomically checks in exactly the correct guest; duplicate scan blocked.
- Automatic emails remain OFF until paid-webhook integration and observed delivery pass tests.
- Matryoshka ordering remains marked unavailable until cross-site linking and order association are verified.

## Live safety switches
`NEXT_PUBLIC_REAL_BOOKINGS_ENABLED=false` and `BOOKING_EMAILS_ENABLED=false` in production. Confirm both before every deployment.

## Recent GitHub-only work
- Added `@pdf-lib/fontkit`, a Noto Sans font preparation script, and Next.js server file tracing for PDF functions.
- Organiser-only test confirmation emails attach a sample PDF without an admission QR credential.
- `.github/workflows/ticket-release-validation.yml` attempts a build and uploads the updated lockfile; does not deploy or push lockfile changes.
