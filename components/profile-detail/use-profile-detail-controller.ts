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
import { ensureActiveUserSession } from "@/lib/session-lock";
import type {
	PublicProfile,
	PublicProfileReview,
	PublicProfileResume,
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
	const [isOnline, setIsOnline] = useState(false);
	const [fullName, setFullName] = useState("");
	const [username, setUsername] = useState("");
	const [tagline, setTagline] = useState("");
	const [currentPosition, setCurrentPosition] = useState("");
	const [college, setCollege] = useState("");
	const [collegeLocation, setCollegeLocation] = useState("");
	const [about, setAbout] = useState("");
	const [skillsInput, setSkillsInput] = useState("");
	const [avatarFile, setAvatarFile] = useState<File | null>(null);
	const [avatarPreview, setAvatarPreview] = useState("");
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [editOpen, setEditOpen] = useState(false);
	const [message, setMessage] = useState("");
	const [saveMessage, setSaveMessage] = useState("");
	const [profileReportOpen, setProfileReportOpen] = useState(false);
	const [profileReportReason, setProfileReportReason] =
		useState<ReportReason>("personal_info");
	const [profileReportDetails, setProfileReportDetails] = useState("");
	const [profileReportSubmitting, setProfileReportSubmitting] = useState(false);
	const [profileReportSchemaReady, setProfileReportSchemaReady] = useState(true);
	const [applyDialogOpen, setApplyDialogOpen] = useState(false);
	const [applySubmitting, setApplySubmitting] = useState(false);
	const [applyMessage, setApplyMessage] = useState("");

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
				isOnline: loadedIsOnline,
				loadedProfile,
				loadedResumes,
				loadedReviews,
			} = await loadProfileDetailData(profileId);
			setUser(activeUser);

			if (errorMessage || !loadedProfile) {
				setMessage(errorMessage);
				setIsOnline(false);
				setLoading(false);
				return;
			}

			setProfile(loadedProfile);
			setIsOnline(loadedIsOnline || activeUser?.id === loadedProfile.id);
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

	async function handleReviewerApply(data: {
		reviewer_type: string;
		headline: string;
		proof_url: string;
		note: string;
	}) {
		setApplyMessage("");
		setApplySubmitting(true);

		try {
			const session = await supabase.auth.getSession();
			const accessToken = session.data.session?.access_token;
			if (!accessToken) {
				throw new Error("Your session expired. Please sign in again.");
			}

			const response = await fetch("/api/reviewer-application", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${accessToken}`,
				},
				body: JSON.stringify(data),
			});

			const result = (await response.json().catch(() => null)) as {
				applied?: boolean;
				message?: string;
			} | null;

			if (!response.ok || !result?.applied) {
				throw new Error(result?.message ?? "Application submission failed.");
			}

			setProfile((current) =>
				current ? { ...current, reviewer_verification_status: "pending" } : current,
			);
			setApplyDialogOpen(false);
			toast.success("Application submitted.", {
				description: "We will review it shortly and update your profile.",
			});
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Application submission failed.";
			setApplyMessage(errorMessage);
			toast.error(errorMessage);
		} finally {
			setApplySubmitting(false);
		}
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
		applyDialogOpen,
		applyMessage,
		applySubmitting,
		avatarPreview,
		college,
		collegeLocation,
		currentPosition,
		editOpen,
		fullName,
		handleAvatarChange,
		handleReviewerApply,
		isOnline,
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
		reviews,
		saveMessage,
		saveProfile,
		saving,
		setAbout,
		setApplyDialogOpen,
		setCollege,
		setCollegeLocation,
		setCurrentPosition,
		setEditOpen,
		setFullName,
		setProfileReportDetails,
		setProfileReportOpen,
		setProfileReportReason,
		setSkillsInput,
		setTagline,
		setUsername,
		skillsInput,
		submitProfileReport,
		tagline,
		username,
	};
}
