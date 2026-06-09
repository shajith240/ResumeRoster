import {
	BadgeCheck,
	Database,
	FileText,
	Flag,
	History,
	Inbox,
	LayoutDashboard,
	UsersRound,
} from "lucide-react";
import type { ContentReportStatus } from "@/lib/supabase/types";
import type { ReviewerApplicationStatus } from "@/lib/reviewer-validation";
import { getAppHomeRoute } from "@/lib/app-routes";
import type { AdminSection } from "./types";

export const adminSections: AdminSection[] = [
	{
		description: "Health, queues, and shortcuts.",
		group: "Operations",
		href: "/admin",
		icon: LayoutDashboard,
		id: "overview",
		label: "Overview",
		title: "Control Room",
	},
	{
		description: "User bug reports, ideas, and product feedback.",
		group: "Operations",
		href: "/admin/feedback",
		icon: Inbox,
		id: "feedback",
		label: "Feedback",
		title: "Feedback Inbox",
	},
	{
		description: "Reports that need moderation decisions.",
		group: "Governance",
		href: "/admin/reports",
		icon: Flag,
		id: "reports",
		label: "Reports",
		title: "Reports",
	},
	{
		description: "Users, profiles, data footprint, and account actions.",
		group: "Operations",
		href: "/admin/people",
		icon: UsersRound,
		id: "people",
		label: "People",
		title: "People",
	},
	{
		description: "Reviewer trust applications and proof checks.",
		group: "Governance",
		href: "/admin/reviewers",
		icon: BadgeCheck,
		id: "reviewers",
		label: "Reviewer Trust",
		title: "Reviewer Trust",
	},
	{
		description: "Newest resumes and feedback activity.",
		group: "Operations",
		href: "/admin/content",
		icon: FileText,
		id: "content",
		label: "Content",
		title: "Content",
	},
	{
		description: "Recent admin actions and moderation history.",
		group: "Governance",
		href: "/admin/audit",
		icon: History,
		id: "audit",
		label: "Audit",
		title: "Audit Trail",
	},
	{
		description: "Table counts, storage surface, and deletion model.",
		group: "Governance",
		href: "/admin/data",
		icon: Database,
		id: "data",
		label: "Data",
		title: "Data Control",
	},
];

export const reportStatuses: ContentReportStatus[] = [
	"pending",
	"reviewing",
	"actioned",
	"dismissed",
];

export const reviewerStatuses: ReviewerApplicationStatus[] = [
	"pending",
	"approved",
	"rejected",
];

export const adminMessageLinkOptions = [
	{ label: "Community", value: getAppHomeRoute() },
	{ label: "Resume Feed", value: "/feed" },
	{ label: "Submit", value: "/submit" },
	{ label: "Leaderboard", value: "/leaderboard" },
	{ label: "My profile", value: "/profile/me" },
	{ label: "Custom path", value: "custom" },
];

export const adminMessageTemplates: Array<{
	body: string;
	id: string;
	label: string;
	linkHref: string;
	title: string;
}> = [
	{
		body: "Upload a resume when you are ready for a fresh lint pass.",
		id: "upload",
		label: "Upload nudge",
		linkHref: "/submit",
		title: "Add your resume",
	},
	{
		body: "A few resumes are waiting for thoughtful feedback from the community.",
		id: "review",
		label: "Review nudge",
		linkHref: "/feed",
		title: "Help review a resume",
	},
	{
		body: "A quick note from the Linted team.",
		id: "general",
		label: "Announcement",
		linkHref: getAppHomeRoute(),
		title: "Linted update",
	},
];
