# Linted

![Linted hero](public/assets/readme_hero%20image.png)

Linted is a Next.js community app for human-powered resume linting. Users sign in with email, Google, or GitHub, upload a resume, receive structured feedback from students, recruiters, and working professionals, reply in discussion threads, and discover strong reviewers through public profiles and a leaderboard.

The product idea is simple: a linter catches bugs before code compiles; Linted catches resume bugs before recruiters reject them.

## What It Does

- Anonymous resume submissions with private PDF storage
- Community feed of resumes open for feedback
- Resume detail pages with secure previews and threaded feedback discussions
- Like and dislike reactions on comments, with owner/self-reaction guards
- Public reviewer profiles with avatars, skills, bio, highlights, and activity
- Professional leaderboard based on feedback quality and contribution
- Real read counts for resume views
- Light and dark app themes
- Email auth, Google OAuth, and GitHub OAuth through Supabase

## Why It Exists

Most resume feedback is either too polite, too vague, or too slow. Linted gives job seekers a place to run a public lint pass on their resume while controlling how much identity they expose. The goal is not to dunk on people. The goal is to catch vague bullets, weak proof, messy structure, and recruiter red flags before the first screen.

For recruiters or engineering reviewers visiting this repo: the project demonstrates a full-stack product flow with authentication, database rules, file storage, optimistic UI, profile systems, interactive comment threads, and production-minded frontend polish.

## Tech Stack

- **Framework:** Next.js 15 App Router
- **UI:** React 19, TypeScript, Tailwind CSS
- **Components:** shadcn-style `components/ui` structure with Radix primitives
- **Backend:** Supabase Auth, Postgres, RPC functions, Row Level Security
- **Storage:** Supabase Storage for private resume PDFs and public avatars
- **Feedback:** Sonner toast notifications
- **Icons:** lucide-react and selected animated icon components
- **Fonts:** Instrument Serif for identity headings, Work Sans for body text

## Product Flow

1. A user signs in with email, Google, or GitHub.
2. They upload a redacted PDF resume.
3. The resume appears in the community feed.
4. Other signed-in users open the private preview and leave feedback.
5. The resume owner can read feedback but cannot react to comments on their own resume.
6. Reviewers build public profiles and leaderboard reputation through useful feedback.

## Project Structure

```text
app/
  feed/              Community feed route
  resume/[id]/       Resume detail and feedback thread route
  profile/[id]/      Public reviewer profile route
  submit/            Resume submission route
components/
  ResumeFeed.tsx     Feed cards, sorting, sharing, read-count display
  ResumeDetail.tsx   Secure preview, read tracking, comments, replies, reactions
  ProfileDetail.tsx  Public profile and edit profile experience
  Leaderboard.tsx    Ranked reviewer view
  ui/                Shared shadcn-style UI components
lib/supabase/
  client.ts          Supabase browser client
  types.ts           Shared app types
supabase/
  migrations/        Ordered Supabase CLI migrations
  *.sql              Legacy one-off SQL files kept for reference
public/assets/
  Visual assets used by the app and README
```

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

Run the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Supabase Setup

1. Create a Supabase project.
2. Enable Google and GitHub OAuth in Supabase Auth.
3. Add redirect URLs:
   - Local: `http://localhost:3000/auth/callback`
   - Production: `https://your-domain.com/auth/callback`
4. Set these environment variables locally and in production:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ADMIN_EMAILS=you@example.com
```

`SUPABASE_SERVICE_ROLE_KEY` is server-only and powers protected routes for auth checks, resume processing, admin moderation, and comment image uploads.

5. Link the Supabase CLI to the project and review the migrations:

```bash
npx supabase login
npx supabase link --project-ref your-project-ref
npm run db:push:dry
```

6. After reviewing the dry run, apply the ordered migrations:

```bash
npm run db:push
```

The source of truth is `supabase/migrations/`. The loose SQL files in `supabase/` are historical references and should not be used for new setup.

For local database validation with Docker:

```bash
npm run db:reset
```

Never run a reset against production. Production changes should go through `npm run db:push:dry`, review, then `npm run db:push`.

## Available Scripts

```bash
npm run dev        # Start the local development server
npm run typecheck  # Run TypeScript checks
npm run lint       # Run ESLint
npm run build      # Create a production build
npm run start      # Start the production server
npm run db:reset   # Rebuild local Supabase from ordered migrations
npm run db:push:dry # Preview pending migrations for a linked Supabase project
npm run db:push    # Apply reviewed migrations to a linked Supabase project
```

## Design Direction

Linted is designed to feel like LinkedIn meets a creative design startup: professional, direct, and polished without gamified clutter. The landing page has its own visual system, while the authenticated app focuses on clean layouts, readable threads, careful spacing, and productive feedback workflows.

## Contributing

Contributions are welcome. Good first areas to explore:

- Improve accessibility and keyboard behavior
- Add tests around Supabase data flows
- Refine mobile layouts for feed, profile, and resume detail pages
- Improve moderation, reporting, and safety features
- Expand profile and leaderboard insights

Before opening a pull request:

```bash
npm run typecheck
npm run lint
```

Please keep changes focused, preserve existing Supabase flows, and avoid unrelated redesigns unless the issue or PR is specifically about design.

## Status

Linted is an active product build. The core loop is in place: authenticate, submit, browse, read, review, reply, react, and build a public reviewer profile. The next priorities are production hardening, better moderation tools, stronger tests, and deployment polish.
