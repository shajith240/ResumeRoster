import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { areCommunityPostsEnabled } from "@/lib/community";
import {
	COMMUNITY_POST_IMAGE_MAX_COUNT,
	detectCommunityPostImageMimeType,
	getCommunityPostImageExtension,
	getCommunityPostImageUploadIssue,
	type CommunityPostImageMimeType,
} from "@/lib/community-media-validation";
import {
	cleanCommunityText,
	COMMUNITY_POST_BODY_MAX_LENGTH,
	getCommunityPollIssue,
	getCommunityPostIssue,
	isCommunityPollDurationDays,
	normalizeCommunityPollOptions,
	parseCommunityTags,
} from "@/lib/community-validation";
import { replaceCommunityInlineImageUrls } from "@/lib/community-markdown";
import { enforceApiRateLimit } from "@/lib/server/rate-limit";
import { enforceUploadSecurity } from "@/lib/server/upload-security";
import type { CommunityPostStatus } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CommunityPostSubmitBody = {
	body?: unknown;
	format?: unknown;
	imageIds?: unknown;
	imagePlacements?: unknown;
	pollDurationDays?: unknown;
	pollOptions?: unknown;
	postType?: unknown;
	tags?: unknown;
	title?: unknown;
	topicId?: unknown;
};

type CommunityPostSubmitPayload = Required<CommunityPostSubmitBody> & {
	files: File[];
};

type ImagePlacement = "gallery" | "inline";

type PostImageInput = {
	clientId: string;
	file: File;
	placement: ImagePlacement;
};

type UploadedPostAttachment = {
	alt_text: string;
	clientId: string;
	file_size: number;
	placement: ImagePlacement;
	mime_type: CommunityPostImageMimeType;
	storage_path: string;
	title: string;
};

type SubmitCommunityPostResult = {
	id?: string;
	status?: CommunityPostStatus;
};

type SubmitFormat = "media" | "poll" | "text";

function jsonResponse(message: string, status = 400) {
	return NextResponse.json({ message }, { status });
}

function getBearerToken(request: Request) {
	const authorization = request.headers.get("authorization") ?? "";
	const [scheme, token] = authorization.split(/\s+/);
	return /^bearer$/i.test(scheme) && token ? token : "";
}

async function readJsonBody(request: Request) {
	try {
		return (await request.json()) as CommunityPostSubmitBody;
	} catch {
		return null;
	}
}

function readTagsFromString(value: string): string[] {
	const trimmed = value.trim();
	if (!trimmed) return [];

	if (trimmed.startsWith("[")) {
		try {
			const parsed = JSON.parse(trimmed) as unknown;
			if (Array.isArray(parsed)) {
				return readTagList(parsed);
			}
		} catch {
			return parseCommunityTags(value);
		}
	}

	return parseCommunityTags(value);
}

function readTagList(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value
			.filter((tag): tag is string => typeof tag === "string")
			.map(cleanCommunityText)
			.filter(Boolean);
	}

	return typeof value === "string" ? readTagsFromString(value) : [];
}

function readStringList(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value.filter((item): item is string => typeof item === "string");
	}

	return typeof value === "string" ? [value] : [];
}

function readSubmitFormat(value: unknown): SubmitFormat {
	return value === "poll" || value === "media" ? value : "text";
}

function readImagePlacement(value: unknown): ImagePlacement {
	return value === "inline" ? "inline" : "gallery";
}

