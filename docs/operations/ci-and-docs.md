# CI And Docs

CI runs in GitHub Actions from `.github/workflows/ci.yml`.

## Checks

- `npm run test`
- `npm run docs:check`
- `npm run docs:lint`
- `npm run typecheck`
- `npm run lint`
- `npm run build`

## Why Docs Are In CI

Generated docs can drift when source files change. The CI check forces the source atlas and manifest to match the current code.

## Fix A Docs Failure

```bash
npm run docs:generate
npm run docs:lint
```

Then commit the generated changes.

## Quality Reports

Run this manually when reviewing cleanup work:

```bash
npm run docs:quality
```

It writes review-only reports under `docs/generated/quality/`.
