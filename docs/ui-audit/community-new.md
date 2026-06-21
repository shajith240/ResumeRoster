# UI Audit — `/community/new` (Create Post)

**Screenshots:** `desktop/linted.space_feed (3).png` (dark mode) · `mobile/linted.space_feed(Samsung Galaxy S8+) (3).png` (dark mode)
**Code roots:** `app/community/new/page.tsx` · `components/community/CommunityPostComposer.tsx` · `components/community/CommunityPostComposer.module.css` · `app/globals.css:1873–1934`

---

## Finding 1 — Editor toolbar buttons use hardcoded blue `#b8ddff`

**Severity: Broken · Desktop + Mobile**

**Where:** `components/community/CommunityPostComposer.module.css:7`.

```css
.editorToolbar.editorToolbar > button {
  color: color-mix(in srgb, #b8ddff 72%, var(--text-secondary));
}
```

`#b8ddff` is a raw hex light blue (Tailwind blue-200 range) with no mapping to any DESIGN.md token. It's mixed into `--text-secondary` to soften it, but the resulting blue-tinted toolbar buttons are visually out of place in a warm-dark palette (`--bg-base: #101114`). The rest of the UI uses orange brand accents and neutral text — blue icons in the editor toolbar introduce an unrelated hue. Both screenshots confirm the blue toolbar buttons in the rich text editor.

**Principle violated:** DESIGN.md token discipline; restraint in color (Reddit).

**Fix:**
```css
.editorToolbar.editorToolbar > button {
  color: var(--text-tertiary);
}
.editorToolbar.editorToolbar > button:hover {
  color: var(--text-primary);
}
```
This aligns toolbar buttons with the rest of the UI's neutral iconography.

---

## Finding 2 — Title input has no visible label — only a placeholder asterisk

**Severity: Inconsistent · Desktop + Mobile**

**Where:** `CommunityPostComposer.tsx` (rendering) — screenshot `feed (3).png` confirms "Title*" appears only as placeholder text inside the input field with no label element above it.

Using `*` inside a placeholder to signal "required" is an accessibility antipattern: placeholder text disappears on focus, so the field becomes unlabeled once typing begins. It also fails WCAG 2.1 SC 3.3.2 (labels or instructions).

**Principle violated:** Visual hierarchy (Apple) — Apple's HIG states form fields must have persistent visible labels.

**Fix:** Add a visible `<label>` element above the title input:
```html
<label class="compose-field-label" for="post-title">Title <span aria-hidden="true">*</span></label>
<input id="post-title" placeholder="Make the goal clear in one line" />
```
The asterisk can remain as visual required-field indicator but must not be the only label mechanism.

---

## Finding 3 — `community-compose-header` gap 6px — heading and body compressed

**Severity: Inconsistent · Desktop only**

**Where:** `app/globals.css:1887–1891`.

```css
.community-compose-header {
  gap: 6px;
  margin-bottom: clamp(18px, 3vh, 28px);
}
```

The compose header contains the eyebrow label, page title, and the "Drafts" link. 6px gap compresses these into a single visual block. This is the same pattern as the community feed intro (6px gap). The `clamp(18px, 3vh, 28px)` margin-bottom before the composer starts is too tight at smaller viewports (18px at the low end).

**Principle violated:** Whitespace discipline (Apple).

**Fix:**
```css
.community-compose-header {
  gap: 10px;
  margin-bottom: clamp(24px, 3vh, 32px);
}
```

---

## Finding 4 — `community-compose-header h1` has no explicit `font-weight`

**Severity: Inconsistent · Desktop + Mobile**

**Where:** `app/globals.css:1918–1922`.

```css
.community-compose-header h1 {
  margin: 0;
  font-size: clamp(36px, 4vw, 50px);
  line-height: 1;
  /* no font-weight — inherits */
}
```

Without `font-weight`, the heading inherits from the body or h1 reset. In `body.main-app`, Work Sans is the body font at 400. The h1 may inherit a different weight from the reset depending on browser, but it is not explicitly set — this is fragile. Desktop screenshot `feed (3).png` shows "Create post" at a weight that looks correct but is not intentional.

**Principle violated:** Typography confidence (Resend) — explicit control of heading weight is a fundamental design discipline.

**Fix:** Add `font-weight: 600` (or match the display heading weight convention set in `feed.css:44`).

---

## Finding 5 — Mobile rich text toolbar wraps to 82px tall — excessive real estate

**Severity: Polish · Mobile only**

**Where:** `components/community/CommunityPostComposer.module.css:67–76`.

```css
@media (max-width: 640px) {
  .editorToolbar.editorToolbar {
    flex-wrap: wrap;
    min-height: 82px;
    align-content: start;
    /* ... */
  }
}
```

On mobile the toolbar wraps to two rows at 82px minimum height. Mobile screenshot `feed(S8+) (3).png` confirms the 2-row toolbar — it occupies roughly a third of the visible viewport above the fold, pushing the title input and body editor out of sight before the user starts typing.

**Principle violated:** Content-first density (Reddit) — the compose area's primary real estate should be the title and body inputs, not the formatting toolbar.

**Fix:** Keep the toolbar as a single horizontally scrollable row on mobile:
```css
@media (max-width: 640px) {
  .editorToolbar.editorToolbar {
    flex-wrap: nowrap;
    min-height: 44px;
    overflow-x: auto;
    scrollbar-width: none;
  }
}
```
This matches the pattern used by Notion, Substack, and Threads on mobile.

---

## Finding 6 — Post type selector positioned top-right, disconnected from form flow

**Severity: Polish · Desktop + Mobile**

**Where:** Visual inspection of `feed (3).png` — the [Question ▼] type dropdown floats top-right in the compose header row, while the content-type tabs (Text / Images & Video / Link / Poll) are left-aligned below it. The relationship between "post type" and "content type" is not visually clear — two separate selector controls, spatially separated, controlling related but different aspects of the post.

Desktop screenshot: the type dropdown and the tabs are on the same form but appear visually disconnected (right vs left alignment, different rows).

**Principle violated:** Visual hierarchy (Apple) — related controls should group together.

**Fix (light touch):** Move the type selector to the same row as the content tabs, left-aligned before them. This creates a single form-control row: `[Question ▼] | Text | Images & Video | Link | Poll`. Alternatively, make the type selector part of the tab row as an additional tab group.

---

## Summary Table

| # | Finding | Severity | Desktop | Mobile | File:Line |
|---|---------|----------|---------|--------|-----------|
| 1 | Editor toolbar uses hardcoded blue `#b8ddff` | **Broken** | ✅ | ✅ | `CommunityPostComposer.module.css:7` |
| 2 | Title input has no visible label — only placeholder asterisk | Inconsistent | ✅ | ✅ | `CommunityPostComposer.tsx` |
| 3 | Compose header gap 6px — heading and copy compressed | Inconsistent | ✅ | — | `globals.css:1889` |
| 4 | h1 missing explicit `font-weight` | Inconsistent | ✅ | ✅ | `globals.css:1918–1922` |
| 5 | Mobile toolbar wraps to 82px — takes too much vertical space | Polish | — | ✅ | `CommunityPostComposer.module.css:67–76` |
| 6 | Post type selector disconnected from content tab row | Polish | ✅ | ✅ | Visual — `CommunityPostComposer.tsx` |
