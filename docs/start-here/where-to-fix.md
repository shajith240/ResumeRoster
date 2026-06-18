# Where To Fix Things

Use this page when you know the symptom but not the file.

| Symptom | First Place To Look | Why |
| --- | --- | --- |
| Feed layout or cards look wrong | `app/feed/page.tsx`, `components/ResumeFeed.tsx`, `app/globals.css` | The page composes the feed and CSS controls the layout. |
| Resume upload fails | `components/SubmitResumeForm.tsx`, `app/api/resumes/submit/route.ts`, `lib/submit-validation.ts` | Upload starts in the form, then moves through validation and API handling. |
| PDF privacy behaves wrong | `lib/pdf-privacy.ts`, `lib/pdf-redaction.ts`, `components/SecureResumePreview.tsx` | These files control PDF display, redaction, and safe preview behavior. |
| Login or session expires badly | `components/AuthGate.tsx`, `components/AppPresence.tsx`, `lib/auth-session.ts`, `lib/server-auth.ts` | Browser and server session handling are split across these files. |
| Notifications truncate or redirect too fast | `components/TeamNotifications.tsx`, `components/NotificationCenter.tsx`, `lib/notifications.ts` | Inbox display and notification normalization live here. |
| Admin people table or controls break | `components/AdminDashboard.tsx`, `app/api/admin/users/route.ts`, `app/api/admin/actions/route.ts` | Admin UI and server actions coordinate user management. |
| Admin messages fail | `app/api/admin/messages/route.ts`, `lib/admin-messages.ts`, `components/AdminDashboard.tsx` | Validation, API delivery, and dialog UI are separate. |
| Active user count is wrong | `components/AppPresence.tsx`, `lib/app-presence.ts`, Supabase presence migrations | Presence data depends on client heartbeat and database cleanup. |
| Trust or leaderboard values look wrong | `lib/leaderboard-ranking.ts`, `lib/feed-ranking.ts`, related migrations | Ranking logic is shared library code with tests. |
| Database permission denied | relevant `supabase/migrations/*.sql`, `lib/server-auth.ts`, API route | Check RLS policy, server role usage, and route auth. |
| Build fails in CI | `.github/workflows/ci.yml`, `package.json`, failing command output | CI runs docs, tests, typecheck, lint, and build. |
| Docs check fails | `scripts/docs/generate.mjs`, `docs/generated/`, source file changed | Run `npm run docs:generate` and commit generated changes. |

## Debugging Order

1. Reproduce the problem.
2. Find the user journey in this page.
3. Open the generated docs for the likely file.
4. Read the related tests.
5. Make the smallest change.
6. Run the relevant test plus `npm run docs:generate` if source changed.
