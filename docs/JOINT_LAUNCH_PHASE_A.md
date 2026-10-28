# PHASE A: cross-site launch verification — 29 Oct 2026 (NZ)

Status: **PARTIALLY COMPLETE — do not enable public sales**.

## Verified in Vercel
- [x] Yumorilnik preview build READY: dpl_4D2oLD8hfF2wPuFhEFdD1zyp5yCs. Build logs show Unicode ticket font downloaded successfully.
- [x] Matryoshka latest preview build READY: dpl_7KnDnW2kwsYftp899eGXivRaSQos (commit 27415840b306b2442c2eaa87a51c1722599628b1). Earlier EventMenuManager useState build failure no longer blocks this preview.
- [x] Supabase and Vercel production environment key inventory reviewed, without revealing secrets.
- [x] Yumorilnik custom domains www.yumorilnik.com and yumorilnik.com attached.
- [x] Matryoshka Vercel default domains identified.
- [x] Yumorilnik CI workflow updated to reconcile and commit PDF dependency lockfile automatically on branch pushes.

## Phase A remaining release gates
- [x] CI updated package-lock.json with pdf-lib, qrcode, @pdf-lib/fontkit, and @types/qrcode; root dependencies verified after commit.
- [ ] Render and inspect an actual ticket PDF with a Russian name. Build success and font download are not equivalent to PDF render success.
- [ ] Confirm no accidental exposure of guest data in PDF routes, and verify customer access separately.
- [ ] **Public site accessibility:** Yumorilnik Vercel SSO protection currently has deploymentType=all. Do not open sales until a public unauthenticated visit on custom domain succeeds.
- [ ] **Matryoshka domain:** Vercel only lists matryoshka-nz.vercel.app and project preview aliases; confirm intended public domain, attach and verify DNS/SSL if a custom domain is desired.
- [ ] **Matryoshka production payment configuration:** production does not list STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET or CHECKOUT_ENABLED, unlike preview. Configure intentionally in Phase D; do not enable public paid food ordering without it.
- [ ] **Yumorilnik production payment configuration:** NEXT_PUBLIC_REAL_BOOKINGS_ENABLED and BOOKING_EMAILS_ENABLED are disabled; keep disabled until Phase B/C payment and email validation.

## User action required
1. No Supabase SQL is needed merely to confirm builds.
2. Before enabling public traffic, decide the intended public Matryoshka domain and check Yumorilnik's unauthenticated accessibility. The assistant can propose a Vercel protection change, but should not silently expose an unfinished sales flow.
3. After UI/API preview tests, owner must confirm event data, menu, fulfilment and legal/payment details.
