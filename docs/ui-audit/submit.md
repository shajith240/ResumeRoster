# UI Audit — `/submit` (Submit Resume)

**Screenshots:** `desktop/linted.space_feed (2).png` (light mode) · `mobile/linted.space_feed(Samsung Galaxy S8+) (2).png` (dark mode)
**Code roots:** `app/submit/page.tsx` · `app/globals.css:1593–1871` · `components/SubmitResumeForm.tsx`

---

## Finding 1 — `aria-invalid` field feedback uses `--brand` orange instead of `--danger`

**Severity: Broken · Desktop + Mobile**

**Where:** `app/globals.css:1693–1696`.

```css
.field-block textarea[aria-invalid="true"] {
  border-color: color-mix(in srgb, var(--brand) 78%, var(--border-default));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 18%, transparent);
}
```

`aria-invalid="true"` marks a field as invalid — the semantic meaning is "this has an error." But the visual treatment is brand orange (`--brand`), which is the same color used for CTAs, active states, and positive selections. The orange focus ring that normally signals "active/selected" now also signals "invalid" — identical visual language for opposite meanings. Mobile screenshot `feed(S8+) (2).png` shows the form in use; any validation trigger would show brand-orange error rings.

**Principle violated:** Visual hierarchy (Apple) — error and action states must be visually distinct.

**Fix:**
```css
.field-block textarea[aria-invalid="true"] {
  border-color: color-mix(in srgb, var(--danger) 78%, var(--border-default));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--danger) 18%, transparent);
}
```
Apply the same correction to any `input[aria-invalid="true"]` rule.

---

## Finding 2 — `.file-check` and `.privacy-check-clear` use hardcoded green hex

**Severity: Broken · Desktop + Mobile**

**Where:** `app/globals.css:1791–1792` and `app/globals.css:1842–1847`.

```css
.file-check {
  background: #dcfce7; /* same as .badge-open — Tailwind green-100 */
  color: #166534;       /* Tailwind green-800 */
}

.privacy-check-clear {
  border-color: color-mix(in srgb, #22c55e 30%, var(--border-subtle));
}
.privacy-check-clear strong {
  color: #63c987; /* custom green, not in DESIGN.md */
}
```

Four hardcoded green values across two components, none mapping to `--success`. The dark-mode `.badge-open` override already demonstrates the correct pattern using `rgba(103, 211, 145, 0.16)`. Light-mode success states should use `color-mix(in srgb, var(--success) ...)`.

**Principle violated:** DESIGN.md token discipline.

**Fix:**
```css
.file-check {
  background: color-mix(in srgb, var(--success) 12%, transparent);
  color: color-mix(in srgb, var(--success) 80%, var(--text-primary));
}
.privacy-check-clear {
  border-color: color-mix(in srgb, var(--success) 30%, var(--border-subtle));
}
.privacy-check-clear strong {
  color: color-mix(in srgb, var(--success) 76%, var(--text-primary));
}
```

---

## Finding 3 — `.field-validation.is-warning` uses `--brand` for warning text

**Severity: Inconsistent · Desktop + Mobile**

**Where:** `app/globals.css:1689–1691`.

```css
.field-validation.is-warning {
  color: var(--brand);
}
```

Field-level warnings (e.g., character count limits, soft nudges) show in brand orange. DESIGN.md provides `--warning: #c47b1a` (light) / `#efb25d` (dark) specifically for this semantic role. Using `--brand` for warning text makes a warning visually identical to a CTA label or brand emphasis — a semantically wrong mapping.

**Principle violated:** DESIGN.md token discipline; visual hierarchy (Apple).

**Fix:** `color: var(--warning)`.

---

## Finding 4 — Submit form `h1` has no explicit `font-family` — inherits body font

**Severity: Inconsistent · Desktop + Mobile**

**Where:** `app/globals.css:1615–1618`.

```css
.submit-header h1 {
  margin: 0;
  font-size: clamp(34px, 3.5vw, 48px);
  line-height: 0.98; /* also fragile — see below */
}
```

