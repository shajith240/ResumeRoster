"use client";

import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
	AVATAR_IMAGE_ALLOWED_MIME_TYPES,
	AVATAR_IMAGE_MAX_FILE_SIZE_BYTES,
	type AvatarImageMimeType,
} from "@/lib/avatar-validation";
import { supabase } from "@/lib/supabase/client";
import {
	PROFILE_FIELD_LIMITS,
	limitText,
	normalizeUsername,
	parseSkills,
	usernameTakenMessage,
} from "@/lib/profile-validation";
import { getReportIssue, type ReportReason } from "@/lib/report-validation";
import {
	REVIEWER_FIELD_LIMITS,
	getReviewerApplicationIssue,
	isCommunityRole,
	isReviewerType,
	limitReviewerText,
} from "@/lib/reviewer-validation";
import { ensureActiveUserSession } from "@/lib/session-lock";
import type {
	CommunityRole,
	PublicProfile,
	PublicProfileReview,
	PublicProfileResume,
	ReviewerType,
} from "@/lib/supabase/types";
import { toast } from "sonner";
import {
	PROFILE_CHANGE_EVENT,
	SUPABASE_MIGRATION_MESSAGE,
} from "./constants";
import {
	cleanupProfileAvatar,
	uploadProfileAvatar,
} from "./avatar-client";
import { loadProfileDetailData } from "./controller-data";
import { buildProfileView } from "./profile-view";
import {
	getUsernameAvailability,
	isProfileFeatureError,
	isReportFeatureError,
	isUsernameConstraintError,
} from "./utils";

