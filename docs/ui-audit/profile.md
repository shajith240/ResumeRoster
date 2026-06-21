# UI Audit — `/profile/[id]` and `/profile/me` (User Profile)

**Screenshots:** `desktop/linted.space_feed (5).png` (dark mode) · `mobile/linted.space_profile_4940...(Samsung Galaxy S8+).png` (dark mode)
**Code roots:** `app/profile/[id]/page.tsx` · `components/ProfileDetail.module.css`

---

## Finding 1 — `.roleTag` uses hardcoded purple — a color entirely absent from the design system

**Severity: Broken · Desktop + Mobile**

**Where:** `components/ProfileDetail.module.css:113–125` (light mode) and `1784–1788` (dark mode).

```css
.roleTag {
  border: 1px solid rgba(92, 72, 180, 0.2);
  background: rgba(104, 82, 205, 0.1);
  color: #4230a3;
}
/* dark mode */
:global(body.main-app-dark) .roleTag {
  border-color: rgba(169, 149, 255, 0.24);
  background: rgba(169, 149, 255, 0.12);
  color: #cfc3ff;
}
```

Purple is not present anywhere in DESIGN.md. The warm-neutral palette (`--bg-base: #f2efe9` / `#101114`, brand orange `--brand`) is systematically warm or cool-neutral — purple is a third hue family introduced here with no design-system basis. Desktop screenshot `feed (5).png` — the "Student" role tag appears as a distinct purple pill directly below the username, visually competing with the orange lint-points badge for attention.

**Principle violated:** Restraint in color (Reddit) — the system uses one accent hue (orange). Introducing an unrelated hue breaks the palette contract. DESIGN.md: "Don't introduce new color hex values."

**Fix:** Map the role tag to the existing neutral token system:
```css
.roleTag {
  border: 1px solid var(--border-default);
  background: color-mix(in srgb, var(--bg-elevated) 80%, transparent);
  color: var(--text-secondary);
}
```
Differentiation between role types (Student, Founder, etc.) can be achieved through text content alone — the tag doesn't need a unique color per role.

---

## Finding 2 — Online indicator, reviewer pending badge, and `reviewerPendingBadge` all use different hardcoded greens

**Severity: Broken · Desktop + Mobile**

**Where:**
- `ProfileDetail.module.css:56–60` (online indicator): `background: #22c55e`
- `ProfileDetail.module.css:284–289` (pending badge): `rgba(99, 178, 71, ...)`, `color: #3a8a28`

```css
.onlineIndicator {
  background: #22c55e; /* Tailwind green-500 */
  box-shadow: 0 0 0 1px rgba(21, 128, 61, 0.55), 0 6px 16px rgba(34, 197, 94, 0.28);
}
.reviewerPendingBadge {
  border: 1px solid rgba(99, 178, 71, 0.35);
  background: rgba(99, 178, 71, 0.08);
  color: #3a8a28;
}
```

Two different hardcoded green values for similar semantic meaning ("success/active"). `--success: #2d7a4f` (light) / `#67d391` (dark) is the canonical success color. Neither `#22c55e` nor `#3a8a28` matches it.

**Principle violated:** DESIGN.md token discipline.

**Fix:**
```css
.onlineIndicator {
  background: var(--success);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--success) 55%, transparent),
              0 6px 16px color-mix(in srgb, var(--success) 28%, transparent);
}
.reviewerPendingBadge {
  border: 1px solid color-mix(in srgb, var(--success) 35%, var(--border-subtle));
  background: color-mix(in srgb, var(--success) 8%, transparent);
  color: color-mix(in srgb, var(--success) 80%, var(--text-primary));
}
```

---

## Finding 3 — Gold/trust colors (`#ffd277`, `#77530a`, `#d4a538`) are completely off-system

**Severity: Inconsistent · Desktop + Mobile**

**Where:**
- `ProfileDetail.module.css:421–428` (`.trustedReviewerBadge` gradient): `#77530a`, `#ffd277`
- `ProfileDetail.module.css:505–517` (`.trustApplicationButton`): same gold gradient + `rgba(0, 0, 0, 0.84)` backdrop
- `ProfileDetail.module.css:713–724` (`.trustStatusCard`): `#d4a538`, `rgba(212, 165, 56, ...)`
- `ProfileDetail.module.css:483–484` (`.trustApplyButton` svg): `color: #d4a538`

The trusted reviewer badge is a premium signal requiring visual distinctiveness — a gold treatment makes sense conceptually. However, the implementation uses 5+ raw hex values with no corresponding DESIGN.md entry. If this is an intentional premium token, it belongs in the token system.

**Principle violated:** DESIGN.md token discipline.

**Fix:** Define a premium token set and document it:
```css
/* globals.css :root */
--premium: #c99a14;
--premium-dark: #a87f0e;
--premium-muted: rgba(201, 154, 20, 0.10);
/* body.main-app-dark */
--premium: #ffd277;
--premium-dark: #e6b850;
--premium-muted: rgba(255, 210, 119, 0.12);
```
Then add `--premium` to DESIGN.md's "Brand / Accent Colors" table as the premium/trust color variant.

---

## Finding 4 — Panel section headings at `font-weight: 400` in Syne — weak for section anchors

**Severity: Inconsistent · Desktop + Mobile**

**Where:** `components/ProfileDetail.module.css:345–354`.

```css
.panelHeader h2,
.aboutPanel h2,
.reviewerPanel h2,
.skillsPanel h2 {
  font-family: var(--font-display);
  font-size: 25px;
  font-weight: 400;
}
```

