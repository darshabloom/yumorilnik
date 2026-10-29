# Staff Home Screen setup (iPhone)

This guide applies to the event-staff check-in tool and Marina's existing owner account.

## Why Google may fail from a Home Screen icon

Safari's installed Home Screen web apps can have separate storage from Safari.
The Supabase browser client keeps sessions in localStorage; Safari does not copy
that storage to the installed app. Google's OAuth redirects may complete in a
different browser context. The result can be "Auth session missing!" or
repeated login prompts.

## Staff setup

1. Marina grants staff access to the event from /admin/check-in-staff.
2. Staff open https://www.yumorilnik.com/staff/login in **Safari** and
   sign in using the Google account Marina authorised.
3. Staff go to /staff/check-in and select **Staff app access**.
4. Staff set a personal Yumorilnik password (at least 12 characters).
   This attaches email/password sign-in to the same Supabase account; it does
   not create a new role or change any event permissions.
5. In Safari, open https://www.yumorilnik.com/staff/check-in. Tap
   **Share → Add to Home Screen**.
6. Open the new icon. In the installed app, sign in using the same Google
   email address and the personal Yumorilnik password. This app keeps its own
   Supabase session in its own storage and will normally stay signed in.
7. Tap **Scan QR with camera**, grant camera access, and scan a valid ticket.

The Google button is intentionally hidden from the standalone app. Google
sign-in continues to work in Safari for initial account access.

## Security

- Each member of staff has a **separate** account and password.
- Never give staff a shared Marina password or a shared check-in PIN.
- The database and ticket API enforce staff event permissions on every request.
- Session persistence is subject to Supabase session rules, revocation, and
  device/browser storage clearing; perpetual login is not guaranteed.
- Use a phone screen lock. Revoke staff access after an event.
- Adding this Home Screen app does not add offline check-in: scanning needs
  a connection to validate tickets and record arrivals.

## Verification checklist

- Test first in normal Safari using a test staff account with event access.
- Confirm a Google-authenticated staff member can set an app password.
- Confirm password sign-in works for that *same* user in a separate browser
  (and does not create a duplicate account).
- Add to Home Screen and confirm an independent email/password sign-in works.
- Close and reopen the icon, then restart the phone and verify the session is
  restored without asking for credentials.
- Test camera permission and scan a valid ticket once, then scan it again:
  the second scan must be rejected.
- Test an account without assigned staff access: it must not see guest data.
- Confirm Marina retains admin dashboard links from check-in.
- Test both yumorilnik.com and www.yumorilnik.com redirects on a real iPhone.

Note: a Vercel build confirms code validity, not iOS Safari OAuth behaviour.
