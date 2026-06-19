# Production Whiteboard
<!-- Living doc — update status as items are completed. Never delete rows, only mark done. -->
<!-- Status: [ ] not started · [~] in progress · [x] done -->

Last updated: 2026-06-19

---

## How to use this file

- Work top to bottom within each priority tier
- Update `[~]` when you start a task, `[x]` when merged and verified
- Add notes under items as you go (keep them short — link PRs/commits)

---

## 🔴 Critical — cannot ship without these

- [x] **Auto-refund + reviewer deadline enforcement**
  - RPC `expire_claimed_premium_resumes()` — atomic CTE with FOR UPDATE SKIP LOCKED
  - Vercel Cron daily at midnight UTC → `GET /api/cron/expire-claims` (protected by CRON_SECRET)
  - ⚠️ Changed from hourly to daily — Vercel Hobby plan max is once per day
  - Un-assigns reviewer, sets payment_status='refunded', then calls Razorpay refund API
  - Refund failures logged to Sentry individually for manual recovery
  - Migration: `20260619000000_expire_claimed_premium_resumes.sql`
  - ⚠️ Requires env var: CRON_SECRET (set in Vercel dashboard)

- [x] **Razorpay webhook reliability**
  - Webhook HMAC (SHA-256, RAZORPAY_WEBHOOK_SECRET): ✅ already correct
  - Idempotency on payment_id + order_id: ✅ unique constraints + WHERE guard
  - Fixed stuck-pending: `create_premium_resume` now sets `payment_status='paid'` at insert time — HMAC in verify route proves capture. Webhook is now a no-op backup, not the sole path to claimability.
  - Fixed timing-attack: both signature comparisons now use `timingSafeEqual` via `safeCompareHex`
  - Migration: `20260619100000_fix_premium_resume_payment_status.sql`

- [x] **User account deletion endpoint**
  - Indian IT Act requires this
  - `DELETE /api/account/delete` — reuses existing `admin_delete_user_app_data` RPC
  - Hard-deletes: resumes, roasts, votes, sessions, subscriptions, onboarding, notifications
  - Storage cleanup: resumes/, avatars/, comment-media/, community-post-media/ buckets
  - Permanently deletes auth.users record (cascades profile deletion)
  - Idempotent: safe to retry; audit trail written to moderation_actions
  - File: `app/api/account/delete/route.ts`

- [x] **Audit log table**
  - `moderation_actions` already serves as the audit log (id, admin_user_id, action, target_type, target_id, metadata jsonb, created_at)
  - Already covers: user deletion, reviewer approve/reject, content moderation, post removal
  - Gap closed: cron-issued refunds now logged as `premium_refund_issued` / `premium_refund_failed` in moderation_actions
  - Admin-only: table is service_role readable only, no public RLS policy

---

## 🟠 High — should fix before real traffic

- [x] **Community Markdown XSS**
  - Already safe: ReactMarkdown without rehype-raw renders raw HTML as escaped text, not DOM
  - `getSafeHref` blocks javascript: URLs on links; `getSafeImageSrc` only allows http/https/inline IDs
  - `dangerouslySetInnerHTML` is only used for hljs.highlight() output, which escapes all HTML entities
  - No dompurify needed — react-markdown's virtual DOM output cannot inject scripts

- [x] **In-app refund request flow**
  - "Request refund" button in resume owner view: visible only when `is_premium && payment_status='paid' && assigned_reviewer_id IS NULL`
  - Route: `POST /api/resumes/[id]/refund-request` — atomic DB update guards against race with claim, then issues Razorpay refund directly
  - Failed Razorpay calls logged as `premium_refund_failed` in moderation_actions for manual recovery
  - Files: `app/api/resumes/[id]/refund-request/route.ts`, `components/resume-detail/dialogs.tsx`, `components/resume-detail/discussion-panel.tsx`

- [x] **Structured premium review template**
  - When assigned reviewer views a premium resume: shows 5-field structured form instead of regular composer
  - Fields: overall rating (1–5 stars) + 4 text sections (clarity, impact, skills gap, top changes)
  - On submit: formats as Markdown + inserts roast (visible in thread) + stores raw data in `premium_reviews` table
  - Migration: `20260619110000_premium_review_structured_form.sql`
  - Files: `app/api/resumes/[id]/premium-review/route.ts`, `components/resume-detail/premium-review-composer.tsx`