"About Me", "Top Skills", "Recent Activity" headings render at Syne 400 weight at 25px. At this size, 400 weight is too light to anchor a panel section. Desktop screenshot `feed (5).png` — these section headings are visually barely heavier than the content below them. Compare to Resend's app where section labels at similar sizes use 500–600 weight.

**Principle violated:** Typography confidence (Resend).

**Fix:** `font-weight: 600`.

---

## Finding 5 — Profile panels use hardcoded `12px` border-radius instead of `--radius-lg: 14px`

**Severity: Inconsistent · Desktop + Mobile**

**Where:** `components/ProfileDetail.module.css:339`.

```css
.aboutPanel,
.skillsPanel,
.reviewerPanel,
.activityPanel,
.reviewsPanel {
  border-radius: 12px; /* --radius-lg is 14px */
}
```

This is the third location with this 12px vs 14px mismatch (also flagged in feed's `recent-posts-panel` and community's panel). All "app panels / repeated card surfaces" should use `var(--radius-lg)`.

**Principle violated:** DESIGN.md token discipline.

**Fix:** `border-radius: var(--radius-lg)`.

---

## Finding 6 — Edit-form textareas use the secondary shadcn HSL token layer instead of semantic tokens

**Severity: Inconsistent · Desktop + Mobile**

**Where:** `components/ProfileDetail.module.css:988–1003`.

```css
.editTextarea,
.highlightSelectTrigger {
  border: 1px solid hsl(var(--input));     /* shadcn layer */
  background: hsl(var(--background));      /* shadcn layer */
  color: hsl(var(--foreground));           /* shadcn layer */
}
.editTextarea:focus {
  border-color: hsl(var(--ring));          /* shadcn layer */
  box-shadow: 0 0 0 3px hsl(var(--ring) / 0.2);
}
```

DESIGN.md explicitly states: "prefer the semantic tokens above for all custom CSS" and lists `--border-default`, `--bg-elevated`, `--text-primary` as the primary layer. The shadcn layer (`--input`, `--background`, `--foreground`, `--ring`) is "secondary." The edit profile dialog's form fields use the wrong layer, which means they may not correctly adapt if the primary palette ever changes.

**Principle violated:** DESIGN.md token discipline.

**Fix:**
```css
.editTextarea,
.highlightSelectTrigger {
  border: 1px solid var(--border-default);
  background: var(--bg-elevated);
  color: var(--text-primary);
}
.editTextarea:focus,
.highlightSelectTrigger:focus {
  border-color: var(--border-strong);
  box-shadow: var(--shadow-focus);
}
```

---

## Finding 7 — `.reviewerEditButton` uses three `!important` declarations — specificity debt

**Severity: Inconsistent · Desktop + Mobile**

**Where:** `components/ProfileDetail.module.css:487–491`.

```css
.reviewerEditButton {
  border: 1.5px solid var(--border-strong) !important;
  background: color-mix(in srgb, var(--bg-elevated) 84%, transparent) !important;
  color: var(--text-primary) !important;
}
```

Three `!important` declarations signal an unresolved specificity conflict. The component rendering this button is applying styles that override these without `!important`, forcing the escalation. This is CSS debt that makes future theming of this button error-prone.

**Principle violated:** Consistency — clean cascade is a prerequisite for maintainable design-system compliance.

**Fix:** Investigate the specificity conflict. The button likely inherits from a shared `.btn-*` class that is more specific. Increase `.reviewerEditButton`'s specificity naturally (e.g., add a parent selector or use a more specific class name) rather than using `!important`.

---

## Finding 8 — Mobile: username + tagline horizontally clipped at right edge

**Severity: Polish · Mobile only**

**Where:** Mobile screenshot `profile_4940...(Samsung Galaxy S8+).png` — the username "helpfulfinder" and tagline text visually extend toward the right edge of the screen with very little margin. The `clamp(10px, 2vw, 34px)` canvas padding at narrow widths resolves to 10px, which is very tight at 360px viewport width.

**Principle violated:** Whitespace discipline (Apple) — minimum 16px horizontal margin is standard for mobile content.

**Fix:** Set a minimum canvas horizontal padding of 16px:
```css
/* ProfileDetail.module.css */
.canvas {
  padding: clamp(8px, 1vw, 16px) clamp(16px, 2vw, 34px) clamp(22px, 2vw, 34px);
  /*                              ^ was clamp(10px, ...)                         */
}
```

---

## Summary Table

| # | Finding | Severity | Desktop | Mobile | File:Line |
|---|---------|----------|---------|--------|-----------|
| 1 | `.roleTag` uses hardcoded purple — not in design system | **Broken** | ✅ | ✅ | `ProfileDetail.module.css:113–125` |
| 2 | Online indicator and pending badge use different hardcoded greens | **Broken** | ✅ | ✅ | `module.css:56–60`, `284–289` |
| 3 | Gold trust colors (`#ffd277`, `#d4a538`, etc.) are off-system | Inconsistent | ✅ | ✅ | `module.css:421`, `505`, `713` |
| 4 | Panel section headings at Syne weight 400 — too light | Inconsistent | ✅ | ✅ | `module.css:345–354` |
| 5 | Panel border-radius 12px instead of `--radius-lg: 14px` | Inconsistent | ✅ | ✅ | `module.css:339` |
| 6 | Edit-form textareas use shadcn HSL tokens instead of semantic tokens | Inconsistent | ✅ | ✅ | `module.css:988–1003` |
| 7 | `.reviewerEditButton` has three `!important` declarations | Inconsistent | ✅ | ✅ | `module.css:487–491` |
| 8 | Mobile canvas padding too tight — content clips at right edge | Polish | — | ✅ | `module.css:18` |
