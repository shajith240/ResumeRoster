# jscpd Duplicate-Code Report

This actionable duplicate-code report excludes `supabase/migrations/**` because applied migrations are append-only production history.

Historical migration duplication is still captured in `migration-history-jscpd-report.md` for audit and planned squash decisions.

Command: `npx jscpd app components lib scripts supabase --gitignore --ignore "supabase/migrations/**" --min-lines 8 --min-tokens 80 --reporters console --exitCode 0 --noTips`
Exit code: `0`

```text
Clone found (typescript):
 - lib\__tests__\mention-users-route.test.ts [4:62 - 19:26] (15 lines, 122 tokens)
   lib\__tests__\push-subscriptions-route.test.ts [15:4 - 30:21]

Clone found (typescript):
 - lib\__tests__\community-post-submit-route.test.ts [5:73 - 26:6] (21 lines, 196 tokens)
   lib\__tests__\resume-submit-route.test.ts [11:4 - 33:9]

Clone found (typescript):
 - lib\__tests__\community-comment-submit-route.test.ts [4:10 - 20:6] (16 lines, 174 tokens)
   lib\__tests__\community-post-submit-route.test.ts [5:21 - 27:3]

Clone found (typescript):
 - lib\__tests__\comment-media-upload-route.test.ts [6:21 - 19:3] (13 lines, 129 tokens)
   lib\__tests__\mention-users-route.test.ts [4:10 - 17:6]

Clone found (typescript):
 - lib\__tests__\comment-media-upload-route.test.ts [116:21 - 141:63] (25 lines, 184 tokens)
   lib\__tests__\community-post-submit-route.test.ts [120:61 - 145:61]

Clone found (typescript):
 - lib\__tests__\avatar-validation.test.ts [5:33 - 17:9] (12 lines, 172 tokens)
   lib\__tests__\comment-media-validation.test.ts [7:40 - 18:6]

Clone found (typescript):
 - lib\__tests__\admin-data-route.test.ts [1:49 - 17:9] (16 lines, 161 tokens)
   lib\__tests__\admin-users-route.test.ts [1:50 - 17:9]

Clone found (typescript):
 - lib\supabase\types.ts [174:38 - 190:15] (16 lines, 175 tokens)
   lib\supabase\types.ts [153:34 - 169:24]

Clone found (tsx):
 - components\resume-detail\resume-preview-pane.tsx [49:37 - 63:34] (14 lines, 117 tokens)
   components\resume-feed\presentation.tsx [156:47 - 170:31]

Clone found (tsx):
 - components\resume-detail\resume-preview-pane.tsx [93:49 - 112:8] (19 lines, 180 tokens)
   components\resume-feed\presentation.tsx [213:30 - 232:8]

Clone found (tsx):
 - components\leaderboard\StackedList.tsx [564:125 - 579:15] (15 lines, 119 tokens)
   components\leaderboard\StackedList.tsx [537:6 - 552:19]

Clone found (tsx):
 - components\AuthGate.tsx [22:2 - 43:34] (21 lines, 172 tokens)
   components\auth\SignUp.tsx [18:75 - 38:29]

Clone found (tsx):
 - components\AuthGate.tsx [70:47 - 93:6] (23 lines, 205 tokens)
   components\auth\SignUp.tsx [151:63 - 174:8]

Clone found (typescript):
 - app\api\community\posts\[id]\lock\route.ts [19:20 - 33:18] (14 lines, 140 tokens)
   app\api\community\posts\[id]\vote\route.ts [21:22 - 35:16]

Clone found (typescript):
 - app\api\community\comments\[id]\vote\route.ts [31:57 - 45:65] (14 lines, 170 tokens)
   app\api\community\posts\[id]\vote\route.ts [31:54 - 45:62]

Clone found (typescript):
 - app\api\admin\reports\[id]\action\route.ts [171:24 - 186:47] (15 lines, 167 tokens)
   app\api\admin\users\[id]\action\route.ts [258:25 - 273:45]

Clone found (typescript):
 - app\api\community\posts\[id]\route.ts [64:28 - 76:62] (12 lines, 142 tokens)
   app\api\community\posts\[id]\vote\route.ts [24:27 - 36:62]

Clone found (typescript):
 - app\api\community\comments\[id]\route.ts [37:28 - 49:65] (12 lines, 142 tokens)
   app\api\community\comments\[id]\vote\route.ts [24:27 - 36:62]

Clone found (typescript):
 - app\api\admin\feedback\route.ts [44:1 - 55:12] (11 lines, 150 tokens)
   app\api\admin\overview\route.ts [9:1 - 20:20]

┌────────────┬────────────────┬─────────────┬──────────────┬──────────────┬──────────────────┬───────────────────┐
│ Format     │ Files analyzed │ Total lines │ Total tokens │ Clones found │ Duplicated lines │ Duplicated tokens │
├────────────┼────────────────┼─────────────┼──────────────┼──────────────┼──────────────────┼───────────────────┤
│ markdown   │ 1              │ 140         │ 674          │ 0            │ 0 (0%)           │ 0 (0%)            │
├────────────┼────────────────┼─────────────┼──────────────┼──────────────┼──────────────────┼───────────────────┤
│ bash       │ 1              │ 34          │ 39           │ 0            │ 0 (0%)           │ 0 (0%)            │
├────────────┼────────────────┼─────────────┼──────────────┼──────────────┼──────────────────┼───────────────────┤
│ toml       │ 1              │ 410         │ 1286         │ 0            │ 0 (0%)           │ 0 (0%)            │
├────────────┼────────────────┼─────────────┼──────────────┼──────────────┼──────────────────┼───────────────────┤
│ javascript │ 98             │ 10713       │ 89738        │ 0            │ 0 (0%)           │ 0 (0%)            │
├────────────┼────────────────┼─────────────┼──────────────┼──────────────┼──────────────────┼───────────────────┤
│ typescript │ 167            │ 22534       │ 185883       │ 14           │ 212 (0.94%)      │ 2224 (1.2%)       │
├────────────┼────────────────┼─────────────┼──────────────┼──────────────┼──────────────────┼───────────────────┤
│ tsx        │ 103            │ 20269       │ 166885       │ 5            │ 92 (0.45%)       │ 793 (0.48%)       │
├────────────┼────────────────┼─────────────┼──────────────┼──────────────┼──────────────────┼───────────────────┤
│ css        │ 11             │ 2305        │ 15064        │ 0            │ 0 (0%)           │ 0 (0%)            │
├────────────┼────────────────┼─────────────┼──────────────┼──────────────┼──────────────────┼───────────────────┤
│ Total:     │ 382            │ 56405       │ 459569       │ 19           │ 304 (0.54%)      │ 3017 (0.66%)      │
└────────────┴────────────────┴─────────────┴──────────────┴──────────────┴──────────────────┴───────────────────┘
Found 19 clones.
time: deterministic
```
