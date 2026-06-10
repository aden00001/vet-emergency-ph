# Vet247PH — QA Checklist (MVP Launch)

## Search & Discovery
- [ ] Home page loads and shows clinics near Metro Manila default coords
- [ ] "Use my location" requests geolocation and refreshes results
- [ ] Manual lat/lng search returns updated results
- [ ] Emergency-only filter toggles correctly
- [ ] Triage modal appears on first visit; selection persists in sessionStorage
- [ ] Triage category changes clinic ranking order
- [ ] Results return in under 2 seconds (with Redis warm)

## Clinic Detail
- [ ] Clinic detail page shows name, address, phone, status, confidence
- [ ] Click-to-call opens dialer with normalized +63 number
- [ ] Google Maps and Waze links open correctly
- [ ] JSON-LD structured data present in page source
- [ ] Claim clinic flow works for signed-in users

## Emergency Pulse
- [ ] All 4 pulse buttons submit verifications (when signed in)
- [ ] Rate limit: second submission within 1 hour shows error
- [ ] Freshness labels display correctly (Fresh / Aging / Stale)
- [ ] Confidence score updates after verification

## Clinic Admin
- [ ] Magic link email sends and redirects to /admin
- [ ] Claimed clinic owner can update status (4 options)
- [ ] Owner can edit phone, address, hours
- [ ] Unclaimed users see "no clinics linked" message

## Security (RLS)
- [ ] Anonymous users cannot update clinics
- [ ] Anonymous users cannot insert owner verifications
- [ ] Users can only see their own claim requests

## Infrastructure
- [ ] Redis cache hit returns `cached: true` from API
- [ ] App works without Redis (graceful fallback)
- [ ] Edge Function `confidence-score-refresh` runs successfully
- [ ] Edge Function `stale-listing-detector` flags stale clinics
- [ ] Sitemap.xml includes static pages and clinic URLs
- [ ] /disclaimer, /about, /for-clinics pages render

## Mobile
- [ ] Test on mobile Safari and Chrome
- [ ] Tap targets are large enough for emergency use
- [ ] Layout is readable on 375px width

## Seed Data
- [ ] 50 clinics seeded across NCR
- [ ] 10+ owner_verified anchor clinics
- [ ] All clinics have emergency_capable = true
