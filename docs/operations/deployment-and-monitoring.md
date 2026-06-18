# Deployment And Monitoring

The app is built with Next.js and intended for Vercel-style deployment.

## Build

```bash
npm run build
```

## Monitoring

Sentry or GlitchTip-style monitoring is configured through Sentry files and environment variables.

Relevant files:

- `sentry.server.config.ts`
- `sentry.edge.config.ts`
- `instrumentation.ts`
- `instrumentation-client.ts`
- `next.config.ts`
- [Production operations](../production-ops.md)

## Health Check

`app/api/health/route.ts` provides the readiness endpoint. It checks Supabase
database connectivity, required Storage buckets, the scheduled temporary-data
cleanup cron job, and Web Push delivery configuration. Healthy responses return
HTTP `200`; failed readiness returns HTTP `503` with safe public component
messages.

## Deployment Safety

- Keep source-map upload tokens in environment variables.
- Do not commit production secrets.
- Confirm the full CI quality gate passes before deploy, including coverage,
  browser, accessibility, responsive layout, and performance budget checks.
- Run database dry-run before schema changes.
