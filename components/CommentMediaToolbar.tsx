"use client";

import { X } from "lucide-react";
import { ImageIcon, Loader2, Type } from "@/components/ui/solar-icons";
import { useRef, useState } from "react";
import { toast } from "sonner";
import type {
	CommentAttachment,
	CommentContentFormat,
} from "@/lib/supabase/types";
import { supabase } from "@/lib/supabase/client";

export type CommentAttachmentOption = CommentAttachment & {
	publicUrl?: string;
};

type CommentMediaToolbarProps = {
	attachment: CommentAttachmentOption | null;
	contentFormat: CommentContentFormat;
	disabled?: boolean;
	onAttachmentChange: (attachment: CommentAttachmentOption | null) => void;
	onFormatChange: (format: CommentContentFormat) => void;
	onRequireLogin: () => void;
	showFormat?: boolean;
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
	showFormat = true,
}: CommentMediaToolbarProps) {
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const [deletingImage, setDeletingImage] = useState(false);
	const [uploadingImage, setUploadingImage] = useState(false);

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
			toast.success("Media attached.");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Image upload failed.");
		} finally {
			setUploadingImage(false);
		}
	}

	async function removeImage() {
		if (!attachment?.id) {
			onAttachmentChange(null);
			return;
		}

		const token = await getAccessToken();
		if (!token) {
			onRequireLogin();
			return;
		}

		setDeletingImage(true);
		try {
			const response = await fetch(`/api/comment-media/${attachment.id}`, {
				headers: {
					Authorization: `Bearer ${token}`,
				},
				method: "DELETE",
			});

			if (!response.ok) {
				throw new Error(
					await readErrorMessage(response, "Media was not removed."),
				);
			}

			onAttachmentChange(null);
			toast.success("Media removed.");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Media was not removed.");
		} finally {
			setDeletingImage(false);
		}
	}

	const attachmentUrl = attachment?.publicUrl || "";

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
					accept="image/png,image/jpeg,image/webp"
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
				{showFormat ? (
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
				) : null}
			</div>

			{attachment ? (
				<div className="comment-media-preview">
					{attachmentUrl ? (
						<img alt={attachment.alt_text || attachment.title} src={attachmentUrl} />
					) : null}
					<span>{attachment.title || "Media"}</span>
					<button
						aria-label="Remove attached media"
						disabled={disabled || deletingImage}
						onClick={() => void removeImage()}
						type="button"
					>
						{deletingImage ? (
							<Loader2 className="spin-icon" size={16} strokeWidth={2} aria-hidden="true" />
						) : (
							<X size={16} strokeWidth={2} aria-hidden="true" />
						)}
					</button>
				</div>
			) : null}
		</div>
	);
}