async function readSubmitPayload(request: Request) {
	const contentType = request.headers.get("content-type") ?? "";

	if (/multipart\/form-data/i.test(contentType)) {
		const formData = await request.formData().catch(() => null);
		if (!formData) return null;

		return {
			body: formData.get("body"),
			files: formData
				.getAll("images")
				.filter(
					(value): value is File =>
						value instanceof File && Boolean(value.name.trim()) && value.size > 0,
				),
			format: formData.get("format"),
			imageIds: formData.getAll("imageIds"),
			imagePlacements: formData.getAll("imagePlacements"),
			pollDurationDays: formData.get("pollDurationDays"),
			pollOptions: formData.getAll("pollOptions"),
			postType: formData.get("postType"),
			tags:
				formData.getAll("tags").length > 1
					? formData.getAll("tags")
					: formData.get("tags"),
			title: formData.get("title"),
			topicId: formData.get("topicId"),
		} satisfies CommunityPostSubmitPayload;
	}

	const body = await readJsonBody(request);
	if (!body) return null;

	return {
		body: body.body,
		files: [],
		format: body.format,
		imageIds: body.imageIds,
		imagePlacements: body.imagePlacements,
		pollDurationDays: body.pollDurationDays,
		pollOptions: body.pollOptions,
		postType: body.postType,
		tags: body.tags,
		title: body.title,
		topicId: body.topicId,
	} satisfies CommunityPostSubmitPayload;
}

function getPublicRpcError(message: string) {
	if (/feature|enabled/i.test(message)) return "Community posting is not enabled.";
	if (/attachment|image/i.test(message)) return "Check the post images and try again.";
	if (/topic/i.test(message)) return "Choose an active topic.";
	if (/post type/i.test(message)) return "Choose a valid post type.";
	if (/title/i.test(message)) return "Keep the title between 8 and 300 characters.";
	if (/body/i.test(message)) return "Keep the post body under 12000 characters.";
	if (/poll|option|duration/i.test(message)) return "Check the poll options and try again.";
	if (/tag/i.test(message)) return "Check the tags and try again.";
	if (/rate|too many/i.test(message)) return "Too many community posts. Try again soon.";

	return "We could not create this post. Please try again.";
}

function cleanFileTitle(fileName: string) {
	return (
		fileName
			.replace(/\.[a-z0-9]+$/i, "")
			.replace(/[-_]+/g, " ")
			.replace(/\s+/g, " ")
			.trim()
			.slice(0, 120) || "Post image"
	);
}

async function removeUploadedPostImages(
	admin: SupabaseClient,
	attachments: UploadedPostAttachment[],
) {
	if (!attachments.length) return;

	try {
		await admin.storage
			.from("community-post-media")
			.remove(attachments.map((attachment) => attachment.storage_path));
	} catch {
		// The client still receives the original submit failure.
	}
}

async function uploadPostImage(
	admin: SupabaseClient,
	image: PostImageInput,
	userId: string,
) {
	const { file } = image;
	const bytes = new Uint8Array(await file.arrayBuffer());
	const issue = getCommunityPostImageUploadIssue({
		bytes,
		name: file.name,
		size: file.size,
		type: file.type,
	});

	if (issue) {
		return { attachment: null, message: issue };
	}

	const mimeType = detectCommunityPostImageMimeType(
		bytes,
	) as CommunityPostImageMimeType;
	const uploadSecurity = await enforceUploadSecurity(admin, {
		bytes,
		fileName: file.name,
		fileSize: file.size,
		mimeType,
		uploadKind: "community-post-media",
		userId,
	});

	if (!uploadSecurity.ok) {
		return { attachment: null, message: uploadSecurity.message };
	}

	const extension = getCommunityPostImageExtension(mimeType);
	const storagePath = `${userId}/${Date.now()}-${randomUUID()}.${extension}`;
	const title = cleanFileTitle(file.name);
	const upload = await admin.storage
		.from("community-post-media")
		.upload(storagePath, bytes, {
			contentType: mimeType,
			upsert: false,
		});

	if (upload.error) {
		return { attachment: null, message: "Image upload failed. Please try again." };
	}

	return {
		attachment: {
			alt_text: title,
			clientId: image.clientId,
			file_size: file.size,
			placement: image.placement,
			mime_type: mimeType,
			storage_path: storagePath,
			title,
		} satisfies UploadedPostAttachment,
		message: "",
	};
}

