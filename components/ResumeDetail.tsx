"use client";

import {
	type CSSProperties,
	FormEvent,
	useEffect,
	useMemo,
	useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ThumbsDown, ThumbsUp, Trash } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { announceRouteTransition } from "@/components/RouteTransitionLoader";
import SecureResumePreview from "@/components/SecureResumePreview";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
	getResumeAffiliationLabel,
	getResumePosterLabel,
	getResumeRoleLabel,
} from "@/lib/resume-display";
import { getLoginPath } from "@/lib/auth-redirect";
import { supabase } from "@/lib/supabase/client";
import type {
	ResumeAuthorProfile,
	ResumeSummary,
	Roast,
} from "@/lib/supabase/types";
import { toast } from "sonner";

type ResumeDetailProps = {
	resumeId: string;
};

type Reaction = "like" | "dislike";

type AuthorProfile = {
	id: string;
	username: string | null;
	full_name: string | null;
};

type ThreadRoast = Roast & {
	childCount: number;
	depth: number;
};

type ResumeRowWithDefaults = Omit<
	ResumeSummary,
	"read_count" | "job_description" | "post_description"
> &
	Partial<
		Pick<ResumeSummary, "read_count" | "job_description" | "post_description">
	>;

type ResumeQueryResult = {
	data: ResumeRowWithDefaults | null;
	error: { message?: string } | null;
};

const ROAST_SELECT_WITH_THREADS =
	"id,resume_id,parent_id,author_id,content,helpful_votes,dislike_count,reply_count,is_deleted,deleted_at,created_at";
const ROAST_SELECT_WITH_THREADS_LEGACY =
	"id,resume_id,parent_id,author_id,content,helpful_votes,dislike_count,reply_count,created_at";
const ROAST_SELECT_WITH_REACTIONS =
	"id,resume_id,author_id,content,helpful_votes,dislike_count,created_at";
const ROAST_SELECT_BASE =
	"id,resume_id,author_id,content,helpful_votes,created_at";
const RESUME_SELECT_WITH_CONTEXT =
	"id,user_id,title,file_path,is_anonymous,status,roast_count,read_count,job_description,post_description,created_at";
const RESUME_SELECT_WITH_READS =
	"id,user_id,title,file_path,is_anonymous,status,roast_count,read_count,created_at";
const RESUME_SELECT_BASE =
	"id,user_id,title,file_path,is_anonymous,status,roast_count,created_at";
const RESUME_AUTHOR_PROFILE_SELECT_WITH_STATUS =
	"id,username,full_name,avatar_url,avatar_path,college,target_role,current_position,app_status";
const RESUME_AUTHOR_PROFILE_SELECT_BASE =
	"id,username,full_name,avatar_url,college,target_role";

function formatDate(value: string) {
	return new Intl.DateTimeFormat("en", {
		month: "short",
		day: "numeric",
	}).format(new Date(value));
}

function getReactionBlockReason(
	activeUser: User | null,
	activeResume: ResumeSummary | null,
	roast: Roast,
) {
	if (!activeUser) return null;

	if (activeResume?.user_id === activeUser.id) {
		return "Resume owners cannot react to roasts on their own resume.";
	}

	if (roast.author_id === activeUser.id) {
		return "You cannot react to your own roast.";
	}

	return null;
}

function getAuthorHandle(authorId: string, profile?: AuthorProfile) {
	const name =
		profile?.username ||
		profile?.full_name ||
		`roaster-${authorId.slice(0, 8)}`;
	return name.startsWith("@") ? name : `@${name}`;
}

function getAuthorAvatar(authorId: string, profile?: AuthorProfile) {
	const seed = profile?.full_name || profile?.username || authorId;
	return `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(seed)}`;
}

function isMissingColumnError(error: { message?: string } | null, column: string) {
	return Boolean(error?.message?.toLowerCase().includes(column.toLowerCase()));
}

function isReadCountFeatureError(error: { message?: string } | null) {
	return /read_count|record_resume_read|schema cache|column|function/i.test(
		error?.message ?? "",
	);
}

function isDeleteFeatureError(error: { message?: string } | null) {
	return /is_deleted|deleted_at|delete_roast|schema cache|column|function/i.test(
		error?.message ?? "",
	);
}

function isResumeContextFeatureError(error: { message?: string } | null) {
	return /job_description|post_description|read_count|schema cache|column/i.test(
		error?.message ?? "",
	);
}

function isAuthorProfileFeatureError(error: { message?: string } | null) {
	return /app_status|current_position|avatar_path|schema cache|column/i.test(
		error?.message ?? "",
	);
}

function withResumeDefaults(resume: ResumeRowWithDefaults): ResumeSummary {
	return {
		...resume,
		read_count: resume.read_count ?? 0,
		job_description: resume.job_description ?? null,
		post_description: resume.post_description ?? null,
	};
}

