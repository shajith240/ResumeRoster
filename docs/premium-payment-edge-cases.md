# Premium Payment — Edge Cases, Strategy & Admin Controls

---

## Payment Flow Model

### The Core Rule: Never Accept Payment Unless Delivery Is Guaranteed

The ₹4 Razorpay fee lost per failed refund is not the real risk. One user paying ₹199 and getting nothing tells 10 people. That kills the platform.

**Solution: Reviewer availability gates premium slots.**

```
Reviewer marks themselves "available today" in their dashboard
         ↓
Platform shows "Priority Review available — 2 reviewers on duty"
         ↓
User pays ₹199
         ↓
IMMEDIATELY assigned to a specific reviewer (not open queue)
         ↓
Reviewer has 24h to deliver
```

If zero reviewers are on duty → "Priority Review" button is greyed out with "No reviewers available right now. Join waitlist." No payment accepted. Zero risk.

**Early stage (no code needed):** WhatsApp your 2-3 reviewers "available today?" → they confirm → you flip a toggle in admin dashboard → premium opens. They say no → stays closed.

**Also add to TOS:** Payment processing fee (₹4) is non-refundable on refunds. Standard industry practice across all platforms.

---

## Competitor Analysis

### Direct Competitors

| Platform | Price | What They Do | Fatal Flaw |
|---|---|---|---|
| VMock | ₹500–2000 | AI resume scoring, popular in IITs | Pure AI, zero human context |
| Hiration | ₹799+ | AI review + some human service | Generic, no community layer |
| TopResume | ₹8000–15000 | Human written reviews | US-focused writers, too expensive |
| ResumeWorded | $19/month | AI scoring | No Indian context, no human |
| LinkedIn Resume Review | Free | AI feedback | Vague, no actionable depth |

### Indirect Competitors

- Reddit (r/resumes, r/developersIndia) — free but random strangers, no structure, no accountability
- Asking a senior/friend — no platform, inconsistent, depends on who you know
- College placement cell — generic advice, overloaded, one-size-fits-all
- Career coaches — ₹500–5000/session, expensive, hard to find good ones

### What Actually Makes This Different

Nobody else has this: **a recently-placed person from your target company reviewing your resume.**

Not "human review." Specifically — someone who cracked placement at Flipkart last semester reviewing a resume targeting Flipkart. They know what Flipkart HR actually screens for. They know which projects catch attention. They know the red flags that kill applications there.

VMock's AI cannot tell you "Flipkart SDE teams right now care more about DSA proof than side projects." A recently placed Flipkart engineer can.

**Other differentiators:**
- ₹199 vs TopResume's ₹12,000+ — 60x cheaper with more relevant context
- Reviewer has verified profile, leaderboard rank, expertise badges — not random strangers
- Anonymous submission by default — LinkedIn and Reddit require public exposure
- Community tier (free) feeds reviewer reputation loop — not purely transactional
- Indian hiring context baked in — campus placement culture, Indian company patterns, ATS realities

---

## AI Copy-Paste Prevention

### The Problem

Reviewer pastes resume into ChatGPT, copies output, submits as their review. User pays ₹199 for something they could do free. User feels cheated. Platform dies.

### Why You Can't Fully Prevent It

AI detection tools are unreliable. You cannot scan review text and prove it was AI-generated.

### Why It Doesn't Matter If You Build Right

Make it easier to write a genuine review than to paste AI output.

**The fix: Structured review template with questions AI cannot answer.**

Every premium review must answer all 5 fields before submission:

```
1. Would this resume pass your company's initial screen? Yes/No. Why specifically?
2. What's the one thing that would make you reject this immediately?
3. Name one project or experience that stood out. What about it?
4. What specific skill or keyword is missing for this target role at your company?
5. Score 1–10: interview-worthy? What would push it higher?
```

