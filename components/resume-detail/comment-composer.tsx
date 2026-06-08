"use client";

import {
	useEffect,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	type ChangeEvent,
	type CSSProperties,
	type FocusEvent,
	type KeyboardEvent,
	type SyntheticEvent,
} from "react";
import CommentMediaToolbar, {
	type CommentAttachmentOption,
} from "@/components/CommentMediaToolbar";
import {
	getMentionAvatarUrl,
	normalizeMentionHandle,
	type MentionSuggestion,
} from "@/lib/comment-mentions";
import type { CommentContentFormat } from "@/lib/supabase/types";

type CommentComposerProps = {
	ariaLabel?: string;
	attachment: CommentAttachmentOption | null;
	autoFocus?: boolean;
	cancelLabel?: string;
	className?: string;
	contentFormat: CommentContentFormat;
	disabledTools?: boolean;
	maxHeight?: number;
	minHeight?: number;
	mentionSuggestions?: MentionSuggestion[];
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

type MentionQuery = {
	end: number;
	query: string;
	start: number;
};

const MENTION_TRIGGER_PATTERN = /(^|[\s([{"'.,!?;:])@([A-Za-z0-9_.-]{0,32})$/;
const MAX_MENTION_RESULTS = 6;

function getActiveMentionQuery(value: string, cursorIndex: number | null) {
	if (cursorIndex === null) return null;

	const beforeCursor = value.slice(0, cursorIndex);
	const match = beforeCursor.match(MENTION_TRIGGER_PATTERN);
	if (!match) return null;

	const query = match[2] ?? "";
	const start = beforeCursor.length - query.length - 1;

	return {
		end: cursorIndex,
		query,
		start,
	} satisfies MentionQuery;
}

function getNormalizedSuggestions(suggestions: MentionSuggestion[]) {
	const seen = new Set<string>();

	return suggestions.reduce<MentionSuggestion[]>((items, suggestion) => {
		const handle = normalizeMentionHandle(suggestion.handle);
		if (!handle) return items;

		const key = `${suggestion.id}:${handle.toLowerCase()}`;
		if (seen.has(key)) return items;

		seen.add(key);
		items.push({
			...suggestion,
			handle,
		});
		return items;
	}, []);
}

export function CommentComposer({
	ariaLabel,
	attachment,
	autoFocus = false,
	cancelLabel = "Cancel",
	className,
	contentFormat,
	disabledTools = false,
	maxHeight = 260,
	minHeight = 64,
	mentionSuggestions = [],
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
	const mentionListId = useId();
	const [mentionQuery, setMentionQuery] = useState<MentionQuery | null>(null);
	const [activeMentionIndex, setActiveMentionIndex] = useState(0);
	const normalizedMentionSuggestions = useMemo(
		() => getNormalizedSuggestions(mentionSuggestions),
		[mentionSuggestions],
	);
	const filteredMentionSuggestions = useMemo(() => {
		if (!mentionQuery) return [];

		const query = mentionQuery.query.toLowerCase();
		const matches = normalizedMentionSuggestions.filter((suggestion) => {
			const handle = suggestion.handle.toLowerCase();
			const displayName = suggestion.displayName.toLowerCase();

			return handle.includes(query) || displayName.includes(query);
		});

		return matches.slice(0, MAX_MENTION_RESULTS);
	}, [mentionQuery, normalizedMentionSuggestions]);
	const mentionListOpen = Boolean(
		mentionQuery && filteredMentionSuggestions.length,
	);
	const activeMention = mentionListOpen
		? filteredMentionSuggestions[activeMentionIndex]
		: null;

	useLayoutEffect(() => {
		const textarea = textareaRef.current;
		if (!textarea) return;

		textarea.style.height = "auto";
		const nextHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
		textarea.style.height = `${nextHeight}px`;
		textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
	}, [maxHeight, minHeight, value]);

	useEffect(() => {
		setActiveMentionIndex(0);
	}, [mentionQuery?.query, normalizedMentionSuggestions.length]);

	function updateMentionQuery(nextValue: string, cursorIndex: number | null) {
		if (!normalizedMentionSuggestions.length) {
			setMentionQuery(null);
			return;
		}

		setMentionQuery(getActiveMentionQuery(nextValue, cursorIndex));
	}

	function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
		onChange(event.target.value);
		updateMentionQuery(event.target.value, event.target.selectionStart);
	}

	function handleSelect(event: SyntheticEvent<HTMLTextAreaElement>) {
		updateMentionQuery(
			event.currentTarget.value,
			event.currentTarget.selectionStart,
		);
	}

	function closeMentionList() {
		setMentionQuery(null);
		setActiveMentionIndex(0);
	}

	function insertMention(suggestion: MentionSuggestion) {
		if (!mentionQuery) return;

		const mentionText = `@${suggestion.handle} `;
		const currentValue = textareaRef.current?.value ?? value;
		const nextValue = `${currentValue.slice(
			0,
			mentionQuery.start,
		)}${mentionText}${currentValue.slice(mentionQuery.end)}`;
		const nextCursorIndex = mentionQuery.start + mentionText.length;

		onChange(nextValue);
		closeMentionList();

		window.requestAnimationFrame(() => {
			const textarea = textareaRef.current;
			if (!textarea) return;

			textarea.focus();
			textarea.setSelectionRange(nextCursorIndex, nextCursorIndex);
		});
	}

	function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
		if (!mentionListOpen) return;

		if (event.key === "ArrowDown") {
			event.preventDefault();
			setActiveMentionIndex((current) =>
				current + 1 >= filteredMentionSuggestions.length ? 0 : current + 1,
			);
			return;
		}

		if (event.key === "ArrowUp") {
			event.preventDefault();
			setActiveMentionIndex((current) =>
				current - 1 < 0 ? filteredMentionSuggestions.length - 1 : current - 1,
			);
			return;
		}

		if (event.key === "Enter" || event.key === "Tab") {
			event.preventDefault();
			if (activeMention) {
				insertMention(activeMention);
			}
			return;
		}

		if (event.key === "Escape") {
			event.preventDefault();
			closeMentionList();
		}
	}

	function handleBlur(event: FocusEvent<HTMLTextAreaElement>) {
		const nextTarget = event.relatedTarget;
		if (
			nextTarget instanceof HTMLElement &&
			nextTarget.closest(".mention-suggestions")
		) {
			return;
		}

		window.setTimeout(closeMentionList, 120);
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
				aria-activedescendant={
					activeMention ? `${mentionListId}-${activeMention.id}` : undefined
				}
				aria-autocomplete={mentionSuggestions.length ? "list" : undefined}
				aria-controls={mentionListOpen ? mentionListId : undefined}
				aria-expanded={mentionSuggestions.length ? mentionListOpen : undefined}
				aria-label={ariaLabel ?? placeholder}
				autoFocus={autoFocus}
				className="comment-composer-input"
				onBlur={handleBlur}
				onChange={handleChange}
				onKeyDown={handleKeyDown}
				onSelect={handleSelect}
				placeholder={placeholder}
				ref={textareaRef}
				rows={1}
				value={value}
			/>
			{mentionListOpen ? (
				<div
					aria-label="Mention people"
					className="mention-suggestions"
					id={mentionListId}
					role="listbox"
				>
					{filteredMentionSuggestions.map((suggestion, index) => {
						const isActive = index === activeMentionIndex;
						const optionId = `${mentionListId}-${suggestion.id}`;

						return (
							<button
								aria-selected={isActive}
								className={`mention-suggestion-button${
									isActive ? " is-active" : ""
								}`}
								id={optionId}
								key={`${suggestion.id}-${suggestion.handle}`}
								onMouseDown={(event) => {
									event.preventDefault();
									insertMention(suggestion);
								}}
								role="option"
								type="button"
							>
								<img
									alt=""
									aria-hidden="true"
									className="mention-suggestion-avatar"
									height={28}
									src={
										suggestion.avatarUrl ??
										getMentionAvatarUrl(suggestion.id, suggestion)
									}
									width={28}
								/>
								<span className="mention-suggestion-copy">
									<span className="mention-suggestion-handle">
										@{suggestion.handle}
									</span>
									<span className="mention-suggestion-name">
										{suggestion.subtitle || suggestion.displayName}
									</span>
								</span>
							</button>
						);
					})}
				</div>
			) : null}
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
