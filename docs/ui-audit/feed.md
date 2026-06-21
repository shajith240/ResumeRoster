# UI Audit — `/feed` (Resume Feed)

**Screenshots:** `desktop/linted.space_feed.png` · `mobile/linted.space_feed(Samsung Galaxy S8+).png`
**Code roots:** `app/feed/page.tsx` · `app/feed.css` (primary) · `components/resume-feed/`

---

## Finding 1 — Mobile bottom-nav labels are truncated

**Severity: Broken · Mobile only**

**Where:** Mobile screenshot `feed(S8+).png`, bottom dock. "Community" renders as "Commun…" and "Leaderboard" renders as "Leaders" — both cut off mid-word.

**Principle violated:** Visual hierarchy (Apple) — nav labels are the primary affordance for orientation. A truncated label is a broken affordance, not a cosmetic defect.

**Fix:** In the bottom nav component, shorten the label strings or reduce `font-size` on labels to 10px. "Community" → "Comm." or "Community" with `font-size: 10px` and `overflow: hidden; text-overflow: clip`. "Leaderboard" → "Leaders" is acceptable as an intentional abbreviation, but "Commun…" with a visible ellipsis is not. Check `components/navigation/primary-nav.ts` and `lib/primary-navigation.ts` for label strings.

---

## Finding 2 — Community Highlights Rail badge colors violate the token system

**Severity: Broken · Desktop + Mobile**

**Where:** `app/feed.css:260–305` — `.ch-type-question`, `.ch-type-discussion`, `.ch-type-announcement` light-mode rules. Screenshot `desktop/feed.png` — colored pills visible on the rail cards above the feed.

```css
/* PROBLEM — raw hex, no design-system mapping */
.ch-type-question  { background: #eef9f3; color: #1d6f45; border-color: #cbe8da; }
.ch-type-discussion { background: #f1edff; color: #5137b8; border-color: #d9d0ff; }
.ch-type-announcement { background: #eef4ff; color: #244ea8; border-color: #cbdcff; }
```

DESIGN.md explicitly: *"Don't introduce new color hex values. Map every new color to a `--*` token."* There are nine hardcoded hex values here. They also have no relationship to `--success`, `--warning`, or `--brand`. The dark-mode overrides (lines 284–305) correctly use `rgba()` mixes — the light-mode rules should follow the same pattern.

**Principle violated:** DESIGN.md token discipline.

**Fix:**
```css
.ch-type-question {
  background: color-mix(in srgb, var(--success) 10%, transparent);
  color: color-mix(in srgb, var(--success) 80%, var(--text-primary));
  border-color: color-mix(in srgb, var(--success) 28%, transparent);
}
.ch-type-discussion {
  background: color-mix(in srgb, var(--text-secondary) 8%, transparent);
  color: var(--text-secondary);
  border-color: color-mix(in srgb, var(--text-secondary) 20%, transparent);
}
.ch-type-announcement {
  background: color-mix(in srgb, var(--brand) 8%, transparent);
  color: var(--brand);
  border-color: color-mix(in srgb, var(--brand) 22%, transparent);
}
```

---

## Finding 3 — `feed-status-pill.closed` uses off-system hex

**Severity: Inconsistent · Desktop + Mobile**

**Where:** `app/feed.css:796–799`.

```css
.feed-status-pill.closed {
  background: #f1f5f9; /* Tailwind slate-100 — not in design system */
  color: #475569;      /* Tailwind slate-600 — not in design system */
}
```

The dark-mode override at line 813–815 correctly uses `rgba(239, 226, 208, 0.08)` and `var(--text-secondary)`. The light-mode rule breaks that pattern and introduces two new hardcoded colors.

**Principle violated:** DESIGN.md token discipline.

**Fix:**
```css
.feed-status-pill.closed {
  background: color-mix(in srgb, var(--bg-elevated) 80%, transparent);
  color: var(--text-tertiary);
}
```

---

## Finding 4 — Page heading `h1` weight too light for a primary anchor

**Severity: Inconsistent · Desktop + Mobile**

**Where:** `app/feed.css:44–49`. "Resume Feed" renders at Syne 400 weight, 36px. In screenshot `desktop/feed.png`, the heading visually blends into the description text below it — there is no weight contrast to signal hierarchy.

```css
.feed-route-header h1 {
  font-family: var(--font-display);
  font-size: 36px;
  font-weight: 400; /* too light */
  line-height: 1;
}
```

**Principle violated:** Typography confidence (Resend) — Resend's page titles use 500–600 minimum. A 400-weight display heading at 36px only works when the size itself creates the contrast (e.g., 72px+). At 36px, it reads as uncertain.

**Fix:** Change to `font-weight: 600`. Syne supports 400–800 variable weight; 600 still feels elegant without being heavy.

---

## Finding 5 — Feed card titles at weight 500 don't stand out from body copy

**Severity: Inconsistent · Desktop + Mobile**

**Where:** `app/feed.css:744–747`.

```css
.post-title-link h2 {
  font-size: clamp(18px, 1.35vw, 21px);
  font-weight: 500; /* insufficient contrast from body copy below */
}
```

On a content feed, the card title is the primary interaction target. Reddit Sans 500 at 18–21px sits too close to the 15px body text in visual weight. Screenshot `desktop/feed.png` — titles and snippets visually merge.

**Principle violated:** Visual hierarchy (Apple) — content-first density (Reddit). Reddit itself uses 600+ weight for post titles.

**Fix:** Change to `font-weight: 600`.

