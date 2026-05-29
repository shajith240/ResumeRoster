# Linted Security Hardening Baseline

This checklist is the working baseline for the hardening pass. It maps the app's core surfaces to OWASP ASVS-style controls so future feature work has a concrete security contract.

## Sensitive Assets

- Resume PDFs and redacted preview bytes.
- Profile identity fields, contact links, reviewer proof links, and avatar paths.
- Comments, replies, reactions, saves, reports, notifications, and reviewer applications.
- Admin decisions, moderation logs, auth/session state, and the Supabase service role key.

## Attacker Roles

- Anonymous visitor with the public anon key.
- Signed-in user trying to access another user's private data.
- Resume owner attempting invalid self-review, vote, or report actions.
- Reviewer/trusted reviewer with no admin rights.
- Admin user performing moderation actions.
- Malicious uploader submitting malformed PDFs/images.
- Compromised browser token.

## Access Matrix

| Surface | Intended Access |
| --- | --- |
| `resumes` rows | Signed-in users can read visible open/closed rows; owners can read their own rows. |
| Resume PDF storage | Direct Storage reads are owner-only. Other previews go through `/api/resumes/[id]/file` after auth and visibility checks. |
| `roasts` | Signed-in users can read visible thread comments and create feedback only on open eligible resumes. |
| `votes` | Users can read/change only their own votes; DB triggers maintain counters. |
| `saved_resumes` | Users can read/write only their own saves. |
| `content_reports` | Private table; users report through `report_content`, admins read through service-role API routes. |
| `reviewer_applications` | Private table; user submission and admin review use transactional service-role RPCs. |
| `notifications` | Users can read/mark only their own notifications; triggers create rows transactionally. |
| `comment_attachments` | Authenticated users can read attachment metadata; files are public image assets only. |
| Admin APIs | Bearer token verified server-side, then email allowlist checked before service-role access. |

## Required Verification

- Run `npm run test`, `npm run typecheck`, `npm run lint`, and `npm run build` for every hardening change.
- Run `npm run db:push:dry` whenever migrations change.
- Add focused tests for validators, privacy URL handling, upload rejection, notification isolation, and RLS/storage behavior as those surfaces change.
- Never expose raw Supabase, storage, or service-role errors to clients; log details server-side and return stable product copy.
