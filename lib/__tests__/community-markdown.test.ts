import { describe, expect, it } from "vitest";
import {
	createCommunityInlineImageMarkdown,
	filterCommunityInlineAttachments,
	getCommunityMarkdownPlainText,
	normalizeCommunityMarkdown,
	replaceCommunityInlineImageUrls,
} from "@/lib/community-markdown";

describe("community markdown helpers", () => {
	it("normalizes escaped markdown before rendering saved post bodies", () => {
		expect(
			normalizeCommunityMarkdown(
				"\\!\\[Diagram\\]\\(https://cdn.linted.space/image.png\\) \\*\\*Bold\\*\\* \\#\\# Title \\~\\~old\\~\\~",
			),
		).toBe(
			"![Diagram](https://cdn.linted.space/image.png) **Bold** ## Title ~~old~~",
		);
	});

	it("replaces composer inline image placeholders with uploaded public URLs", () => {
		const body = [
			"Before",
			createCommunityInlineImageMarkdown("inline-123", "Diagram"),
			createCommunityInlineImageMarkdown("missing-123", "Still local"),
		].join("\n\n");

		expect(
			replaceCommunityInlineImageUrls(body, [
				{
					id: "inline-123",
					publicUrl: "https://cdn.linted.space/community/diagram.webp",
				},
			]),
		).toBe(
			[
				"Before",
				"![Diagram](https://cdn.linted.space/community/diagram.webp)",
				createCommunityInlineImageMarkdown("missing-123", "Still local"),
			].join("\n\n"),
		);
	});

	it("keeps inline images out of the separate gallery attachment list", () => {
		const inlineUrl = "https://cdn.linted.space/community/inline.png";
		const galleryUrl = "https://cdn.linted.space/community/gallery.png";

		expect(
			filterCommunityInlineAttachments(`\\!\\[Inline\\]\\(${inlineUrl}\\)`, [
				{ publicUrl: inlineUrl, title: "Inline" },
				{ publicUrl: galleryUrl, title: "Gallery" },
			]),
		).toEqual([{ publicUrl: galleryUrl, title: "Gallery" }]);
	});

	it("creates clean feed preview text from formatted markdown", () => {
		const body = [
			"**Bold** text",
			"| Skill | Score |",
			"| --- | --- |",
			"| React | 9 |",
			"![Architecture](https://cdn.linted.space/community/arch.png)",
		].join("\n");

		expect(getCommunityMarkdownPlainText(body)).toBe(
			"Bold text Skill Score React 9 Architecture",
		);
	});
});
