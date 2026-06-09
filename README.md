# VetEmergency.ph

Real-time veterinary emergency discovery platform for the Philippines. Helps pet owners find, verify, and contact emergency-capable veterinary clinics in Metro Manila and beyond.

## Stack

- **Frontend:** Next.js 16, TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Supabase (PostgreSQL + PostGIS, Auth, Edge Functions)
- **Cache:** Upstash Redis (optional, graceful fallback to direct DB)

## Quick start

### 1. Install dependencies

```bash
cd vet-emergency-ph
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env.local` and fill in your credentials:

```bash
cp .env.example .env.local
```

Required:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)

Optional (recommended for production):
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `NEXT_PUBLIC_APP_URL`
- `WEBHOOK_SECRET`

### 3. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com) (Singapore region recommended).
2. Link the CLI:

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

3. Push migrations and seed data:

```bash
supabase db push
supabase db execute --file supabase/seed.sql
```

Or for local development:

```bash
supabase start
supabase db reset
```

4. Deploy Edge Functions:

```bash
supabase functions deploy stale-listing-detector
supabase functions deploy confidence-score-refresh
```

5. Schedule cron jobs in Supabase Dashboard → Edge Functions:
   - `stale-listing-detector`: daily at 18:00 UTC (02:00 PHT)
   - `confidence-score-refresh`: daily at 17:00 UTC (01:00 PHT)

### 4. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Features (MVP)

- Emergency clinic directory with GPS search
- PostGIS nearest-clinic queries with triage-aware ranking
- Confidence score system (owner verification + community pulse)
- Emergency Pulse community verifications
- Clinic admin via magic link email
- One-click emergency triage (Trauma / Poisoning / Respiratory)
- Click-to-call and Google Maps / Waze directions
- Redis caching (60s TTL)
- Edge Functions for stale listing detection and score refresh
- SEO: JSON-LD structured data, sitemap, robots.txt
- 50 seeded NCR clinics

## Project structure

```
src/
  app/              # Next.js App Router pages and API routes
  components/       # UI components
  lib/              # Supabase, Redis, geo, confidence helpers
  types/            # TypeScript types
supabase/
  migrations/       # Database schema + PostGIS + RLS
  functions/        # Edge Functions
  seed.sql          # 50 NCR clinic seed data
```

## Deploy

### Vercel

1. Import the repo to Vercel.
2. Set all environment variables from `.env.example`.
3. Deploy.

### Supabase production

```bash
supabase db push
supabase functions deploy stale-listing-detector
supabase functions deploy confidence-score-refresh
```

## Disclaimer

VetEmergency.ph is an informational directory. Users should always contact clinics directly before traveling. See `/disclaimer` for full terms.