Question 1 alone breaks lazy AI copy-paste. ChatGPT cannot say "this would pass Zomato's screen because they currently prioritise X." Only someone who works or recently worked there can answer it authentically.

**Enforcement:**
- All 5 fields are required — no submit without completing them
- Minimum 50 characters per field — forces specificity
- User sees the reviewer's verified profile (company, role, year placed) alongside the review
- User rates review within 48h — low-quality AI paste gets 1 star, reviewer drops on leaderboard

**Natural selection handles bad actors:** Generic AI answers score low on helpful votes. Reviewer's leaderboard rank drops. They earn fewer premium assignments. They either improve or leave.

**The honest truth:** Even if a reviewer uses AI as a drafting tool but layers their personal company context on top — that's fine. The value is the insider knowledge, not the writing.

---

## Critical Security (Must Fix Before Launch)

### 1. Amount Tampering
**Attack:** User intercepts `create-order` API and sends `amount=100` instead of `19900` paise. Pays ₹1, gets premium.

**Fix:** Amount is never accepted from frontend. Server hardcodes `₹199 = 19900 paise`. No exceptions.

---

### 2. Fake Payment ID
**Attack:** User skips Razorpay entirely, sends a fabricated `payment_id` to the verify endpoint. Resume gets marked premium without any real payment.

**Fix:** Server-side HMAC SHA256 signature verification on every verify request.
```
expected_signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret)
```
If signature doesn't match → reject with 400. This is non-negotiable.

---

### 3. Order ID Reuse
**Attack:** User pays once, captures `order_id`. Submits 10 resumes using the same `order_id`. All get marked premium from one payment.

**Fix:** Unique constraint on `payment_id` column in DB. One payment ID = one resume. Database enforces it, not application code.

---

### 4. UPI Pending Payments
**Problem:** UPI payments in India can sit in "pending" for up to 48 hours. User sees a Razorpay "success" screen, we mark resume as paid, reviewer claims it — but payment never actually captures.

**Fix:** Two-phase status flow:
- Frontend callback → mark `payment_status = 'pending'`, show "Payment processing" to user
- Razorpay webhook fires `payment.captured` → mark `payment_status = 'paid'`, NOW surface in premium feed
- Resume never shown to reviewers until status is `paid`, not `pending`

---

### 5. Webhook Spoofing
**Attack:** Anyone POSTs to `/api/webhooks/razorpay` pretending to be Razorpay. Marks resumes as paid for free.

**Fix:** Verify `X-Razorpay-Signature` header on every incoming webhook using `RAZORPAY_WEBHOOK_SECRET` (separate from `key_secret`). Reject anything that fails verification with 400.

---

### 6. File Uploaded Before Payment Confirmed
**Attack:** User uploads PDF to Supabase storage, abandons payment, then POSTs directly to the resume create API with the captured `file_path` to create a free record and bypass premium check.

**Fix:** Upload file ONLY after payment verification succeeds. Order of operations is strict:
```
Pay → server verifies signature → upload PDF to storage → create DB record
```
Never the other way around.

---

## Race Conditions

### 7. Two Reviewers Claim Simultaneously
**Problem:** Multiple reviewers see the same premium resume and click "Claim" at the same time. Both get assigned. Both do the review. You owe two payouts.

**Fix:** Atomic DB update — no application-level locking needed:
```sql
UPDATE resumes
SET assigned_reviewer_id = $reviewer_id,
    review_deadline = now() + interval '24 hours',
    premium_claimed_at = now()
WHERE id = $resume_id
  AND assigned_reviewer_id IS NULL
  AND is_premium = true
  AND payment_status = 'paid'
RETURNING id;
```
If no row returned → already claimed. Return error to second reviewer: "Someone just claimed this."

---

### 8. Double-Click on Pay Button
**Problem:** Slow network response → user clicks "Pay ₹199" twice → two Razorpay orders created for one resume.

**Fix:** Disable button immediately on first click. Create-order endpoint uses idempotency key tied to `user_id + timestamp_window` so duplicate requests within 5 seconds return the same order.

