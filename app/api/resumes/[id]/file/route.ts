import { enforceRateLimit } from "@/lib/rate-limit";
import { requireSignedInUser, serverAuthErrorResponse } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
	params: Promise<{ id: string }>;
};

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

		const canPreview =
			resume &&
			(resume.user_id === user.id || ["open", "closed"].includes(resume.status));

		if (!canPreview) return notFound();

		const download = await admin.storage.from("resumes").download(resume.file_path);
		if (download.error || !download.data) {
			console.error("Resume file download failed", download.error);
			return Response.json(
				{ message: "We could not open this resume file." },
				{ status: 500 },
			);
		}

		return new Response(download.data, {
			headers: {
				"Cache-Control": "private, no-store, max-age=0",
				"Content-Disposition": 'inline; filename="resume.pdf"',
				"Content-Type": "application/pdf",
				"X-Content-Type-Options": "nosniff",
			},
		});
	} catch (error) {
		return serverAuthErrorResponse(error);
	}
}
