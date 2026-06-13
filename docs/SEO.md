# SEO implementation log — Vet247PH

This document records SEO-related work on **vet247ph.online**: what was built, where it lives in the codebase, and how to verify or extend it.

Last updated: 14 June 2026

---

## Summary

The site went from a client-only search app (little crawlable content) to a **hub-and-spoke directory** with:

- Server-rendered clinic links on the homepage
- City/province **area landing pages**
- **Help / FAQ** content for emergency intent queries
- **Human-readable clinic URLs** (`/clinics/{slug}`)
- Structured data, sitemap, and social preview improvements

---

## Completed actions

### 1. Crawlable homepage

| Action | Details |
|--------|---------|
| Split homepage into server + client | [src/app/page.tsx](../src/app/page.tsx) SSR shell; [src/components/home-search.tsx](../src/components/home-search.tsx) for interactive search |
| Default SSR clinic list | Manila preset — emergency clinics rendered as HTML links before JS runs |
| ItemList JSON-LD | Homepage emits crawlable clinic list structure |
| Area browse block | Links to top areas + “Browse all areas” |

### 2. Local SEO — area pages

| Action | Details |
|--------|---------|
| Area index | [src/app/areas/page.tsx](../src/app/areas/page.tsx) — all cities/provinces with clinic counts |
| Area detail pages | [src/app/areas/[areaId]/page.tsx](../src/app/areas/[areaId]/page.tsx) — e.g. `/areas/ncr-manila` |
| Shared area logic | [src/lib/clinic-areas.ts](../src/lib/clinic-areas.ts) — counts, detail listings, and API |
| Area IDs | Format `ncr-{city}` or `ph-{province}` (hyphens, no colons — Windows-safe) |
| Area resolution | [src/lib/ph-regions.ts](../src/lib/ph-regions.ts) — `resolveClinicArea(address)` maps **locality segments** (city/province comma-parts) to area buckets; not full-address substring search |
| Schema | `ItemList` + `BreadcrumbList` JSON-LD per area page |
| ISR | `revalidate: 3600` on area routes |
| Sitemap | All area URLs included in [src/app/sitemap.ts](../src/app/sitemap.ts) |

#### Area index vs detail — data consistency (June 2026 fix)

**Problem:** The area index showed emergency counts (e.g. Manila: 13 emergency) but the detail page listed zero clinics. Crawlers and users saw contradictory signals on the same URL family.

**Root cause:** Index counts used `buildAreas()` over all clinic rows filtered by `resolveClinicArea(address)`. Detail pages used `nearby_emergency_clinics` RPC (50 km radius, **LIMIT 50**), then filtered those 50 results by area. Dense areas like Manila could have every in-area clinic excluded before the address filter ran.

**Fix:** `fetchClinicsForArea()` now:

1. Paginates all clinics from Supabase (same source as index counts)
2. Filters by `resolveClinicArea(address) === areaId` **first**
3. Maps rows to `NearbyClinic` shape (distance from area centroid, status, rank score)
4. Sorts with `sortClinics(..., "recommended")` and applies the page limit (50)

Index counts and detail listings now share the same area-matching logic. Geo search RPC remains for homepage / nearby API only.

**Verify after deploy:**

- `/areas` count for an area matches `/areas/{areaId}` listing length (up to the 50-clinic cap)
- `ItemList` JSON-LD `numberOfItems` matches visible clinic cards on the detail page

#### City-level matching — Manila false positives (June 2026 fix)

**Problem:** `/areas/ncr-manila` included clinics outside the City of Manila because `resolveClinicArea()` used `address.includes("manila")` on the full string. That matched road names (`Manila S Rd`, `Manila East Road`), districts (`New Manila`, `Eastern Manila District`), and the substring inside `Metro Manila`.

**Fix:** `resolveClinicArea()` now:

1. Splits the address into comma-separated segments
2. Matches only on **locality segments** (typically city/province near the end — not street lines)
3. Applies stricter rules for **Manila** (reject roads/districts; accept a `Manila` locality segment or known Manila districts like Tondo when `Metro Manila` is present)
4. Rejects single-word city matches inside street names (e.g. `Makati Ave` does not bucket to Makati)

#### Area matching — other locations (June 2026)

Audited all areas against `data/clinics-merged.json` and tightened rules beyond Manila:

| Issue | Fix |
|-------|-----|
| `San Juan, Batangas` → NCR San Juan | NCR San Juan requires `Metro Manila` or `San Juan City` segment |
| `San Juan Evangelista St` → NCR San Juan | Multi-word cities require exact locality segments (not substring) |
| `Malabon, Metro Manila` → generic Metro Manila | Two-part addresses now keep both city + region segments |
| `Pasay City` / `Cagayan De Oro City` not matching | Accept `{city} city` and postal-prefixed segments (`2514 La Union`) |
| `Cagayan Valley Rd` / `…, Cagayan Valley` → Cagayan province | Block `cagayan valley` region strings; provinces match trailing locality segments only |
| `Aurora` barangay in Tuguegarao → Aurora province | Province matching limited to last 1–2 non-Metro locality segments |

