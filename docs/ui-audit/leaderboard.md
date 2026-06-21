# UI Audit — `/leaderboard` (Leaderboard)

**Screenshots:** `desktop/linted.space_feed (4).png` (dark mode) · `mobile/linted.space_feed(Samsung Galaxy S8+) (4).png` (dark mode)
**Code roots:** `app/leaderboard/page.tsx` · `components/Leaderboard.tsx` · `components/Leaderboard.module.css` · `components/leaderboard/StackedList.tsx` · `app/globals.css:8534–8587`

---

## Finding 1 — Role badge colors introduce three unrelated hue families (purple, blue, green)

**Severity: Broken · Desktop + Mobile**

**Where:** `app/globals.css:8540–8573`.

```css
.lb-tag-student {
  border-color: #D9D0FF;    /* hardcoded purple */
  background: #F1EDFF;
  color: #5137B8;
}
.lb-tag-career {
  border-color: #CBDCFF;    /* hardcoded blue */
  background: #EEF4FF;
  color: #244EA8;
}
.lb-tag-intern {
  border-color: #CBE8DA;    /* hardcoded green */
  background: #EEF9F3;
  color: #1D6F45;
}
.lb-tag-seeker {
  border-color: #F6D794;    /* hardcoded amber */
  background: #FFF3D8;
  color: #8A5B11;
}
```

The leaderboard table shows contributor role tags (Student, Career Switcher, Intern, Job Seeker) in four different hues — purple, blue, green, amber. The design system uses exactly one accent hue (orange `--brand`) with green (`--success`) and amber (`--warning`) as semantic status colors. The purple and blue tag families are entirely new hue introductions with no basis in DESIGN.md.

Desktop screenshot `feed (4).png` — all seven visible rows show role badges: "Student" (purple), "Trusted reviewer" (orange), "Intern" (light green). Three different hue families visible in a single 600px-tall table is visually noisy.

**Principle violated:** Restraint in color (Reddit) — one accent hue, semantic-only status colors. DESIGN.md: "Don't introduce new color hex values."

**Fix:** Collapse all role tags to the neutral token layer. Role type is communicated by the text label itself; the badge color communicates "role" as a concept, not the specific role value:
```css
.lb-tag-student,
.lb-tag-career,
.lb-tag-intern,
.lb-tag-seeker {
  border-color: var(--border-default);
  background: var(--bg-elevated);
  color: var(--text-secondary);
}
body.main-app-dark .lb-tag-student,
body.main-app-dark .lb-tag-career,
body.main-app-dark .lb-tag-intern,
body.main-app-dark .lb-tag-seeker {
  border-color: var(--border-default);
  background: var(--bg-elevated);
  color: var(--text-secondary);
}
```
Keep `.lb-tag-reviewer` with orange to preserve the "trusted" distinction.

---

## Finding 2 — Leaderboard avatar border uses hardcoded gold `rgba(214,179,100,0.52)` inline

**Severity: Broken · Desktop + Mobile**

**Where:** `components/leaderboard/StackedList.tsx:175`.

```jsx
<span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full border border-[rgba(214,179,100,0.52)] bg-[var(--bg-elevated)]">
```

A goldish border `rgba(214,179,100,0.52)` is applied to every avatar in the leaderboard table as a Tailwind arbitrary value. This is a third distinct gold hex value in the codebase (profile page uses `rgba(199, 154, 57, 0.86)` for the avatar frame, and `rgba(212, 165, 56, 0.34)` for the trust card — three different gold values for similar "premium" signals). None are in DESIGN.md.

Desktop screenshot `feed (4).png` — every avatar has a subtle golden ring. The visual intent (making contributors feel special) is clear, but the hardcoded value is not maintainable.

**Principle violated:** DESIGN.md token discipline; if a gold/premium color is intentional across multiple components, it needs a token (see profile audit Finding 3 for the recommended `--premium` token).

**Fix:** Once `--premium` is defined as a token (see profile.md Finding 3), use:
```jsx
<span className="border border-[color-mix(in_srgb,var(--premium)_52%,transparent)]">
```

---

## Finding 3 — Page `h1` at `font-weight: 400` — recurring heading-weight pattern

**Severity: Inconsistent · Desktop + Mobile**

**Where:** `components/Leaderboard.module.css:25`.

```css
.header h1 {
  font-size: clamp(54px, 5vw, 72px);
  font-weight: 400;
  line-height: 0.94;
}
```

"Leaderboard" at 54–72px Syne weight 400. This is the same pattern appearing on every page audited — `/feed`, `/community`, `/submit`, `/community/[id]`, `/profile/[id]`. At this scale, 400 weight makes the page title feel like a monochrome wash rather than a visual anchor. Desktop screenshot `feed (4).png` — the "Leaderboard" heading and the "Top reviewers. Better resumes." subtitle below read at nearly the same visual weight.

**Principle violated:** Typography confidence (Resend).

