# Frontend Routes

Next.js creates pages from files under `app/`.

## Public And User Routes

- `app/page.tsx`: landing or home entry.
- `app/feed/page.tsx`: community resume feed.
- `app/submit/page.tsx`: resume submission page.
- `app/resume/[id]/page.tsx`: resume detail page.
- `app/profile/[id]/page.tsx`: public profile page.
- `app/profile/me/page.tsx`: current user's profile.
- `app/leaderboard/page.tsx`: ranking and trust surface.
- `app/login/page.tsx`: sign-in page.
- `app/onboarding/page.tsx`: profile setup.
- `app/privacy/page.tsx`, `app/terms/page.tsx`, `app/copyright/page.tsx`, `app/guidelines/page.tsx`: policy pages.

## Admin Routes

- `app/admin/page.tsx`: admin default entry.
- `app/admin/[section]/page.tsx`: admin section routing.

## App Shell

- `app/layout.tsx`: metadata, root HTML shell, providers, global UI.
- `app/loading.tsx`: route loading UI.
- `app/global-error.tsx`: global error boundary.
- `app/manifest.ts`: PWA metadata.
- `app/globals.css`: global styling and design tokens.
- `app/feed-canvas.css`: feed-specific canvas protection.

## Route Change Checklist

- Confirm mobile and desktop layout.
- Confirm auth redirects still work.
- Confirm the page imports only browser-safe modules unless it is a server component.
- Update generated docs with `npm run docs:generate`.
