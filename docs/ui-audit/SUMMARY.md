# UI Audit — Full App Summary

**Date:** 2026-06-20  
**Scope:** All in-app routes (landing page excluded per brief)  
**Standards:** Apple (hierarchy + whitespace), Reddit (restraint + density), Resend (typography confidence), DESIGN.md token discipline  
**Pages audited:** 14 routes → 14 individual reports in `docs/ui-audit/`

---

## Cross-cutting patterns (appear on every page)

Before the per-severity list, three systemic issues recur across every audited page. These are root-cause fixes that cascade positively across the whole app:

| Pattern | Affected pages | Fix |
|---------|---------------|-----|
| **Page/section `h1` at `font-weight: 400`** — display headings lack visual dominance | All 14 pages | `font-weight: 600` everywhere |
| **`border-radius: 12px` off-token** — should be `--radius-lg: 14px` | Feed, community, community-detail, profile, reviewer, onboarding (6+ sites) | `var(--radius-lg)` |
| **Hardcoded green instead of `--success`** — `#22c55e`, `#63c987`, `rgba(34,197,94,...)`, `rgba(99,178,71,...)` etc. | Feed, submit, profile, leaderboard, admin (5+ sites) | `var(--success)` + `color-mix()` |

---

## Severity: Broken

Issues that produce incorrect visual results — wrong semantic color, missing WCAG focus indicator, undefined tokens, or palette violations.

| # | Finding | Page | File:Line |
|---|---------|------|-----------|
| B-01 | Community type badges (question/discussion/announcement) use 9 hardcoded hex colors | `/feed` | `feed.css:260–305` |
| B-02 | `.feed-status-pill.closed` uses `#f1f5f9`/`#475569` (Tailwind slate) | `/feed` | `feed.css:796–799` |
| B-03 | `.secure-resume-preview-bar` uses `background: #1b1a18` and `.secure-resume-reader` uses `#11110f` | `/feed` (resume viewer) | `feed.css:1712`, `1932` |
| B-04 | Editor toolbar buttons use hardcoded `#b8ddff` blue — unrelated hue | `/community/new` | `CommunityPostComposer.module.css:7` |
| B-05 | `.badge-open/closed/hot` use hardcoded Tailwind green/red in light mode | `/community`, `/feed` | `globals.css:480–493` |
| B-06 | `aria-invalid` fields show `--brand` orange instead of `--danger` red for error state | `/submit` | `globals.css:1693–1696` |
| B-07 | `.file-check` and `.privacy-check-clear` use hardcoded `#dcfce7`/`#166534`/`#22c55e`/`#63c987` greens | `/submit` | `globals.css:1791`, `1842` |
| B-08 | `--bg-muted` undefined token — deleted community comment backgrounds render incorrectly | `/community/[id]` | `globals.css:3914` |
| B-09 | Mobile thread comments use `background: #111416` and `border: 8px solid #050607` | `/resume/[id]` | `feed.css:6481`, `6498` |
| B-10 | Guided review inputs suppress all focus indicators — WCAG 2.1 SC 2.4.7 failure | `/resume/[id]` | `feed.css:2371`, `2393` |
| B-11 | `.roleTag` on profile uses hardcoded purple `#4230a3` — hue not in design system | `/profile/[id]` | `ProfileDetail.module.css:113–125` |
| B-12 | Online indicator and pending reviewer badge use different hardcoded greens (`#22c55e`, `#3a8a28`) | `/profile/[id]` | `module.css:56–60`, `284–289` |
| B-13 | Leaderboard role badges introduce purple, blue, green, amber hex — three new hue families | `/leaderboard` | `globals.css:8540–8573` |
| B-14 | Leaderboard avatar border uses hardcoded gold `rgba(214,179,100,0.52)` inline JSX | `/leaderboard` | `StackedList.tsx:175` |
| B-15 | Reviewer hub dark-mode timer overrides use `#f59e0b`/`#ef4444` instead of `var(--warning)`/`var(--danger)` | `/reviewer` | `ReviewerHub.module.css:267–273` |
| B-16 | Admin live count uses hardcoded `rgba(34,197,94,...)`, `#86efac` greens | `/admin` | `admin.css:992–1004` |
| B-17 | Admin urgent priority, `aria-invalid`, and confirm dialog use `rgba(248,113,113,...)` red — hardcoded | `/admin` | `admin.css:884–890`, `1183–1207` |

---

## Severity: Inconsistent

Issues that don't produce broken results but violate design system contracts, produce visual inconsistency, or indicate CSS debt.

