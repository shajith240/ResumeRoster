"use client";

import { ImageIcon, Loader2, Search, Type, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type {
	CommentAttachment,
	CommentContentFormat,
} from "@/lib/supabase/types";
import { supabase } from "@/lib/supabase/client";

export type CommentAttachmentOption = CommentAttachment & {
	publicUrl?: string;
};

type GifResult = {
	altText: string;
	height?: number;
	id: string;
	provider: "klipy" | "giphy";
	previewUrl: string;
	title: string;
	url: string;
	width?: number;
};

type CommentMediaToolbarProps = {
	attachment: CommentAttachmentOption | null;
	contentFormat: CommentContentFormat;
	disabled?: boolean;
	onAttachmentChange: (attachment: CommentAttachmentOption | null) => void;
	onFormatChange: (format: CommentContentFormat) => void;
	onRequireLogin: () => void;
};

async function getAccessToken() {
	const {
		data: { session },
	} = await supabase.auth.getSession();
	return session?.access_token ?? "";
}

async function readErrorMessage(response: Response, fallback: string) {
	const data = await response.json().catch(() => ({}));
	return (data as { message?: string }).message ?? fallback;
}

export default function CommentMediaToolbar({
	attachment,
	contentFormat,
	disabled = false,
	onAttachmentChange,
	onFormatChange,
	onRequireLogin,
}: CommentMediaToolbarProps) {
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const [gifOpen, setGifOpen] = useState(false);
	const [gifQuery, setGifQuery] = useState("");
	const [gifResults, setGifResults] = useState<GifResult[]>([]);
	const [gifMessage, setGifMessage] = useState("");
	const [searchingGifs, setSearchingGifs] = useState(false);
	const [uploadingImage, setUploadingImage] = useState(false);
	const [savingGifId, setSavingGifId] = useState("");

	useEffect(() => {
		if (!gifOpen) return;

		const controller = new AbortController();
		const timer = window.setTimeout(async () => {
			setSearchingGifs(true);
			setGifMessage("");

			try {
				const query = gifQuery.trim();
				const response = await fetch(
					`/api/gifs/search${query ? `?q=${encodeURIComponent(query)}` : ""}`,
					{ signal: controller.signal },
				);
				const data = await response.json().catch(() => ({}));

				if (!response.ok) {
					setGifResults([]);
					setGifMessage(
						(data as { message?: string }).message ?? "GIF search is unavailable.",
					);
					return;
				}

				const results = Array.isArray((data as { results?: unknown }).results)
					? ((data as { results: GifResult[] }).results ?? [])
					: [];
				setGifResults(results);
				setGifMessage(results.length ? "" : "No GIFs found.");
			} catch (error) {
				if (!controller.signal.aborted) {
					setGifResults([]);
					setGifMessage(
						error instanceof Error ? error.message : "GIF search is unavailable.",
					);
				}
			} finally {
				if (!controller.signal.aborted) {
					setSearchingGifs(false);
				}
			}
		}, 260);

		return () => {
			window.clearTimeout(timer);
			controller.abort();
		};
	}, [gifOpen, gifQuery]);

	async function uploadImage(file: File) {
		const token = await getAccessToken();
		if (!token) {
			onRequireLogin();
			return;
		}

		setUploadingImage(true);
		const formData = new FormData();
		formData.append("file", file);

		try {
			const response = await fetch("/api/comment-media/upload", {
				body: formData,
				headers: {
					Authorization: `Bearer ${token}`,
				},
				method: "POST",
			});

			if (!response.ok) {
				throw new Error(
					await readErrorMessage(response, "Image upload failed."),
				);
			}

			const data = (await response.json()) as {
				attachment?: CommentAttachmentOption;
			};
			if (!data.attachment) throw new Error("Image upload failed.");

			onAttachmentChange(data.attachment);
			toast.success("Image attached.");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Image upload failed.");
		} finally {
			setUploadingImage(false);
		}
	}

	async function attachGif(gif: GifResult) {
		const token = await getAccessToken();
		if (!token) {
			onRequireLogin();
			return;
		}

		setSavingGifId(gif.id);

		try {
			const response = await fetch("/api/comment-media/gif", {
				body: JSON.stringify({
					altText: gif.altText,
					externalUrl: gif.url,
					previewUrl: gif.previewUrl,
					provider: gif.provider,
					title: gif.title,
				}),
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
				method: "POST",
			});

			if (!response.ok) {
				throw new Error(await readErrorMessage(response, "GIF attach failed."));
			}

			const data = (await response.json()) as {
				attachment?: CommentAttachmentOption;
			};
			if (!data.attachment) throw new Error("GIF attach failed.");

			onAttachmentChange(data.attachment);
			setGifOpen(false);
			toast.success("GIF attached.");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "GIF attach failed.");
		} finally {
			setSavingGifId("");
		}
	}

	const attachmentUrl =
		attachment?.publicUrl ||
		attachment?.external_url ||
		attachment?.preview_url ||
		"";

	return (
		<div className="comment-media-toolbar">
			<div className="comment-media-actions" aria-label="Comment tools">
				<button
					aria-label="Upload image"
					disabled={disabled || uploadingImage}
					onClick={() => fileInputRef.current?.click()}
					title="Upload image"
					type="button"
				>
					{uploadingImage ? (
						<Loader2 className="spin-icon" size={16} strokeWidth={2} aria-hidden="true" />
					) : (
						<ImageIcon size={16} strokeWidth={2} aria-hidden="true" />
					)}
				</button>
				<input
					accept="image/png,image/jpeg,image/webp,image/gif"
					aria-hidden="true"
					disabled={disabled || uploadingImage}
					onChange={(event) => {
						const file = event.target.files?.[0];
						if (file) void uploadImage(file);
						event.currentTarget.value = "";
					}}
					ref={fileInputRef}
					tabIndex={-1}
					type="file"
				/>
				<button
					aria-expanded={gifOpen}
					disabled={disabled}
					onClick={() => setGifOpen((current) => !current)}
					title="Add GIF"
					type="button"
				>
					GIF
				</button>
				<button
					aria-pressed={contentFormat === "markdown"}
					className={contentFormat === "markdown" ? "is-active" : ""}
					disabled={disabled}
					onClick={() =>
						onFormatChange(contentFormat === "markdown" ? "plain" : "markdown")
					}
					title={
						contentFormat === "markdown" ? "Markdown on" : "Markdown off"
					}
					type="button"
				>
					<Type size={16} strokeWidth={2} aria-hidden="true" />
				</button>
			</div>

			{attachment ? (
				<div className="comment-media-preview">
					{attachmentUrl ? (
						<img alt={attachment.alt_text || attachment.title} src={attachmentUrl} />
					) : null}
					<span>{attachment.title || (attachment.kind === "gif" ? "GIF" : "Image")}</span>
					<button
						aria-label="Remove attached media"
						disabled={disabled}
						onClick={() => onAttachmentChange(null)}
						type="button"
					>
						<X size={14} strokeWidth={2} aria-hidden="true" />
					</button>
				</div>
			) : null}

			{gifOpen ? (
				<div className="gif-popover">
					<label className="gif-search">
						<Search size={15} strokeWidth={2} aria-hidden="true" />
						<input
							autoFocus
							onChange={(event) => setGifQuery(event.target.value)}
							placeholder="Search GIFs"
							value={gifQuery}
						/>
					</label>
					<div className="gif-grid" role="list">
						{gifResults.map((gif) => (
							<button
								aria-label={`Attach ${gif.title}`}
								disabled={Boolean(savingGifId)}
								key={`${gif.provider}-${gif.id}`}
								onClick={() => void attachGif(gif)}
								type="button"
							>
								<img alt={gif.altText || gif.title} src={gif.previewUrl || gif.url} />
								<span>{savingGifId === gif.id ? "Adding..." : gif.title}</span>
							</button>
						))}
					</div>
					{searchingGifs ? <p className="gif-empty">Searching GIFs...</p> : null}
					{gifMessage ? <p className="gif-empty">{gifMessage}</p> : null}
				</div>
			) : null}
		</div>
	);
}