async function uploadPostImages(
	admin: SupabaseClient,
	images: PostImageInput[],
	userId: string,
) {
	const uploadedAttachments: UploadedPostAttachment[] = [];

	for (const image of images) {
		const result = await uploadPostImage(admin, image, userId);

		if (!result.attachment) {
			await removeUploadedPostImages(admin, uploadedAttachments);
			return { attachments: [], message: result.message };
		}

		uploadedAttachments.push(result.attachment);
	}

	return { attachments: uploadedAttachments, message: "" };
}

function getPostImageInputs({
	files,
	imageIds,
	imagePlacements,
}: {
	files: File[];
	imageIds: string[];
	imagePlacements: string[];
}) {
	if (!files.length) return { images: [] as PostImageInput[], message: "" };

	if (
		(imageIds.length > 0 && imageIds.length !== files.length) ||
		(imagePlacements.length > 0 && imagePlacements.length !== files.length)
	) {
		return {
			images: [] as PostImageInput[],
			message: "Check the post images and try again.",
		};
	}

	return {
		images: files.map((file, index) => ({
			clientId: cleanCommunityText(imageIds[index]) || randomUUID(),
			file,
			placement: readImagePlacement(imagePlacements[index]),
		})),
		message: "",
	};
}

function getAttachmentPayload(attachments: UploadedPostAttachment[]) {
	return attachments.map((attachment) => ({
		alt_text: attachment.alt_text,
		file_size: attachment.file_size,
		mime_type: attachment.mime_type,
		storage_path: attachment.storage_path,
		title: attachment.title,
	}));
}

