# Production Operations

This project has five production safety layers:

1. GitHub Actions CI checks every push and pull request to `main`.
2. `/api/health` gives uptime tools a readiness check for app dependencies.
3. Upload malware scanning blocks or quarantines unsafe user files before they
   reach public or user-visible storage.
4. DB-backed API rate limits protect expensive authenticated routes from
   storage, CPU, and notification churn abuse.
5. GlitchTip can capture production errors when the deployment has monitoring
   env vars.

GlitchTip is the open-source Sentry-compatible error tracker. The code uses
`@sentry/nextjs` because GlitchTip's official Next.js setup uses the Sentry SDK
protocol, but the error backend can be GlitchTip instead of sentry.io.

## CI

The workflow lives at `.github/workflows/ci.yml`.

It runs:

- `npm ci`
- `npx playwright install --with-deps chromium`
- `npm run test:coverage`
- `npm run docs:check`
- `npm run docs:quality:check`
- `npm run docs:lint`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run test:performance`
- `npm run test:e2e`
- `npm run test:a11y`
- `npm run test:visual`

After pushing a commit, open the GitHub repository, choose the `Actions` tab,
and open the newest `CI` run. A green check means the project passed the full
quality gate.

## Test Depth

Unit tests now run with V8 coverage and fail below the current coverage floor.
Playwright covers production-build browser smoke checks, axe-powered critical
WCAG scans, and responsive visual layout invariants for the feed. The visual
suite specifically guards against mobile horizontal overflow and desktop-only
feed rail content appearing on phone viewports.

The performance budget check reads `.next/app-build-manifest.json` after
`npm run build` and fails if high-traffic routes exceed their configured gzip
asset budgets in `config/performance-budgets.json`.

## Health Check

The health endpoint is:

```text
/api/health
```

It returns JSON with app metadata plus component checks for Supabase database
connectivity, required Storage buckets, the scheduled temporary-data cleanup
cron job, and Web Push delivery configuration.

Healthy responses return HTTP `200` and `status: "ok"`. Failed readiness returns
HTTP `503` and `status: "unhealthy"` with safe public component messages. Raw
database/storage errors are captured privately through monitoring, not returned
to callers.

Use this URL in an uptime/readiness monitor. For a fully open-source uptime
monitor, use Uptime Kuma.

## Supabase Auth

The checked-in `supabase/config.toml` is a local development baseline. Before
production launch, configure the hosted Supabase project directly:

- Use exact production redirect URLs; do not allow broad localhost or wildcard
  production redirects.
- Enable email confirmations for email/password signup, or require OAuth/passkey
  providers only.
- Enable secure password changes so password updates require a recent session.
- Set a stronger password policy than the local minimum.
- Configure custom SMTP for signup, recovery, and password-change email.
- Review Supabase Auth rate limits in the dashboard and keep abuse-sensitive
  endpoints fail-closed in application code.
- Enable CAPTCHA for signup/sign-in if public abuse starts before invitation or
  allowlist controls are in place.

Do not commit production Auth secrets, SMTP credentials, JWT signing keys, or
Management API tokens.

## Backups And Recovery

Before real user traffic:

- Move the project off the Free plan if database size, storage, egress, logs, or
  recovery requirements exceed Free quotas.
- Enable daily backups at minimum and Point-in-Time Recovery for production data
  that cannot be manually reconstructed.
- Test restore into a separate Supabase project before relying on backups for an
  incident.
- Keep `npm run db:push:dry` review as the production migration gate; never run
  `db reset` against a linked production project.
- Monitor Storage usage for public media buckets because deleted database rows
  cannot atomically roll back Storage API cleanup.

## GlitchTip Setup

For a completely free and open-source setup, self-host GlitchTip. If you want a
simpler first step, GlitchTip also has a hosted service, but self-hosting is the
no-lock-in option.

Create a GlitchTip project, copy its DSN, and add these environment variables in
your production hosting provider:

```text
NEXT_PUBLIC_ERROR_MONITORING_DSN=
NEXT_PUBLIC_ERROR_MONITORING_ENVIRONMENT=production
NEXT_PUBLIC_ERROR_MONITORING_TRACES_SAMPLE_RATE=0.01
```

Beginner notes:

- `NEXT_PUBLIC_ERROR_MONITORING_DSN` comes from the GlitchTip project settings.
- Keep the trace sample rate low at first. `0.01` means 1% of performance
  transactions.
- Do not commit real monitoring tokens into git.

Optional source-map upload variables:

```text
ERROR_MONITORING_URL=
ERROR_MONITORING_ORG=
ERROR_MONITORING_PROJECT=
ERROR_MONITORING_AUTH_TOKEN=
```

Only add these after basic error capture is working. They let the build upload
source maps to GlitchTip so production stack traces point back to the original
TypeScript files.

After adding the variables, redeploy the app. Production runtime errors should
appear in the GlitchTip project.

## Upload Scanning

Production uploads fail closed unless a malware scanner is configured. Resume
PDFs, comment images, and avatars are scanned before they are written to their
destination storage buckets. Blocked or unscanned production uploads are copied
to the private `upload-quarantine` bucket and recorded in
`upload_security_events`.

Required production variables:

```text
UPLOAD_MALWARE_SCAN_MODE=required
UPLOAD_MALWARE_SCAN_URL=
UPLOAD_MALWARE_SCAN_TOKEN=
UPLOAD_MALWARE_SCAN_TIMEOUT_MS=8000
```

The scanner endpoint receives multipart form data with `file`, `kind`,
`mimeType`, and `sha256`. It should return JSON with one of these verdict shapes:

```json
{ "verdict": "clean", "scanner": "clamav" }
```

```json
{ "verdict": "infected", "scanner": "clamav", "reason": "signature name" }
```

Accepted clean values are `clean`, `ok`, `pass`, `passed`, `allow`, or
`allowed`. Blocked values are `infected`, `malicious`, `virus`, `blocked`,
`suspicious`, `risk`, or `warning`.

## Authenticated API Rate Limits

The database-backed `request_rate_limits` table also protects expensive API
routes that are not direct table writes. Next.js routes call the service-role
RPC `check_authenticated_action_rate_limit(...)` before doing storage, malware
scan, PDF redaction, reviewer trust submission, or push subscription mutations.

Current production quotas:

```text
resume_pdf_submit: 8 per 1 hour
comment_media_upload: 20 per 10 minutes
avatar_upload: 20 per 1 hour
reviewer_application_submit: 8 per 1 hour
push_subscription_write: 60 per 1 hour
```

Over-quota responses return HTTP `429` with a `Retry-After` header. If the
limiter RPC cannot be reached, protected routes fail closed with HTTP `503` so
expensive work does not proceed without an abuse-control decision.
