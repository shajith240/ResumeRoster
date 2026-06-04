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

`app/api/health/route.ts` provides a simple health endpoint.

## Deployment Safety

- Keep source-map upload tokens in environment variables.
- Do not commit production secrets.
- Confirm CI passes before deploy.
- Run database dry-run before schema changes.
