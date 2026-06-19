import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { capturePrivateError } from "@/lib/monitoring/capture-errors";
import { getAnonymousProfileUsername } from "@/lib/anonymous-profile";
import {
	buildRedactionProfileFromUser,
	redactResumePdf,
} from "@/lib/pdf-redaction";
import { isResumePrivacyMode } from "@/lib/resume-privacy";
import {
	JOB_DESCRIPTION_MAX_LENGTH,
	JOB_DESCRIPTION_MIN_LENGTH,
	POST_DESCRIPTION_MAX_LENGTH,
	POST_DESCRIPTION_MIN_LENGTH,
	TARGET_ROLES,
	cleanResumeFileName,
} from "@/lib/submit-validation";
import { enforceUploadSecurity } from "@/lib/server/upload-security";
import { verifyRazorpayPaymentSignature } from "@/lib/razorpay";
import { requireSignedInUser, serverAuthErrorResponse } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PDF_SIZE_BYTES = 5 * 1024 * 1024;

type SubmitProfile = {
	full_name: string | null;
	username: string | null;
};

function badRequest(message: string, status = 400) {
	return NextResponse.json({ message }, { status });
}

function getRequiredString(formData: FormData, key: string) {
	const value = formData.get(key);
	return typeof value === "string" ? value.trim() : "";
}

async function ensureProfile(admin: SupabaseClient, userId: string) {
	const existing = await admin
		.from("profiles")
		.select("id")
		.eq("id", userId)
		.maybeSingle();

	if (existing.data?.id) return null;
	if (existing.error) return existing.error;

	const insert = await admin.from("profiles").insert({
		id: userId,
		username: getAnonymousProfileUsername(userId),
	});

	if (insert.error && insert.error.code !== "23505") {
		return insert.error;
	}

	return null;
}

async function getProfile(
	admin: SupabaseClient,
	userId: string,
): Promise<SubmitProfile | null> {
	const result = await admin
		.from("profiles")
		.select("full_name,username")
		.eq("id", userId)
		.maybeSingle();

	if (result.error) return null;
	return result.data as SubmitProfile | null;
}

async function removeOrphanedFile(admin: SupabaseClient, filePath: string) {
	try {
		await admin.storage.from("resumes").remove([filePath]);
	} catch (error) {
		capturePrivateError(error, {
			area: "payments",
			operation: "cleanup_orphaned_premium_file",
			filePath,
		});
	}
}

