"use client";

import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getAnonymousProfileUsername } from "@/lib/anonymous-profile";
import { supabase } from "@/lib/supabase/client";
import {
	PROFILE_FIELD_LIMITS,
	fallbackSkills,
	limitText,
	normalizeUsername,
	parseSkills,
	usernameTakenMessage,
} from "@/lib/profile-validation";
import { getReportIssue, type ReportReason } from "@/lib/report-validation";
import {
	REVIEWER_FIELD_LIMITS,
	canShowReviewerProfile,
	getProfileRoleLabel,
	getReviewerDisplayLabel,
	getReviewerTypeLabel,
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
	fallbackAvatar,
	PROFILE_CHANGE_EVENT,
	SUPABASE_MIGRATION_MESSAGE,
} from "./constants";
import { getActivity, loadPublicProfileReviews } from "./data";
import {
	cleanFileName,
	getInitials,
	getUsernameAvailability,
	isProfileFeatureError,
	isReportFeatureError,
	isUsernameConstraintError,
	isUuid,
	normalizeProfileToken,
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
			const profileToken = normalizeProfileToken(profileId);

			setLoading(true);
			setMessage("");

			const { data: userData } = await supabase.auth.getUser();
			const activeUser = userData.user;
			setUser(activeUser);

			let resolvedProfileId = profileToken;

			if (profileToken.toLowerCase() === "me") {
				if (!activeUser) {
					setMessage("Sign in to open your profile.");
					setLoading(false);
					return;
				}

				resolvedProfileId = activeUser.id;
			} else if (!isUuid(profileToken)) {
				const { data: matchedProfile, error: matchError } = await supabase
					.from("profiles")
					.select("id")
					.ilike("username", profileToken)
					.maybeSingle();

				if (matchError) {
					setMessage(matchError.message);
					setLoading(false);
					return;
				}

				if (!matchedProfile?.id) {
					setMessage(`We could not find a reviewer profile for @${profileToken}.`);
					setLoading(false);
					return;
				}

				resolvedProfileId = matchedProfile.id;
			}

			if (activeUser?.id === resolvedProfileId) {
				const seedResult = await supabase.from("profiles").insert({
					id: activeUser.id,
					username: getAnonymousProfileUsername(activeUser.id),
				});

				if (
					seedResult.error &&
					seedResult.error.code !== "23505" &&
					isProfileFeatureError(seedResult.error.message)
				) {
					setMessage(SUPABASE_MIGRATION_MESSAGE);
					setLoading(false);
					return;
				}
			}

			const [profileResult, reviewsResult, resumesResult] = await Promise.all([
				supabase.rpc("get_public_profile", { profile_id: resolvedProfileId }),
				loadPublicProfileReviews(resolvedProfileId),
				supabase.rpc("get_public_profile_resumes", {
					profile_id: resolvedProfileId,
					limit_count: 20,
				}),
			]);

			if (profileResult.error) {
				setMessage(
					isProfileFeatureError(profileResult.error.message)
						? SUPABASE_MIGRATION_MESSAGE
						: profileResult.error.message,
				);
				setLoading(false);
				return;
			}

			if (resumesResult.error && isProfileFeatureError(resumesResult.error.message)) {
				setMessage(SUPABASE_MIGRATION_MESSAGE);
				setLoading(false);
				return;
			}

			const loadedProfile = (profileResult.data?.[0] ?? null) as PublicProfile | null;

			if (!loadedProfile) {
				setMessage(
					isUuid(profileToken)
						? "We could not find a profile row for this user yet."
						: `We could not find a reviewer profile for @${profileToken}.`,
				);
				setLoading(false);
				return;
			}

			const loadedReviews = (reviewsResult.data ?? []) as PublicProfileReview[];
			const loadedResumes = (resumesResult.data ?? []) as PublicProfileResume[];

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

		if (!nextFile.type.startsWith("image/")) {
			const errorMessage = "Upload a JPG, PNG, WEBP, or GIF profile image.";
			setSaveMessage(errorMessage);
			toast.error(errorMessage);
			return;
		}

		if (nextFile.size > 5 * 1024 * 1024) {
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

	async function uploadAvatar(activeUser: User) {
		if (!avatarFile) return null;

		const filePath = `${activeUser.id}/${Date.now()}-${cleanFileName(avatarFile.name)}`;
		const upload = await supabase.storage.from("avatars").upload(filePath, avatarFile, {
			contentType: avatarFile.type,
			upsert: false,
		});

		if (upload.error) {
			throw new Error(
				`${upload.error.message}. ${SUPABASE_MIGRATION_MESSAGE}`,
			);
		}

		const publicUrl = supabase.storage.from("avatars").getPublicUrl(filePath)
			.data.publicUrl;

		if (profile?.avatar_path?.startsWith(`${activeUser.id}/`)) {
			void supabase.storage.from("avatars").remove([profile.avatar_path]);
		}

		return { avatar_path: filePath, avatar_url: publicUrl };
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

			const avatarUpdate = await uploadAvatar(user);
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
				if (isUsernameConstraintError(error)) {
					throw new Error("That username is already taken. Try another name.");
				}

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
						avatar_url: avatarUpdate?.avatar_url || profile?.avatar_url || null,
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

		const displayName =
			profile.full_name ||
			profile.username ||
			getAnonymousProfileUsername(profile.id);
		const currentRole =
			profile.current_position ||
			profile.target_role ||
			"Community resume reviewer";
		const skills = profile.skills?.length ? profile.skills : fallbackSkills(profile);
		const reviewerVisible = canShowReviewerProfile(
			profile.community_role,
			profile.reviewer_type,
		);
		return {
			activity: getActivity(reviews, resumes, profile),
			avatarUrl: profile.avatar_url || fallbackAvatar,
			collegeLabel: profile.college || "College not set",
			collegeLocation: profile.college_location || "College location not set",
			currentRole,
			displayName,
			initials: getInitials(displayName) || "R",
			reviewerBio:
				profile.reviewer_bio ||
				"Open to reviewing resumes with practical, role-aware feedback.",
			reviewerHeadline:
				profile.reviewer_headline ||
				`${getReviewerTypeLabel(profile.reviewer_type)} focused on useful resume feedback.`,
			reviewerLabel: getReviewerDisplayLabel(profile),
			reviewerStatus: profile.reviewer_verification_status,
			reviewerVisible,
			roleTag: getProfileRoleLabel(profile),
			skills,
			tagline:
				profile.tagline ||
				"Building better resumes, one thoughtful lint pass at a time.",
		};
	}, [isOwnProfile, profile, resumes, reviews, user]);

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
