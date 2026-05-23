import { describe, expect, it } from "vitest";
import mupdf from "mupdf";
import { redactResumePdf } from "@/lib/pdf-redaction";

function createResumePdf() {
	const document = new mupdf.PDFDocument();
	const font = new mupdf.Font("Helvetica");
	const fontObject = document.addSimpleFont(font);
	const contents = [
		"BT",
		"/F1 24 Tf 72 760 Td (Jane Doe) Tj",
		"/F1 12 Tf 0 -30 Td (jane.doe@example.com | +1 555 123 4567 | github.com/janedoe) Tj",
		"0 -28 Td (Built a GraphQL resume parser with PostgreSQL and React.) Tj",
		"ET",
	].join(" ");
	const page = document.addPage(
		[0, 0, 612, 792],
		0,
		{ Font: { F1: fontObject } },
		contents,
	);
	document.insertPage(0, page);
	const output = document.saveToBuffer("garbage=4,compress=yes");
	const bytes = new Uint8Array(output.asUint8Array());
	output.destroy();
	document.destroy();
	return bytes;
}

function extractText(bytes: Uint8Array) {
	const document = mupdf.Document.openDocument(bytes, "application/pdf");
	const pdf = document.asPDF();
	if (!pdf) throw new Error("Expected PDF");
	const page = pdf.loadPage(0);
	const structuredText = page.toStructuredText();
	const text = structuredText.asText();
	structuredText.destroy();
	page.destroy();
	pdf.destroy();
	return text;
}

describe("server PDF redaction", () => {
	it("hides direct contact details while preserving useful links", async () => {
		const result = await redactResumePdf({
			bytes: createResumePdf(),
			mode: "contact_hidden",
			profile: {
				email: "jane.doe@example.com",
				fullName: "Jane Doe",
				username: "jane_doe",
			},
		});
		const text = extractText(result.bytes);

		expect(text).not.toContain("Jane Doe");
		expect(text).not.toContain("jane.doe@example.com");
		expect(text).not.toContain("555 123 4567");
		expect(text).toContain("github.com/janedoe");
		expect(text).toContain("GraphQL resume parser");
	});

	it("hides profile links in anonymous mode", async () => {
		const result = await redactResumePdf({
			bytes: createResumePdf(),
			mode: "anonymous",
			profile: {
				email: "jane.doe@example.com",
				fullName: "Jane Doe",
				username: "jane_doe",
			},
		});
		const text = extractText(result.bytes);

		expect(text).not.toContain("github.com/janedoe");
		expect(text).toContain("GraphQL resume parser");
	});
});
