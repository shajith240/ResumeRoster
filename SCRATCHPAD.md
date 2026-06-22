# SCRATCHPAD

Living notebook. Update whenever a decision is made, a task is completed, or something is discovered.

---

## Active Issues

### 🚨 P0 — Payment bugs (real money at risk)

- [x] **ORPHAN PAYMENT** — `app/api/payments/verify/route.ts` verifies HMAC then runs mupdf redaction → storage upload → `create_premium_resume` RPC in sequence. Razorpay already captured ₹199 before we're called. If redaction throws (422) or storage upload fails (500), the user is charged with no resume row in DB and no way to self-refund (refund-request requires a resume row). Fix: if the RPC insert fails or file upload fails after a confirmed capture, immediately issue a Razorpay refund using the `razorpayPaymentId` already in scope before returning the error response. Add a `premium_refund_issued` audit log entry.

- [x] **DEADLINE NOT CHECKED IN REVIEW SUBMISSION** — `app/api/resumes/[id]/premium-review/route.ts` checks `payment_status='paid'`, `assigned_reviewer_id`, and `status='open'` but **not** `review_deadline > now()`. A reviewer can submit 1–23 hours past their deadline (before the midnight cron fires). Result: review posts + payout inserted, then cron refunds the candidate. User gets review + full refund; reviewer gets no payout. Fix: add `if (resume.review_deadline && new Date(resume.review_deadline) < new Date())` → 409 before the roast insert.

- [x] **ADMIN ASSIGN_REVIEWER SENDS NO EMAIL** — `app/api/admin/premium-resumes/[id]/route.ts` action `assign_reviewer` writes to DB and audit log but never notifies the reviewer. They have a 24h clock running with zero awareness. Fix: send `reviewerAssigned(resumeId)` email after the DB update, mirroring what the user claim route does.

---

### ⚠️ P1 — Ops blockers (ship is dead without these)

- [x] **SENTRY DSN NOT CONFIGURED** — Resolved: Sentry project created, SENTRY_DSN set in Vercel. All capturePrivateError() calls now active in production.

- [ ] **RESEND DOMAIN NOT VERIFIED** — `lib/email/templates.ts` sends from `resumeroster.in`. Without DNS verification in Resend, emails come from `@resend.dev`. Users see "resend.dev assigned your reviewer" — this looks like a phishing attempt and will hit spam. Add MX/DKIM records in Resend dashboard before any real traffic.

- [x] **RAZORPAY WEBHOOK NOT REGISTERED** — Webhook registered at `https://linted.space/api/webhooks/razorpay`, Enabled, 12 events. RAZORPAY_WEBHOOK_SECRET set in Vercel. Also fixed: webhook now saves payment_id on payment.captured so browser-close payments are refundable.

- [x] **CSP: VERIFY RAZORPAY CHECKOUT.JS LOADS WITH NONCE** — Verified correct. `loadRazorpayScript()` in `components/SubmitResumeForm.tsx` uses `document.createElement('script')` — dynamic scripts created by a nonce-trusted parent (the React bundle) inherit trust via `strict-dynamic`. Root layout calls `headers()` to stay dynamic so Next.js propagates the nonce. `frame-src` and `connect-src` cover the checkout iframe and API calls. No code change needed.

- [ ] **SET ALL ENV VARS IN VERCEL** — required before launch:
  - `CRON_SECRET` (protects `/api/cron/expire-claims`)
  - `RAZORPAY_KEY_SECRET`
  - `RAZORPAY_WEBHOOK_SECRET`
  - `NEXT_PUBLIC_RAZORPAY_KEY_ID`
  - `RESEND_API_KEY`
  - `EMAIL_FROM` (default: `Linted <noreply@linted.space>` — set to the verified Resend sender once DNS propagates)
  - `SENTRY_DSN`

- [ ] **RUN FULL RAZORPAY SANDBOX E2E TEST** — with test keys, exercise the entire flow before switching to live keys: pay → verify creates resume → reviewer claims → reviewer submits review (check payout row) → user refund request → cron expire-claims with sandbox payment ID → admin force-refund. Document pass/fail per step. Steps 1 (payment) ✅ and 2 (webhook) ✅ passed. Steps 3–7 pending.

