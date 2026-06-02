"use client";

import Link from "next/link";
import {
	ChangeEvent,
	FormEvent,
	KeyboardEvent,
	useEffect,
	useMemo,
	useState,
} from "react";
import {
	BadgeCheck,
	BriefcaseBusiness,
	CalendarDays,
	Camera,
	Flag,
	GraduationCap,
	MapPin,
	Pencil,
	Plus,
	Search,
	ShieldCheck,
	Upload,
	X,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import LintPointsFlame from "@/components/LintPointsFlame";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { getAnonymousProfileUsername } from "@/lib/anonymous-profile";
import { supabase } from "@/lib/supabase/client";
import {
	PROFILE_FIELD_LIMITS,
	SKILL_OPTIONS,
	buildUsernameCandidates,
	fallbackSkills,
	limitText,
	normalizeUsername,
	parseSkills,
	usernameTakenMessage,
} from "@/lib/profile-validation";
import {
	REPORT_DETAILS_MAX_LENGTH,
	REPORT_REASON_OPTIONS,
	getReportIssue,
	type ReportReason,
} from "@/lib/report-validation";
import { ONBOARDING_PROFILE_POSITION_OPTIONS } from "@/lib/onboarding-validation";
import {
	COMMUNITY_ROLES,
	REVIEWER_FIELD_LIMITS,
	REVIEWER_TYPES,
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
	PublicProfileReviewLegacy,
	PublicProfileResume,
	ReviewerType,
} from "@/lib/supabase/types";
import { toast } from "sonner";
import styles from "./ProfileDetail.module.css";

type ProfileDetailProps = {
	profileId: string;
};

type ActivityItem = {
	id: string;
	title: string;
	detail: string;
	href?: string;
	timestamp: number;
};

type UsernameAvailability = {
	status: "idle" | "checking" | "available" | "taken";
	message: string;
	suggestions: string[];
};

const fallbackAvatar = "/assets/logo.png";
const VERIFIED_TICK_SRC = "/assets/verified_tick.png";
const PROFILE_CHANGE_EVENT = "linted-profile-change";
const SUPABASE_MIGRATION_MESSAGE =
	"Profile controls are temporarily unavailable. Please refresh and try again.";
const NO_POSITION_VALUE = "__not_set__";
const uuidPattern =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHORT_COMMUNITY_ROLE_LABELS: Record<CommunityRole, string> = {
	both: "Both",
	candidate: "Get feedback",
	reviewer: "Review resumes",
};

function getShortCommunityRoleLabel(role: CommunityRole) {
	return SHORT_COMMUNITY_ROLE_LABELS[role];
}

function isUuid(value: string) {
	return uuidPattern.test(value);
}

function normalizeProfileToken(value: string) {
	return decodeURIComponent(value).trim().replace(/^@+/, "").replace(/[./]+$/, "");
}

function cleanFileName(value: string) {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9.]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 80);
}

function limitLiveText(value: string, limit: number) {
	return value.slice(0, limit);
}

function isUsernameConstraintError(error: { code?: string; message?: string }) {
	return (
		error.code === "23505" ||
		/profiles_username_key|duplicate key|username/i.test(error.message ?? "")
	);
}

async function getUsernameAvailability(username: string, profileOwnerId: string) {
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

function formatDate(value: string) {
	return new Intl.DateTimeFormat("en", {
		month: "short",
		year: "numeric",
	}).format(new Date(value));
}

function formatActivityDate(value: string) {
	return new Intl.DateTimeFormat("en", {
		month: "short",
		day: "numeric",
	}).format(new Date(value));
}

function getInitials(name: string) {
	return name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase())
		.join("");
}

function getActivity(
	reviews: PublicProfileReview[],
	resumes: PublicProfileResume[],
	profile: PublicProfile,
): ActivityItem[] {
	const resumeItems: ActivityItem[] = resumes.slice(0, 5).map((resume) => ({
		id: `resume-${resume.id}`,
		title: `Posted ${resume.title}`,
		detail: formatActivityDate(resume.created_at),
		href: `/resume/${resume.id}`,
		timestamp: new Date(resume.created_at).getTime(),
	}));

	const reviewItems: ActivityItem[] = reviews.slice(0, 5).map((review) => ({
		id: `review-${review.id}`,
		title: `Reviewed ${review.resume_title}`,
		detail: formatActivityDate(review.created_at),
		href: `/resume/${review.resume_id}`,
		timestamp: new Date(review.created_at).getTime(),
	}));

	const activity = [...resumeItems, ...reviewItems]
		.sort((a, b) => b.timestamp - a.timestamp)
		.slice(0, 5);

	if (activity.length) return activity;

	return [
		{
			id: "profile-created",
			title: "Joined Linted",
			detail: `Member since ${formatDate(profile.created_at)}`,
			href: "/feed",
			timestamp: new Date(profile.created_at).getTime(),
		},
		{
			id: "ready-to-review",
			title: "Ready to review resumes",
			detail: "No public activity yet",
			href: "/feed",
			timestamp: new Date(profile.created_at).getTime(),
		},
	];
}

function isProfileFeatureError(message: string) {
	return /avatar_url|tagline|current_position|college_location|about|skills|community_role|reviewer_|reviewer_applications|resume_highlight_id|get_public_profile_reviews|get_public_profile_resumes|schema cache|column|function/i.test(
		message,
	);
}

