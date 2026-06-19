# jscpd Duplicate-Code Report

This actionable duplicate-code report excludes `supabase/migrations/**` because applied migrations are append-only production history.

Historical migration duplication is still captured in `migration-history-jscpd-report.md` for audit and planned squash decisions.

Command: `npx jscpd app components lib scripts supabase --gitignore --ignore "supabase/migrations/**" --min-lines 8 --min-tokens 80 --reporters json --exitCode 0`
Exit code: `0`

```text
Clone found (typescript):
 - app/api/admin/feedback/route.ts [44:1 - 55:12] (11 lines)
   app/api/admin/overview/route.ts [9:1 - 20:20]

Clone found (typescript):
 - app/api/admin/reports/[id]/action/route.ts [171:24 - 186:47] (15 lines)
   app/api/admin/users/[id]/action/route.ts [258:25 - 273:45]

Clone found (typescript):
 - app/api/community/comments/[id]/route.ts [37:28 - 49:65] (12 lines)
   app/api/community/comments/[id]/vote/route.ts [24:27 - 36:62]

Clone found (typescript):
 - app/api/community/comments/[id]/vote/route.ts [31:57 - 45:65] (14 lines)
   app/api/community/posts/[id]/vote/route.ts [31:54 - 45:62]

Clone found (typescript):
 - app/api/community/posts/[id]/lock/route.ts [19:20 - 33:18] (14 lines)
   app/api/community/posts/[id]/vote/route.ts [21:22 - 35:16]

Clone found (typescript):
 - app/api/community/posts/[id]/route.ts [64:28 - 76:62] (12 lines)
   app/api/community/posts/[id]/vote/route.ts [24:27 - 36:62]

Clone found (typescript):
 - app/api/payments/verify/route.ts [192:49 - 220:81] (28 lines)
   app/api/resumes/submit/route.ts [226:52 - 256:46]

Clone found (tsx):
 - components/AuthGate.tsx [22:2 - 43:34] (21 lines)
   components/auth/SignUp.tsx [18:75 - 38:29]

Clone found (tsx):
 - components/AuthGate.tsx [70:47 - 93:6] (23 lines)
   components/auth/SignUp.tsx [151:63 - 174:8]

Clone found (tsx):
 - components/leaderboard/StackedList.tsx [564:125 - 579:15] (15 lines)
   components/leaderboard/StackedList.tsx [537:6 - 552:19]

Clone found (tsx):
 - components/resume-detail/resume-preview-pane.tsx [49:37 - 63:34] (14 lines)
   components/resume-feed/presentation.tsx [156:47 - 170:31]

Clone found (tsx):
 - components/resume-detail/resume-preview-pane.tsx [93:49 - 112:8] (19 lines)
   components/resume-feed/presentation.tsx [213:30 - 232:8]

Clone found (typescript):
 - lib/__tests__/admin-data-route.test.ts [1:49 - 17:9] (16 lines)
   lib/__tests__/admin-users-route.test.ts [1:50 - 17:9]

Clone found (typescript):
 - lib/__tests__/avatar-validation.test.ts [5:33 - 17:9] (12 lines)
   lib/__tests__/comment-media-validation.test.ts [7:40 - 18:6]

Clone found (typescript):
 - lib/__tests__/comment-media-upload-route.test.ts [6:21 - 19:3] (13 lines)
   lib/__tests__/mention-users-route.test.ts [4:10 - 17:6]

Clone found (typescript):
 - lib/__tests__/comment-media-upload-route.test.ts [116:21 - 141:63] (25 lines)
   lib/__tests__/community-post-submit-route.test.ts [120:61 - 145:61]

Clone found (typescript):
 - lib/__tests__/community-comment-submit-route.test.ts [4:10 - 20:6] (16 lines)
   lib/__tests__/community-post-submit-route.test.ts [5:21 - 27:3]

Clone found (typescript):
 - lib/__tests__/community-post-submit-route.test.ts [5:73 - 26:6] (21 lines)
   lib/__tests__/resume-submit-route.test.ts [11:4 - 33:9]

Clone found (typescript):
 - lib/__tests__/mention-users-route.test.ts [4:62 - 19:26] (15 lines)
   lib/__tests__/push-subscriptions-route.test.ts [15:4 - 30:21]

Clone found (typescript):
 - lib/supabase/types.ts [178:38 - 194:15] (16 lines)
   lib/supabase/types.ts [157:34 - 173:24]

bash: 1 files, 34 lines, 0 clones, 0 duplicated lines (0%)
css: 13 files, 3579 lines, 0 clones, 0 duplicated lines (0%)
javascript: 105 files, 11822 lines, 0 clones, 0 duplicated lines (0%)
markdown: 1 files, 140 lines, 0 clones, 0 duplicated lines (0%)
toml: 1 files, 410 lines, 0 clones, 0 duplicated lines (0%)
tsx: 114 files, 21508 lines, 5 clones, 92 duplicated lines (0.43%)
typescript: 175 files, 22912 lines, 15 clones, 240 duplicated lines (1.05%)
Total: 410 files, 60405 lines, 20 clones, 332 duplicated lines (0.55%)
Found 20 clones.
```
