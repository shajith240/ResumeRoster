"use client";

import {
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
	type ChangeEvent,
	type CSSProperties,
	type RefObject,
} from "react";
import CommentMediaToolbar, {
	type CommentAttachmentOption,
} from "@/components/CommentMediaToolbar";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	GUIDED_REVIEW_ISSUE_LABELS,
	GUIDED_REVIEW_ISSUE_TYPES,
	isGuidedReviewIssueType,
	type GuidedReviewIssueType,
} from "@/lib/guided-review";

type GuidedReviewComposerProps = {
	attachment: CommentAttachmentOption | null;
	disabledTools?: boolean;
	issue: string;
	issueType: GuidedReviewIssueType | "";
	onAttachmentChange: (attachment: CommentAttachmentOption | null) => void;
	onIssueChange: (value: string) => void;
	onIssueTypeChange: (value: GuidedReviewIssueType) => void;
	onRequireLogin: () => void;
	onSuggestionChange: (value: string) => void;
	submitDisabled?: boolean;
	submitLabel: string;
	suggestion: string;
};

const COMPACT_GUIDED_REVIEW_QUERY = "(max-width: 760px)";

function useAutosizeTextArea(value: string, minHeight: number, maxHeight: number) {
	const ref = useRef<HTMLTextAreaElement | null>(null);

	useLayoutEffect(() => {
		const textarea = ref.current;
		if (!textarea) return;

		textarea.style.height = "auto";
		const nextHeight = Math.min(
			Math.max(textarea.scrollHeight, minHeight),
			maxHeight,
		);
		textarea.style.height = `${nextHeight}px`;
		textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
	}, [maxHeight, minHeight, value]);

	return ref;
}

function useCompactGuidedReviewLayout() {
	const [isCompact, setIsCompact] = useState(false);

	useEffect(() => {
		const query = window.matchMedia(COMPACT_GUIDED_REVIEW_QUERY);
		const syncLayout = () => setIsCompact(query.matches);

		syncLayout();
		query.addEventListener("change", syncLayout);
		return () => query.removeEventListener("change", syncLayout);
	}, []);

	return isCompact;
}

function GuidedIssueSelector({
	issueType,
	onIssueTypeChange,
}: {
	issueType: GuidedReviewIssueType | "";
	onIssueTypeChange: (value: GuidedReviewIssueType) => void;
}) {
	function handleIssueTypeChange(nextIssueType: string) {
		if (isGuidedReviewIssueType(nextIssueType)) {
			onIssueTypeChange(nextIssueType);
		}
	}

	return (
		<div className="guided-review-type-select">
			<span>Issue</span>
			<Select value={issueType} onValueChange={handleIssueTypeChange}>
				<SelectTrigger
					aria-label="Issue type"
					className="guided-review-type-trigger"
				>
					<SelectValue placeholder="Choose issue" />
				</SelectTrigger>
				<SelectContent
					align="end"
					className="guided-review-type-content"
					collisionPadding={12}
					sideOffset={8}
				>
					<SelectGroup>
						{GUIDED_REVIEW_ISSUE_TYPES.map((type) => (
							<SelectItem
								className="guided-review-type-item"
								key={type}
								value={type}
							>
								{GUIDED_REVIEW_ISSUE_LABELS[type]}
							</SelectItem>
						))}
					</SelectGroup>
				</SelectContent>
			</Select>
		</div>
	);
}

function GuidedIssueChips({
	issueType,
	onIssueTypeChange,
}: {
	issueType: GuidedReviewIssueType | "";
	onIssueTypeChange: (value: GuidedReviewIssueType) => void;
}) {
	return (
		<div className="guided-review-type-grid" aria-label="Issue type">
			{GUIDED_REVIEW_ISSUE_TYPES.map((type) => (
				<button
					aria-pressed={issueType === type}
					className={issueType === type ? "is-selected" : ""}
					key={type}
					onClick={() => onIssueTypeChange(type)}
					type="button"
				>
					{GUIDED_REVIEW_ISSUE_LABELS[type]}
				</button>
			))}
		</div>
	);
}

function GuidedReviewField({
	desktopLabel,
	mobileLabel,
	onChange,
	placeholder,
	refValue,
	value,
}: {
	desktopLabel: string;
	mobileLabel: string;
	onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
	placeholder: string;
	refValue: RefObject<HTMLTextAreaElement | null>;
	value: string;
}) {
	return (
		<label className="guided-review-field">
			<span className="guided-review-label-desktop">{desktopLabel}</span>
			<span className="guided-review-label-mobile">{mobileLabel}</span>
			<textarea
				className="guided-review-input"
				onChange={onChange}
				placeholder={placeholder}
				ref={refValue}
				rows={1}
				value={value}
			/>
		</label>
	);
}

export function GuidedReviewComposer({
	attachment,
	disabledTools = false,
	issue,
	issueType,
	onAttachmentChange,
	onIssueChange,
	onIssueTypeChange,
	onRequireLogin,
	onSuggestionChange,
	submitDisabled = false,
	submitLabel,
	suggestion,
}: GuidedReviewComposerProps) {
	const isCompact = useCompactGuidedReviewLayout();
	const issueMinHeight = isCompact ? 42 : 52;
	const suggestionMinHeight = isCompact ? 46 : 62;
	const issueRef = useAutosizeTextArea(issue, issueMinHeight, 150);
	const suggestionRef = useAutosizeTextArea(suggestion, suggestionMinHeight, 190);
	const issuePlaceholder = isCompact
		? "Which line, section, or proof is weak?"
		: "Point to one bullet, section, project, or missing proof that weakens the resume.";
	const suggestionPlaceholder = isCompact
		? "What exact change should they make?"
		: "Give one concrete rewrite, reorder, removal, or metric they can apply.";

	function handleIssueChange(event: ChangeEvent<HTMLTextAreaElement>) {
		onIssueChange(event.target.value);
	}

	function handleSuggestionChange(event: ChangeEvent<HTMLTextAreaElement>) {
		onSuggestionChange(event.target.value);
	}

	return (
		<div
			className="guided-review-composer"
			style={
				{
					"--guided-issue-min-height": `${issueMinHeight}px`,
					"--guided-suggestion-min-height": `${suggestionMinHeight}px`,
				} as CSSProperties
			}
		>
			<GuidedIssueChips
				issueType={issueType}
				onIssueTypeChange={onIssueTypeChange}
			/>
			<GuidedIssueSelector
				issueType={issueType}
				onIssueTypeChange={onIssueTypeChange}
			/>

			<GuidedReviewField
				desktopLabel="What is the issue?"
				mobileLabel="Issue"
				onChange={handleIssueChange}
				placeholder={issuePlaceholder}
				refValue={issueRef}
				value={issue}
			/>

			<GuidedReviewField
				desktopLabel="What should they change?"
				mobileLabel="Fix"
				onChange={handleSuggestionChange}
				placeholder={suggestionPlaceholder}
				refValue={suggestionRef}
				value={suggestion}
			/>

			<div className="comment-composer-footer guided-review-footer">
				<div className="comment-composer-tools">
					<CommentMediaToolbar
						attachment={attachment}
						contentFormat="markdown"
						disabled={disabledTools}
						onAttachmentChange={onAttachmentChange}
						onFormatChange={() => undefined}
						onRequireLogin={onRequireLogin}
						showFormat={false}
					/>
				</div>
				<div className="comment-composer-submit-row">
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
