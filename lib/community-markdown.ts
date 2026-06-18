const INLINE_IMAGE_URL_PREFIX = "linted-inline-image:";
const INLINE_IMAGE_ID_PATTERN = /^[A-Za-z0-9_-]{6,80}$/;
const MARKDOWN_IMAGE_PATTERN = /!\[([^\]\n]*)\]\(([^)\s]+)\)/g;
const MARKDOWN_ESCAPE_PATTERN = /\\([!#()*+\-.>_`|~]|\[|\])/g;

type InlineImageReplacement = {
	id: string;
	publicUrl: string;
};

type InlineAttachment = {
	publicUrl?: string | null;
};

function escapeMarkdownImageAlt(value: string) {
	return value
		.replace(/[\r\n]+/g, " ")
		.replace(/\\/g, "\\\\")
		.replace(/\[/g, "\\[")
		.replace(/\]/g, "\\]")
		.trim();
}

export function createCommunityInlineImageUrl(id: string) {
	return `${INLINE_IMAGE_URL_PREFIX}${id}`;
}

export function getCommunityInlineImageId(url: string) {
	if (!url.startsWith(INLINE_IMAGE_URL_PREFIX)) return "";

	const id = url.slice(INLINE_IMAGE_URL_PREFIX.length);
	return INLINE_IMAGE_ID_PATTERN.test(id) ? id : "";
}

export function createCommunityInlineImageMarkdown(id: string, altText: string) {
	const safeAlt = escapeMarkdownImageAlt(altText) || "Post image";
	return `![${safeAlt}](${createCommunityInlineImageUrl(id)})`;
}

export function normalizeCommunityMarkdown(markdown: string) {
	return markdown.replace(MARKDOWN_ESCAPE_PATTERN, "$1");
}

function getCommunityMarkdownImageUrls(markdown: string) {
	const urls = new Set<string>();
	let match: RegExpExecArray | null;
	const normalizedMarkdown = normalizeCommunityMarkdown(markdown);
	MARKDOWN_IMAGE_PATTERN.lastIndex = 0;

	while ((match = MARKDOWN_IMAGE_PATTERN.exec(normalizedMarkdown))) {
		const url = match[2]?.trim();
		if (url) urls.add(url);
	}

	return urls;
}

export function replaceCommunityInlineImageUrls(
	markdown: string,
	replacements: InlineImageReplacement[],
) {
	const normalizedMarkdown = normalizeCommunityMarkdown(markdown);
	if (!replacements.length) return normalizedMarkdown;

	const urlsById = new Map(
		replacements.map((replacement) => [replacement.id, replacement.publicUrl]),
	);

	return normalizedMarkdown.replace(
		MARKDOWN_IMAGE_PATTERN,
		(imageMarkdown, alt, url) => {
			const inlineImageId = getCommunityInlineImageId(url);
			const publicUrl = inlineImageId ? urlsById.get(inlineImageId) : "";

			return publicUrl ? `![${alt}](${publicUrl})` : imageMarkdown;
		},
	);
}

export function filterCommunityInlineAttachments<T extends InlineAttachment>(
	markdown: string,
	attachments: T[],
) {
	if (!attachments.length) return attachments;

	const imageUrls = getCommunityMarkdownImageUrls(markdown);
	if (!imageUrls.size) return attachments;

	return attachments.filter((attachment) => {
		const publicUrl = attachment.publicUrl?.trim();
		return !publicUrl || !imageUrls.has(publicUrl);
	});
}

export function getCommunityMarkdownPlainText(markdown: string) {
	return normalizeCommunityMarkdown(markdown)
		.replace(MARKDOWN_IMAGE_PATTERN, "$1")
		.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, "$1")
		.replace(/(`{1,3})(.*?)\1/g, "$2")
		.replace(/(\*\*|__)(.*?)\1/g, "$2")
		.replace(/(\*|_)(.*?)\1/g, "$2")
		.replace(/~~(.*?)~~/g, "$1")
		.replace(/^#{1,6}\s+/gm, "")
		.replace(/^\s{0,3}>\s?/gm, "")
		.replace(/^\s*[-*+]\s+/gm, "")
		.replace(/^\s*\d+\.\s+/gm, "")
		.replace(/\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?/g, "")
		.replace(/\|/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}
