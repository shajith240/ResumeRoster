import { NextResponse } from "next/server";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
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
import { enforceApiRateLimit } from "@/lib/server/rate-limit";
import { enforceUploadSecurity } from "@/lib/server/upload-security";

export const runtime = "nodejs";

const MAX_PDF_SIZE_BYTES = 5 * 1024 * 1024;
const RESUME_SUBMIT_FAILED_MESSAGE =
	"Resume upload failed. Please try again.";
const RESUME_PROFILE_UPDATE_FAILED_MESSAGE =
	"We could not save your target role. Please try again.";

type SubmitProfile = {
	full_name: string | null;
	username: string | null;
};

type QueuedResumeInsertResult = {
	activation_reviews_completed?: number;
	activation_reviews_required?: number;
	id: string;
	review_queue_status?: string;
};

function badRequest(message: string, status = 400) {
	return NextResponse.json({ message }, { status });
}

function serverFailure(message = RESUME_SUBMIT_FAILED_MESSAGE) {
	return badRequest(message, 500);
}

function isMissingQueueRpc(message: string) {
	return /create_resume_with_review_queue|review_queue_status|activation_reviews_|schema cache|function|column/i.test(
		message,
	);
}

function getRequiredString(formData: FormData, key: string) {
	const value = formData.get(key);
	return typeof value === "string" ? value.trim() : "";
}

function getBearerToken(request: Request) {
	const authorization = request.headers.get("authorization") ?? "";
	const [scheme, token] = authorization.split(/\s+/);
	return /^bearer$/i.test(scheme) && token ? token : "";
}

async function ensureSubmitProfile(
	admin: SupabaseClient,
	activeUser: User,
) {
	const existingProfile = await admin
		.from("profiles")
		.select("id")
		.eq("id", activeUser.id)
		.maybeSingle();

	if (existingProfile.data?.id) return null;
	if (existingProfile.error) return existingProfile.error;

	const insertProfile = await admin.from("profiles").insert({
		id: activeUser.id,
		username: getAnonymousProfileUsername(activeUser.id),
	});

	if (insertProfile.error && insertProfile.error.code !== "23505") {
		return insertProfile.error;
	}

	return null;
}

async function getSubmitProfile(
	admin: SupabaseClient,
	activeUser: User,
) {
	const result = await admin
		.from("profiles")
		.select("full_name,username")
		.eq("id", activeUser.id)
		.maybeSingle();

	if (result.error) return null;
	return result.data as SubmitProfile | null;
}

async function removeUploadedFile(
	admin: SupabaseClient,
	bucket: string,
	filePath: string,
) {
	try {
		await admin.storage.from(bucket).remove([filePath]);
	} catch {
		// The client still gets the original upload failure response.
	}
}

async function insertResumeWithQueue({
	admin,
	filePath,
	jobDescription,
	privacyMode,
	title,
	userId,
	postDescription,
}: {
	admin: SupabaseClient;
	filePath: string;
	jobDescription: string;
	privacyMode: string;
	title: string;
	userId: string;
	postDescription: string;
}) {
	const queuedInsert = await admin.rpc("create_resume_with_review_queue", {
		resume_file_path: filePath,
		resume_is_anonymous: privacyMode !== "public",
		resume_job_description: jobDescription,
		resume_post_description: postDescription,
		resume_privacy_mode: privacyMode,
		resume_title: title,
		target_user_id: userId,
	});

	if (!queuedInsert.error) {
		const row = Array.isArray(queuedInsert.data)
			? queuedInsert.data[0]
			: queuedInsert.data;

		return {
			data: row as QueuedResumeInsertResult | null,
			error: null,
		};
	}

	if (!isMissingQueueRpc(queuedInsert.error.message)) {
		return {
			data: null,
			error: queuedInsert.error,
		};
	}

	const fallbackInsert = await admin
		.from("resumes")
		.insert({
			file_path: filePath,
			is_anonymous: privacyMode !== "public",
			job_description: jobDescription,
			post_description: postDescription,
			privacy_mode: privacyMode,
			title,
			user_id: userId,
		})
		.select("id")
		.single();

	return {
		data: fallbackInsert.data
			? ({
					id: fallbackInsert.data.id,
					review_queue_status: "active",
					activation_reviews_completed: 0,
					activation_reviews_required: 0,
				} satisfies QueuedResumeInsertResult)
			: null,
		error: fallbackInsert.error,
	};
}

