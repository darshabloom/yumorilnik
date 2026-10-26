# Manual localhost booking walkthrough (fictional data only)

**This deliberately uses no real people, real tickets, payments, or production database.**

## Get the current changes

In your VS Code terminal at the Yumorilnik project folder:

```bash
git switch remake/2026
git pull origin remake/2026
npm run dev
```

Open your local event booking page, or the fixture at `http://localhost:3000/booking-test?scenario=zone`.

1. Choose two adults and two children. Enter **fictional** names and email addresses, and select the accompanying adult for each child.
2. If a field is missing or invalid, the form names the specific adult/child and tells you what to correct, then focuses that field.
3. Assign one named table seat to each **adult** using the map. Numbered circles are smaller and click targets must not overlap. Tap a table first to zoom closer if needed.
4. There is **no child-seat selection step**. The page explains that spare seating will be available for children. Child tickets retain the configured admission charge.
5. Review guests, adult seats and calculated total. If adults choose $105 table places and each child admission is $30, two adults plus two children totals **NZ$270**, not $375 (which included an extra child seat under the superseded rules).
6. Tick the fictional-test acknowledgement, choose **Save test booking**, and record the reference `YMR-DEMO-...`.
7. On the **same computer**, open `http://localhost:3000/admin/bookings` to see Marina's test-booking list. Search, open guest details and selected places, then optionally cancel or permanently delete the fictional request.

The local development API saves data to `.yumorilnik-local/bookings.json` (ignored by Git). Test records survive browser refreshes and local dev-server restarts. They are **not** in Supabase, do not reserve seats, do not enable check-in, and should never contain real personal information.

This local admin preview intentionally skips real admin login because it stores **fictional data on localhost only**. It is unavailable as a real customer booking system in production. A production Supabase connection and associated security, privacy and anti-abuse checks are still required for real requests.

**No automated tests, browser runs, lint or builds were executed for these changes, per the user's explicit instruction.**