No `font-family` specified. In `.main-app`, `--font-body` resolves to Work Sans. Without an explicit override, `h1` inherits Work Sans, not Syne. Every other page heading in the app explicitly sets `font-family: var(--font-display)` (Syne). "Submit Anonymously" is visually the odd one out. Desktop screenshot `feed (2).png` — the heading style looks correct at first glance (it's a large font), but it's Work Sans where Syne is expected.

Additionally, `line-height: 0.98` is the same fragile sub-1 value flagged in the community page — safe only while the heading stays on one line.

**Principle violated:** Typography confidence (Resend) — all page-level display headings should use the same typeface system.

**Fix:**
```css
.submit-header h1 {
  font-family: var(--font-display);
  font-weight: 600;
  line-height: 1;
}
```

---

## Finding 5 — Two-column layout places supporting options (right) wider than primary content (left)

**Severity: Inconsistent · Desktop only**

**Where:** `app/globals.css:1637–1644`.

```css
.submit-form-grid {
  grid-template-columns: minmax(310px, 0.86fr) minmax(440px, 1.14fr);
}
```

The left column (narrower, 0.86fr) contains: Resume title, Target role, PDF upload — the primary inputs the user is completing. The right column (wider, 1.14fr) contains: Review Plan (radio), Privacy Mode (radio), Submit — supporting options and a button. The important content gets the smaller column.

Desktop screenshot `feed (2).png` confirms: the PDF dropzone and role chips feel cramped in the left column while the right column's radios have generous space.

**Principle violated:** Visual hierarchy (Apple) — the widest column should contain the most important content.

**Fix:** Swap the column ratio — make the primary-content column the dominant one:
```css
.submit-form-grid {
  grid-template-columns: minmax(440px, 1.14fr) minmax(310px, 0.86fr);
}
```
This requires reordering the columns in `SubmitResumeForm.tsx` accordingly.

---

## Finding 6 — Role picker selected state uses hardcoded `color: white`

**Severity: Polish · Desktop + Mobile**

**Where:** `app/globals.css:1728–1732`.

```css
.role-picker button.selected {
  border-color: var(--brand);
  background: var(--brand);
  color: white; /* should be var(--text-inverse) */
}
```

`color: white` hardcodes the text color instead of using `var(--text-inverse)` which is `#f2efe9` in light mode and `#111317` in dark mode. While white works here (brand orange background), it breaks the design token contract.

**Principle violated:** DESIGN.md token discipline.

**Fix:** `color: var(--text-inverse)`.

---

## Finding 7 — Dropzone dashed border is developer-tier — breaks premium visual register

**Severity: Polish · Desktop + Mobile**

**Where:** `app/globals.css:1738–1753`.

```css
.dropzone {
  border: 2px dashed var(--border-default);
  border-radius: var(--radius-lg);
  background: var(--bg-base);
}
```

Desktop screenshot `feed (2).png` — the PDF dropzone renders as a large dashed-border rectangle with a centered upload icon. Dashed borders are conventional for developer tools and admin UIs, but register as unpolished in a consumer-facing SaaS. Resend, Linear, and Vercel all use solid borders with a tinted background for upload zones.

**Principle violated:** Restraint / premium feel (Resend).

**Fix:**
```css
.dropzone {
  border: 1.5px solid var(--border-default);
  background: color-mix(in srgb, var(--bg-elevated) 60%, var(--bg-base));
}
/* Keep dashed state only for drag-over feedback */
.dropzone.drag-over {
  border: 2px dashed var(--brand);
}
```

---

## Finding 8 — Mobile form extremely long — submit CTA requires excessive scrolling

**Severity: Polish · Mobile only**

**Where:** Layout — mobile screenshot `feed(S8+) (2).png`.

On mobile, `submit-form-grid` collapses to single column (`app/globals.css:4394–4396`). All sections stack: title → role chips → PDF dropzone → JD description → community help context → review plan → privacy mode → submit button. The submit button is at least 5 scrolls from the top of the form on a typical phone. The mobile screenshot also shows "Add a resume title." validation hint appearing below the submit button — placing feedback after the primary action is counterintuitive.

**Principle violated:** Content-first density (Reddit) — mobile forms should prioritize the fewest required taps to submission.

**Fix (medium-effort):** On mobile, move the Review Plan and Privacy Mode sections above the JD/help textareas (which are optional and secondary). The order should be: title → role → PDF → review plan → privacy → submit → (optional) JD + community help below the fold as an expandable accordion.

---

## Summary Table

| # | Finding | Severity | Desktop | Mobile | File:Line |
|---|---------|----------|---------|--------|-----------|
| 1 | `aria-invalid` uses `--brand` instead of `--danger` for error state | **Broken** | ✅ | ✅ | `globals.css:1693–1696` |
| 2 | `.file-check` and `.privacy-check-clear` use hardcoded green hex | **Broken** | ✅ | ✅ | `globals.css:1791`, `1842` |
| 3 | Warning validation text uses `--brand` instead of `--warning` | Inconsistent | ✅ | ✅ | `globals.css:1689–1691` |
| 4 | `h1` missing `font-family` (gets Work Sans, not Syne); line-height 0.98 fragile | Inconsistent | ✅ | ✅ | `globals.css:1615–1618` |
| 5 | Two-column layout: primary content in narrower column | Inconsistent | ✅ | — | `globals.css:1637–1644` |
| 6 | Selected role button uses `color: white` not `var(--text-inverse)` | Polish | ✅ | ✅ | `globals.css:1728–1732` |
| 7 | Dashed dropzone border breaks premium visual register | Polish | ✅ | ✅ | `globals.css:1738–1753` |
| 8 | Mobile form requires 5+ scrolls to reach submit CTA | Polish | — | ✅ | `globals.css:4394–4396` |
