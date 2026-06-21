# UI Audit — `/reviewer` (Reviewer Queue)

**Screenshots:** None available — code review only.
**Code roots:** `app/reviewer/page.tsx` · `components/reviewer-hub/ReviewerHub.module.css`

> **Coverage gap:** No screenshot. All findings from static code analysis only; no visual confirmation.

---

## Finding 1 — Dark-mode timer colors bypass semantic tokens with hardcoded hex

**Severity: Broken · Dark mode only**

**Where:** `components/reviewer-hub/ReviewerHub.module.css:267–273`.

```css
.timerWarning {
  color: var(--warning); /* ✅ correct in light mode */
}
.timerUrgent {
  color: var(--danger);  /* ✅ correct in light mode */
}

/* dark mode overrides */
:global(body.main-app-dark) .timerWarning {
  color: #f59e0b; /* ❌ Tailwind amber-500 — bypasses --warning */
}
:global(body.main-app-dark) .timerUrgent {
  color: #ef4444; /* ❌ Tailwind red-500 — bypasses --danger */
}
```

The light-mode rules correctly use `var(--warning)` and `var(--danger)`. The dark-mode overrides replace those tokens with hardcoded Tailwind hex values. DESIGN.md defines `--warning: #efb25d` and `--danger: #e5534b` for dark mode (via `body.main-app-dark`) — neither `#f59e0b` nor `#ef4444` matches those values. If the warning/danger palette ever shifts, the dark-mode timer colors won't track.

**Principle violated:** DESIGN.md token discipline.

**Fix:** Remove the dark-mode overrides entirely — `var(--warning)` and `var(--danger)` already resolve to their dark-mode values when `body.main-app-dark` is set.

---

## Finding 2 — Card group border-radius 12px vs `--radius-lg: 14px`

**Severity: Inconsistent · Desktop + Mobile**

**Where:** `components/reviewer-hub/ReviewerHub.module.css:61` and `238`.

```css
.cardGroup  { border-radius: 12px; }
.skeletonGroup { border-radius: 12px; }
```

Fifth instance of the 12px vs `--radius-lg: 14px` mismatch (also in feed, community, profile, and leaderboard panels).

**Principle violated:** DESIGN.md token discipline.

**Fix:** `border-radius: var(--radius-lg)`.

---

## Finding 3 — Card title at 14px sits below the app's 15px body baseline

**Severity: Polish · Desktop + Mobile**

**Where:** `components/reviewer-hub/ReviewerHub.module.css:89`.

```css
.cardTitle {
  font-size: 14px;
}
```

Resume titles in the reviewer queue are the primary clickable content. At 14px they read slightly smaller than the rest of the app's body text. This is the same finding as community comment body (community-detail.md Finding 5).

**Principle violated:** Typography confidence (Resend).

**Fix:** `font-size: 15px`.

---

## Summary Table

| # | Finding | Severity | File:Line |
|---|---------|----------|-----------|
| 1 | Dark-mode timer uses `#f59e0b`/`#ef4444` instead of `var(--warning)`/`var(--danger)` | **Broken** | `module.css:267–273` |
| 2 | Card group border-radius 12px instead of `--radius-lg: 14px` | Inconsistent | `module.css:61`, `238` |
| 3 | Card title at 14px — below 15px body baseline | Polish | `module.css:89` |
