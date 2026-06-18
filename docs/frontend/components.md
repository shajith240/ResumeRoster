# Components

Components are reusable UI pieces. Most product behavior lives here before it calls shared logic or API routes.

## Feature Components

- `AdminDashboard.tsx`: admin overview, reports, people, reviewer trust, content, audit, and data controls.
- `ResumeFeed.tsx`: feed loading, resume cards, votes, save actions, and session-aware behavior.
- `ResumeDetail.tsx`: detail view for a resume, comments, replies, report actions, and review interactions.
- `ProfileDetail.tsx`: public profile, reviewer status, trust, reports, and profile editing behavior.
- `SubmitResumeForm.tsx`: resume upload form and privacy choices.
- `TeamNotifications.tsx`: notification inbox surface in the app.
- `NotificationCenter.tsx`: notification state, unread behavior, and presentation.
- `AuthGate.tsx`: protects authenticated areas.
- `AppPresence.tsx`: active session and presence heartbeat.

## UI Primitives

Files in `components/ui/` wrap low-level UI patterns such as dialogs, buttons, dropdowns, select menus, labels, and sidebars. These should stay boring, reusable, and accessible.

## Component Editing Rules

- Keep server-only secrets out of components.
- Prefer existing UI primitives before creating new ones.
- Avoid duplicate UI states for the same concept.
- Keep mobile behavior explicit.
- Update related tests or add one when behavior changes.
- Run `npm run docs:generate` after changing source.

## Generated Component Detail

Use [Generated Source Atlas](../generated/source-atlas.md) for a component-by-component function table.
