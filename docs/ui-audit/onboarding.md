# UI Audit — `/onboarding` (Onboarding Flow)

**Screenshots:** None available — code review only.
**Code roots:** `app/onboarding/page.tsx` · `app/globals.css:1121–1290+`

> **Coverage gap:** No screenshot. Onboarding requires account creation to reach. All findings from static code analysis.

---

## Finding 1 — Onboarding `h1` at `font-weight: 400` with `line-height: 0.95`

**Severity: Inconsistent · Desktop + Mobile**

**Where:** `app/globals.css:1196–1203`.

```css
.onboarding-copy h1 {
  font-family: var(--font-display);
  font-size: clamp(42px, 6vw, 72px);
  font-weight: 400;   /* recurring pattern */
  line-height: 0.95;  /* sub-1, fragile for 2+ line titles */
}
```

The same Syne 400 / sub-1 line-height pattern as every other page heading in the app. At 42–72px, "Welcome aboard" or a multi-word step title could wrap on mobile — at `line-height: 0.95` the descenders and ascenders of adjacent lines will collide. Onboarding is a first-impression flow; typography confidence matters most here.

**Principle violated:** Typography confidence (Resend).

**Fix:** `font-weight: 600; line-height: 1`.

---

## Finding 2 — `onboarding-shell` uses `border-radius: 18px` — between token values

**Severity: Inconsistent · Desktop + Mobile**

**Where:** `app/globals.css:1136`.

```css
.onboarding-shell {
  border-radius: 18px; /* between --radius-lg: 14px and --radius-xl: 20px */
}
```

The main onboarding container card uses 18px. This is the same off-token value used in the leaderboard's `StackedList`. The onboarding shell is the most prominent surface on the page and should use `--radius-xl: 20px` for a rounded, modern card feel.

**Principle violated:** DESIGN.md token discipline.

**Fix:** `border-radius: var(--radius-xl)`.

---

## Finding 3 — Choice cards use `border-radius: 12px` — the recurring 12px vs 14px mismatch

**Severity: Inconsistent · Desktop + Mobile**

**Where:** `app/globals.css:1238`.

```css
.onboarding-choice-card {
  border-radius: 12px;
}
```

Sixth instance of the 12px off-token value (also in feed, community, profile, reviewer hub, and leaderboard panels). The onboarding step cards (goal selection, persona selection) should use `var(--radius-lg): 14px`.

**Principle violated:** DESIGN.md token discipline.

**Fix:** `border-radius: var(--radius-lg)`.

---

## Finding 4 — Choice card icon uses `border-radius: 9px` — between `--radius-sm: 6px` and `--radius-md: 10px`

**Severity: Polish · Desktop + Mobile**

**Where:** `app/globals.css:1280`.

```css
.onboarding-choice-icon {
  border-radius: 9px; /* between --radius-sm: 6px and --radius-md: 10px */
}
```

The small icon container on each choice card uses 9px. The nearest tokens are `--radius-sm: 6px` (too small for a 34px icon container) and `--radius-md: 10px` (appropriate). Should use `--radius-md`.

**Principle violated:** DESIGN.md token discipline.

**Fix:** `border-radius: var(--radius-md)`.

---

## Summary Table

| # | Finding | Severity | File:Line |
|---|---------|----------|-----------|
| 1 | Onboarding h1 at Syne weight 400; line-height 0.95 fragile | Inconsistent | `globals.css:1196–1203` |
| 2 | Shell container `border-radius: 18px` — off-token | Inconsistent | `globals.css:1136` |
| 3 | Choice cards `border-radius: 12px` — off-token (recurring 12px issue) | Inconsistent | `globals.css:1238` |
| 4 | Choice icon `border-radius: 9px` — between token values | Polish | `globals.css:1280` |
