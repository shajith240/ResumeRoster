# UI Audit — `/community` (Community Feed)

**Screenshots:** `desktop/linted.space_feed (1).png` (light mode) · `mobile/linted.space_feed(Samsung Galaxy S8+) (1).png` (dark mode)
**Code roots:** `app/community/page.tsx` · `app/feed.css` (community sections: ~4963–5740)

---

## Finding 1 — Mobile community intro is visually hidden — no page orientation on mobile

**Severity: Broken · Mobile only**

**Where:** `app/feed.css:5731–5739` — at the mobile breakpoint, `.community-feed-intro` is hidden via `clip-path: inset(50%)` and `overflow: hidden` (the accessible-hide pattern). Mobile screenshot `feed(S8+) (1).png` confirms: no heading, no description — users land directly on a list of posts with no context for where they are.

```css
.community-feed-intro {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  /* ... */
}
```

**Principle violated:** Visual hierarchy (Apple) — spatial orientation is mandatory, not optional, on mobile. Apple's HIG explicitly says every view should communicate where the user is.

**Fix:** Show a compact mobile-specific heading instead of hiding the intro entirely. The description can be omitted, but the `h1` must stay visible. Move the display:none to the `p` only:
```css
/* Mobile: hide description, keep heading */
@media (max-width: 599px) {
  .community-feed-intro p { display: none; }
  .community-feed-intro h1 { font-size: 28px; margin-bottom: 12px; }
}
```

---

## Finding 2 — `h1` font-weight 400 at display size — same pattern as feed page

**Severity: Inconsistent · Desktop only (mobile heading is hidden)**

**Where:** `app/feed.css:4979–4987`.

```css
.community-feed-intro h1 {
  font-size: clamp(38px, 3vw, 48px);
  font-weight: 400; /* too light */
  line-height: 0.98;
}
```

At 38–48px, Syne 400 reads as intentionally light — but next to the 15px body text with `font-weight: 500` immediately below, the contrast ratio between heading and description is low. Desktop screenshot `feed (1).png` shows the "Community" heading and subtitle as close in visual weight, which flattens the hierarchy. 

**Principle violated:** Typography confidence (Resend).

**Fix:** Change to `font-weight: 600`. Additionally, `line-height: 0.98` is below 1 — technically fine for this word but fragile if the heading ever wraps (clipped descenders). Change to `line-height: 1` to make it safe.

---

## Finding 3 — `community-feed-intro` gap and margin-bottom are too tight

**Severity: Inconsistent · Desktop only**

**Where:** `app/feed.css:4972–4977`.

```css
.community-feed-intro {
  gap: 6px;           /* heading → description gap */
  margin-bottom: 18px; /* intro → feed gap */
  padding-top: 2px;
}
```

6px between heading and description compresses them into a single visual block — there's no pause between the page title and its explanatory copy. 18px margin before the feed list starts is minimal. In screenshot `feed (1).png`, the heading, subtitle, and feed list all feel stacked with no breathing room.

**Principle violated:** Whitespace discipline (Apple) — Apple's design uses generous leading between section header and content.

**Fix:**
```css
.community-feed-intro {
  gap: 10px;           /* was 6px */
  margin-bottom: 28px; /* was 18px */
  padding-top: 4px;
}
```

---

## Finding 4 — Status badge colors in globals.css use hardcoded hex

**Severity: Inconsistent · Desktop + Mobile**

**Where:** `app/globals.css:480–493`.

```css
.badge-open   { background: #dcfce7; color: #166534; }
.badge-closed { background: #f1f5f9; color: #475569; }
.badge-hot    { background: #fee2e2; color: #991b1b; }
```

These are Tailwind-ecosystem greens, slates, and reds that don't map to any `--*` token in DESIGN.md. Dark-mode overrides for these badges correctly use rgba+token approaches (e.g., `rgba(103, 211, 145, 0.16)` keyed off `--success`). The light-mode rules should mirror that pattern.

**Principle violated:** DESIGN.md token discipline.

**Fix:**
```css
.badge-open   { background: color-mix(in srgb, var(--success) 12%, transparent); color: color-mix(in srgb, var(--success) 80%, var(--text-primary)); }
.badge-closed { background: color-mix(in srgb, var(--bg-elevated) 80%, transparent); color: var(--text-tertiary); }
.badge-hot    { background: color-mix(in srgb, var(--danger) 10%, transparent); color: color-mix(in srgb, var(--danger) 80%, var(--text-primary)); }
```

---

## Finding 5 — Poll posts lose hover state inconsistently