export function useProfileDetailController(profileId: string) {
	const [user, setUser] = useState<User | null>(null);
	const [profile, setProfile] = useState<PublicProfile | null>(null);
	const [reviews, setReviews] = useState<PublicProfileReview[]>([]);
	const [resumes, setResumes] = useState<PublicProfileResume[]>([]);
	const [fullName, setFullName] = useState("");
	const [username, setUsername] = useState("");
	const [tagline, setTagline] = useState("");
	const [currentPosition, setCurrentPosition] = useState("");
	const [college, setCollege] = useState("");
	const [collegeLocation, setCollegeLocation] = useState("");
	const [about, setAbout] = useState("");
	const [skillsInput, setSkillsInput] = useState("");
	const [communityRole, setCommunityRole] =
		useState<CommunityRole>("candidate");
	const [reviewerType, setReviewerType] = useState<ReviewerType | "">("");
	const [reviewerHeadline, setReviewerHeadline] = useState("");
	const [reviewerBio, setReviewerBio] = useState("");
	const [reviewerProofUrl, setReviewerProofUrl] = useState("");
	const [reviewerApplicationNote, setReviewerApplicationNote] = useState("");
	const [reviewerApplying, setReviewerApplying] = useState(false);
	const [avatarFile, setAvatarFile] = useState<File | null>(null);
	const [avatarPreview, setAvatarPreview] = useState("");
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [editOpen, setEditOpen] = useState(false);
	const [reviewerEditOpen, setReviewerEditOpen] = useState(false);
	const [message, setMessage] = useState("");
	const [saveMessage, setSaveMessage] = useState("");
	const [profileReportOpen, setProfileReportOpen] = useState(false);
	const [profileReportReason, setProfileReportReason] =
		useState<ReportReason>("personal_info");
	const [profileReportDetails, setProfileReportDetails] = useState("");
	const [profileReportSubmitting, setProfileReportSubmitting] = useState(false);
	const [profileReportSchemaReady, setProfileReportSchemaReady] = useState(true);

	const isOwnProfile = Boolean(user && profile?.id === user.id);

	useEffect(() => {
		return () => {
			if (avatarPreview) {
				URL.revokeObjectURL(avatarPreview);
			}
		};
	}, [avatarPreview]);

	useEffect(() => {
		async function loadProfile() {
			const started = Date.now();

			setLoading(true);
			setMessage("");

			const {
				activeUser,
				errorMessage,
				loadedProfile,
				loadedResumes,
				loadedReviews,
			} = await loadProfileDetailData(profileId);
			setUser(activeUser);

			if (errorMessage || !loadedProfile) {
				setMessage(errorMessage);
				setLoading(false);
				return;
			}

			setProfile(loadedProfile);
			setReviews(loadedReviews);
			setResumes(loadedResumes);
			setFullName(
				limitText(
					loadedProfile.full_name ?? "",
					PROFILE_FIELD_LIMITS.fullName,
				),
			);
			setUsername(
				limitText(loadedProfile.username ?? "", PROFILE_FIELD_LIMITS.username),
			);
			setTagline(
				limitText(loadedProfile.tagline ?? "", PROFILE_FIELD_LIMITS.tagline),
			);
			setCurrentPosition(
				limitText(
					loadedProfile.current_position ?? loadedProfile.target_role ?? "",
					PROFILE_FIELD_LIMITS.currentPosition,
				),
			);
			setCollege(
				limitText(loadedProfile.college ?? "", PROFILE_FIELD_LIMITS.college),
			);
			setCollegeLocation(
				limitText(
					loadedProfile.college_location ?? "",
					PROFILE_FIELD_LIMITS.collegeLocation,
				),
			);
			setAbout(limitText(loadedProfile.about ?? "", PROFILE_FIELD_LIMITS.about));
			setSkillsInput((loadedProfile.skills ?? []).join(", "));
			setCommunityRole(
				isCommunityRole(loadedProfile.community_role)
					? loadedProfile.community_role
					: "candidate",
			);
			setReviewerType(
				loadedProfile.reviewer_type && isReviewerType(loadedProfile.reviewer_type)
					? loadedProfile.reviewer_type
					: "",
			);
			setReviewerHeadline(
				limitReviewerText(
					loadedProfile.reviewer_headline ?? "",
					REVIEWER_FIELD_LIMITS.headline,
				),
			);
			setReviewerBio(
				limitReviewerText(
					loadedProfile.reviewer_bio ?? "",
					REVIEWER_FIELD_LIMITS.bio,
				),
			);
			setReviewerProofUrl("");
			setReviewerApplicationNote("");

			const elapsed = Date.now() - started;
			window.setTimeout(() => setLoading(false), Math.max(0, 300 - elapsed));
		}

		void loadProfile();
	}, [profileId]);

	function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
		const nextFile = event.target.files?.[0] ?? null;
		setSaveMessage("");

		if (!nextFile) {
			setAvatarFile(null);
			setAvatarPreview("");
			return;
		}

		if (
			!AVATAR_IMAGE_ALLOWED_MIME_TYPES.includes(
				nextFile.type.toLowerCase() as AvatarImageMimeType,
			)
		) {
			const errorMessage = "Upload a PNG, JPG, or WebP profile image.";
			setSaveMessage(errorMessage);
			toast.error(errorMessage);
			return;
		}

		if (nextFile.size > AVATAR_IMAGE_MAX_FILE_SIZE_BYTES) {
			const errorMessage = "Profile image must be 5 MB or smaller.";
			setSaveMessage(errorMessage);
			toast.error(errorMessage);
			return;
		}

		if (avatarPreview) {
			URL.revokeObjectURL(avatarPreview);
		}

		setAvatarFile(nextFile);
		setAvatarPreview(URL.createObjectURL(nextFile));
	}

	async function saveProfile(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSaveMessage("");

		if (!user || !isOwnProfile) {
			const errorMessage = "You can only edit your own profile.";
			setSaveMessage(errorMessage);
			toast.error(errorMessage);
			return;
		}

		setSaving(true);

		try {
			const sessionActive = await ensureActiveUserSession(user.id);
			if (!sessionActive) return;

			const nextSkills = parseSkills(skillsInput);
			const nextUsername = limitText(
				normalizeUsername(username),
				PROFILE_FIELD_LIMITS.username,
			).trim();
			const currentUsername = normalizeUsername(profile?.username ?? "");

			if (nextUsername && nextUsername !== currentUsername) {
				const availability = await getUsernameAvailability(nextUsername, user.id);
				if (availability.taken) {
					throw new Error(usernameTakenMessage(availability.suggestions));
				}
			}

			const avatarUpdate = await uploadProfileAvatar(avatarFile, user);
			const previousAvatarPath =
				avatarUpdate && profile?.avatar_path?.startsWith(`${user.id}/`)
					? profile.avatar_path
					: "";
			const nextPosition =
				limitText(currentPosition, PROFILE_FIELD_LIMITS.currentPosition).trim() ||
				null;
			const nextCommunityRole = isCommunityRole(communityRole)
				? communityRole
				: "candidate";
			const nextReviewerType =
				nextCommunityRole === "candidate"
					? null
					: isReviewerType(reviewerType)
						? reviewerType
						: "other";

			const nextProfile = {
				full_name:
					limitText(fullName, PROFILE_FIELD_LIMITS.fullName).trim() || null,
				username: nextUsername || null,
				tagline:
					limitText(tagline, PROFILE_FIELD_LIMITS.tagline).trim() || null,
				current_position: nextPosition,
				college: limitText(college, PROFILE_FIELD_LIMITS.college).trim() || null,
				college_location:
					limitText(collegeLocation, PROFILE_FIELD_LIMITS.collegeLocation).trim() ||
					null,
				about: limitText(about, PROFILE_FIELD_LIMITS.about).trim() || null,
				skills: nextSkills,
				community_role: nextCommunityRole,
				reviewer_bio:
					nextCommunityRole === "candidate"
						? null
						: limitReviewerText(
								reviewerBio,
								REVIEWER_FIELD_LIMITS.bio,
							) || null,
				reviewer_expertise: [],
				reviewer_headline:
					nextCommunityRole === "candidate"
						? null
						: limitReviewerText(
								reviewerHeadline,
								REVIEWER_FIELD_LIMITS.headline,
							) || null,
				reviewer_type: nextReviewerType,
				...(avatarUpdate ?? {}),
			};

			const { error } = await supabase
				.from("profiles")
				.update(nextProfile)
				.eq("id", user.id);

			if (error) {
				if (avatarUpdate) {
					await cleanupProfileAvatar(avatarUpdate.avatar_path).catch(
						() => undefined,
					);
				}

				if (isUsernameConstraintError(error)) {
					throw new Error("That username is already taken. Try another name.");
				}

				throw new Error(
					isProfileFeatureError(error.message)
						? SUPABASE_MIGRATION_MESSAGE
						: error.message,
				);
			}

			if (
				avatarUpdate &&
				previousAvatarPath &&
				previousAvatarPath !== avatarUpdate.avatar_path
			) {
				await cleanupProfileAvatar(previousAvatarPath).catch(() => undefined);
			}

			setProfile((current) =>
				current
					? {
							...current,
							...nextProfile,
							skills: nextSkills,
						}
					: current,
			);
			window.dispatchEvent(
				new CustomEvent(PROFILE_CHANGE_EVENT, {
					detail: {
						id: user.id,
						full_name: nextProfile.full_name,
						username: nextProfile.username,
						avatar_url: avatarUpdate?.avatar_url ?? profile?.avatar_url ?? null,
					},
				}),
			);
			setAvatarFile(null);
			setAvatarPreview("");
			setSaveMessage("Saved");
			setEditOpen(false);
			toast.success("Profile saved.");
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Profile save failed.";
			setSaveMessage(errorMessage);
			toast.error(errorMessage);
		} finally {
			setSaving(false);
		}
	}

	async function saveReviewerProfile(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSaveMessage("");

		if (!user || !isOwnProfile) {
			const errorMessage = "You can only edit your own reviewer profile.";
			setSaveMessage(errorMessage);
			toast.error(errorMessage);
			return;
		}

		setSaving(true);

		try {
			const sessionActive = await ensureActiveUserSession(user.id);
			if (!sessionActive) return;

			const nextCommunityRole = isCommunityRole(communityRole)
				? communityRole
				: "candidate";
			const nextReviewerType =
				nextCommunityRole === "candidate"
					? null
					: isReviewerType(reviewerType)
						? reviewerType
						: "other";
			const nextReviewerProfile = {
				community_role: nextCommunityRole,
				reviewer_bio:
					nextCommunityRole === "candidate"
						? null
						: limitReviewerText(reviewerBio, REVIEWER_FIELD_LIMITS.bio) ||
							null,
				reviewer_expertise: [],
				reviewer_headline:
					nextCommunityRole === "candidate"
						? null
						: limitReviewerText(
								reviewerHeadline,
								REVIEWER_FIELD_LIMITS.headline,
							) || null,
				reviewer_type: nextReviewerType,
			};

			const { error } = await supabase
				.from("profiles")
				.update(nextReviewerProfile)
				.eq("id", user.id);

			if (error) {
				throw new Error(
					isProfileFeatureError(error.message)
						? SUPABASE_MIGRATION_MESSAGE
						: error.message,
				);
			}

			setProfile((current) =>
				current
					? {
							...current,
							...nextReviewerProfile,
							reviewer_expertise: [],
						}
					: current,
			);
			setReviewerEditOpen(false);
			setSaveMessage("Reviewer profile saved");
			toast.success("Reviewer profile saved.");
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Reviewer profile save failed.";
			setSaveMessage(errorMessage);
			toast.error(errorMessage);
		} finally {
			setSaving(false);
		}
	}

	async function applyForTrustedReviewer() {
		setSaveMessage("");

		if (!user || !isOwnProfile) {
			const errorMessage = "Sign in with your own profile to apply.";
			setSaveMessage(errorMessage);
			toast.error(errorMessage);
			return;
		}

		const nextCommunityRole = isCommunityRole(communityRole)
			? communityRole
			: "candidate";
		const nextReviewerType = isReviewerType(reviewerType) ? reviewerType : null;
		const issue = getReviewerApplicationIssue({
			communityRole: nextCommunityRole,
			note: reviewerApplicationNote,
			proofUrl: reviewerProofUrl,
			reviewerType: nextReviewerType,
		});

		if (issue) {
			setSaveMessage(issue);
			toast.error(issue);
			return;
		}

		setReviewerApplying(true);

		try {
			const sessionActive = await ensureActiveUserSession(user.id);
			if (!sessionActive) return;

			const {
				data: { session },
			} = await supabase.auth.getSession();

			if (!session?.access_token) {
				throw new Error("Sign in again before applying.");
			}

			const response = await fetch("/api/reviewer-application", {
				body: JSON.stringify({
					communityRole: nextCommunityRole,
					note: reviewerApplicationNote,
					proofUrl: reviewerProofUrl,
					reviewerBio,
					reviewerExpertise: [],
					reviewerHeadline,
					reviewerType: nextReviewerType,
				}),
				headers: {
					Authorization: `Bearer ${session.access_token}`,
					"Content-Type": "application/json",
				},
				method: "POST",
			});
			const data = await response.json().catch(() => ({}));

			if (!response.ok) {
				throw new Error(
					(data as { message?: string }).message ??
						"Reviewer application failed.",
				);
			}

			setProfile((current) =>
				current
					? {
							...current,
							community_role: nextCommunityRole,
							reviewer_bio: limitReviewerText(
								reviewerBio,
								REVIEWER_FIELD_LIMITS.bio,
							),
							reviewer_expertise: [],
							reviewer_headline: limitReviewerText(
								reviewerHeadline,
								REVIEWER_FIELD_LIMITS.headline,
							),
							reviewer_type: nextReviewerType,
							reviewer_verification_status: "pending",
							reviewer_verified_at: null,
							reviewer_verified_by: null,
						}
					: current,
			);
			setReviewerProofUrl("");
			setReviewerApplicationNote("");
			setSaveMessage("Reviewer application sent");
			toast.success("Reviewer application sent.");
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Reviewer application failed.";
			setSaveMessage(errorMessage);
			toast.error(errorMessage);
		} finally {
			setReviewerApplying(false);
		}
	}

	function openProfileReportDialog() {
		setSaveMessage("");

		if (!profileReportSchemaReady) {
			const errorMessage = `${SUPABASE_MIGRATION_MESSAGE} Profile reports are not ready yet.`;
			setSaveMessage(errorMessage);
			toast.error(errorMessage);
			return;
		}

		if (!user) {
			const errorMessage = "Sign in to report a profile.";
			setSaveMessage(errorMessage);
			toast.error(errorMessage);
			return;
		}

		if (isOwnProfile) {
			const errorMessage = "You cannot report your own profile.";
			setSaveMessage(errorMessage);
			toast.error(errorMessage);
			return;
		}

		setProfileReportReason("personal_info");
		setProfileReportDetails("");
		setProfileReportOpen(true);
	}

	async function submitProfileReport(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSaveMessage("");

		if (!profile || !user) {
			return;
		}

		const issue = getReportIssue({
			reason: profileReportReason,
			details: profileReportDetails,
		});

		if (issue) {
			setSaveMessage(issue);
			toast.error(issue);
			return;
		}

		setProfileReportSubmitting(true);

		const { data, error } = await supabase.rpc("report_content", {
			report_target_type: "profile",
			target_profile_id: profile.id,
			report_reason: profileReportReason,
			report_details: profileReportDetails.trim(),
		});

		setProfileReportSubmitting(false);

		if (error) {
			if (isReportFeatureError(error.message)) {
				setProfileReportSchemaReady(false);
				const errorMessage = `${SUPABASE_MIGRATION_MESSAGE} Profile reports are not ready yet.`;
				setSaveMessage(errorMessage);
				toast.error(errorMessage);
				return;
			}

			setSaveMessage(error.message);
			toast.error(error.message);
			return;
		}

		const reportResult = Array.isArray(data) ? data[0] : null;
		setProfileReportOpen(false);
		setProfileReportDetails("");
		toast.success(
			reportResult?.was_duplicate
				? "Profile report updated in the moderation queue."
				: "Profile report sent for moderation review.",
		);
	}

	const profileView = useMemo(() => {
		if (!profile) return null;

		return buildProfileView(profile, reviews, resumes);
	}, [profile, resumes, reviews]);

	return {
		about,
		applyForTrustedReviewer,
		avatarPreview,
		college,
		collegeLocation,
		communityRole,
		currentPosition,
		editOpen,
		fullName,
		handleAvatarChange,
		isOwnProfile,
		loading,
		message,
		openProfileReportDialog,
		profile,
		profileReportDetails,
		profileReportOpen,
		profileReportReason,
		profileReportSchemaReady,
		profileReportSubmitting,
		profileView,
		reviewerApplicationNote,
		reviewerApplying,
		reviewerBio,
		reviewerEditOpen,
		reviewerHeadline,
		reviewerProofUrl,
		reviewerType,
		reviews,
		saveMessage,
		saveProfile,
		saveReviewerProfile,
		saving,
		setAbout,
		setCollege,
		setCollegeLocation,
		setCommunityRole,
		setCurrentPosition,
		setEditOpen,
		setFullName,
		setProfileReportDetails,
		setProfileReportOpen,
		setProfileReportReason,
		setReviewerApplicationNote,
		setReviewerBio,
		setReviewerEditOpen,
		setReviewerHeadline,
		setReviewerProofUrl,
		setReviewerType,
		setSkillsInput,
		setTagline,
		setUsername,
		skillsInput,
		submitProfileReport,
		tagline,
		username,
	};
}
