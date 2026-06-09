import type { LucideIcon } from "lucide-react";
import type {
	ContentReportStatus,
	ContentReportTargetType,
} from "@/lib/supabase/types";
import type { ReviewerApplicationStatus } from "@/lib/reviewer-validation";

export type AdminDashboardView =
	| "audit"
	| "content"
	| "data"
	| "feedback"
	| "overview"
	| "people"
	| "reports"
	| "reviewers";

export type AdminStats = {
	activeReviewers: number;
	activeRoasters?: number;
	feedbackOpen?: number;
	feedbackTotal?: number;
	openResumes: number;
	pendingReports: number;
	pendingReviewers: number;
	replies: number;
	resumes: number;
	reviews: number;
	roasts?: number;
	users: number;
};

export type AdminResume = {
	id: string;
	title: string;
	status: string;
	roast_count?: number;
	read_count?: number;
	created_at: string;
};

export type AdminReview = {
	id: string;
	resume_id: string;
	content: string;
	is_deleted?: boolean;
	created_at: string;
};

export type AdminCommunityPost = {
	id: string;
	author_id: string;
	body: string;
	created_at: string;
	post_type: string;
	status: string;
	title: string;
};

export type AdminCommunityComment = {
	id: string;
	author_id: string;
	body: string;
	created_at: string;
	parent_id: string | null;
	post_id: string;
	status: string;
};

export type AdminOverview = {
	activity: {
		recentFeedback?: UserFeedbackPreview[];
		recentResumes: AdminResume[];
		recentReviews: AdminReview[];
		recentRoasts?: AdminReview[];
	};
	stats: AdminStats;
};

export type ProfilePreview = {
	id: string;
	username: string | null;
	full_name: string | null;
	avatar_url?: string | null;
	current_position?: string | null;
	community_role?: string | null;
	reviewer_type?: string | null;
	reviewer_headline?: string | null;
	reviewer_verification_status?: string | null;
	roast_count?: number;
	helpful_votes?: number;
};

export type ReportPreview = {
	community_comment_id?: string | null;
	community_post_id?: string | null;
	communityComment?: AdminCommunityComment | null;
	communityPost?: AdminCommunityPost | null;
	id: string;
	details: string;
	reason: string;
	report_count: number;
	reportedUser: ProfilePreview | null;
	reporter: ProfilePreview | null;
	profile: ProfilePreview | null;
	resume: AdminResume | null;
	review?: AdminReview | null;
	roast: AdminReview | null;
	status: ContentReportStatus;
	target_type: ContentReportTargetType;
	updated_at: string;
	last_reported_at?: string;
};

export type ReviewerApplicationPreview = {
	id: string;
	admin_note: string;
	created_at: string;
	expertise: string[];
	note: string;
	profile: ProfilePreview | null;
	proof_url: string;
	requested_type: string;
	reviewed_at: string | null;
	reviewedBy: ProfilePreview | null;
	status: ReviewerApplicationStatus;
	updated_at: string;
	user_id: string;
};

export type AdminUserDataFootprint = {
	attachments: number;
	reportsFiled: number;
	resumes: number;
	reviewerApplications: number;
	reviews: number;
	votes: number;
};

export type AdminUser = {
	id: string;
	email: string | null;
	created_at: string | null;
	last_sign_in_at: string | null;
	profile: ProfilePreview | null;
	dataFootprint?: AdminUserDataFootprint;
};

export type ActiveAdminUser = {
	email: string | null;
	lastSeenAt: string;
	profile: ProfilePreview | null;
	status: string;
	userId: string;
};

export type AdminUsersPagination = {
	from: number;
	hasNextPage: boolean;
	hasPreviousPage: boolean;
	lastPage: number;
	page: number;
	perPage: number;
	to: number;
	total: number;
};

export type AdminUsersResponse = {
	activeUsers: ActiveAdminUser[];
	latestUsers: AdminUser[];
	pagination: AdminUsersPagination;
	query: string;
	users: AdminUser[];
};

export type AdminMessageDialogTarget =
	| {
			mode: "all";
	  }
	| {
			mode: "user";
			user: AdminUser;
	  };

export type AdminMessageForm = {
	body: string;
	customLinkHref: string;
	linkChoice: string;
	requestId: string;
	title: string;
};

export type AdminMessageResponse = {
	auditLogId: string;
	delivered: number;
	failed: number;
	skipped: number;
	status: "ok";
	total: number;
};

export type UserFeedbackPreview = {
	admin_note: string | null;
	admin_reply: string | null;
	assignedAdmin?: ProfilePreview | null;
	assigned_admin_id: string | null;
	body: string;
	category: string;
	created_at: string;
	id: string;
	metadata?: Record<string, string> | null;
	priority: string;
	resolved_at: string | null;
	reviewed_at: string | null;
	reviewedBy?: ProfilePreview | null;
	reviewed_by: string | null;
	source_path: string | null;
	status: string;
	title: string;
	updated_at: string;
	userAgent?: string | null;
	userProfile?: ProfilePreview | null;
	user_agent?: string | null;
	user_id: string | null;
	viewport: string | null;
};

export type AdminFeedbackResponse = {
	feedback: UserFeedbackPreview[];
	statusCounts: Record<string, number>;
};

export type ModerationAction = {
	id: string;
	action: string;
	adminProfile: ProfilePreview | null;
	created_at: string;
	reason: string;
	report_id: string | null;
	target_id: string | null;
	target_type: string;
};

export type DataMetric = {
	detail?: string;
	key: string;
	label: string;
	value: number | string;
};

export type AdminDataInventory = {
	lifecycle: DataMetric[];
	storage: DataMetric[];
	tables: DataMetric[];
};

export type AdminSection = {
	description: string;
	group: "Governance" | "Operations";
	href: string;
	icon: LucideIcon;
	id: AdminDashboardView;
	label: string;
	title: string;
};
