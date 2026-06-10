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
	getCachedMentionSearchSuggestions,
	getMentionSuggestionMatches,
	mergeMentionSuggestions,
	normalizeMentionHandle,
	searchMentionSuggestions,
	type MentionSuggestion,
} from "@/lib/comment-mentions";
import { supabase } from "@/lib/supabase/client";
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
	showFormatTools?: boolean;
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
const MAX_MENTION_FETCH_RESULTS = 12;
const MENTION_SEARCH_DEBOUNCE_MS = 90;
const MENTION_SESSION_REFRESH_BUFFER_MS = 30_000;

type MentionSearchStatus = "idle" | "loading" | "error";

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
	showFormatTools = true,
	submitDisabled = false,
	submitLabel,
	value,
}: CommentComposerProps) {
	const textareaRef = useRef<HTMLTextAreaElement | null>(null);
	const mentionListId = useId();
	const [mentionQuery, setMentionQuery] = useState<MentionQuery | null>(null);
	const [activeMentionIndex, setActiveMentionIndex] = useState(0);
	const [remoteMentionQuery, setRemoteMentionQuery] = useState("");
	const [remoteMentionSuggestions, setRemoteMentionSuggestions] = useState<
		MentionSuggestion[]
	>([]);
	const [cachedMentionSuggestions, setCachedMentionSuggestions] = useState<
		MentionSuggestion[]
	>([]);
	const [mentionSearchStatus, setMentionSearchStatus] =
		useState<MentionSearchStatus>("idle");
	const mentionAccessTokenRef = useRef<string | null>(null);
	const mentionAccessTokenExpiresAtRef = useRef(0);
	const mentionAccessTokenPromiseRef = useRef<Promise<string | null> | null>(
		null,
	);
	const normalizedMentionSuggestions = useMemo(
		() => getNormalizedSuggestions(mentionSuggestions),
		[mentionSuggestions],
	);
	const normalizedRemoteMentionSuggestions = useMemo(
		() => getNormalizedSuggestions(remoteMentionSuggestions),
		[remoteMentionSuggestions],
	);
	const normalizedCachedMentionSuggestions = useMemo(
		() => getNormalizedSuggestions(cachedMentionSuggestions),
		[cachedMentionSuggestions],
	);
	const mentionSearchQuery = mentionQuery?.query.trim().toLowerCase() ?? "";
	const filteredMentionSuggestions = useMemo(() => {
		if (!mentionQuery) return [];

		const localMatches = getMentionSuggestionMatches(
			normalizedMentionSuggestions,
			mentionQuery.query,
			MAX_MENTION_RESULTS,
		);
		const remoteMatches =
			remoteMentionQuery === mentionSearchQuery
				? normalizedRemoteMentionSuggestions
				: [];
		const cachedMatches = normalizedCachedMentionSuggestions;

		return mergeMentionSuggestions(
			localMatches,
			mergeMentionSuggestions(remoteMatches, cachedMatches, MAX_MENTION_RESULTS),
			MAX_MENTION_RESULTS,
		);
	}, [
		mentionQuery,
		mentionSearchQuery,
		normalizedCachedMentionSuggestions,
		normalizedMentionSuggestions,
		normalizedRemoteMentionSuggestions,
		remoteMentionQuery,
	]);
	const showMentionLoading = Boolean(
		mentionSearchQuery &&
			mentionSearchStatus === "loading" &&
			filteredMentionSuggestions.length < MAX_MENTION_RESULTS,
	);
	const showMentionError = Boolean(
		mentionSearchQuery &&
			mentionSearchStatus === "error" &&
			!filteredMentionSuggestions.length,
	);
	const showMentionEmpty = Boolean(
		mentionSearchQuery &&
			mentionSearchStatus === "idle" &&
			remoteMentionQuery === mentionSearchQuery &&
			!filteredMentionSuggestions.length,
	);
	const mentionListOpen = Boolean(
		mentionQuery &&
			(filteredMentionSuggestions.length ||
				showMentionLoading ||
				showMentionError ||
				showMentionEmpty),
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
	}, [filteredMentionSuggestions.length, mentionSearchQuery]);

	useEffect(() => {
		if (!mentionQuery || !mentionSearchQuery) {
			setCachedMentionSuggestions([]);
			setRemoteMentionQuery("");
			setRemoteMentionSuggestions([]);
			setMentionSearchStatus("idle");
			return;
		}

		const cached = getCachedMentionSearchSuggestions(
			mentionSearchQuery,
			MAX_MENTION_RESULTS,
		);
		setCachedMentionSuggestions(cached.suggestions);

		if (cached.exact) {
			setRemoteMentionQuery(mentionSearchQuery);
			setRemoteMentionSuggestions(cached.suggestions);
			setMentionSearchStatus("idle");
			return;
		}

		const controller = new AbortController();
		let cancelled = false;
		if (!cached.suggestions.length) {
			setMentionSearchStatus("loading");
		}

		const timeoutId = window.setTimeout(() => {
			setMentionSearchStatus("loading");

			async function searchPeople() {
				const accessToken = await getMentionAccessToken();

				const suggestions = await searchMentionSuggestions(mentionSearchQuery, {
					accessToken,
					limit: MAX_MENTION_FETCH_RESULTS,
					signal: controller.signal,
				});

				if (cancelled) return;
				setRemoteMentionQuery(mentionSearchQuery);
				setRemoteMentionSuggestions(suggestions);
				setMentionSearchStatus("idle");
			}

			void searchPeople().catch((error) => {
				if (cancelled || controller.signal.aborted) return;
				if (error instanceof DOMException && error.name === "AbortError") return;

				setRemoteMentionQuery(mentionSearchQuery);
				setRemoteMentionSuggestions([]);
				setMentionSearchStatus("error");
			});
		}, MENTION_SEARCH_DEBOUNCE_MS);

		return () => {
			cancelled = true;
			controller.abort();
			window.clearTimeout(timeoutId);
		};
	}, [mentionSearchQuery]);

	async function getMentionAccessToken() {
		const now = Date.now();
		if (
			mentionAccessTokenRef.current &&
			mentionAccessTokenExpiresAtRef.current - MENTION_SESSION_REFRESH_BUFFER_MS >
				now
		) {
			return mentionAccessTokenRef.current;
		}

		if (!mentionAccessTokenPromiseRef.current) {
			mentionAccessTokenPromiseRef.current = supabase.auth
				.getSession()
				.then(({ data }) => {
					const session = data.session;
					const accessToken = session?.access_token ?? null;
					mentionAccessTokenRef.current = accessToken;
					mentionAccessTokenExpiresAtRef.current = session?.expires_at
						? session.expires_at * 1000
						: 0;
					return accessToken;
				})
				.finally(() => {
					mentionAccessTokenPromiseRef.current = null;
				});
		}

		return mentionAccessTokenPromiseRef.current;
	}

	function updateMentionQuery(nextValue: string, cursorIndex: number | null) {
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

		if (!filteredMentionSuggestions.length) {
			if (event.key === "Escape") {
				event.preventDefault();
				closeMentionList();
			}
			return;
		}

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
				aria-autocomplete={mentionQuery ? "list" : undefined}
				aria-busy={showMentionLoading || undefined}
				aria-controls={mentionListOpen ? mentionListId : undefined}
				aria-expanded={mentionQuery ? mentionListOpen : undefined}
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
					{showMentionLoading ? (
						<button
							aria-disabled="true"
							className="mention-suggestion-button"
							disabled
							role="option"
							type="button"
						>
							<span
								aria-hidden="true"
								className="mention-suggestion-avatar"
							/>
							<span className="mention-suggestion-copy">
								<span className="mention-suggestion-handle">
									Searching people...
								</span>
								<span className="mention-suggestion-name">
									Checking the full member directory
								</span>
							</span>
						</button>
					) : null}
					{showMentionError ? (
						<button
							aria-disabled="true"
							className="mention-suggestion-button"
							disabled
							role="option"
							type="button"
						>
							<span
								aria-hidden="true"
								className="mention-suggestion-avatar"
							/>
							<span className="mention-suggestion-copy">
								<span className="mention-suggestion-handle">
									Could not search people
								</span>
								<span className="mention-suggestion-name">
									Try a handle or name again
								</span>
							</span>
						</button>
					) : null}
					{showMentionEmpty ? (
						<button
							aria-disabled="true"
							className="mention-suggestion-button"
							disabled
							role="option"
							type="button"
						>
							<span
								aria-hidden="true"
								className="mention-suggestion-avatar"
							/>
							<span className="mention-suggestion-copy">
								<span className="mention-suggestion-handle">
									No people found
								</span>
								<span className="mention-suggestion-name">
									Check the spelling and keep typing
								</span>
							</span>
						</button>
					) : null}
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
						showFormat={showFormatTools}
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
