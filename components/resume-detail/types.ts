import type { FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import type { CommentAttachmentOption } from "@/components/CommentMediaToolbar";
import type {
	CommentContentFormat,
	CommunityRole,
	ResumeSummary,
	Review,
	ReviewerType,
	ReviewerVerificationStatus,
} from "@/lib/supabase/types";

export type ResumeDetailProps = {
	resumeId: string;
};

export type Reaction = "like" | "dislike";

export type ResumeOwnerAction = "close" | "reopen" | "delete";

export type AuthorProfile = {
	id: string;
	username: string | null;
	full_name: string | null;
	community_role?: CommunityRole | null;
	reviewer_type?: ReviewerType | null;
	reviewer_headline?: string | null;
	reviewer_expertise?: string[] | null;
	reviewer_verification_status?: ReviewerVerificationStatus | null;
};

export type ThreadReviewControls = {
	attachmentsById: Record<string, CommentAttachmentOption>;
	authorProfiles: Record<string, AuthorProfile>;
	collapsedReviewIds: Set<string>;
	deleteSchemaReady: boolean;
	deletingReviewId: string;
	dislikedReviewIds: Set<string>;
	isClosed: boolean;
	likedReviewIds: Set<string>;
	mediaSchemaReady: boolean;
	onCancelReply: () => void;
	onDeleteReviewRequest: (review: Review) => void;
	onOpenReportDialog: (review: Review) => void;
	onReactToReview: (review: Review, reaction: Reaction) => void;
	onReplyAttachmentChange: (attachment: CommentAttachmentOption | null) => void;
	onReplyContentChange: (value: string) => void;
	onReplyFormatChange: (format: CommentContentFormat) => void;
	onReplySubmit: (
		event: FormEvent<HTMLFormElement>,
		parentReview: Review,
	) => void;
	onReplyToggle: (reviewId: string) => void;
	onRequireLogin: () => void;
	onToggleReplies: (reviewId: string) => void;
	renderIndexById: Map<string, number>;
	replyAttachment: CommentAttachmentOption | null;
	replyContent: string;
	replyContentFormat: CommentContentFormat;
	replyingToId: string | null;
	replySchemaReady: boolean;
	reportSchemaReady: boolean;
	resume: ResumeSummary;
	submittingReplyId: string;
	user: User | null;
};

export type ResumeRowWithDefaults = Omit<
	ResumeSummary,
	"read_count" | "job_description" | "post_description"
> &
	Partial<
		Pick<ResumeSummary, "read_count" | "job_description" | "post_description">
	>;

export type ResumeQueryResult = {
	data: ResumeRowWithDefaults | null;
	error: { message?: string } | null;
};
