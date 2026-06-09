"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
	Bold,
	Braces,
	ChevronLeft,
	ChevronRight,
	Code,
	Heading2,
	ImageIcon,
	Images,
	Italic,
	Link,
	List,
	ListOrdered,
	MoreHorizontal,
	Pencil,
	Plus,
	Quote,
	Send,
	Strikethrough,
	Table,
	Trash2,
	X,
} from "lucide-react";
import { announceRouteTransition } from "@/components/RouteTransitionLoader";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	COMMUNITY_POST_TYPE_LABELS,
	COMMUNITY_POST_TYPES,
	type CommunityPostType,
} from "@/lib/community";
import {
	COMMUNITY_POST_IMAGE_MAX_COUNT,
	getCommunityPostImageClientIssue,
} from "@/lib/community-media-validation";
import {
	COMMUNITY_POST_BODY_MAX_LENGTH,
	COMMUNITY_POLL_DURATION_DAYS,
	COMMUNITY_POLL_OPTION_MAX_COUNT,
	COMMUNITY_POST_TITLE_MAX_LENGTH,
	COMMUNITY_POST_TITLE_MIN_LENGTH,
	getCommunityPollIssue,
	getCommunityPostIssue,
	getDefaultCommunityPostType,
	normalizeCommunityPollOptions,
} from "@/lib/community-validation";
import { supabase } from "@/lib/supabase/client";

type CommunityTopic = {
	description: string;
	id: string;
	name: string;
	slug: string;
};

type SubmitCommunityPostResponse = {
	href?: string;
	id?: string;
	message?: string;
	status?: "active" | "held";
};

type SelectedPostImage = {
	file: File;
	id: string;
	previewUrl: string;
};

type ComposerTab = "text" | "media" | "link" | "poll";

type ComposerDraft = {
	activeTab: ComposerTab;
	body: string;
	id: string;
	pollDurationDays: string;
	pollOptions: string[];
	postType: CommunityPostType;
	title: string;
	topicId: string;
	updatedAt: string;
};

const composerTabs: Array<{
	disabled?: boolean;
	id: ComposerTab;
	label: string;
}> = [
	{ id: "text", label: "Text" },
	{ id: "media", label: "Images & Video" },
	{ disabled: true, id: "link", label: "Link" },
	{ id: "poll", label: "Poll" },
];

const DRAFT_STORAGE_KEY = "linted.community.post-drafts.v1";
const DEFAULT_POLL_OPTIONS = ["", ""];

function readStoredDrafts() {
	if (typeof window === "undefined") return [];

	try {
		const rawDrafts = window.localStorage.getItem(DRAFT_STORAGE_KEY);
		if (!rawDrafts) return [];
		const parsedDrafts = JSON.parse(rawDrafts);
		if (!Array.isArray(parsedDrafts)) return [];

		return parsedDrafts.filter((draft): draft is ComposerDraft => {
			return (
				typeof draft?.id === "string" &&
				["text", "media", "link", "poll"].includes(draft.activeTab) &&
				typeof draft.title === "string" &&
				typeof draft.body === "string" &&
				COMMUNITY_POST_TYPES.includes(draft.postType) &&
				Array.isArray(draft.pollOptions)
			);
		});
	} catch {
		return [];
	}
}

function writeStoredDrafts(drafts: ComposerDraft[]) {
	if (typeof window === "undefined") return;
	window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts));
}

