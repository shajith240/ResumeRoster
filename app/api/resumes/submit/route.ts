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

export const runtime = "nodejs";

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

	const profileError = await ensureSubmitProfile(admin, user);
	if (profileError) {
		return badRequest(`Profile setup failed: ${profileError.message}`, 500);
	}

	const profile = await getSubmitProfile(admin, user);
	const originalBytes = new Uint8Array(await file.arrayBuffer());
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

	const filePath = `${user.id}/${Date.now()}-${cleanResumeFileName(file.name)}`;
	const upload = await admin.storage.from("resumes").upload(filePath, processedPdf.bytes, {
		contentType: "application/pdf",
		upsert: false,
	});

	if (upload.error) {
		return badRequest(`Upload failed: ${upload.error.message}`, 500);
	}

	await admin.from("profiles").update({ target_role: targetRole }).eq("id", user.id);

	const insert = await admin
		.from("resumes")
		.insert({
			file_path: filePath,
			is_anonymous: privacyMode !== "public",
			job_description: jobDescription,
			post_description: postDescription,
			privacy_mode: privacyMode,
			title,
			user_id: user.id,
		})
		.select("id")
		.single();

	if (insert.error) {
		void admin.storage.from("resumes").remove([filePath]);
		return badRequest(`Upload failed: ${insert.error.message}`, 500);
	}

	return NextResponse.json({
		id: insert.data.id,
		privacyMode,
		redactionCounts: processedPdf.redactionCounts,
	});
}
