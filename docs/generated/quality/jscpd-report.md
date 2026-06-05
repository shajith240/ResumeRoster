# jscpd Duplicate-Code Report

This actionable duplicate-code report excludes `supabase/migrations/**` because applied migrations are append-only production history.

Historical migration duplication is still captured in `migration-history-jscpd-report.md` for audit and planned squash decisions.

Command: `npx jscpd app components lib scripts supabase --gitignore --ignore "supabase/migrations/**" --min-lines 8 --min-tokens 80 --reporters console --exitCode 0 --noTips`
Exit code: `0`

```text
Clone found (typescript):
 - lib\__tests__\push-subscriptions-route.test.ts [15:4 - 30:9] (15 lines, 120 tokens)
   lib\__tests__\reviewer-application-route.test.ts [4:62 - 18:6]

Clone found (typescript):
 - lib\__tests__\comment-media-upload-route.test.ts [1:60 - 14:34] (13 lines, 146 tokens)
   lib\__tests__\profile-avatar-route.test.ts [1:62 - 14:39]

Clone found (typescript):
 - lib\__tests__\comment-media-upload-route.test.ts [4:69 - 18:3] (14 lines, 135 tokens)
   lib\__tests__\reviewer-application-route.test.ts [3:62 - 17:6]

Clone found (typescript):
 - lib\__tests__\admin-data-route.test.ts [1:49 - 17:9] (16 lines, 161 tokens)
   lib\__tests__\admin-users-route.test.ts [1:50 - 17:9]

Clone found (typescript):
 - lib\supabase\types.ts [134:38 - 148:15] (14 lines, 155 tokens)
   lib\supabase\types.ts [116:34 - 130:14]

Clone found (tsx):
 - components\leaderboard\StackedList.tsx [562:125 - 577:15] (15 lines, 119 tokens)
   components\leaderboard\StackedList.tsx [535:6 - 550:19]

Clone found (tsx):
 - components\AuthGate.tsx [22:2 - 43:34] (21 lines, 172 tokens)
   components\auth\SignUp.tsx [17:75 - 37:29]

Clone found (tsx):
 - components\AuthGate.tsx [70:47 - 93:6] (23 lines, 205 tokens)
   components\auth\SignUp.tsx [150:63 - 173:8]

Clone found (typescript):
 - app\api\admin\reports\[id]\action\route.ts [143:24 - 158:47] (15 lines, 167 tokens)
   app\api\admin\users\[id]\action\route.ts [228:25 - 243:45]

┌────────────┬────────────────┬─────────────┬──────────────┬──────────────┬──────────────────┬───────────────────┐
│ Format     │ Files analyzed │ Total lines │ Total tokens │ Clones found │ Duplicated lines │ Duplicated tokens │
├────────────┼────────────────┼─────────────┼──────────────┼──────────────┼──────────────────┼───────────────────┤
│ markdown   │ 1              │ 112         │ 618          │ 0            │ 0 (0%)           │ 0 (0%)            │
├────────────┼────────────────┼─────────────┼──────────────┼──────────────┼──────────────────┼───────────────────┤
│ bash       │ 1              │ 34          │ 39           │ 0            │ 0 (0%)           │ 0 (0%)            │
├────────────┼────────────────┼─────────────┼──────────────┼──────────────┼──────────────────┼───────────────────┤
│ toml       │ 1              │ 410         │ 1286         │ 0            │ 0 (0%)           │ 0 (0%)            │
├────────────┼────────────────┼─────────────┼──────────────┼──────────────┼──────────────────┼───────────────────┤
│ javascript │ 83             │ 10204       │ 86015        │ 0            │ 0 (0%)           │ 0 (0%)            │
├────────────┼────────────────┼─────────────┼──────────────┼──────────────┼──────────────────┼───────────────────┤
│ typescript │ 115            │ 15249       │ 126451       │ 6            │ 87 (0.57%)       │ 884 (0.7%)        │
├────────────┼────────────────┼─────────────┼──────────────┼──────────────┼──────────────────┼───────────────────┤
│ tsx        │ 86             │ 17576       │ 145788       │ 3            │ 59 (0.34%)       │ 496 (0.34%)       │
├────────────┼────────────────┼─────────────┼──────────────┼──────────────┼──────────────────┼───────────────────┤
│ css        │ 2              │ 494         │ 3451         │ 0            │ 0 (0%)           │ 0 (0%)            │
├────────────┼────────────────┼─────────────┼──────────────┼──────────────┼──────────────────┼───────────────────┤
│ Total:     │ 289            │ 44079       │ 363648       │ 9            │ 146 (0.33%)      │ 1380 (0.38%)      │
└────────────┴────────────────┴─────────────┴──────────────┴──────────────┴──────────────────┴───────────────────┘
Found 9 clones.
time: deterministic
```
