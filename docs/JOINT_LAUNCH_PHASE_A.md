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

## Public-domain verification update — 29 Oct 2026
- [x] User independently confirmed yumorilnik.com now opens publicly in incognito after Vercel SSO protection changed to all_except_custom_domains.
- [x] matryoshka.nz DNS now resolves to 76.76.21.21; Vercel reports misconfigured=false and project domain verified=true.
- [x] www.matryoshka.nz CNAME resolves to cname.vercel-dns.com; Vercel reports misconfigured=false and project domain verified=true. Vercel has a 308 redirect to matryoshka.nz.
- [ ] Verify Matryoshka public site loads over HTTPS from an unauthenticated browser and displays the intended release.
- [ ] Generate and inspect PDF with Cyrillic names via organiser-only endpoint.

## Production release update — 29 October 2026
- [x] Matryoshka redesigned/event-menu branch `27415840b306b2442c2eaa87a51c1722599628b1` successfully deployed to production as `dpl_1BGeFAcxqsectbsTdJDKsueW3Uam`; `matryoshka.nz` and `www.matryoshka.nz` assigned and Vercel READY.
- [ ] User to verify redesigned homepage in an incognito browser.
- [ ] Yumorilnik Cyrillic PDF download runtime check still outstanding.
- [ ] Phase B: audit live payment implementation before setting `NEXT_PUBLIC_REAL_BOOKINGS_ENABLED=true`; existing client `submit_test12_booking` RPC does not establish a production Stripe checkout flow.
- [ ] Matryoshka production Stripe variables and cross-site order linking are not ready; do not enable food checkout.

## Customer browser verification
- [x] User supplied incognito screenshot on 29 October 2026 confirming matryoshka.nz loads the approved redesigned homepage over HTTPS with no Vercel login or certificate warning.
- [ ] Runtime PDF Cyrillic check remains a Phase A release gate.

## Deferred enhancement — live check-in seating map (Marina request, 29 October 2026)
- [ ] **Post-launch / later:** Add an organiser-facing live seating plan showing each occupied/assigned seat, guest names beside seats, and arrival/check-in status updating as staff scan admission QR codes.
- Should reflect real confirmed bookings, not sandbox guests; support table/seat layout, checked-in vs not-yet-arrived distinction, and refresh/realtime update from the existing staff check-in workflow.
- Access restricted to authorised organisers/staff with appropriate permissions; protect guest personal information.
- **Deferred by user explicitly:** Do not implement now; prioritise launch-critical Phase B checkout/payment and admission verification.
- [x] User confirmed the new iPhone QR camera scanner opens and works (29 October 2026). Full first-check-in/duplicate rejection outcome not yet independently confirmed.