export async function POST(request: Request) {
	if (!areCommunityPostsEnabled()) {
		return jsonResponse("Community posting is not enabled.", 404);
	}

	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

	if (!supabaseUrl || !serviceRoleKey) {
		return jsonResponse("Server community setup is missing.", 503);
	}

	const token = getBearerToken(request);
	if (!token) {
		return jsonResponse("Sign in again before posting.", 401);
	}

	const admin = createClient(supabaseUrl, serviceRoleKey, {
		auth: {
			autoRefreshToken: false,
			persistSession: false,
		},
	});

	const {
		data: { user },
		error: userError,
	} = await admin.auth.getUser(token);

	if (userError || !user) {
		return jsonResponse("Your session expired. Sign in again.", 401);
	}

	const body = await readSubmitPayload(request);
	if (!body) {
		return jsonResponse("Submit the post as JSON or form data.");
	}

	const title = cleanCommunityText(body.title);
	const postBody = cleanCommunityText(body.body);
	const topicId = cleanCommunityText(body.topicId);
	const postType = cleanCommunityText(body.postType);
	const tags = readTagList(body.tags);
	const files = body.files;
	const format = readSubmitFormat(body.format);
	const imageIds = readStringList(body.imageIds).map(cleanCommunityText);
	const imagePlacements = readStringList(body.imagePlacements).map(
		cleanCommunityText,
	);
	const imageInputResult = getPostImageInputs({
		files,
		imageIds,
		imagePlacements,
	});
	const pollDurationDays = cleanCommunityText(body.pollDurationDays) || "7";
	const pollOptions = normalizeCommunityPollOptions(
		readStringList(body.pollOptions),
	).filter(Boolean);
	const issue = getCommunityPostIssue({
		body: postBody,
		postType,
		tags,
		title,
		topicId,
	});

	if (issue) {
		return jsonResponse(issue);
	}

	if (imageInputResult.message) {
		return jsonResponse(imageInputResult.message);
	}

	const postImages = imageInputResult.images;

	if (format === "poll") {
		if (postImages.length) {
			return jsonResponse("Remove images before posting a poll.");
		}

		const pollIssue = getCommunityPollIssue(pollOptions);
		if (pollIssue) return jsonResponse(pollIssue);

		if (!isCommunityPollDurationDays(pollDurationDays)) {
			return jsonResponse("Choose a valid poll duration.");
		}
	}

	if (postImages.length > COMMUNITY_POST_IMAGE_MAX_COUNT) {
		return jsonResponse(`Attach at most ${COMMUNITY_POST_IMAGE_MAX_COUNT} images.`);
	}

	const rateLimitResponse = await enforceApiRateLimit(
		admin,
		user.id,
		"communityPostSubmit",
	);
	if (rateLimitResponse) return rateLimitResponse;

	if (postImages.length) {
		const mediaRateLimitResponse = await enforceApiRateLimit(
			admin,
			user.id,
			"communityPostMediaUpload",
		);
		if (mediaRateLimitResponse) return mediaRateLimitResponse;
	}

	if (format === "poll") {
		const submitPollPost = await admin.rpc("submit_community_poll_post", {
			poll_duration_days: Number(pollDurationDays),
			poll_option_labels: pollOptions,
			post_body: postBody,
			post_kind: postType,
			post_title: title,
			selected_topic_id: topicId,
			target_user_id: user.id,
		});

		if (submitPollPost.error) {
			console.error("Community poll submit RPC failed", {
				code: submitPollPost.error.code,
				details: submitPollPost.error.details,
				hint: submitPollPost.error.hint,
				message: submitPollPost.error.message,
			});
			return jsonResponse(getPublicRpcError(submitPollPost.error.message), 400);
		}

		const row = Array.isArray(submitPollPost.data)
			? submitPollPost.data[0]
			: submitPollPost.data;
		const post = row as SubmitCommunityPostResult | null;

		if (!post?.id) {
			return jsonResponse("We could not create this post. Please try again.", 500);
		}

		return NextResponse.json({
			href: `/community/${post.id}`,
			id: post.id,
			status: post.status ?? "active",
		});
	}

	const uploadResult = await uploadPostImages(admin, postImages, user.id);
	if (uploadResult.message) {
		return jsonResponse(uploadResult.message);
	}

	const inlineImageReplacements = uploadResult.attachments
		.filter((attachment) => attachment.placement === "inline")
		.map((attachment) => ({
			id: attachment.clientId,
			publicUrl: admin.storage
				.from("community-post-media")
				.getPublicUrl(attachment.storage_path).data.publicUrl,
		}));
	const postBodyWithInlineImages = replaceCommunityInlineImageUrls(
		postBody,
		inlineImageReplacements,
	);

	if (postBodyWithInlineImages.length > COMMUNITY_POST_BODY_MAX_LENGTH) {
		await removeUploadedPostImages(admin, uploadResult.attachments);
		return jsonResponse(
			`Keep the body under ${COMMUNITY_POST_BODY_MAX_LENGTH} characters.`,
		);
	}

	const submitPost = await admin.rpc("submit_community_post", {
		attachment_payload: getAttachmentPayload(uploadResult.attachments),
		post_body: postBodyWithInlineImages,
		post_kind: postType,
		post_title: title,
		selected_topic_id: topicId,
		tag_names: tags,
		target_user_id: user.id,
	});

	if (submitPost.error) {
		await removeUploadedPostImages(admin, uploadResult.attachments);
		console.error("Community post submit RPC failed", {
			code: submitPost.error.code,
			details: submitPost.error.details,
			hint: submitPost.error.hint,
			message: submitPost.error.message,
		});
		return jsonResponse(getPublicRpcError(submitPost.error.message), 400);
	}

	const row = Array.isArray(submitPost.data)
		? submitPost.data[0]
		: submitPost.data;
	const post = row as SubmitCommunityPostResult | null;

	if (!post?.id) {
		await removeUploadedPostImages(admin, uploadResult.attachments);
		return jsonResponse("We could not create this post. Please try again.", 500);
	}

	return NextResponse.json({
		href: `/community/${post.id}`,
		id: post.id,
		status: post.status ?? "active",
	});
}