---

## Finding 6 — `recent-posts-panel` uses hardcoded `12px` border-radius instead of token

**Severity: Polish · Desktop only (rail hidden on mobile)**

**Where:** `app/feed.css:1239`.

```css
.recent-posts-panel {
  border-radius: 12px; /* should be var(--radius-lg) = 14px */
}
```

DESIGN.md: `--radius-lg: 14px` — "App panels, repeated card surfaces." The right-rail panel is exactly this surface. A 12px radius looks slightly more compressed than the cards it sits adjacent to.

**Fix:** Change to `border-radius: var(--radius-lg)`.

---

## Finding 7 — PDF viewer and fullscreen reader use hardcoded near-black backgrounds

**Severity: Inconsistent · Desktop + Mobile**

**Where:** `app/feed.css:1712–1715` (preview bar) and `app/feed.css:1932–1943` (fullscreen reader).

```css
.secure-resume-preview-bar { background: #1b1a18; }
.secure-resume-reader      { background: radial-gradient(...), #11110f; }
```

These are custom dark values that don't map to any DESIGN.md token. `--bg-inverse: #1a1916` (light mode) is close but not used. The PDF viewer lives inside `app/feed.css` but applies its own off-system dark palette.

**Principle violated:** DESIGN.md token discipline.

**Fix:**
```css
.secure-resume-preview-bar { background: var(--bg-inverse); }
/* reader stays intentionally darker — define a new token if needed, document in DESIGN.md */
```

---

## Finding 8 — Card inner padding asymmetric (14px horizontal vs 16px vertical)

**Severity: Polish · Desktop + Mobile**

**Where:** `app/feed.css:626`.

```css
.post-content {
  padding: 16px 14px; /* 16 vertical, 14 horizontal — mismatched */
}
```

The 2px asymmetry creates content that feels slightly too close to the left and right card edges. Premium SaaS cards (Resend, Linear) use either equal all-around padding or explicitly more horizontal breathing room, not less. In the mobile screenshot `feed(S8+).png`, card content does look edge-cramped.

**Fix:** Change to `padding: 16px 16px` (equal) or `padding: 16px 18px` (more horizontal breathing room).

---

## Finding 9 — Community Highlights Rail sits between header and feed, burying lead content

**Severity: Polish · Desktop + Mobile**

**Where:** `app/feed/page.tsx:105` — `<CommunityHighlightsRail>` is rendered between the page header and the `<ResumeFeed>`. CSS: `.ch-rail { margin-bottom: 20px; }`. The rail renders 3 community post cards.

Looking at screenshot `desktop/feed.png`: the flow is Title → Description → Community Rail → Sort bar → Resume cards. The community rail is lateral content (community posts) inserted before primary content (resumes). This disrupts the primary job: get users to resume cards fast.

**Principle violated:** Content-first density (Reddit) — Reddit surfaces the feed immediately; secondary rails go to the side column.

**Fix (low-effort):** Move `<CommunityHighlightsRail>` below the first 3–5 resume cards (interstitial placement) rather than above all of them. This mirrors how Reddit places promoted/pinned content mid-feed rather than as a gate.

---

## Finding 10 — Feed sort toolbar has no visible active state beyond text color

**Severity: Polish · Desktop + Mobile**

**Where:** `app/feed.css:466–497` — `.feed-sort-trigger`. The active sort (e.g., "Best") shows no filled/background state — the trigger is transparent with `border-color: transparent` until hover. A user scanning the feed cannot tell at a glance which sort is active without reading the text.

Screenshot `desktop/feed.png` — the "Recent" and "Best" sort options are present in a thin bar. Active state relies solely on label position and no visual fill.

**Principle violated:** Visual hierarchy (Apple) — active state must be legible without reading.

**Fix:** Add an active state for the current sort option:
```css
.feed-sort-trigger[aria-current="true"],
.feed-sort-trigger.is-active {
  border-color: color-mix(in srgb, var(--border-default) 80%, transparent);
  background: color-mix(in srgb, var(--bg-elevated) 80%, transparent);
  color: var(--text-primary);
}
```

---

## Summary Table

| # | Finding | Severity | Desktop | Mobile | File:Line |
|---|---------|----------|---------|--------|-----------|
| 1 | Bottom-nav labels truncated ("Commun…") | **Broken** | — | ✅ | `lib/primary-navigation.ts` |
| 2 | CH Rail badge colors use hardcoded hex (9 values) | **Broken** | ✅ | ✅ | `feed.css:260–305` |
| 3 | `closed` pill uses off-system hex | Inconsistent | ✅ | ✅ | `feed.css:796–799` |
| 4 | h1 font-weight 400 — too light for page anchor | Inconsistent | ✅ | ✅ | `feed.css:44–49` |
| 5 | Card titles at weight 500 — merges with body | Inconsistent | ✅ | ✅ | `feed.css:744–747` |
| 6 | `recent-posts-panel` border-radius 12px vs token 14px | Polish | ✅ | — | `feed.css:1239` |
| 7 | PDF viewer backgrounds use hardcoded near-blacks | Inconsistent | ✅ | ✅ | `feed.css:1712`, `1932` |
| 8 | Card padding asymmetric (16px × 14px) | Polish | ✅ | ✅ | `feed.css:626` |
| 9 | Community rail blocks feed — wrong placement | Polish | ✅ | ✅ | `feed/page.tsx:105` |
| 10 | Sort toolbar: active state not visually distinct | Polish | ✅ | ✅ | `feed.css:466–497` |
