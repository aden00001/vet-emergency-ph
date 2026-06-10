# Clinic data pipeline

How we collect vet clinic data for Vet247PH — and why we **don't** scrape Google Maps HTML.

## Recommended sources (in order)

| Source | Legal? | Phone / hours | Lat/lng | Best for |
|--------|--------|---------------|---------|----------|
| **OpenStreetMap (Overpass API)** | Yes, free | Sometimes | Yes | Bulk discovery in NCR |
| **Google Places API** | Yes, paid API | Often | Yes | Filling gaps (phones, addresses) |
| **Manual / Vet-Anchor outreach** | Yes | Best | Verified | `owner_verified`, emergency status |
| **Google Maps HTML scraping** | **No** (ToS) | — | — | **Do not use** |

Emergency capability is **rarely** in map data. Treat scraped `emergency_capable` as a **guess** until a human or clinic owner confirms.

## Google Maps CSV export (manual scrape)

If you exported a spreadsheet from a Google Maps scraper:

1. Save it as `data/google-maps-export.csv` (keep the header row).
2. Run:

```powershell
npm run parse:google-maps:import
```

The parser:
- Pulls **lat/lng from the Maps URL** (`!3d14.xxx!4d121.xxx`) — no geocoding needed
- Extracts **phone** and **hours** from row cells
- Flags **emergency_capable** when it sees `Open 24 hours`, `24/7`, etc.
- **Skips** pet groomers-only, funeral services, government offices
- **Upserts** by clinic name (updates phones/hours without duplicating)

Output: `data/clinics-google-maps.json` (review before production import).

**Listing photos:** The parser reads `Jn12ke src` (browser-extension exports) or `photo` (Outscraper exports). URLs must be real images (`lh3.googleusercontent.com`, etc.) — **not** `default_user.png` placeholders from list-view-only scrapes. If the parse reports `0 with photos`, re-export with a tool that includes the main business photo (e.g. [Outscraper](https://outscraper.com/google-maps-scraper/) `photo` column, free tier ~500 places).

**Note:** Google Maps HTML scraping violates Google ToS. CSV exports you already collected are fine to import; for ongoing updates prefer **Google Places API** or **manual curation**.

---

When you find clinics by hand (Google Maps, Facebook, etc.), add them to:

`data/clinics-manual.json`

Then:

```powershell
npm run import:clinics:manual
```

Or if already geocoded:

```powershell
node scripts/import-clinics.mjs --file=data/clinics-manual.json --upsert
```

**Fields to set:**

| Field | Notes |
|-------|--------|
| `phone` | E.164 preferred: `+632...`, `+639...` |
| `phone_alt` | Second number → stored in `hours` as `Alt: ...` |
| `emergency_capable` | `true` only if you confirmed 24/7 or emergency intake |
| `owner_verified` | `true` for Vet-Anchor partners only |
| `latitude` / `longitude` | Run `npm run geocode:clinics data/clinics-manual.json` or pin manually |

Copy-paste from a spreadsheet is fine — use the JSON format in `clinics-manual.json` as a template.

---

```text
scrape-clinics.mjs  →  data/clinics-scraped.json  →  YOU REVIEW  →  import-clinics.mjs  →  Supabase
```

### 1. Scrape (OSM)

```powershell
cd vet-emergency-ph
node scripts/scrape-clinics.mjs
```

Output: `data/clinics-scraped.json`

### 2. Optional: enrich with Google Places

1. Enable [Places API](https://console.cloud.google.com/apis/library/places-backend.googleapis.com) in Google Cloud.
2. Add to `.env.local`:

```env
GOOGLE_PLACES_API_KEY=your-key
```

3. Run:

```powershell
node scripts/scrape-clinics.mjs --google
```

Uses official Text Search + Place Details (not scraping).

### 3. Review (required)

Edit `data/clinics-scraped.json`:

- Fix wrong addresses / duplicate names
- Set `"owner_verified": true` for Vet-Anchor partners
- Set `"emergency_capable": true` only when confirmed
- Add `"phone"` where missing (call clinic or check their FB page)

### 4. Import into Supabase

Local (Docker):

```powershell
node scripts/import-clinics.mjs --replace
```

Merge without wiping seed data:

```powershell
node scripts/import-clinics.mjs
```

### 5. Verify in Studio

http://127.0.0.1:54323 → Table Editor → `clinics`

## What Overpass queries

Within Metro Manila bounding box:

- `amenity=veterinary`
- `healthcare=veterinary`

Tags used when present: `name`, `addr:*`, `phone`, `contact:phone`, `opening_hours`, `website`.

## Heuristics (auto-guessed — review these)

- **emergency_capable**: name/tags match `emergency`, `24/7`, `hospital`, etc.
- **services**: inferred from name (`trauma`, `poisoning`, `respiratory`)

## Other ideas for real data

- PH Vet Medical Association member lists (manual)
- Hospital groups: Vets in Practice, Animal House, etc. (direct partnership)
- Facebook page “About” sections (manual copy, not automated scrape)
- Crowdsource via Emergency Pulse after launch
