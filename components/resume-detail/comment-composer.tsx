"use client";

import {
	useLayoutEffect,
	useRef,
	type ChangeEvent,
	type CSSProperties,
} from "react";
import CommentMediaToolbar, {
	type CommentAttachmentOption,
} from "@/components/CommentMediaToolbar";
import type { CommentContentFormat } from "@/lib/supabase/types";

type CommentComposerProps = {
	attachment: CommentAttachmentOption | null;
	autoFocus?: boolean;
	cancelLabel?: string;
	className?: string;
	contentFormat: CommentContentFormat;
	disabledTools?: boolean;
	maxHeight?: number;
	minHeight?: number;
	onAttachmentChange: (attachment: CommentAttachmentOption | null) => void;
	onCancel?: () => void;
	onChange: (value: string) => void;
	onFormatChange: (format: CommentContentFormat) => void;
	onRequireLogin: () => void;
	placeholder: string;
	submitDisabled?: boolean;
	submitLabel: string;
	value: string;
};

export function CommentComposer({
	attachment,
	autoFocus = false,
	cancelLabel = "Cancel",
	className,
	contentFormat,
	disabledTools = false,
	maxHeight = 260,
	minHeight = 72,
	onAttachmentChange,
	onCancel,
	onChange,
	onFormatChange,
	onRequireLogin,
	placeholder,
	submitDisabled = false,
	submitLabel,
	value,
}: CommentComposerProps) {
	const textareaRef = useRef<HTMLTextAreaElement | null>(null);

	useLayoutEffect(() => {
		const textarea = textareaRef.current;
		if (!textarea) return;

		textarea.style.height = "auto";
		const nextHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
		textarea.style.height = `${nextHeight}px`;
		textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
	}, [maxHeight, minHeight, value]);

	function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
		onChange(event.target.value);
	}

	return (
		<div
			className={`comment-composer${className ? ` ${className}` : ""}`}
			style={
				{
					"--comment-composer-max-height": `${maxHeight}px`,
					"--comment-composer-min-height": `${minHeight}px`,
				} as CSSProperties
			}
		>
			<textarea
				autoFocus={autoFocus}
				className="comment-composer-input"
				onChange={handleChange}
				placeholder={placeholder}
				ref={textareaRef}
				rows={1}
				value={value}
			/>
			<div className="comment-composer-footer">
				<div className="comment-composer-tools">
					<CommentMediaToolbar
						attachment={attachment}
						contentFormat={contentFormat}
						disabled={disabledTools}
						onAttachmentChange={onAttachmentChange}
						onFormatChange={onFormatChange}
						onRequireLogin={onRequireLogin}
					/>
				</div>
				<div className="comment-composer-submit-row">
					{onCancel ? (
						<button
							className="comment-composer-cancel"
							onClick={onCancel}
							type="button"
						>
							{cancelLabel}
						</button>
					) : null}
					<button
						className="comment-composer-submit"
						disabled={submitDisabled}
						type="submit"
					>
						{submitLabel}
					</button>
				</div>
			</div>
		</div>
	);
}
