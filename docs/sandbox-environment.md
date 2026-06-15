# Sandbox vs production environments

Run new work in **sandbox** first. Promote to **production** only after you are satisfied. Production stays on `main`; sandbox stays on `staging`.

---

## Three layers

| Layer | Purpose | Data | Deploy trigger |
|-------|---------|------|----------------|
| **Local** | Day-to-day coding | Docker Postgres or your `.env` | `pnpm dev` |
| **Sandbox** | Hosted pre-production — same build as prod, isolated infra | Fake / disposable test users | Push to `staging` |
| **Production** | Real lenders and borrowers | Live data, backups, Brevo, etc. | Merge / push to `main` |

```text
  feature/my-change
         │
         ▼
      staging  ──►  Sandbox (Vercel + Render + Supabase)
         │
    test & approve
         │
         ▼
       main  ──►  Production (separate Vercel + Render + Supabase)
```

---

## Git workflow (recommended)

### Daily development

1. Branch from `staging` (not `main`):

   ```bash
   git checkout staging
   git pull origin staging
   git checkout -b feature/my-update
   ```

2. Code and test **locally** (`pnpm dev`).

3. Push and open a PR **into `staging`** (not `main`):

   ```bash
   git push -u origin feature/my-update
   ```

4. Merge to `staging` → **sandbox auto-deploys** on Vercel + Render.

5. Test on sandbox URLs (mobile, smoke test, manual flows).

6. When happy, open a PR **`staging` → `main`**. After merge, **production** deploys.

### Rules of thumb

- **Never** point sandbox at the production database.
- **Never** reuse production JWT secrets on sandbox (or vice versa).
- Run **`pnpm db:migrate:deploy`** against sandbox Supabase **before** production when schema changes.
- Use **`pnpm db:reset:staging`** only on sandbox DB (see env vars in that script).

---

## Infrastructure map

You need **two parallel stacks**:

| Component | Sandbox | Production |
|-----------|---------|------------|
| **Git branch** | `staging` | `main` |
| **Web (Vercel)** | Second project, production branch = `staging` | Existing project, production branch = `main` |
| **API (Render)** | `lms-sandbox-api` (branch `staging`) | `lms-production-api` (branch `main`) |
| **Postgres + storage** | Supabase project **A** (sandbox) | Supabase project **B** (production) |
| **Redis** | Sandbox Redis / Upstash | Production Redis / Upstash |
| **Stripe** | Test keys | Live keys |
| **Env template** | `.env.sandbox.example` | `.env.production.example` |

Supabase free tier allows **2 projects per account**. Options for a separate sandbox database:

| Option | When to use |
|--------|-------------|
| **Second Supabase account (recommended for you)** | New email → new org → `lms-sandbox` project. Does not affect warzone.gg or production `lms`. |
| **Pause an unused project** on the same account | Free a slot, then create `lms-sandbox` in the original org. |
| **Paid preview branch** on `lms` | ~$0.013/hr; schema-only copy, no production data. |
| **Upgrade to Pro** | More projects on one org. |

Step-by-step (new account + Vercel + Render): **[sandbox-setup-walkthrough.md](./sandbox-setup-walkthrough.md)**.

---

## 1. Create the `staging` branch

If it does not exist yet:

```bash
git checkout main
git pull origin main
git checkout -b staging
git push -u origin staging
```

Protect `main` on GitHub (Settings → Branches): require PR and CI pass before merge.

---

## 2. Sandbox web (Vercel)

Create a **second Vercel project** (do not reuse the production project):

1. Vercel → **Add New Project** → same GitHub repo.
2. **Root Directory:** `apps/web`.
3. **Settings → Environments → Production → Branch Tracking:** `staging` (not `main`).
4. **Environment Variables** (Production scope for this project — means “deploy branch `staging`”):

   Copy from `.env.sandbox.example`. Minimum:

   | Variable | Value |
   |----------|--------|
   | `NEXT_PUBLIC_APP_ENV` | `sandbox` |
   | `NEXT_PUBLIC_API_URL` | Sandbox Render API URL |
   | `API_URL` | Same as above |
   | `NEXTAUTH_URL` | This Vercel sandbox URL |
   | `NEXTAUTH_SECRET` | New random secret (≠ production) |