Area cache bumped to `clinics:areas:v5` after these changes.

**Remaining edge cases:** A few listings have bad source addresses (e.g. `Cainta, Metro Manila` with no `Rizal`) and still fall into generic **Metro Manila** until the address data is corrected.

### 3. Help & FAQ content

| Action | Details |
|--------|---------|
| Help index | [src/app/help/page.tsx](../src/app/help/page.tsx) |
| Topic pages | [src/app/help/[slug]/page.tsx](../src/app/help/[slug]/page.tsx) — trauma, poisoning, breathing difficulty |
| Content source | [src/lib/help-content.ts](../src/lib/help-content.ts) |
| Schema | `FAQPage` JSON-LD on help pages |
| Static generation | Help slugs pre-rendered at build time |

### 4. Internal linking

| Action | Details |
|--------|---------|
| Header nav | Areas · Help · About — [src/components/site-header.tsx](../src/components/site-header.tsx) |
| Footer | Popular area links + Help — [src/components/site-footer.tsx](../src/components/site-footer.tsx) |
| Related clinics | Same-area links on clinic detail — [src/components/related-area-clinics.tsx](../src/components/related-area-clinics.tsx) |
| Clinic breadcrumbs | JSON-LD: Home → Area → Clinic (when area resolves) |

### 5. Clinic slug URLs

| Action | Details |
|--------|---------|
| Database column | `clinics.slug` — migration [supabase/migrations/20250614000001_clinic_slugs.sql](../supabase/migrations/20250614000001_clinic_slugs.sql) |
| RPC update | `nearby_emergency_clinics` returns `slug` |
| Route | [src/app/clinics/[slug]/page.tsx](../src/app/clinics/[slug]/page.tsx) |
| UUID → slug redirect | Permanent 308 when old UUID URLs are visited |
| Slug generation | [src/lib/clinic-slug.ts](../src/lib/clinic-slug.ts) — `{name}-{area}`, deduped with `-2`, `-3` |
| Backfill | `npm run backfill:clinic-slugs` — **2,412 slugs** applied to production |
| Import script | New clinics get slugs on insert — [scripts/import-clinics.mjs](../scripts/import-clinics.mjs) |
| All links updated | Cards, homepage, areas, sitemap use `clinicPath()` |

Example URL: `/clinics/pampanga-animal-hospital`

### 6. Technical SEO & metadata

| Action | Details |
|--------|---------|
| Central SEO helpers | [src/lib/seo.ts](../src/lib/seo.ts) — `pageMetadata`, `canonicalUrl`, JSON-LD builders, OG helpers |
| Default OG image | Root [src/app/opengraph-image.tsx](../src/app/opengraph-image.tsx) + fallback in metadata |
| Per-clinic OG | [src/app/clinics/[slug]/opengraph-image.tsx](../src/app/clinics/[slug]/opengraph-image.tsx) — branded dynamic preview |
| OG strategy | Metadata uses self-hosted `/clinics/{slug}/opengraph-image` (Google image URLs often block social crawlers) |
| Custom 404 | [src/app/not-found.tsx](../src/app/not-found.tsx) — `noindex`, links to search / areas / help |
| For-clinics page | [src/app/for-clinics/page.tsx](../src/app/for-clinics/page.tsx) — listing corrections (replaced bare redirect) |
| Sitemap | Static + area + help + clinic URLs; logs failures instead of silent shrink |
| Robots | [src/app/robots.ts](../src/app/robots.ts) — blocks `/admin/`, `/api/`, `/auth/` |
| API noindex | `X-Robots-Tag: noindex` on JSON API responses |
| www redirect | [next.config.ts](../next.config.ts) — `www.vet247ph.online` → apex (308) |
| Clinic ISR | Top **100** emergency clinics pre-rendered via `generateStaticParams` |
| Locale | `lang="en-PH"` on root layout |

### 7. Structured data (JSON-LD)

| Page | Schema types |
|------|----------------|
| All pages | `Organization`, `WebSite` |
| Homepage | `ItemList` (default clinics) |
| Area pages | `ItemList`, `BreadcrumbList` |
| Clinic pages | `VeterinaryCare`, `LocalBusiness`, `EmergencyService`, `BreadcrumbList`, optional `AggregateRating` |
| Clinic hours | `openingHoursSpecification` — [src/lib/opening-hours.ts](../src/lib/opening-hours.ts) |
| Help pages | `FAQPage` |

### 8. Opening hours parsing

