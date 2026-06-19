import { NextResponse } from "next/server";
import {
	buildRedactionProfileFromUser,
	redactResumePdf,
} from "@/lib/pdf-redaction";
import { cleanResumeFileName } from "@/lib/submit-validation";

const MAX_PDF_SIZE_BYTES = 5 * 1024 * 1024;
import { enforceUploadSecurity } from "@/lib/server/upload-security";
import { capturePrivateError } from "@/lib/monitoring/capture-errors";
import { requireSignedInUser, serverAuthErrorResponse } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
	params: Promise<{ id: string }>;
};

function badRequest(message: string, status = 400) {
	return NextResponse.json({ message }, { status });
}

export async function PATCH(request: Request, context: RouteContext) {
	let signedIn: Awaited<ReturnType<typeof requireSignedInUser>>;
	try {
		signedIn = await requireSignedInUser(request, {
			missingTokenMessage: "Sign in to replace your resume.",
			setupMessage: "Server setup is missing.",
		});
	} catch (error) {
		return serverAuthErrorResponse(error);
	}
	const { admin, user } = signedIn;
	const { id: resumeId } = await context.params;

	let formData: FormData;
	try {
		formData = await request.formData();
	} catch {
		return badRequest("Upload the new PDF as form data.");
	}

	const file = formData.get("file");
	if (!file || !(file instanceof File)) {
		return badRequest("Upload a PDF file.");
	}
	if (file.type && file.type !== "application/pdf") {
		return badRequest("Only PDF files are accepted.");
	}
	if (file.size > MAX_PDF_SIZE_BYTES) {
		return badRequest("Keep the PDF under 5MB.");
	}

	// Fetch the resume — verify ownership and get current state.
	const resumeResult = await admin
		.from("resumes")
		.select("id,user_id,file_path,privacy_mode,is_anonymous,status,is_premium")
		.eq("id", resumeId)
		.maybeSingle();

	if (resumeResult.error) {
		capturePrivateError(resumeResult.error, {
			area: "uploads",
			operation: "replace_pdf_fetch_resume",
			resumeId,
			userId: user.id,
		});
		return badRequest("Could not load resume.", 500);
	}

	if (!resumeResult.data) {
		return badRequest("Resume not found.", 404);
	}

	const resume = resumeResult.data;

	if (resume.user_id !== user.id) {
		return badRequest("You can only replace your own resume.", 403);
	}

	if (resume.status !== "open") {
		return badRequest("You can only replace the PDF on an open resume.", 409);
	}

	// Fetch the owner's profile for redaction metadata.
	const profileResult = await admin
		.from("profiles")
		.select("full_name,username")
		.eq("id", user.id)
		.maybeSingle();

	const profile = profileResult.data;

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
			mode: resume.privacy_mode ?? (resume.is_anonymous ? "anonymous" : "public"),
			profile: buildRedactionProfileFromUser(user, {
				fullName: profile?.full_name ?? null,
				username: profile?.username ?? null,
			}),
		});
	} catch (error) {
		return badRequest(
			error instanceof Error ? error.message : "We could not safely process this PDF.",
			422,
		);
	}

	const newFilePath = `${user.id}/${Date.now()}-${cleanResumeFileName(file.name)}`;
	const upload = await admin.storage.from("resumes").upload(newFilePath, processedPdf.bytes, {
		contentType: "application/pdf",
		upsert: false,
	});

	if (upload.error) {
		capturePrivateError(upload.error, {
			area: "uploads",
			operation: "replace_pdf_storage_upload",
			resumeId,
			userId: user.id,
		});
		return badRequest("Upload failed. Please try again.", 500);
	}

	// Update the DB before removing the old file.
	const oldFilePath = resume.file_path;
	const dbUpdate = await admin
		.from("resumes")
		.update({ file_path: newFilePath })
		.eq("id", resumeId)
		.eq("user_id", user.id);

	if (dbUpdate.error) {
		capturePrivateError(dbUpdate.error, {
			area: "uploads",
			operation: "replace_pdf_db_update",
			resumeId,
			userId: user.id,
		});
		// Clean up the just-uploaded file since DB update failed.
		void admin.storage.from("resumes").remove([newFilePath]);
		return badRequest("Could not save the new file. Please try again.", 500);
	}

	// Remove old file — best-effort, non-blocking.
	if (oldFilePath) {
		void admin.storage.from("resumes").remove([oldFilePath]).catch((error) => {
			capturePrivateError(error, {
				area: "uploads",
				operation: "replace_pdf_old_file_cleanup",
				resumeId,
				oldFilePath,
			});
		});
	}

	return NextResponse.json({ replaced: true, filePath: newFilePath });
}