**Severity: Inconsistent · Desktop only**

**Where:** `app/feed.css:5174–5179`.

```css
.community-feed-route .community-feed-row[data-post-kind="poll"]:hover,
.community-feed-route .community-feed-row[data-post-kind="poll"]:focus-within {
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}
```

Non-poll posts get a hover lift (10px border-radius, subtle background, ring shadow). Poll posts suppress this entirely. Desktop screenshot `feed (1).png` shows a poll card ("What should a fresher build first?") at the same visual level as other cards — but hovering it will produce no feedback while adjacent cards animate. This creates a perception that the poll card is inert or broken.

**Principle violated:** Consistency (DESIGN.md) — interactive surfaces must respond uniformly.

**Fix:** Remove the poll-specific override entirely. If poll cards truly need different hover behavior (e.g., because the poll bar itself is interactive), scope the suppression only to the bar element, not the entire row.

---

## Finding 6 — Community post titles at weight 500 — same issue as feed

**Severity: Inconsistent · Desktop + Mobile**

**Where:** `app/feed.css:5201–5206`.

```css
.community-feed-route .community-feed-title {
  font-size: clamp(18px, 1.35vw, 21px);
  font-weight: 500;
}
```

Post titles are the clickable primary element; at weight 500 in Reddit Sans they merge visually with the description text below. Desktop screenshot `feed (1).png` — titles like "Are clone projects bad?" and "What should a fresher build first?" are readable but not distinctly heavier than the body text. This is a cross-cutting pattern: resume feed and community feed both use 500 for post titles.

**Principle violated:** Content-first density (Reddit) — Reddit uses 600+ for post titles so the eye can scan them independently of body copy.

**Fix:** Change to `font-weight: 600`.

---

## Finding 7 — `community-feed-route` skeleton also repeats the 14px horizontal padding issue

**Severity: Polish · Desktop + Mobile**

**Where:** `app/feed.css:5192–5194`.

```css
.community-feed-route .community-feed-loading .skeleton-card .post-content {
  padding: 16px 14px;
}
```

Skeleton cards use 14px horizontal padding. When real content loads, it will also use 14px (inheriting from the shared `.post-content` rule at `feed.css:626`). This is the same asymmetric padding issue flagged in the feed audit — 14px horizontal vs 16px vertical — and it affects both feeds.

**Principle violated:** Whitespace discipline (Apple).

**Fix:** Fix the root `.post-content { padding: 16px 16px; }` rule in `feed.css:626`. The skeleton override will also need updating to match.

---

## Finding 8 — Desktop community sort control is ambiguous at a glance

**Severity: Polish · Desktop only**

**Where:** Visual inspection of `desktop/feed (1).png` — the "Best ↓" sort trigger appears in the top-right of the feed toolbar without visual contrast against the page. The button has no background or border in its resting state (transparent, matching `.feed-sort-trigger` at `feed.css:466`), making it hard to see at first glance as a tappable control.

**Principle violated:** Visual hierarchy (Apple) — controls should be legible as controls without requiring hover.

**Fix:** Same recommendation as Feed audit Finding 10 — add an always-visible resting state to the sort trigger:
```css
.feed-sort-trigger {
  border-color: color-mix(in srgb, var(--border-subtle) 78%, transparent);
  background: color-mix(in srgb, var(--bg-elevated) 56%, transparent);
}
```

---

## Summary Table

| # | Finding | Severity | Desktop | Mobile | File:Line |
|---|---------|----------|---------|--------|-----------|
| 1 | Mobile community intro hidden — no page orientation | **Broken** | — | ✅ | `feed.css:5731–5739` |
| 2 | h1 font-weight 400 — too light; line-height 0.98 — fragile | Inconsistent | ✅ | — | `feed.css:4979–4987` |
| 3 | Intro gap 6px / margin-bottom 18px — too tight | Inconsistent | ✅ | — | `feed.css:4972–4977` |
| 4 | Badge light-mode colors use hardcoded hex | Inconsistent | ✅ | ✅ | `globals.css:480–493` |
| 5 | Poll posts lose hover state — inconsistent interaction | Inconsistent | ✅ | — | `feed.css:5174–5179` |
| 6 | Community post titles at weight 500 | Inconsistent | ✅ | ✅ | `feed.css:5201–5206` |
| 7 | Skeleton padding repeats 14px asymmetry | Polish | ✅ | ✅ | `feed.css:5192–5194` |
| 8 | Sort trigger invisible in resting state | Polish | ✅ | — | `feed.css:466–497` |