function ResumeContextCard({
	eyebrow,
	title,
	content,
	emptyMessage,
}: {
	eyebrow: string;
	title: string;
	content: string;
	emptyMessage: string;
}) {
	const normalizedContent = content.trim();

	return (
		<section
			className={`resume-context-card${normalizedContent ? "" : " is-empty"}`}
		>
			<span>{eyebrow}</span>
			<h2>{title}</h2>
			<p>{normalizedContent || emptyMessage}</p>
		</section>
	);
}

function normalizeRoast(roast: Roast): Roast {
	return {
		...roast,
		parent_id: roast.parent_id ?? null,
		dislike_count: roast.dislike_count ?? 0,
		reply_count: roast.reply_count ?? 0,
		is_deleted: roast.is_deleted ?? false,
		deleted_at: roast.deleted_at ?? null,
	};
}

function sortTopLevelRoasts(a: Roast, b: Roast) {
	return (
		b.helpful_votes - a.helpful_votes ||
		new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
	);
}

function sortReplyRoasts(a: Roast, b: Roast) {
	return (
		new Date(a.created_at).getTime() - new Date(b.created_at).getTime() ||
		b.helpful_votes - a.helpful_votes
	);
}

function buildThreadRoasts(
	roasts: Roast[],
	collapsedRoastIds: Set<string>,
): ThreadRoast[] {
	const childrenByParent = new Map<string | null, Roast[]>();

	for (const roast of roasts) {
		const parentId = roast.parent_id ?? null;
		const siblings = childrenByParent.get(parentId) ?? [];
		siblings.push(roast);
		childrenByParent.set(parentId, siblings);
	}

	childrenByParent.get(null)?.sort(sortTopLevelRoasts);
	for (const [parentId, children] of childrenByParent.entries()) {
		if (parentId !== null) {
			children.sort(sortReplyRoasts);
		}
	}

	const flattened: ThreadRoast[] = [];
	const stack = [...(childrenByParent.get(null) ?? [])]
		.reverse()
		.map((roast) => ({ depth: 0, roast }));

	while (stack.length) {
		const { depth, roast } = stack.pop()!;
		const children = childrenByParent.get(roast.id) ?? [];
		flattened.push({
			...roast,
			childCount: children.length,
			depth,
		});

		if (collapsedRoastIds.has(roast.id)) {
			continue;
		}

		for (let index = children.length - 1; index >= 0; index -= 1) {
			stack.push({ depth: depth + 1, roast: children[index] });
		}
	}

	return flattened;
}