**Fix:** `font-weight: 600`.

---

## Finding 4 — Table board and loading skeleton use `18px` border-radius — between `--radius-lg` and `--radius-xl`

**Severity: Inconsistent · Desktop + Mobile**

**Where:**
- `components/leaderboard/StackedList.tsx:445` — main board section: `rounded-[18px]` (Tailwind arbitrary)
- `components/leaderboard/StackedList.tsx:518` — directory button: `rounded-[18px]`
- `components/leaderboard/StackedList.tsx:546` — directory panel: `rounded-[16px]`
- `components/Leaderboard.module.css:188` — `.loadingBoard`: `border-radius: 18px`
- `components/Leaderboard.module.css:335` — `.loadingDirectory`: `border-radius: 18px`

Five separate instances of 18px or 16px border-radius — both off-token (between `--radius-lg: 14px` and `--radius-xl: 20px`). The leaderboard board is the largest card surface on the page; it should use `--radius-xl: 20px` to match the visual register of prominent panels.

**Principle violated:** DESIGN.md token discipline.

**Fix:**
```jsx
/* StackedList.tsx */
<section className="... rounded-[var(--radius-xl)] ...">
/* directory button */
<motion.button className="... rounded-[var(--radius-xl)] ...">
/* directory panel */
<motion.section className="... rounded-[var(--radius-lg)] ...">
```
```css
/* Leaderboard.module.css */
.loadingBoard  { border-radius: var(--radius-xl); }
.loadingDirectory { border-radius: var(--radius-xl); }
```

---

## Finding 5 — Mobile scrollable table max-height doesn't account for bottom dock — row #5 obscured

**Severity: Polish · Mobile only**

**Where:** `components/leaderboard/StackedList.tsx:487` — `className="max-h-[min(62vh,720px)] overflow-y-auto"`.

The scrollable table body is capped at `min(62vh, 720px)`. On the Samsung Galaxy S8+ (360×740px), `62vh` = ~458px. The bottom dock (`--mobile-dock-space`) is approximately 72px tall. The table scrollable area uses all available viewport height without subtracting the dock, so the last visible row gets hidden behind the fixed navigation.

Mobile screenshot `feed(S8+) (4).png` confirms: rows #1–#4 are visible, the bottom nav dock appears, and row #6 is visible below — meaning row #5 is behind the dock.

**Principle violated:** Whitespace discipline (Apple) — content must not hide behind fixed UI elements.

**Fix:** Subtract the mobile dock from the max-height:
```jsx
<div
  className="overflow-y-auto [scrollbar-gutter:stable]"
  style={{ maxHeight: "min(62vh, 720px)", paddingBottom: "var(--mobile-dock-space, 0px)" }}
>
```
Or use `@media (max-width: 1024px)` to adjust the `max-h` class:
```jsx
// Add to StackedList.tsx className
"max-h-[min(62vh,720px)] max-[1024px]:max-h-[calc(min(62vh,720px)-var(--mobile-dock-space,0px))]"
```

---

## Finding 6 — `lb-tag-reviewer` border uses hardcoded `rgba(255,184,95,0.34)` instead of `color-mix`

**Severity: Polish · Desktop + Mobile**

**Where:** `app/globals.css:8535`.

```css
.lb-tag-reviewer {
  border-color: rgba(255, 184, 95, 0.34); /* hardcoded brand-adjacent orange */
  background: var(--brand-muted);
  color: var(--brand);
}
```

Background and text correctly use `--brand-muted` and `--brand` tokens. The border breaks the pattern with a hardcoded orange hex. Consistent with fixing the one-off violation:

```css
.lb-tag-reviewer {
  border-color: color-mix(in srgb, var(--brand) 34%, transparent);
  background: var(--brand-muted);
  color: var(--brand);
}
```

---

## Summary Table

| # | Finding | Severity | Desktop | Mobile | File:Line |
|---|---------|----------|---------|--------|-----------|
| 1 | Role badges use purple/blue/green/amber hex — three new hue families | **Broken** | ✅ | ✅ | `globals.css:8540–8573` |
| 2 | Avatar border uses hardcoded gold `rgba(214,179,100,0.52)` | **Broken** | ✅ | ✅ | `StackedList.tsx:175` |
| 3 | Page `h1` at Syne weight 400 | Inconsistent | ✅ | ✅ | `Leaderboard.module.css:25` |
| 4 | Board, skeleton, and directory use `18px`/`16px` border-radius | Inconsistent | ✅ | ✅ | `StackedList.tsx:445`, `518`, `546`; `module.css:188`, `335` |
| 5 | Mobile table max-height doesn't subtract bottom dock — row obscured | Polish | — | ✅ | `StackedList.tsx:487` |
| 6 | `.lb-tag-reviewer` border uses hardcoded `rgba(255,184,95,...)` | Polish | ✅ | ✅ | `globals.css:8535` |
