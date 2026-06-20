# Linted Design System — Live Reference

This document describes the design system **as it actually exists in `app/globals.css`**. It is the single source of truth. Do not introduce new color tokens, fonts, or shadow styles without updating this file first.

All variables are CSS custom properties defined in `:root` (light mode) and overridden in `body.main-app-dark` (dark mode).

---

## Background Colors

Alpha-based borders and semi-transparent chrome surfaces rely on these backgrounds — do not swap them for opaque equivalents.

| Variable | Light | Dark |
|---|---|---|
| `--bg-base` | `#f2efe9` | `#101114` |
| `--bg-surface` | `#fafaf8` | `#17191d` |
| `--bg-elevated` | `#ffffff` | `#202329` |
| `--app-canvas-bg` | `#f2efe9` | `#101114` |
| `--app-chrome-bg` | `rgba(242, 239, 233, 0.94)` | `rgba(16, 17, 20, 0.94)` |
| `--app-chrome-solid` | `#f2efe9` | `#101114` |
| `--bg-inverse` | `#1a1916` | `#f3ece1` |

**Surface hierarchy:** `--bg-base` is the outer canvas (body, page). `--bg-surface` is for cards and panels that sit on the canvas. `--bg-elevated` is for inputs, modals, and surfaces that float above cards. `--app-chrome-bg` is used on the sticky header with `backdrop-filter` blur.

**Dark mode note:** The live dark palette is blue-grey (`#101114`, `#17191d`, `#202329`), not warm brown. Do not substitute warm-toned darks.

---

## Text Colors

| Variable | Light | Dark |
|---|---|---|
| `--text-primary` | `#1a1916` | `#f3ece1` |
| `--text-secondary` | `#545048` | `#c8bfb2` |
| `--text-tertiary` | `#807a70` | `#8f877d` |
| `--text-inverse` | `#f2efe9` | `#111317` |

**Usage:** `--text-primary` for headings and body copy. `--text-secondary` for supporting labels, descriptions, and metadata. `--text-tertiary` for timestamps, captions, and inactive states. `--text-inverse` for text on `--bg-inverse` or brand-colored surfaces.

---

## Brand / Accent Colors

| Variable | Light | Dark |
|---|---|---|
| `--brand` | `#e85d26` | `#ff8a4d` |
| `--brand-dark` | `#bf4518` | `#ff6f30` |
| `--brand-muted` | `#f5e6de` | `rgba(255, 138, 77, 0.16)` |

**Hover direction:** Interactive elements darken on hover — `--brand` → `--brand-dark`. Do not use a lighter orange for hover states.

**Usage:** `--brand` for primary CTAs, active nav, focus rings, selected states, and inline emphasis. `--brand-dark` for hover/pressed states and border accents on brand elements. `--brand-muted` for soft orange background washes (hover cards, note backgrounds).

---

## Border Colors

All borders are **alpha-based rgba values**, not solid hex. This is intentional — borders adapt their apparent weight to whatever surface is behind them.

| Variable | Light | Dark |
|---|---|---|
| `--border-subtle` | `rgba(26, 25, 22, 0.12)` | `rgba(239, 226, 208, 0.09)` |
| `--border-default` | `rgba(26, 25, 22, 0.18)` | `rgba(239, 226, 208, 0.15)` |
| `--border-strong` | `rgba(26, 25, 22, 0.34)` | `rgba(239, 226, 208, 0.30)` |
| `--app-chrome-border` | `rgba(26, 25, 22, 0.11)` | `rgba(239, 226, 208, 0.09)` |

**Usage:** `--border-subtle` for dividers and de-emphasized separators. `--border-default` for card outlines, input borders, and most UI borders. `--border-strong` for focus outlines and emphasis borders. `--app-chrome-border` for the sticky header bottom edge.

Do not replace these with solid hex equivalents — they will look wrong on semi-transparent or colored surfaces.

---

## Shadows