export async function POST(request: Request) {
	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

	if (!supabaseUrl || !serviceRoleKey) {
		return badRequest("Server submit setup is missing.", 503);
	}

	const token = getBearerToken(request);
	if (!token) {
		return badRequest("Sign in again before submitting.", 401);
	}

	const admin = createClient(supabaseUrl, serviceRoleKey, {
		auth: {
			autoRefreshToken: false,
			persistSession: false,
		},
	});

	const {
		data: { user },
		error: userError,
	} = await admin.auth.getUser(token);

	if (userError || !user) {
		return badRequest("Your session expired. Sign in again.", 401);
	}

	let formData: FormData;
	try {
		formData = await request.formData();
	} catch {
		return badRequest("Submit the resume as form data.");
	}

	const file = formData.get("file");
	const title = getRequiredString(formData, "title");
	const targetRole = getRequiredString(formData, "targetRole");
	const jobDescription = getRequiredString(formData, "jobDescription");
	const postDescription = getRequiredString(formData, "postDescription");
	const privacyMode = getRequiredString(formData, "privacyMode");

	if (!file || !(file instanceof File)) {
		return badRequest("Upload a PDF resume.");
	}

	if (file.type && file.type !== "application/pdf") {
		return badRequest("Upload a PDF resume.");
	}

	if (file.size > MAX_PDF_SIZE_BYTES) {
		return badRequest("Keep the PDF under 5MB.");
	}

	if (!title) {
		return badRequest("Add a resume title.");
	}

	if (!isResumePrivacyMode(privacyMode)) {
		return badRequest("Choose a valid privacy mode.");
	}

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

	const rateLimitResponse = await enforceApiRateLimit(
		admin,
		user.id,
		"resumeSubmit",
	);
	if (rateLimitResponse) return rateLimitResponse;

	const profileError = await ensureSubmitProfile(admin, user);
	if (profileError) {
		return serverFailure();
	}

	const profile = await getSubmitProfile(admin, user);
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
			error instanceof Error
				? error.message
				: "We could not safely process this PDF.",
			422,
		);
	}

	const profileUpdate = await admin
		.from("profiles")
		.update({ target_role: targetRole })
		.eq("id", user.id);

	if (profileUpdate.error) {
		return serverFailure(RESUME_PROFILE_UPDATE_FAILED_MESSAGE);
	}

	const filePath = `${user.id}/${Date.now()}-${cleanResumeFileName(file.name)}`;
	const upload = await admin.storage.from("resumes").upload(filePath, processedPdf.bytes, {
		contentType: "application/pdf",
		upsert: false,
	});

	if (upload.error) {
		return serverFailure();
	}

	const insert = await insertResumeWithQueue({
		admin,
		filePath,
		jobDescription,
		postDescription,
		privacyMode,
		title,
		userId: user.id,
	});

	if (insert.error || !insert.data?.id) {
		await removeUploadedFile(admin, "resumes", filePath);
		return serverFailure();
	}

	return NextResponse.json({
		activationReviewsCompleted: insert.data?.activation_reviews_completed ?? 0,
		activationReviewsRequired: insert.data?.activation_reviews_required ?? 0,
		id: insert.data?.id,
		privacyMode,
		reviewQueueStatus: insert.data?.review_queue_status ?? "active",
		redactionCounts: processedPdf.redactionCounts,
	});
}