export default function ResumeDetail({ resumeId }: ResumeDetailProps) {
	const router = useRouter();
	const [user, setUser] = useState<User | null>(null);
	const [resume, setResume] = useState<ResumeSummary | null>(null);
	const [resumeAuthorProfile, setResumeAuthorProfile] =
		useState<ResumeAuthorProfile | null>(null);
	const [roasts, setRoasts] = useState<Roast[]>([]);
	const [authorProfiles, setAuthorProfiles] = useState<
		Record<string, AuthorProfile>
	>({});
	const [votedRoastIds, setVotedRoastIds] = useState<Set<string>>(new Set());
	const [dislikedRoastIds, setDislikedRoastIds] = useState<Set<string>>(
		new Set(),
	);
	const [signedUrl, setSignedUrl] = useState("");
	const [signedUrlError, setSignedUrlError] = useState("");
	const [content, setContent] = useState("");
	const [replyContent, setReplyContent] = useState("");
	const [replyingToId, setReplyingToId] = useState<string | null>(null);
	const [submittingReplyId, setSubmittingReplyId] = useState("");
	const [deletingRoastId, setDeletingRoastId] = useState("");
	const [deleteTargetRoast, setDeleteTargetRoast] = useState<Roast | null>(null);
	const [collapsedRoastIds, setCollapsedRoastIds] = useState<Set<string>>(
		new Set(),
	);
	const [replySchemaReady, setReplySchemaReady] = useState(true);
	const [deleteSchemaReady, setDeleteSchemaReady] = useState(true);
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [message, setMessage] = useState("");

	const threadRoasts = useMemo(
		() => buildThreadRoasts(roasts, collapsedRoastIds),
		[collapsedRoastIds, roasts],
	);
	const isOwner = Boolean(user && resume?.user_id === user.id);
	const isClosed = resume?.status === "closed";

	function goToLogin() {
		const loginRoute = getLoginPath(`/resume/${resumeId}`);
		announceRouteTransition(loginRoute);
		router.push(loginRoute);
	}

	function reportError(errorMessage: string) {
		setMessage(errorMessage);
		toast.error(errorMessage);
	}

	async function openResumeFile(activeResume = resume) {
		setSignedUrlError("");

		const { data: userData } = await supabase.auth.getUser();
		const activeUser = userData.user;
		setUser(activeUser);

		if (!activeUser || !activeResume) {
			return;
		}

		const signed = await supabase.storage
			.from("resumes")
			.createSignedUrl(activeResume.file_path, 60 * 20);

		if (signed.error) {
			setSignedUrl("");
			setSignedUrlError(signed.error.message);
			return;
		}

		setSignedUrl(signed.data.signedUrl);
	}

	async function recordResumeRead(
		activeResume: ResumeSummary,
		activeUser: User | null,
	) {
		if (!activeUser || activeResume.user_id === activeUser.id) {
			return;
		}

		const { data, error } = await supabase.rpc("record_resume_read", {
			target_resume_id: activeResume.id,
		});

		if (error) {
			if (process.env.NODE_ENV !== "production") {
				console.warn("Resume read tracking failed:", error.message);
			}
			return;
		}

		const nextReadCount =
			typeof data === "number"
				? data
				: typeof data === "string"
					? Number(data)
					: Number.NaN;

		if (Number.isFinite(nextReadCount)) {
			setResume((current) =>
				current?.id === activeResume.id
					? { ...current, read_count: nextReadCount }
					: current,
			);
		}
	}

	async function fetchResumeAuthorProfile(activeResume: ResumeSummary) {
		if (activeResume.is_anonymous) return null;

		const primaryResult = await supabase
			.from("profiles")
			.select(RESUME_AUTHOR_PROFILE_SELECT_WITH_STATUS)
			.eq("id", activeResume.user_id)
			.maybeSingle();

		if (primaryResult.error && isAuthorProfileFeatureError(primaryResult.error)) {
			const fallbackResult = await supabase
				.from("profiles")
				.select(RESUME_AUTHOR_PROFILE_SELECT_BASE)
				.eq("id", activeResume.user_id)
				.maybeSingle();

			if (fallbackResult.error) return null;
			return (fallbackResult.data ?? null) as ResumeAuthorProfile | null;
		}

		if (primaryResult.error) return null;

		return (primaryResult.data ?? null) as ResumeAuthorProfile | null;
	}

	async function loadRoastThread(activeUser: User | null) {
		const roastResultWithThreads = await supabase
			.from("roasts")
			.select(ROAST_SELECT_WITH_THREADS)
			.eq("resume_id", resumeId)
			.order("created_at", { ascending: false });

		const roastResultWithDeleteFallback =
			roastResultWithThreads.error &&
			isDeleteFeatureError(roastResultWithThreads.error)
				? await supabase
						.from("roasts")
						.select(ROAST_SELECT_WITH_THREADS_LEGACY)
						.eq("resume_id", resumeId)
						.order("created_at", { ascending: false })
				: roastResultWithThreads;

		setDeleteSchemaReady(
			!(
				roastResultWithThreads.error &&
				isDeleteFeatureError(roastResultWithThreads.error)
			),
		);

		const roastResultWithReactions =
			roastResultWithDeleteFallback.error &&
			(isMissingColumnError(roastResultWithDeleteFallback.error, "parent_id") ||
				isMissingColumnError(roastResultWithDeleteFallback.error, "reply_count"))
				? await supabase
						.from("roasts")
						.select(ROAST_SELECT_WITH_REACTIONS)
						.eq("resume_id", resumeId)
						.order("created_at", { ascending: false })
				: roastResultWithDeleteFallback;

		setReplySchemaReady(
			!(
				roastResultWithDeleteFallback.error &&
				(isMissingColumnError(roastResultWithDeleteFallback.error, "parent_id") ||
					isMissingColumnError(roastResultWithDeleteFallback.error, "reply_count"))
			),
		);

		const roastResult =
			roastResultWithReactions.error &&
			isMissingColumnError(roastResultWithReactions.error, "dislike_count")
				? await supabase
						.from("roasts")
						.select(ROAST_SELECT_BASE)
						.eq("resume_id", resumeId)
						.order("created_at", { ascending: false })
				: roastResultWithReactions;

		if (roastResult.error) {
			return;
		}

		const loadedRoasts = ((roastResult.data ?? []) as Roast[]).map((roast) =>
			normalizeRoast(roast),
		);
		setRoasts(loadedRoasts);

		const authorIds = Array.from(
			new Set(
				loadedRoasts
					.filter((roast) => !roast.is_deleted)
					.map((roast) => roast.author_id),
			),
		);

		if (authorIds.length) {
			const profileResult = await supabase
				.from("profiles")
				.select("id,username,full_name")
				.in("id", authorIds);

			if (!profileResult.error) {
				setAuthorProfiles(
					Object.fromEntries(
						(profileResult.data ?? []).map((profile) => [
							profile.id,
							profile,
						]),
					),
				);
			}
		}

		const roastIds = loadedRoasts
			.filter((roast) => !roast.is_deleted)
			.map((roast) => roast.id);

		if (activeUser && roastIds.length) {
			const voteResultWithReactions = await supabase
				.from("votes")
				.select("roast_id,reaction")
				.eq("voter_id", activeUser.id)
				.in("roast_id", roastIds);

			const voteResult =
				voteResultWithReactions.error &&
				voteResultWithReactions.error.message.includes("reaction")
					? await supabase
							.from("votes")
							.select("roast_id")
							.eq("voter_id", activeUser.id)
							.in("roast_id", roastIds)
					: voteResultWithReactions;

			if (!voteResult.error) {
				setVotedRoastIds(
					new Set(
						voteResult.data
							.filter((vote) => !("reaction" in vote) || vote.reaction === "like")
							.map((vote) => vote.roast_id),
					),
				);
				setDislikedRoastIds(
					new Set(
						voteResult.data
							.filter((vote) => "reaction" in vote && vote.reaction === "dislike")
							.map((vote) => vote.roast_id),
					),
				);
			}
		} else {
			setVotedRoastIds(new Set());
			setDislikedRoastIds(new Set());
		}
	}

	useEffect(() => {
		async function load() {
			const started = Date.now();
			const { data: userData } = await supabase.auth.getUser();
			const activeUser = userData.user;
			setUser(activeUser);

			const resumeResultWithContext = await supabase
				.from("resumes")
				.select(RESUME_SELECT_WITH_CONTEXT)
				.eq("id", resumeId)
				.single();

			let resumeResult = resumeResultWithContext as ResumeQueryResult;

			if (
				resumeResultWithContext.error &&
				isResumeContextFeatureError(resumeResultWithContext.error)
			) {
				const resumeResultWithReads = (await supabase
					.from("resumes")
					.select(RESUME_SELECT_WITH_READS)
					.eq("id", resumeId)
					.single()) as ResumeQueryResult;

				if (
					resumeResultWithReads.error &&
					isReadCountFeatureError(resumeResultWithReads.error)
				) {
					resumeResult = (await supabase
						.from("resumes")
						.select(RESUME_SELECT_BASE)
						.eq("id", resumeId)
						.single()) as ResumeQueryResult;
				} else {
					resumeResult = resumeResultWithReads;
				}
			}

			if (resumeResult.error) {
				setMessage(resumeResult.error.message ?? "Resume could not be loaded.");
				setLoading(false);
				return;
			}

			if (!resumeResult.data) {
				setMessage("Resume not found.");
				setLoading(false);
				return;
			}

			const loadedResume = withResumeDefaults(resumeResult.data);
			setResume(loadedResume);
			setResumeAuthorProfile(await fetchResumeAuthorProfile(loadedResume));

			if (activeUser) {
				await openResumeFile(loadedResume);
				void recordResumeRead(loadedResume, activeUser);
			}

			await loadRoastThread(activeUser);

			const elapsed = Date.now() - started;
			window.setTimeout(() => setLoading(false), Math.max(0, 300 - elapsed));
		}

		void load();
	}, [resumeId]);

	async function handleRoastSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setMessage("");

		if (!user) {
			goToLogin();
			return;
		}

		if (isOwner) {
			reportError("You cannot roast your own resume. Let the community cook.");
			return;
		}

		if (isClosed) {
			reportError("This resume is closed for new roasts.");
			return;
		}

		const roastContent = content.trim();
		if (roastContent.length < 10) {
			reportError("Give at least 10 characters of useful feedback.");
			return;
		}

		setSubmitting(true);

		const { data, error } = await supabase
			.from("roasts")
			.insert({
				resume_id: resumeId,
				author_id: user.id,
				content: roastContent,
			})
			.select("id,resume_id,author_id,content,helpful_votes,created_at")
			.single();

		setSubmitting(false);

		if (error) {
			reportError(error.message);
			return;
		}

		setRoasts((current) => [normalizeRoast(data as Roast), ...current]);
		setAuthorProfiles((current) => ({
			...current,
			[user.id]: {
				id: user.id,
				username: user.email?.split("@")[0] ?? null,
				full_name: user.user_metadata?.full_name ?? null,
			},
		}));
		setResume((current) =>
			current ? { ...current, roast_count: current.roast_count + 1 } : current,
		);
		setContent("");
		toast.success("Roast submitted.");
	}

	async function handleReplySubmit(
		event: FormEvent<HTMLFormElement>,
		parentRoast: Roast,
	) {
		event.preventDefault();
		setMessage("");

		if (!replySchemaReady) {
			reportError("Run supabase/replies.sql in Supabase, then refresh to enable replies.");
			return;
		}

		if (!user) {
			goToLogin();
			return;
		}

		if (parentRoast.author_id === user.id) {
			reportError("You cannot reply to your own roast.");
			return;
		}

		if (isClosed) {
			reportError("This resume is closed for new replies.");
			return;
		}

		const replyText = replyContent.trim();
		if (replyText.length < 10) {
			reportError("Give at least 10 characters of useful reply context.");
			return;
		}

		setSubmittingReplyId(parentRoast.id);

		const { data, error } = await supabase
			.from("roasts")
			.insert({
				resume_id: resumeId,
				parent_id: parentRoast.id,
				author_id: user.id,
				content: replyText,
			})
			.select(ROAST_SELECT_WITH_THREADS)
			.single();

		setSubmittingReplyId("");

		if (error) {
			if (
				isMissingColumnError(error, "parent_id") ||
				isMissingColumnError(error, "reply_count")
			) {
				setReplySchemaReady(false);
				reportError("Run supabase/replies.sql in Supabase, then refresh to enable replies.");
				return;
			}

			reportError(error.message);
			return;
		}

		const nextReply = normalizeRoast(data as Roast);
		setRoasts((current) => [
			nextReply,
			...current.map((roast) =>
				roast.id === parentRoast.id
					? { ...roast, reply_count: (roast.reply_count ?? 0) + 1 }
					: roast,
			),
		]);
		setCollapsedRoastIds((current) => {
			const next = new Set(current);
			next.delete(parentRoast.id);
			return next;
		});
		setAuthorProfiles((current) => ({
			...current,
			[user.id]: {
				id: user.id,
				username: user.email?.split("@")[0] ?? null,
				full_name: user.user_metadata?.full_name ?? null,
			},
		}));
		setResume((current) =>
			current ? { ...current, roast_count: current.roast_count + 1 } : current,
		);
		setReplyingToId(null);
		setReplyContent("");
		toast.success("Reply posted.");
	}

	function toggleRoastReplies(roastId: string) {
		setCollapsedRoastIds((current) => {
			const next = new Set(current);
			if (next.has(roastId)) {
				next.delete(roastId);
			} else {
				next.add(roastId);
			}
			return next;
		});
	}

	async function reactToRoast(targetRoast: Roast, reaction: Reaction) {
		setMessage("");

		if (!user) {
			goToLogin();
			return;
		}

		if (targetRoast.author_id === user.id) {
			reportError("You cannot react to your own roast.");
			return;
		}

		if (isOwner) {
			reportError("Resume owners cannot react to roasts for their own resume.");
			return;
		}

		const currentReaction = votedRoastIds.has(targetRoast.id)
			? "like"
			: dislikedRoastIds.has(targetRoast.id)
				? "dislike"
				: null;

		const applyLocalReaction = (nextReaction: Reaction | null) => {
			setVotedRoastIds((current) => {
				const next = new Set(current);
				if (nextReaction === "like") {
					next.add(targetRoast.id);
				} else {
					next.delete(targetRoast.id);
				}
				return next;
			});
			setDislikedRoastIds((current) => {
				const next = new Set(current);
				if (nextReaction === "dislike") {
					next.add(targetRoast.id);
				} else {
					next.delete(targetRoast.id);
				}
				return next;
			});
			setRoasts((current) =>
				current.map((roast) => {
					if (roast.id !== targetRoast.id) return roast;

					const removeLike = currentReaction === "like" ? -1 : 0;
					const addLike = nextReaction === "like" ? 1 : 0;
					const removeDislike = currentReaction === "dislike" ? -1 : 0;
					const addDislike = nextReaction === "dislike" ? 1 : 0;

					return {
						...roast,
						helpful_votes: Math.max(
							0,
							roast.helpful_votes + removeLike + addLike,
						),
						dislike_count: Math.max(
							0,
							(roast.dislike_count ?? 0) + removeDislike + addDislike,
						),
					};
				}),
			);
		};

		if (currentReaction === reaction) {
			const { error } = await supabase
				.from("votes")
				.delete()
				.eq("roast_id", targetRoast.id)
				.eq("voter_id", user.id);

			if (error) {
				reportError(error.message);
				return;
			}

			applyLocalReaction(null);
			toast.info(reaction === "like" ? "Like removed." : "Dislike removed.");
			return;
		}

		const voteQuery = currentReaction
			? supabase
					.from("votes")
					.update({ reaction })
					.eq("roast_id", targetRoast.id)
					.eq("voter_id", user.id)
			: supabase.from("votes").insert({
					roast_id: targetRoast.id,
					voter_id: user.id,
					reaction,
				});

		const { error } = await voteQuery;

		if (error) {
			reportError(
				error.message.includes("reaction")
					? "Run the reaction SQL migration in Supabase, then try again."
					: error.message,
			);
			return;
		}

		applyLocalReaction(reaction);
		toast.success(reaction === "like" ? "Liked roast." : "Disliked roast.");
	}

	async function closeResume() {
		setMessage("");

		if (!resume || !isOwner) {
			reportError("Only the resume owner can close this thread.");
			return;
		}

		const { error } = await supabase
			.from("resumes")
			.update({ status: "closed" })
			.eq("id", resume.id);

		if (error) {
			reportError(error.message);
			return;
		}

		setResume({ ...resume, status: "closed" });
		setMessage("This resume is now closed for new roasts.");
		toast.success("Resume thread closed.");
	}

	async function deleteResume() {
		setMessage("");

		if (!resume || !isOwner) {
			reportError("Only the resume owner can delete this submission.");
			return;
		}

		const removeFile = await supabase.storage
			.from("resumes")
			.remove([resume.file_path]);
		if (removeFile.error) {
			reportError(removeFile.error.message);
			return;
		}

		const { error } = await supabase
			.from("resumes")
			.delete()
			.eq("id", resume.id);
		if (error) {
			reportError(error.message);
			return;
		}

		toast.success("Resume deleted.");
		announceRouteTransition("/feed");
		router.push("/feed");
	}

	async function requestDeleteRoast(targetRoast: Roast) {
		setMessage("");

		if (!deleteSchemaReady) {
			reportError("Run supabase/roast-deletes.sql in Supabase, then refresh to enable comment deletes.");
			return;
		}

		if (!user) {
			goToLogin();
			return;
		}

		if (targetRoast.author_id !== user.id) {
			reportError("You can only delete roasts or replies you wrote.");
			return;
		}

		if (targetRoast.is_deleted) {
			reportError("This roast has already been deleted.");
			return;
		}

		setDeleteTargetRoast(targetRoast);
	}

	async function deleteRoast(targetRoast: Roast | null) {
		setMessage("");

		if (!targetRoast) {
			return;
		}

		if (!user) {
			goToLogin();
			return;
		}

		setDeletingRoastId(targetRoast.id);

		const { error } = await supabase.rpc("delete_roast", {
			target_roast_id: targetRoast.id,
		});

		setDeletingRoastId("");
		setDeleteTargetRoast(null);

		if (error) {
			if (isDeleteFeatureError(error)) {
				setDeleteSchemaReady(false);
				reportError("Run supabase/roast-deletes.sql in Supabase, then refresh to enable comment deletes.");
				return;
			}

			reportError(error.message);
			return;
		}

		setReplyingToId((current) =>
			current === targetRoast.id ? null : current,
		);
		setReplyContent("");
		await loadRoastThread(user);
		setResume((current) =>
			current
				? {
						...current,
						roast_count: Math.max(current.roast_count - 1, 0),
					}
				: current,
		);
		toast.success(targetRoast.parent_id ? "Reply deleted." : "Roast deleted.");
	}

	if (loading) {
		return (
			<section className="resume-thread">
				<div className="thread-viewer-card">
					<span className="skeleton skeleton-line title" />
					<span className="skeleton skeleton-line copy" />
					<span className="skeleton skeleton-line actions" />
				</div>
			</section>
		);
	}

	if (!resume) {
		return <p className="form-message">{message || "Resume not found."}</p>;
	}

	const jobDescription = resume.job_description ?? "";
	const postDescription = resume.post_description ?? "";
	const visibleRoastCount = roasts.filter((roast) => !roast.is_deleted).length;
	const deleteTargetIsReply = Boolean(deleteTargetRoast?.parent_id);
	const posterLabel = getResumePosterLabel(resume, resumeAuthorProfile);

	return (
		<>
		<section className="resume-thread">
			<div className="resume-detail-main-scroll">
			<article className="thread-viewer-card resume-preview-pane">
				<header className="thread-header">
					<div className="post-meta">
						{resume.is_anonymous ? (
							<span>{posterLabel}</span>
						) : (
							<Link
								className="post-author-link"
								href={`/profile/${resume.user_id}`}
							>
								{posterLabel}
							</Link>
						)}
						<time dateTime={resume.created_at}>
							{formatDate(resume.created_at)}
						</time>
					</div>
					<div className="thread-header-actions">
						<span
							className={`badge ${isClosed ? "badge-closed" : "badge-open"}`}
						>
							{isClosed ? "Closed" : "Open for roasting"}
						</span>
						{isOwner ? (
							<div className="owner-actions">
								<Button
									disabled={isClosed}
									onClick={() => void closeResume()}
									type="button"
									variant="outline"
								>
									{isClosed ? "Closed" : "Close roasts"}
								</Button>
								<Button
									className="owner-delete-button"
									onClick={() => void deleteResume()}
									type="button"
									variant="destructive"
								>
									<Trash
										className="-ms-1 me-2 opacity-70"
										size={16}
										strokeWidth={2}
										aria-hidden="true"
									/>
									Delete submission
								</Button>
							</div>
						) : null}
					</div>
				</header>

				<h1>{resume.title}</h1>
				<div className="post-tags">
					<span className="badge role-badge">
						{getResumeRoleLabel(resume, resumeAuthorProfile)}
					</span>
					<span className="badge neutral-badge">
						{getResumeAffiliationLabel(resume, resumeAuthorProfile)}
					</span>
				</div>

				{signedUrl ? (
					<SecureResumePreview fileUrl={signedUrl} title={resume.title} />
				) : user ? (
					<div className="locked-file">
						<p>
							{signedUrlError
								? "We could not open this private resume file yet. If this is a different account, update the Supabase Storage read policy and retry."
								: "Opening the private resume PDF for your signed-in account."}
						</p>
						<button
							className="btn-primary"
							onClick={() => void openResumeFile()}
						>
							Retry opening PDF
						</button>
						{signedUrlError ? (
							<p className="form-message">{signedUrlError}</p>
						) : null}
					</div>
				) : (
					<div className="locked-file">
						<p>Sign in to open the private resume PDF.</p>
						<button
							className="btn-primary"
							onClick={goToLogin}
						>
							Sign in to continue
						</button>
					</div>
				)}
			</article>

			<section className="thread-discussion-panel" aria-label="Roast discussion">
					{isClosed || isOwner ? (
						<div className="closed-note">
							<h2>{isOwner ? "Owner view" : "Roasts closed"}</h2>
							<p>
								{isOwner
									? "You own this resume. You can reply for clarification, but you cannot mark roasts helpful."
									: "This thread is visible for learning, but no new roasts can be added."}
							</p>
							{message ? <p className="form-message">{message}</p> : null}
						</div>
					) : (
						<form
							className="roast-form thread-roast-form"
							onSubmit={handleRoastSubmit}
						>
							<textarea
								value={content}
								onChange={(event) => setContent(event.target.value)}
								placeholder="Be specific. What should they rewrite, reorder, quantify, or remove?"
								rows={4}
							/>
							<div className="roast-form-footer">
								<span>Roast the resume, not the person</span>
								<button className="btn-primary btn-brand" disabled={submitting}>
									{submitting
										? "Posting..."
										: user
											? "Submit roast"
											: "Sign in to roast"}
								</button>
							</div>
							{message ? <p className="form-message">{message}</p> : null}
						</form>
					)}

					<div className="thread-list-header">
						<h2>Roast thread</h2>
						<span>{visibleRoastCount} comments</span>
					</div>
					{!replySchemaReady ? (
						<p className="form-message">
							Run supabase/replies.sql in Supabase, then refresh to enable nested replies.
						</p>
					) : null}
					{!deleteSchemaReady ? (
						<p className="form-message">
							Run supabase/roast-deletes.sql in Supabase, then refresh to enable comment deletes.
						</p>
					) : null}

					<div className="roast-list">
					{threadRoasts.map((roast, index) => {
						const voted = votedRoastIds.has(roast.id);
						const disliked = dislikedRoastIds.has(roast.id);
						const authorProfile = authorProfiles[roast.author_id];
						const authorHandle = getAuthorHandle(
							roast.author_id,
							authorProfile,
						);
						const reactionBlockReason = getReactionBlockReason(
							user,
							resume,
							roast,
						);
						const reactionDisabled = Boolean(reactionBlockReason);
						const replyCount = Math.max(roast.reply_count ?? 0, roast.childCount);
						const isCollapsed = collapsedRoastIds.has(roast.id);
						const isDeleted = Boolean(roast.is_deleted);
						const isOwnRoast = user?.id === roast.author_id;
						const replyBlockReason = isClosed
								? "This resume is closed for new replies."
								: isDeleted
									? "Deleted roasts cannot receive new replies."
								: isOwnRoast
									? "You cannot reply to your own roast."
									: !replySchemaReady
										? "Run supabase/replies.sql to enable replies."
										: null;
						const canReply = !replyBlockReason;
						const roastStyle = {
							"--reply-depth": Math.min(roast.depth, 8),
							animationDelay: `${index * 40}ms`,
						} as CSSProperties;

						return (
							<article
								className={`thread-roast ${roast.depth ? "is-reply" : ""}${isDeleted ? " is-deleted" : ""}`}
								style={roastStyle}
								key={roast.id}
							>
								<div className="thread-roast-body">
									<header>
										{isDeleted ? (
											<span className="deleted-author-chip">Deleted roaster</span>
										) : (
											<Button
												asChild
												className="comment-author-chip py-0 ps-0"
												size="sm"
											>
												<Link href={`/profile/${roast.author_id}`}>
													<span className="me-0.5 flex aspect-square h-full p-1.5">
														<img
															className="h-auto w-full rounded-full"
															src={getAuthorAvatar(
																roast.author_id,
																authorProfile,
															)}
															alt=""
															width={24}
															height={24}
															aria-hidden="true"
														/>
													</span>
													{authorHandle}
												</Link>
											</Button>
										)}
										<time dateTime={roast.created_at}>
											&middot; {formatDate(roast.created_at)}
										</time>
										{!isDeleted && roast.helpful_votes > 5 ? (
											<span className="badge badge-open">Verified helpful</span>
										) : null}
									</header>
									<p className={isDeleted ? "deleted-roast-copy" : undefined}>
										{isDeleted
											? "This roast was deleted by its author."
											: roast.content}
									</p>
									<footer>
										{isDeleted ? null : (
											<div className="comment-reactions">
											<Button
												className="reaction-button py-0 pe-0"
												variant={voted ? "secondary" : "outline"}
												disabled={reactionDisabled}
												onClick={() => void reactToRoast(roast, "like")}
												type="button"
												aria-label={
													voted
														? "Remove like from this roast"
														: "Like this roast"
												}
												title={reactionBlockReason ?? undefined}
											>
												<ThumbsUp
													className="me-2 opacity-60"
													size={16}
													strokeWidth={2}
													aria-hidden="true"
												/>
												Like
												<span className="reaction-count">
													{roast.helpful_votes}
												</span>
											</Button>
											<Button
												className="reaction-button py-0 pe-0"
												variant={disliked ? "secondary" : "outline"}
												disabled={reactionDisabled}
												onClick={() => void reactToRoast(roast, "dislike")}
												type="button"
												aria-label={
													disliked
														? "Remove dislike from this roast"
														: "Dislike this roast"
												}
												title={reactionBlockReason ?? undefined}
											>
												<ThumbsDown
													className="me-2 opacity-60"
													size={16}
													strokeWidth={2}
													aria-hidden="true"
												/>
												Dislike
												<span className="reaction-count">
													{roast.dislike_count ?? 0}
												</span>
											</Button>
											</div>
										)}
										{isDeleted ? null : (
											<button
												disabled={!canReply}
												title={replyBlockReason ?? undefined}
												onClick={() => {
													if (!canReply) return;
													setReplyingToId((current) =>
														current === roast.id ? null : roast.id,
													);
													setReplyContent("");
												}}
												type="button"
											>
												Reply
											</button>
										)}
										{replyCount > 0 ? (
											<button
												className="reply-collapse-button"
												onClick={() => toggleRoastReplies(roast.id)}
												type="button"
											>
												{isCollapsed
													? `Show ${replyCount} ${replyCount === 1 ? "reply" : "replies"}`
													: "Hide replies"}
											</button>
										) : null}
										{!isDeleted && isOwnRoast ? (
											<button
												className="comment-delete-button"
												disabled={
													!deleteSchemaReady || deletingRoastId === roast.id
												}
												onClick={() => void requestDeleteRoast(roast)}
												title={
													deleteSchemaReady
														? undefined
														: "Run supabase/roast-deletes.sql to enable deletes."
												}
												type="button"
											>
												{deletingRoastId === roast.id ? "Deleting..." : "Delete"}
											</button>
										) : null}
										{isDeleted ? null : <button type="button">Report</button>}
									</footer>
									{!isDeleted && replyingToId === roast.id ? (
										<form
											className="inline-reply-form"
											onSubmit={(event) => handleReplySubmit(event, roast)}
										>
											<textarea
												autoFocus
												onChange={(event) => setReplyContent(event.target.value)}
												placeholder={`Reply to ${authorHandle}`}
												rows={3}
												value={replyContent}
											/>
											<div>
												<button
													className="reply-cancel-button"
													onClick={() => {
														setReplyingToId(null);
														setReplyContent("");
													}}
													type="button"
												>
													Cancel
												</button>
												<button
													className="btn-primary btn-brand reply-submit-button"
													disabled={submittingReplyId === roast.id}
													type="submit"
												>
													{submittingReplyId === roast.id ? "Posting..." : "Post reply"}
												</button>
											</div>
										</form>
									) : null}
								</div>
							</article>
						);
					})}
					{!threadRoasts.length ? (
						<p className="muted-text">
							No roasts yet. First useful feedback wins the room.
						</p>
					) : null}
					</div>
				</section>
			</div>
			<aside className="thread-context-panel" aria-label="Resume context">
				<div className="thread-context-grid" aria-label="Resume context">
					<ResumeContextCard
						eyebrow="Ask"
						title="What they want help with"
						content={postDescription}
						emptyMessage="No post description was attached to this older post."
					/>
					<ResumeContextCard
						eyebrow="JD"
						title="Job description"
						content={jobDescription}
						emptyMessage="No JD was attached to this older post."
					/>
				</div>
			</aside>
		</section>
		<AlertDialog
			open={Boolean(deleteTargetRoast)}
			onOpenChange={(open) => {
				if (!open && !deletingRoastId) {
					setDeleteTargetRoast(null);
				}
			}}
		>
			<AlertDialogContent size="sm">
				<AlertDialogHeader>
					<AlertDialogTitle>
						{deleteTargetIsReply ? "Delete reply?" : "Delete roast?"}
					</AlertDialogTitle>
					<AlertDialogDescription>
						{deleteTargetIsReply
							? "This reply will be removed from the thread. The rest of the conversation will stay visible."
							: "This roast will be removed. Replies from other users will stay visible so the thread still makes sense."}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={Boolean(deletingRoastId)}>
						Cancel
					</AlertDialogCancel>
					<AlertDialogAction
						disabled={Boolean(deletingRoastId)}
						onClick={(event) => {
							event.preventDefault();
							void deleteRoast(deleteTargetRoast);
						}}
					>
						{deletingRoastId
							? "Deleting..."
							: deleteTargetIsReply
								? "Delete reply"
								: "Delete roast"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
		</>
	);
}
