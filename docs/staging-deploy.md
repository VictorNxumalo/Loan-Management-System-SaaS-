# Staging deployment (hosted testing)

Deploy a **staging-only** environment for internal testing. Use fake borrowers, small amounts, and Stripe **test** keys. Data is disposable — reset the Supabase project or re-run migrations if needed.

**Stack**

| Component | Provider | Notes |
|-----------|----------|--------|
| Web (Next.js) | [Vercel](https://vercel.com) | Root directory: `apps/web` |
| API (NestJS) | [Render](https://render.com) | Docker image from `apps/api/Dockerfile` |
| Postgres + Storage | [Supabase](https://supabase.com) | Reuse existing project (see §1) or free a slot |
| Redis | Render Redis or [Upstash](https://upstash.com) | BullMQ notification queue |

Set `NODE_ENV=production` on staging (production build behaviour) but treat all data as throwaway.

---

## 1. Supabase (database + storage)

Supabase free orgs allow **2 active projects per owner**. If you see *“members who have exceeded their free project limits”*, you cannot create another project until you free a slot or upgrade.

### Pick one approach

| Approach | When to use |
|----------|-------------|
| **A — Reuse existing LMS project (recommended)** | You already have a Supabase project for this app. Use it for hosted staging; keep local dev on Docker Postgres (`pnpm` + `docker-compose.yml`). |
| **B — Delete or pause an unused project** | Supabase Dashboard → pick a project you no longer need → **Settings → General → Pause project** (or delete). Then create `lms-staging`. |
| **C — Upgrade** | Supabase Pro ($25/mo) raises project limits; only if you need a permanently separate staging DB. |

For internal hosted testing, **A is enough**: staging data is disposable (`staging.*@test.local` accounts from the smoke test). You are not going live with real users.

### Setup (reuse existing project — option A)

1. Open your **existing** LMS Supabase project (do not create a new one).
2. **Database → Connect → ORM (Prisma)** — copy `DATABASE_URL` (transaction pooler, port **6543**, `?pgbouncer=true`) and `DIRECT_URL` (session pooler, port **5432**).
3. From your machine (with those env vars set):

   ```bash
   pnpm install
   pnpm db:migrate:deploy
   ```

   Migrations create the `lms-documents` storage bucket and RLS policies automatically.

4. **Project Settings → API** — copy `SUPABASE_URL` and the **service role** key (API only, never in the browser).

5. Paste the **same** Supabase values into Render (API) only. Keep local `.env` on Docker Postgres if you prefer not to mix local and hosted data:

   ```env
   # Local .env — optional; avoids touching hosted staging data
   DATABASE_URL=postgresql://lms:lms_dev_password@localhost:5432/lms
   DIRECT_URL=postgresql://lms:lms_dev_password@localhost:5432/lms
   ```

   Hosted Render/Vercel env vars use the Supabase pooler URLs instead.

### If you freed a slot (option B)

Create `lms-staging`, then follow steps 2–4 above on that new project.

---

## 2. Redis

**Option A — Render (with blueprint)**  
`render.yaml` provisions a free Redis instance and wires `REDIS_URL` to the API.

**Option B — Upstash**  
Create a Redis database, copy the `rediss://` URL into `REDIS_URL` on the API service.

If Redis is unavailable, the API still runs; async notification jobs are skipped.

---

## 3. API on Render

1. Push this repo to GitHub.
2. Render → **New → Blueprint** → select the repo → apply `render.yaml`.
3. Set these **secret** env vars on `lms-staging-api` (see `.env.staging.example`):

   | Variable | Value |
   |----------|--------|
   | `DATABASE_URL` | Supabase transaction pooler |
   | `DIRECT_URL` | Supabase session pooler |
   | `JWT_SECRET` | Random 32+ chars |
   | `JWT_REFRESH_SECRET` | Different random 32+ chars |
   | `NEXTAUTH_URL` | Vercel URL (step 4) — must match exactly |
   | `SUPABASE_URL` | Staging project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | Service role key |
   | `SKIP_EMAIL_VERIFICATION` | `true` |

4. Deploy. On each deploy, the container runs `prisma migrate deploy` then starts the API.
5. Confirm health: `https://<your-api>.onrender.com/v1/health` → `{ "status": "ok" }`.

Render sets `PORT` automatically; the API reads it via `API_PORT`.

---

## 4. Web on Vercel

1. Import the GitHub repo into Vercel.
2. **Root Directory:** `apps/web` (monorepo).
3. `apps/web/vercel.json` already sets install/build commands for the workspace.
4. Environment variables:

   | Variable | Value |
   |----------|--------|
   | `NODE_ENV` | `production` |
   | `NEXT_PUBLIC_API_URL` | `https://<your-api>.onrender.com/v1` |
   | `NEXTAUTH_URL` | `https://<your-vercel-app>.vercel.app` |
   | `NEXTAUTH_SECRET` | Random 32+ chars |
   | `SKIP_EMAIL_VERIFICATION` | `true` (if referenced) |

5. Deploy, then **update `NEXTAUTH_URL` on the API** to match the final Vercel URL and redeploy the API (CORS uses this value in production).

---

## 5. Smoke test

After web + API + Supabase + Redis are live:

```bash
STAGING_API_URL=https://<your-api>.onrender.com/v1 pnpm staging:smoke
```

This script (idempotent per run — unique emails each time):

1. Register lender → onboard → enable public listing  
2. Register borrower → onboard → connect → apply (R5 000 loan)  
3. Lender approves → activates loan  
4. Borrower pays R500 with fake PDF proof → submits  
5. Lender confirms payment  

Credentials are printed at the end for manual UI testing on the Vercel URL.

---

## 6. Manual UI checklist

- [ ] Register as lender at `/auth/register` → complete onboarding  
- [ ] Dashboard → create/approve flows match smoke test  
- [ ] Register as borrower → browse lenders → apply  
- [ ] Borrower loan → Pay lender → lender confirms in dashboard  
- [ ] Notification bell shows payment events (needs Redis for queue)  

Use **Stripe test mode** only if you exercise billing; otherwise leave Stripe vars unset.

---

## 7. Resetting staging data

- **Quick reset:** Supabase SQL editor → truncate app tables, or delete rows where emails match `staging.%@test.local`.  
- **Full reset (separate staging project only):** Supabase → Settings → reset database. **Do not** reset if local dev shares the same project.  
- **Schema refresh:** `pnpm db:migrate:deploy` after pulling new migrations.  
- Do **not** point staging at a future **production** project with real borrower data.

---

## Local Docker smoke (optional)

Build and run the API image against your `.env`:

```bash
docker build -f apps/api/Dockerfile -t lms-api .
docker run --env-file .env -p 3001:3001 lms-api
```

---

## What this is not

- Not a go-live checklist for real borrowers or live payments.  
- Not hardened for PCI, SLA, or regulatory production use.  
- Real production would add: custom domain, monitoring (Sentry), E2E CI against staging, backup policy, and Stripe live mode review.
