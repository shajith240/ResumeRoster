# jscpd Duplicate-Code Report

Command: `npx jscpd app components lib scripts supabase --gitignore --min-lines 8 --min-tokens 80 --reporters console --exitCode 0 --noTips`
Exit code: `0`

```text
Clone found (sql):
 - supabase\migrations\0028_authenticated_write_rate_limits.sql [137:1 - 165:18] (28 lines, 169 tokens)
   supabase\migrations\0030_rate_limit_pgcrypto_schema.sql [23:5 - 51:22]

Clone found (sql):
 - supabase\migrations\0025_linted_naming_compatibility.sql [143:94 - 186:5] (43 lines, 357 tokens)
   supabase\migrations\0028_authenticated_write_rate_limits.sql [252:72 - 295:10]

Clone found (sql):
 - supabase\migrations\0025_linted_naming_compatibility.sql [184:9 - 345:45] (161 lines, 1230 tokens)
   supabase\migrations\0028_authenticated_write_rate_limits.sql [295:78 - 456:47]

Clone found (sql):
 - supabase\migrations\0023_profile_reports_admin_controls.sql [78:75 - 100:25] (22 lines, 168 tokens)
   supabase\migrations\0028_authenticated_write_rate_limits.sql [252:71 - 275:18]

Clone found (sql):
 - supabase\migrations\0023_profile_reports_admin_controls.sql [100:79 - 150:52] (50 lines, 456 tokens)
   supabase\migrations\0025_linted_naming_compatibility.sql [170:6 - 331:53]

Clone found (sql):
 - supabase\migrations\0023_profile_reports_admin_controls.sql [171:58 - 278:31] (107 lines, 817 tokens)
   supabase\migrations\0028_authenticated_write_rate_limits.sql [352:59 - 348:31]

Clone found (sql):
 - supabase\migrations\0021_revert_security_reliability_hardening.sql [25:19 - 45:21] (20 lines, 169 tokens)
   supabase\migrations\0023_profile_reports_admin_controls.sql [85:21 - 105:17]

Clone found (sql):
 - supabase\migrations\0021_revert_security_reliability_hardening.sql [87:27 - 114:6] (27 lines, 199 tokens)
   supabase\migrations\0023_profile_reports_admin_controls.sql [149:60 - 176:7]

Clone found (sql):
 - supabase\migrations\0021_revert_security_reliability_hardening.sql [131:7 - 159:16] (28 lines, 185 tokens)
   supabase\migrations\0028_authenticated_write_rate_limits.sql [399:7 - 427:15]

Clone found (sql):
 - supabase\migrations\0020_security_reliability_hardening.sql [5:1 - 93:9] (88 lines, 994 tokens)
   supabase\migrations\0028_authenticated_write_rate_limits.sql [5:1 - 93:9]

Clone found (sql):
 - supabase\migrations\0020_security_reliability_hardening.sql [91:9 - 148:12] (57 lines, 448 tokens)
   supabase\migrations\0028_authenticated_write_rate_limits.sql [94:48 - 151:14]

Clone found (sql):
 - supabase\migrations\0020_security_reliability_hardening.sql [215:81 - 235:12] (20 lines, 169 tokens)
   supabase\migrations\0028_authenticated_write_rate_limits.sql [234:80 - 254:14]

Clone found (sql):
 - supabase\migrations\0020_security_reliability_hardening.sql [519:3 - 553:10] (34 lines, 295 tokens)
   supabase\migrations\0021_revert_security_reliability_hardening.sql [20:4 - 54:5]

Clone found (sql):
 - supabase\migrations\0020_security_reliability_hardening.sql [553:78 - 642:10] (89 lines, 754 tokens)
   supabase\migrations\0021_revert_security_reliability_hardening.sql [52:9 - 140:36]

Clone found (sql):
 - supabase\migrations\0020_security_reliability_hardening.sql [670:3 - 685:60] (15 lines, 187 tokens)
   supabase\migrations\0028_authenticated_write_rate_limits.sql [445:3 - 460:61]

Clone found (sql):
 - supabase\migrations\0019_realtime_notifications.sql [408:3 - 426:20] (18 lines, 170 tokens)
   supabase\migrations\0039_transactional_admin_messages.sql [248:7 - 267:6]

Clone found (sql):
 - supabase\migrations\0018_map_onboarding_persona_to_profile_role.sql [140:1 - 181:40] (41 lines, 259 tokens)
   supabase\migrations\0022_lint_points_helpful_votes.sql [5:1 - 46:9]

Clone found (sql):
 - supabase\migrations\0018_map_onboarding_persona_to_profile_role.sql [212:3 - 237:6] (25 lines, 144 tokens)
   supabase\migrations\0022_lint_points_helpful_votes.sql [58:3 - 83:13]

Clone found (sql):
 - supabase\migrations\0016_fix_onboarding_rpc_ambiguity.sql [3:1 - 28:6] (25 lines, 172 tokens)
   supabase\migrations\0018_map_onboarding_persona_to_profile_role.sql [3:1 - 28:24]

Clone found (sql):
 - supabase\migrations\0016_fix_onboarding_rpc_ambiguity.sql [27:27 - 53:9] (26 lines, 190 tokens)
   supabase\migrations\0018_map_onboarding_persona_to_profile_role.sql [28:29 - 53:24]

Clone found (sql):
 - supabase\migrations\0016_fix_onboarding_rpc_ambiguity.sql [51:83 - 104:18] (53 lines, 410 tokens)
   supabase\migrations\0018_map_onboarding_persona_to_profile_role.sql [53:65 - 106:21]

Clone found (sql):
 - supabase\migrations\0015_role_onboarding.sql [226:1 - 316:16] (90 lines, 680 tokens)
   supabase\migrations\0018_map_onboarding_persona_to_profile_role.sql [3:1 - 95:17]

Clone found (sql):
 - supabase\migrations\0013_reviewer_community_layer.sql [230:56 - 314:13] (84 lines, 603 tokens)
   supabase\migrations\0018_map_onboarding_persona_to_profile_role.sql [138:96 - 222:13]

Clone found (sql):
 - supabase\migrations\0013_reviewer_community_layer.sql [314:66 - 362:5] (48 lines, 415 tokens)
   supabase\migrations\0018_map_onboarding_persona_to_profile_role.sql [222:14 - 270:7]

Clone found (sql):
 - supabase\migrations\0013_reviewer_community_layer.sql [356:3 - 404:6] (48 lines, 317 tokens)
   supabase\migrations\0022_lint_points_helpful_votes.sql [94:3 - 142:13]

Clone found (sql):
 - supabase\migrations\0011_comment_media_markdown.sql [57:3 - 75:7] (18 lines, 180 tokens)
   supabase\migrations\0012_comment_images_only.sql [48:3 - 66:7]

Clone found (sql):
 - supabase\migrations\0010_admin_stickers_moderation.sql [237:75 - 406:7] (169 lines, 1270 tokens)
   supabase\migrations\0021_revert_security_reliability_hardening.sql [20:3 - 189:5]

Clone found (sql):
 - supabase\migrations\0008_saved_resumes.sql [5:1 - 47:52] (42 lines, 463 tokens)
   supabase\migrations\0029_saved_resumes_api_contract.sql [6:1 - 48:52]

Clone found (sql):
 - supabase\migrations\0008_saved_resumes.sql [53:7 - 84:31] (31 lines, 266 tokens)
   supabase\migrations\0029_saved_resumes_api_contract.sql [49:23 - 80:31]

Clone found (sql):
 - supabase\migrations\0007_content_reporting_moderation.sql [139:73 - 301:62] (162 lines, 1196 tokens)
   supabase\migrations\0010_admin_stickers_moderation.sql [235:3 - 681:47]

Clone found (sql):
 - supabase\migrations\0006_rls_storage_hardening.sql [232:3 - 246:57] (14 lines, 143 tokens)
   supabase\migrations\0006_rls_storage_hardening.sql [213:3 - 227:57]

Clone found (sql):
 - supabase\migrations\0006_rls_storage_hardening.sql [256:33 - 274:5] (18 lines, 162 tokens)
   supabase\migrations\0021_revert_security_reliability_hardening.sql [5:89 - 22:7]

Clone found (sql):
 - supabase\migrations\0005_leaderboard_auth_lookup.sql [29:25 - 44:7] (15 lines, 139 tokens)
   supabase\migrations\0013_reviewer_community_layer.sql [398:42 - 413:7]

Clone found (sql):
 - supabase\migrations\0004_profiles_avatars_public_profile.sql [116:28 - 156:14] (40 lines, 286 tokens)
   supabase\migrations\0014_linted_profile_defaults.sql [28:29 - 68:15]

Clone found (sql):
 - supabase\migrations\0004_profiles_avatars_public_profile.sql [157:3 - 180:5] (23 lines, 185 tokens)
   supabase\migrations\0014_linted_profile_defaults.sql [69:3 - 92:7]

Clone found (sql):
 - supabase\migrations\0004_profiles_avatars_public_profile.sql [200:16 - 265:33] (65 lines, 493 tokens)
   supabase\migrations\0018_map_onboarding_persona_to_profile_role.sql [161:28 - 318:28]

Clone found (sql):
 - supabase\migrations\0004_profiles_avatars_public_profile.sql [264:20 - 301:58] (37 lines, 358 tokens)
   supabase\migrations\0018_map_onboarding_persona_to_profile_role.sql [233:34 - 362:55]

Clone found (sql):
 - supabase\migrations\0003_roast_threads_reactions_deletes.sql [81:83 - 105:68] (24 lines, 180 tokens)
   supabase\migrations\0006_rls_storage_hardening.sql [175:4 - 199:66]

Clone found (sql):
 - supabase\migrations\0003_roast_threads_reactions_deletes.sql [117:9 - 135:19] (18 lines, 176 tokens)
   supabase\migrations\0006_rls_storage_hardening.sql [222:9 - 240:20]

Clone found (sql):
 - supabase\migrations\0002_resume_context_reads_presence.sql [107:30 - 139:7] (32 lines, 228 tokens)
   supabase\migrations\0006_rls_storage_hardening.sql [353:37 - 385:7]

Clone found (sql):
 - supabase\migrations\0002_resume_context_reads_presence.sql [221:28 - 243:47] (22 lines, 171 tokens)
   supabase\migrations\0006_rls_storage_hardening.sql [381:32 - 404:8]

Clone found (sql):
 - supabase\migrations\0001_core_schema_auth_storage.sql [174:12 - 197:7] (23 lines, 236 tokens)
   supabase\migrations\0006_rls_storage_hardening.sql [141:6 - 164:5]

Clone found (sql):
 - supabase\migrations\0001_core_schema_auth_storage.sql [256:31 - 352:7] (96 lines, 695 tokens)
   supabase\migrations\0004_profiles_avatars_public_profile.sql [89:3 - 185:5]

Clone found (typescript):
 - lib\supabase\types.ts [164:38 - 178:15] (14 lines, 155 tokens)
   lib\supabase\types.ts [144:34 - 158:14]

Clone found (tsx):
 - components\AuthGate.tsx [22:2 - 43:34] (21 lines, 172 tokens)
   components\ui\sign-up.tsx [17:75 - 37:29]

Clone found (tsx):
 - components\AuthGate.tsx [70:47 - 93:6] (23 lines, 205 tokens)
   components\ui\sign-up.tsx [150:63 - 173:8]

Clone found (typescript):
 - app\api\admin\reports\[id]\action\route.ts [54:24 - 69:47] (15 lines, 167 tokens)
   app\api\admin\users\[id]\action\route.ts [227:25 - 242:45]

Clone found (typescript):
 - app\api\admin\reports\[id]\action\route.ts [225:55 - 261:26] (36 lines, 242 tokens)
   app\api\admin\users\[id]\action\route.ts [371:72 - 408:5]

┌────────────┬────────────────┬─────────────┬──────────────┬──────────────┬──────────────────┬───────────────────┐
│ Format     │ Files analyzed │ Total lines │ Total tokens │ Clones found │ Duplicated lines │ Duplicated tokens │
├────────────┼────────────────┼─────────────┼──────────────┼──────────────┼──────────────────┼───────────────────┤
│ sql        │ 41             │ 9379        │ 79848        │ 43           │ 2096 (22.35%)    │ 16784 (21.02%)    │
├────────────┼────────────────┼─────────────┼──────────────┼──────────────┼──────────────────┼───────────────────┤
│ markdown   │ 1              │ 92          │ 429          │ 0            │ 0 (0%)           │ 0 (0%)            │
├────────────┼────────────────┼─────────────┼──────────────┼──────────────┼──────────────────┼───────────────────┤
│ bash       │ 1              │ 34          │ 39           │ 0            │ 0 (0%)           │ 0 (0%)            │
├────────────┼────────────────┼─────────────┼──────────────┼──────────────┼──────────────────┼───────────────────┤
│ toml       │ 1              │ 410         │ 1286         │ 0            │ 0 (0%)           │ 0 (0%)            │
├────────────┼────────────────┼─────────────┼──────────────┼──────────────┼──────────────────┼───────────────────┤
│ javascript │ 74             │ 9942        │ 85331        │ 0            │ 0 (0%)           │ 0 (0%)            │
├────────────┼────────────────┼─────────────┼──────────────┼──────────────┼──────────────────┼───────────────────┤
│ typescript │ 82             │ 9794        │ 83994        │ 3            │ 65 (0.66%)       │ 564 (0.67%)       │
├────────────┼────────────────┼─────────────┼──────────────┼──────────────┼──────────────────┼───────────────────┤
│ tsx        │ 77             │ 17197       │ 144496       │ 2            │ 44 (0.26%)       │ 377 (0.26%)       │
├────────────┼────────────────┼─────────────┼──────────────┼──────────────┼──────────────────┼───────────────────┤
│ css        │ 2              │ 494         │ 3451         │ 0            │ 0 (0%)           │ 0 (0%)            │
├────────────┼────────────────┼─────────────┼──────────────┼──────────────┼──────────────────┼───────────────────┤
│ Total:     │ 279            │ 47342       │ 398874       │ 48           │ 2205 (4.66%)     │ 17725 (4.44%)     │
└────────────┴────────────────┴─────────────┴──────────────┴──────────────┴──────────────────┴───────────────────┘
Found 48 clones.
time: deterministic
```
