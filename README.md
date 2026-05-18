# ResumeRoster

ResumeRoster is a public, anonymous resume-roasting community. Users submit redacted resumes, other students and job seekers leave feedback, the community votes on the most helpful roasts, and improved resumes can climb a weekly leaderboard.

## Stack

- **Frontend:** Next.js App Router, React, TypeScript
- **Backend:** Supabase Auth, Postgres, Realtime-ready tables
- **Storage:** Supabase Storage private `resumes` bucket
- **Hosting:** Vercel
- **Email later:** Resend, deferred until notification features

## Step 0 Status

This repo has been migrated from a static HTML/CSS/JS landing page into a Next.js TypeScript app.

- Landing page lives in `app/page.tsx`
- Global styles live in `app/globals.css`
- Static assets live in `public/assets`
- Supabase browser client lives in `lib/supabase/client.ts`
- Initial SQL lives in `supabase/schema.sql`
- Storage policies live in `supabase/storage-policies.sql`

## Local Setup

Install dependencies:

```bash
npm install
```

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Run locally:

```bash
npm run dev
```

## Supabase Setup

1. Create a Supabase project.
2. Enable Google OAuth in Supabase Auth.
3. Add auth redirect URLs:
   - Local: `http://localhost:3000/auth/callback`
   - Production: `https://your-vercel-domain.vercel.app/auth/callback`
4. Run `supabase/schema.sql` in the SQL editor.
5. Create a private Storage bucket named `resumes`.
6. Run `supabase/storage-policies.sql`.

## Phase 1 Product Loop

Build only the core loop first:

1. Google login
2. Anonymous resume upload
3. Community feed of open resumes
4. Resume detail page with roast thread
5. Roast submission
6. Helpful voting

## Interview Architecture Summary

The app uses Next.js for routing and UI, Supabase Auth for identity, Supabase Postgres for public resume/roast/vote data, and Supabase Storage for private resume PDFs. Row Level Security protects ownership and voting rules at the database layer, while the frontend focuses on the community workflow: submit, roast, vote, improve.
