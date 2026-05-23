# Production Operations

This project has three production safety layers:

1. GitHub Actions CI checks every push and pull request to `main`.
2. `/api/health` gives uptime tools a simple app heartbeat.
3. GlitchTip can capture production errors when the deployment has monitoring
   env vars.

GlitchTip is the open-source Sentry-compatible error tracker. The code uses
`@sentry/nextjs` because GlitchTip's official Next.js setup uses the Sentry SDK
protocol, but the error backend can be GlitchTip instead of sentry.io.

## CI

The workflow lives at `.github/workflows/ci.yml`.

It runs:

- `npm ci`
- `npm run test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`

After pushing a commit, open the GitHub repository, choose the `Actions` tab,
and open the newest `CI` run. A green check means the project passed the full
quality gate.

## Health Check

The health endpoint is:

```text
/api/health
```

It returns a small JSON response with `status: "ok"`. Use this URL in an uptime
monitor later. For a fully open-source uptime monitor, use Uptime Kuma.

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
