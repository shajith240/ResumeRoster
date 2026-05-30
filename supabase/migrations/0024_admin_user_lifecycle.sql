-- Linted 0024: admin user lifecycle actions.
-- Allows the admin console to record irreversible account deletion without
-- weakening the existing moderation audit trail.

alter table public.moderation_actions
  drop constraint if exists moderation_actions_action_check,
  drop constraint if exists moderation_actions_target_type_check,
  add constraint moderation_actions_action_check
    check (
      action in (
        'dismiss_report',
        'mark_report_reviewing',
        'mark_report_actioned',
        'remove_roast',
        'restore_roast',
        'close_resume',
        'reopen_resume',
        'hide_sticker',
        'show_sticker',
        'upload_sticker',
        'delete_sticker',
        'approve_reviewer',
        'reject_reviewer',
        'reset_reviewer',
        'reset_reviewer_trust',
        'clear_public_profile_text',
        'clear_reviewer_profile',
        'delete_user_account'
      )
    ),
  add constraint moderation_actions_target_type_check
    check (target_type in ('report', 'roast', 'resume', 'sticker', 'reviewer_application', 'profile', 'user'));

notify pgrst, 'reload schema';
