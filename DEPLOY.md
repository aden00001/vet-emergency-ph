# Production deploy checklist

## Prerequisites

- [ ] Git repo pushed to GitHub
- [ ] Supabase cloud project (Singapore region recommended)
- [ ] Vercel account
- [ ] Upstash Redis (optional but recommended)
- [ ] Google Places API key (optional, for data enrichment)

---

## 1. Remote Supabase

**Region:** Choose **Southeast Asia (Singapore)** when creating the project — not India or US. Lower latency for Philippines users and closer to Vercel's Singapore edge.

After the project is created, copy the **Project URL** from **Settings → API** (looks like `https://abcdefghijklmnop.supabase.co`). The project ref is the subdomain before `.supabase.co` — **not** the database password you set at creation.

```powershell
cd vet-emergency-ph
supabase login
supabase link --project-ref fmmktluhbxxfvmmogztb
supabase db push
```

**Production Supabase URL:** `https://fmmktluhbxxfvmmogztb.supabase.co`

Import real clinic data (after scrape + review):

```powershell
# Point .env.local at REMOTE URL + service role key first, or use a separate .env.production.local
node scripts/import-clinics.mjs --replace
```

Deploy Edge Functions:

```powershell
supabase functions deploy stale-listing-detector
supabase functions deploy confidence-score-refresh
```

**Cron schedules** (Supabase Dashboard → Edge Functions → Schedules):

| Function | Schedule (UTC) | PHT |
|----------|----------------|-----|
| `stale-listing-detector` | `0 18 * * *` | 02:00 |
| `confidence-score-refresh` | `0 17 * * *` | 01:00 |

Enable **PostGIS** in Dashboard → Database → Extensions if not already enabled.

Configure Auth redirect URLs:

- `http://localhost:3000/auth/callback`
- `https://vet-emergency-ph.vercel.app/auth/callback`

---

## 2. Upstash Redis

1. Create database at [upstash.com](https://upstash.com) (region close to Singapore).
2. Copy REST URL + token.

---

## 3. Vercel

1. Import GitHub repo.
2. Root directory: `vet-emergency-ph`
3. Environment variables:

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://fmmktluhbxxfvmmogztb.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon public (`eyJ...`) |
| `SUPABASE_URL` | Same URL as above (server runtime — **required on Vercel**) |
| `SUPABASE_ANON_KEY` | Same anon key as above (server runtime — **required on Vercel**) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role |
| `NEXT_PUBLIC_APP_URL` | `https://vet-emergency-ph.vercel.app` |

> Use the **anon JWT** (`eyJ...`), not the publishable key (`sb_...`). Enable all vars for **Production**. After saving, redeploy **without** build cache.

**Production branch:** `master` (not `main`).

**Verify after deploy:** `https://vet-emergency-ph.vercel.app/api/health` should show `"ok": true`.
| `UPSTASH_REDIS_REST_URL` | Upstash REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash token |
| `WEBHOOK_SECRET` | Random secret string |

4. Deploy.

---

## 4. Custom domain

Vercel → Project → Domains → add `vetemergency.ph` and configure DNS at your registrar.

Update Supabase Auth redirect URLs with production domain.

---

## 5. Post-deploy QA

Use `QA_CHECKLIST.md` against production URL.

Test magic links with real email (not Inbucket).

---

## Local vs production env

| Environment | `NEXT_PUBLIC_SUPABASE_URL` |
|-------------|----------------------------|
| Local Docker | `http://127.0.0.1:54321` |
| Production (Vercel) | `https://fmmktluhbxxfvmmogztb.supabase.co` |

Keep separate `.env.local` (local) and Vercel env vars (production).
