# Linted — Complete UI/UX Redesign Brief
## For Codex / AI Coding Agent

> **Design philosophy**: Reddit's community energy × Linear's product polish × Hacker News's raw signal-to-noise ratio.
> Goal: Every page should feel alive, intentional, and worth coming back to.

---

## 1. Design System Foundation (Apply Globally)

### Typography
```css
/* Import these in your global CSS */
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;400;500;600&display=swap');

:root {
  --font-display: 'Instrument Serif', serif;   /* headings, big numbers, brand moments */
  --font-body:    'DM Sans', sans-serif;        /* all UI text, labels, body */
}
```
- All large headings (h1, h2, page titles, leaderboard numbers): `Instrument Serif` — this is your editorial, premium feel
- All UI chrome (nav, buttons, labels, body text, metadata): `DM Sans` — clean and legible
- Never use Inter, Roboto, or system-ui anywhere

### Color Palette
```css
:root {
  /* Backgrounds — layered depth */
  --bg-base:      #F2EFE9;   /* warm off-white, like aged paper — NOT pure white */
  --bg-surface:   #FAFAF8;   /* card/panel surfaces */
  --bg-elevated:  #FFFFFF;   /* modals, dropdowns */
  --bg-inverse:   #1A1916;   /* dark sidebar, nav accents */

  /* Brand */
  --brand:        #E85D26;   /* warm burnt orange — primary actions, fire emoji energy */
  --brand-muted:  #F5E6DE;   /* brand tint for backgrounds */
  --brand-dark:   #BF4518;   /* hover states */

  /* Text */
  --text-primary:   #1A1916;   /* near-black, warm */
  --text-secondary: #6B6860;   /* muted labels */
  --text-tertiary:  #A8A59E;   /* timestamps, metadata */
  --text-inverse:   #F2EFE9;   /* on dark backgrounds */

  /* Borders */
  --border-subtle:  rgba(26,25,22,0.08);
  --border-default: rgba(26,25,22,0.14);
  --border-strong:  rgba(26,25,22,0.30);

  /* Semantic */
  --success:  #2D7A4F;
  --warning:  #C47B1A;
  --danger:   #C4341A;

  /* Spacing scale */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;

  /* Radius */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-xl: 24px;
  --radius-pill: 9999px;

  /* Shadows */
  --shadow-sm:  0 1px 3px rgba(26,25,22,0.08), 0 1px 2px rgba(26,25,22,0.04);
  --shadow-md:  0 4px 12px rgba(26,25,22,0.10), 0 2px 4px rgba(26,25,22,0.06);
  --shadow-lg:  0 12px 32px rgba(26,25,22,0.12), 0 4px 8px rgba(26,25,22,0.06);
  --shadow-focus: 0 0 0 3px rgba(232,93,38,0.25);
}
```

### Global Animations
```css
/* Add to global CSS */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes slideInLeft {
  from { opacity: 0; transform: translateX(-16px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes countUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Stagger utility — apply animation-delay to nth children */
.stagger-children > *:nth-child(1) { animation-delay: 0ms; }
.stagger-children > *:nth-child(2) { animation-delay: 60ms; }
.stagger-children > *:nth-child(3) { animation-delay: 120ms; }
.stagger-children > *:nth-child(4) { animation-delay: 180ms; }
.stagger-children > *:nth-child(5) { animation-delay: 240ms; }

/* Every page content wrapper gets this */
.page-enter {
  animation: fadeUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
}
```