- [x] **Reviewer deadline push notifications**
  - pg_cron job `linted-reviewer-deadline-reminders` runs every hour (top of hour)
  - Two windows: 12h warning + 4h urgent warning before `review_deadline`
  - `send_reviewer_deadline_reminders()` inserts into `notifications` (type=`reviewer_status`)
  - Supabase DB webhook fires `/api/push/dispatch` on each INSERT → sends web push
  - Dedup via `(recipient_id, dedupe_key)` unique index — no double-sends on overlap
  - Migration: `20260619120000_reviewer_deadline_reminders_cron.sql`
  - Runs inside Supabase Postgres — Vercel Hobby cron limit does not apply

- [x] **Stale push subscription pruning**
  - pg_cron job `linted-prune-push-subscriptions` runs daily at 03:00 UTC
  - Deletes subscriptions where `revoked_at IS NOT NULL` or `last_seen_at < now() - 30 days`
  - Migration: `20260619150000_prune_stale_push_subscriptions.sql`
  - Runs inside Supabase Postgres — Vercel Hobby cron limit does not apply

- [ ] **IP-level rate limiting**
  - Current rate limits are per-user — bots can create accounts and spam
  - Add Vercel Edge middleware rate limiting by IP on `/api/resumes/submit` and `/api/payments/create-order`
  - Use `@vercel/kv` or Upstash Redis for sliding window counter

---

## 🟡 Medium — important features missing

- [x] **Email notifications system (Resend)**
  - Provider: Resend (`resend` npm package). Requires `RESEND_API_KEY` + optional `EMAIL_FROM` env vars.
  - Emails implemented (all fire-and-forget, non-blocking):
    - Reviewer: "You've been assigned a priority resume" — wired in `POST /api/resumes/[id]/claim`
    - Reviewer approved/rejected by admin — wired in `POST /api/admin/reviewers/[id]/action`
    - Candidate: "Refund issued" — wired in both the user refund route and the cron auto-refund
    - Candidate: "Priority review received" — wired in `POST /api/resumes/[id]/premium-review`
    - Reviewer: "12h left" + "4h left" deadline reminders — sent in `/api/push/dispatch` webhook when pg_cron inserts deadline notification rows (detected by `dedupe_key` prefix)
  - Files: `lib/email/client.ts`, `lib/email/send.ts`, `lib/email/templates.ts`
  - ⚠️ Requires env vars: `RESEND_API_KEY`, `EMAIL_FROM` (default: `noreply@resumeroster.in`)
  - ⚠️ Resend free tier uses `@resend.dev` domain — add and verify a custom domain before launch

- [x] **Reviewer payout / incentive tracking**
  - `reviewer_payouts` table: id, reviewer_id, resume_id, amount_paise, status (pending/paid), payout_ref, paid_by, paid_at
  - Default payout: ₹99 per review (9900 paise) — auto-inserted when `POST /api/resumes/[id]/premium-review` succeeds
  - Unique index on (resume_id, reviewer_id) prevents double-payouts
  - `GET /api/admin/payouts?status=pending` — grouped by reviewer, sorted by amount owed
  - `POST /api/admin/payouts/[id]` — atomically marks single payout paid with optional UPI ref
  - Admin "Premium" tab at `/admin/premium` shows pending payout queue with inline "Mark paid" + ref field
  - Migration: `20260619130000_reviewer_payouts.sql`

- [x] **Reviewer strike system**
  - `profiles.reviewer_missed_count` (integer, default 0) + `reviewer_claim_suspended` (boolean, default false)
  - Cron route increments `reviewer_missed_count` for each expired reviewer after auto-refund
  - At count=2: sends "missed deadline warning" email (one more miss suspends)
  - At count=3: sets `reviewer_claim_suspended=true` + sends suspension email
  - `claim_premium_resume` RPC rejects with clear message if suspended; verified status unaffected
  - Migration: `20260619140000_reviewer_strike_system.sql`

- [x] **Resume versioning**
  - "Replace PDF" button in owner view (shown only to resume owner on open resumes)
  - Hidden `<input type="file">` triggers immediately on selection — no dialog
  - `PATCH /api/resumes/[id]/replace-pdf` — validates, security-scans, redacts with existing privacy_mode, uploads to storage, updates `file_path`, removes old file (best-effort)
  - Signed URL cleared after replace so the preview auto-reloads
  - Files: `app/api/resumes/[id]/replace-pdf/route.ts`, `components/resume-detail/resume-preview-pane.tsx`

