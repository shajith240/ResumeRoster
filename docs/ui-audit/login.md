# UI Audit — `/login` (Login / Sign Up)

**Screenshots:** None available — code review only.
**Code roots:** `app/login/page.tsx` · `components/auth/SignUp.tsx` · `components/auth/SignUp.module.css`

> **Coverage gap:** No screenshot. All findings from static code analysis only.

---

## Finding 1 — Login card `h1` has no explicit `font-family` or `font-weight`

**Severity: Inconsistent · Desktop + Mobile**

**Where:** `components/auth/SignUp.module.css:44–51`.

```css
.heading h1 {
  margin: 18px 0 6px;
  color: var(--text-primary);
  font-size: 36px;
  line-height: 1.04;
  /* no font-family — inherits Work Sans */
  /* no font-weight — inherits browser default 700 for h1... */
}
```

No `font-family` is set. Since `.heading` is inside the page root, the h1 inherits from the body font (`--font-app-body` = Work Sans). Every other display heading in the app explicitly sets `var(--font-display)` (Syne). The login card heading is the first text a new user reads — it should be in the display typeface.

**Principle violated:** Typography confidence (Resend).

**Fix:**
```css
.heading h1 {
  font-family: var(--font-display);
  font-weight: 600;
}
```

---

## Finding 2 — Error and success notice banners use literal RGBA values instead of `color-mix` with tokens

**Severity: Inconsistent · Desktop + Mobile**

**Where:** `components/auth/SignUp.module.css:208–252`.

```css
.formMessage {
  border: 1px solid rgba(196, 52, 26, 0.22); /* literal danger RGB */
  background: rgba(196, 52, 26, 0.08);
  color: var(--danger);
}
.formNotice {
  border: 1px solid rgba(45, 122, 79, 0.22); /* literal success RGB */
  background: rgba(45, 122, 79, 0.08);
  color: var(--success);
}
.noticeActions button {
  border: 1px solid rgba(45, 122, 79, 0.24);
  background: rgba(45, 122, 79, 0.1);
  color: var(--success);
}
```

The literal RGBA values `(196, 52, 26)` correspond to `--danger: #c4341a` (rgb 196, 52, 26) and `(45, 122, 79)` correspond to `--success: #2d7a4f`. These work today but won't track if the token values change, and they differ in technique from the rest of the app which uses `color-mix()`.

**Principle violated:** DESIGN.md token discipline — consistency of approach.

**Fix:**
```css
.formMessage {
  border: 1px solid color-mix(in srgb, var(--danger) 22%, transparent);
  background: color-mix(in srgb, var(--danger) 8%, transparent);
  color: var(--danger);
}
.formNotice {
  border: 1px solid color-mix(in srgb, var(--success) 22%, transparent);
  background: color-mix(in srgb, var(--success) 8%, transparent);
  color: var(--success);
}
```

---

## Finding 3 — Submit button uses `color: #fff` instead of `var(--text-inverse)`

**Severity: Polish · Desktop + Mobile**

**Where:** `components/auth/SignUp.module.css:265`.

```css
.submitButton {
  background: var(--brand);
  color: #fff; /* should be var(--text-inverse) */
}
```

`--text-inverse: #f2efe9` (light) is slightly warm-white, not pure white. On the orange `--brand` background the visual difference is subtle, but using `#fff` breaks the token contract. Same finding as the role picker button in `/submit`.

**Principle violated:** DESIGN.md token discipline.

**Fix:** `color: var(--text-inverse)`.

---

## Finding 4 — OAuth provider button light-mode uses hardcoded near-black border rgba

**Severity: Polish · Light mode only**

**Where:** `components/auth/SignUp.module.css:113–118`.

```css
:global(body:not(.main-app-dark)) .providerButton {
  border-color: rgba(26, 25, 22, 0.14);
  /* ... */
}
:global(body:not(.main-app-dark)) .providerButton:hover {
  border-color: rgba(26, 25, 22, 0.22);
}
```

`rgba(26, 25, 22, 0.14)` approximates the dark text color at low opacity — it's manually deriving a border from the background. `var(--border-default)` already provides the correct semi-transparent border for light mode.

**Principle violated:** DESIGN.md token discipline.

**Fix:**
```css
:global(body:not(.main-app-dark)) .providerButton {
  border-color: var(--border-default);
}
:global(body:not(.main-app-dark)) .providerButton:hover {
  border-color: var(--border-strong);
}
```

---

## Summary Table

| # | Finding | Severity | File:Line |
|---|---------|----------|-----------|
| 1 | Login h1 missing `font-family` and `font-weight` | Inconsistent | `SignUp.module.css:44–51` |
| 2 | Error/success banners use literal RGBA instead of `color-mix` | Inconsistent | `module.css:208–252` |
| 3 | Submit button uses `color: #fff` not `var(--text-inverse)` | Polish | `module.css:265` |
| 4 | OAuth button light-mode border uses hardcoded rgba | Polish | `module.css:113–118` |
