# UI Audit — Legal and Static Pages

**Pages covered:** `/accessibility` · `/copyright` · `/guidelines` · `/help` · `/privacy` · `/terms`
**Screenshots:** None available — code review only.
**Code roots:** `app/globals.css:984–1119` (`.legal-*` classes) · individual `app/*/page.tsx` files

> **Coverage gap:** No screenshots. All findings from static code analysis.

---

## Finding 1 — Legal `h1` at `font-weight: 400` with `line-height: 0.95`

**Severity: Inconsistent · Desktop + Mobile**

**Where:** `app/globals.css:1030–1037`.

```css
.legal-hero h1 {
  font-size: clamp(48px, 8vw, 86px);
  font-weight: 400;
  line-height: 0.95;
}
```

The same recurring Syne 400 / sub-1 line-height pattern across the entire app. At 48–86px this is one of the largest headings in the product. "Privacy Policy" (13 characters) stays single-line at all sizes, so `line-height: 0.95` is safe in practice — but "Accessibility Statement" would wrap at narrower widths and overlap at this line-height.

The editorial/thin weight could be argued as intentional for legal documents (a deliberate contrast with the heavy app UI). However, it is inconsistent with the audit standard, which treats weight-400 headings as a systematic weakness.

**Principle violated:** Typography confidence (Resend) — by audit standard. (Note: defensible as intentional editorial style.)

**Fix:** `font-weight: 600; line-height: 1`.

---

## Finding 2 — Notice and disclaimer boxes use `border-radius: 8px` — between token values

**Severity: Polish · Desktop + Mobile**

**Where:** `app/globals.css:1092–1098`.

```css
.legal-notice,
.legal-disclaimer {
  border-radius: 8px; /* between --radius-sm: 6px and --radius-md: 10px */
}
```

The notice box that appears at the top of each legal document (the summary paragraph) uses 8px border-radius — between `--radius-sm: 6px` and `--radius-md: 10px`. Should align to a token.

**Principle violated:** DESIGN.md token discipline.

**Fix:** `border-radius: var(--radius-md)`.

---

## Overall assessment

The legal page CSS is among the cleanest in the codebase. It exclusively uses design tokens for colors (`var(--text-primary)`, `var(--text-secondary)`, `var(--brand)`, `var(--border-subtle)`, `var(--bg-surface)`), uses `color-mix()` for the tinted notice background, and has no hardcoded hex values outside of the heading-weight and border-radius findings above. The `.legal-*` CSS system is well-scoped and token-compliant.

---

## Summary Table

| # | Finding | Severity | File:Line |
|---|---------|----------|-----------|
| 1 | Legal h1 at Syne weight 400 / line-height 0.95 | Inconsistent | `globals.css:1030–1037` |
| 2 | Notice/disclaimer box `border-radius: 8px` — off-token | Polish | `globals.css:1092–1098` |
