# Linted Database Naming Map

This document is the source of truth for moving old RoastResumes-era database
language to Linted language without breaking production data, RLS policies, RPCs,
or deployed clients.

## Rule

Do not hard-rename production tables or columns until the application has moved
to Linted-facing aliases and compatibility RPCs. Historic migrations stay as
history. New changes are forward-only migrations.

## Canonical Names

| Legacy physical name | Linted canonical name | Notes |
| --- | --- | --- |
| `roasts` | `resume_reviews` | Main feedback/review thread table. |
| `roast` | `review` | Use in UI, API payloads, types, and new RPCs. |
| `roast_id` | `review_id` | Keep legacy DB column until hard migration. |
| `parent_id` | `parent_review_id` | Thread replies. |
| `author_id` | `reviewer_id` | The user who wrote a review. |
| `roast_count` | `review_count` | Count of reviews/comments, not score. |
| `helpful_votes` | `lint_points` | User-given likes on reviews. |
| `votes` | `review_votes` | Reactions/likes/dislikes on reviews. |
| `voter_id` | `voter_id` | Already clear enough; avoid `user_id` ambiguity. |
| `get_roaster_leaderboard` | `get_reviewer_leaderboard` | New RPC should return `review_count` and `lint_points`. |
| `get_public_profile_roasts` | `get_public_profile_reviews` | New RPC should return profile review history. |
| `get_active_roaster_count` | `get_active_reviewer_count` | New RPC wraps the existing presence data. |

## Migration Strategy

1. Add non-breaking aliases: views and RPCs with Linted names.
2. Update app code to call new RPCs first and fall back to legacy RPCs while
   migrations roll out.
3. Replace app-facing type/component names over time.
4. Keep legacy physical table names hidden until a dedicated maintenance window.
5. If a hard rename is still worth it later, perform it after all deployed code
   has stopped using legacy names.

## Why Not Rename Tables Immediately

Supabase RLS policies, triggers, PostgREST schema cache, foreign keys, RPCs,
storage cleanup code, realtime subscriptions, and deployed clients can all refer
to physical names. A direct table rename from `roasts` to `resume_reviews` would
be high risk. A compatibility layer gives us clean Linted naming with rollback
safety.
