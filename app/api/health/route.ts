export const dynamic = "force-dynamic";

export function GET() {
	return Response.json(
		{
			status: "ok",
			service: "linted",
			environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
			commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
			checked_at: new Date().toISOString(),
		},
		{
			headers: {
				"Cache-Control": "no-store",
			},
		},
	);
}
