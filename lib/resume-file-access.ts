import type { ResumeStatus } from "@/lib/supabase/types";

const VISIBLE_RESUME_FILE_STATUSES = new Set<ResumeStatus>([
	"closed",
	"open",
	"roasted",
]);

export function canPreviewResumeFile({
	resumeOwnerId,
	status,
	userId,
}: {
	resumeOwnerId: string;
	status: ResumeStatus | string;
	userId: string;
}) {
	return (
		resumeOwnerId === userId ||
		VISIBLE_RESUME_FILE_STATUSES.has(status as ResumeStatus)
	);
}
