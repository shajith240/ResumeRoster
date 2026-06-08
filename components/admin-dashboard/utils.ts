import { adminMessageLinkOptions } from "./constants";
import type {
	AdminDashboardView,
	AdminMessageDialogTarget,
	AdminStats,
	AdminUserDataFootprint,
	ProfilePreview,
	ReportPreview,
} from "./types";

export function formatDate(value: string | null | undefined) {
	if (!value) return "Never";
	return new Intl.DateTimeFormat("en", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}

export function getProfileLabel(profile: ProfilePreview | null) {
	if (!profile) return "Unknown";
	return profile.username || profile.full_name || profile.id.slice(0, 8);
}

export function getProfileSecondary(profile: ProfilePreview | null) {
	if (!profile) return "No public profile row";
	return (
		profile.reviewer_headline ||
		profile.current_position ||
		profile.reviewer_type ||
		profile.community_role ||
		"Profile details not set"
	);
}

export function formatReason(value: string) {
	return value.replaceAll("_", " ");
}

export function formatTargetType(value: string) {
	return value === "roast" ? "review" : formatReason(value);
}

export function getTargetTitle(report: ReportPreview) {
	if (report.target_type === "profile") {
		return `Profile: ${getProfileLabel(report.profile ?? report.reportedUser)}`;
	}

	if (report.target_type === "roast") {
		return report.review?.content || report.roast?.content || "Reported feedback";
	}

	if (report.target_type === "community_post") {
		return report.communityPost?.title || "Reported community post";
	}

	if (report.target_type === "community_comment") {
		return report.communityComment?.body || "Reported community comment";
	}

	return report.resume?.title || "Reported resume";
}

export function getFootprintTotal(footprint?: AdminUserDataFootprint) {
	if (!footprint) return 0;
	return (
		footprint.attachments +
		footprint.reportsFiled +
		footprint.resumes +
		footprint.reviewerApplications +
		footprint.reviews +
		footprint.votes
	);
}

export function getAdminMessageAudienceLabel(target: AdminMessageDialogTarget | null) {
	if (!target) return "";
	if (target.mode === "all") return "All users";

	const profileLabel = getProfileLabel(target.user.profile);
	return target.user.email ? `${profileLabel} (${target.user.email})` : profileLabel;
}

export function getAdminMessageLinkChoice(linkHref: string) {
	const knownOption = adminMessageLinkOptions.find(
		(option) => option.value === linkHref,
	);
	return knownOption ? knownOption.value : "custom";
}

export function createAdminMessageRequestId() {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
		return crypto.randomUUID();
	}

	const bytes = new Uint8Array(16);
	if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
		crypto.getRandomValues(bytes);
	} else {
		for (let index = 0; index < bytes.length; index += 1) {
			bytes[index] = Math.floor(Math.random() * 256);
		}
	}

	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;

	const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
	return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
		.slice(6, 8)
		.join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

export function getSectionBadge(sectionId: AdminDashboardView, stats?: AdminStats) {
	if (sectionId === "reports" && stats?.pendingReports) {
		return stats.pendingReports;
	}
	if (sectionId === "reviewers" && stats?.pendingReviewers) {
		return stats.pendingReviewers;
	}
	if (sectionId === "people" && stats?.users) {
		return stats.users;
	}
	if (sectionId === "content" && stats?.openResumes) {
		return stats.openResumes;
	}
	if (sectionId === "overview") {
		const attention =
			(stats?.pendingReports ?? 0) + (stats?.pendingReviewers ?? 0);
		return attention || null;
	}
	return null;
}

export function formatRelativeAdminTime(value: string | null | undefined) {
	if (!value) return "Never";
	const timestamp = new Date(value).getTime();
	if (Number.isNaN(timestamp)) return "Never";

	const diff = Date.now() - timestamp;
	const minutes = Math.floor(diff / 60_000);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (minutes < 1) return "Just now";
	if (minutes < 60) return `${minutes}m ago`;
	if (hours < 24) return `${hours}h ago`;
	if (days < 7) return `${days}d ago`;

	return formatDate(value);
}

export function formatAdminPresenceStatus(value: string) {
	return value
		.split(/[_\s-]+/)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
		.join(" ");
}
