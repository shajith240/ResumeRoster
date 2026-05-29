import { createAuthorizedResumeFileSignedUrl } from "@/lib/resume-file-server";
import { serverAuthErrorResponse } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
	params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
	try {
		const { id } = await context.params;
		const result = await createAuthorizedResumeFileSignedUrl(request, id);

		if ("response" in result) return result.response;

		return Response.json(
			{ signedUrl: result.signedUrl },
			{
				headers: {
					"Cache-Control": "private, no-store, max-age=0",
				},
			},
		);
	} catch (error) {
		return serverAuthErrorResponse(error);
	}
}
