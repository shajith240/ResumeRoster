# Future Codex Instructions

Use this page when starting a future Codex session.

## Required Behavior

- Read the relevant curated docs before changing code.
- Use the generated source atlas to locate files and functions.
- Do not revert unrelated user changes.
- Do not edit generated docs by hand.
- Run `npm run docs:generate` after source changes.
- Run `npm run docs:check` and `npm run docs:lint` before finishing documentation work.
- Treat Knip and jscpd results as review reports, not automatic deletion orders.

## Good Prompt To Resume Work

```text
Read docs/README.md and docs/generated/source-atlas.md first.
Then inspect the files related to my request.
Keep docs updated with any code changes.
Do not revert unrelated local changes.
```
