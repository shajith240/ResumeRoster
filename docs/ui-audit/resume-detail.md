# UI Audit — `/resume/[id]` (Resume Detail)

**Screenshots:** `desktop/linted.space_feed (6).png` (dark mode, full-page) · No mobile screenshot available
**Code roots:** `app/resume/[id]/page.tsx` · `app/feed.css:1468–1560`, `2229–2460`, `2723–3200+`

> **Coverage gap:** No mobile screenshot. Mobile findings from code review only; all mobile findings carry lower confidence.

---

## Finding 1 — Mobile thread uses hardcoded near-black backgrounds

**Severity: Broken · Mobile only**

**Where:** `app/feed.css:6481` and `app/feed.css:6498–6499`.

```css
.mobile-thread-comments .roast-list {
  background: #111416; /* should be var(--bg-base) = #101114 */
}

.mobile-thread-comments .roast-list > .thread-roast-node {
  border-top: 8px solid #050607; /* hardcoded near-black separator */
}
```

`#111416` is 2 hex steps off from `--bg-base: #101114` — similar but not identical. `#050607` is a hardcoded near-black used as a thick separator between thread items (an iOS-style section divider). Neither is in DESIGN.md. If the dark palette ever shifts, these won't track.

**Principle violated:** DESIGN.md token discipline.

**Fix:**
```css
.mobile-thread-comments .roast-list { background: var(--bg-base); }
.mobile-thread-comments .roast-list > .thread-roast-node {
  border-top: 8px solid color-mix(in srgb, var(--bg-base) 80%, #000);
}
```

---

## Finding 2 — Guided review input suppresses all visible focus indicators

**Severity: Broken · Desktop + Mobile**

**Where:** `app/feed.css:2371`, `2377`, `2393–2400`.

```css
.guided-review-input {
  border: 0;
  outline: 0;
}
.guided-review-input:focus {
  border: 0;
  box-shadow: none;
  outline: 0;
}
```

The guided review textareas (where reviewers type "Issue" and "Suggestion") have zero border, zero outline, and no focus-ring — even at the `:focus` state. Keyboard users get no indication of which input is active. This fails WCAG 2.1 SC 2.4.7 (Focus Visible). Desktop screenshot `feed (6).png` shows the review form area with input fields that have no visible boundary.

**Principle violated:** Visual hierarchy (Apple) — active input state must be visible.