export default function CommunityPostComposer() {
	const router = useRouter();
	const bodyInputRef = useRef<HTMLTextAreaElement | null>(null);
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const imagesRef = useRef<SelectedPostImage[]>([]);
	const [activeTab, setActiveTab] = useState<ComposerTab>("text");
	const [activeImageIndex, setActiveImageIndex] = useState(0);
	const [activeDraftId, setActiveDraftId] = useState("");
	const [body, setBody] = useState("");
	const [drafts, setDrafts] = useState<ComposerDraft[]>([]);
	const [draftsOpen, setDraftsOpen] = useState(false);
	const [galleryOpen, setGalleryOpen] = useState(false);
	const [images, setImages] = useState<SelectedPostImage[]>([]);
	const [message, setMessage] = useState("");
	const [pollDurationDays, setPollDurationDays] = useState("7");
	const [pollOptions, setPollOptions] = useState<string[]>(DEFAULT_POLL_OPTIONS);
	const [postType, setPostType] = useState<CommunityPostType>(
		getDefaultCommunityPostType(),
	);
	const [submitting, setSubmitting] = useState(false);
	const [success, setSuccess] = useState(false);
	const [title, setTitle] = useState("");
	const [topicId, setTopicId] = useState("");
	const [topics, setTopics] = useState<CommunityTopic[]>([]);
	const [topicsLoading, setTopicsLoading] = useState(true);

	useEffect(() => {
		setDrafts(readStoredDrafts());
	}, []);

	useEffect(() => {
		let cancelled = false;

		async function loadTopics() {
			const { data, error } = await supabase
				.from("community_topics")
				.select("id,slug,name,description")
				.order("display_order", { ascending: true })
				.order("name", { ascending: true });

			if (cancelled) return;

			if (error) {
				setMessage("Community topics are not available yet.");
				setTopicsLoading(false);
				return;
			}

			const nextTopics = (data ?? []) as CommunityTopic[];
			setTopics(nextTopics);
			setTopicId((current) => current || nextTopics[0]?.id || "");
			setTopicsLoading(false);
		}

		void loadTopics();

		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		imagesRef.current = images;
	}, [images]);

	useEffect(() => {
		setActiveImageIndex((current) => {
			if (!images.length) return 0;
			return Math.min(current, images.length - 1);
		});
		if (!images.length) setGalleryOpen(false);
	}, [images.length]);

	useEffect(() => {
		return () => {
			for (const image of imagesRef.current) {
				URL.revokeObjectURL(image.previewUrl);
			}
		};
	}, []);

	useEffect(() => {
		if (!galleryOpen) return;

		function closeOnEscape(event: KeyboardEvent) {
			if (event.key === "Escape") setGalleryOpen(false);
		}

		window.addEventListener("keydown", closeOnEscape);
		return () => window.removeEventListener("keydown", closeOnEscape);
	}, [galleryOpen]);

	const trimmedTitle = title.trim();
	const trimmedBody = body.trim();
	const normalizedPollOptions = useMemo(
		() => normalizeCommunityPollOptions(pollOptions).filter(Boolean),
		[pollOptions],
	);
	const pollIssue =
		activeTab === "poll" ? getCommunityPollIssue(pollOptions) : "";
	const titleRemaining = Math.max(
		COMMUNITY_POST_TITLE_MIN_LENGTH - trimmedTitle.length,
		0,
	);
	const activeImage = images[activeImageIndex] ?? images[0] ?? null;
	const canAddImages =
		!submitting && images.length < COMMUNITY_POST_IMAGE_MAX_COUNT;
	const showBodyEditor = activeTab === "text";
	const showBodyCounter = showBodyEditor || trimmedBody.length > 0;
	const hasDraftContent =
		Boolean(trimmedTitle) ||
		Boolean(trimmedBody) ||
		normalizedPollOptions.length > 0;
	const submitIssue = getCommunityPostIssue({
		body,
		postType,
		tags: [],
		title,
		topicId,
	});
	const imageIssue =
		activeTab === "poll" && images.length
			? "Remove images before posting a poll."
			: images.length > COMMUNITY_POST_IMAGE_MAX_COUNT
				? `Attach at most ${COMMUNITY_POST_IMAGE_MAX_COUNT} images.`
				: "";
	const formIssue = submitIssue || imageIssue || pollIssue;

	function showError(errorMessage: string) {
		setMessage(errorMessage);
		toast.error(errorMessage);
	}

	function persistDrafts(nextDrafts: ComposerDraft[]) {
		setDrafts(nextDrafts);
		writeStoredDrafts(nextDrafts);
	}

	function saveDraft() {
		if (!hasDraftContent) {
			showError("Write something before saving a draft.");
			return;
		}

		const now = new Date().toISOString();
		const draft: ComposerDraft = {
			activeTab,
			body,
			id: activeDraftId || crypto.randomUUID(),
			pollDurationDays,
			pollOptions,
			postType,
			title,
			topicId,
			updatedAt: now,
		};
		const nextDrafts = [
			draft,
			...drafts.filter((currentDraft) => currentDraft.id !== draft.id),
		].slice(0, 8);

		persistDrafts(nextDrafts);
		setActiveDraftId(draft.id);
		toast.success(images.length ? "Draft saved without images." : "Draft saved.");
	}

	function loadDraft(draft: ComposerDraft) {
		setActiveDraftId(draft.id);
		setActiveTab(draft.activeTab === "poll" ? "poll" : "text");
		setBody(draft.body);
		setPollDurationDays(draft.pollDurationDays || "7");
		setPollOptions(
			draft.pollOptions?.length ? draft.pollOptions : DEFAULT_POLL_OPTIONS,
		);
		setPostType(draft.postType);
		setTitle(draft.title);
		setTopicId((current) => draft.topicId || current);
		setDraftsOpen(false);
		toast.success("Draft loaded.");
	}

	function deleteDraft(draftId: string) {
		const nextDrafts = drafts.filter((draft) => draft.id !== draftId);
		persistDrafts(nextDrafts);
		if (activeDraftId === draftId) setActiveDraftId("");
		if (!nextDrafts.length) setDraftsOpen(false);
	}

	function updatePollOption(index: number, value: string) {
		setPollOptions((current) =>
			current.map((option, optionIndex) =>
				optionIndex === index ? value : option,
			),
		);
	}

	function addPollOption() {
		if (pollOptions.length >= COMMUNITY_POLL_OPTION_MAX_COUNT) return;
		setPollOptions((current) => [...current, ""]);
	}

	function removePollOption(index: number) {
		if (pollOptions.length <= 2) return;
		setPollOptions((current) =>
			current.filter((_, optionIndex) => optionIndex !== index),
		);
	}

	function addImages(fileList: FileList | null) {
		if (!fileList?.length) return;

		const availableSlots = COMMUNITY_POST_IMAGE_MAX_COUNT - images.length;
		if (availableSlots <= 0) {
			showError(`Attach at most ${COMMUNITY_POST_IMAGE_MAX_COUNT} images.`);
			return;
		}

		const nextImages: SelectedPostImage[] = [];

		for (const file of Array.from(fileList).slice(0, availableSlots)) {
			const issue = getCommunityPostImageClientIssue({
				name: file.name,
				size: file.size,
				type: file.type,
			});

			if (issue) {
				showError(issue);
				continue;
			}

			nextImages.push({
				file,
				id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
				previewUrl: URL.createObjectURL(file),
			});
		}

		if (fileList.length > availableSlots) {
			showError(`Attach at most ${COMMUNITY_POST_IMAGE_MAX_COUNT} images.`);
		}

		if (nextImages.length) {
			const firstNewImageIndex = images.length;
			setImages((current) => [...current, ...nextImages]);
			setActiveImageIndex(firstNewImageIndex);
			setActiveTab("media");
		}
	}

	function removeImage(imageId: string) {
		setImages((current) => {
			const removedIndex = current.findIndex((image) => image.id === imageId);
			const removed = removedIndex >= 0 ? current[removedIndex] : null;
			if (removed) URL.revokeObjectURL(removed.previewUrl);
			const nextImages = current.filter((image) => image.id !== imageId);

			setActiveImageIndex((currentIndex) => {
				if (!nextImages.length) return 0;
				if (currentIndex > removedIndex) return currentIndex - 1;
				return Math.min(currentIndex, nextImages.length - 1);
			});

			return nextImages;
		});
	}

	function moveImage(imageId: string, direction: -1 | 1) {
		setImages((current) => {
			const fromIndex = current.findIndex((image) => image.id === imageId);
			const toIndex = fromIndex + direction;

			if (fromIndex < 0 || toIndex < 0 || toIndex >= current.length) {
				return current;
			}

			const nextImages = [...current];
			[nextImages[fromIndex], nextImages[toIndex]] = [
				nextImages[toIndex],
				nextImages[fromIndex],
			];
			setActiveImageIndex(toIndex);
			return nextImages;
		});
	}

	function showNextImage(direction: -1 | 1) {
		if (images.length < 2) return;

		setActiveImageIndex((current) => {
			const nextIndex = current + direction;
			if (nextIndex < 0) return images.length - 1;
			if (nextIndex >= images.length) return 0;
			return nextIndex;
		});
	}

	function insertBodyMarkup(prefix: string, suffix = "", fallback = "") {
		const textarea = bodyInputRef.current;
		const start = textarea?.selectionStart ?? body.length;
		const end = textarea?.selectionEnd ?? body.length;
		const selectedText = body.slice(start, end) || fallback;
		const nextBody =
			body.slice(0, start) + prefix + selectedText + suffix + body.slice(end);
		const nextCursor = start + prefix.length + selectedText.length + suffix.length;

		setBody(nextBody);
		window.requestAnimationFrame(() => {
			textarea?.focus();
			textarea?.setSelectionRange(nextCursor, nextCursor);
		});
	}

	function addBodyLine(prefix: string) {
		const textarea = bodyInputRef.current;
		const start = textarea?.selectionStart ?? body.length;
		const before = body.slice(0, start);
		const needsBreak = before.length > 0 && !before.endsWith("\n");
		const nextBody = `${before}${needsBreak ? "\n" : ""}${prefix}${body.slice(start)}`;
		const nextCursor = before.length + (needsBreak ? 1 : 0) + prefix.length;

		setBody(nextBody);
		window.requestAnimationFrame(() => {
			textarea?.focus();
			textarea?.setSelectionRange(nextCursor, nextCursor);
		});
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setMessage("");

		if (formIssue) {
			showError(formIssue);
			return;
		}

		setSubmitting(true);

		const session = await supabase.auth.getSession();
		const accessToken = session.data.session?.access_token;
		if (!accessToken) {
			setSubmitting(false);
			showError("Your session expired. Sign in again to continue.");
			return;
		}

		const formData = new FormData();
		formData.set("body", trimmedBody);
		formData.set("postType", postType);
		formData.set("tags", JSON.stringify([]));
		formData.set("title", trimmedTitle);
		formData.set("topicId", topicId);
		if (activeTab === "poll") {
			formData.set("format", "poll");
			formData.set("pollDurationDays", pollDurationDays);
			for (const option of normalizedPollOptions) {
				formData.append("pollOptions", option);
			}
		} else {
			formData.set("format", images.length ? "media" : "text");
			for (const image of images) {
				formData.append("images", image.file);
			}
		}

		const response = await fetch("/api/community/posts/submit", {
			body: formData,
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
			method: "POST",
		});

		const result = (await response.json().catch(() => null)) as
			| SubmitCommunityPostResponse
			| null;

		setSubmitting(false);

		if (!response.ok || !result?.href) {
			showError(result?.message ?? "We could not create this post.");
			return;
		}

		setSuccess(true);
		if (activeDraftId) {
			persistDrafts(drafts.filter((draft) => draft.id !== activeDraftId));
			setActiveDraftId("");
		}
		toast.success(
			result.status === "held" ? "Post sent for moderation." : "Post created.",
		);
		announceRouteTransition(result.href);
		router.push(result.href);
	}

	return (
		<form
			className="community-composer reddit-composer"
			noValidate
			onSubmit={handleSubmit}
		>
			<header className="reddit-composer-header">
				<h1>Create post</h1>
				<button
					className="reddit-drafts-button"
					onClick={() => setDraftsOpen(true)}
					type="button"
				>
					Drafts{drafts.length ? ` (${drafts.length})` : ""}
				</button>
				<div className="reddit-type-select">
					<Select
						value={postType}
						onValueChange={(value) =>
							setPostType(value as CommunityPostType)
						}
					>
						<SelectTrigger
							aria-label="Post type"
							className="reddit-select-trigger"
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent className="reddit-select-content">
							<SelectGroup>
								{COMMUNITY_POST_TYPES.map((type) => (
									<SelectItem
										className="reddit-select-item"
										key={type}
										value={type}
									>
										{COMMUNITY_POST_TYPE_LABELS[type]}
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>
				</div>
			</header>

			<nav aria-label="Post format" className="reddit-composer-tabs">
				{composerTabs.map((tab) => (
					<button
						aria-pressed={activeTab === tab.id}
						className={activeTab === tab.id ? "is-active" : ""}
						disabled={tab.disabled}
						key={tab.id}
						onClick={() => setActiveTab(tab.id)}
						type="button"
					>
						{tab.label}
					</button>
				))}
			</nav>

			<div className="reddit-title-wrap">
				<input
					aria-describedby="community-title-help"
					aria-invalid={trimmedTitle.length > 0 && titleRemaining > 0}
					maxLength={COMMUNITY_POST_TITLE_MAX_LENGTH}
					onChange={(event) => setTitle(event.target.value)}
					placeholder="Title*"
					required
					value={title}
				/>
				<small id="community-title-help">
					{trimmedTitle.length}/{COMMUNITY_POST_TITLE_MAX_LENGTH}
				</small>
			</div>

			<div className="reddit-meta-row">
				<div className="reddit-topic-select">
					<Select
						disabled={topicsLoading || topics.length === 0}
						onValueChange={setTopicId}
						value={topicId}
					>
						<SelectTrigger
							aria-label="Community topic"
							className="reddit-topic-trigger"
						>
							<SelectValue placeholder={topicsLoading ? "Loading" : "Topic"} />
						</SelectTrigger>
						<SelectContent className="reddit-select-content">
							<SelectGroup>
								{topics.map((topic) => (
									<SelectItem
										className="reddit-select-item"
										key={topic.id}
										value={topic.id}
									>
										{topic.name}
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>
				</div>
			</div>

			{showBodyEditor ? (
				<div className="reddit-editor">
					<div className="reddit-editor-toolbar" aria-label="Body formatting">
						<button
							onClick={() => insertBodyMarkup("**", "**", "bold")}
							title="Bold"
							type="button"
						>
							<Bold aria-hidden="true" />
						</button>
						<button
							onClick={() => insertBodyMarkup("_", "_", "italic")}
							title="Italic"
							type="button"
						>
							<Italic aria-hidden="true" />
						</button>
						<button
							onClick={() => insertBodyMarkup("~~", "~~", "strike")}
							title="Strike"
							type="button"
						>
							<Strikethrough aria-hidden="true" />
						</button>
						<button
							onClick={() => addBodyLine("## ")}
							title="Heading"
							type="button"
						>
							<Heading2 aria-hidden="true" />
						</button>
						<button
							onClick={() => insertBodyMarkup("[", "](https://)", "link")}
							title="Link"
							type="button"
						>
							<Link aria-hidden="true" />
						</button>
						<button
							onClick={() => {
								setActiveTab("media");
								fileInputRef.current?.click();
							}}
							title="Image"
							type="button"
						>
							<ImageIcon aria-hidden="true" />
						</button>
						<button
							onClick={() => addBodyLine("- ")}
							title="Bulleted list"
							type="button"
						>
							<List aria-hidden="true" />
						</button>
						<button
							onClick={() => addBodyLine("1. ")}
							title="Numbered list"
							type="button"
						>
							<ListOrdered aria-hidden="true" />
						</button>
						<button
							onClick={() => addBodyLine("> ")}
							title="Quote"
							type="button"
						>
							<Quote aria-hidden="true" />
						</button>
						<button
							onClick={() => insertBodyMarkup("`", "`", "code")}
							title="Inline code"
							type="button"
						>
							<Code aria-hidden="true" />
						</button>
						<button
							onClick={() => insertBodyMarkup("```\n", "\n```", "code")}
							title="Code block"
							type="button"
						>
							<Braces aria-hidden="true" />
						</button>
						<button
							onClick={() =>
								addBodyLine("| Column | Column |\n| --- | --- |\n|  |  |")
							}
							title="Table"
							type="button"
						>
							<Table aria-hidden="true" />
						</button>
						<button disabled title="More" type="button">
							<MoreHorizontal aria-hidden="true" />
						</button>
					</div>
					<textarea
						aria-describedby="community-body-help"
						maxLength={COMMUNITY_POST_BODY_MAX_LENGTH}
						onChange={(event) => setBody(event.target.value)}
						placeholder="Body text (optional)"
						ref={bodyInputRef}
						value={body}
					/>
				</div>
			) : null}

			{activeTab === "poll" ? (
				<section className="reddit-poll-panel" aria-label="Poll options">
					<div className="reddit-poll-options">
						{pollOptions.map((option, index) => (
							<label className="reddit-poll-option" key={`poll-option-${index}`}>
								<span>{index + 1}</span>
								<input
									aria-label={`Poll option ${index + 1}`}
									maxLength={120}
									onChange={(event) =>
										updatePollOption(index, event.target.value)
									}
									placeholder={`Option ${index + 1}`}
									value={option}
								/>
								<button
									aria-label={`Remove option ${index + 1}`}
									disabled={pollOptions.length <= 2}
									onClick={() => removePollOption(index)}
									type="button"
								>
									<X aria-hidden="true" />
								</button>
							</label>
						))}
					</div>

					<div className="reddit-poll-footer">
						<button
							className="reddit-secondary-button"
							disabled={pollOptions.length >= COMMUNITY_POLL_OPTION_MAX_COUNT}
							onClick={addPollOption}
							type="button"
						>
							<Plus aria-hidden="true" />
							Add option
						</button>
						<div className="reddit-poll-duration">
							<span>Duration</span>
							<Select
								value={pollDurationDays}
								onValueChange={setPollDurationDays}
							>
								<SelectTrigger
									aria-label="Poll duration"
									className="reddit-topic-trigger"
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent className="reddit-select-content">
									<SelectGroup>
										{COMMUNITY_POLL_DURATION_DAYS.map((days) => (
											<SelectItem
												className="reddit-select-item"
												key={days}
												value={String(days)}
											>
												{days === 1 ? "1 day" : `${days} days`}
											</SelectItem>
										))}
									</SelectGroup>
								</SelectContent>
							</Select>
						</div>
					</div>
				</section>
			) : null}

			<input
				accept="image/png,image/jpeg,image/webp"
				aria-hidden="true"
				className="reddit-hidden-file-input"
				disabled={submitting || images.length >= COMMUNITY_POST_IMAGE_MAX_COUNT}
				multiple
				onChange={(event) => {
					addImages(event.target.files);
					event.currentTarget.value = "";
				}}
				ref={fileInputRef}
				tabIndex={-1}
				type="file"
			/>

			{activeTab === "media" || images.length ? (
				<section
					aria-label="Post images"
					className={`reddit-media-panel ${
						images.length ? "has-images" : "is-empty"
					}`}
				>
					{activeImage ? (
						<div className="community-image-gallery">
							<img
								alt=""
								aria-hidden="true"
								className="community-image-gallery-backdrop"
								src={activeImage.previewUrl}
							/>
							<img
								alt={activeImage.file.name}
								className="community-image-gallery-image"
								src={activeImage.previewUrl}
							/>

							<div className="community-gallery-top-actions">
								<div>
									<button
										className="community-gallery-pill"
										disabled={!canAddImages}
										onClick={() => fileInputRef.current?.click()}
										type="button"
									>
										<Plus aria-hidden="true" />
										Add
									</button>
									<button
										className="community-gallery-pill"
										onClick={() => setGalleryOpen(true)}
										type="button"
									>
										<Pencil aria-hidden="true" />
										Edit All
									</button>
								</div>
								<button
									aria-label={`Remove ${activeImage.file.name}`}
									className="community-gallery-icon-button"
									disabled={submitting}
									onClick={() => removeImage(activeImage.id)}
									type="button"
								>
									<Trash2 aria-hidden="true" />
								</button>
							</div>

							{images.length > 1 ? (
								<>
									<button
										aria-label="Previous image"
										className="community-gallery-arrow is-previous"
										onClick={() => showNextImage(-1)}
										type="button"
									>
										<ChevronLeft aria-hidden="true" />
									</button>
									<button
										aria-label="Next image"
										className="community-gallery-arrow is-next"
										onClick={() => showNextImage(1)}
										type="button"
									>
										<ChevronRight aria-hidden="true" />
									</button>
									<div className="community-gallery-dots" aria-label="Image order">
										{images.map((image, index) => (
											<button
												aria-label={`Show image ${index + 1}`}
												className={index === activeImageIndex ? "is-active" : ""}
												key={image.id}
												onClick={() => setActiveImageIndex(index)}
												type="button"
											/>
										))}
									</div>
								</>
							) : null}
						</div>
					) : (
						<button
							className="community-image-empty-state"
							disabled={!canAddImages}
							onClick={() => fileInputRef.current?.click()}
							type="button"
						>
							<ImageIcon aria-hidden="true" />
							<span>Add images</span>
							<small>0/{COMMUNITY_POST_IMAGE_MAX_COUNT}</small>
						</button>
					)}
				</section>
			) : null}

			<footer className="reddit-composer-actions">
				{showBodyCounter ? (
					<span id="community-body-help">
						{trimmedBody.length}/{COMMUNITY_POST_BODY_MAX_LENGTH}
					</span>
				) : null}
				<button
					className="reddit-save-draft"
					disabled={!hasDraftContent || submitting}
					onClick={saveDraft}
					type="button"
				>
					Save Draft
				</button>
				<button
					className="reddit-post-button"
					disabled={submitting || success || topicsLoading || Boolean(formIssue)}
					title={formIssue || undefined}
					type="submit"
				>
					{submitting ? (
						<>
							<span className="button-spinner" />
							Posting...
						</>
					) : (
						<>
							<Send aria-hidden="true" />
							Post
						</>
					)}
				</button>
			</footer>

			{message ? <p className="form-message">{message}</p> : null}

			{draftsOpen ? (
				<div
					className="community-gallery-dialog-backdrop"
					onMouseDown={(event) => {
						if (event.target === event.currentTarget) setDraftsOpen(false);
					}}
				>
					<section
						aria-labelledby="community-drafts-dialog-title"
						aria-modal="true"
						className="community-gallery-dialog community-drafts-dialog"
						onMouseDown={(event) => event.stopPropagation()}
						role="dialog"
					>
						<header>
							<h2 id="community-drafts-dialog-title">Drafts</h2>
							<button
								aria-label="Close drafts"
								className="community-gallery-dialog-close"
								onClick={() => setDraftsOpen(false)}
								type="button"
							>
								<X aria-hidden="true" />
							</button>
						</header>

						{drafts.length ? (
							<div className="community-draft-list">
								{drafts.map((draft) => (
									<article key={draft.id}>
										<div>
											<strong>{draft.title || "Untitled draft"}</strong>
											<span>
												{COMMUNITY_POST_TYPE_LABELS[draft.postType]}{" - "}
												{draft.activeTab === "poll" ? "Poll" : "Post"}{" - "}
												{new Intl.DateTimeFormat(undefined, {
													dateStyle: "medium",
													timeStyle: "short",
												}).format(new Date(draft.updatedAt))}
											</span>
										</div>
										<div>
											<button
												className="community-gallery-back"
												onClick={() => loadDraft(draft)}
												type="button"
											>
												Load
											</button>
											<button
												aria-label={`Delete draft ${draft.title || "Untitled draft"}`}
												className="community-gallery-dialog-close"
												onClick={() => deleteDraft(draft.id)}
												type="button"
											>
												<Trash2 aria-hidden="true" />
											</button>
										</div>
									</article>
								))}
							</div>
						) : (
							<p className="community-draft-empty">No drafts yet.</p>
						)}
					</section>
				</div>
			) : null}

			{galleryOpen && images.length ? (
				<div
					className="community-gallery-dialog-backdrop"
					onMouseDown={(event) => {
						if (event.target === event.currentTarget) setGalleryOpen(false);
					}}
				>
					<section
						aria-labelledby="community-gallery-dialog-title"
						aria-modal="true"
						className="community-gallery-dialog"
						onMouseDown={(event) => event.stopPropagation()}
						role="dialog"
					>
						<header>
							<h2 id="community-gallery-dialog-title">Edit gallery</h2>
							<button
								aria-label="Close edit gallery"
								className="community-gallery-dialog-close"
								onClick={() => setGalleryOpen(false)}
								type="button"
							>
								<X aria-hidden="true" />
							</button>
						</header>

						<div className="community-gallery-editor-grid">
							{images.map((image, index) => (
								<figure
									className={index === activeImageIndex ? "is-selected" : ""}
									key={image.id}
								>
									<button
										aria-label={`Preview ${image.file.name}`}
										className="community-gallery-editor-preview"
										onClick={() => setActiveImageIndex(index)}
										type="button"
									>
										<img alt="" src={image.previewUrl} />
									</button>
									<figcaption>{image.file.name}</figcaption>
									<div className="community-gallery-editor-actions">
										<button
											aria-label={`Move ${image.file.name} left`}
											disabled={index === 0}
											onClick={() => moveImage(image.id, -1)}
											type="button"
										>
											<ChevronLeft aria-hidden="true" />
										</button>
										<button
											aria-label={`Move ${image.file.name} right`}
											disabled={index === images.length - 1}
											onClick={() => moveImage(image.id, 1)}
											type="button"
										>
											<ChevronRight aria-hidden="true" />
										</button>
										<button
											aria-label={`Remove ${image.file.name}`}
											disabled={submitting}
											onClick={() => removeImage(image.id)}
											type="button"
										>
											<Trash2 aria-hidden="true" />
										</button>
									</div>
								</figure>
							))}
						</div>

						<footer>
							<button
								className="community-gallery-add-more"
								disabled={!canAddImages}
								onClick={() => fileInputRef.current?.click()}
								type="button"
							>
								<Images aria-hidden="true" />
								Add more photos
							</button>
							<div>
								<button
									className="community-gallery-back"
									onClick={() => setGalleryOpen(false)}
									type="button"
								>
									Back
								</button>
								<button
									className="community-gallery-save"
									onClick={() => setGalleryOpen(false)}
									type="button"
								>
									Save
								</button>
							</div>
						</footer>
					</section>
				</div>
			) : null}
		</form>
	);
}
