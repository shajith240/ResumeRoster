# Code Quality Reports

These reports are generated artifacts. CI checks that they are fresh so dead-code and duplicate-code findings cannot drift silently.

- [Knip dead-code report](knip-report.md)
- [jscpd duplicate-code report](jscpd-report.md) for active app/source drift
- [jscpd migration-history duplicate-code report](migration-history-jscpd-report.md) for informational Supabase migration audits

Use these reports to decide what to clean in a separate maintenance pass. Do not rewrite applied migrations only to reduce duplicate-code percentages.
