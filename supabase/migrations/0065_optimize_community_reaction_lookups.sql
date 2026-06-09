-- Linted 0065: targeted reaction lookup indexes for visible community rows.
-- These support queries shaped as "current user's reactions for these visible ids".

create index if not exists community_post_votes_voter_post_reaction_idx
  on public.community_post_votes (voter_id, post_id)
  include (reaction);

create index if not exists community_comment_votes_voter_comment_reaction_idx
  on public.community_comment_votes (voter_id, comment_id)
  include (reaction);

create index if not exists community_post_poll_votes_voter_poll_option_idx
  on public.community_post_poll_votes (voter_id, poll_id)
  include (option_id);
