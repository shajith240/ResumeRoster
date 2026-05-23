import { describe, expect, it } from "vitest";
import {
	cleanResumeFileName,
	formatFileSize,
	getSubmitIssue,
} from "@/lib/submit-validation";

describe("submit validation", () => {
	it("requires a title before anything else", () => {
		expect(
			getSubmitIssue({
				title: "   ",
				hasFile: false,
				jobDescription: "",
				postDescription: "",
			}),
		).toBe("Add a resume title.");
	});

	it("requires a PDF after the title is present", () => {
		expect(
			getSubmitIssue({
				title: "Backend internship resume",
				hasFile: false,
				jobDescription: "A detailed backend internship role.",
				postDescription: "Review my project bullets.",
			}),
		).toBe("Upload a PDF resume.");
	});

	it("reports remaining JD and ask characters", () => {
		expect(
			getSubmitIssue({
				title: "Backend internship resume",
				hasFile: true,
				jobDescription: "short",
				postDescription: "Review my bullets.",
			}),
		).toBe("Add 15 more characters to the job description.");

		expect(
			getSubmitIssue({
				title: "Backend internship resume",
				hasFile: true,
				jobDescription: "This is a detailed job description.",
				postDescription: "short",
			}),
		).toBe("Add 5 more characters to what you want help with.");
	});

	it("blocks submit while PDF privacy checks are unresolved", () => {
		expect(
			getSubmitIssue({
				title: "Backend internship resume",
				hasFile: true,
				jobDescription: "This is a detailed backend internship role.",
				postDescription: "Review my project bullets.",
				privacyIssue: "Remove detected contact details from the PDF.",
			}),
		).toBe("Remove detected contact details from the PDF.");
	});

	it("returns no issue when all required fields are valid", () => {
		expect(
			getSubmitIssue({
				title: "Backend internship resume",
				hasFile: true,
				jobDescription: "This is a detailed backend internship JD.",
				postDescription: "Review project impact and ATS keywords.",
			}),
		).toBe("");
	});

	it("normalizes uploaded file names without changing extension", () => {
		expect(cleanResumeFileName("My Resume Final (2).PDF")).toBe(
			"my-resume-final-2-.pdf",
		);
	});

	it("formats file sizes in megabytes", () => {
		expect(formatFileSize(1_572_864)).toBe("1.50 MB");
	});
});