**Fix:** Add a focus indicator via the parent container (`.guided-review-composer:focus-within` already exists but doesn't communicate per-field focus):
```css
.guided-review-input:focus {
  box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--border-default) 80%, transparent);
  background: color-mix(in srgb, var(--bg-elevated) 92%, transparent);
}
```

---

## Finding 3 — Duplicate `.resume-detail-route` CSS rule

**Severity: Inconsistent · Desktop + Mobile**

**Where:** `app/feed.css:1468–1471` and `app/feed.css:1558–1560`.

```css
/* First definition — line 1468 */
.resume-detail-route {
  width: min(900px, calc(100% - 48px));
  margin: 0 auto;
  padding: 40px 0 90px;
}

/* Second definition — line 1558 */
.resume-detail-route {
  width: min(900px, calc(100% - 48px));
}
```

The second rule partially duplicates the first (same `width` value). This is CSS debt that creates confusion when debugging and could mask cascade issues if someone later tries to override `padding` above the second definition.

**Principle violated:** Consistency — DESIGN.md token discipline extends to clean, non-duplicated CSS.

**Fix:** Remove the second rule at `feed.css:1558–1560`.

---

## Finding 4 — Resume post title (`resume-detail-title`) at font-weight 500

**Severity: Inconsistent · Desktop**

**Where:** `app/feed.css:1664–1669`.

```css
.resume-preview-pane .resume-detail-title {
  font-size: clamp(24px, 2.4vw, 34px);
  font-weight: 500;
}
```

The resume title is the first and most important text on the page — the job role the candidate is targeting. At weight 500 in Reddit Sans it sits visually close to the author meta text and description below it. Desktop screenshot `feed (6).png` — "AI/ML Intern, SDE Intern" heading reads at similar visual weight to supporting metadata. This is the same recurring pattern across all page-level headings.

**Principle violated:** Typography confidence (Resend).

**Fix:** `font-weight: 600`.

---

## Finding 5 — `comment-author-chip` light-mode background uses hardcoded `rgba(255, 255, 255, 0.72)`

**Severity: Inconsistent · Desktop**

**Where:** `app/feed.css:3049`.

```css
.comment-author-chip {
  background: rgba(255, 255, 255, 0.72); /* should be var(--bg-elevated) */
}
```

The dark-mode override at `feed.css:3079` correctly uses `var(--bg-elevated)`. The light-mode rule should match. Additionally, the hover `border-color: rgba(232, 93, 38, 0.26)` at `feed.css:3065` is a raw hex brand color — should be `color-mix(in srgb, var(--brand) 26%, transparent)`.

**Principle violated:** DESIGN.md token discipline.

**Fix:**
```css
.comment-author-chip {
  background: var(--bg-elevated);
}
.comment-author-chip:hover {
  border-color: color-mix(in srgb, var(--brand) 26%, var(--border-default));
}
```

---

## Finding 6 — `--font-comment` token is not documented in DESIGN.md

**Severity: Inconsistent · Desktop + Mobile**

**Where:** `app/feed.css:3137`.

```css
.thread-roast-body p {
  font-family: var(--font-comment);
}
```

`--font-comment` is referenced for review body text but does not appear in DESIGN.md's font table. DESIGN.md documents four font tokens: `--font-display`, `--font-body`, `--font-app-body`, `--font-post-title`. Either `--font-comment` is defined in `globals.css` but not documented, or it's an undefined token that silently falls through to the body font. Either way it's a documentation gap at minimum.

**Principle violated:** DESIGN.md is described as "the single source of truth" — any token in use must appear there.

**Fix:** Find where `--font-comment` is defined (or add the definition), then add it to the DESIGN.md font table with its value, weights, and intended usage.

---

## Finding 7 — Review thread items separated only by padding — no visual boundary at rest

**Severity: Polish · Desktop**

**Where:** `app/feed.css:2847–2856` — `.thread-roast { padding: var(--thread-item-padding-y, 16px) 0; border-bottom: 0; }`.

Review thread items have zero border and no background at rest — they're separated by padding alone. Desktop screenshot `feed (6).png` shows a long thread where reviews merge visually when scanned at speed. Compare to Reddit which uses subtle divider lines between top-level comments, and Resend's changelog which uses clear vertical rhythm.

**Principle violated:** Visual hierarchy (Apple) — scannable lists need a consistent visual separator.

**Fix (minimal):** Add a subtle separator between top-level reviews:
```css
.thread-roast-node + .thread-roast-node > .thread-roast {
  border-top: 1px solid var(--border-subtle);
}
```

---

## Summary Table

| # | Finding | Severity | Desktop | Mobile | File:Line |
|---|---------|----------|---------|--------|-----------|
| 1 | Mobile thread uses hardcoded `#111416` / `#050607` backgrounds | **Broken** | — | ✅ | `feed.css:6481`, `6498` |
| 2 | Guided review inputs have no visible focus indicator | **Broken** | ✅ | ✅ | `feed.css:2371`, `2393` |
| 3 | Duplicate `.resume-detail-route` CSS rule | Inconsistent | ✅ | ✅ | `feed.css:1468`, `1558` |
| 4 | Resume detail title at font-weight 500 | Inconsistent | ✅ | — | `feed.css:1664–1669` |
| 5 | `.comment-author-chip` uses `rgba(255,255,255,0.72)` in light mode | Inconsistent | ✅ | — | `feed.css:3049`, `3065` |
| 6 | `--font-comment` token not documented in DESIGN.md | Inconsistent | ✅ | ✅ | `feed.css:3137` |
| 7 | Thread review items separated only by padding — no visual divider | Polish | ✅ | — | `feed.css:2847–2856` |
