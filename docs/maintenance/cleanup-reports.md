# Cleanup Reports

Cleanup reports help identify unused files, unused exports, unused dependencies, and duplicated code.

## Command

```bash
npm run docs:quality
```

## Outputs

- `docs/generated/quality/knip-report.md`
- `docs/generated/quality/jscpd-report.md`
- `docs/generated/quality/migration-history-jscpd-report.md`

## Policy

Reports are review-only in V1. They do not delete files automatically.

The active jscpd report excludes `supabase/migrations/**` so duplicate-code
cleanup stays focused on live app and automation source. Historical Supabase
migration duplication remains visible in the migration-history report, but
applied migrations must not be rewritten just to improve a metric.

## How To Use Findings

1. Confirm the finding is real.
2. Check dynamic imports, Next.js conventions, Supabase SQL, tests, and assets.
3. Create a separate cleanup change.
4. Run tests, typecheck, lint, build, and docs checks.
5. Document any intentional duplicates or legacy files.
