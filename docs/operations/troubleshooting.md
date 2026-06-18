# Troubleshooting

## JWT Expired

Usually means the Supabase auth token expired. Browser code should refresh the session and retry safe requests. Check [Auth and Sessions](../backend/auth-and-sessions.md).

## Permission Denied

Check three layers:

1. API route auth guard.
2. Supabase RLS policy.
3. Whether the code is using browser anon key or server service role.

## Build Fails

Run the failing command locally:

```bash
npm run typecheck
npm run lint
npm run build
```

## Docs Check Fails

Run:

```bash
npm run docs:generate
npm run docs:check
```

## UI Looks Broken

Find the feature file from [Where To Fix Things](../start-here/where-to-fix.md), then inspect CSS in `app/globals.css` or the component module CSS.