| # | Finding | Page | File:Line |
|---|---------|------|-----------|
| I-01 | Page `h1` at Syne `font-weight: 400` (systemic — all pages) | All | Multiple |
| I-02 | `border-radius: 12px` used instead of `--radius-lg: 14px` (systemic — 6+ sites) | Multiple | Multiple |
| I-03 | Feed route header `h1` at `font-weight: 400` with generic `.feed-route-header` class | `/feed` | `feed.css:44–49` |
| I-04 | Post title `h2` at `font-weight: 500` — flat hierarchy vs description text | `/feed` | `feed.css:744–747` |
| I-05 | Community feed intro heading `line-height: 0.98`, `gap: 6px` — compressed, fragile | `/community` | `feed.css:4972–4987` |
| I-06 | Community feed intro visually hidden on mobile via `clip-path: inset(50%)` — inaccessible | `/community` | `feed.css:5731–5739` |
| I-07 | `.ch-type-*` badge colors are 9 individual hex values with no token mapping | `/community`, `/feed` | `feed.css:260–305` |
| I-08 | Compose header `gap: 6px` — eyebrow, title, and drafts link visually merged | `/community/new` | `globals.css:1889` |
| I-09 | Create post `h1` missing explicit `font-weight` — inherits browser default | `/community/new` | `globals.css:1918–1922` |
| I-10 | Title input has no visible label — only placeholder asterisk (WCAG 3.3.2) | `/community/new` | `CommunityPostComposer.tsx` |
| I-11 | Post detail `h1` at `font-weight: 500` — flat hierarchy vs body text | `/community/[id]` | `globals.css:3668–3672` |
| I-12 | Comment composer/reply border-radius 18px/16px — off-token | `/community/[id]` | `globals.css:3817`, `3835` |
| I-13 | Back-button toolbar uses `margin-bottom: -6px` — negative-margin layout hack | `/community/[id]` | `globals.css:3987` |
| I-14 | `.field-validation.is-warning` uses `var(--brand)` instead of `var(--warning)` | `/submit` | `globals.css:1689–1691` |
| I-15 | Submit `h1` missing `font-family` — inherits Work Sans not Syne; line-height 0.98 fragile | `/submit` | `globals.css:1615–1618` |
| I-16 | Submit form two-column layout: primary content in narrower column | `/submit` | `globals.css:1637–1644` |
| I-17 | Resume detail title at `font-weight: 500` | `/resume/[id]` | `feed.css:1664–1669` |
| I-18 | Duplicate `.resume-detail-route` CSS rule | `/resume/[id]` | `feed.css:1468`, `1558` |
| I-19 | `.comment-author-chip` light-mode uses `rgba(255,255,255,0.72)` instead of `var(--bg-elevated)` | `/resume/[id]` | `feed.css:3049` |
| I-20 | `--font-comment` token referenced but not documented in DESIGN.md | `/resume/[id]` | `feed.css:3137` |
| I-21 | Profile gold trust colors (`#ffd277`, `#77530a`, `#d4a538`) — no `--premium` token defined | `/profile/[id]` | `module.css:421`, `505`, `713` |
| I-22 | Profile panel `h2` headings at Syne `font-weight: 400` | `/profile/[id]` | `module.css:345–354` |
| I-23 | Edit-form textareas use shadcn HSL tokens (`--input`, `--background`) instead of semantic tokens | `/profile/[id]` | `module.css:988–1003` |
| I-24 | `.reviewerEditButton` uses three `!important` declarations — specificity debt | `/profile/[id]` | `module.css:487–491` |
| I-25 | Leaderboard `h1` at Syne `font-weight: 400` | `/leaderboard` | `Leaderboard.module.css:25` |
| I-26 | Leaderboard board and skeleton use `18px`/`16px` border-radius — off-token | `/leaderboard` | `StackedList.tsx:445`, `518`, `546` |
| I-27 | Login `h1` missing `font-family` and `font-weight` | `/login` | `SignUp.module.css:44–51` |
| I-28 | Login error/success banners use literal RGBA instead of `color-mix` with tokens | `/login` | `SignUp.module.css:208–252` |
| I-29 | Admin local tokens (`--admin-*`) not documented in DESIGN.md | `/admin` | `admin.css:4–6` |
| I-30 | `.admin-pill-gold` uses same undocumented `#d4a538` as profile trust badge | `/admin` | `admin.css:882–885` |
| I-31 | Onboarding `h1` at `font-weight: 400` / `line-height: 0.95` | `/onboarding` | `globals.css:1196–1203` |
| I-32 | Onboarding shell `border-radius: 18px` — between token values | `/onboarding` | `globals.css:1136` |
| I-33 | Onboarding choice cards `border-radius: 12px` — off-token | `/onboarding` | `globals.css:1238` |
| I-34 | Legal `h1` at Syne `font-weight: 400` / `line-height: 0.95` | Legal pages | `globals.css:1030–1037` |

---

## Severity: Polish

Issues that don't break anything but reduce premium feel, content density, or experience quality.