function isReportFeatureError(message: string) {
	return /content_reports|report_content|profile_id|schema cache|column|function/i.test(
		message,
	);
}

function normalizePublicProfileReview(
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

async function loadPublicProfileReviews(profileId: string) {
	const reviewResult = await supabase.rpc("get_public_profile_reviews", {
		profile_id: profileId,
		limit_count: 20,
	});

	if (!reviewResult.error) {
		return {
			data: ((reviewResult.data ?? []) as PublicProfileReview[]).map(
				normalizePublicProfileReview,
			),
			error: null,
		};
	}

	if (!/get_public_profile_reviews|schema cache|function/i.test(reviewResult.error.message)) {
		return { data: [] as PublicProfileReview[], error: reviewResult.error };
	}

	const legacyResult = await supabase.rpc("get_public_profile_roasts", {
		profile_id: profileId,
		limit_count: 20,
	});

	return {
		data: ((legacyResult.data ?? []) as PublicProfileReviewLegacy[]).map(
			normalizePublicProfileReview,
		),
		error: legacyResult.error,
	};
}

export default function ProfileDetail({ profileId }: ProfileDetailProps) {
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

	if (loading) {
		return (
			<section className={styles.shell}>
				<div className={`${styles.canvas} ${styles.loadingBoard}`}>
					<div className={styles.loadingHero}>
						<span />
						<span />
						<span />
					</div>
					<div className={styles.loadingGrid}>
						<span />
						<span />
						<span />
					</div>
				</div>
			</section>
		);
	}

	if (message) {
		return (
			<section className={styles.shell}>
				<div className={styles.emptyState}>
					<h1>Profile unavailable</h1>
					<p>{message}</p>
					<Link className="btn-primary" href="/leaderboard">
						View leaderboard
					</Link>
				</div>
			</section>
		);
	}

	if (!profile || !profileView) {
		return (
			<section className={styles.shell}>
				<div className={styles.emptyState}>
					<h1>Profile not found</h1>
					<p>This reviewer does not have public reputation yet.</p>
					<Link className="btn-primary" href="/leaderboard">
						View leaderboard
					</Link>
				</div>
			</section>
		);
	}

	return (
		<section className={`${styles.shell} page-enter`}>
			<div className={styles.canvas}>
				<header className={styles.hero}>
					<div className={styles.avatarFrame}>
						<img
							src={profileView.avatarUrl}
							alt={`${profileView.displayName} profile photo`}
							width={180}
							height={180}
						/>
						{isOwnProfile ? (
							<button
								className={styles.avatarEdit}
								onClick={() => setEditOpen(true)}
								type="button"
							>
								<Pencil aria-hidden="true" />
								<span className="sr-only">Edit profile</span>
							</button>
						) : null}
					</div>

					<div className={styles.identity}>
						<div className={styles.identityHeader}>
							<h1>{profileView.displayName}</h1>
							{profileView.reviewerStatus === "verified" ? (
								<span
									className={styles.verifiedNameBadge}
									title="Trusted reviewer verified by Linted"
									aria-label="Trusted reviewer verified by Linted"
								>
									<img src={VERIFIED_TICK_SRC} alt="" aria-hidden="true" />
								</span>
							) : null}
						</div>
						<div className={styles.profileSignals}>
							<div className={styles.roleTag}>{profileView.roleTag}</div>
							<div
								className={styles.lintPointsBadge}
								aria-label={`${profile.helpful_votes.toLocaleString()} lint points`}
							>
								<LintPointsFlame className={styles.lintPointsFlame} />
								<strong>{profile.helpful_votes.toLocaleString()}</strong>
								<span>Lint Points</span>
							</div>
						</div>
						<p>{profileView.tagline}</p>
						<div className={styles.profileDetailsRow}>
							<div className={styles.metaList}>
								<span>
									<BriefcaseBusiness aria-hidden="true" />
									{profileView.currentRole}
								</span>
								<span>
									<GraduationCap aria-hidden="true" />
									{profileView.collegeLabel}
								</span>
								<span>
									<MapPin aria-hidden="true" />
									{profileView.collegeLocation}
								</span>
								<span>
									<CalendarDays aria-hidden="true" />
									Member since {formatDate(profile.created_at)}
								</span>
							</div>

							{isOwnProfile ? (
								<Dialog open={editOpen} onOpenChange={setEditOpen}>
									<DialogTrigger asChild>
										<Button className={styles.editButton} type="button">
											<Pencil aria-hidden="true" />
											Edit Profile
										</Button>
									</DialogTrigger>
									<ProfileEditDialog
										about={about}
										avatarPreview={avatarPreview || profileView.avatarUrl}
										college={college}
										collegeLocation={collegeLocation}
										currentPosition={currentPosition}
										displayName={profileView.displayName}
										fullName={fullName}
										handleAvatarChange={handleAvatarChange}
										initials={profileView.initials}
										onAboutChange={setAbout}
										onCollegeChange={setCollege}
										onCollegeLocationChange={setCollegeLocation}
										onCurrentPositionChange={setCurrentPosition}
										onFullNameChange={setFullName}
										profileOwnerId={profile.id}
										onSave={saveProfile}
										onSkillsChange={setSkillsInput}
										onTaglineChange={setTagline}
										onUsernameChange={setUsername}
										originalUsername={profile.username ?? ""}
										saveMessage={saveMessage}
										saving={saving}
										skillsInput={skillsInput}
										tagline={tagline}
										username={username}
									/>
								</Dialog>
							) : null}
							{!isOwnProfile ? (
								<Button
									className={styles.reportProfileButton}
									disabled={!profileReportSchemaReady}
									onClick={openProfileReportDialog}
									title={
										profileReportSchemaReady
											? undefined
											: `${SUPABASE_MIGRATION_MESSAGE} Profile reports are not ready yet.`
									}
									type="button"
									variant="outline"
								>
									<Flag aria-hidden="true" />
									Report Profile
								</Button>
							) : null}
						</div>
					</div>
				</header>

				<div className={styles.profileGrid}>
					{profileView.reviewerVisible ? (
						<section className={styles.reviewerPanel}>
							<div className={styles.panelHeader}>
								<div>
									<h2>Reviewer Profile</h2>
									<p>{profileView.reviewerHeadline}</p>
								</div>
								<div className={styles.reviewerPanelActions}>
									<span
										className={
											profileView.reviewerStatus === "verified"
												? styles.trustedReviewerBadge
												: styles.selfDeclaredBadge
										}
									>
										{profileView.reviewerStatus !== "verified" ? (
											<ShieldCheck aria-hidden="true" />
										) : null}
										<span>{profileView.reviewerLabel}</span>
									</span>
									{isOwnProfile ? (
										<ReviewerProfileDialog
											buttonLabel="Edit reviewer profile"
											communityRole={communityRole}
											onCommunityRoleChange={setCommunityRole}
											onOpenChange={setReviewerEditOpen}
											onReviewerBioChange={setReviewerBio}
											onReviewerHeadlineChange={setReviewerHeadline}
											onReviewerTypeChange={setReviewerType}
											onSave={saveReviewerProfile}
											open={reviewerEditOpen}
											reviewerBio={reviewerBio}
											reviewerHeadline={reviewerHeadline}
											reviewerType={reviewerType}
											saving={saving}
										/>
									) : null}
									{isOwnProfile && profileView.reviewerStatus !== "verified" ? (
										<TrustApplicationDialog
											onApply={applyForTrustedReviewer}
											onNoteChange={setReviewerApplicationNote}
											onProofUrlChange={setReviewerProofUrl}
											proofUrl={reviewerProofUrl}
											applicationNote={reviewerApplicationNote}
											applying={reviewerApplying}
											reviewerVerificationStatus={
												profile.reviewer_verification_status
											}
										/>
									) : null}
								</div>
							</div>
							<p>{profileView.reviewerBio}</p>
						</section>
					) : null}

					{!profileView.reviewerVisible && isOwnProfile ? (
						<section className={styles.reviewerPanel}>
							<div className={styles.panelHeader}>
								<div>
									<h2>Reviewer Profile</h2>
									<p>
										Add reviewer identity when you want to review resumes as a
										recruiter, hiring manager, engineer, coach, or other reviewer.
									</p>
								</div>
								<div className={styles.reviewerPanelActions}>
									<span className={styles.selfDeclaredBadge}>
										<ShieldCheck aria-hidden="true" />
										Not set
									</span>
									<ReviewerProfileDialog
										buttonLabel="Set reviewer profile"
										communityRole={communityRole}
										onCommunityRoleChange={setCommunityRole}
										onOpenChange={setReviewerEditOpen}
										onReviewerBioChange={setReviewerBio}
										onReviewerHeadlineChange={setReviewerHeadline}
										onReviewerTypeChange={setReviewerType}
										onSave={saveReviewerProfile}
										open={reviewerEditOpen}
										reviewerBio={reviewerBio}
										reviewerHeadline={reviewerHeadline}
										reviewerType={reviewerType}
										saving={saving}
									/>
								</div>
							</div>
							<p>
								This only changes how your profile introduces you. Review access
								remains open to every signed-in user.
							</p>
						</section>
					) : null}

					<section className={styles.aboutPanel}>
						<h2>About Me</h2>
						<p>
							{profile.about ||
								"Resume reviewer focused on practical feedback, sharper proof, and cleaner first impressions."}
						</p>
					</section>

					<section className={styles.skillsPanel}>
						<h2>Top Skills</h2>
						<div className={styles.skillCloud}>
							{profileView.skills.map((skill) => (
								<span key={skill}>{skill}</span>
							))}
						</div>
					</section>
				</div>

				<div className={styles.activityGrid}>
					<section className={styles.activityPanel}>
						<div className={styles.panelHeader}>
							<h2>Recent Activity</h2>
							<Link href="/feed">View all</Link>
						</div>
						<div className={styles.activityList}>
							{profileView.activity.map((item) => (
								<ActivityRow item={item} key={item.id} />
							))}
						</div>
					</section>

					<section className={styles.reviewsPanel}>
						<div className={styles.panelHeader}>
							<h2>Recent Reviews</h2>
							<Link href="/feed">View all</Link>
						</div>
						{reviews.length ? (
							<div className={styles.reviewList}>
								{reviews.slice(0, 4).map((review) => (
									<ReviewRow review={review} key={review.id} />
								))}
							</div>
						) : (
							<p className={styles.mutedCopy}>
								No public reviews yet. Helpful feedback will show up here.
							</p>
						)}
					</section>
				</div>
			</div>
			<Dialog
				open={profileReportOpen}
				onOpenChange={(open) => {
					if (!open && !profileReportSubmitting) {
						setProfileReportOpen(false);
						setProfileReportDetails("");
					}
				}}
			>
				<DialogContent className="report-dialog-content">
					<DialogHeader>
						<DialogTitle>Report profile</DialogTitle>
						<DialogDescription>
							Send this profile to the moderation queue. Reports are private and
							help keep reviewer identities trustworthy.
						</DialogDescription>
					</DialogHeader>
					<form className="report-form" onSubmit={submitProfileReport}>
						<div className="report-target-preview">
							<span>{profileView.displayName}</span>
							<p>{profileView.tagline}</p>
						</div>
						<div className="report-reason-grid" aria-label="Report reason">
							{REPORT_REASON_OPTIONS.map((option) => (
								<button
									aria-pressed={profileReportReason === option.value}
									className={
										profileReportReason === option.value ? "is-selected" : ""
									}
									key={option.value}
									onClick={() => setProfileReportReason(option.value)}
									type="button"
								>
									<span>{option.label}</span>
									<small>{option.description}</small>
								</button>
							))}
						</div>
						<label className="report-details-field">
							<span>Context for moderators</span>
							<textarea
								maxLength={REPORT_DETAILS_MAX_LENGTH}
								onChange={(event) => setProfileReportDetails(event.target.value)}
								placeholder="Optional, unless you choose Other."
								rows={4}
								value={profileReportDetails}
							/>
						</label>
						<div className="report-form-meta">
							<span>
								{REPORT_DETAILS_MAX_LENGTH - profileReportDetails.length} characters
								left
							</span>
						</div>
						<DialogFooter>
							<Button
								disabled={profileReportSubmitting}
								onClick={() => {
									setProfileReportOpen(false);
									setProfileReportDetails("");
								}}
								type="button"
								variant="outline"
							>
								Cancel
							</Button>
							<Button
								className="btn-brand"
								disabled={profileReportSubmitting}
								type="submit"
							>
								{profileReportSubmitting ? "Sending..." : "Send report"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</section>
	);
}

function ActivityRow({ item }: { item: ActivityItem }) {
	const content = (
		<>
			<div>
				<strong>{item.title}</strong>
				<span>{item.detail}</span>
			</div>
		</>
	);

	if (item.href) {
		return (
			<Link className={styles.activityRow} href={item.href}>
				{content}
			</Link>
		);
	}

	return <div className={styles.activityRow}>{content}</div>;
}

function ReviewRow({ review }: { review: PublicProfileReview }) {
	return (
		<Link className={styles.reviewRow} href={`/resume/${review.resume_id}`}>
			<div>
				<p>"{review.content}"</p>
				<span>
					{review.resume_title} - {formatActivityDate(review.created_at)}
				</span>
			</div>
		</Link>
	);
}

function ReviewerProfileDialog({
	buttonLabel,
	communityRole,
	onCommunityRoleChange,
	onOpenChange,
	onReviewerBioChange,
	onReviewerHeadlineChange,
	onReviewerTypeChange,
	onSave,
	open,
	reviewerBio,
	reviewerHeadline,
	reviewerType,
	saving,
}: {
	buttonLabel: string;
	communityRole: CommunityRole;
	onCommunityRoleChange: (value: CommunityRole) => void;
	onOpenChange: (value: boolean) => void;
	onReviewerBioChange: (value: string) => void;
	onReviewerHeadlineChange: (value: string) => void;
	onReviewerTypeChange: (value: ReviewerType | "") => void;
	onSave: (event: FormEvent<HTMLFormElement>) => void;
	open: boolean;
	reviewerBio: string;
	reviewerHeadline: string;
	reviewerType: ReviewerType | "";
	saving: boolean;
}) {
	const reviewerModeEnabled = communityRole !== "candidate";

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogTrigger asChild>
				<Button
					className={`${styles.trustApplyButton} ${styles.reviewerEditButton}`}
					type="button"
					variant="outline"
				>
					<Pencil aria-hidden="true" />
					{buttonLabel}
				</Button>
			</DialogTrigger>
			<DialogContent className={styles.reviewerDialog}>
				<DialogHeader>
					<DialogTitle>Reviewer profile</DialogTitle>
					<DialogDescription>
						Choose how you want to appear when people read your reviews. This
						does not restrict who can review resumes.
					</DialogDescription>
				</DialogHeader>

				<form className={styles.reviewerDialogForm} onSubmit={onSave}>
					<section className={styles.reviewerEditBlock}>
						<div>
							<Label>I&apos;m here to</Label>
							<div className={styles.segmentedControl}>
								{COMMUNITY_ROLES.map((role) => (
									<button
										aria-pressed={communityRole === role}
										key={role}
										onClick={() => {
											onCommunityRoleChange(role);
											if (role !== "candidate" && !reviewerType) {
												onReviewerTypeChange("other");
											}
										}}
										type="button"
									>
										{getShortCommunityRoleLabel(role)}
									</button>
								))}
							</div>
						</div>

						{reviewerModeEnabled ? (
							<>
								<div>
									<FieldHeader htmlFor="reviewer-dialog-type">
										Reviewer role
									</FieldHeader>
									<Select
										onValueChange={(value) =>
											onReviewerTypeChange(isReviewerType(value) ? value : "")
										}
										value={reviewerType || "other"}
									>
										<SelectTrigger
											className={styles.highlightSelectTrigger}
											id="reviewer-dialog-type"
										>
											<SelectValue placeholder="Choose reviewer role" />
										</SelectTrigger>
										<SelectContent className={styles.highlightSelectContent}>
											<SelectGroup>
												{REVIEWER_TYPES.map((type) => (
													<SelectItem
														className={styles.highlightSelectItem}
														key={type}
														value={type}
													>
														{getReviewerTypeLabel(type)}
													</SelectItem>
												))}
											</SelectGroup>
										</SelectContent>
									</Select>
								</div>

								<div>
									<FieldHeader
										htmlFor="reviewer-dialog-headline"
										max={REVIEWER_FIELD_LIMITS.headline}
										value={reviewerHeadline}
									>
										Reviewer headline
									</FieldHeader>
									<Input
										id="reviewer-dialog-headline"
										maxLength={REVIEWER_FIELD_LIMITS.headline}
										onChange={(event) =>
											onReviewerHeadlineChange(
												limitLiveText(
													event.target.value,
													REVIEWER_FIELD_LIMITS.headline,
												),
											)
										}
										placeholder="Recruiter screen feedback for early-career engineers"
										value={reviewerHeadline}
									/>
								</div>

								<div>
									<FieldHeader
										htmlFor="reviewer-dialog-bio"
										max={REVIEWER_FIELD_LIMITS.bio}
										value={reviewerBio}
									>
										Reviewer bio
									</FieldHeader>
									<textarea
										className={`${styles.editTextarea} ${styles.aboutTextarea}`}
										id="reviewer-dialog-bio"
										maxLength={REVIEWER_FIELD_LIMITS.bio}
										onChange={(event) =>
											onReviewerBioChange(
												limitLiveText(
													event.target.value,
													REVIEWER_FIELD_LIMITS.bio,
												),
											)
										}
										placeholder="Mention what resumes you can review well and how you give feedback."
										value={reviewerBio}
									/>
								</div>
							</>
						) : null}
					</section>

					<DialogFooter>
						<DialogClose asChild>
							<Button type="button" variant="outline">
								Cancel
							</Button>
						</DialogClose>
						<Button disabled={saving} type="submit">
							<Upload data-icon="inline-start" aria-hidden="true" />
							{saving ? "Saving..." : "Save reviewer profile"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

function TrustApplicationDialog({
	applicationNote,
	applying,
	onApply,
	onNoteChange,
	onProofUrlChange,
	proofUrl,
	reviewerVerificationStatus,
}: {
	applicationNote: string;
	applying: boolean;
	onApply: () => void;
	onNoteChange: (value: string) => void;
	onProofUrlChange: (value: string) => void;
	proofUrl: string;
	reviewerVerificationStatus: PublicProfile["reviewer_verification_status"];
}) {
	const buttonLabel =
		reviewerVerificationStatus === "pending"
			? "Update application"
			: reviewerVerificationStatus === "rejected"
				? "Reapply for trust"
				: "Apply for trust";
	const statusCopy =
		reviewerVerificationStatus === "pending"
			? "Your application is waiting for admin review. You can update the proof if something changed."
			: reviewerVerificationStatus === "rejected"
				? "Your last request was not approved. Add clearer proof before reapplying."
				: "Submit one public proof link so an admin can approve the trusted reviewer label.";

	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button
					className={`${styles.trustApplyButton} ${styles.trustApplicationButton}`}
					type="button"
					variant="outline"
				>
					<BadgeCheck aria-hidden="true" />
					{buttonLabel}
				</Button>
			</DialogTrigger>
			<DialogContent className={styles.trustDialog}>
				<DialogHeader>
					<DialogTitle>Trusted reviewer application</DialogTitle>
					<DialogDescription>
						Verification is separate from profile editing. Your profile stays
						self-declared until an admin approves the proof.
					</DialogDescription>
				</DialogHeader>

				<div className={styles.trustDialogBody}>
					<div className={styles.trustStatusCard}>
						<BadgeCheck aria-hidden="true" />
						<div>
							<strong>Gold tick after approval</strong>
							<span>{statusCopy}</span>
						</div>
					</div>

					<div className={styles.trustField}>
						<Label htmlFor="trust-proof-url">Public proof link</Label>
						<Input
							id="trust-proof-url"
							maxLength={REVIEWER_FIELD_LIMITS.proofUrl}
							onChange={(event) => onProofUrlChange(event.target.value)}
							placeholder="LinkedIn, portfolio, GitHub, or work profile"
							value={proofUrl}
						/>
					</div>

					<div className={styles.trustField}>
						<div className={styles.fieldLabelRow}>
							<Label htmlFor="trust-application-note">Review note</Label>
							<span className={styles.fieldLimit}>
								{applicationNote.length}/
								{REVIEWER_FIELD_LIMITS.applicationNote}
							</span>
						</div>
						<textarea
							className={styles.editTextarea}
							id="trust-application-note"
							maxLength={REVIEWER_FIELD_LIMITS.applicationNote}
							onChange={(event) =>
								onNoteChange(
									limitLiveText(
										event.target.value,
										REVIEWER_FIELD_LIMITS.applicationNote,
									),
								)
							}
							placeholder="Briefly explain what proof this link shows."
							value={applicationNote}
						/>
					</div>
				</div>

				<DialogFooter>
					<DialogClose asChild>
						<Button type="button" variant="outline">
							Cancel
						</Button>
					</DialogClose>
					<Button disabled={applying} onClick={onApply} type="button">
						<Upload data-icon="inline-start" aria-hidden="true" />
						{applying ? "Sending..." : buttonLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function FieldHeader({
	children,
	htmlFor,
	max,
	value,
}: {
	children: string;
	htmlFor: string;
	max?: number;
	value?: string;
}) {
	return (
		<div className={styles.fieldLabelRow}>
			<Label htmlFor={htmlFor}>{children}</Label>
			{max ? (
				<span className={styles.fieldLimit}>
					{(value ?? "").length}/{max}
				</span>
			) : null}
		</div>
	);
}

function ProfileEditDialog({
	about,
	avatarPreview,
	college,
	collegeLocation,
	currentPosition,
	displayName,
	fullName,
	handleAvatarChange,
	initials,
	onAboutChange,
	onCollegeChange,
	onCollegeLocationChange,
	onCurrentPositionChange,
	onFullNameChange,
	profileOwnerId,
	onSave,
	onSkillsChange,
	onTaglineChange,
	onUsernameChange,
	originalUsername,
	saveMessage,
	saving,
	skillsInput,
	tagline,
	username,
}: {
	about: string;
	avatarPreview: string;
	college: string;
	collegeLocation: string;
	currentPosition: string;
	displayName: string;
	fullName: string;
	handleAvatarChange: (event: ChangeEvent<HTMLInputElement>) => void;
	initials: string;
	onAboutChange: (value: string) => void;
	onCollegeChange: (value: string) => void;
	onCollegeLocationChange: (value: string) => void;
	onCurrentPositionChange: (value: string) => void;
	onFullNameChange: (value: string) => void;
	profileOwnerId: string;
	onSave: (event: FormEvent<HTMLFormElement>) => void;
	onSkillsChange: (value: string) => void;
	onTaglineChange: (value: string) => void;
	onUsernameChange: (value: string) => void;
	originalUsername: string;
	saveMessage: string;
	saving: boolean;
	skillsInput: string;
	tagline: string;
	username: string;
}) {
	const [skillQuery, setSkillQuery] = useState("");
	const [usernameAvailability, setUsernameAvailability] =
		useState<UsernameAvailability>({
			status: "idle",
			message: "",
			suggestions: [],
		});
	const selectedSkills = useMemo(() => parseSkills(skillsInput), [skillsInput]);
	const normalizedUsername = normalizeUsername(username);
	const normalizedOriginalUsername = normalizeUsername(originalUsername);
	const usernameChanged =
		Boolean(normalizedUsername) && normalizedUsername !== normalizedOriginalUsername;
	const positionOptions = useMemo(() => {
		const normalizedCurrentPosition = currentPosition.trim();
		if (
			normalizedCurrentPosition &&
			!(ONBOARDING_PROFILE_POSITION_OPTIONS as readonly string[]).includes(
				normalizedCurrentPosition,
			)
		) {
			return [normalizedCurrentPosition, ...ONBOARDING_PROFILE_POSITION_OPTIONS];
		}

		return ONBOARDING_PROFILE_POSITION_OPTIONS;
	}, [currentPosition]);
	const normalizedSkillQuery = skillQuery.trim().replace(/\s+/g, " ");
	const selectedSkillKeys = useMemo(
		() => new Set(selectedSkills.map((skill) => skill.toLowerCase())),
		[selectedSkills],
	);
	const skillSuggestions = useMemo(() => {
		const query = normalizedSkillQuery.toLowerCase();

		return SKILL_OPTIONS.filter((skill) => {
			const key = skill.toLowerCase();
			return !selectedSkillKeys.has(key) && (!query || key.includes(query));
		}).slice(0, 8);
	}, [normalizedSkillQuery, selectedSkillKeys]);
	const canAddCustomSkill =
		selectedSkills.length < PROFILE_FIELD_LIMITS.skills &&
		normalizedSkillQuery.length >= 2 &&
		normalizedSkillQuery.length <= PROFILE_FIELD_LIMITS.skill &&
		!selectedSkillKeys.has(normalizedSkillQuery.toLowerCase()) &&
		!SKILL_OPTIONS.some(
			(skill) => skill.toLowerCase() === normalizedSkillQuery.toLowerCase(),
		);

	useEffect(() => {
		let active = true;
		const nextUsername = normalizedUsername;

		if (!nextUsername) {
			setUsernameAvailability({
				status: "idle",
				message: "Use letters, numbers, underscores, or hyphens.",
				suggestions: [],
			});
			return;
		}

		if (nextUsername.length < 3) {
			setUsernameAvailability({
				status: "idle",
				message: "Use at least 3 characters.",
				suggestions: [],
			});
			return;
		}

		if (!usernameChanged) {
			setUsernameAvailability({ status: "idle", message: "", suggestions: [] });
			return;
		}

		setUsernameAvailability({
			status: "checking",
			message: "Checking username...",
			suggestions: [],
		});

		const timeout = window.setTimeout(() => {
			void getUsernameAvailability(nextUsername, profileOwnerId)
				.then((availability) => {
					if (!active) return;
					setUsernameAvailability(
						availability.taken
							? {
									status: "taken",
									message: "That username is taken. Try another name.",
									suggestions: availability.suggestions,
								}
							: {
									status: "available",
									message: "Username is available.",
									suggestions: [],
								},
					);
				})
				.catch(() => {
					if (!active) return;
					setUsernameAvailability({
						status: "idle",
						message: "",
						suggestions: [],
					});
				});
		}, 300);

		return () => {
			active = false;
			window.clearTimeout(timeout);
		};
	}, [normalizedUsername, profileOwnerId, usernameChanged]);

	function commitSkills(nextSkills: string[]) {
		onSkillsChange(nextSkills.join(", "));
	}

	function addSkill(skill: string) {
		const cleanedSkill = skill.trim().replace(/\s+/g, " ");
		if (
			cleanedSkill.length < 2 ||
			cleanedSkill.length > PROFILE_FIELD_LIMITS.skill ||
			selectedSkillKeys.has(cleanedSkill.toLowerCase()) ||
			selectedSkills.length >= PROFILE_FIELD_LIMITS.skills
		) {
			return;
		}

		commitSkills([...selectedSkills, cleanedSkill]);
		setSkillQuery("");
	}

	function removeSkill(skill: string) {
		commitSkills(
			selectedSkills.filter(
				(selectedSkill) => selectedSkill.toLowerCase() !== skill.toLowerCase(),
			),
		);
	}

	function handleSkillKeyDown(event: KeyboardEvent<HTMLInputElement>) {
		if (event.key === "Enter") {
			event.preventDefault();
			addSkill(skillSuggestions[0] ?? normalizedSkillQuery);
			return;
		}

		if (event.key === "Backspace" && !skillQuery && selectedSkills.length) {
			commitSkills(selectedSkills.slice(0, -1));
		}
	}

	const usernameBlocksSave =
		usernameAvailability.status === "checking" ||
		usernameAvailability.status === "taken";
	const usernameAssistClass = [
		styles.usernameAssist,
		usernameAvailability.status === "taken" ? styles.usernameAssistError : "",
		usernameAvailability.status === "available" ? styles.usernameAssistSuccess : "",
	]
		.filter(Boolean)
		.join(" ");

	return (
		<DialogContent className={styles.editDialog}>
			<DialogHeader className={styles.editHeader}>
				<DialogTitle className={styles.editTitle}>Edit profile</DialogTitle>
				<DialogDescription className={styles.editDescription}>
					Update the public details shown on your Linted profile.
				</DialogDescription>
			</DialogHeader>
			<form className={styles.editForm} onSubmit={onSave}>
				<div className={styles.editPreview}>
					<div className={styles.editAvatar}>
						{avatarPreview ? (
							<img src={avatarPreview} alt={`${displayName} profile photo`} />
						) : (
							initials
						)}
					</div>
					<div>
						<strong>{displayName}</strong>
						<span>JPG, PNG, WEBP, or GIF up to 5 MB.</span>
					</div>
					<label className={styles.avatarUploadButton}>
						<Camera aria-hidden="true" />
						Upload
						<input
							accept="image/jpeg,image/png,image/webp,image/gif"
							onChange={handleAvatarChange}
							type="file"
						/>
					</label>
				</div>

				<div className={styles.editFields}>
					<div className={styles.editColumn}>
						<div className={styles.editFieldGrid}>
							<div>
								<FieldHeader
									htmlFor="profile-full-name"
									max={PROFILE_FIELD_LIMITS.fullName}
									value={fullName}
								>
									Display name
								</FieldHeader>
								<Input
									id="profile-full-name"
									maxLength={PROFILE_FIELD_LIMITS.fullName}
									onChange={(event) =>
										onFullNameChange(
											limitText(event.target.value, PROFILE_FIELD_LIMITS.fullName),
										)
									}
									placeholder="Alex Morgan"
									value={fullName}
								/>
							</div>
							<div>
								<FieldHeader
									htmlFor="profile-username"
									max={PROFILE_FIELD_LIMITS.username}
									value={username}
								>
									Username
								</FieldHeader>
								<Input
									id="profile-username"
									maxLength={PROFILE_FIELD_LIMITS.username}
									onChange={(event) =>
										onUsernameChange(
											limitText(
												normalizeUsername(event.target.value),
												PROFILE_FIELD_LIMITS.username,
											),
										)
									}
									placeholder="alexmorgan"
									value={username}
								/>
								<div className={usernameAssistClass} aria-live="polite">
									{usernameAvailability.message ? (
										<span>{usernameAvailability.message}</span>
									) : null}
									{usernameAvailability.suggestions.length ? (
										<div className={styles.usernameSuggestions}>
											{usernameAvailability.suggestions.map((suggestion) => (
												<button
													key={suggestion}
													onClick={() => onUsernameChange(suggestion)}
													type="button"
												>
													@{suggestion}
												</button>
											))}
										</div>
									) : null}
								</div>
							</div>
						</div>

						<div>
							<FieldHeader
								htmlFor="profile-tagline"
								max={PROFILE_FIELD_LIMITS.tagline}
								value={tagline}
							>
								Tagline
							</FieldHeader>
							<Input
								id="profile-tagline"
								maxLength={PROFILE_FIELD_LIMITS.tagline}
								onChange={(event) =>
									onTaglineChange(
										limitText(event.target.value, PROFILE_FIELD_LIMITS.tagline),
									)
								}
								placeholder="Building better resumes, one lint pass at a time."
								value={tagline}
							/>
						</div>

						<div className={styles.editFieldGrid}>
							<div>
								<FieldHeader
									htmlFor="profile-current-position"
								>
									Profile role
								</FieldHeader>
								<Select
									onValueChange={(value) =>
										onCurrentPositionChange(
											value === NO_POSITION_VALUE
												? ""
												: limitText(value, PROFILE_FIELD_LIMITS.currentPosition),
										)
									}
									value={currentPosition || NO_POSITION_VALUE}
								>
									<SelectTrigger
										className={styles.highlightSelectTrigger}
										id="profile-current-position"
									>
										<SelectValue placeholder="Choose profile role" />
									</SelectTrigger>
									<SelectContent className={styles.highlightSelectContent}>
										<SelectGroup>
											<SelectItem
												className={styles.highlightSelectItem}
												value={NO_POSITION_VALUE}
											>
												Not set
											</SelectItem>
											{positionOptions.map((position) => (
												<SelectItem
													className={styles.highlightSelectItem}
													key={position}
													value={position}
												>
													{position}
												</SelectItem>
											))}
										</SelectGroup>
									</SelectContent>
								</Select>
							</div>
							<div>
								<FieldHeader
									htmlFor="profile-college"
									max={PROFILE_FIELD_LIMITS.college}
									value={college}
								>
									College
								</FieldHeader>
								<Input
									id="profile-college"
									maxLength={PROFILE_FIELD_LIMITS.college}
									onChange={(event) =>
										onCollegeChange(
											limitText(event.target.value, PROFILE_FIELD_LIMITS.college),
										)
									}
									placeholder="State University"
									value={college}
								/>
							</div>
						</div>

						<div>
							<FieldHeader
								htmlFor="profile-college-location"
								max={PROFILE_FIELD_LIMITS.collegeLocation}
								value={collegeLocation}
							>
								College location
							</FieldHeader>
							<Input
								id="profile-college-location"
								maxLength={PROFILE_FIELD_LIMITS.collegeLocation}
								onChange={(event) =>
									onCollegeLocationChange(
										limitText(
											event.target.value,
											PROFILE_FIELD_LIMITS.collegeLocation,
										),
									)
								}
								placeholder="City, State"
								value={collegeLocation}
							/>
						</div>

					</div>

					<div className={styles.editColumn}>
						<div>
							<FieldHeader
								htmlFor="profile-about"
								max={PROFILE_FIELD_LIMITS.about}
								value={about}
							>
								About me
							</FieldHeader>
							<textarea
								className={`${styles.editTextarea} ${styles.aboutTextarea}`}
								id="profile-about"
								maxLength={PROFILE_FIELD_LIMITS.about}
								onChange={(event) =>
									onAboutChange(
										limitText(event.target.value, PROFILE_FIELD_LIMITS.about),
									)
								}
								placeholder="A short description about your goals, background, and review style."
								value={about}
							/>
						</div>

						<div>
							<div className={styles.skillEditorHeader}>
								<Label htmlFor="profile-skills">Skills</Label>
								<span>
									{selectedSkills.length}/{PROFILE_FIELD_LIMITS.skills}
								</span>
							</div>
							<div className={styles.skillEditor}>
								<div className={styles.selectedSkillList}>
									{selectedSkills.length ? (
										selectedSkills.map((skill) => (
											<button
												aria-label={`Remove ${skill}`}
												key={skill}
												onClick={() => removeSkill(skill)}
												type="button"
											>
												{skill}
												<X aria-hidden="true" />
											</button>
										))
									) : (
										<span>Add skills that describe your review style.</span>
									)}
								</div>
								<div className={styles.skillSearch}>
									<Search aria-hidden="true" />
									<Input
										id="profile-skills"
										maxLength={PROFILE_FIELD_LIMITS.skill}
										onChange={(event) => setSkillQuery(event.target.value)}
										onKeyDown={handleSkillKeyDown}
										placeholder="Search or add a skill"
										value={skillQuery}
									/>
								</div>
								<div className={styles.skillSuggestions}>
									{canAddCustomSkill ? (
										<button
											onClick={() => addSkill(normalizedSkillQuery)}
											type="button"
										>
											<Plus aria-hidden="true" />
											Add "{normalizedSkillQuery}"
										</button>
									) : null}
									{skillSuggestions.map((skill) => (
										<button
											disabled={selectedSkills.length >= PROFILE_FIELD_LIMITS.skills}
											key={skill}
											onClick={() => addSkill(skill)}
											type="button"
										>
											<Plus aria-hidden="true" />
											{skill}
										</button>
									))}
								</div>
							</div>
						</div>
					</div>

					{saveMessage && saveMessage !== "Saved" ? (
						<p className="form-message">{saveMessage}</p>
					) : null}
				</div>

				<DialogFooter className={styles.editFooter}>
					<DialogClose asChild>
						<Button className={styles.footerButton} type="button" variant="outline">
							Cancel
						</Button>
					</DialogClose>
					<Button
						className={styles.footerButton}
						disabled={saving || usernameBlocksSave}
					>
						<Upload data-icon="inline-start" aria-hidden="true" />
						{saving ? "Saving..." : "Save profile"}
					</Button>
				</DialogFooter>
			</form>
		</DialogContent>
	);
}
