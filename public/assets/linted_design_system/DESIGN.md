# Linted Design System

> Warm career debugging workspace - serious community UI with orange as the signal color.

## Current Implementation Note

The live app currently preserves the original Linted color and font identity. The only design-system value applied globally from this pass is the gentler radius scale: `--radius-lg: 14px` and `--radius-xl: 20px`.

Do not import the experimental `variables.css` or `theme.css` into the app until we intentionally decide to revisit colors.

## Theme

Linted should feel like a focused product for people who are trying to make better career decisions in public. The visual system is warm, direct, and structured: off-white canvas, white surfaces, ink text, hairline borders, low shadows, and one orange signal color for action and emphasis.

The system borrows the discipline of developer-tool pages without copying their API-console identity. Linted can use "debugging" language, but the product visuals should show career signals: questions, resumes, answers, votes, redaction, reviewer trust, and community quality.

## Design Principles

1. **Orange is signal, not decoration.**
   Use orange for primary actions, selected states, active navigation, helpful emphasis, and one highlighted word in a headline.

2. **Flat surfaces beat floating cards.**
   Use white surfaces, warm canvas, thin borders, and restrained inset shadows. Avoid heavy elevation and decorative gradients.

3. **Reddit Sans is the product voice.**
   Use Reddit Sans for UI, body text, posts, navigation, labels, and controls. It keeps the community product readable and familiar without making the UI look copied from Reddit.

4. **Instrument Serif is editorial emphasis.**
   Use Instrument Serif for landing headlines, brand moments, and short expressive section titles. Do not use it in dense app controls, tables, comments, or long body copy.

5. **Community UI must feel structured, not forum-generic.**
   Posts, votes, comments, and feeds are core mechanics, but Linted should present them as career debugging workflows: ask, review, vote, improve, and build trust.

6. **Dark theme stays warm.**
   Dark mode should not become blue-slate. It uses near-black warm surfaces, warm paper text, restrained borders, and a brighter orange that still feels related to the light theme.

## Color Tokens

| Name | Value | Token | Role |
| --- | --- | --- | --- |
| Paper Canvas | `#fafaf8` | `--linted-paper` | Main light page background |
| Warm Canvas | `#f4f1eb` | `--linted-canvas` | App canvas and chrome background |
| Surface | `#ffffff` | `--linted-surface` | Cards, dialogs, inputs, elevated panels |
| Pebble | `#efede8` | `--linted-pebble` | Muted bands, selected quiet states |
| Linen Border | `#e4e1da` | `--linted-border` | Hairline borders and separators |
| Ash Border | `#d5d0c7` | `--linted-border-strong` | Stronger borders, focus outlines when neutral |
| Ink | `#17130f` | `--linted-ink` | Primary text |
| Carbon | `#3f3932` | `--linted-carbon` | Secondary strong text |
| Slate | `#625b52` | `--linted-slate` | Muted text and metadata |
| Stone | `#8a8176` | `--linted-stone` | Tertiary text and inactive controls |
| Orange | `#e85d26` | `--linted-orange` | Primary brand signal and CTA |
| Orange Hover | `#f26b32` | `--linted-orange-hover` | Hover and active feedback |
| Orange Deep | `#bf4518` | `--linted-orange-deep` | Strong borders, dark-on-light accents |
| Orange Wash | `#f7e4da` | `--linted-orange-wash` | Soft orange backgrounds |
| Success | `#2d7a4f` | `--linted-success` | Positive status only |
| Warning | `#b86f13` | `--linted-warning` | Caution status only |
| Danger | `#c4341a` | `--linted-danger` | Destructive status only |

## Dark Color Tokens

| Name | Value | Token | Role |
| --- | --- | --- | --- |
| Dark Canvas | `#100f0e` | `--linted-dark-canvas` | Main dark app background |
| Dark Surface | `#171513` | `--linted-dark-surface` | Panels and page surfaces |
| Dark Elevated | `#211f1c` | `--linted-dark-elevated` | Dialogs, inputs, raised surfaces |
| Dark Chrome | `#100f0e` | `--linted-dark-chrome` | Header and nav chrome |
| Paper Text | `#f7f1e8` | `--linted-dark-ink` | Primary dark text |
| Warm Muted | `#c9bfb2` | `--linted-dark-slate` | Secondary dark text |
| Warm Tertiary | `#90877b` | `--linted-dark-stone` | Tertiary dark text |
| Dark Orange | `#ff864d` | `--linted-dark-orange` | Primary dark signal |
| Dark Orange Hover | `#ff9a63` | `--linted-dark-orange-hover` | Hover and active dark signal |