export async function POST(request: Request) {
	let signedIn: Awaited<ReturnType<typeof requireSignedInUser>>;
	try {
		signedIn = await requireSignedInUser(request, {
			missingTokenMessage: "Sign in again to complete payment.",
			setupMessage: "Server payment setup is missing.",
		});
	} catch (error) {
		return serverAuthErrorResponse(error);
	}
	const { admin, user } = signedIn;

	let formData: FormData;
	try {
		formData = await request.formData();
	} catch {
		return badRequest("Submit the payment details as form data.");
	}

	const razorpayPaymentId = getRequiredString(formData, "razorpay_payment_id");
	const razorpayOrderId = getRequiredString(formData, "razorpay_order_id");
	const razorpaySignature = getRequiredString(formData, "razorpay_signature");

	if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
		return badRequest("Payment details are incomplete.");
	}

	// CRITICAL: Verify HMAC signature before any further processing.
	const signatureValid = verifyRazorpayPaymentSignature({
		orderId: razorpayOrderId,
		paymentId: razorpayPaymentId,
		signature: razorpaySignature,
	});

	if (!signatureValid) {
		capturePrivateError(new Error("Razorpay payment signature mismatch"), {
			area: "payments",
			operation: "verify_payment_signature",
			userId: user.id,
			orderId: razorpayOrderId,
		});
		return badRequest("Payment verification failed. Contact support if you were charged.", 400);
	}

	// Idempotency: the same order_id cannot create a second resume.
	const duplicate = await admin
		.from("resumes")
		.select("id")
		.eq("razorpay_order_id", razorpayOrderId)
		.maybeSingle();

	if (duplicate.data) {
		// Return the existing resume id so the client can redirect normally.
		return NextResponse.json({ id: duplicate.data.id, alreadyProcessed: true });
	}

	if (duplicate.error) {
		capturePrivateError(duplicate.error, {
			area: "payments",
			operation: "check_duplicate_order",
			userId: user.id,
			orderId: razorpayOrderId,
		});
		return badRequest("Could not verify payment status. Please try again.", 500);
	}

	// Validate resume form fields.
	const file = formData.get("file");
	const title = getRequiredString(formData, "title");
	const targetRole = getRequiredString(formData, "targetRole");
	const jobDescription = getRequiredString(formData, "jobDescription");
	const postDescription = getRequiredString(formData, "postDescription");
	const privacyMode = getRequiredString(formData, "privacyMode");

	if (!file || !(file instanceof File)) return badRequest("Upload a PDF resume.");
	if (file.type && file.type !== "application/pdf") return badRequest("Upload a PDF resume.");
	if (file.size > MAX_PDF_SIZE_BYTES) return badRequest("Keep the PDF under 5MB.");
	if (!title) return badRequest("Add a resume title.");
	if (!isResumePrivacyMode(privacyMode)) return badRequest("Choose a valid privacy mode.");
	if (!(TARGET_ROLES as readonly string[]).includes(targetRole)) {
		return badRequest("Choose a valid target role.");
	}
	if (
		jobDescription.length < JOB_DESCRIPTION_MIN_LENGTH ||
		jobDescription.length > JOB_DESCRIPTION_MAX_LENGTH
	) {
		return badRequest("Add a valid job description.");
	}
	if (
		postDescription.length < POST_DESCRIPTION_MIN_LENGTH ||
		postDescription.length > POST_DESCRIPTION_MAX_LENGTH
	) {
		return badRequest("Add what you want help with.");
	}

	const profileError = await ensureProfile(admin, user.id);
	if (profileError) {
		return NextResponse.json(
			{ message: "Could not set up your profile." },
			{ status: 500 },
		);
	}

	const profile = await getProfile(admin, user.id);
	const originalBytes = new Uint8Array(await file.arrayBuffer());

	const uploadSecurity = await enforceUploadSecurity(admin, {
		bytes: originalBytes,
		fileName: file.name,
		fileSize: file.size,
		mimeType: "application/pdf",
		uploadKind: "resume",
		userId: user.id,
	});

	if (!uploadSecurity.ok) {
		return badRequest(uploadSecurity.message, uploadSecurity.status);
	}

	let processedPdf: Awaited<ReturnType<typeof redactResumePdf>>;
	try {
		processedPdf = await redactResumePdf({
			bytes: originalBytes,
			mode: privacyMode,
			profile: buildRedactionProfileFromUser(user, {
				fullName: profile?.full_name ?? null,
				username: profile?.username ?? null,
			}),
		});
	} catch (error) {
		return badRequest(
			error instanceof Error ? error.message : "Could not safely process this PDF.",
			422,
		);
	}

	await admin.from("profiles").update({ target_role: targetRole }).eq("id", user.id);

	const filePath = `${user.id}/${Date.now()}-${cleanResumeFileName(file.name)}`;
	const upload = await admin.storage
		.from("resumes")
		.upload(filePath, processedPdf.bytes, {
			contentType: "application/pdf",
			upsert: false,
		});

	if (upload.error) {
		return NextResponse.json(
			{ message: "Resume upload failed. Please try again." },
			{ status: 500 },
		);
	}

	const insert = await admin.rpc("create_premium_resume", {
		target_user_id: user.id,
		resume_title: title,
		resume_file_path: filePath,
		resume_is_anonymous: privacyMode !== "public",
		resume_privacy_mode: privacyMode,
		resume_job_description: jobDescription,
		resume_post_description: postDescription,
		p_payment_id: razorpayPaymentId,
		p_razorpay_order_id: razorpayOrderId,
	});

	const insertedId = Array.isArray(insert.data)
		? (insert.data[0] as { id?: string } | undefined)?.id
		: (insert.data as { id?: string } | null)?.id;

	if (insert.error || !insertedId) {
		await removeOrphanedFile(admin, filePath);

		if (insert.error?.code === "23505") {
			return NextResponse.json(
				{ message: "This payment has already been processed." },
				{ status: 409 },
			);
		}

		capturePrivateError(insert.error ?? new Error("create_premium_resume returned no id"), {
			area: "payments",
			operation: "insert_premium_resume",
			userId: user.id,
			orderId: razorpayOrderId,
		});

		return NextResponse.json(
			{ message: "Payment verified but resume save failed. Contact support with your payment ID." },
			{ status: 500 },
		);
	}

	return NextResponse.json({
		id: insertedId,
		paymentStatus: "pending",
		redactionCounts: processedPdf.redactionCounts,
	});
}