| Action | Details |
|--------|---------|
| Parser | [src/lib/opening-hours.ts](../src/lib/opening-hours.ts) |
| Input formats | Google-style (`Monday: 9 AM to 6 PM; …`), `Open 24 hours`, `Closed`, split lunch ranges (first range used) |
| Output | Schema.org `OpeningHoursSpecification` grouped by identical hours across days |
| 24/7 detection | Used on clinic OG image badge |

---

## Key files reference

```
src/
├── app/
│   ├── page.tsx                    # SSR homepage + ItemList
│   ├── sitemap.ts                  # All indexable URLs
│   ├── robots.ts
│   ├── not-found.tsx
│   ├── opengraph-image.tsx         # Site-wide OG
│   ├── areas/
│   │   ├── page.tsx
│   │   └── [areaId]/page.tsx
│   ├── help/
│   │   ├── page.tsx
│   │   └── [slug]/page.tsx
│   └── clinics/
│       └── [slug]/
│           ├── page.tsx
│           ├── layout.tsx
│           └── opengraph-image.tsx
├── lib/
│   ├── seo.ts                      # Metadata + JSON-LD helpers
│   ├── clinic-slug.ts              # Slug + clinicPath()
│   ├── clinic-areas.ts             # Area counts (index) + area clinic listings (detail)
│   ├── clinics.ts                  # fetchClinicBySlugOrId, fetchTopClinicSlugs
│   ├── opening-hours.ts            # Hours → schema.org
│   ├── help-content.ts
│   └── ph-regions.ts               # Area taxonomy
└── components/
    ├── home-search.tsx
    ├── site-header.tsx
    ├── site-footer.tsx
    └── related-area-clinics.tsx

supabase/migrations/
└── 20250614000001_clinic_slugs.sql

scripts/
├── backfill-clinic-slugs.mjs
└── clinic-slug.mjs
```

---

## Scripts & commands

```bash
# Backfill slugs for clinics missing them
npm run backfill:clinic-slugs

# Apply new migrations to remote Supabase
npx supabase db push

# Production build (validates routes, static params, OG routes)
npm run build

# Start locally and check:
#   /sitemap.xml
#   /robots.txt
#   /areas/ncr-manila          # count on /areas should match listings here
#   /help/trauma
#   /clinics/{slug}
#   /clinics/{slug}/opengraph-image
npm run start
```

---

## Verification checklist

After deploy or major SEO changes:

- [ ] **Homepage** — View source: clinic `<a href="/clinics/...">` links present without JS
- [ ] **Sitemap** — `https://vet247ph.online/sitemap.xml` includes `/`, `/areas`, `/help`, area pages, clinic slugs
- [ ] **Robots** — `https://vet247ph.online/robots.txt` points to sitemap
- [ ] **Slug URL** — `/clinics/{slug}` returns 200
- [ ] **UUID redirect** — `/clinics/{uuid}` returns 308 → slug URL
- [ ] **OG image** — `/clinics/{slug}/opengraph-image` returns PNG
- [ ] **JSON-LD** — Rich Results Test on a clinic and help page
- [ ] **Area consistency** — Pick a high-count area (e.g. `/areas/ncr-manila`): emergency count on `/areas` matches clinics rendered on the detail page (≤ 50 shown)
- [ ] **Area JSON-LD** — Detail page `ItemList` item count matches visible clinic cards
- [ ] **Search Console** — Submit sitemap at [Google Search Console](https://search.google.com/search-console)

---

## Environment notes

- Canonical URL: `NEXT_PUBLIC_APP_URL=https://vet247ph.online` (see [DEPLOY.md](../DEPLOY.md))
- Preview deploys on `.vercel.app` are excluded from canonical base in [src/lib/brand.ts](../src/lib/brand.ts)
- Area cache key: `clinics:areas:v5` (Redis, 24h TTL) — caches index **counts only**; detail listings are fetched fresh each request (ISR revalidates the page shell hourly)

---

## Not done (future opportunities)

These were intentionally deferred or are follow-up work:

| Item | Why deferred |
|------|----------------|
| Self-hosted clinic photos (Supabase Storage) | Larger image pipeline; OG now uses dynamic branded images |
| Individual `Review` schema entities | Only `AggregateRating` today |
| `WebSite` SearchAction (sitelinks search box) | Search is geo-based, not URL-query-based |
| Unique intro copy per area page | Template copy only today |
| More help articles | Only 3 emergency guides so far |
| Paginated area pages | Capped at 50 clinics per area; areas with more than 50 emergency clinics truncate without a “view all” page |
| Area detail review aggregates | Detail fetch sets `review_count: 0` / `average_rating: null` for sorting; cards omit stars until reviews are joined in this path |
| Pre-render all 2,400+ clinic pages | Top 100 by confidence only |

---

## Related docs

- [README.md](../README.md) — project overview
- [DEPLOY.md](../DEPLOY.md) — deployment and env vars
- [QA_CHECKLIST.md](../QA_CHECKLIST.md) — general QA
