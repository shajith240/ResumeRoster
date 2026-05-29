import { enforceRateLimit } from "@/lib/rate-limit";
import { canPreviewResumeFile } from "@/lib/resume-file-access";
import { requireSignedInUser } from "@/lib/server-auth";

export const RESUME_FILE_SIGNED_URL_TTL_SECONDS = 5 * 60;

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

type AuthorizedResumeFileResult =
	| {
			response: Response;
	  }
	| {
			signedUrl: string;
	  };

function notFound() {
	return Response.json({ message: "Resume file not found." }, { status: 404 });
}

export async function createAuthorizedResumeFileSignedUrl(
	request: Request,
	resumeId: string,
): Promise<AuthorizedResumeFileResult> {
	const { admin, user } = await requireSignedInUser(request);

	if (!UUID_PATTERN.test(resumeId)) {
		return { response: notFound() };
	}

	await enforceRateLimit(admin, {
		action: "resume_file_preview",
		limit: 240,
		request,
		userId: user.id,
		windowSeconds: 10 * 60,
	});

	const { data: resume, error: resumeError } = await admin
		.from("resumes")
		.select("id,user_id,file_path,status")
		.eq("id", resumeId)
		.maybeSingle();

	if (resumeError) {
		console.error("Resume file lookup failed", resumeError);
		return {
			response: Response.json(
				{ message: "We could not open this resume file." },
				{ status: 500 },
			),
		};
	}

	if (
		!resume ||
		!canPreviewResumeFile({
			resumeOwnerId: resume.user_id,
			status: resume.status,
			userId: user.id,
		})
	) {
		return { response: notFound() };
	}

	const signed = await admin.storage
		.from("resumes")
		.createSignedUrl(resume.file_path, RESUME_FILE_SIGNED_URL_TTL_SECONDS);

	if (signed.error || !signed.data?.signedUrl) {
		console.error("Resume file signed URL failed", signed.error);
		return {
			response: Response.json(
				{ message: "We could not open this resume file." },
				{ status: 500 },
			),
		};
	}

	return { signedUrl: signed.data.signedUrl };
}
