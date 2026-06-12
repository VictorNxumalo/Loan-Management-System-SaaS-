# Sandbox setup walkthrough (step-by-step)

Complete this once to split **sandbox** (`staging` branch) from **production** (`main`).

**Your current production stack (keep as-is for live users):**

| Piece | Value |
|-------|--------|
| Supabase project | `lms` (`xmjugdsqsowxffrizkvn`, eu-west-1) |
| Production web | `https://loan-management-system-saa-s-web-kr.vercel.app` |
| Hosted API (today) | `https://lms-staging-api-akb1.onrender.com/v1` |

After setup:

| | Sandbox | Production |
|---|---------|------------|
| Git branch | `staging` | `main` |
| Supabase | **New account** → `lms-sandbox` project | Existing `lms` project |
| Vercel | **New project** (branch `staging`) | Existing project (branch `main`) |
| Render API | `lms-sandbox-api` (branch `staging`) | `lms-production-api` (branch `main`) |

---

## Part A — Sandbox Supabase (new email account)

Using a **second Supabase account** works well: you get a fresh free tier (2 projects) without pausing your warzone.gg project on the first account.

### A1. Create the account and project

1. Sign up at [supabase.com](https://supabase.com) with a **new email** (e.g. `lms-sandbox@yourdomain.com`).
2. Create organisation (any name, e.g. `LMS Sandbox`).
3. **New project:**
   - Name: `lms-sandbox`
   - Database password: save in a password manager
   - Region: `eu-west-1` (same as production — lower latency if you migrate data later)
4. Wait until status is **Active**.

### A2. Copy connection strings

In the **sandbox** project → **Connect** → **ORM (Prisma)**:

- `DATABASE_URL` — transaction pooler, port **6543**, `?pgbouncer=true`
- `DIRECT_URL` — session pooler, port **5432**

Also copy from **Project Settings → API**:

- `SUPABASE_URL`
- `service_role` key (secret — API only)

### A3. Apply LMS schema to sandbox

On your machine, in the repo root (PowerShell example):

```powershell
$env:DATABASE_URL = "postgresql://postgres.[SANDBOX-REF]:[PASSWORD]@...:6543/postgres?pgbouncer=true"
$env:DIRECT_URL = "postgresql://postgres.[SANDBOX-REF]:[PASSWORD]@...:5432/postgres"
pnpm install
pnpm db:migrate:deploy
```

Or use the helper script (after saving URLs in a local file — **never commit secrets**):

```bash
# Copy .env.sandbox.example → .env.sandbox.local (gitignored), fill in values, then:
node scripts/bootstrap-sandbox-db.mjs --env-file .env.sandbox.local
```

Confirm in Supabase **Table Editor**: tables like `organisations`, `users`, `loan_applications` exist.

### A4. Storage bucket

Migrations should create `lms-documents`. If missing, create a **private** bucket with that name in **Storage**.

---

## Part B — Secrets for sandbox (generate fresh)

Sandbox must **not** reuse production JWT or NextAuth secrets.

```bash
node scripts/generate-env-secrets.mjs
```

Copy the output into your sandbox env notes. You will paste these into Render and Vercel (sandbox project).

---

## Part C — Render: sandbox API (`staging` branch)

Use your **existing** Render service or create from `render.sandbox.yaml`.

1. [Render Dashboard](https://dashboard.render.com) → open `lms-staging-api` (or create `lms-sandbox-api`).
2. **Settings → Branch:** `staging` (not `main`).
3. **Environment** — set from `.env.sandbox.example`:

   | Variable | Sandbox value |
   |----------|----------------|
   | `DATABASE_URL` | Sandbox Supabase (6543) |
   | `DIRECT_URL` | Sandbox Supabase (5432) |
   | `SUPABASE_URL` | Sandbox project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | Sandbox service role |
   | `JWT_SECRET` | **New** (from generate script) |
   | `JWT_REFRESH_SECRET` | **New** |
   | `NEXTAUTH_URL` | Sandbox Vercel URL (Part D — update after first deploy) |
   | `SKIP_EMAIL_VERIFICATION` | `true` |
   | `STAGING_ALLOW_VERCEL_CORS` | `true` |
   | `REDIS_URL` | Keep existing Render Redis or new Upstash DB |

4. **Manual Deploy** → Deploy latest commit.
5. Health: `https://lms-staging-api-akb1.onrender.com/v1/health` → `{ "status": "ok" }`

> After sandbox Vercel URL is known, set `NEXTAUTH_URL` to that exact URL and redeploy API.

---

## Part D — Vercel: second project for sandbox

1. [Vercel Dashboard](https://vercel.com) → **Add New… → Project**.
2. Import the **same GitHub repo** (`Loan-Management-System-SaaS-`).
3. **Configure:**
   - **Root Directory:** `apps/web`
   - Framework: Next.js (auto)
4. Before first deploy → **Environment Variables** (apply to **Production** on *this* project — meaning deploys from the production branch of this project):

   | Variable | Value |
   |----------|--------|
   | `NEXT_PUBLIC_APP_ENV` | `sandbox` |
   | `NODE_ENV` | `production` |
   | `NEXT_PUBLIC_API_URL` | `https://lms-staging-api-akb1.onrender.com/v1` |
   | `API_URL` | same |
   | `NEXTAUTH_URL` | `https://<your-sandbox-project>.vercel.app` (update after first deploy if needed) |
   | `NEXTAUTH_SECRET` | New secret (≠ production Vercel) |
   | `SKIP_EMAIL_VERIFICATION` | `true` |

5. **Deploy**.
6. **Settings → Git → Production Branch:** change to **`staging`**.
7. Redeploy. Note the URL (e.g. `https://lms-sandbox-xxx.vercel.app`).

8. Update Render sandbox `NEXTAUTH_URL` to this URL → redeploy API.

You should see an **amber “Sandbox environment”** banner on the site.

---

## Part E — Production Vercel (existing project)

Open your **existing** production Vercel project (`loan-management-system-saa-s-web-kr`):

1. **Settings → Git → Production Branch:** `main` only.
2. Add or confirm:

   | Variable | Value |
   |----------|--------|
   | `NEXT_PUBLIC_APP_ENV` | `production` |
   | `NEXT_PUBLIC_API_URL` | Production API URL (Part F) |
   | `API_URL` | same |
   | `NEXTAUTH_URL` | `https://loan-management-system-saa-s-web-kr.vercel.app` |
   | `NEXTAUTH_SECRET` | (keep existing — do not rotate unless needed) |

3. **Disable automatic deploys from `staging`:** only `main` should trigger production.

---

## Part F — Render: production API (`main` branch)

Today production web may share the “staging” API. Create a **dedicated production API**:

1. Render → **New → Web Service** → same repo.
2. **Branch:** `main`
3. **Runtime:** Docker → `apps/api/Dockerfile`
4. Name: `lms-production-api`
5. Environment — use **production `lms` Supabase** (current `.env` / existing Render secrets from before sandbox split):

   | Variable | Production value |
   |----------|------------------|
   | `DATABASE_URL` / `DIRECT_URL` | **Original `lms` project** (`xmjugdsqsowxffrizkvn`) |
   | `SUPABASE_*` | Production project |
   | `JWT_SECRET` / `JWT_REFRESH_SECRET` | Production secrets (keep existing so users stay logged in) |
   | `NEXTAUTH_URL` | `https://loan-management-system-saa-s-web-kr.vercel.app` |
   | `SKIP_EMAIL_VERIFICATION` | `true` (until SendGrid live) |
   | **Do not set** | `STAGING_ALLOW_VERCEL_CORS` |

6. Deploy → note URL, e.g. `https://lms-production-api.onrender.com/v1`.

7. Update **production Vercel** `NEXT_PUBLIC_API_URL` and `API_URL` to the new production API URL → redeploy web.

8. Optionally **pause or repoint** the old `lms-staging-api` so only sandbox Vercel uses it.

---

## Part G — Verify

### Sandbox

```bash
STAGING_API_URL=https://lms-staging-api-akb1.onrender.com/v1 pnpm staging:smoke:hosted
```

Open sandbox Vercel URL → register test lender + borrower → no amber banner missing, no production users visible.

### Production

- Open production Vercel URL → existing accounts still log in.
- No sandbox banner.
- `/v1/health` on production API returns ok.

---

## Part H — Daily workflow (after setup)

```bash
git checkout staging
git pull
git checkout -b feature/my-change
# ... work, commit ...
git push -u origin feature/my-change
# PR → staging → merge → sandbox deploys

# When satisfied:
# GitHub PR staging → main → production deploys
```

---

## Checklist

- [ ] A — Sandbox Supabase on new account + migrations applied
- [ ] B — New JWT / NextAuth secrets for sandbox
- [ ] C — Render sandbox API on `staging` branch → sandbox DB
- [ ] D — Vercel sandbox project on `staging` branch
- [ ] E — Production Vercel on `main` + `NEXT_PUBLIC_APP_ENV=production`
- [ ] F — Render production API on `main` → production DB
- [ ] G — Smoke tests pass on sandbox; production login still works

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| CORS / login fails on sandbox | `NEXTAUTH_URL` on Render must exactly match sandbox Vercel URL; `STAGING_ALLOW_VERCEL_CORS=true` |
| Production shows sandbox data | Production API still pointed at sandbox DB — fix `DATABASE_URL` on production Render |
| Sandbox shows production users | Sandbox API/DB still on production Supabase — fix sandbox Render env |
| 401 after split | JWT secrets differ per env — users must re-register on sandbox (expected) |

See also [sandbox-environment.md](./sandbox-environment.md).
