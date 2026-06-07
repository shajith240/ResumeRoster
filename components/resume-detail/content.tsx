import type { ReactNode } from "react";
import {
	canShowReviewerProfile,
	getReviewerDisplayLabel,
	isTrustedReviewer,
} from "@/lib/reviewer-validation";
import type { CommentAttachmentOption } from "@/components/CommentMediaToolbar";
import type { CommentContentFormat } from "@/lib/supabase/types";
import type { AuthorProfile } from "./types";
import { getAttachmentUrl } from "./utils";

export function ReviewerTrustChip({ profile }: { profile?: AuthorProfile }) {
	if (
		!canShowReviewerProfile(
			profile?.community_role,
			profile?.reviewer_type,
			profile?.reviewer_verification_status,
		)
	) {
		return null;
	}

	const trusted = isTrustedReviewer(profile?.reviewer_verification_status);
	return (
		<span
			className={`reviewer-trust-chip${trusted ? " is-trusted" : ""}`}
			title={
				trusted
					? "Admin-approved trusted reviewer"
					: "Self-described reviewer role"
			}
		>
			{getReviewerDisplayLabel(profile ?? {})}
		</span>
	);
}

export function ResumeContextCard({
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

export function renderInlineMarkdown(text: string, keyPrefix: string) {
	const parts: ReactNode[] = [];
	const pattern =
		/(\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
	let lastIndex = 0;
	let match: RegExpExecArray | null;

	while ((match = pattern.exec(text))) {
		if (match.index > lastIndex) {
			parts.push(text.slice(lastIndex, match.index));
		}

		const key = `${keyPrefix}-${match.index}`;
		if (match[2] && match[3]) {
			parts.push(
				<a
					href={match[3]}
					key={key}
					rel="noopener noreferrer"
					target="_blank"
				>
					{match[2]}
				</a>,
			);
		} else if (match[4]) {
			parts.push(<code key={key}>{match[4]}</code>);
		} else if (match[5]) {
			parts.push(<strong key={key}>{match[5]}</strong>);
		} else if (match[6]) {
			parts.push(<em key={key}>{match[6]}</em>);
		}

		lastIndex = pattern.lastIndex;
	}

	if (lastIndex < text.length) {
		parts.push(text.slice(lastIndex));
	}

	return parts;
}

export function FormattedReviewContent({
	content,
	format,
	isDeleted,
}: {
	content: string;
	format?: CommentContentFormat;
	isDeleted: boolean;
}) {
	if (isDeleted) {
		return (
			<p className="deleted-roast-copy">
				This comment was deleted by its author.
			</p>
		);
	}

	if (format !== "markdown") {
		return <p>{content}</p>;
	}

	const lines = content.split(/\r?\n/);
	const nodes: ReactNode[] = [];
	let bulletItems: string[] = [];

	function flushBullets(index: number) {
		if (!bulletItems.length) return;

		nodes.push(
			<ul key={`ul-${index}`}>
				{bulletItems.map((item, itemIndex) => (
					<li key={`${index}-${itemIndex}`}>
						{renderInlineMarkdown(item, `${index}-${itemIndex}`)}
					</li>
				))}
			</ul>,
		);
		bulletItems = [];
	}

	lines.forEach((line, index) => {
		const trimmed = line.trim();

		if (!trimmed) {
			flushBullets(index);
			return;
		}

		if (trimmed.startsWith("- ")) {
			bulletItems.push(trimmed.slice(2).trim());
			return;
		}

		flushBullets(index);

		if (trimmed.startsWith("> ")) {
			nodes.push(
				<blockquote key={`quote-${index}`}>
					{renderInlineMarkdown(trimmed.slice(2).trim(), `quote-${index}`)}
				</blockquote>,
			);
			return;
		}

		nodes.push(
			<p key={`p-${index}`}>
				{renderInlineMarkdown(trimmed, `p-${index}`)}
			</p>,
		);
	});

	flushBullets(lines.length);

	return <div className="comment-markdown">{nodes}</div>;
}

export function ReviewAttachment({
	attachment,
}: {
	attachment?: CommentAttachmentOption | null;
}) {
	const url = getAttachmentUrl(attachment);
	if (!attachment || !url) return null;

	return (
		<figure className="roast-attachment">
			<img alt={attachment.alt_text || attachment.title} src={url} />
		</figure>
	);
}
