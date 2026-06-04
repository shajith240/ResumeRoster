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

Clone found (sql):
 - supabase\submit-flow-fix.sql [86:28 - 107:62] (21 lines, 197 tokens)
   supabase\migrations\0001_core_schema_auth_storage.sql [148:26 - 169:73]

Clone found (sql):
 - supabase\submit-flow-fix.sql [105:31 - 132:7] (27 lines, 262 tokens)
   supabase\migrations\0001_core_schema_auth_storage.sql [170:77 - 163:5]

Clone found (sql):
 - supabase\submit-flow-fix.sql [130:30 - 297:5] (167 lines, 1347 tokens)
   supabase\migrations\0004_profiles_avatars_public_profile.sql [89:3 - 423:5]

Clone found (sql):
 - supabase\schema.sql [31:47 - 51:13] (20 lines, 274 tokens)
   supabase\migrations\0001_core_schema_auth_storage.sql [111:48 - 130:13]

Clone found (sql):
 - supabase\schema.sql [174:4 - 274:7] (100 lines, 741 tokens)
   supabase\migrations\0001_core_schema_auth_storage.sql [252:73 - 185:5]

Clone found (sql):
 - supabase\schema.sql [272:58 - 323:7] (51 lines, 444 tokens)
   supabase\migrations\0005_leaderboard_auth_lookup.sql [42:85 - 93:7]

Clone found (sql):
 - supabase\schema.sql [321:76 - 415:31] (94 lines, 772 tokens)
   supabase\migrations\0002_resume_context_reads_presence.sql [159:62 - 253:31]

Clone found (sql):
 - supabase\schema.sql [443:3 - 465:64] (22 lines, 228 tokens)
   supabase\migrations\0003_roast_threads_reactions_deletes.sql [352:3 - 374:60]

Clone found (sql):
 - supabase\schema.sql [521:85 - 555:42] (34 lines, 241 tokens)
   supabase\migrations\0005_leaderboard_auth_lookup.sql [5:86 - 39:43]

Clone found (sql):
 - supabase\schema.sql [588:81 - 619:16] (31 lines, 227 tokens)
   supabase\migrations\0003_roast_threads_reactions_deletes.sql [608:72 - 639:15]

Clone found (sql):
 - supabase\roast-deletes.sql [8:50 - 123:63] (115 lines, 935 tokens)
   supabase\migrations\0003_roast_threads_reactions_deletes.sql [70:47 - 185:62]

Clone found (sql):
 - supabase\roast-deletes.sql [121:62 - 169:7] (48 lines, 299 tokens)
   supabase\migrations\0003_roast_threads_reactions_deletes.sql [316:70 - 364:5]

Clone found (sql):
 - supabase\roast-deletes.sql [167:3 - 383:7] (216 lines, 1601 tokens)
   supabase\migrations\0003_roast_threads_reactions_deletes.sql [372:71 - 588:7]

Clone found (sql):
 - supabase\roast-deletes.sql [381:24 - 418:94] (37 lines, 277 tokens)
   supabase\migrations\0003_roast_threads_reactions_deletes.sql [608:72 - 645:94]

Clone found (sql):
 - supabase\roast-counts.sql [4:1 - 60:7] (56 lines, 400 tokens)
   supabase\migrations\0003_roast_threads_reactions_deletes.sql [318:1 - 374:7]

Clone found (sql):
 - supabase\roast-counts.sql [58:70 - 96:3] (38 lines, 297 tokens)
   supabase\migrations\0003_roast_threads_reactions_deletes.sql [529:1 - 567:3]

Clone found (sql):
 - supabase\replies.sql [65:51 - 129:7] (64 lines, 458 tokens)
   supabase\migrations\0003_roast_threads_reactions_deletes.sql [165:59 - 229:7]

Clone found (sql):
 - supabase\read-counts.sql [5:61 - 34:75] (29 lines, 258 tokens)
   supabase\migrations\0002_resume_context_reads_presence.sql [34:14 - 64:10]

Clone found (sql):
 - supabase\read-counts.sql [49:33 - 101:76] (52 lines, 453 tokens)
   supabase\migrations\0002_resume_context_reads_presence.sql [88:48 - 140:76]

Clone found (sql):
 - supabase\reactions.sql [44:31 - 104:5] (60 lines, 446 tokens)
   supabase\migrations\0003_roast_threads_reactions_deletes.sql [258:29 - 318:7]

Clone found (sql):
 - supabase\reactions.sql [102:71 - 122:66] (20 lines, 178 tokens)
   supabase\migrations\0003_roast_threads_reactions_deletes.sql [120:3 - 140:7]

Clone found (sql):
 - supabase\reactions.sql [124:83 - 138:44] (14 lines, 133 tokens)
   supabase\migrations\0003_roast_threads_reactions_deletes.sql [567:2 - 582:6]

Clone found (sql):
 - supabase\profile.sql [4:1 - 69:94] (65 lines, 458 tokens)
   supabase\schema.sql [560:1 - 645:94]

Clone found (sql):
 - supabase\profile-features.sql [12:101 - 159:14] (147 lines, 1126 tokens)
   supabase\migrations\0004_profiles_avatars_public_profile.sql [33:7 - 180:13]

Clone found (sql):
 - supabase\profile-features.sql [157:3 - 311:95] (154 lines, 1241 tokens)
   supabase\migrations\0004_profiles_avatars_public_profile.sql [183:58 - 337:95]

