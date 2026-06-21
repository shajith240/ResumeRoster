# UI Audit — `/admin` and `/admin/[section]` (Admin Dashboard)

**Screenshots:** None available — admin-only route, code review only.
**Code roots:** `app/admin/page.tsx` · `app/admin/[section]/page.tsx` · `app/admin.css`

> **Coverage gap:** No screenshot. Internal admin tool. All findings from static code analysis.

---

## Finding 1 — Live user count badge uses hardcoded green hex

**Severity: Broken · All modes**

**Where:** `app/admin.css:992–1004`.

```css
.admin-live-count {
  border: 1px solid rgba(34, 197, 94, 0.28); /* Tailwind green-500 */
  background: rgba(34, 197, 94, 0.1);
  color: #86efac; /* Tailwind green-300 */
}
```

`rgba(34, 197, 94, ...)` is Tailwind `green-500` — same hardcoded green appearing in `.badge-open` and `.onlineIndicator`. `#86efac` (Tailwind green-300) is a different shade used for the text color. Neither maps to `--success: #67d391` in dark mode. The live user count is always displayed against the dark admin UI, so this is a dark-mode-only component with no token coverage.

**Principle violated:** DESIGN.md token discipline.

**Fix:**
```css
.admin-live-count {
  border: 1px solid color-mix(in srgb, var(--success) 28%, transparent);
  background: color-mix(in srgb, var(--success) 10%, transparent);
  color: var(--success);
}
```

---

## Finding 2 — Priority and status pills use hardcoded red/pink hex

**Severity: Broken · All modes**

**Where:** `app/admin.css:882–890` and `1183–1207`.

```css
.admin-pill-warn, .admin-priority-high {
  /* uses var(--brand) — correct ✅ */
}
.admin-priority-urgent {
  border-color: rgba(248, 113, 113, 0.45); /* Tailwind red-400 */
  color: #fecaca; /* Tailwind red-200 */
}
.admin-message-field input[aria-invalid="true"] {
  border-color: rgba(248, 113, 113, 0.55);
}
.admin-message-confirm {
  border: 1px solid rgba(248, 113, 113, 0.3);
  background: rgba(248, 113, 113, 0.08);
}
```

`rgba(248, 113, 113, ...)` is Tailwind `red-400` — not mapped to `var(--danger)`. `#fecaca` is Tailwind `red-200` — also not the dark-mode `--danger` value. The `aria-invalid` border and the confirmation dialog use the same hardcoded red. Consistent with the pattern found across submit form and profile pages.

**Principle violated:** DESIGN.md token discipline.

**Fix:**
```css
.admin-priority-urgent {
  border-color: color-mix(in srgb, var(--danger) 45%, transparent);
  color: var(--danger);
}
.admin-message-field input[aria-invalid="true"] {
  border-color: color-mix(in srgb, var(--danger) 55%, transparent);
}
.admin-message-confirm {
  border: 1px solid color-mix(in srgb, var(--danger) 30%, transparent);
  background: color-mix(in srgb, var(--danger) 8%, transparent);
}
```

---

## Finding 3 — `.admin-pill-gold` reuses the undocumented gold color from profile trust badge

**Severity: Inconsistent · All modes**

**Where:** `app/admin.css:882–885`.

```css
.admin-pill-gold {
  border-color: rgba(212, 165, 56, 0.34);
  color: #d4a538;
}
```

Same `#d4a538` gold used in `ProfileDetail.module.css:713` for the trust status card. Both would be fixed together when `--premium` is defined (see profile.md Finding 3). The admin pill is an indication of "trusted reviewer" or premium status.

**Principle violated:** DESIGN.md token discipline.

**Fix:** Once `--premium` token is defined, use:
```css
.admin-pill-gold {
  border-color: color-mix(in srgb, var(--premium) 34%, transparent);
  color: var(--premium);
}
```

---

## Finding 4 — Admin local token system (`--admin-*`) is not documented in DESIGN.md

**Severity: Inconsistent · All modes**

**Where:** `app/admin.css:4–6`.

```css
.admin-route {
  --admin-panel-bg: color-mix(in srgb, var(--bg-surface) 84%, var(--bg-base));
  --admin-panel-strong-bg: color-mix(in srgb, var(--bg-elevated) 72%, var(--bg-base));
  --admin-hairline: color-mix(in srgb, var(--border-subtle) 78%, transparent);
}
```

The admin dashboard defines three scoped local tokens. These are a reasonable pattern — they keep admin-specific values co-located and derived from primary tokens. However, DESIGN.md states it is "the single source of truth for all design decisions." These local tokens are not mentioned anywhere in DESIGN.md.

**Principle violated:** DESIGN.md token discipline — documentation completeness.

**Fix:** Add a "Scoped Tokens" section to DESIGN.md documenting the `--admin-*` token pattern, purpose, and the fact that they're derived from primary tokens rather than introducing new raw values.

---

## Summary Table

| # | Finding | Severity | File:Line |
|---|---------|----------|-----------|
| 1 | Live user count uses hardcoded Tailwind green `rgba(34,197,94,...)`, `#86efac` | **Broken** | `admin.css:992–1004` |
| 2 | Priority urgent, `aria-invalid`, and confirm dialog use hardcoded `rgba(248,113,113,...)` | **Broken** | `admin.css:884–890`, `1183–1207` |
| 3 | `.admin-pill-gold` reuses undocumented gold `#d4a538` — same as profile trust badge | Inconsistent | `admin.css:882–885` |
| 4 | Admin local token system (`--admin-*`) undocumented in DESIGN.md | Inconsistent | `admin.css:4–6` |