The live shadow system uses a **double-layer drop shadow** technique: a larger diffuse outer shadow plus a smaller tight inner shadow. This creates a soft, natural lift effect. Do not replace them with single-layer shadows or inset-highlight styles.

| Variable | Light | Dark |
|---|---|---|
| `--shadow-sm` | `0 1px 3px rgba(26,25,22,0.08), 0 1px 2px rgba(26,25,22,0.04)` | `none` |
| `--shadow-md` | `0 4px 12px rgba(26,25,22,0.10), 0 2px 4px rgba(26,25,22,0.06)` | `0 14px 38px rgba(0,0,0,0.22)` |
| `--shadow-lg` | `0 12px 32px rgba(26,25,22,0.12), 0 4px 8px rgba(26,25,22,0.06)` | `0 24px 56px rgba(0,0,0,0.34)` |
| `--shadow-focus` | `0 0 0 3px rgba(232, 93, 38, 0.25)` | `0 0 0 3px rgba(255, 138, 77, 0.28)` |

**Dark mode note:** `--shadow-sm` is `none` in dark mode — dark surfaces do not cast soft ambient shadows. Heavier shadows (`--shadow-md`, `--shadow-lg`) are retained for depth-critical elements like modals.

---

## Fonts

Three font families are in use. All are loaded at the top of `globals.css` — Inter and Reddit Sans via Google Fonts, Syne via local `@font-face`.

| Variable | Family | Weights loaded | Where applied |
|---|---|---|---|
| `--font-display` | `"Syne"` | 400–800 (variable) | `.app-logo`, `.big-number`, `.brand-mark-text`, `.auth-wordmark`, `.legal-hero h1`, `.onboarding-copy h1` — all brand/display moments |
| `--font-body` | `"Inter"` → `"Work Sans"` in `.main-app` | 400–900 (Inter), 400–700 (Work Sans) | `body` default; overridden to Work Sans for all app pages via `body.main-app { --font-body: var(--font-app-body) }` |
| `--font-app-body` | `"Work Sans"` | 400–900 | App body text (the effective `--font-body` inside `.main-app`) |
| `--font-post-title` | `"Reddit Sans"` | 400–700 | `h1`, `h2`, `.btn-primary`, `.badge`, `strong`, `b`, `[role="button"]`, `.font-medium/semibold/bold` inside `.main-app` — all emphasis UI text |

**Font hierarchy in the app:**
- Brand/display moments → Syne (`--font-display`)
- Default body copy and inputs → Work Sans (`--font-app-body` via `--font-body`)
- Headings, buttons, badges, labels → Reddit Sans (`--font-post-title`)

**Instrument Serif is not in use.** It is referenced in `DESIGN.md` drafts but is not loaded in `globals.css` and should not be introduced without an explicit decision.

---

## Status Colors

| Variable | Light | Dark |
|---|---|---|
| `--success` | `#2d7a4f` | `#67d391` |
| `--warning` | `#c47b1a` | `#efb25d` |
| `--danger` | `#c4341a` | `#ff746c` |

---

## Border Radius

| Variable | Value | Used for |
|---|---|---|
| `--radius-sm` | `6px` | Small controls, compact badges |
| `--radius-md` | `10px` | Standard inputs, panels |
| `--radius-lg` | `14px` | App panels, repeated card surfaces |
| `--radius-xl` | `20px` | Large feature surfaces, bottom sheets |
| `--radius-pill` | `9999px` | Avatars, chips, status pills |
| `--button-radius` | `10px` | All buttons (equal to `--radius-md`) |
| `--button-radius-sm` | `8px` | Small/compact buttons |

---

## Shadcn / Tailwind HSL Tokens

The project also carries a shadcn-compatible HSL token layer (`--background`, `--foreground`, `--primary`, etc.) used by Tailwind utility classes via `tailwind.config.ts`. These are defined in `:root` and `body.main-app-dark` alongside the above tokens but are secondary — prefer the semantic tokens above for all custom CSS. The Tailwind config also maps `rounded-lg/md/sm` to `--radius-lg/md/sm`.
