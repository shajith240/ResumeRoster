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
  - Vercel Cron every hour → `GET /api/cron/expire-claims` (protected by CRON_SECRET)
  - Un-assigns reviewer, sets payment_status='refunded', then calls Razorpay refund API
  - Refund failures logged to Sentry individually for manual recovery
  - Migration: `20260619000000_expire_claimed_premium_resumes.sql`
  - ⚠️ Requires env var: CRON_SECRET (set in Vercel dashboard)

- [ ] **Razorpay webhook reliability**
  - `payment_status` stays `'pending'` until webhook fires — if it fails/delays, resume is stuck and no reviewer can claim it
  - Need: webhook signature validation confirmed, idempotency on `payment_id`, retry logs
  - Add a fallback: if `payment_status='pending'` for > 10 min after order creation, auto-poll Razorpay API to check status
  - File: `app/api/webhooks/razorpay/route.ts`

- [ ] **User account deletion endpoint**
  - Indian IT Act requires this
  - `DELETE /api/account/delete` — deletes auth user, anonymises all their content, removes PII from profiles
  - Soft-delete pattern: set `profiles.deleted_at`, redact `full_name/email/avatar`, disable `auth.users`
  - Also delete all their stored PDFs from storage bucket

- [ ] **Audit log table**
  - No way to trace who deleted a user, removed a post, changed a reviewer status
  - New table: `audit_log (id, actor_id, action, target_type, target_id, metadata jsonb, created_at)`
  - Log: user suspension, deletion, reviewer approve/reject, premium refund, post removal
  - Admin-only readable via service_role

---

## 🟠 High — should fix before real traffic

- [ ] **Community Markdown XSS**
  - Posts and comments render Markdown but HTML is not sanitized
  - Install `dompurify` or add a remark/rehype sanitize plugin to the post renderer
  - Test: post `<script>alert(1)</script>` and confirm it's escaped

- [ ] **In-app refund request flow**
  - Users who want refunds currently have no UI — have to email
  - Add "Request refund" button on resume detail (only visible to owner, only if `is_premium && payment_status='paid' && assigned_reviewer_id IS NULL`)
  - Route: `POST /api/resumes/[id]/refund-request`
  - Admin sees refund requests in dashboard and triggers Razorpay refund

- [ ] **Structured premium review template**
  - Right now a ₹199 verified reviewer can post the same casual comment as a free user
  - When `resume.is_premium && resume.assigned_reviewer_id === currentUser.id`, show a 5-field structured form:
    1. Overall impression (1–5 rating + text)
    2. Clarity & formatting feedback
    3. Impact statements — what's weak
    4. Skills & keywords gap
    5. Top 3 actionable changes
  - Store as JSON in a new `premium_reviews` table (linked to roast_id)

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
2. Razorpay webhook reliability audit
3. User account deletion
4. Audit log table
5. Community Markdown XSS fix
6. In-app refund request UI
7. Structured premium review template
8. Reviewer deadline push notifications
9. Email system (Resend)
10. Reviewer payout tracking
11. Reviewer strike system
12. Resume versioning
13. Admin premium controls panel
14. Everything in 🔵 Low after the above