Clone found (sql):
 - supabase\phase1-hardening.sql [27:3 - 44:5] (17 lines, 150 tokens)
   supabase\migrations\0001_core_schema_auth_storage.sql [234:14 - 250:5]

Clone found (sql):
 - supabase\leaderboard.sql [4:59 - 43:86] (39 lines, 287 tokens)
   supabase\schema.sql [519:71 - 558:86]

Clone found (sql):
 - supabase\auth-profiles.sql [5:1 - 97:59] (92 lines, 688 tokens)
   supabase\migrations\0004_profiles_avatars_public_profile.sql [91:1 - 183:59]

Clone found (sql):
 - supabase\auth-email-lookup.sql [5:1 - 52:77] (47 lines, 438 tokens)
   supabase\migrations\0005_leaderboard_auth_lookup.sql [44:1 - 91:77]

Clone found (sql):
 - supabase\app-presence.sql [4:1 - 115:31] (111 lines, 988 tokens)
   supabase\migrations\0002_resume_context_reads_presence.sql [142:1 - 253:31]

Clone found (typescript):
 - lib\supabase\types.ts [164:38 - 178:15] (14 lines, 155 tokens)
   lib\supabase\types.ts [144:34 - 158:14]

Clone found (tsx):
 - components\ui\link.tsx [36:58 - 73:9] (37 lines, 308 tokens)
   components\ui\message-circle.tsx [44:1 - 81:7]

Clone found (tsx):
 - components\ui\eye.tsx [18:55 - 71:12] (53 lines, 398 tokens)
   components\ui\message-circle.tsx [44:1 - 89:12]

Clone found (tsx):
 - components\ui\bookmark.tsx [32:54 - 86:67] (54 lines, 389 tokens)
   components\ui\message-circle.tsx [44:54 - 91:75]

Clone found (tsx):
 - components\ui\accessibility.tsx [90:52 - 123:11] (33 lines, 218 tokens)
   components\ui\message-circle.tsx [53:51 - 86:18]

Clone found (tsx):
 - components\AuthGate.tsx [24:33 - 43:34] (19 lines, 158 tokens)
   components\ui\sign-up.tsx [39:2 - 58:29]

Clone found (tsx):
 - components\AuthGate.tsx [72:2 - 93:6] (21 lines, 200 tokens)
   components\ui\sign-up.tsx [219:2 - 240:8]

Clone found (typescript):
 - app\api\admin\reports\[id]\action\route.ts [54:24 - 69:47] (15 lines, 167 tokens)
   app\api\admin\users\[id]\action\route.ts [79:25 - 94:45]

Clone found (typescript):
 - app\api\admin\reports\[id]\action\route.ts [225:55 - 261:26] (36 lines, 242 tokens)
   app\api\admin\users\[id]\action\route.ts [326:72 - 363:5]

┌────────────┬────────────────┬─────────────┬──────────────┬──────────────┬──────────────────┬───────────────────┐
│ Format     │ Files analyzed │ Total lines │ Total tokens │ Clones found │ Duplicated lines │ Duplicated tokens │
├────────────┼────────────────┼─────────────┼──────────────┼──────────────┼──────────────────┼───────────────────┤
│ sql        │ 54             │ 11029       │ 93639        │ 72           │ 4066 (36.87%)    │ 32458 (34.66%)    │
├────────────┼────────────────┼─────────────┼──────────────┼──────────────┼──────────────────┼───────────────────┤
│ markdown   │ 1              │ 76          │ 416          │ 0            │ 0 (0%)           │ 0 (0%)            │
├────────────┼────────────────┼─────────────┼──────────────┼──────────────┼──────────────────┼───────────────────┤
│ bash       │ 1              │ 19          │ 34           │ 0            │ 0 (0%)           │ 0 (0%)            │
├────────────┼────────────────┼─────────────┼──────────────┼──────────────┼──────────────────┼───────────────────┤
│ toml       │ 1              │ 410         │ 1286         │ 0            │ 0 (0%)           │ 0 (0%)            │
├────────────┼────────────────┼─────────────┼──────────────┼──────────────┼──────────────────┼───────────────────┤
│ javascript │ 58             │ 6999        │ 61987        │ 0            │ 0 (0%)           │ 0 (0%)            │
├────────────┼────────────────┼─────────────┼──────────────┼──────────────┼──────────────────┼───────────────────┤
│ typescript │ 71             │ 8138        │ 70322        │ 3            │ 65 (0.8%)        │ 564 (0.8%)        │
├────────────┼────────────────┼─────────────┼──────────────┼──────────────┼──────────────────┼───────────────────┤
│ tsx        │ 62             │ 13160       │ 112852       │ 6            │ 217 (1.65%)      │ 1671 (1.48%)      │
├────────────┼────────────────┼─────────────┼──────────────┼──────────────┼──────────────────┼───────────────────┤
│ css        │ 2              │ 1081        │ 7343         │ 0            │ 0 (0%)           │ 0 (0%)            │
├────────────┼────────────────┼─────────────┼──────────────┼──────────────┼──────────────────┼───────────────────┤
│ Total:     │ 250            │ 40912       │ 347879       │ 81           │ 4348 (10.63%)    │ 34693 (9.97%)     │
└────────────┴────────────────┴─────────────┴──────────────┴──────────────┴──────────────────┴───────────────────┘
Found 81 clones.
time: 2.364s
```
