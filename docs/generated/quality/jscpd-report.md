# jscpd Duplicate-Code Report

This actionable duplicate-code report excludes `supabase/migrations/**` because applied migrations are append-only production history.

Historical migration duplication is still captured in `migration-history-jscpd-report.md` for audit and planned squash decisions.

Command: `npx jscpd app components lib scripts supabase --gitignore --ignore "supabase/migrations/**" --min-lines 8 --min-tokens 80 --reporters console --exitCode 0 --noTips`
Exit code: `0`

```text
Clone found (typescript):
 - lib\__tests__\resume-submit-route.test.ts [133:52 - 155:39] (22 lines, 163 tokens)
   lib\__tests__\resume-submit-route.test.ts [53:23 - 75:27]

Clone found (typescript):
 - lib\__tests__\comment-media-upload-route.test.ts [1:60 - 14:34] (13 lines, 146 tokens)
   lib\__tests__\profile-avatar-route.test.ts [1:62 - 14:39]

Clone found (typescript):
 - lib\__tests__\admin-data-route.test.ts [1:49 - 17:9] (16 lines, 161 tokens)
   lib\__tests__\admin-users-route.test.ts [1:50 - 17:9]

Clone found (typescript):
 - lib\supabase\types.ts [141:38 - 155:15] (14 lines, 155 tokens)
   lib\supabase\types.ts [122:34 - 136:24]

Clone found (tsx):
 - components\leaderboard\StackedList.tsx [568:125 - 583:15] (15 lines, 119 tokens)
   components\leaderboard\StackedList.tsx [541:6 - 556:19]

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
│ javascript │ 84             │ 10072       │ 84805        │ 0            │ 0 (0%)           │ 0 (0%)            │
├────────────┼────────────────┼─────────────┼──────────────┼──────────────┼──────────────────┼───────────────────┤
│ typescript │ 117            │ 15332       │ 126638       │ 5            │ 80 (0.52%)       │ 792 (0.63%)       │
├────────────┼────────────────┼─────────────┼──────────────┼──────────────┼──────────────────┼───────────────────┤
│ tsx        │ 86             │ 17513       │ 145009       │ 3            │ 59 (0.34%)       │ 496 (0.34%)       │
├────────────┼────────────────┼─────────────┼──────────────┼──────────────┼──────────────────┼───────────────────┤
│ css        │ 2              │ 494         │ 3451         │ 0            │ 0 (0%)           │ 0 (0%)            │
├────────────┼────────────────┼─────────────┼──────────────┼──────────────┼──────────────────┼───────────────────┤
│ Total:     │ 292            │ 43967       │ 361846       │ 8            │ 139 (0.32%)      │ 1288 (0.36%)      │
└────────────┴────────────────┴─────────────┴──────────────┴──────────────┴──────────────────┴───────────────────┘
Found 8 clones.
time: deterministic
```
