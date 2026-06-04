# CI And Docs

CI runs in GitHub Actions from `.github/workflows/ci.yml`.

## Checks

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

The browser tests run with Playwright against the production build through
`npm run start:test`. They mock the CI Supabase URL so auth-protected smoke,
accessibility, and responsive layout checks do not depend on live production
data.

## Why Docs Are In CI

Generated docs can drift when source files change. The CI check forces the
source atlas, manifest, and quality reports to match the current code.

## Fix A Docs Failure

```bash
npm run docs:generate
npm run docs:quality
npm run docs:lint
```

Then commit the generated changes.

## Quality Reports

Run this before committing cleanup work:

```bash
npm run docs:quality
```

It writes enforced reports under `docs/generated/quality/`; CI verifies them
with `npm run docs:quality:check`.

## Browser Gates

Install Chromium once before running browser checks locally:

```bash
npx playwright install chromium
```

Then build and run the focused suites:

```bash
npm run build
npm run test:performance
npm run test:e2e
npm run test:a11y
npm run test:visual
```

`test:visual` is a responsive layout gate. It checks mobile overflow, hidden
desktop-only feed rail content, visible mobile navigation, desktop rail
presence, card containment, and nonblank screenshots.
