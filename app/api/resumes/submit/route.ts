import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { redactResumePdf } from "@/lib/pdf-redaction";
import { enforceRateLimit } from "@/lib/rate-limit";
import { isResumePrivacyMode } from "@/lib/resume-privacy";
import { requireSignedInUser, serverAuthErrorResponse } from "@/lib/server-auth";
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

function getMetadataName(user: User) {
	return (
		(user.user_metadata?.full_name as string | undefined) ||
		(user.user_metadata?.name as string | undefined) ||
		null
	);
}

function getMetadataAvatar(user: User) {
	return (
		(user.user_metadata?.avatar_url as string | undefined) ||
		(user.user_metadata?.picture as string | undefined) ||
		null
	);
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
		full_name: getMetadataName(activeUser),
		avatar_url: getMetadataAvatar(activeUser),
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
	try {
		const { admin, user } = await requireSignedInUser(request);
		await enforceRateLimit(admin, {
			action: "resume_submit",
			limit: 4,
			request,
			userId: user.id,
			windowSeconds: 60 * 60,
		});

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
		console.error("Resume submit profile setup failed", profileError);
		return badRequest("We could not prepare your profile for this upload.", 500);
	}

	const profile = await getSubmitProfile(admin, user);
	const originalBytes = new Uint8Array(await file.arrayBuffer());
	let processedPdf: Awaited<ReturnType<typeof redactResumePdf>>;

	try {
		processedPdf = await redactResumePdf({
			bytes: originalBytes,
			mode: privacyMode,
			profile: {
				email: user.email,
				fullName:
					profile?.full_name ??
					(user.user_metadata?.full_name as string | undefined) ??
					(user.user_metadata?.name as string | undefined) ??
					null,
				username:
					profile?.username ??
					(user.user_metadata?.user_name as string | undefined) ??
					(user.user_metadata?.preferred_username as string | undefined) ??
					null,
			},
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
		console.error("Resume PDF upload failed", upload.error);
		return badRequest("We could not upload this resume.", 500);
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
		console.error("Resume row insert failed", insert.error);
		return badRequest("We could not save this resume.", 500);
	}

	return NextResponse.json({
		id: insert.data.id,
		privacyMode,
		redactionCounts: processedPdf.redactionCounts,
	});
	} catch (error) {
		return serverAuthErrorResponse(error);
	}
}
