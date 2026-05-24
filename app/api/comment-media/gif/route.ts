import {
	getTrustedGifUrlIssue,
	isGifProvider,
	type GifProvider,
} from "@/lib/comment-media-validation";
import { requireSignedInUser, serverAuthErrorResponse } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function badRequest(message: string, status = 400) {
	return Response.json({ message }, { status });
}

function cleanText(value: unknown, fallback: string, maxLength: number) {
	const text = typeof value === "string" && value.trim() ? value.trim() : fallback;
	return text.slice(0, maxLength);
}

export async function POST(request: Request) {
	try {
		const { admin, user } = await requireSignedInUser(request);
		const payload = await request.json().catch(() => null);

		if (!payload || typeof payload !== "object") {
			return badRequest("Choose a GIF first.");
		}

		const provider = (payload as { provider?: unknown }).provider;
		if (!isGifProvider(provider)) {
			return badRequest("Choose a valid GIF provider.");
		}

		const externalUrl = (payload as { externalUrl?: unknown }).externalUrl;
		const externalUrlIssue = getTrustedGifUrlIssue(provider, externalUrl);
		if (externalUrlIssue) return badRequest(externalUrlIssue);

		const previewUrl = (payload as { previewUrl?: unknown }).previewUrl;
		if (previewUrl) {
			const previewUrlIssue = getTrustedGifUrlIssue(
				provider,
				previewUrl,
			);
			if (previewUrlIssue) return badRequest(previewUrlIssue);
		}

		const title = cleanText(
			(payload as { title?: unknown }).title,
			"Reaction GIF",
			120,
		);
		const altText = cleanText(
			(payload as { altText?: unknown }).altText,
			title,
			180,
		);

		const insert = await admin
			.from("comment_attachments")
			.insert({
				alt_text: altText,
				external_url: String(externalUrl).trim(),
				kind: "gif",
				preview_url: typeof previewUrl === "string" ? previewUrl.trim() : null,
				provider: provider as GifProvider,
				source: "gif_provider",
				title,
				user_id: user.id,
			})
			.select("id,kind,source,storage_path,external_url,preview_url,provider,title,alt_text,mime_type,file_size,created_at")
			.single();

		if (insert.error) throw new Error(insert.error.message);

		return Response.json({ attachment: insert.data });
	} catch (error) {
		if (error instanceof Error && !(error as { status?: number }).status) {
			return Response.json({ message: error.message }, { status: 500 });
		}

		return serverAuthErrorResponse(error);
	}
}