---

## UX Edge Cases That Cost Money

### 9. Reviewer Claims But Never Reviews
**Problem:** Reviewer claims a premium resume, goes offline, never submits. 24h passes. User paid ₹199, got nothing.

**Fix:**
- Web push notification to reviewer at 12h and 20h marks
- At 24h: if no review submitted → auto-release claim, trigger automatic Razorpay refund to user
- Reviewer gets a strike. 3 strikes → banned from premium queue permanently

---

### 10. No Reviewer Claims in 24 Hours
**Problem:** Premium resume posted. No reviewer available or interested. Sits unclaimed for 24h. User deserves refund.

**Fix:** Supabase scheduled function (pg_cron) checks every hour:
```sql
SELECT id FROM resumes
WHERE is_premium = true
  AND payment_status = 'paid'
  AND assigned_reviewer_id IS NULL
  AND created_at < now() - interval '24 hours';
```
Any match → trigger Razorpay refund via API → mark `payment_status = 'refunded'` → notify user.

---

### 11. Reviewer Reviews Their Own Premium Resume
**Attack:** User uploads premium resume. Switches role to reviewer. Claims and "reviews" their own resume. Triggers payout to themselves.

**Fix:** Existing RLS already blocks self-review on roasts table. Extend explicitly to claim endpoint:
```sql
AND resume.user_id <> $requesting_reviewer_id
```
Also enforce in the DB-level claim UPDATE query.

---

### 12. Low Quality Review to Farm Payout
**Problem:** Reviewer submits "Looks good, apply now." (15 words) in 3 minutes to collect ₹120 fast.

**Fix:**
- All 5 structured review template fields are required (see AI Copy-Paste section)
- Minimum 50 characters per field enforced at DB level
- User can flag review as inadequate within 48h
- Admin arbitrates → triggers refund if valid → reviewer gets strike

---

### 13. Premium Queue Spamming
**Problem:** Same user pays ₹199 multiple times, flooding the premium queue, starving other users of reviewer attention.

**Fix:** One active premium review per user at a time. Check before allowing new premium submission:
```sql
SELECT 1 FROM resumes
WHERE user_id = $uid
  AND is_premium = true
  AND payment_status = 'paid'
  AND status = 'open'
LIMIT 1;
```
If exists → block submission with "You already have an active priority review."

---

## Admin Controls (What You Need Without Touching Code)

Everything below must be controllable from the admin dashboard. You should never need to edit code or run SQL for day-to-day operations.

### Premium Availability

| Control | What It Does |
|---|---|
| **Premium On/Off toggle** | Globally enables or disables the "Priority Review" button for all users. Turn off when no reviewers are available. |
| **Per-reviewer availability toggle** | Mark a specific reviewer as "on duty" or "off duty." Premium assignments only go to on-duty reviewers. |
| **Max active premium slots** | Set how many premium resumes can be in-flight at once (e.g., cap at 5 if you only have 2 reviewers). |

### Order Management

| Control | What It Does |
|---|---|
| **View all premium orders** | Table showing order ID, user, reviewer, payment status, deadline, payout status. |
| **Manual refund trigger** | Button to trigger Razorpay refund for a specific order. For edge cases auto-refund misses. |
| **Manual reviewer assignment** | If auto-assignment fails, manually pick a reviewer for an orphaned premium resume. |
| **Extend deadline** | Give a reviewer more time if they have a valid reason (add 12h or 24h to deadline). |
| **Force-release claim** | Remove a reviewer's claim on a resume without waiting for deadline. For reviewer emergencies. |

### Reviewer Management

