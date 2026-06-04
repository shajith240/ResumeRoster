import { describe, expect, it, vi } from "vitest";
import {
	UPLOAD_QUARANTINE_BUCKET,
	enforceUploadSecurity,
	getUploadSha256,
} from "@/lib/server/upload-security";

const USER_ID = "11111111-1111-4111-8111-111111111111";

function getAdminMock() {
	const insert = vi.fn(async () => ({ data: null, error: null }));
	const upload = vi.fn(async () => ({ data: null, error: null }));

	return {
		admin: {
			from: vi.fn(() => ({ insert })),
			storage: {
				from: vi.fn(() => ({ upload })),
			},
		} as never,
		insert,
		upload,
	};
}

function getInput(bytes = new TextEncoder().encode("clean file")) {
	return {
		bytes,
		fileName: "resume.pdf",
		fileSize: bytes.byteLength,
		mimeType: "application/pdf",
		uploadKind: "resume" as const,
		userId: USER_ID,
	};
}

describe("upload security enforcement", () => {
	it("hashes uploaded bytes for scan and quarantine auditability", () => {
		expect(getUploadSha256(new TextEncoder().encode("abc"))).toBe(
			"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
		);
	});

	it("allows optional local uploads when no scanner is configured", async () => {
		const { admin, insert, upload } = getAdminMock();
		const result = await enforceUploadSecurity(admin, getInput(), {
			UPLOAD_MALWARE_SCAN_MODE: "optional",
		});

		expect(result.ok).toBe(true);
		expect(upload).not.toHaveBeenCalled();
		expect(insert).toHaveBeenCalledWith(
			expect.objectContaining({
				scanner: "not_configured",
				storage_path: null,
				verdict: "clean",
			}),
		);
	});

	it("fails closed and quarantines when production scanning is required but unavailable", async () => {
		const { admin, insert, upload } = getAdminMock();
		const result = await enforceUploadSecurity(admin, getInput(), {
			UPLOAD_MALWARE_SCAN_MODE: "required",
		});

		expect(result).toMatchObject({
			message:
				"Uploads are temporarily unavailable while security scanning is offline.",
			ok: false,
			status: 503,
			verdict: "unscanned",
		});
		expect(upload).toHaveBeenCalledTimes(1);
		const uploadCall = upload.mock.calls[0] as unknown as [
			string,
			unknown,
			Record<string, unknown>,
		];
		expect(uploadCall[0]).toContain(`resume/${USER_ID}/`);
		expect(ArrayBuffer.isView(uploadCall[1])).toBe(true);
		expect(uploadCall[2]).toMatchObject({
			contentType: "application/pdf",
			upsert: false,
		});
		expect(insert).toHaveBeenCalledWith(
			expect.objectContaining({
				scanner: "not_configured",
				storage_bucket: UPLOAD_QUARANTINE_BUCKET,
				verdict: "unscanned",
			}),
		);
	});

	it("blocks and quarantines the EICAR antivirus test signature", async () => {
		const { admin, insert, upload } = getAdminMock();
		const eicarBytes = new TextEncoder().encode(
			[
				"X5O!P%@AP[4\\PZX54(P^)7CC)7}$",
				"EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*",
			].join(""),
		);
		const result = await enforceUploadSecurity(admin, getInput(eicarBytes), {
			UPLOAD_MALWARE_SCAN_MODE: "optional",
		});

		expect(result).toMatchObject({
			message: "Upload blocked by security scanning. Choose a different file.",
			ok: false,
			status: 422,
			verdict: "infected",
		});
		expect(upload).toHaveBeenCalled();
		expect(insert).toHaveBeenCalledWith(
			expect.objectContaining({
				scanner: "local_eicar_guard",
				storage_bucket: UPLOAD_QUARANTINE_BUCKET,
				verdict: "infected",
			}),
		);
	});
});
