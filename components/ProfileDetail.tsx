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
	ArrowRight,
	BadgeCheck,
	BriefcaseBusiness,
	CalendarDays,
	Camera,
	FileText,
	Flame,
	GraduationCap,
	MapPin,
	MessageSquareText,
	Pencil,
	Plus,
	Search,
	ShieldCheck,
	TrendingUp,
	Trophy,
	Upload,
	X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { User } from "@supabase/supabase-js";
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
import { supabase } from "@/lib/supabase/client";
import type {
	PublicProfile,
	PublicProfileResume,
	PublicProfileRoast,
} from "@/lib/supabase/types";
import { toast } from "sonner";
import styles from "./ProfileDetail.module.css";

type ProfileDetailProps = {
	profileId: string;
};

type ActivityItem = {
	id: string;
	icon: LucideIcon;
	title: string;
	detail: string;
	result: string;
	href?: string;
	timestamp: number;
};

type UsernameAvailability = {
	status: "idle" | "checking" | "available" | "taken";
	message: string;
	suggestions: string[];
};

const fallbackAvatar = "/assets/logo.png";
const PROFILE_CHANGE_EVENT = "resumeroster-profile-change";
const LATEST_RESUME_VALUE = "__latest_public_resume__";
const SUPABASE_MIGRATION_MESSAGE =
	"Run the pending Supabase migrations, then refresh this page.";
const PROFILE_FIELD_LIMITS = {
	fullName: 64,
	username: 32,
	tagline: 90,
	currentPosition: 64,
	college: 90,
	collegeLocation: 90,
	about: 280,
	skill: 32,
	skills: 12,
};
const SKILL_OPTIONS = [
	"ATS",
	"Clarity",
	"Communication",
	"Cover Letters",
	"Data Analysis",
	"DSA",
	"Frontend",
	"Git",
	"Interview Prep",
	"Java",
	"JavaScript",
	"Leadership",
	"LinkedIn",
	"Metrics",
	"Node.js",
	"Proofreading",
	"Python",
	"React",
	"Recruiter Screen",
	"Resume Review",
	"SQL",
	"Storytelling",
	"System Design",
	"Tailoring",
	"TypeScript",
	"UX Writing",
	"Web Development",
];
const uuidPattern =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

function limitText(value: string, limit: number) {
	return value.slice(0, limit);
}

function normalizeUsername(value: string) {
	return value
		.replace(/^@+/, "")
		.replace(/[^a-zA-Z0-9_-]/g, "")
		.toLowerCase();
}

function isUsernameConstraintError(error: { code?: string; message?: string }) {
	return (
		error.code === "23505" ||
		/profiles_username_key|duplicate key|username/i.test(error.message ?? "")
	);
}