5. Deploy. Note the URL, e.g. `https://lms-sandbox.vercel.app`.

Set `NEXT_PUBLIC_APP_ENV=sandbox` so users see an amber **Sandbox** banner at the top.

---

## 3. Sandbox API (Render)

Either update the existing Render service or create a new one:

1. Render → Web Service → **Settings → Branch:** `staging`.
2. Rename service to `lms-sandbox-api` for clarity.
3. Env vars from `.env.sandbox.example` (sandbox Supabase, sandbox JWT secrets).
4. Set `NEXTAUTH_URL` to the **sandbox Vercel URL** (exact match).
5. Keep `STAGING_ALLOW_VERCEL_CORS=true` on sandbox only.

Or apply `render.sandbox.yaml` via Blueprint (branch `staging`).

Health check: `https://<sandbox-api>.onrender.com/v1/health`

---

## 4. Production web (Vercel) — existing app

Your current production project should:

1. **Settings → Environments → Production → Branch Tracking:** `main` only.
2. Env vars from `.env.production.example`.
3. `NEXT_PUBLIC_APP_ENV=production` (or omit — no banner).
4. **Do not** set `STAGING_ALLOW_VERCEL_CORS` on production API.

Pushes to `staging` must **not** deploy production if branch settings are correct.

---

## 5. Production API (Render)

Create a **separate** Render web service (do not share with sandbox):

1. Same repo, Docker, `apps/api/Dockerfile`.
2. **Branch:** `main`.
3. Name: `lms-production-api`.
4. Production Supabase + production secrets only.
5. Custom domain recommended, e.g. `api.yourdomain.com`.

See `render.production.yaml` for a reference blueprint.

---

## 6. Databases

| Action | Sandbox | Production |
|--------|---------|------------|
| New migration | Deploy here first | After sandbox verified |
| Reset all data | `pnpm db:reset:staging` with sandbox `DIRECT_URL` | **Never** run reset |
| Backups | Optional | Enable Supabase PITR / backups |

---

## 7. Verify sandbox after deploy

```bash
STAGING_API_URL=https://<sandbox-api>.onrender.com/v1 pnpm staging:smoke:hosted
```

Manual checklist: register lender + borrower, application, **loan agreement sign**, disburse, wallet payment — same as [staging-deploy.md](./staging-deploy.md) §6.

---

## 8. Promote to production

1. Open GitHub PR: **`staging` → `main`**.
2. CI must pass (lint, type-check, tests).
3. Review diff — especially migrations and env-breaking changes.
4. Merge → Vercel (production) + Render (production API) deploy from `main`.
5. If migrations exist, confirm they already ran on sandbox; production deploy runs `prisma migrate deploy` in the API container.
6. Smoke-test production with a **non-destructive** check (login, health, read-only page).

Use the PR template in `.github/pull_request_template.md`.

---

## Local vs sandbox

| | Local | Sandbox |
|---|-------|---------|
| Command | `pnpm dev` | Push to `staging` |
| API | `localhost:3001` | Render sandbox |
| DB | Docker or `.env` | Supabase sandbox project |
| Best for | Fast iteration | Mobile testing, full hosted stack, demos |

You can keep local `.env` on Docker Postgres while sandbox uses hosted Supabase — they stay independent.

---

## Current repo vs target state

If production and sandbox **share one Supabase project or one API today**, split them before real users rely on production:

1. Create production Supabase project → migrate schema → point production Render/Vercel at it.
2. Keep (or create) sandbox Supabase for `staging` branch only.
3. Rotate JWT secrets per environment.

---

## Related docs

- [sandbox-setup-walkthrough.md](./sandbox-setup-walkthrough.md) — **hands-on checklist** (new Supabase account, Vercel, Render)
- [staging-deploy.md](./staging-deploy.md) — first-time hosted setup (historical name)
- `.env.sandbox.example` / `.env.production.example` — env checklists
