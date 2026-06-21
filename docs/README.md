# LMS documentation index

Documentation for the Loan Management System monorepo, updated June 2026.

## User-facing

| Document | Audience | Description |
|----------|----------|-------------|
| [user-guide.html](./user-guide.html) | Lenders & borrowers | Step-by-step portal guide with screenshots: applications, NCA loan agreements, wallets, repayments |
| [legal pages](../apps/web/src/app/legal/) | Public | Terms (`/legal/terms`) and privacy (`/legal/privacy`) — configured via `NEXT_PUBLIC_LEGAL_*` env vars |

## Engineering

| Document | Audience | Description |
|----------|----------|-------------|
| [architecture.html](./architecture.html) | Developers | C4-style system reference: monorepo, API surface, Prisma models, auth/RLS, notifications, roadmap |
| [stitch-integration.md](./stitch-integration.md) | Developers / ops | Stitch Disbursements (flag-gated) and LinkPay phase 2 |

## Operations & environments

| Document | Audience | Description |
|----------|----------|-------------|
| [sandbox-environment.md](./sandbox-environment.md) | Ops / dev | Sandbox vs production split; `staging` → sandbox, `main` → production |
| [sandbox-setup-walkthrough.md](./sandbox-setup-walkthrough.md) | Ops | Hands-on checklist: new Supabase account, Vercel sandbox project, Render API |
| [staging-deploy.md](./staging-deploy.md) | Ops | First-time hosted deploy (Vercel + Render + Supabase); smoke test happy path |
| [monitoring.md](./monitoring.md) | Ops / dev | Sentry error tracking, health probes, uptime alerts |

## Screenshots & seed data

| Path | Purpose |
|------|---------|
| [docs/_capture/seed.mjs](./_capture/seed.mjs) | Seed demo lender/borrower accounts and agreement-flow states for screenshots |
| [docs/_capture/capture.mjs](./_capture/capture.mjs) | Puppeteer capture at 1440px → `docs/img/` |
| [docs/img/](./img/) | User-guide screenshots |

Run locally (API + web on `:3001` / `:3000`):

```bash
node docs/_capture/seed.mjs
node docs/_capture/capture.mjs
```

Canonical API happy path (hosted or local):

```bash
pnpm staging:smoke
# or: STAGING_API_URL=https://<api>.onrender.com/v1 pnpm staging:smoke:hosted
```

## Archived / do not update

| Document | Notes |
|----------|-------|
| `P2P_Lending_Platform_ToDo.docx` | Legacy planning doc — historical only |

## Env templates (repo root)

- `.env.example` — local development contract
- `.env.sandbox.example` — sandbox/staging hosted stack
- `.env.production.example` — production stack
- `.env.staging.example` — legacy alias; see sandbox-environment.md
