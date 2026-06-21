# Monitoring & alerting

LMS uses **Sentry** for error tracking and **structured HTTP logs** on the API. Both are optional in local dev and activate when `SENTRY_DSN` is set on hosted environments.

---

## What is wired today

| Layer | Capability | Endpoint / trigger |
|-------|------------|-------------------|
| **API liveness** | Process is up | `GET /v1/health` (Render health check) |
| **API readiness** | Postgres reachable; Redis status | `GET /v1/health/ready` → `503` if DB down |
| **API errors** | Unhandled exceptions → Sentry | `@sentry/nestjs` global filter |
| **API requests** | JSON access logs in production | Nest `HttpLoggingInterceptor` |
| **Web errors** | Client + server React errors → Sentry | `global-error.tsx`, Next.js instrumentation |
| **Web tunnel** | Ad-blocker bypass for browser events | `/monitoring` (when Sentry enabled) |

Redis is reported as **`degraded`** when unavailable — the API still serves traffic; async notification jobs are skipped.

---

## 1. Create a Sentry project

1. Sign up at [sentry.io](https://sentry.io) (free tier is enough to start).
2. Create two projects (recommended):
   - **`lms-api`** — platform **Node.js**
   - **`lms-web`** — platform **Next.js**
3. Copy each project's **DSN** (Settings → Client Keys).

Optional for source maps in CI:

- `SENTRY_AUTH_TOKEN` — user auth token with `project:releases` scope
- `SENTRY_ORG` / `SENTRY_PROJECT` — only needed if you enable upload in `next.config.mjs`

---

## 2. Environment variables

Add to **Render (API)** and **Vercel (web)** dashboards (never commit real DSNs to git):

```env
# API (Render)
SENTRY_DSN=https://<key>@o<org>.ingest.sentry.io/<api-project-id>
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1

# Web (Vercel) — use the web project DSN
SENTRY_DSN=https://<key>@o<org>.ingest.sentry.io/<web-project-id>
NEXT_PUBLIC_SENTRY_DSN=https://<key>@o<org>.ingest.sentry.io/<web-project-id>
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1
```

| Variable | Required | Notes |
|----------|----------|-------|
| `SENTRY_DSN` | Yes (to enable) | API server-side; web server-side |
| `NEXT_PUBLIC_SENTRY_DSN` | Web only | Browser error capture |
| `SENTRY_ENVIRONMENT` | Recommended | `production`, `staging`, `sandbox`, or `local` |
| `SENTRY_RELEASE` | Optional | Git SHA — set in CI for release tracking |
| `SENTRY_TRACES_SAMPLE_RATE` | Optional | `0.0`–`1.0`, default `0.1` (10% of transactions) |

**Staging/sandbox:** use `SENTRY_ENVIRONMENT=staging` or `sandbox` so alerts can be filtered separately from production.

---

## 3. Verify after deploy

### API boot log (Render)

```
Error monitoring: Sentry enabled
```

If you see `disabled (set SENTRY_DSN...)`, the env var is missing on Render.

### Health checks

```bash
curl https://<api-host>/v1/health
curl https://<api-host>/v1/health/ready
```

Readiness example:

```json
{
  "status": "degraded",
  "checks": { "database": "ok", "redis": "degraded" },
  "monitoring": { "enabled": true, "environment": "production" }
}
```

### Trigger a test error (staging/sandbox only)

```bash
curl https://<staging-api>/v1/health/sentry-test
```

Requires `SENTRY_DSN` set and `SENTRY_ENVIRONMENT` of `staging`, `sandbox`, or `local` (not `production`). Expect **500** — the event should appear in Sentry → **lms-api** → **Issues** within ~30 seconds.

---

## 4. Alert rules (Sentry dashboard)

Configure under **Alerts → Create Alert**:

| Alert | Condition | Suggested action |
|-------|-----------|------------------|
| **New issue** | First seen in `production` | Email / Slack to on-call |
| **Regression** | Issue reappears after resolved | Email |
| **High error rate** | > 50 events in 5 min | Pager / Slack |
| **Health check failure** | Use [Sentry Cron Monitors](https://docs.sentry.io/product/crons/) or external uptime (see below) | Email |

Filter sandbox noise: `environment != sandbox` on production alerts.

---

## 5. Uptime monitoring (external)

Render's built-in health check hits `/v1/health` only. For deeper checks and alerting:

| Service | Free tier | What to monitor |
|---------|-----------|-----------------|
| [UptimeRobot](https://uptimerobot.com) | 50 monitors | `GET /v1/health/ready` every 5 min |
| [Better Stack](https://betterstack.com) | Limited | Same + log drain from Render |
| [Checkly](https://www.checklyhq.com) | Trial | Browser check: login page loads |

Suggested monitors:

1. **Production API liveness** — `https://<api>/v1/health` → expect `200`, body `"status":"ok"`
2. **Production API readiness** — `https://<api>/v1/health/ready` → expect `200` (not `503`)
3. **Production web** — `https://<app>/` → expect `200`

---

## 6. Log access

| Source | Where to view |
|--------|---------------|
| **API request logs** | Render → service → Logs (JSON lines in production) |
| **Vercel web** | Vercel → project → Logs |
| **Supabase** | Dashboard → Logs (DB, auth, storage) |
| **Sentry** | Issues + Performance → traces for slow API routes |

Render log drain to Datadog/Better Stack is optional — not configured in repo today.

---

## 7. Local development

Sentry is **off** when `SENTRY_DSN` is unset. To test locally:

```env
SENTRY_DSN=https://...
SENTRY_ENVIRONMENT=local
SENTRY_TRACES_SAMPLE_RATE=1.0
```

Restart `pnpm dev`. Errors will appear in your Sentry `local` environment.

---

## Checklist before go-live

- [ ] Sentry projects created (`lms-api`, `lms-web`)
- [ ] `SENTRY_DSN` set on Render production API
- [ ] `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` set on Vercel production
- [ ] `SENTRY_ENVIRONMENT=production` on both
- [ ] Sentry alert: new issue in `production` → email/Slack
- [ ] Uptime monitor on `/v1/health/ready`
- [ ] Boot log shows `Error monitoring: Sentry enabled` on Render
