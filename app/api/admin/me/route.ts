import { adminErrorResponse, requireAdmin } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
	try {
		const { user } = await requireAdmin(request);
		return Response.json({
			email: user.email ?? null,
			id: user.id,
			isAdmin: true,
		});
	} catch (error) {
		return adminErrorResponse(error);
	}
}
