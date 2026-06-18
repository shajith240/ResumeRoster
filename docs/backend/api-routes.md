# API Routes

API routes live under `app/api/**/route.ts`. They are the bridge between browser UI and server-only work.

## Admin APIs

- `/api/admin/me`: checks admin identity.
- `/api/admin/overview`: dashboard summary.
- `/api/admin/users`: people list and user search.
- `/api/admin/users/[id]/action`: user actions.
- `/api/admin/reports`: report queue.
- `/api/admin/reports/[id]/action`: report moderation action.
- `/api/admin/reviewers`: reviewer trust queue.
- `/api/admin/reviewers/[id]/action`: reviewer action.
- `/api/admin/actions`: audit trail.
- `/api/admin/data`: data overview.
- `/api/admin/messages`: in-app admin messages.

## User APIs

- `/api/resumes/submit`: resume upload and post creation.
- `/api/comment-media/upload`: comment image upload.
- `/api/reviewer-application`: reviewer onboarding.
- `/api/push/subscriptions`: browser push subscription management.
- `/api/push/dispatch`: push dispatch.
- `/api/health`: production health check.

## API Change Checklist

- Confirm auth requirements.
- Validate payload shape and length.
- Confirm RLS allows the intended database action.
- Add or update tests for validation helpers.
- Update generated docs.
