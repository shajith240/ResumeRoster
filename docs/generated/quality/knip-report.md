# Knip Dead-Code Report

Command: `npx knip --no-exit-code --no-progress --reporter compact`
Exit code: `0`

```text
Unused dependencies (1)
package.json: @hugeicons/core-free-icons, @hugeicons/react
Unused devDependencies (1)
package.json: @testing-library/react
Unused exports (12)
lib/admin.ts: AdminAuthError, createAdminSupabaseClient
lib/app-presence.ts: APP_PRESENCE_ACTIVE_WINDOW_SECONDS
lib/comment-media-validation.ts: COMMENT_IMAGE_MAX_FILE_SIZE_BYTES, REVIEW_CONTENT_MIN_LENGTH, REVIEW_CONTENT_MAX_LENGTH, ROAST_CONTENT_MIN_LENGTH, ROAST_CONTENT_MAX_LENGTH, COMMENT_IMAGE_ALLOWED_MIME_TYPES, COMMENT_CONTENT_FORMATS, isCommentContentFormat, getRoastContentIssue
lib/feed-ranking.ts: mergeRoastCountsFromRows
lib/leaderboard-ranking.ts: roastPoints, sortRoasters, bestRoastMap, enhanceRoaster
lib/onboarding-validation.ts: ONBOARDING_VERSION, getOnboardingGoal, getOnboardingPersona
lib/resume-thread.ts: normalizeRoast, buildThreadRoastTree, buildThreadRoasts
lib/reviewer-validation.ts: REVIEWER_VERIFICATION_STATUSES, REVIEWER_APPLICATION_STATUSES, isReviewerVerificationStatus, getCommunityRoleLabel
lib/server-auth.ts: ServerAuthError
lib/server/push.ts: sendPushForNotification
lib/session-lock.ts: SESSION_SUPERSEDED_MESSAGE, isValidClientSessionId, createClientSessionId, getClientSessionId, releaseActiveUserSession
lib/supabase/client.ts: signInWithGoogle
Unused exported types (6)
lib/admin-messages.ts: AdminMessageTarget
lib/leaderboard-ranking.ts: LeaderboardRoastInput, LeaderboardTopRoast
lib/onboarding-validation.ts: OnboardingStatus
lib/pdf-privacy.ts: PrivacyFindingType
lib/resume-thread.ts: ThreadRoast, ThreadRoastNode
lib/supabase/types.ts: ResumeStatus, ResumePrivacyMode, ContentReportReason, ContentReportInputTargetType, CommentAttachmentKind, CommentAttachmentSource, ReviewerApplicationStatus, OnboardingGoalId, OnboardingPersonaId, OnboardingStatus, Roast, ResumeReview, RoasterLeaderboardEntry, ReviewerApplication, PublicProfileRoast
Duplicate exports (14)
components/ui/sign-up.tsx: SignUp, Component, default
components/ui/stacked-list.tsx: StackedList, default
components/ui/user-dropdown.tsx: UserDropdown, default
lib/comment-media-validation.ts: getReviewContentIssue, getRoastContentIssue
lib/comment-media-validation.ts: REVIEW_CONTENT_MAX_LENGTH, ROAST_CONTENT_MAX_LENGTH
lib/comment-media-validation.ts: REVIEW_CONTENT_MIN_LENGTH, ROAST_CONTENT_MIN_LENGTH
lib/feed-ranking.ts: mergeReviewCountsFromRows, mergeRoastCountsFromRows
lib/leaderboard-ranking.ts: enhanceReviewer, enhanceRoaster
lib/leaderboard-ranking.ts: bestReviewMap, bestRoastMap
lib/leaderboard-ranking.ts: sortReviewers, sortRoasters
lib/leaderboard-ranking.ts: lintPoints, roastPoints
lib/resume-thread.ts: buildThreadReviews, buildThreadRoasts
lib/resume-thread.ts: buildThreadReviewTree, buildThreadRoastTree
lib/resume-thread.ts: normalizeReview, normalizeRoast
```
