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

- [ ] **Reviewer deadline push notifications**
  - At 12h and 20h before `review_deadline`, send a push notification to the assigned reviewer
  - Need: Vercel Cron or pg_cron job every hour checking approaching deadlines
  - Use existing web push infra (`web_push_subscriptions` + `/api/push/dispatch`)

- [ ] **Stale push subscription pruning**
  - `web_push_subscriptions` grows forever, stale endpoints cause silent failures
  - Cron: delete subscriptions where `last_used_at < now() - interval '30 days'`
  - Or: delete on 410 Gone response from push service

- [ ] **IP-level rate limiting**
  - Current rate limits are per-user — bots can create accounts and spam
  - Add Vercel Edge middleware rate limiting by IP on `/api/resumes/submit` and `/api/payments/create-order`
  - Use `@vercel/kv` or Upstash Redis for sliding window counter

---

## 🟡 Medium — important features missing

- [ ] **Email notifications system**
  - Nothing sends email today — no welcome, no "your resume got reviewed", no refund confirmation
  - Pick a provider: Resend or AWS SES (both work with Next.js)
  - Emails needed:
    - Welcome / onboarding complete
    - "Your resume received a new review"
    - Reviewer: "You've been assigned a priority resume — 24h clock started"
    - Reviewer: "12h left to submit your review"
    - Candidate: "Refund issued — reviewer missed deadline"
    - Admin: daily digest of new reviewer applications

- [ ] **Reviewer payout / incentive tracking**
  - Verified reviewers do paid work (₹199 reviews) but earn nothing and there's no tracking
  - New table: `reviewer_payouts (id, reviewer_id, resume_id, amount, status, payout_ref, created_at)`
  - Admin dashboard: show total owed per reviewer, mark as paid
  - Decide payout model first (flat fee per review? percentage? store credit?)

- [ ] **Reviewer strike system**
  - Reviewers who claim and miss deadlines repeatedly should be flagged
  - Track: `profiles.reviewer_missed_count` — increment on each expired claim
  - At 2 misses: warning email + admin alert
  - At 3 misses: auto-suspend premium claiming ability (not full reviewer status)

- [ ] **Resume versioning**
  - Once a resume is submitted, it can't be updated
  - Candidates iterate on resumes based on feedback — need to re-upload
  - Options: (a) allow PDF re-upload on existing resume row, (b) create v2 as a new linked resume
  - Simpler: add "Replace PDF" button on own resume detail → `PATCH /api/resumes/[id]/replace-pdf`

- [ ] **Admin: premium controls panel**
  - Need a "Premium" tab in admin dashboard showing:
    - All premium resumes (status, payment_status, claimed/unclaimed, deadline)
    - Manual refund trigger per resume
    - Manual assign reviewer (override)
    - Payout queue per reviewer

- [ ] **Leaderboard caching**
  - Leaderboard query runs on every page load — no cache
  - Cache with `next/cache` or Vercel KV with 1h TTL
  - Invalidate on each helpful vote via `revalidateTag('leaderboard')`

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
8. Reviewer deadline push notifications
9. Email system (Resend)
10. Reviewer payout tracking
11. Reviewer strike system
12. Resume versioning
13. Admin premium controls panel
14. Everything in 🔵 Low after the above
