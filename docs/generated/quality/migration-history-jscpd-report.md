# jscpd Migration-History Duplicate-Code Report

This informational report tracks duplication inside applied Supabase migrations.

Do not rewrite historical migrations to reduce this metric; use a planned migration squash or bootstrap workflow only after environment coordination.

Command: `npx jscpd supabase/migrations --gitignore --min-lines 8 --min-tokens 80 --reporters json --exitCode 0`
Exit code: `0`

```text
Clone found (sql):
 - supabase/migrations/0001_core_schema_auth_storage.sql [174:12 - 197:7] (23 lines)
   supabase/migrations/0006_rls_storage_hardening.sql [141:6 - 164:5]

Clone found (sql):
 - supabase/migrations/0001_core_schema_auth_storage.sql [256:31 - 352:7] (96 lines)
   supabase/migrations/0004_profiles_avatars_public_profile.sql [89:3 - 185:5]

Clone found (sql):
 - supabase/migrations/0002_resume_context_reads_presence.sql [107:30 - 139:7] (32 lines)
   supabase/migrations/0006_rls_storage_hardening.sql [353:37 - 385:7]

Clone found (sql):
 - supabase/migrations/0002_resume_context_reads_presence.sql [221:28 - 243:47] (22 lines)
   supabase/migrations/0006_rls_storage_hardening.sql [381:32 - 404:8]

Clone found (sql):
 - supabase/migrations/0003_roast_threads_reactions_deletes.sql [81:83 - 105:68] (24 lines)
   supabase/migrations/0006_rls_storage_hardening.sql [175:4 - 199:66]

Clone found (sql):
 - supabase/migrations/0003_roast_threads_reactions_deletes.sql [117:9 - 135:19] (18 lines)
   supabase/migrations/0006_rls_storage_hardening.sql [222:9 - 240:20]

Clone found (sql):
 - supabase/migrations/0004_profiles_avatars_public_profile.sql [116:28 - 156:14] (40 lines)
   supabase/migrations/0014_linted_profile_defaults.sql [28:29 - 68:15]

Clone found (sql):
 - supabase/migrations/0004_profiles_avatars_public_profile.sql [157:3 - 180:5] (23 lines)
   supabase/migrations/0014_linted_profile_defaults.sql [69:3 - 92:7]

Clone found (sql):
 - supabase/migrations/0004_profiles_avatars_public_profile.sql [200:16 - 265:33] (65 lines)
   supabase/migrations/0018_map_onboarding_persona_to_profile_role.sql [161:28 - 318:28]

Clone found (sql):
 - supabase/migrations/0004_profiles_avatars_public_profile.sql [264:20 - 301:58] (37 lines)
   supabase/migrations/0018_map_onboarding_persona_to_profile_role.sql [233:34 - 362:55]

Clone found (sql):
 - supabase/migrations/0005_leaderboard_auth_lookup.sql [29:25 - 44:7] (15 lines)
   supabase/migrations/0013_reviewer_community_layer.sql [398:42 - 413:7]

Clone found (sql):
 - supabase/migrations/0006_rls_storage_hardening.sql [232:3 - 246:57] (14 lines)
   supabase/migrations/0006_rls_storage_hardening.sql [213:3 - 227:57]

Clone found (sql):
 - supabase/migrations/0006_rls_storage_hardening.sql [256:33 - 274:5] (18 lines)
   supabase/migrations/0021_revert_security_reliability_hardening.sql [5:89 - 22:7]

Clone found (sql):
 - supabase/migrations/0007_content_reporting_moderation.sql [139:73 - 301:62] (162 lines)
   supabase/migrations/0010_admin_stickers_moderation.sql [235:3 - 681:47]

Clone found (sql):
 - supabase/migrations/0008_saved_resumes.sql [5:1 - 47:52] (42 lines)
   supabase/migrations/0029_saved_resumes_api_contract.sql [6:1 - 48:52]

Clone found (sql):
 - supabase/migrations/0008_saved_resumes.sql [53:7 - 84:31] (31 lines)
   supabase/migrations/0029_saved_resumes_api_contract.sql [49:23 - 80:31]

Clone found (sql):
 - supabase/migrations/0010_admin_stickers_moderation.sql [237:75 - 406:7] (169 lines)
   supabase/migrations/0021_revert_security_reliability_hardening.sql [20:3 - 189:5]

Clone found (sql):
 - supabase/migrations/0011_comment_media_markdown.sql [57:3 - 75:7] (18 lines)
   supabase/migrations/0012_comment_images_only.sql [48:3 - 66:7]

Clone found (sql):
 - supabase/migrations/0013_reviewer_community_layer.sql [230:56 - 314:13] (84 lines)
   supabase/migrations/0018_map_onboarding_persona_to_profile_role.sql [138:96 - 222:13]

Clone found (sql):
 - supabase/migrations/0013_reviewer_community_layer.sql [314:66 - 362:5] (48 lines)
   supabase/migrations/0018_map_onboarding_persona_to_profile_role.sql [222:14 - 270:7]

Clone found (sql):
 - supabase/migrations/0013_reviewer_community_layer.sql [356:3 - 404:6] (48 lines)
   supabase/migrations/0022_lint_points_helpful_votes.sql [94:3 - 142:13]

Clone found (sql):
 - supabase/migrations/0015_role_onboarding.sql [224:76 - 316:16] (92 lines)
   supabase/migrations/0051_db_lint_warning_cleanup.sql [141:35 - 95:17]

Clone found (sql):
 - supabase/migrations/0016_fix_onboarding_rpc_ambiguity.sql [3:1 - 28:6] (25 lines)
   supabase/migrations/0051_db_lint_warning_cleanup.sql [143:1 - 28:24]

Clone found (sql):
 - supabase/migrations/0016_fix_onboarding_rpc_ambiguity.sql [27:27 - 53:9] (26 lines)
   supabase/migrations/0047_guided_review_queue.sql [341:29 - 193:24]

Clone found (sql):
 - supabase/migrations/0016_fix_onboarding_rpc_ambiguity.sql [51:83 - 104:18] (53 lines)
   supabase/migrations/0018_map_onboarding_persona_to_profile_role.sql [53:65 - 106:21]

Clone found (sql):
 - supabase/migrations/0018_map_onboarding_persona_to_profile_role.sql [3:1 - 25:21] (22 lines)
   supabase/migrations/0051_db_lint_warning_cleanup.sql [143:1 - 165:22]

Clone found (sql):
 - supabase/migrations/0018_map_onboarding_persona_to_profile_role.sql [27:27 - 55:9] (28 lines)
   supabase/migrations/0047_guided_review_queue.sql [340:27 - 195:9]

Clone found (sql):
 - supabase/migrations/0018_map_onboarding_persona_to_profile_role.sql [77:9 - 105:35] (28 lines)
   supabase/migrations/0051_db_lint_warning_cleanup.sql [193:66 - 221:33]

Clone found (sql):
 - supabase/migrations/0018_map_onboarding_persona_to_profile_role.sql [140:1 - 181:40] (41 lines)
   supabase/migrations/0022_lint_points_helpful_votes.sql [5:1 - 46:9]

Clone found (sql):
 - supabase/migrations/0018_map_onboarding_persona_to_profile_role.sql [212:3 - 237:6] (25 lines)
   supabase/migrations/0022_lint_points_helpful_votes.sql [58:3 - 83:13]

Clone found (sql):
 - supabase/migrations/0019_realtime_notifications.sql [408:3 - 426:20] (18 lines)
   supabase/migrations/0039_transactional_admin_messages.sql [248:7 - 267:6]

Clone found (sql):
 - supabase/migrations/0019_realtime_notifications.sql [538:3 - 576:5] (38 lines)
   supabase/migrations/0050_validate_integrity_and_restore_review_votes.sql [225:3 - 263:7]

Clone found (sql):
 - supabase/migrations/0020_security_reliability_hardening.sql [5:1 - 93:9] (88 lines)
   supabase/migrations/0028_authenticated_write_rate_limits.sql [5:1 - 93:9]

Clone found (sql):
 - supabase/migrations/0020_security_reliability_hardening.sql [91:9 - 148:12] (57 lines)
   supabase/migrations/0028_authenticated_write_rate_limits.sql [94:48 - 151:14]

Clone found (sql):
 - supabase/migrations/0020_security_reliability_hardening.sql [215:81 - 235:12] (20 lines)
   supabase/migrations/0028_authenticated_write_rate_limits.sql [234:80 - 254:14]

Clone found (sql):
 - supabase/migrations/0020_security_reliability_hardening.sql [519:3 - 553:10] (34 lines)
   supabase/migrations/0021_revert_security_reliability_hardening.sql [20:4 - 54:5]

Clone found (sql):
 - supabase/migrations/0020_security_reliability_hardening.sql [553:78 - 642:10] (89 lines)
   supabase/migrations/0021_revert_security_reliability_hardening.sql [52:9 - 140:36]

Clone found (sql):
 - supabase/migrations/0020_security_reliability_hardening.sql [670:3 - 685:60] (15 lines)
   supabase/migrations/0028_authenticated_write_rate_limits.sql [445:3 - 460:61]

Clone found (sql):
 - supabase/migrations/0021_revert_security_reliability_hardening.sql [25:19 - 45:21] (20 lines)
   supabase/migrations/0023_profile_reports_admin_controls.sql [85:21 - 105:17]

Clone found (sql):
 - supabase/migrations/0021_revert_security_reliability_hardening.sql [87:27 - 114:6] (27 lines)
   supabase/migrations/0023_profile_reports_admin_controls.sql [149:60 - 176:7]

Clone found (sql):
 - supabase/migrations/0021_revert_security_reliability_hardening.sql [131:7 - 159:16] (28 lines)
   supabase/migrations/0028_authenticated_write_rate_limits.sql [399:7 - 427:15]

Clone found (sql):
 - supabase/migrations/0023_profile_reports_admin_controls.sql [78:75 - 100:25] (22 lines)
   supabase/migrations/0028_authenticated_write_rate_limits.sql [252:71 - 275:18]

Clone found (sql):
 - supabase/migrations/0023_profile_reports_admin_controls.sql [100:79 - 150:52] (50 lines)
   supabase/migrations/0025_linted_naming_compatibility.sql [170:6 - 331:53]

Clone found (sql):
 - supabase/migrations/0023_profile_reports_admin_controls.sql [171:58 - 278:31] (107 lines)
   supabase/migrations/0028_authenticated_write_rate_limits.sql [352:59 - 348:31]

Clone found (sql):
 - supabase/migrations/0025_linted_naming_compatibility.sql [143:94 - 186:5] (43 lines)
   supabase/migrations/0028_authenticated_write_rate_limits.sql [252:72 - 295:10]

Clone found (sql):
 - supabase/migrations/0025_linted_naming_compatibility.sql [184:9 - 345:45] (161 lines)
   supabase/migrations/0028_authenticated_write_rate_limits.sql [295:78 - 456:47]

Clone found (sql):
 - supabase/migrations/0026_data_integrity_guardrails.sql [29:1 - 40:8] (11 lines)
   supabase/migrations/0050_validate_integrity_and_restore_review_votes.sql [92:1 - 103:8]

Clone found (sql):
 - supabase/migrations/0026_data_integrity_guardrails.sql [76:14 - 91:13] (15 lines)
   supabase/migrations/0050_validate_integrity_and_restore_review_votes.sql [128:7 - 143:15]

Clone found (sql):
 - supabase/migrations/0028_authenticated_write_rate_limits.sql [137:1 - 165:18] (28 lines)
   supabase/migrations/0030_rate_limit_pgcrypto_schema.sql [23:5 - 51:22]

Clone found (sql):
 - supabase/migrations/0036_refine_linted_usernames.sql [5:1 - 113:7] (108 lines)
   supabase/migrations/0051_db_lint_warning_cleanup.sql [4:1 - 112:8]

Clone found (sql):
 - supabase/migrations/0036_refine_linted_usernames.sql [113:3 - 136:4] (23 lines)
   supabase/migrations/0051_db_lint_warning_cleanup.sql [112:24 - 136:9]

Clone found (sql):
 - supabase/migrations/0037_admin_delete_user_transaction.sql [28:32 - 97:52] (69 lines)
   supabase/migrations/0074_production_backend_integrity_hardening.sql [299:32 - 367:53]

Clone found (sql):
 - supabase/migrations/0037_admin_delete_user_transaction.sql [94:24 - 119:7] (25 lines)
   supabase/migrations/0074_production_backend_integrity_hardening.sql [403:76 - 428:11]

Clone found (sql):
 - supabase/migrations/0037_admin_delete_user_transaction.sql [117:56 - 139:37] (22 lines)
   supabase/migrations/0074_production_backend_integrity_hardening.sql [452:70 - 474:47]

Clone found (sql):
 - supabase/migrations/0037_admin_delete_user_transaction.sql [144:56 - 173:42] (29 lines)
   supabase/migrations/0074_production_backend_integrity_hardening.sql [499:80 - 528:48]

Clone found (sql):
 - supabase/migrations/0037_admin_delete_user_transaction.sql [171:72 - 198:38] (27 lines)
   supabase/migrations/0074_production_backend_integrity_hardening.sql [542:70 - 569:30]

Clone found (sql):
 - supabase/migrations/0037_admin_delete_user_transaction.sql [196:80 - 231:16] (35 lines)
   supabase/migrations/0074_production_backend_integrity_hardening.sql [589:3 - 624:27]

Clone found (sql):
 - supabase/migrations/0037_admin_delete_user_transaction.sql [230:48 - 260:31] (30 lines)
   supabase/migrations/0074_production_backend_integrity_hardening.sql [625:55 - 657:31]

Clone found (sql):
 - supabase/migrations/0042_transactional_admin_moderation_actions.sql [217:37 - 322:19] (105 lines)
   supabase/migrations/0050_validate_integrity_and_restore_review_votes.sql [294:24 - 399:11]

Clone found (sql):
 - supabase/migrations/0042_transactional_admin_moderation_actions.sql [325:72 - 374:9] (49 lines)
   supabase/migrations/0050_validate_integrity_and_restore_review_votes.sql [418:39 - 467:56]

Clone found (sql):
 - supabase/migrations/0042_transactional_admin_moderation_actions.sql [402:66 - 562:64] (160 lines)
   supabase/migrations/0050_validate_integrity_and_restore_review_votes.sql [529:5 - 689:56]

Clone found (sql):
 - supabase/migrations/0047_guided_review_queue.sql [316:129 - 343:5] (27 lines)
   supabase/migrations/0051_db_lint_warning_cleanup.sql [141:35 - 168:10]

Clone found (sql):
 - supabase/migrations/0047_guided_review_queue.sql [343:3 - 416:138] (73 lines)
   supabase/migrations/0051_db_lint_warning_cleanup.sql [170:3 - 245:127]

Clone found (sql):
 - supabase/migrations/0053_submit_community_post_rpc.sql [35:54 - 66:9] (31 lines)
   supabase/migrations/0058_allow_title_only_community_posts.sql [45:75 - 71:5]

Clone found (sql):
 - supabase/migrations/0053_submit_community_post_rpc.sql [63:74 - 166:5] (103 lines)
   supabase/migrations/0054_community_post_media_and_comments.sql [212:47 - 221:6]

Clone found (sql):
 - supabase/migrations/0054_community_post_media_and_comments.sql [162:3 - 228:16] (66 lines)
   supabase/migrations/0058_allow_title_only_community_posts.sql [33:3 - 99:17]

Clone found (sql):
 - supabase/migrations/0054_community_post_media_and_comments.sql [228:20 - 259:9] (31 lines)
   supabase/migrations/0058_allow_title_only_community_posts.sql [99:43 - 130:9]

Clone found (sql):
 - supabase/migrations/0054_community_post_media_and_comments.sql [283:17 - 389:13] (106 lines)
   supabase/migrations/0058_allow_title_only_community_posts.sql [189:9 - 295:9]

Clone found (sql):
 - supabase/migrations/0054_community_post_media_and_comments.sql [427:9 - 449:9] (22 lines)
   supabase/migrations/0070_community_comment_static_images.sql [110:58 - 131:38]

Clone found (sql):
 - supabase/migrations/0054_community_post_media_and_comments.sql [462:30 - 498:8] (36 lines)
   supabase/migrations/0055_community_discussion_actions.sql [201:9 - 237:7]

Clone found (sql):
 - supabase/migrations/0055_community_discussion_actions.sql [156:56 - 203:9] (47 lines)
   supabase/migrations/0070_community_comment_static_images.sql [101:27 - 148:5]

Clone found (sql):
 - supabase/migrations/0055_community_discussion_actions.sql [235:18 - 299:18] (64 lines)
   supabase/migrations/0062_fix_community_vote_rpc_conflicts.sql [77:7 - 141:19]

Clone found (sql):
 - supabase/migrations/0055_community_discussion_actions.sql [299:37 - 391:18] (92 lines)
   supabase/migrations/0062_fix_community_vote_rpc_conflicts.sql [142:7 - 233:19]

Clone found (sql):
 - supabase/migrations/0055_community_discussion_actions.sql [391:40 - 416:7] (25 lines)
   supabase/migrations/0062_fix_community_vote_rpc_conflicts.sql [234:7 - 258:8]

Clone found (sql):
 - supabase/migrations/0055_community_discussion_actions.sql [414:18 - 449:33] (35 lines)
   supabase/migrations/0058_allow_title_only_community_posts.sql [307:113 - 342:33]

Clone found (sql):
 - supabase/migrations/0055_community_discussion_actions.sql [450:72 - 497:7] (47 lines)
   supabase/migrations/0058_allow_title_only_community_posts.sql [343:63 - 390:7]

Clone found (sql):
 - supabase/migrations/0055_community_discussion_actions.sql [589:67 - 611:61] (22 lines)
   supabase/migrations/0062_fix_community_vote_rpc_conflicts.sql [193:43 - 292:63]

Clone found (sql):
 - supabase/migrations/0055_community_discussion_actions.sql [634:83 - 684:9] (50 lines)
   supabase/migrations/0070_community_comment_static_images.sql [247:87 - 297:18]

Clone found (sql):
 - supabase/migrations/0055_community_discussion_actions.sql [684:5 - 706:7] (22 lines)
   supabase/migrations/0070_community_comment_static_images.sql [298:5 - 320:8]

Clone found (sql):
 - supabase/migrations/0057_fix_community_post_submit_profile_conflict.sql [5:1 - 67:33] (62 lines)
   supabase/migrations/0058_allow_title_only_community_posts.sql [10:1 - 72:33]

Clone found (sql):
 - supabase/migrations/0057_fix_community_post_submit_profile_conflict.sql [68:74 - 302:92] (234 lines)
   supabase/migrations/0058_allow_title_only_community_posts.sql [73:65 - 307:113]

Clone found (sql):
 - supabase/migrations/0058_allow_title_only_community_posts.sql [128:11 - 166:5] (38 lines)
   supabase/migrations/0060_community_polls_and_drafts_support.sql [207:53 - 245:9]

Clone found (sql):
 - supabase/migrations/0060_community_polls_and_drafts_support.sql [329:9 - 366:16] (37 lines)
   supabase/migrations/0061_fix_community_poll_vote_rpc_conflict.sql [28:58 - 65:17]

Clone found (sql):
 - supabase/migrations/0062_fix_community_vote_rpc_conflicts.sql [194:9 - 214:32] (20 lines)
   supabase/migrations/0070_community_comment_static_images.sql [271:58 - 291:32]

Clone found (sql):
 - supabase/migrations/0064_hard_delete_community_posts.sql [48:1 - 82:9] (34 lines)
   supabase/migrations/0074_production_backend_integrity_hardening.sql [110:1 - 144:9]

Clone found (sql):
 - supabase/migrations/0064_hard_delete_community_posts.sql [80:9 - 126:134] (46 lines)
   supabase/migrations/0074_production_backend_integrity_hardening.sql [153:60 - 199:108]

Clone found (sql):
 - supabase/migrations/0066_refine_reviewer_leaderboard_ranking.sql [83:3 - 115:10] (32 lines)
   supabase/migrations/0066_refine_reviewer_leaderboard_ranking.sql [16:60 - 47:10]

Clone found (sql):
 - supabase/migrations/0066_refine_reviewer_leaderboard_ranking.sql [116:5 - 146:64] (30 lines)
   supabase/migrations/0066_refine_reviewer_leaderboard_ranking.sql [47:5 - 77:58]

Clone found (sql):
 - supabase/migrations/0068_indexed_mention_profile_search.sql [24:1 - 55:6] (31 lines)
   supabase/migrations/0069_optimize_mention_typeahead_latency.sql [6:1 - 37:24]

Clone found (sql):
 - supabase/migrations/0068_indexed_mention_profile_search.sql [69:9 - 97:68] (28 lines)
   supabase/migrations/0069_optimize_mention_typeahead_latency.sql [56:43 - 85:9]

sql: 79 files, 17644 lines, 90 clones, 4413 duplicated lines (25.01%)
Total: 79 files, 17644 lines, 90 clones, 4413 duplicated lines (25.01%)
Found 90 clones.
```
