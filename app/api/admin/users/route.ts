import { adminErrorResponse, requireAdmin } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
	try {
		const { admin } = await requireAdmin(request);
		const url = new URL(request.url);
		const limit = Math.min(Number(url.searchParams.get("limit") ?? 80) || 80, 100);

		const { data: authData, error: authError } =
			await admin.auth.admin.listUsers({
				page: 1,
				perPage: limit,
			});

		if (authError) throw new Error(authError.message);

		const authUsers = authData.users ?? [];
		const userIds = authUsers.map((user) => user.id);

		const profilesResult = userIds.length
			? await admin
					.from("profiles")
					.select(
						"id,username,full_name,avatar_url,college,target_role,current_position,app_status,community_role,reviewer_type,reviewer_headline,reviewer_verification_status,roast_count,helpful_votes,created_at",
					)
					.in("id", userIds)
			: { data: [], error: null };

		if (profilesResult.error) throw new Error(profilesResult.error.message);

		const profilesById = new Map(
			(profilesResult.data ?? []).map((profile) => [profile.id, profile]),
		);

		return Response.json({
			users: authUsers.map((authUser) => ({
				id: authUser.id,
				email: authUser.email ?? null,
				created_at: authUser.created_at ?? null,
				last_sign_in_at: authUser.last_sign_in_at ?? null,
				profile: profilesById.get(authUser.id) ?? null,
			})),
		});
	} catch (error) {
		if (error instanceof Error && !(error as { status?: number }).status) {
			return Response.json({ message: error.message }, { status: 500 });
		}

		return adminErrorResponse(error);
	}
}
