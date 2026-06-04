import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { capturePrivateError } from "@/lib/monitoring/capture-errors";

export const UPLOAD_QUARANTINE_BUCKET = "upload-quarantine";

export type UploadKind = "avatar" | "comment-media" | "resume";

export type UploadSecurityInput = {
	bytes: Uint8Array;
	fileName: string;
	fileSize: number;
	mimeType: string;
	uploadKind: UploadKind;
	userId: string;
};

export type UploadSecurityAllowed = {
	ok: true;
	sha256: string;
};

export type UploadSecurityBlocked = {
	ok: false;
	message: string;
	sha256: string;
	status: number;
	verdict: UploadScanVerdict;
};

export type UploadScanVerdict =
	| "clean"
	| "infected"
	| "scanner_error"
	| "suspicious"
	| "unscanned";

type UploadScanResult = {
	reason: string;
	scanner: string;
	verdict: UploadScanVerdict;
};

type UploadSecurityEnvironment = Record<string, string | undefined>;

const SCAN_TIMEOUT_MS = 8_000;
const EICAR_TEST_SIGNATURE = [
	"X5O!P%@AP[4\\PZX54(P^)7CC)7}$",
	"EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*",
].join("");

function bytesToBuffer(bytes: Uint8Array) {
	return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

export function getUploadSha256(bytes: Uint8Array) {
	return createHash("sha256").update(bytesToBuffer(bytes)).digest("hex");
}

function getScanMode(env: UploadSecurityEnvironment) {
	const configured = env.UPLOAD_MALWARE_SCAN_MODE?.toLowerCase().trim();
	if (configured === "off" || configured === "optional" || configured === "required") {
		return configured;
	}

	return process.env.NODE_ENV === "production" ? "required" : "optional";
}

function containsEicarTestSignature(bytes: Uint8Array) {
	const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
	return text.includes(EICAR_TEST_SIGNATURE);
}

function normalizeScannerVerdict(payload: unknown): UploadScanResult {
	const record =
		payload && typeof payload === "object"
			? (payload as Record<string, unknown>)
			: {};
	const rawVerdict = String(
		record.verdict ?? record.status ?? record.result ?? "",
	).toLowerCase();
	const scanner =
		typeof record.scanner === "string" && record.scanner.trim()
			? record.scanner.trim()
			: "configured_scanner";
	const reason =
		typeof record.reason === "string" && record.reason.trim()
			? record.reason.trim()
			: rawVerdict || "scanner response";

	if (
		record.clean === true ||
		record.malware === false ||
		["allow", "allowed", "clean", "ok", "pass", "passed"].includes(rawVerdict)
	) {
		return { reason, scanner, verdict: "clean" };
	}

	if (
		record.malware === true ||
		["blocked", "infected", "malicious", "virus"].includes(rawVerdict)
	) {
		return { reason, scanner, verdict: "infected" };
	}

	if (["risk", "suspicious", "warning"].includes(rawVerdict)) {
		return { reason, scanner, verdict: "suspicious" };
	}

	return {
		reason: "Scanner returned an unknown verdict.",
		scanner,
		verdict: "scanner_error",
	};
}

async function scanWithHttpService(
	input: UploadSecurityInput,
	env: UploadSecurityEnvironment,
): Promise<UploadScanResult> {
	const scannerUrl = env.UPLOAD_MALWARE_SCAN_URL?.trim();
	if (!scannerUrl) {
		const mode = getScanMode(env);
		return mode === "required"
			? {
					reason: "Malware scanner is not configured.",
					scanner: "not_configured",
					verdict: "unscanned",
				}
			: {
					reason: "Malware scanner is optional in this environment.",
					scanner: "not_configured",
					verdict: "clean",
				};
	}

	const timeoutMs = Math.max(
		1_000,
		Number(env.UPLOAD_MALWARE_SCAN_TIMEOUT_MS || SCAN_TIMEOUT_MS),
	);
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);
	const formData = new FormData();
	const scanBytes = new Uint8Array(input.bytes.byteLength);
	scanBytes.set(input.bytes);
	formData.set(
		"file",
		new Blob([scanBytes.buffer as ArrayBuffer], { type: input.mimeType }),
		input.fileName,
	);
	formData.set("kind", input.uploadKind);
	formData.set("mimeType", input.mimeType);
	formData.set("sha256", getUploadSha256(input.bytes));

	try {
		const response = await fetch(scannerUrl, {
			body: formData,
			headers: env.UPLOAD_MALWARE_SCAN_TOKEN
				? { Authorization: `Bearer ${env.UPLOAD_MALWARE_SCAN_TOKEN}` }
				: undefined,
			method: "POST",
			signal: controller.signal,
		});

		if (!response.ok) {
			return {
				reason: `Scanner HTTP ${response.status}.`,
				scanner: "configured_scanner",
				verdict: "scanner_error",
			};
		}

		const payload = await response.json().catch(() => null);
		return normalizeScannerVerdict(payload);
	} catch (error) {
		capturePrivateError(error, {
			area: "upload_security",
			operation: "malware_scan",
			route: input.uploadKind,
		});

		return {
			reason: "Scanner request failed.",
			scanner: "configured_scanner",
			verdict: "scanner_error",
		};
	} finally {
		clearTimeout(timeout);
	}
}

