# Setup

## Install

```bash
npm install
```

## Run Locally

```bash
npm run dev
```

## Required Environment

Use `.env.example` as the starting point. Keep real `.env` files out of git.

Common environment groups:

- Supabase project URL and anon key.
- Supabase service role key for server-only routes.
- Push notification keys.
- Error monitoring keys.

## Database Commands

```bash
npm run db:push:dry
npm run db:push
npm run db:reset
```

Use dry-run before applying database changes. For production schema work, read [Migrations](../database/migrations.md) first.