function buildUsernameCandidates(username: string) {
	const base =
		normalizeUsername(username).replace(/[_-]+$/g, "") ||
		"roaster";
	const year = new Date().getFullYear().toString().slice(-2);
	const suffixes = ["24", "240", "dev", "hq", year, "01", "roast"];
	const candidates: string[] = [];

	for (const suffix of suffixes) {
		const stem = base.slice(0, PROFILE_FIELD_LIMITS.username - suffix.length);
		const candidate = `${stem}${suffix}`;
		if (candidate !== username && candidate.length >= 3) {
			candidates.push(candidate);
		}
	}

	for (let suffix = 2; candidates.length < 10 && suffix < 100; suffix += 1) {
		const textSuffix = String(suffix);
		const stem = base.slice(0, PROFILE_FIELD_LIMITS.username - textSuffix.length);
		const candidate = `${stem}${textSuffix}`;
		if (candidate !== username) {
			candidates.push(candidate);
		}
	}

	return Array.from(new Set(candidates)).slice(0, 10);
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

function usernameTakenMessage(suggestions: string[]) {
	if (!suggestions.length) {
		return "That username is already taken. Try another name.";
	}

	return `That username is already taken. Try ${suggestions
		.map((suggestion) => `@${suggestion}`)
		.join(", ")}.`;
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

function getMetadataName(user: User | null) {
	return user?.user_metadata?.full_name
		? String(user.user_metadata.full_name)
		: "";
}

function getMetadataAvatar(user: User | null) {
	return (
		(user?.user_metadata?.avatar_url as string | undefined) ||
		(user?.user_metadata?.picture as string | undefined) ||
		""
	);
}

function getInitials(name: string) {
	return name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase())
		.join("");
}

function roleTag(profile: PublicProfile) {
	const role = `${profile.current_position ?? profile.target_role ?? ""} ${
		profile.college ?? ""
	}`.toLowerCase();

	if (role.includes("student") || role.includes("college") || role.includes("iit")) {
		return "Student";
	}

	if (role.includes("switch")) {
		return "Career Switcher";
	}

	if (role.includes("intern")) {
		return "Intern";
	}

	return "Job Seeker";
}

function parseSkills(value: string) {
	const seen = new Set<string>();
	return value
		.split(/[,\n]/)
		.map((skill) => skill.trim())
		.filter(
			(skill) =>
				skill.length >= 2 && skill.length <= PROFILE_FIELD_LIMITS.skill,
		)
		.filter((skill) => {
			const key = skill.toLowerCase();
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		})
		.slice(0, PROFILE_FIELD_LIMITS.skills);
}

function fallbackSkills(profile: PublicProfile) {
	const roleWords = (profile.current_position ?? profile.target_role ?? "")
		.split(/[\s,/+-]+/)
		.map((word) => word.trim())
		.filter((word) => word.length > 2);

	return Array.from(
		new Set([
			...roleWords,
			"Resume Review",
			"ATS",
			"Clarity",
			"Proof",
			"Recruiter Screen",
		]),
	).slice(0, 8);
}

function highlightedResume(
	profile: PublicProfile,
	resumes: PublicProfileResume[],
) {
	return (
		resumes.find((resume) => resume.id === profile.resume_highlight_id) ||
		resumes.find((resume) => resume.is_highlight) ||
		resumes[0]
	);
}

function getActivity(
	roasts: PublicProfileRoast[],
	resumes: PublicProfileResume[],
	profile: PublicProfile,
): ActivityItem[] {
	const resumeItems: ActivityItem[] = resumes.slice(0, 5).map((resume) => ({
		id: `resume-${resume.id}`,
		icon: FileText,
		title: `Posted ${resume.title}`,
		detail: formatActivityDate(resume.created_at),
		result: `${resume.roast_count} roasts`,
		href: `/resume/${resume.id}`,
		timestamp: new Date(resume.created_at).getTime(),
	}));

	const roastItems: ActivityItem[] = roasts.slice(0, 5).map((roast) => ({
		id: `roast-${roast.id}`,
		icon: MessageSquareText,
		title: `Reviewed ${roast.resume_title}`,
		detail: formatActivityDate(roast.created_at),
		result: `${roast.helpful_votes} helpful`,
		href: `/resume/${roast.resume_id}`,
		timestamp: new Date(roast.created_at).getTime(),
	}));

	const activity = [...resumeItems, ...roastItems]
		.sort((a, b) => b.timestamp - a.timestamp)
		.slice(0, 5);

	if (activity.length) return activity;

	return [
		{
			id: "profile-created",
			icon: ShieldCheck,
			title: "Joined ResumeRoster",
			detail: `Member since ${formatDate(profile.created_at)}`,
			result: "Ready",
			href: "/feed",
			timestamp: new Date(profile.created_at).getTime(),
		},
		{
			id: "ready-to-roast",
			icon: MessageSquareText,
			title: "Ready to review resumes",
			detail: "No public activity yet",
			result: "Open",
			href: "/feed",
			timestamp: new Date(profile.created_at).getTime(),
		},
	];
}

function isProfileFeatureError(message: string) {
	return /avatar_url|tagline|current_position|college_location|about|skills|resume_highlight_id|get_public_profile_resumes|schema cache|column|function/i.test(
		message,
	);
}

export default function ProfileDetail({ profileId }: ProfileDetailProps) {
	const [user, setUser] = useState<User | null>(null);
	const [profile, setProfile] = useState<PublicProfile | null>(null);
	const [roasts, setRoasts] = useState<PublicProfileRoast[]>([]);
	const [resumes, setResumes] = useState<PublicProfileResume[]>([]);
	const [fullName, setFullName] = useState("");
	const [username, setUsername] = useState("");
	const [tagline, setTagline] = useState("");
	const [currentPosition, setCurrentPosition] = useState("");
	const [college, setCollege] = useState("");
	const [collegeLocation, setCollegeLocation] = useState("");
	const [about, setAbout] = useState("");
	const [skillsInput, setSkillsInput] = useState("");
	const [resumeHighlightId, setResumeHighlightId] = useState("");
	const [avatarFile, setAvatarFile] = useState<File | null>(null);
	const [avatarPreview, setAvatarPreview] = useState("");
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [editOpen, setEditOpen] = useState(false);
	const [message, setMessage] = useState("");
	const [saveMessage, setSaveMessage] = useState("");

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
					setMessage(`We could not find a roaster profile for @${profileToken}.`);
					setLoading(false);
					return;
				}

				resolvedProfileId = matchedProfile.id;
			}

			if (activeUser?.id === resolvedProfileId) {
				const defaultUsername =
					activeUser.email?.split("@")[0]?.replace(/[^a-zA-Z0-9_-]/g, "") ||
					`user-${activeUser.id.slice(0, 8)}`;
				const seedResult = await supabase.from("profiles").insert({
					id: activeUser.id,
					full_name: getMetadataName(activeUser) || null,
					username: defaultUsername,
					avatar_url: getMetadataAvatar(activeUser) || null,
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

			const [profileResult, roastsResult, resumesResult] = await Promise.all([
				supabase.rpc("get_public_profile", { profile_id: resolvedProfileId }),
				supabase.rpc("get_public_profile_roasts", {
					profile_id: resolvedProfileId,
					limit_count: 20,
				}),
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

			let loadedProfile = (profileResult.data?.[0] ?? null) as PublicProfile | null;

			if (!loadedProfile) {
				setMessage(
					isUuid(profileToken)
						? "We could not find a profile row for this user yet."
						: `We could not find a roaster profile for @${profileToken}.`,
				);
				setLoading(false);
				return;
			}

			if (activeUser?.id === resolvedProfileId) {
				const profilePatch: Partial<PublicProfile> = {};
				const metadataName = getMetadataName(activeUser);
				const metadataAvatar = getMetadataAvatar(activeUser);

				if (!loadedProfile.full_name && metadataName) {
					profilePatch.full_name = metadataName;
				}
				if (!loadedProfile.avatar_url && metadataAvatar) {
					profilePatch.avatar_url = metadataAvatar;
				}

				if (Object.keys(profilePatch).length) {
					await supabase
						.from("profiles")
						.update(profilePatch)
						.eq("id", activeUser.id);
					loadedProfile = { ...loadedProfile, ...profilePatch };
				}
			}

			const loadedRoasts = (roastsResult.data ?? []) as PublicProfileRoast[];
			const loadedResumes = (resumesResult.data ?? []) as PublicProfileResume[];

			setProfile(loadedProfile);
			setRoasts(loadedRoasts);
			setResumes(loadedResumes);
			setFullName(
				limitText(
					loadedProfile.full_name ?? getMetadataName(activeUser) ?? "",
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
			setResumeHighlightId(
				loadedProfile.resume_highlight_id ||
					loadedResumes.find((resume) => resume.is_highlight)?.id ||
					"",
			);

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
			const selectedHighlight =
				resumes.some((resume) => resume.id === resumeHighlightId) && resumeHighlightId
					? resumeHighlightId
					: null;

			const nextProfile = {
				full_name:
					limitText(fullName, PROFILE_FIELD_LIMITS.fullName).trim() || null,
				username: nextUsername || null,
				tagline:
					limitText(tagline, PROFILE_FIELD_LIMITS.tagline).trim() || null,
				current_position: nextPosition,
				target_role: nextPosition,
				college: limitText(college, PROFILE_FIELD_LIMITS.college).trim() || null,
				college_location:
					limitText(collegeLocation, PROFILE_FIELD_LIMITS.collegeLocation).trim() ||
					null,
				about: limitText(about, PROFILE_FIELD_LIMITS.about).trim() || null,
				skills: nextSkills,
				resume_highlight_id: selectedHighlight,
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
							resume_highlight_id: selectedHighlight,
						}
					: current,
			);
			window.dispatchEvent(
				new CustomEvent(PROFILE_CHANGE_EVENT, {
					detail: {
						id: user.id,
						full_name: nextProfile.full_name,
						username: nextProfile.username,
						avatar_url:
							avatarUpdate?.avatar_url ||
							profile?.avatar_url ||
							getMetadataAvatar(user) ||
							null,
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

	const profileView = useMemo(() => {
		if (!profile) return null;

		const metadataName = isOwnProfile ? getMetadataName(user) : "";
		const metadataAvatar = isOwnProfile ? getMetadataAvatar(user) : "";
		const displayName =
			profile.full_name || metadataName || profile.username || "Anonymous roaster";
		const currentRole =
			profile.current_position ||
			profile.target_role ||
			"Community resume reviewer";
		const resumeHighlight = highlightedResume(profile, resumes);
		const skills = profile.skills?.length ? profile.skills : fallbackSkills(profile);

		return {
			activity: getActivity(roasts, resumes, profile),
			avatarUrl: profile.avatar_url || metadataAvatar || fallbackAvatar,
			collegeLabel: profile.college || "College not set",
			collegeLocation: profile.college_location || "College location not set",
			currentRole,
			displayName,
			initials: getInitials(displayName) || "R",
			resumeHighlight,
			roleTag: roleTag(profile),
			skills,
			tagline:
				profile.tagline ||
				"Building better resumes, one thoughtful roast at a time.",
		};
	}, [isOwnProfile, profile, resumes, roasts, user]);

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
					<p>This roaster does not have public reputation yet.</p>
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
							<BadgeCheck aria-hidden="true" />
						</div>
						<div className={styles.roleTag}>{profileView.roleTag}</div>
						<p>{profileView.tagline}</p>
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
								onResumeHighlightChange={setResumeHighlightId}
								onSave={saveProfile}
								onSkillsChange={setSkillsInput}
								onTaglineChange={setTagline}
								onUsernameChange={setUsername}
								originalUsername={profile.username ?? ""}
								resumeHighlightId={resumeHighlightId}
								resumes={resumes}
								saveMessage={saveMessage}
								saving={saving}
								skillsInput={skillsInput}
								tagline={tagline}
								username={username}
							/>
						</Dialog>
					) : null}
				</header>

				<section className={styles.statsGrid} aria-label="Profile stats">
					<StatCard
						highlight
						icon={Flame}
						label="Roast Points"
						value={profile.roast_points.toLocaleString()}
					/>
					<StatCard
						icon={TrendingUp}
						label="Resume Improvement"
						value={`+${profile.resume_improvement}%`}
					/>
					<StatCard
						icon={FileText}
						label="Resumes Roasted"
						value={profile.resumes_roasted_count.toLocaleString()}
					/>
					<StatCard
						icon={Trophy}
						label="Best Roasts"
						value={profile.best_roast_count.toLocaleString()}
					/>
				</section>

				<div className={styles.profileGrid}>
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

					<section className={styles.highlightPanel}>
						<div className={styles.panelHeader}>
							<h2>Resume Highlight</h2>
							{profileView.resumeHighlight ? (
								<Link href={`/resume/${profileView.resumeHighlight.id}`}>
									View Resume <ArrowRight aria-hidden="true" />
								</Link>
							) : null}
						</div>
						{profileView.resumeHighlight ? (
							<div className={styles.resumeHighlight}>
								<div className={styles.resumePreview}>
									<FileText aria-hidden="true" />
								</div>
								<div>
									<strong>{profileView.resumeHighlight.title}</strong>
									<span>
										{profileView.resumeHighlight.roast_count} roasts -{" "}
										{formatActivityDate(profileView.resumeHighlight.created_at)}
									</span>
									<Link href={`/resume/${profileView.resumeHighlight.id}`}>
										View Resume
									</Link>
								</div>
							</div>
						) : (
							<p className={styles.mutedCopy}>
								No public resume is highlighted yet.
							</p>
						)}
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

					<section className={styles.roastsPanel}>
						<div className={styles.panelHeader}>
							<h2>Recent Roasts</h2>
							<Link href="/feed">View all</Link>
						</div>
						{roasts.length ? (
							<div className={styles.roastList}>
								{roasts.slice(0, 4).map((roast) => (
									<RoastRow roast={roast} key={roast.id} />
								))}
							</div>
						) : (
							<p className={styles.mutedCopy}>
								No public roasts yet. Helpful feedback will show up here.
							</p>
						)}
					</section>
				</div>
			</div>
		</section>
	);
}

function StatCard({
	highlight = false,
	icon: Icon,
	label,
	value,
}: {
	highlight?: boolean;
	icon: LucideIcon;
	label: string;
	value: string;
}) {
	return (
		<div className={`${styles.statCard} ${highlight ? styles.statPrimary : ""}`}>
			<Icon aria-hidden="true" />
			<strong>{value}</strong>
			<span>{label}</span>
		</div>
	);
}

function ActivityRow({ item }: { item: ActivityItem }) {
	const Icon = item.icon;
	const content = (
		<>
			<div className={styles.activityIcon}>
				<Icon aria-hidden="true" />
			</div>
			<div>
				<strong>{item.title}</strong>
				<span>{item.detail}</span>
			</div>
			<em>{item.result}</em>
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

function RoastRow({ roast }: { roast: PublicProfileRoast }) {
	return (
		<Link className={styles.roastRow} href={`/resume/${roast.resume_id}`}>
			<MessageSquareText aria-hidden="true" />
			<div>
				<p>"{roast.content}"</p>
				<span>
					{roast.resume_title} - {formatActivityDate(roast.created_at)}
				</span>
			</div>
			<strong>{roast.helpful_votes} helpful</strong>
		</Link>
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
	onResumeHighlightChange,
	onSave,
	onSkillsChange,
	onTaglineChange,
	onUsernameChange,
	originalUsername,
	resumeHighlightId,
	resumes,
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
	onResumeHighlightChange: (value: string) => void;
	onSave: (event: FormEvent<HTMLFormElement>) => void;
	onSkillsChange: (value: string) => void;
	onTaglineChange: (value: string) => void;
	onUsernameChange: (value: string) => void;
	originalUsername: string;
	resumeHighlightId: string;
	resumes: PublicProfileResume[];
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
					Update the public details shown on your ResumeRoster profile.
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
									placeholder="Shajith Bathina"
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
									placeholder="shajith240"
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
								placeholder="Building better resumes, one roast at a time."
								value={tagline}
							/>
						</div>

						<div className={styles.editFieldGrid}>
							<div>
								<FieldHeader
									htmlFor="profile-current-position"
									max={PROFILE_FIELD_LIMITS.currentPosition}
									value={currentPosition}
								>
									Current position
								</FieldHeader>
								<Input
									id="profile-current-position"
									maxLength={PROFILE_FIELD_LIMITS.currentPosition}
									onChange={(event) =>
										onCurrentPositionChange(
											limitText(
												event.target.value,
												PROFILE_FIELD_LIMITS.currentPosition,
											),
										)
									}
									placeholder="SDE intern"
									value={currentPosition}
								/>
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
									placeholder="IIT(ISM) Dhanbad"
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
								placeholder="Dhanbad, Jharkhand"
								value={collegeLocation}
							/>
						</div>

						<div>
							<FieldHeader htmlFor="profile-resume-highlight">
								Resume highlight
							</FieldHeader>
							<Select
								onValueChange={(value) =>
									onResumeHighlightChange(
										value === LATEST_RESUME_VALUE ? "" : value,
									)
								}
								value={resumeHighlightId || LATEST_RESUME_VALUE}
							>
								<SelectTrigger
									className={styles.highlightSelectTrigger}
									id="profile-resume-highlight"
								>
									<SelectValue placeholder="Latest public resume" />
								</SelectTrigger>
								<SelectContent className={styles.highlightSelectContent}>
									<SelectGroup>
										<SelectItem
											className={styles.highlightSelectItem}
											value={LATEST_RESUME_VALUE}
										>
											Latest public resume
										</SelectItem>
										{resumes.map((resume) => (
											<SelectItem
												className={styles.highlightSelectItem}
												key={resume.id}
												value={resume.id}
											>
												{resume.title}
											</SelectItem>
										))}
									</SelectGroup>
								</SelectContent>
							</Select>
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
