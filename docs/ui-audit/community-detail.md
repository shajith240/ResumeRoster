# UI Audit — `/community/[id]` (Community Post Detail)

**Screenshots:** `desktop/linted.space_feed (7).png` (dark mode) · No mobile screenshot available
**Code roots:** `app/community/[id]/page.tsx` · `app/globals.css:3552–4022`

> **Coverage gap:** No mobile screenshot for this route. Desktop-only visual assessment; mobile findings from code review only.

---

## Finding 1 — `--bg-muted` is an undefined token — deleted comment backgrounds silently fail

**Severity: Broken · Desktop + Mobile**

**Where:** `app/globals.css:3914`.

```css
.community-comment-item.is-deleted {
  background: color-mix(in srgb, var(--bg-base) 78%, var(--bg-muted));
}
```

`--bg-muted` does not exist in DESIGN.md or in `globals.css`'s `:root` block. When a CSS custom property is undefined, `color-mix()` treats it as the initial value for `<color>` which is `transparent`. The effective result is `color-mix(in srgb, var(--bg-base) 78%, transparent)` — functionally equivalent to `color-mix(in srgb, #101114 78%, transparent)` in dark mode. The deleted-comment visual state silently renders incorrectly in both themes.

**Principle violated:** DESIGN.md token discipline — "Map every new color to a `--*` token."

**Fix:** Either define the missing token in `globals.css`:
```css
:root { --bg-muted: #f0ece6; }
body.main-app-dark { --bg-muted: rgba(239, 226, 208, 0.06); }
```
Or replace with an existing token: `background: color-mix(in srgb, var(--bg-base) 78%, var(--bg-surface))`.

---

## Finding 2 — Post detail `h1` at weight 500 — recurring heading-weight issue

**Severity: Inconsistent · Desktop**

**Where:** `app/globals.css:3668–3672`.

```css
.community-post-detail h1 {
  font-size: clamp(24px, 2.6vw, 34px);
  font-weight: 500;
}
```

This is the third instance of the app-wide heading-weight problem (also in `/feed` h1 and `/community` h1). In the post detail view, the title is the page's single most important piece of text. At weight 500 in Reddit Sans, "Are clone projects bad?" does not read as a primary heading — it blends with the body copy below at similar weight and size. Desktop screenshot `feed (7).png` confirms the flat visual hierarchy between title and body.

**Principle violated:** Typography confidence (Resend) — headline weight must clearly dominate body copy.

**Fix:** Change to `font-weight: 600`.

---

## Finding 3 — Comment composer and reply composer use off-token border radii

**Severity: Inconsistent · Desktop + Mobile**

**Where:** `app/globals.css:3817` (main composer) and `app/globals.css:3835` (reply composer).

```css
.community-comment-composer {
  border-radius: 18px; /* between --radius-lg (14px) and --radius-xl (20px) */
}
.community-comment-composer.is-reply {
  border-radius: 16px; /* also between tokens */
}
```

DESIGN.md token set: 6, 10, 14, 20px (and pill). Both 18px and 16px fall between tokens. The main composer should use `--radius-xl: 20px` (the rounded "chat input" feel); the reply composer can use `--radius-lg: 14px` (compact reply).

**Principle violated:** DESIGN.md token discipline.

**Fix:**
```css
.community-comment-composer { border-radius: var(--radius-xl); }
.community-comment-composer.is-reply { border-radius: var(--radius-lg); }
```

---

## Finding 4 — `community-detail-toolbar` uses negative margin-bottom as a layout spacer

**Severity: Inconsistent · Desktop + Mobile**

**Where:** `app/globals.css:3981–3988`.

```css
.community-detail-toolbar {
  order: 0;
  min-height: 32px;
  margin-bottom: -6px; /* spacer hack */
}
```

The `-6px` negative margin collapses the gap between the back button and the post content below. This works until any element in the post header adds top margin — at which point the back button visually overlaps or the gap is unpredictable. The parent `.community-post-detail` uses `gap: 18px` — a negative margin-bottom on a child partially cancels that gap.

**Principle violated:** Visual hierarchy (Apple) — layout should be explicit and not rely on margin collapse or negative-margin hacks.

**Fix:** Remove `margin-bottom: -6px` and instead reduce the parent grid gap or use `row-gap` adjustment:
```css
.community-post-detail {
  gap: 12px; /* was 18px — reduce to account for back button */
}
.community-detail-toolbar { margin-bottom: 0; }
```

---

## Finding 5 — Comment body font-size 14px sits below the app's 15px body baseline

**Severity: Polish · Desktop + Mobile**

**Where:** `app/globals.css:3941`.

```css
.community-comment-body {
  font-size: 14px;
  line-height: 1.6;
}
```

The rest of the app uses 15px for primary body copy. Comment text is substantive content — it should be at the body baseline, not smaller. 14px is enough to feel like a downgrade in readability, especially for longer comments. Desktop screenshot `feed (7).png` — the single comment visible reads comfortably, but in a dense thread 14px would tire quickly.

**Principle violated:** Typography confidence (Resend) — body text size should not vary between content contexts without a strong reason.

**Fix:** Change to `font-size: 15px`.

---

## Finding 6 — "Report" button in action row has same resting state as "Share"

**Severity: Polish · Desktop**

**Where:** `app/globals.css:3958–3964` — `.community-action-button` styling applied uniformly to all action buttons including "Report".

In the desktop screenshot `feed (7).png`, the post action bar shows vote controls, comment count, Share, and Report — all using the same `.community-action-button` pill style. The `.is-danger` modifier correctly fires `--danger` color on hover, but in resting state "Report" is visually identical to "Share". A user who fat-fingers "Report" instead of "Share" has no visual cue they're about to flag content.

**Principle violated:** Visual hierarchy (Apple) — destructive/sensitive actions should have persistent visual de-emphasis.

**Fix:** Add a resting-state style for danger actions:
```css
.community-action-button.is-danger {
  color: var(--text-tertiary);
  border-color: transparent;
  background: transparent;
}
```

---

## Summary Table

| # | Finding | Severity | Desktop | Mobile | File:Line |
|---|---------|----------|---------|--------|-----------|
| 1 | `--bg-muted` undefined token — deleted comments render incorrectly | **Broken** | ✅ | ✅ | `globals.css:3914` |
| 2 | Post h1 at weight 500 — flat hierarchy vs body text | Inconsistent | ✅ | — | `globals.css:3668–3672` |
| 3 | Composer/reply border-radius 18px/16px — off-token values | Inconsistent | ✅ | ✅ | `globals.css:3817`, `3835` |
| 4 | Back-button toolbar uses `margin-bottom: -6px` layout hack | Inconsistent | ✅ | ✅ | `globals.css:3987` |
| 5 | Comment body at 14px — below app body baseline of 15px | Polish | ✅ | ✅ | `globals.css:3941` |
| 6 | "Report" button indistinguishable from "Share" at rest | Polish | ✅ | — | `globals.css:3958–3964` |
