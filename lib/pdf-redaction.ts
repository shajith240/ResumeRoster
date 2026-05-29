import type { User } from "@supabase/supabase-js";
import type { Page, PDFDocument, Quad, Rect } from "mupdf";
import mupdf from "mupdf";
import type { ResumePrivacyMode } from "@/lib/resume-privacy";

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_CANDIDATE_PATTERN = /(?:\+?\d[\d\s().-]{7,}\d)/g;
const URL_PATTERN =
	/(?:https?:\/\/|www\.|mailto:|tel:)[^\s<>()]+|(?:linkedin|github|gitlab|behance|dribbble|leetcode)\.com\/[^\s<>()]+/gi;
const ADDRESS_LINE_PATTERN =
	/\b\d{1,6}\s+[A-Za-z0-9.'#\-\s]{2,}\s(?:street|st\.?|road|rd\.?|avenue|ave\.?|lane|ln\.?|drive|dr\.?|boulevard|blvd\.?|circle|cir\.?|court|ct\.?|way|place|pl\.?)\b[^\n]*/gi;
const MAX_RESUME_PDF_PAGES = 8;

type RedactionReason = "email" | "phone" | "link" | "name" | "address";

type RedactionMatch = {
	reason: RedactionReason;
	text: string;
};

type PageLine = {
	bbox: Rect;
	text: string;
};

type RedactionRect = {
	reason: RedactionReason;
	rect: Rect;
};

export type RedactionProfile = {
	email?: string | null;
	fullName?: string | null;
	username?: string | null;
};

export type RedactionResult = {
	bytes: Uint8Array;
	redactionCounts: Record<RedactionReason, number>;
};

const METADATA_KEYS = [
	mupdf.Document.META_INFO_AUTHOR,
	mupdf.Document.META_INFO_TITLE,
	mupdf.Document.META_INFO_SUBJECT,
	mupdf.Document.META_INFO_KEYWORDS,
	mupdf.Document.META_INFO_CREATOR,
	mupdf.Document.META_INFO_PRODUCER,
	mupdf.Document.META_INFO_CREATIONDATE,
	mupdf.Document.META_INFO_MODIFICATIONDATE,
];

function unique(values: string[]) {
	return Array.from(
		new Set(
			values
				.map((value) => value.replace(/\s+/g, " ").trim())
				.filter((value) => value.length >= 3),
		),
	);
}

function titleCaseName(value: string) {
	return value
		.split(/[\s._-]+/)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
		.join(" ");
}

export function buildNameRedactionCandidates(profile: RedactionProfile) {
	const candidates: string[] = [];
	const fullName = profile.fullName?.trim();
	const username = profile.username?.trim().replace(/^@+/, "");
	const emailLocalPart = profile.email?.split("@")[0]?.trim();

	if (fullName) candidates.push(fullName);
	if (username && /[a-z]/i.test(username)) candidates.push(titleCaseName(username));
	if (emailLocalPart && /[a-z]/i.test(emailLocalPart)) {
		candidates.push(titleCaseName(emailLocalPart));
	}

	return unique(
		candidates.filter((candidate) => {
			const words = candidate.split(/\s+/).filter(Boolean);
			return words.length >= 2 && words.length <= 5;
		}),
	);
}

function getPatternMatches(
	text: string,
	pattern: RegExp,
	reason: RedactionReason,
) {
	return Array.from(text.matchAll(pattern), (match) => ({
		reason,
		text: match[0],
	}));
}

function getPhoneMatches(text: string): RedactionMatch[] {
	const matches: RedactionMatch[] = [];

	for (const match of text.matchAll(PHONE_CANDIDATE_PATTERN)) {
		const digits = match[0].replace(/\D/g, "");
		if (digits.length >= 10 && digits.length <= 15) {
			matches.push({ reason: "phone", text: match[0] });
		}
	}

	return matches;
}

function getRedactionMatches(
	text: string,
	mode: ResumePrivacyMode,
	nameCandidates: string[],
) {
	if (mode === "public") return [];

	const matches: RedactionMatch[] = [
		...getPatternMatches(text, EMAIL_PATTERN, "email"),
		...getPhoneMatches(text),
		...getPatternMatches(text, ADDRESS_LINE_PATTERN, "address"),
		...nameCandidates
			.filter((name) => text.toLowerCase().includes(name.toLowerCase()))
			.map((name) => ({ reason: "name" as const, text: name })),
	];

	if (mode === "anonymous") {
		matches.push(...getPatternMatches(text, URL_PATTERN, "link"));
	}

	return unique(matches.map((match) => `${match.reason}:${match.text}`)).map(
		(serialized) => {
			const separator = serialized.indexOf(":");
			return {
				reason: serialized.slice(0, separator) as RedactionReason,
				text: serialized.slice(separator + 1),
			};
		},
	);
}

function quadToRect(quad: Quad): Rect {
	const xs = [quad[0], quad[2], quad[4], quad[6]];
	const ys = [quad[1], quad[3], quad[5], quad[7]];
	return [
		Math.min(...xs),
		Math.min(...ys),
		Math.max(...xs),
		Math.max(...ys),
	];
}

function expandRect(rect: Rect, padding = 1.5): Rect {
	return [
		rect[0] - padding,
		rect[1] - padding,
		rect[2] + padding,
		rect[3] + padding,
	];
}

function rectsIntersect(a: Rect, b: Rect) {
	return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

function collectLines(page: Page) {
	const lines: PageLine[] = [];
	let currentLine: PageLine | null = null;
	const structuredText = page.toStructuredText();

	structuredText.walk({
		beginLine(bbox) {
			currentLine = { bbox, text: "" };
		},
		onChar(character) {
			if (currentLine) currentLine.text += character;
		},
		endLine() {
			if (currentLine?.text.trim()) {
				lines.push({
					bbox: currentLine.bbox,
					text: currentLine.text.replace(/\s+/g, " ").trim(),
				});
			}
			currentLine = null;
		},
	});

	structuredText.destroy();
	return lines;
}

function findHeaderNameRects(
	lines: PageLine[],
	nameCandidates: string[],
	pageBounds: Rect,
) {
	const topLimit = pageBounds[1] + (pageBounds[3] - pageBounds[1]) * 0.22;
	const normalizedNames = nameCandidates.map((name) => name.toLowerCase());

	return lines
		.filter((line) => line.bbox[1] <= topLimit)
		.filter((line) => {
			const normalizedLine = line.text.toLowerCase();
			return normalizedNames.some((name) => normalizedLine.includes(name));
		})
		.map((line) => expandRect(line.bbox, 2.5));
}

function addRedactionRect(
	rects: RedactionRect[],
	counts: Record<RedactionReason, number>,
	reason: RedactionReason,
	rect: Rect,
) {
	if (rect[2] <= rect[0] || rect[3] <= rect[1]) return;
	rects.push({ reason, rect });
	counts[reason] += 1;
}

function removeSensitiveLinks(
	page: Page,
	mode: ResumePrivacyMode,
	redactionRects: RedactionRect[],
) {
	if (mode === "public") return;

	for (const link of page.getLinks()) {
		const uri = link.getURI();
		const linkRect = link.getBounds();
		const intersectsRedaction = redactionRects.some(({ rect }) =>
			rectsIntersect(rect, linkRect),
		);
		EMAIL_PATTERN.lastIndex = 0;
		const isContactLink = /^(mailto:|tel:)/i.test(uri) || EMAIL_PATTERN.test(uri);
		const shouldDelete =
			mode === "anonymous" || intersectsRedaction || isContactLink;

		EMAIL_PATTERN.lastIndex = 0;
		if (shouldDelete) page.deleteLink(link);
		link.destroy();
	}
}

function scrubMetadata(pdf: PDFDocument) {
	pdf.disableJS();
	for (const key of METADATA_KEYS) {
		pdf.setMetaData(key, "");
	}

	for (const filename of Object.keys(pdf.getEmbeddedFiles())) {
		pdf.deleteEmbeddedFile(filename);
	}

	const trailer = pdf.getTrailer();
	const root = trailer.get("Root");
	if (!root.isNull()) {
		root.delete("Metadata");
	}
	trailer.delete("Info");
}

function extractDocumentText(pdf: PDFDocument) {
	const pageTexts: string[] = [];

	for (let index = 0; index < pdf.countPages(); index += 1) {
		const page = pdf.loadPage(index);
		const structuredText = page.toStructuredText();
		pageTexts.push(structuredText.asText());
		structuredText.destroy();
		page.destroy();
	}

	return pageTexts.join("\n");
}

function assertNoForbiddenText(
	pdf: PDFDocument,
	mode: ResumePrivacyMode,
	nameCandidates: string[],
) {
	if (mode === "public") return;

	const text = extractDocumentText(pdf);
	const remaining = getRedactionMatches(text, mode, nameCandidates);
	if (remaining.length) {
		const labels = unique(remaining.map((match) => match.reason)).join(", ");
		throw new Error(`Unable to safely remove detected ${labels}.`);
	}
}

export async function redactResumePdf({
	bytes,
	mode,
	profile,
}: {
	bytes: Uint8Array;
	mode: ResumePrivacyMode;
	profile: RedactionProfile;
}): Promise<RedactionResult> {
	if (bytes.byteLength < 5) {
		throw new Error("The uploaded file is empty.");
	}

	const signature = new TextDecoder().decode(bytes.slice(0, 5));
	if (signature !== "%PDF-") {
		throw new Error("Upload a valid PDF file.");
	}

	const document = mupdf.Document.openDocument(bytes, "application/pdf");
	const pdf = document.asPDF() as PDFDocument | null;
	if (!pdf) {
		document.destroy();
		throw new Error("Upload a standard PDF file.");
	}

	const redactionCounts: Record<RedactionReason, number> = {
		address: 0,
		email: 0,
		link: 0,
		name: 0,
		phone: 0,
	};
	const nameCandidates = buildNameRedactionCandidates(profile);

	try {
		if (pdf.countPages() > MAX_RESUME_PDF_PAGES) {
			throw new Error(`Keep resume PDFs to ${MAX_RESUME_PDF_PAGES} pages or fewer.`);
		}

		scrubMetadata(pdf);

		for (let index = 0; index < pdf.countPages(); index += 1) {
			const page = pdf.loadPage(index);
			const structuredText = page.toStructuredText();
			const pageText = structuredText.asText();
			structuredText.destroy();

			const redactionRects: RedactionRect[] = [];
			const matches = getRedactionMatches(pageText, mode, nameCandidates);

			for (const match of matches) {
				for (const hit of page.search(match.text, 64)) {
					for (const quad of hit) {
						addRedactionRect(
							redactionRects,
							redactionCounts,
							match.reason,
							expandRect(quadToRect(quad)),
						);
					}
				}
			}

			if (mode !== "public" && index === 0 && nameCandidates.length) {
				for (const rect of findHeaderNameRects(
					collectLines(page),
					nameCandidates,
					page.getBounds(),
				)) {
					addRedactionRect(redactionRects, redactionCounts, "name", rect);
				}
			}

			for (const { rect } of redactionRects) {
				const annotation = page.createAnnotation("Redact");
				annotation.setRect(rect);
				annotation.update();
			}

			if (redactionRects.length) {
				page.applyRedactions(
					true,
					mupdf.PDFPage.REDACT_IMAGE_PIXELS,
					mupdf.PDFPage.REDACT_LINE_ART_REMOVE_IF_COVERED,
					mupdf.PDFPage.REDACT_TEXT_REMOVE,
				);
			}

			removeSensitiveLinks(page, mode, redactionRects);
			page.update();
			page.destroy();
		}

		assertNoForbiddenText(pdf, mode, nameCandidates);

		const output = pdf.saveToBuffer(
			"garbage=4,compress=yes,compress-images=yes,compress-fonts=yes,sanitize=yes",
		);
		const outputBytes = new Uint8Array(output.asUint8Array());
		output.destroy();

		return {
			bytes: outputBytes,
			redactionCounts,
		};
	} finally {
		pdf.destroy();
	}
}

export function buildRedactionProfileFromUser(
	user: Pick<User, "email" | "user_metadata">,
	profile?: RedactionProfile | null,
): RedactionProfile {
	return {
		email: user.email ?? profile?.email ?? null,
		fullName:
			profile?.fullName ??
			(user.user_metadata?.full_name as string | undefined) ??
			(user.user_metadata?.name as string | undefined) ??
			null,
		username:
			profile?.username ??
			(user.user_metadata?.user_name as string | undefined) ??
			(user.user_metadata?.preferred_username as string | undefined) ??
			null,
	};
}