- [x] **Admin: premium controls panel**
  - `/admin/premium` — two sub-panels via segmented tabs: "Resumes" and "Payouts"
  - Resumes panel: lists all premium resumes with candidate, reviewer, deadline, payment_status; filter by status
    - "Force refund": updates DB + issues Razorpay refund + emails candidate + audit logs
    - "Assign reviewer": UUID input + button, validates reviewer is verified, assigns with 24h deadline
  - Payouts panel: pending/paid tabs, per-reviewer grouping with "Mark paid" + UPI ref (built in Item 10)
  - API: `GET /api/admin/premium-resumes`, `POST /api/admin/premium-resumes/[id]` (force_refund / assign_reviewer)

- [x] **Leaderboard caching**
  - All DB queries moved to `GET /api/leaderboard?range=week|month|all` (server route)
  - Route uses `unstable_cache` with 1h TTL and `leaderboard` tag (separate cache per range)
  - Directory also cached with `leaderboard` tag — `revalidateTag('leaderboard')` clears both
  - Client component calls the route, then overlays `applyOnlinePresence` client-side
  - Realtime subscription still present for eventual consistency
  - Files: `app/api/leaderboard/route.ts`, `components/Leaderboard.tsx`

---

## 🔵 Low — polish and nice-to-have

- [ ] **User data export**
  - `GET /api/account/export` — returns a ZIP of their resumes (PDFs), reviews they wrote, community posts, profile JSON
  - Async: queue the export, email a download link when ready

- [ ] **Resume status notifications**
  - Candidate gets push/email when: first review posted, 5th review posted, resume closed
  - Use existing push infra

- [ ] **Mention notifications**
  - If someone @mentions a user in a review or community comment, notify them
  - Table: `notifications (id, user_id, type, actor_id, target_type, target_id, read_at, created_at)`
  - Show notification bell in nav with unread count

- [ ] **Candidate "close feedback" UX improvement**
  - Currently "Close feedback" just locks the thread — candidate gets no summary
  - On close: auto-generate a summary card ("You received 7 reviews, most focused on XYZ")

- [ ] **Community: topic-based email digest**
  - Weekly digest of top posts per topic, opt-in
  - Resend batch send, user preference toggle in profile settings

---

## ✅ Already done — confirmed working

- [x] Auth + single-session lock per user
- [x] Onboarding wizard (goal + persona → sets community_role, reviewer_type)
- [x] Resume submission (free) — PDF upload, redaction, privacy modes
- [x] Razorpay ₹199 payment (create-order → verify HMAC → create premium resume)
- [x] Premium badge on feed cards (metallic gold shimmer)
- [x] Premium pinned to top of New sort only
- [x] Claim button on resume detail (verified reviewers only, specific error messages)
- [x] `claim_premium_resume` RPC with per-condition error reasons
- [x] Reviewer application flow from profile page
- [x] Admin approves/rejects reviewer applications → blue tick
- [x] Reviewer hub (`/reviewer`) with countdown timer (active / completed / expired)
- [x] Reviewer hub nav link (sidebar only, verified reviewers only)
- [x] Community posts, comments, polls, moderation
- [x] RLS on all tables + recent security hardening (migration 0075)
- [x] Rate limiting per user on key actions
- [x] Sentry error monitoring + health check endpoint
- [x] Web push subscriptions infrastructure
- [x] Admin dashboard (users, reports, reviewer applications, content moderation)
- [x] Feed (best/new/needs-review sorts)
- [x] Leaderboard
- [x] Profile pages with edit, report, verified badge

---

## Deferred / blocked items

- [ ] **Sentry setup** — package is installed and `capturePrivateError` is wired everywhere,
  but DSN is not configured. Safe for now (Sentry SDK silently no-ops without a DSN).
  Do this before launch: create project at sentry.io → add `SENTRY_DSN` env var → run
  `npx @sentry/wizard@latest -i nextjs` to wire `sentry.client.config.ts` etc.
  **Do not start the email / notification items until Sentry is live** — those are the
  highest-value alert surfaces.

---

## Order of work (agreed sequence)

1. ~~Auto-refund + deadline enforcement cron~~ ✅ done
2. ~~Razorpay webhook reliability~~ ✅ done
3. ~~User account deletion~~ ✅ done
4. ~~Audit log table~~ ✅ done (moderation_actions already serves this)
5. ~~Community Markdown XSS fix~~ ✅ already safe (ReactMarkdown + hljs escape)
6. ~~In-app refund request UI~~ ✅ done
7. ~~Structured premium review template~~ ✅ done
8. ~~Reviewer deadline push notifications~~ ✅ done
9. ~~Email system (Resend)~~ ✅ done
10. ~~Reviewer payout tracking~~ ✅ done
11. ~~Reviewer strike system~~ ✅ done
12. ~~Resume versioning~~ ✅ done
13. ~~Admin premium controls panel~~ ✅ done
14. Everything in 🔵 Low after the above