## Typography

### Reddit Sans

- Token: `--font-ui`
- Use for: UI, app body, posts, comments, buttons, nav, forms, labels, and dense product surfaces.
- Weights: 400, 500, 600, 700.
- Default body size: 15-16px.

### Instrument Serif

- Token: `--font-display`
- Use for: landing hero, editorial headings, brand statements, and occasional high-emotion copy.
- Weights: regular and italic.
- Avoid in: feed rows, comments, forms, admin screens, dropdowns, and small labels.

### Type Scale

| Role | Size | Line Height | Weight | Font |
| --- | --- | --- | --- | --- |
| Caption | 12px | 1.5 | 500 | Reddit Sans |
| Label | 13px | 1.4 | 600 | Reddit Sans |
| Body Small | 14px | 1.55 | 400 | Reddit Sans |
| Body | 16px | 1.55 | 400 | Reddit Sans |
| UI Title | 18px | 1.35 | 600 | Reddit Sans |
| Section Heading | 32px | 1.12 | 400 | Instrument Serif |
| Page Heading | 44px | 1.05 | 400 | Instrument Serif |
| Hero Display | 64px | 0.98 | 400 | Instrument Serif |

## Spacing

The base unit is 4px. Keep spacing predictable and avoid one-off values unless a layout truly needs them.

| Token | Value | Role |
| --- | --- | --- |
| `--space-1` | 4px | Tight inline gap |
| `--space-2` | 8px | Small control gap |
| `--space-3` | 12px | Compact group gap |
| `--space-4` | 16px | Default internal gap |
| `--space-5` | 20px | Medium group gap |
| `--space-6` | 24px | Card and section padding |
| `--space-8` | 32px | Large group gap |
| `--space-10` | 40px | Section rhythm |
| `--space-12` | 48px | Landing section gap |
| `--space-16` | 64px | Large landing gap |

## Radius

Keep the app sharper than a generic SaaS dashboard.

| Token | Value | Role |
| --- | --- | --- |
| `--radius-sm` | 6px | Small controls and badges |
| `--radius-md` | 10px | Buttons, inputs, compact panels |
| `--radius-lg` | 14px | App panels and repeated surfaces |
| `--radius-xl` | 20px | Large feature surfaces |
| `--radius-pill` | 9999px | Avatars, chips, compact status pills only |

## Shadows

Use shadows to separate surfaces, not to decorate them.

| Token | Value | Role |
| --- | --- | --- |
| `--shadow-sm` | `0 1px 2px rgba(23, 19, 15, 0.06), 0 1px 0 rgba(255, 255, 255, 0.7) inset` | Buttons, subtle panels |
| `--shadow-md` | `0 8px 24px rgba(23, 19, 15, 0.08), 0 1px 0 rgba(255, 255, 255, 0.72) inset` | Dialogs, menus |
| `--shadow-lg` | `0 18px 44px rgba(23, 19, 15, 0.12)` | Rare overlays |
| `--shadow-focus` | `0 0 0 3px rgba(232, 93, 38, 0.24)` | Focus ring |

## Component Direction

This pass does not add new component layouts. These rules define how future components should feel:

- Buttons: orange filled primary, neutral ghost/outline secondary, low radius, no gradient.
- Badges: small, readable, neutral by default. Orange only for active or product-critical labels.
- Post rows: structured career artifacts, not generic forum rows.
- Resume panels: privacy-first, redaction-aware, focused on fixes.
- Leaderboards: trust and contribution, not game clutter.
- Empty states: direct, helpful, and action-oriented.

## Do

- Use Reddit Sans as the default app font.
- Use Instrument Serif for landing display moments.
- Keep orange as the only brand accent.
- Use warm canvas, white surfaces, and hairline borders.
- Keep dark mode warm and readable.
- Scope future experiments before globalizing them.

## Do Not

- Do not import another brand's tokens directly.
- Do not make the app look like Reddit, even though the font and community mechanics overlap.
- Do not use blue-slate as the dark theme foundation.
- Do not use large decorative gradients for product surfaces.
- Do not use Instrument Serif inside dense app controls.
- Do not introduce new component shapes without a system reason.

## Implementation Rule

The official Linted token layer uses `--linted-*` variables. Existing app variables such as `--bg-base`, `--text-primary`, `--brand`, and `--radius-md` may map to those tokens so the product can migrate safely without breaking current UI.
