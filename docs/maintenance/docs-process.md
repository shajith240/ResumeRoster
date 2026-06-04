# Docs Process

Linted uses a docs-as-code workflow.

## What That Means

- Docs live in the same repo as the app.
- Docs change in the same branch as code.
- Generated docs are checked by CI.
- Manual docs explain intent, decisions, and workflows.
- Generated docs list files, functions, imports, exports, and SQL objects.

## Research Basis

- Google documentation best practices recommend updating docs with code changes and deleting dead documentation.
- GitLab keeps docs in Markdown and emphasizes clear, direct, testable documentation.
- Diataxis separates documentation into tutorials, guides, reference, and concepts.
- TypeDoc and TSDoc support TypeScript API documentation.
- Knip and jscpd support review of unused code and duplicated code.

## Normal Change Flow

1. Change source.
2. Update curated docs if behavior or intent changed.
3. Run `npm run docs:generate`.
4. Run `npm run docs:check`.
5. Run `npm run docs:lint`.
6. Commit source and docs together.

## Where To Put New Docs

- Learning material: `docs/start-here/`.
- Browser and component behavior: `docs/frontend/`.
- API, auth, and server behavior: `docs/backend/`.
- Schema, RLS, migrations, and retention: `docs/database/`.
- Commands, CI, deploy, and monitoring: `docs/operations/`.
- Documentation rules and cleanup process: `docs/maintenance/`.