### Shared Component Rules
```css
/* Buttons */
.btn-primary {
  background: var(--text-primary);
  color: var(--text-inverse);
  font-family: var(--font-body);
  font-size: 14px;
  font-weight: 500;
  padding: 10px 20px;
  border-radius: var(--radius-pill);
  border: none;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s, box-shadow 0.15s;
  letter-spacing: -0.01em;
}
.btn-primary:hover {
  background: #333;
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}
.btn-primary:active { transform: translateY(0); }

.btn-brand {
  background: var(--brand);
  color: white;
}
.btn-brand:hover { background: var(--brand-dark); }

.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
  border: 1.5px solid var(--border-default);
}
.btn-ghost:hover {
  background: var(--bg-base);
  border-color: var(--border-strong);
  color: var(--text-primary);
}

/* Cards */
.card {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  transition: box-shadow 0.2s, transform 0.2s, border-color 0.2s;
}
.card:hover {
  box-shadow: var(--shadow-md);
  border-color: var(--border-default);
  transform: translateY(-2px);
}

/* Inputs */
input, textarea {
  font-family: var(--font-body);
  background: var(--bg-elevated);
  border: 1.5px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: 10px 14px;
  font-size: 15px;
  color: var(--text-primary);
  transition: border-color 0.15s, box-shadow 0.15s;
  outline: none;
  width: 100%;
}
input:focus, textarea:focus {
  border-color: var(--brand);
  box-shadow: var(--shadow-focus);
}

/* Tags / Badges */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 500;
  padding: 3px 10px;
  border-radius: var(--radius-pill);
  letter-spacing: 0.01em;
}
.badge-open    { background: #DCFCE7; color: #166534; }
.badge-closed  { background: #F1F5F9; color: #475569; }
.badge-hot     { background: #FEE2E2; color: #991B1B; }
```

---

## 2. Navigation / Top Bar

**Current problem**: Plain white bar, no character, feels like a starter template.

**New design**:
```
Height: 52px
Background: var(--bg-inverse) — DARK top bar, like Reddit's redesign
Sticky: yes, position: sticky; top: 0; z-index: 100;
Border-bottom: 1px solid rgba(255,255,255,0.08)
Backdrop-filter: blur(12px) — subtle frost glass on scroll
```

**Left**: `Linted` in `Instrument Serif`, 20px, color: `#F2EFE9`
- Add a tiny 🔥 favicon/icon before the wordmark (actual emoji or SVG flame icon)

**Center** (desktop): Search bar — `width: 320px`
```
placeholder: "Search resumes, roles, colleges..."
background: rgba(255,255,255,0.08)
border: 1px solid rgba(255,255,255,0.12)
border-radius: var(--radius-pill)
color: white
font-size: 14px
```
On focus: border becomes `rgba(232,93,38,0.6)`, background lightens slightly

**Right**: 
- If logged out: `Log in` button (ghost, white border) + `Post resume` button (brand orange)
- If logged in: notification bell icon → avatar circle (initial, warm bg like `#E85D26`)
  - Avatar click opens a small dropdown: Profile / My resumes / Log out
  - Dropdown: `background: var(--bg-elevated)`, `border-radius: var(--radius-lg)`, `box-shadow: var(--shadow-lg)`, animate with `scaleIn` 0.15s

**Nav links** (below top bar — secondary nav strip):
```
height: 40px
background: var(--bg-base)
border-bottom: 1px solid var(--border-subtle)
font-family: var(--font-body)
font-size: 13px
font-weight: 500
color: var(--text-secondary)
```
Active tab: `color: var(--text-primary)`, bottom border `2px solid var(--brand)`, animated slide

Links: `Home` · `New` · `Top Reviewed` · `Leaderboard`

---

## 3. Community Feed Page (Main Feed)

**Current problem**: Left sidebar feels empty and redundant. Feed cards lack visual hierarchy. No sense of community activity.

### Layout
```
Max-width: 1100px, centered, padding: 0 24px
Grid: [240px sidebar] [1fr main feed] [280px right panel]
Gap: 24px
On tablet (< 900px): hide right panel
On mobile (< 640px): single column, hide left sidebar (move to hamburger)
```

### Left Sidebar
Replace the current bland list with a richer sidebar:

```
Background: transparent (no white box)
Padding-top: 24px

[Section: NAVIGATE]
- Home (with house icon)
- Post Resume (with + icon, colored brand orange)
- Leaderboard (with trophy icon)
- My Profile (with person icon)

Each nav item:
  padding: 8px 12px
  border-radius: var(--radius-md)
  font-size: 14px, font-weight: 500
  color: var(--text-secondary)
  transition: background 0.15s, color 0.15s
  hover: background var(--brand-muted), color var(--brand)
  active: same as hover + font-weight 600

[Divider: 1px solid var(--border-subtle), margin: 16px 0]

[Section: COMMUNITIES — small label, 11px, uppercase, letter-spacing: 0.08em]
- Linted (dot indicator, green if active)
- Top reviewers
- Anonymous uploads

[Section: STATS BOX — card style]
  Resumes reviewed this week: [number]
  Active reviewers: [number]
  Style: small card, bg var(--brand-muted), border var(--brand) at 20% opacity
  Numbers in Instrument Serif, 24px, color var(--brand)
```

