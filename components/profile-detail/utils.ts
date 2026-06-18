import {
	buildUsernameCandidates,
	normalizeUsername,
} from "@/lib/profile-validation";
import { supabase } from "@/lib/supabase/client";
import type {
	CommunityRole,
	PublicProfileReview,
	PublicProfileReviewLegacy,
} from "@/lib/supabase/types";
import { SHORT_COMMUNITY_ROLE_LABELS, uuidPattern } from "./constants";

export function getShortCommunityRoleLabel(role: CommunityRole) {
	return SHORT_COMMUNITY_ROLE_LABELS[role];
}

export function isUuid(value: string) {
	return uuidPattern.test(value);
}

export function normalizeProfileToken(value: string) {
	return decodeURIComponent(value).trim().replace(/^@+/, "").replace(/[./]+$/, "");
}

export function cleanFileName(value: string) {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9.]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 80);
}

export function limitLiveText(value: string, limit: number) {
	return value.slice(0, limit);
}

export function isUsernameConstraintError(error: { code?: string; message?: string }) {
	return (
		error.code === "23505" ||
		/profiles_username_key|duplicate key|username/i.test(error.message ?? "")
	);
}

export async function getUsernameAvailability(username: string, profileOwnerId: string) {
	const normalizedUsername = normalizeUsername(username);
	if (!normalizedUsername || normalizedUsername.length < 3) {
		return { taken: false, suggestions: [] };
	}

	const { data: matches, error } = await supabase
		.from("profiles")
		.select("id, username")
		.ilike("username", normalizedUsername)
		.limit(4);

	if (error) {
		throw error;
	}

	const isTakenByAnotherUser = Boolean(
		(matches ?? []).some((profile) => profile.id !== profileOwnerId),
	);

	if (!isTakenByAnotherUser) {
		return { taken: false, suggestions: [] };
	}

	const candidates = buildUsernameCandidates(normalizedUsername);
	const { data: takenCandidates } = await supabase
		.from("profiles")
		.select("username")
		.in("username", candidates);
	const takenNames = new Set(
		(takenCandidates ?? [])
			.map((profile) => normalizeUsername(profile.username ?? ""))
			.filter(Boolean),
	);

	return {
		taken: true,
		suggestions: candidates.filter((candidate) => !takenNames.has(candidate)).slice(0, 3),
	};
}

export function formatDate(value: string) {
	return new Intl.DateTimeFormat("en", {
		month: "short",
		year: "numeric",
	}).format(new Date(value));
}

export function formatActivityDate(value: string) {
	return new Intl.DateTimeFormat("en", {
		month: "short",
		day: "numeric",
	}).format(new Date(value));
}

export function getInitials(name: string) {
	return name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase())
		.join("");
}

export function isProfileFeatureError(message: string) {
	return /avatar_url|tagline|current_position|college_location|about|skills|community_role|reviewer_|reviewer_applications|resume_highlight_id|get_public_profile_reviews|get_public_profile_resumes|schema cache|column|function/i.test(
		message,
	);
}

export function isReportFeatureError(message: string) {
	return /content_reports|report_content|profile_id|schema cache|column|function/i.test(
		message,
	);
}

export function normalizePublicProfileReview(
	row: PublicProfileReviewLegacy | PublicProfileReview,
): PublicProfileReview {
	const review = row as PublicProfileReviewLegacy & Partial<PublicProfileReview>;

	return {
		id: review.id,
		resume_id: review.resume_id,
		resume_title: review.resume_title,
		resume_status: review.resume_status,
		content: review.content,
		lint_points: review.lint_points ?? review.helpful_votes ?? 0,
		created_at: review.created_at,
	};
}
