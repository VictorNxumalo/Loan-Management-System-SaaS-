# Stitch integration — loan disbursements to borrower bank

LMS uses [Stitch](https://stitch.money) for **real ZAR disbursements** when enabled. Internal wallet top-up/disburse remains the default for local dev and hosted staging without Stitch credentials.

## Architecture

| Your product choice | Stitch product | Status in LMS |
|---------------------|----------------|---------------|
| Pay **direct to borrower bank** on Disburse | [Disbursements REST API](https://docs.stitch.money/payment-products/payouts/rest) | **Implemented** (feature-flagged) |
| **Pull per loan** from lender bank | [LinkPay](https://docs.stitch.money/payment-products/payins/linkpay/integration-process) | **Phase 2** (schema + stub only) |

**Important:** Stitch Disbursements require a **float account** funded with your business. Until LinkPay pulls are wired, you fund float manually for sandbox/live testing. Disbursements debit float and pay the borrower’s linked bank account.

```text
[Lender LinkPay — phase 2]     [Stitch float — you fund today]
         │                              │
         └──────────► Disburse API ──────┴──► Borrower bank (profile wallet bank details)
                              │
                         Webhook → LMS marks loan disbursed
```

## Environment variables (API)

Set on Render / local `.env`:

| Variable | Description |
|----------|-------------|
| `STITCH_CLIENT_ID` | From Stitch dashboard |
| `STITCH_CLIENT_SECRET` | From Stitch dashboard |
| `STITCH_WEBHOOK_SECRET` | From disbursement webhook subscription |
| `STITCH_DISBURSEMENTS_ENABLED` | `true` to use Stitch on **Disburse** (default `false`) |
| `STITCH_API_BASE` | Optional, default `https://api.stitch.money/v2` |
| `STITCH_TOKEN_URL` | Optional, default `https://secure.stitch.money/connect/token` |

When `STITCH_DISBURSEMENTS_ENABLED=false`, **Disburse** keeps the existing demo behaviour (internal lender → borrower wallet ledger).

## Setup checklist

### 1. Stitch sandbox client

1. Sign up / log in at [Stitch](https://stitch.money).
2. Create a **test client**; note `client_id` and `client_secret`.
3. Enable **Disbursements** (contact support@stitch.money if required).
4. Fund your **test float** (Stitch dashboard / support).

### 2. Webhook

Subscribe to disbursement events (see [Stitch webhooks](https://docs.stitch.money/webhooks/using_webhooks)):

- **URL:** `https://<your-api>.onrender.com/v1/webhooks/stitch/disbursement`
- Save the **signing secret** as `STITCH_WEBHOOK_SECRET`.

LMS verifies `X-Stitch-Signature` (HMAC-SHA256).

### 3. Database migration

```bash
pnpm db:migrate:deploy
```

Creates `loan_stitch_disbursements` and `organisation_stitch_linkpay`.

### 4. Enable on sandbox only first

On your **sandbox Render API** (not production):

```env
STITCH_CLIENT_ID=...
STITCH_CLIENT_SECRET=...
STITCH_WEBHOOK_SECRET=...
STITCH_DISBURSEMENTS_ENABLED=true
```

Redeploy API → run a small test loan (see below).

## Test flow (two real accounts)

Use **sandbox Vercel + sandbox Render + sandbox Supabase** with your personal emails and bank details.

1. **Borrower** — complete profile + bank account (`/borrower/profile`, wallet page).
2. **Lender** — complete profile + org bank details.
3. Apply → approve → activate loan.
4. **Disburse** — LMS calls Stitch; loan shows **PENDING** until webhook **completed**.
5. Confirm money in borrower bank (sandbox simulation rules apply).

### Stitch sandbox simulation ([docs](https://docs.stitch.money/payment-products/payouts/rest))

| Outcome | Requirements |
|---------|----------------|
| Success | Account number ends in `0`, amount &lt; R400, wait ~2 min |
| Error | Amount = R400, R401, R402, etc. |

## API behaviour

- `POST /v1/loans/:id/disburse` — when Stitch enabled, creates `LoanStitchDisbursement`, sets loan `disbursementStatus=PENDING`, calls Stitch.
- `POST /v1/webhooks/stitch/disbursement` — updates status; on **completed** sets loan `COMPLETED` + `disbursedAt`.
- Loan detail includes `stitchDisbursement` when present.

## Phase 2 — LinkPay (lender pull per loan)

Planned work:

1. Lender OAuth via Stitch LinkPay (`client_paymentauthorizationrequest`).
2. Store refresh token in `organisation_stitch_linkpay`.
3. On Disburse: initiate pay-in from lender for principal, then disburse to borrower (or chained automation).

Until then, fund Stitch float for disbursement testing.

## Compliance

Before production money movement: POPIA, FICA/KYC, NCR/micro-lending rules, and Stitch commercial agreement. This doc is technical setup only — not legal advice.