### Feed Header
```html
<div class="feed-header">
  <div>
    <p class="feed-community">Linted</p>   <!-- 12px, muted, DM Sans -->
    <h1 class="feed-title">Community Lint Feed</h1> <!-- Instrument Serif, 36px -->
    <p class="feed-subtitle">Anonymous resumes. Public feedback. Sharpest roasts voted to the top.</p>
  </div>
  <button class="btn-primary">Post resume</button>
</div>
```

### Sort Tabs
```
Container: background var(--bg-surface), border 1px solid var(--border-subtle), border-radius var(--radius-pill), padding 3px, display: inline-flex
Tabs: Best · New · Most Reviewed
Active tab: background var(--text-primary), color white, border-radius var(--radius-pill), transition 0.2s
Inactive: color var(--text-secondary), hover: color var(--text-primary)
Font: DM Sans 13px, font-weight 500
```

### Resume Cards (THE MOST IMPORTANT PART)
Each card in the feed. Reddit-inspired but elevated:

```css
.resume-card {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: 0;                    /* No padding on outer — sections handle it */
  overflow: hidden;
  transition: box-shadow 0.2s, border-color 0.2s, transform 0.2s;
  animation: fadeUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
  cursor: pointer;
}
.resume-card:hover {
  box-shadow: var(--shadow-md);
  border-color: var(--border-default);
  transform: translateY(-2px);
}
```

**Card anatomy** (top to bottom):