async function scanUploadForMalware(
	input: UploadSecurityInput,
	env: UploadSecurityEnvironment,
): Promise<UploadScanResult> {
	if (containsEicarTestSignature(input.bytes)) {
		return {
			reason: "EICAR antivirus test signature detected.",
			scanner: "local_eicar_guard",
			verdict: "infected",
		};
	}

	if (getScanMode(env) === "off") {
		return {
			reason: "Malware scanning disabled by configuration.",
			scanner: "disabled",
			verdict: "clean",
		};
	}

	return scanWithHttpService(input, env);
}

function getBlockedUploadMessage(verdict: UploadScanVerdict) {
	if (verdict === "infected" || verdict === "suspicious") {
		return "Upload blocked by security scanning. Choose a different file.";
	}

	return "Uploads are temporarily unavailable while security scanning is offline.";
}

function getBlockedUploadStatus(verdict: UploadScanVerdict) {
	return verdict === "infected" || verdict === "suspicious" ? 422 : 503;
}

function getQuarantineExtension(mimeType: string) {
	switch (mimeType) {
		case "application/pdf":
			return "pdf";
		case "image/jpeg":
			return "jpg";
		case "image/png":
			return "png";
		case "image/webp":
			return "webp";
		default:
			return "bin";
	}
}

async function recordUploadSecurityEvent(
	admin: SupabaseClient,
	input: UploadSecurityInput,
	scan: UploadScanResult,
	sha256: string,
	storagePath: string | null,
) {
	const { error } = await admin.from("upload_security_events").insert({
		file_size: input.fileSize,
		mime_type: input.mimeType,
		original_name: input.fileName,
		reason: scan.reason,
		scanner: scan.scanner,
		sha256,
		storage_bucket: storagePath ? UPLOAD_QUARANTINE_BUCKET : null,
		storage_path: storagePath,
		upload_kind: input.uploadKind,
		user_id: input.userId,
		verdict: scan.verdict,
	});

	if (error) {
		capturePrivateError(error, {
			area: "upload_security",
			operation: "record_upload_security_event",
			route: input.uploadKind,
		});
	}
}

async function quarantineUpload(
	admin: SupabaseClient,
	input: UploadSecurityInput,
	scan: UploadScanResult,
	sha256: string,
) {
	const extension = getQuarantineExtension(input.mimeType);
	const now = new Date();
	const storagePath = [
		input.uploadKind,
		input.userId,
		now.toISOString().slice(0, 10),
		`${sha256.slice(0, 16)}-${randomUUID()}.${extension}`,
	].join("/");

	const { error } = await admin.storage
		.from(UPLOAD_QUARANTINE_BUCKET)
		.upload(storagePath, input.bytes, {
			contentType: input.mimeType,
			upsert: false,
		});

	if (error) {
		capturePrivateError(error, {
			area: "upload_security",
			operation: "quarantine_upload",
			route: input.uploadKind,
		});
		await recordUploadSecurityEvent(admin, input, scan, sha256, null);
		return;
	}

	await recordUploadSecurityEvent(admin, input, scan, sha256, storagePath);
}

export async function enforceUploadSecurity(
	admin: SupabaseClient,
	input: UploadSecurityInput,
	env: UploadSecurityEnvironment = process.env,
): Promise<UploadSecurityAllowed | UploadSecurityBlocked> {
	const sha256 = getUploadSha256(input.bytes);
	const scan = await scanUploadForMalware(input, env);

	if (scan.verdict === "clean") {
		await recordUploadSecurityEvent(admin, input, scan, sha256, null);
		return { ok: true, sha256 };
	}

	await quarantineUpload(admin, input, scan, sha256);

	return {
		message: getBlockedUploadMessage(scan.verdict),
		ok: false,
		sha256,
		status: getBlockedUploadStatus(scan.verdict),
		verdict: scan.verdict,
	};
}
