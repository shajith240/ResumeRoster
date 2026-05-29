import { enforceRateLimit } from "@/lib/rate-limit";
import { canPreviewResumeFile } from "@/lib/resume-file-access";
import { requireSignedInUser, serverAuthErrorResponse } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
	params: Promise<{ id: string }>;
};

const RESUME_FILE_SIGNED_URL_TTL_SECONDS = 5 * 60;
const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

function notFound() {
	return Response.json({ message: "Resume file not found." }, { status: 404 });
}

export async function GET(request: Request, context: RouteContext) {
	try {
		const { admin, user } = await requireSignedInUser(request);
		const { id } = await context.params;

		if (!UUID_PATTERN.test(id)) return notFound();

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
			.eq("id", id)
			.maybeSingle();

		if (resumeError) {
			console.error("Resume file lookup failed", resumeError);
			return Response.json(
				{ message: "We could not open this resume file." },
				{ status: 500 },
			);
		}

		if (
			!resume ||
			!canPreviewResumeFile({
				resumeOwnerId: resume.user_id,
				status: resume.status,
				userId: user.id,
			})
		) {
			return notFound();
		}

		const signed = await admin.storage
			.from("resumes")
			.createSignedUrl(resume.file_path, RESUME_FILE_SIGNED_URL_TTL_SECONDS);

		if (signed.error || !signed.data?.signedUrl) {
			console.error("Resume file signed URL failed", signed.error);
			return Response.json(
				{ message: "We could not open this resume file." },
				{ status: 500 },
			);
		}

		return Response.redirect(signed.data.signedUrl, 302);
	} catch (error) {
		return serverAuthErrorResponse(error);
	}
}

export async function HEAD(request: Request, context: RouteContext) {
	const response = await GET(request, context);

	if (response.status >= 300 && response.status < 400) {
		return new Response(null, {
			headers: {
				"Cache-Control": "private, no-store, max-age=0",
			},
			status: 200,
		});
	}

	return new Response(null, {
		headers: response.headers,
		status: response.status,
	});
}
