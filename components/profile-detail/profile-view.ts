import { getAnonymousProfileUsername } from "@/lib/anonymous-profile";
import { getProfileRoleLabel } from "@/lib/reviewer-validation";
import type {
	PublicProfile,
	PublicProfileReview,
	PublicProfileResume,
} from "@/lib/supabase/types";
import { fallbackAvatar } from "./constants";
import { getActivity } from "./data";
import { getInitials } from "./utils";
import { fallbackSkills } from "@/lib/profile-validation";

export function buildProfileView(
	profile: PublicProfile,
	reviews: PublicProfileReview[],
	resumes: PublicProfileResume[],
) {
	const displayName =
		profile.full_name || profile.username || getAnonymousProfileUsername(profile.id);
	const currentRole =
		profile.current_position ||
		profile.target_role ||
		"Community contributor";
	const skills = profile.skills?.length ? profile.skills : fallbackSkills(profile);

	return {
		activity: getActivity(reviews, resumes, profile),
		avatarUrl: profile.avatar_url || fallbackAvatar,
		collegeLabel: profile.college || "College not set",
		collegeLocation: profile.college_location || "College location not set",
		currentRole,
		displayName,
		initials: getInitials(displayName) || "R",
		reviewerStatus: profile.reviewer_verification_status,
		roleTag: getProfileRoleLabel(profile),
		skills,
		tagline:
			profile.tagline ||
			"Building better resumes, one thoughtful lint pass at a time.",
	};
}
