import { adminErrorResponse, requireAdmin } from "@/lib/admin";
import { internalErrorResponse } from "@/lib/api-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function uniqueIds(values: Array<string | null | undefined>) {
	return Array.from(new Set(values.filter(Boolean) as string[]));
}

export async function GET(request: Request) {
	try {
		const { admin } = await requireAdmin(request);
		const url = new URL(request.url);
		const limit = Math.min(Number(url.searchParams.get("limit") ?? 30) || 30, 80);

		const { data: actions, error } = await admin
			.from("moderation_actions")
			.select(
				"id,admin_user_id,action,target_type,target_id,report_id,reason,metadata,created_at",
			)
			.order("created_at", { ascending: false })
			.limit(limit);

		if (error) throw new Error(error.message);

		const rows = actions ?? [];
		const profileIds = uniqueIds(rows.map((action) => action.admin_user_id));
		const profilesResult = profileIds.length
			? await admin
					.from("profiles")
					.select("id,username,full_name,avatar_url")
					.in("id", profileIds)
			: { data: [], error: null };

		if (profilesResult.error) throw new Error(profilesResult.error.message);

		const profilesById = new Map(
			(profilesResult.data ?? []).map((profile) => [profile.id, profile]),
		);

		return Response.json({
			actions: rows.map((action) => ({
				...action,
				adminProfile: action.admin_user_id
					? profilesById.get(action.admin_user_id) ?? null
					: null,
			})),
		});
	} catch (error) {
		if (error instanceof Error && !(error as { status?: number }).status) {
			return internalErrorResponse(error, {
				context: {
					area: "admin",
					operation: "list_audit_actions",
					route: "GET /api/admin/actions",
				},
				publicMessage: "Admin audit actions could not be loaded.",
			});
		}

		return adminErrorResponse(error);
	}
}