---

### 🟠 P2 — Queue bugs (fixed 2026-06-22)

- [x] **DELETE-AND-REUPLOAD BYPASSES GUIDED REVIEW QUEUE** — `create_resume_with_review_queue` RPC called `recalculate_guided_review_queue` unconditionally on every upload. Earned credits from previous resumes (still in `roasts`) were re-applied to the new resume → immediately active. Fixed in migration `20260622_fix_queue_credit_bypass.sql`: check `has_viable_resumes` (waiting resumes that this user hasn't yet guided-reviewed) before deciding status. If viable resumes exist → hold new resume in 'waiting'. If none → promote to 'active'.

- [x] **PRIYA WIDGET CELEBRATION STATE MISSING** — Widget returned `null` when `review_queue_status` changed to 'active' (no more 'waiting' resume to track). Fixed in `ResumeQueueProgress.tsx`: added `celebrating` state + `wasWaitingRef` / `hasInitialLoadedRef` to detect the 'waiting'→'active' transition via both realtime payload and DB query diff. Celebration auto-dismisses after 8s.

- [x] **WIDGET NOT UPDATING LIVE** — 120ms debounce + round-trip query introduced noticeable lag. Fixed: realtime handler now parses `payload.new` directly and calls `setProgress` immediately (instant optimistic update). Background refresh still runs after 80ms to confirm server state. Realtime also detects `review_queue_status = 'active'` in the payload to trigger celebration without waiting for the query.

---

### 🟠 P2 — Functional correctness issues

- [x] **STRIKE COUNTER IS READ-MODIFY-WRITE** — Fixed: `increment_reviewer_missed_count(uuid)` RPC in migration `20260620000000` atomically increments + applies suspension in a single `UPDATE...RETURNING`. Cron route now calls `.rpc("increment_reviewer_missed_count", ...)` — no read-modify-write.

- [x] **VERIFY SELF-CLAIM GUARD IN `claim_premium_resume` RPC** — Confirmed: `and user_id <> p_reviewer_id` at line 51 of migration `20260619140000_reviewer_strike_system.sql`. Guard exists; no code change needed.

- [ ] **CLAIM EXPIRY IS ONCE PER DAY (NOT HOURLY)** — `vercel.json` schedules `expire_claimed_premium_resumes` at `0 0 * * *` (midnight UTC, Hobby plan max). A reviewer who misses a 24h deadline can leave a candidate waiting up to 23 hours before the cron fires. Fix (free tier path): pg_cron inside Supabase runs hourly (like the deadline-reminder job already does). pg_cron cannot call Razorpay directly, so the split: (1) pg_cron atomically marks expired resumes as `payment_status='expiry_pending'` + un-assigns reviewer, (2) a Supabase DB webhook fires `/api/cron/expire-claims` for each `expiry_pending` row → Vercel route issues the Razorpay refund + sends emails + increments strike. The Vercel daily cron stays as a reconciliation safety net.

- [x] **NO ADMIN UI FOR FAILED REFUNDS** — Added: `/api/admin/failed-refunds` endpoint queries `moderation_actions` where `action='premium_refund_failed'`. Admin premium panel now has a third "refunds" tab (`FailedRefundsPanel`) with per-row "Retry refund" button. Button calls new `retry_refund` action in `/api/admin/premium-resumes/[id]` which issues the Razorpay refund via `payment_id` on the resume without re-checking `payment_status`.

- [x] **NO REVIEWER UNSUSPEND ACTION** — Added: `unsuspend_reviewer` action in `/api/admin/users/[id]/action` sets `reviewer_claim_suspended=false, reviewer_missed_count=0`. Admin reviewers page now shows a "Suspended Reviewers" section (fetched from `/api/admin/suspended-reviewers`) with per-row "Unsuspend" button calling `runUserAction(userId, 'unsuspend_reviewer')`.

- [x] **REFUND BUTTON VISIBLE BEFORE ANY REVIEWER CLAIMED** — Fixed: `isRefundable` in `use-resume-detail-controller.ts` now requires `resume.created_at < now() - 1h`. Button is hidden immediately after payment; appears only after 1 hour with no reviewer claim, giving reviewers a fair window.

---

### 🟠 P3 — IP Rate Limiting (from whiteboard, still open)

- [ ] **IP-LEVEL RATE LIMITING** — `/api/resumes/submit` and `/api/payments/create-order` are per-user only. A bot farm that creates accounts can flood the resume feed or generate abandoned Razorpay orders. Use **Upstash Redis free tier** (10k commands/day, no Vercel plan required — Vercel KV requires Pro, do not use it). Add sliding window counter at Edge Middleware by IP. Targets: submit ≤ 3/hour/IP, create-order ≤ 5/hour/IP. Fail open (don't block if Redis is unavailable).

---

### 🟡 P4 — UX gaps that will generate support tickets

- [ ] **CANDIDATE DOESN'T SEE REVIEW DEADLINE** — After a reviewer claims, `review_deadline` is set but not shown to the candidate. They paid ₹199 and have no idea if they'll get a review in 2 hours or 20. Show the deadline on the resume detail page in the "claimed" state with a human-readable countdown.

- [ ] **NO REVIEWER UNCLAIM PATH** — A verified reviewer who clicks "Claim" on the wrong resume is locked in for 24h or eats a strike. Add a 15-minute unclaim window: `POST /api/resumes/[id]/unclaim` with guard `premium_claimed_at > now() - interval '15 minutes'`. After 15 minutes, unclaiming costs a strike (reviewer accepted responsibility).

- [ ] **`payment=()` IN PERMISSIONS-POLICY** — `Permissions-Policy: payment=()` disables the Payment Request API for all frames. Razorpay's iframe-based checkout may not need it, but this should be explicitly tested. If checkout breaks: change to `payment=(self "https://checkout.razorpay.com")`.

---

### 🟠 P4b — Free tier operational risks

- [ ] **VERCEL SERVERLESS TIMEOUT (10s on Hobby)** — `app/api/payments/verify/route.ts` runs mupdf redaction + storage upload inside a single serverless invocation. A complex or large PDF could exceed the 10-second limit, returning a 504 to the client with no resume created (and payment already captured — this compounds the orphan-payment P0 bug). Measure actual redaction time in dev across various PDF sizes. If it's close to the limit, move redaction to a background job or stream the upload separately. Do not upgrade to Pro just for this — measure first.

- [ ] **SUPABASE FREE TIER DB PAUSE (7 days inactivity)** — Supabase pauses the database after 7 days of no activity. If traffic is sparse post-launch, a paused DB adds a 5–10s cold start on the first request. The pg_cron jobs (deadline reminders, push pruning) keep the DB active as long as they run, but confirm this is sufficient. If not, add a trivial `SELECT 1` pg_cron job running daily as a keep-alive.

- [ ] **RESEND FREE TIER CAP (100 emails/day)** — If a burst of claims, refunds, or reviewer assignments happens on a single day, you can hit the 100/day limit. Monitor after launch. The 3,000/month cap is unlikely to be hit early but the daily cap is real. If hit: Resend queues and drops — candidates won't get refund confirmations. No action needed now but watch the Resend dashboard.

---

### 🔵 P5 — Low / polish (from whiteboard)

- [ ] User data export — `GET /api/account/export` (ZIP of PDFs + reviews + posts + profile JSON, async with email link)
- [ ] Resume status notifications — push/email when first review posted, 5th review, resume closed
- [ ] Mention notifications — @user in review or comment → notification bell with unread count
- [ ] Candidate close-feedback UX — auto-generate summary card on close ("7 reviews received, focus areas: XYZ")
- [ ] Community email digest — weekly top posts, opt-in, Resend batch send

---

## Decisions Made

**Live `globals.css` is the real design system source of truth (2026-06-20)**
`DESIGN.md` at the project root documents the live system. Any new tokens go into `globals.css` first, then `DESIGN.md`. Never recreate the deleted `linted_design_system/` or `fingerprint_design_system/` files.

**Deleted `public/assets/linted_design_system/` and `public/assets/fingerprint_design_system/` (2026-06-20)**
Generated by an unapproved Codex experiment. 4 blockers prevented importing: no dark mode block, `--font-display` collision, Tailwind v4 syntax mismatch, 8,375 lines of existing CSS on different token names. Gone. Do not recreate.

**`--linted-*` token namespace is abandoned (2026-06-20)**
Live tokens (`--brand`, `--bg-base`, etc.) stay as-is.

---

## Don't Do This

**Don't use Tailwind's `dark:` prefix.** Dark mode is `body.main-app-dark`, not `prefers-color-scheme`. Use `:global(body.main-app-dark) .className` in CSS modules, or `body.main-app-dark .class` in global CSS.

**Don't introduce new color hex values.** Map every new color to a `--*` token from `globals.css`. At least 9 existing places use hardcoded hex — don't add more.

**Don't add CSS classes to any component without defining them in the corresponding CSS file first.** The premium.tsx incident (14 undefined classes shipped) happened because the CSS wasn't written first.

**Don't import or recreate `variables.css` / `theme.css`.** They used `--linted-*` names, had no dark mode block, and conflicted with live tokens. The experiment didn't ship. Don't touch it.

---

## Current Focus

**Write Post page split-panel redesign (2026-06-21):**
- `CommunityPostComposer.tsx` restructured: editor controls wrapped in `.reddit-composer-left`, live preview panel added as `.reddit-composer-right` (`<aside>`).
- Moved `CommunityMarkdown` out of `.reddit-editor` into the right preview panel (uses `variant="default"` — no border-top/muted bg).
- Preview panel shows: post type badge (`ch-type-badge`), title, topic pill, rendered markdown body, active image, poll options, or empty state.
- CSS: `.reddit-composer` changed from single-column centered (820px max-width) to `grid-template-columns: minmax(0, 1fr) 400px; gap: 0 28px`.
- `.community-compose-route` widened to `min(1240px, calc(100% - 40px))`.
- Preview panel is `position: sticky; top: calc(--app-header-height + 20px)` with scrollable body.
- Mobile ≤900px: single column, preview stacks below editor.

**Previous Current Focus:**

**Onboarding redesign complete (2026-06-21)** — Full split-panel redesign shipped in `components/OnboardingFlow.tsx` + `components/OnboardingFlow.module.css`. Character + speech bubble + typewriter system (same as submit wizard). Step 1 auto-advances 950ms after goal selection. Character fades/swaps on goal change. Per-goal gradient backgrounds with ambient orb. First-person copy throughout. `complete_onboarding` RPC call unchanged.
- Assets currently using placeholder step1-4.png — swap for generated Arjun/Priya variants in `/assets/onboarding/` when ready.

Uncommitted UI changes in working tree:
- `app/globals.css` — premium review form redesign (card-style fields, dissolved textarea)
- `app/admin.css` — admin table padding + `.admin-panel` grid class
- `components/navigation/primary-nav.ts` — icon swap: feed→Home, community→UsersRound
- `lib/primary-navigation.ts` — nav reorder: Home first, Community second; label cleanup

**UI audit complete (2026-06-20)** — Full structured audit written to `docs/ui-audit/`. 14 page reports + `SUMMARY.md`. 70 total findings (17 Broken, 34 Inconsistent, 19 Polish).

**Sprint 1 systemic fixes applied (2026-06-20):**
- `--premium: #d4a538` (light) / `#ffd277` (dark) added to `:root` and `body.main-app-dark` in `globals.css`, documented in `DESIGN.md`. Fixes I-21, I-30, B-14 root cause.
- Heading `font-weight: 400` → `600` across 8 locations: `.feed-route-header h1` (feed.css), `.community-feed-intro h1` (feed.css), `.legal-hero h1` (globals.css), `.onboarding-copy h1` (globals.css), `.header h1` (Leaderboard.module.css), `.identity h1` (ProfileDetail.module.css), `.panelHeader h2` + panel h2s (ProfileDetail.module.css), `.editTitle` (ProfileDetail.module.css). Sub-1 line-heights fixed to 1 alongside. Closes I-01, I-03, I-22, I-25, I-31, I-34.
- `border-radius: 12px` → `var(--radius-lg)` across 12 panel surfaces: both card groups in ReviewerHub, all profile panels (.aboutPanel etc.), .trustStatusCard, highlight card, .skeletonName, .onboarding-choice-card, .onboarding-note (globals.css), .recent-posts-panel, empty-state panel (feed.css), .user-feedback-select-content (admin.css), notification item (notifications.css). Kept at 12px for nav tab items and input fields. Closes I-02, I-33 (partial).
- Landing page headings (`.hero h1`, `.benefits h2`, `.faq-header h2` etc.) intentionally excluded — landing page is a separate audit.

**Sprint 2 broken color semantics applied (2026-06-20):**
- `--bg-muted: #e3e0d9` (light) / `#0a0c0e` (dark) added to globals.css; documented in DESIGN.md. Fixes B-08 (deleted comment background).
- `.badge-open/closed/hot` + dark mode overrides → `var(--success)` / neutral / `var(--danger)` + `color-mix()`. Closes B-05.
- `.feed-status-pill.closed` light → neutral tokens. Dark `.feed-status-pill.open` → `var(--success)`. Closes B-02 (partial).
- `.field-validation.is-warning` → `var(--warning)`. `textarea[aria-invalid]` → `var(--danger)`. Closes B-06.
- `.file-check`, `.privacy-check-clear` → `var(--success)`. Closes B-07.
- Community type badges: question → `--success`, discussion → neutral, announcement → `--warning`, resource already tokenized. Dark mode overrides converted. Closes B-01.
- `.guided-review-input:focus` restored `box-shadow: var(--shadow-focus)`. Closes B-10.
- Online indicator + `.reviewerPendingBadge` → `var(--success)`. Closes B-12.
- Leaderboard avatar border in StackedList.tsx → `color-mix(in_srgb,var(--premium)_52%,transparent)`. Closes B-14.
- Leaderboard role tags: reviewer → `--premium`, student/career → neutral, intern → `--success`, seeker → `--warning`. Closes B-13.
- ReviewerHub dark-mode timer → `var(--warning)` / `var(--danger)`. Closes B-15.
- Admin live count → `var(--success)`. Admin urgent/confirm/aria-invalid → `var(--danger)`. Admin gold pill → `var(--premium)`. Closes B-16, B-17.
- `--font-comment` documented in DESIGN.md. Closes I-20.

**Sprint 3 off-token radii + consistency applied (2026-06-20):**
- `.onboarding-shell` 18px → `var(--radius-xl)` (base + 16px responsive override → `var(--radius-lg)`). `.community-comment-composer` + `.community-comment-composer.is-reply` fixed. Closes I-32.
- `.comment-composer` (feed.css base) 18px → `var(--radius-xl)`. `.comment-composer-reply` 16px → `var(--radius-lg)`. Responsive overrides for `.comment-composer` + `.guided-review-composer` 16px → `var(--radius-lg)`.
- Mobile bottom sheet `border-radius: 18px 18px 0 0` → `var(--radius-xl) var(--radius-xl) 0 0`.
- Mobile action chip `border-radius: 16px` (32px-tall pill element) → `var(--radius-pill)`.
- Thread-panel `.community-root-comment-composer` + sidebar nav item: 9px → `var(--radius-md)`.
- StackedList.tsx: two `rounded-[18px]` → `rounded-[var(--radius-xl)]`, one `rounded-[16px]` → `rounded-[var(--radius-lg)]`. Closes I-26 (partial).
- `.legal-notice` / `.legal-disclaimer` 8px → `var(--radius-md)`. `.onboarding-choice-icon` 9px → `var(--radius-md)`. Closes P-18, P-19.
- `.notification-panel` 16px → `var(--radius-lg)`.
- Submit h1: added `font-family: var(--font-display); font-weight: 600; line-height: 1`. Login h1 (`SignUp.module.css`): same. Community compose h1: same. Closes I-14 (partial).
- `color: white` → `var(--text-inverse)` on role-picker, submit button, profile avatar initial. `color: #fff` on submit button. Closes B-09 (partial).
- Removed duplicate `.resume-detail-route` from feed.css (was strict subset of earlier rule). Closes P-07.
- Removed `!important` from all three declarations in `.reviewerEditButton` (ProfileDetail.module.css). Closes I-24.

**Sprint 4 UX and layout polish applied (2026-06-20):**
- Mobile community feed intro: replaced `clip-path: inset(50%)` visually-hidden with compact `h1` at 22px/1.1 line-height; description paragraph hidden on mobile. Closes I-06, P-03.
- Mobile rich-text toolbar (`CommunityPostComposer.module.css`): `flex-wrap: nowrap; overflow-x: auto; min-height: 44px` — single scrollable row instead of 82px wrap. `scrollbar-width: none`. Closes P-04.
- Submit form column ratio: `minmax(310px, 0.86fr) minmax(440px, 1.14fr)` → `minmax(440px, 1.2fr) minmax(310px, 0.8fr)` — primary column now 60% on desktop. Closes I-16.
- Dropzone: base border `2px dashed` → `1.5px solid`; dashed only on `.drag-over` (`border: 2px dashed var(--brand)`). Closes P-09.
- Report button: added `.community-action-button.is-danger { color: var(--text-tertiary); }` — persistent rest-state de-emphasis vs Share/Reply at identical opacity. Closes P-07.
- Submit form CTA on mobile (`SubmitResumeForm.module.css`): `.formActions` is `position: sticky; bottom: var(--mobile-dock-space); background: var(--bg-surface); z-index: 20;` — always reachable without scrolling. Closes P-10.
- Leaderboard scrollable list (`StackedList.tsx`): `max-h-[min(62vh,720px)]` → `max-h-[min(calc(62vh_-_var(--mobile-dock-space,0px)),720px)]` — subtracts dock height on mobile. Closes P-13.

All four systemic sprints complete. Next: page-specific fixes from docs/ui-audit/ reports.

**Sprint 5 — full audit sweep applied (2026-06-20):**
- B-04: toolbar buttons → `var(--text-secondary)` (`CommunityPostComposer.module.css`)
- Feed-1: mobile nav label "Community" → "Forum" (`lib/primary-navigation.ts`)
- P-15: `.cardTitle` 14px → 15px (`ReviewerHub.module.css`)
- I-26: `.loadingBoard / .loadingDirectory` 18px → `var(--radius-xl)` (`Leaderboard.module.css`)
- B-11, I-23, P-12: role tag purple hardcodes → neutral tokens; shadcn HSL inputs → semantic tokens; canvas mobile padding min raised (`ProfileDetail.module.css`)
- P-17, I-28: OAuth button border → tokens; error/success banners → `color-mix()` (`SignUp.module.css`)
- I-10: accessible label added for community post title input (`CommunityPostComposer.tsx`)
- I-08, I-11, P-06, I-13: compose header gap, post detail h1 weight, comment body size, back-button margin (`globals.css`)
- Comm-8/Feed-10, P-01, I-04, I-17, B-03, P-11, I-19, I-05, Comm-5, Comm-6, B-09: multiple feed/thread fixes (`feed.css`)
- I-29: admin and PDF viewer scoped tokens documented (`DESIGN.md`)
- Skipped structural changes: Feed-9 (community rail placement), P-05 (post type selector)

**Submit page rebuilt as 4-step wizard (2026-06-21):**
- Full rebuild of `components/SubmitResumeForm.tsx` — client-side step state (1–4), back/forward navigation with directional slide animations, per-step validation gate before Next.
- Step 1: Target role picker. Step 2: JD + help textarea. Step 3: Title + plan + privacy. Step 4: File upload.
- Right panel: per-step animated "scene" with ambient orb blobs (per-step color: indigo / teal / amber / brand), role chips, checklist, shield, file status — all pure CSS, no new dependencies.
- Step indicator: numbered pills with checkmarks for completed steps, brand highlight on active.
- `components/SubmitResumeForm.module.css` fully rewritten to support wizard layout (`.wizardBody`, `.wizardLeft`, `.wizardRight`, scene system).