| Control | What It Does |
|---|---|
| **View reviewer strikes** | See strike count per reviewer. Current threshold: 3 strikes = banned from premium. |
| **Issue strike manually** | Add a strike to a reviewer for bad behaviour you spotted that the system didn't catch. |
| **Remove strike** | Clear a false strike if reviewer disputes it. |
| **Ban from premium queue** | Block a reviewer from claiming premium resumes permanently (beyond auto-ban at 3 strikes). |
| **Approve/reject reviewer applications** | Already built. Reviewer verification status management. |

### Payout Tracking

| Control | What It Does |
|---|---|
| **Pending payouts list** | All completed reviews where reviewer hasn't been paid yet. Shows reviewer UPI ID and amount owed. |
| **Mark payout as sent** | After you manually UPI the reviewer, mark it done. Records timestamp and your note. |
| **Payout history** | Full log of all payouts made. Useful for disputes and accounting. |

### Quality Control

| Control | What It Does |
|---|---|
| **Flagged review queue** | All reviews users have flagged as inadequate within their 48h window. |
| **Approve/reject dispute** | On a flagged review: approve dispute → trigger refund + strike. Reject → dismiss flag. |
| **View review content** | Read any premium review as admin to judge dispute without asking either party. |

### Platform Health

| Control | What It Does |
|---|---|
| **Revenue summary** | Total orders, total earned (your cut), total paid out to reviewers, pending payouts. |
| **Waitlist count** | How many users are waiting for premium when slots are closed. Helps you decide when to open more capacity. |
| **Failed payment log** | UPI pending orders older than 48h that never captured. For manual follow-up. |

---

## Environment Variables

| Variable | Exposed To | Purpose |
|---|---|---|
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Browser | Initialise Razorpay checkout popup |
| `RAZORPAY_KEY_SECRET` | Server only | Sign/verify payment signature |
| `RAZORPAY_WEBHOOK_SECRET` | Server only | Verify incoming Razorpay webhooks |

`key_secret` and `webhook_secret` must never appear in client bundles, logs, or error messages.

---

## DB Columns Needed (resumes table)

```sql
is_premium            boolean       default false
payment_status        text          check (in 'pending', 'paid', 'refunded')
payment_id            text          UNIQUE  -- prevents order reuse attack
razorpay_order_id     text          UNIQUE
assigned_reviewer_id  uuid          FK → profiles(id)
review_deadline       timestamptz
premium_claimed_at    timestamptz
reviewer_payout_sent  boolean       default false
reviewer_payout_at    timestamptz
```

---

## Launch Checklist

### Security
- [ ] Amount hardcoded server-side only
- [ ] HMAC signature verification on every `/api/payments/verify` call
- [ ] Unique constraint on `payment_id` and `razorpay_order_id`
- [ ] UPI pending state — do not surface to reviewers until `payment.captured` webhook fires
- [ ] Webhook signature verification with `RAZORPAY_WEBHOOK_SECRET`
- [ ] File upload happens AFTER payment verification, not before

### Logic
- [ ] Atomic claim query with `WHERE assigned_reviewer_id IS NULL`
- [ ] Self-review blocked at claim endpoint level
- [ ] One active premium per user enforced before payment
- [ ] 5-field structured review template required for premium submission

### Admin
- [ ] Premium on/off toggle in admin dashboard
- [ ] Per-reviewer availability toggle
- [ ] Manual refund trigger
- [ ] Strike system (issue, remove, auto-ban at 3)
- [ ] Pending payouts list with "mark as sent" button
- [ ] Flagged review queue with approve/reject dispute

### Automation
- [ ] Auto-refund cron for unclaimed resumes after 24h
- [ ] Auto-refund + strike for reviewer no-shows after 24h
- [ ] Web push to reviewer at 12h and 20h warning

---

## What to Skip For Now

- Tax/GST compliance — relevant after ₹20L/year revenue
- Automated reviewer payouts — manual UPI transfers until 20+ orders/month
- AI detection on reviews — structured template handles this naturally
- Idempotent webhook event deduplication — add when you have real volume
- Dispute resolution UI — handle manually via admin dashboard until patterns emerge
