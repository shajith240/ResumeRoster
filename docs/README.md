# Linted Documentation Bible

This folder is the operating manual for Linted. It is written for two readers:

- A student founder who needs to understand the product without already knowing the code.
- A future engineer or Codex session that needs to change the app without guessing.

The rule for this documentation is simple: if the code changes, the docs change in the same pull request.

## How To Read This

Start here if you are new:

1. Read [Start Here](start-here/README.md).
2. Use [Where To Fix Things](start-here/where-to-fix.md) when something breaks.
3. Open the [Generated Source Atlas](generated/source-atlas.md) when you need file-by-file and function-level detail.
4. Read the domain guide for the area you are editing.

## Documentation Map

- [Start Here](start-here/README.md): plain-English product and code map.
- [Frontend](frontend/README.md): pages, components, UI rules, and browser behavior.
- [Backend](backend/README.md): API routes, auth, notifications, admin flows, and server logic.
- [Database](database/README.md): Supabase schema, migrations, RLS, storage, and retention questions.
- [Operations](operations/README.md): setup, CI, deploy, monitoring, and troubleshooting.
- [Maintenance](maintenance/README.md): how to keep this documentation fresh.
- [Generated](generated/source-atlas.md): auto-generated inventory of source files and functions.

## Existing Policy And Reference Docs

These documents still matter and are linked from the relevant guides:

- [Production operations](production-ops.md)
- [Database naming map](database-naming-map.md)
- [PDF privacy modes](pdf-privacy-modes.md)
- [Community guidelines](community-guidelines.html)
- [Privacy policy](privacy-policy.html)
- [Terms of service](terms-of-service.html)
- [Copyright takedown policy](copyright-takedown-policy.html)

## What Is Generated

The source atlas under `docs/generated/` is rebuilt by:

```bash
npm run docs:generate
```

CI checks it with:

```bash
npm run docs:check
npm run docs:lint
```

Generated pages are intentionally mechanical. Use them to find files, functions, imports, exports, SQL objects, and related tests. Put explanations, tutorials, and decisions in the curated folders.

## Documentation Principles

- Keep the docs in the repo so they version with the code.
- Prefer small pages that answer one job clearly.
- Update docs with the code change that makes them necessary.
- Delete or rewrite dead docs instead of preserving confusing history.
- Do not document secrets, tokens, private user data, or production-only credentials.