| # | Finding | Page | File:Line |
|---|---------|------|-----------|
| P-01 | Post content padding `16px 14px` — asymmetric left/right | `/feed` | `feed.css:626` |
| P-02 | `recent-posts-panel` border-radius 12px vs `--radius-lg: 14px` | `/feed` | `feed.css:1239` |
| P-03 | Mobile community feed intro hidden with `clip-path: inset(50%)` instead of responsive layout | `/community` | `feed.css:5731–5739` |
| P-04 | Mobile rich text toolbar wraps to 82px — takes too much vertical space | `/community/new` | `CommunityPostComposer.module.css:67–76` |
| P-05 | Post type selector positioned disconnected from content tab row | `/community/new` | Visual |
| P-06 | Comment body font-size 14px — below app's 15px body baseline | `/community/[id]` | `globals.css:3941` |
| P-07 | "Report" button visually identical to "Share" at rest — destructive action has no persistent de-emphasis | `/community/[id]` | `globals.css:3958–3964` |
| P-08 | Role picker selected button uses `color: white` instead of `var(--text-inverse)` | `/submit` | `globals.css:1728–1732` |
| P-09 | Dropzone dashed border — developer-tier visual for a consumer upload field | `/submit` | `globals.css:1738–1753` |
| P-10 | Mobile submit form: 5+ scrolls to reach CTA; mobile form order not optimized | `/submit` | `globals.css:4394–4396` |
| P-11 | Thread review items separated only by padding — no visual divider | `/resume/[id]` | `feed.css:2847–2856` |
| P-12 | Mobile profile canvas padding resolves to 10px — content clips at right edge | `/profile/[id]` | `module.css:18` |
| P-13 | Mobile leaderboard scrollable table max-height doesn't subtract bottom dock | `/leaderboard` | `StackedList.tsx:487` |
| P-14 | `.lb-tag-reviewer` border uses `rgba(255,184,95,0.34)` instead of `color-mix(var(--brand))` | `/leaderboard` | `globals.css:8535` |
| P-15 | Reviewer hub card title at 14px — below 15px body baseline | `/reviewer` | `ReviewerHub.module.css:89` |
| P-16 | Login submit button `color: #fff` not `var(--text-inverse)` | `/login` | `SignUp.module.css:265` |
| P-17 | Login OAuth button light-mode border uses hardcoded `rgba(26,25,22,...)` | `/login` | `SignUp.module.css:113–118` |
| P-18 | Onboarding choice icon `border-radius: 9px` — between token values | `/onboarding` | `globals.css:1280` |
| P-19 | Legal notice/disclaimer `border-radius: 8px` — off-token | Legal pages | `globals.css:1092–1098` |

---

## Fix prioritization

### Sprint 1 — System-level fixes (highest leverage, affects all pages)

These 5 changes fix dozens of individual findings:

1. **Define `--premium` token** in `globals.css` for gold/trust color (`#c99a14` light / `#ffd277` dark) and document in DESIGN.md. Closes I-21, I-30, and the avatar gold border.
2. **Global heading weight sweep** — change `font-weight: 400` → `600` on all page-level h1s and panel h2s. Closes I-01, I-03, I-22, I-25, I-31, I-34.
3. **Global 12px border-radius sweep** — replace all `border-radius: 12px` with `var(--radius-lg)`. Closes I-02, I-26 (partial), I-33.
4. **Define `--bg-muted` token** in `globals.css`. Closes B-08.
5. **Document `--font-comment` in DESIGN.md** (or define and document). Closes I-20.

### Sprint 2 — Broken color semantics (security/meaning critical)

1. Fix `aria-invalid` to use `--danger` not `--brand` (B-06, B-10, B-17).
2. Fix all hardcoded greens → `var(--success)` across submit, profile, leaderboard, admin (B-07, B-12, B-15, B-16).
3. Fix hardcoded reds in admin → `var(--danger)` (B-17).
4. Fix community type badge hex values → token-based (B-01).
5. Replace leaderboard role badge hue families with neutral tokens (B-13).
6. Add `:focus` indicator back to guided review inputs (B-10).

### Sprint 3 — Off-token radii and font inconsistencies (single-file mechanical fixes)

- Fix all 18px / 16px off-token border-radius values → `var(--radius-xl)` or `var(--radius-lg)`.
- Fix submit form `h1` missing `font-family` (I-15).
- Fix login `h1` missing `font-family` (I-27).
- Fix create-post `h1` missing `font-weight` (I-09).
- Fix `color: white` / `color: #fff` → `var(--text-inverse)` (P-08, P-16).
- Fix `--bg-muted` usage in deleted comments (B-08).
- Remove duplicate `.resume-detail-route` CSS rule (I-18).
- Remove `!important` from `.reviewerEditButton` (I-24).
- Fix `.field-validation.is-warning` to use `--warning` not `--brand` (I-14).

### Sprint 4 — UX and layout polish

- Mobile community intro: replace `clip-path: inset(50%)` with responsive layout (I-06, P-03).
- Mobile toolbar: single-row scrollable instead of 82px wrap (P-04).
- Mobile submit form: reorder sections for CTA proximity (P-10).
- Mobile leaderboard: subtract dock from max-height (P-13).
- Dropzone: solid border at rest, dashed only on drag-over (P-09).
- "Report" button: persistent de-emphasis vs "Share" (P-07).
- Submit form column ratio: make primary content the wider column (I-16).

---

## Total finding count

| Severity | Count |
|----------|-------|
| Broken | 17 |
| Inconsistent | 34 |
| Polish | 19 |
| **Total** | **70** |