1. **Vote strip** (left side, like Reddit's upvote column):
```
Width: 44px, float left OR use CSS grid: [44px 1fr]
Background: var(--bg-base)
Border-right: 1px solid var(--border-subtle)
Padding: 16px 0
Display: flex, flex-direction: column, align-items: center, gap: 4px

Upvote button: triangle SVG icon, 18px
  color: var(--text-tertiary)
  hover: color var(--brand), scale(1.15) transform
  active/voted: color var(--brand), fill var(--brand)
  transition: all 0.15s

Vote count: Instrument Serif, 15px, font-weight normal
  color: var(--text-secondary)
  voted: color var(--brand)

Downvote button: same as upvote, flipped
```

2. **Card body** (right of vote strip):
```
Padding: 14px 16px 12px

[Row 1: Metadata]
  font: DM Sans 12px, color var(--text-tertiary)
  "Linted · posted anonymously · May 19 · 3 min read"
  Dot separators between items

[Row 2: Title]
  font: DM Sans 18px, font-weight 600, color var(--text-primary)
  letter-spacing: -0.02em
  margin-top: 4px
  hover: color var(--brand) — transition 0.15s

[Row 3: Tags]
  Horizontal flex, gap 6px, margin-top 8px
  Role tag: e.g. "SDE Intern" — badge style, background var(--brand-muted), color var(--brand)
  College tag: e.g. "IIT(ISM)" — badge style, neutral gray
  Status badge: "Open" (green) / "Closed" (gray) / "Heated 🔥" (red, if >5 roasts)

[Row 4: Resume preview snippet]
  OPTIONAL — show only on cards with content
  2-line truncated text preview of the resume title/objective
  font: 14px, color var(--text-secondary), line-height 1.5
  margin-top: 8px

[Row 5: Action bar]
  Border-top: 1px solid var(--border-subtle)
  Margin-top: 12px, Padding-top: 10px
  Display: flex, gap: 4px, align-items: center

  Action buttons (icon + label):
    💬 [N] Roasts
    🔗 Share
    🔖 Save
  Each: padding 6px 10px, border-radius var(--radius-md)
  Font: DM Sans 13px, color var(--text-tertiary)
  hover: background var(--bg-base), color var(--text-primary)
  transition: all 0.15s

  Right side (margin-left: auto):
    "Open for reviewing" pill — badge-open style — OR "Closed" badge
```

**Card entry animation**: Cards entering the feed stagger with `animation-delay: N * 50ms`. Use Intersection Observer to trigger `fadeUp` as cards enter viewport on scroll.

### Right Panel
```
Background: transparent
Position: sticky; top: 76px

[About card]
  background: var(--bg-surface)
  border: 1px solid var(--border-subtle)
  border-radius: var(--radius-lg)
  padding: 16px

  Header: "About Linted" — DM Sans 15px, font-weight 600
  Body text: 14px, color var(--text-secondary), line-height 1.6
  Divider, then "Created [date]" metadata row

[Community rules card]  
  Same card style
  Rules as numbered list
  Each rule: 13px, line-height 1.7
  Number: bold, color var(--brand)

[Quick actions card]
  Buttons stacked:
  "Submit anonymously" — btn-primary full width
  "View leaderboard" — btn-ghost full width
  Gap: 8px between buttons
```

---

## 4. Submit Page

**Current problem**: Floating form in empty space, no context, no motivation, no polish.

### New layout
```
Max-width: 560px, centered
Padding-top: 60px
```

### Page header (above form)
```html
<div class="submit-header">
  <div class="submit-icon">🔥</div>   <!-- 40px emoji or SVG flame -->
  <h1>Submit Anonymously</h1>          <!-- Instrument Serif, 42px -->
  <p>Upload a PDF, give context, and let the community find the weak spots before recruiters do.</p>
  <!-- DM Sans, 16px, color var(--text-secondary), max-width 400px, centered -->
</div>
```

### Form card
```css
.submit-form {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xl);
  padding: 32px;
  box-shadow: var(--shadow-md);
  animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
}
```

**Fields**:

1. **Resume title**
   - Label: "Resume title" — 13px, font-weight 500, margin-bottom 6px
   - Input with placeholder: "Fresh grad applying for SDE roles"
   - Below input (helper text): "Give context so reviewers know what you're targeting" — 12px, muted

2. **Target role** (NEW — add this field)
   - Label: "Target role"
   - Select dropdown OR tag chips: SDE Intern · Full-time SDE · MBA · Data Analyst · Product Manager · Other
   - Chips style: small pills, click to select, selected = brand orange bg

3. **Resume PDF upload**
   - Remove the default `<input type="file">` entirely — it's ugly
   - Replace with a custom dropzone:
   ```
   Border: 2px dashed var(--border-default)
   Border-radius: var(--radius-lg)
   Padding: 32px
   Text-align: center
   Background: var(--bg-base)
   Transition: all 0.2s
   
   Content:
     Upload icon (SVG, 32px, color var(--text-tertiary))
     "Drop your PDF here" — 15px, font-weight 500
     "or click to browse" — 13px, color var(--brand), underline
     "Max 5MB · PDF only" — 12px, color var(--text-tertiary), margin-top 4px
   
   Drag-over state:
     border-color: var(--brand)
     background: var(--brand-muted)
     scale: 1.01 transform
   
   File selected state:
     Show filename with a green checkmark icon
     Show file size
     Show "Remove" × button
   ```

4. **Anonymous toggle**
   - Remove plain checkbox
   - Replace with:
   ```
   Display: flex, justify-content: space-between, align-items: center
   padding: 14px 16px
   background: var(--bg-base)
   border-radius: var(--radius-md)
   border: 1px solid var(--border-subtle)
   
   Left: lock icon + "Post anonymously" label (15px, font-weight 500)
           + "Your name won't appear on the post" (12px, muted, below)
   
   Right: Custom toggle switch
     Track: 36px × 20px, border-radius pill
     Off: background var(--border-default)
     On: background var(--brand)
     Thumb: white circle, transition: transform 0.2s
     Default: checked/on
   ```

5. **Submit button**
   - Full width, height 48px
   - btn-primary style but with font-size 16px
   - Text: "Submit for reviewing"
   - Loading state: spinner icon + "Uploading..." text, opacity 0.7, disabled
   - Success state: green checkmark + "Posted! Redirecting..." with brief animation

---

## 5. Leaderboard Page

**Current problem**: Two plain white boxes floating on empty space. No energy. No reason to care.

### New layout
```
Max-width: 900px, centered
Padding-top: 40px
```

### Page header
```html
<div class="leaderboard-header">
  <h1>Leaderboard</h1>   <!-- Instrument Serif, 48px -->
  <!-- Below: animated counter showing total helpful votes given this week -->
  <p class="week-stat">
    <span class="big-number">247</span> helpful votes given this week
    <!-- big-number: Instrument Serif, 32px, color var(--brand) -->
  </p>
  <p class="subtitle">The people writing the most useful feedback...</p>
</div>
```

### Time filter tabs
```
"This week" · "This month" · "All time"
Same pill-tab style as feed sort tabs
Active: dark bg, white text
```

### Two-column grid
```css
.leaderboard-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-top: 32px;
}
/* Mobile: single column */
```

### Top Reviewers card
```
Card style (bg-surface, border, radius-xl, shadow-sm)
Padding: 24px

Header row:
  "Top reviewers" — DM Sans 18px, font-weight 600
  "Ranked by helpful votes" — 12px, muted, margin-left: auto

Empty state (when no reviewers):
  Centered, padding 40px
  Trophy icon (SVG, 40px, color var(--text-tertiary))
  "No reviewers yet" — 15px, font-weight 500
  "First useful roast gets the board moving." — 13px, muted
  
  Add a subtle CTA button: "Be the first reviewer →" — brand color link style

Populated state (each reviewer row):
  Display: flex, align-items: center, gap 12px, padding 10px 0
  Border-bottom: 1px solid var(--border-subtle) (except last)
  Hover: background var(--bg-base), border-radius var(--radius-md), transition 0.15s

  Left: Rank number — Instrument Serif, 20px, color var(--text-tertiary)
         (1st place: var(--brand), larger, 24px)

  Avatar circle: 36px, initials, colored background (generate from username hash)

  Middle:
    Username — DM Sans 14px, font-weight 600
    College + target role — 12px, muted

  Right (margin-left: auto):
    "42 votes" — DM Sans 13px, font-weight 600, color var(--brand)
    Small upvote icon before number

  Top 3 get: crown emoji / gold-silver-bronze dot indicator
```

### Most Reviewed Resumes card
Same card style.

```
Each resume row:
  Display: flex, align-items: center, gap 12px, padding 12px 0
  Hover state same as above

  Left: Rank badge
    Circle 28px, background var(--text-primary), color white
    Font: DM Sans 13px, font-weight 700
    (1st: var(--brand) background)

  Middle:
    Title — DM Sans 14px, font-weight 600, max 1 line, ellipsis overflow
    Row 2: status badge + "5 days ago" timestamp — 12px, muted

  Right (margin-left: auto):
    "[N] roasts" — DM Sans 13px, font-weight 700
    Flame icon 🔥 if N > 5

Animation: On page load, rank numbers count up from 0 to their value using CSS countUp keyframe. Add a 100ms delay per row.
```

---

## 6. Profile Page

**Current problem**: Two floating cards, no visual identity, yellow stat boxes look random, form is unstyled.

### Layout
```
Max-width: 860px, centered
Padding-top: 40px
Display: grid, grid-template-columns: 340px 1fr, gap: 28px
Mobile: single column
```

### Profile card (left)
```css
.profile-card {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xl);
  padding: 28px;
  box-shadow: var(--shadow-sm);
  /* Sticky on desktop */
  position: sticky;
  top: 76px;
  align-self: start;
}
```

**Profile card anatomy**:

1. **"Reviewer profile" badge** at top:
   ```
   display: inline-flex
   background: var(--brand-muted)
   color: var(--brand)
   border-radius: var(--radius-pill)
   font-size: 11px, font-weight 600, letter-spacing 0.05em, UPPERCASE
   padding: 4px 10px
   margin-bottom: 16px
   ```

2. **Avatar area**:
   ```
   Large circle: 72px × 72px
   Background: gradient from var(--brand) to var(--brand-dark)
   Initial letter: Instrument Serif, 32px, white
   margin-bottom: 12px
   ```

3. **Username**:
   `Instrument Serif, 32px, color var(--text-primary), line-height 1.1`

4. **Tagline** (college + target role):
   `DM Sans, 14px, color var(--text-secondary)`
   Format: "SDE intern · IIT(ISM) Dhandbad"

5. **Stats row** (replace the yellow boxes):
   ```
   Display: grid, grid-template-columns: 1fr 1fr
   Gap: 12px, margin: 20px 0

   Each stat cell:
     background: var(--bg-base)
     border: 1px solid var(--border-subtle)
     border-radius: var(--radius-md)
     padding: 14px 16px

     Number: Instrument Serif, 28px, color var(--text-primary)
             (animate from 0 to value on load — CSS countUp, 0.6s ease-out)
     Label: DM Sans, 12px, color var(--text-secondary), margin-top 2px
   ```

6. **Divider**: `1px solid var(--border-subtle)`, margin: 20px 0

7. **Edit form** (inline editing):
   Each field:
   ```
   Label: DM Sans 12px, font-weight 500, color var(--text-secondary), margin-bottom 4px
   Input: styled per global input rules
   margin-bottom: 14px
   ```
   
   Save button: btn-primary, full width, height 44px
   Success state: brief green flash + "Saved ✓" text transition

### Recent Roasts card (right)
```css
.roasts-panel {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xl);
  padding: 24px;
}
```

Header:
```
Display: flex, justify-content: space-between, align-items: center
"Recent roasts" — DM Sans 18px, font-weight 600
"Feedback this reviewer has contributed" — 12px, muted, max-width 160px, text-right
```

Empty state:
```
Padding: 48px 24px, text-align: center
Icon: chat bubble SVG, 40px, color var(--text-tertiary)
"No public roasts yet." — 15px, font-weight 500
"Start reviewing resumes to build your reputation." — 13px, muted
CTA: "Browse feed →" — brand color link
```

Populated state (each roast row):
```
Border-bottom: 1px solid var(--border-subtle), padding: 14px 0
Hover: background var(--bg-base), border-radius var(--radius-md)

Row 1: Resume title (linked) — 14px, font-weight 600
Row 2: First 2 lines of roast text — 13px, muted, line-clamp 2
Row 3: Metadata row — "3 helpful votes · May 19" — 12px, tertiary
        Helpful votes count: color var(--brand), font-weight 600
```

---

## 7. Resume Detail Page (The Roast Thread)

This page doesn't exist yet. Build it as the most important page of the app.

### Layout
```
Max-width: 900px, centered
Two sections stacked: [Resume viewer] then [Feedback thread]
```

### Resume viewer section
```
Card, padding 24px
Header:
  Posted by badge + timestamp (left)
  Status badge "Open for reviewing" (right)

Title: Instrument Serif, 36px
Tags: role badge, college badge, gap 8px

PDF viewer:
  iframe or react-pdf component
  border-radius: var(--radius-lg)
  border: 1px solid var(--border-subtle)
  height: 600px on desktop, 400px mobile
  overflow: hidden
```

### Roast input box
```
Card style, padding 20px
Appears between resume viewer and roast list

Textarea:
  min-height: 120px
  font-size: 15px
  resize: vertical
  
Bottom row (inside card):
  Community rule reminder: "🔥 Roast the resume, not the person" — 12px, muted
  "Submit feedback" button — btn-brand — right aligned
```

### Feedback thread
Each roast:
```
Display: flex, gap 12px, padding 16px 0
Border-bottom: 1px solid var(--border-subtle)
animation: fadeUp, staggered by index × 40ms

Left:
  Vote column (same as feed cards but vertical)
  upvote, count, downvote

Right:
  Header row:
    Avatar (24px circle) + username + "· [time ago]"
    font: 13px
    Verified helpful badge if votes > 5: small green checkmark pill

  Roast content:
    font: DM Sans 15px, line-height 1.7, color var(--text-primary)
    
  Action row:
    "Reply" link · "Report" link — 12px, muted
    Hover: color var(--text-primary)
```

---

## 8. Micro-interactions Checklist

Implement ALL of these — they're what separate a real product from a side project:

```
[ ] Vote buttons scale(1.15) + color change on click with 0.15s transition
[ ] Vote count animates +1 / -1 with translateY + opacity when voted
[ ] Card hover lifts 2px with shadow deepening
[ ] Tab switching has a sliding indicator that moves between tabs
[ ] Page transitions: new pages fade up (fadeUp, 0.35s)
[ ] Form inputs glow orange on focus (box-shadow: var(--shadow-focus))
[ ] File dropzone scales slightly + changes border color on drag-over
[ ] Submit button shows spinner during upload, then success checkmark
[ ] Profile stats count up from 0 on first view (Intersection Observer trigger)
[ ] Leaderboard ranks count up on page entry, staggered
[ ] New roast appearing in thread: slide in from bottom with fadeUp
[ ] Navigation active state slides (use a moving indicator bar, not just color change)
[ ] Avatar dropdown opens with scaleIn 0.15s from top-right origin
[ ] Toast notifications (top-right): slide in from right, auto-dismiss after 3s
[ ] Skeleton loading states for cards (animated shimmer, NOT spinners)
    - Skeleton: gray rectangles with shimmer animation as placeholder
    - Show for 300ms minimum even if data loads faster (prevents flash)
[ ] Hover on username in feedback thread: underline with brand color
[ ] "Copy link" button: brief "Copied!" tooltip fade in/out
```

---

## 9. Responsive Breakpoints

```css
/* Mobile first */
/* Base: mobile, < 640px */
/* Tablet: 640px - 900px */
/* Desktop: > 900px */

@media (max-width: 900px) {
  /* Feed: hide right panel */
  /* Leaderboard: single column */
  /* Profile: single column */
}
@media (max-width: 640px) {
  /* Feed: hide sidebar, show bottom nav instead */
  /* All padding: reduce to 16px */
  /* Cards: reduce padding */
  /* Nav: collapse to hamburger */
}

/* Bottom nav (mobile only) */
.bottom-nav {
  display: none;
  position: fixed; bottom: 0; left: 0; right: 0;
  height: 56px;
  background: var(--bg-elevated);
  border-top: 1px solid var(--border-subtle);
  backdrop-filter: blur(12px);
  display: grid; grid-template-columns: repeat(4, 1fr);
}
/* Show only on mobile */
@media (min-width: 640px) { .bottom-nav { display: none; } }
```

---

## 10. Skeleton Loading States

Replace ALL spinners with skeleton screens:

```css
@keyframes shimmer {
  from { background-position: -400px 0; }
  to   { background-position: 400px 0; }
}
.skeleton {
  background: linear-gradient(
    90deg,
    var(--bg-base) 25%,
    var(--border-subtle) 50%,
    var(--bg-base) 75%
  );
  background-size: 400px 100%;
  animation: shimmer 1.4s ease-in-out infinite;
  border-radius: var(--radius-sm);
}
/* Usage: <div class="skeleton" style="height:20px; width:200px"></div> */
```

Feed loading: show 3 skeleton cards shaped like real cards (vote strip, title line, tag pills, action bar). Each card slightly different width for realism.

---

## 11. Toast Notification System

Add a global toast system (top-right corner):

```css
.toast-container {
  position: fixed; top: 64px; right: 20px;
  z-index: 9999;
  display: flex; flex-direction: column; gap: 8px;
}
.toast {
  background: var(--bg-inverse);
  color: var(--text-inverse);
  padding: 12px 16px;
  border-radius: var(--radius-md);
  font-family: var(--font-body);
  font-size: 14px;
  box-shadow: var(--shadow-lg);
  animation: slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  max-width: 300px;
}
@keyframes slideInRight {
  from { opacity: 0; transform: translateX(24px); }
  to   { opacity: 1; transform: translateX(0); }
}
```

Trigger toasts for: successful roast submit, vote registered, profile saved, link copied, upload error.

---

## Summary: Priority Order for Implementation

1. **Global CSS** — colors, typography, animations, shared components (DO THIS FIRST, everything else depends on it)
2. **Navigation** — dark top bar, affects every page
3. **Feed page** — most visited page, highest impact
4. **Resume cards** — the core UI unit, gets reused everywhere
5. **Submit page** — user's first real interaction
6. **Leaderboard page**
7. **Profile page**
8. **Resume detail / feedback thread page** (can build after launch)
9. **Skeleton states + toasts** — production polish layer

---

*Brief version: 1.0 · Linted · Built for production*
