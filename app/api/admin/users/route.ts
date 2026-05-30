import { adminErrorResponse, requireAdmin } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function countByUserId(
	rows: Array<Record<string, string | null | undefined>>,
	column: string,
) {
	const counts = new Map<string, number>();

	for (const row of rows) {
		const userId = row[column];
		if (!userId) continue;
		counts.set(userId, (counts.get(userId) ?? 0) + 1);
	}

	return counts;
}

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

		const [
			resumesResult,
			roastsResult,
			votesResult,
			attachmentsResult,
			reportsResult,
			applicationsResult,
		] = userIds.length
			? await Promise.all([
					admin.from("resumes").select("user_id").in("user_id", userIds),
					admin.from("roasts").select("author_id").in("author_id", userIds),
					admin.from("votes").select("voter_id").in("voter_id", userIds),
					admin
						.from("comment_attachments")
						.select("user_id")
						.in("user_id", userIds),
					admin
						.from("content_reports")
						.select("reporter_id")
						.in("reporter_id", userIds),
					admin
						.from("reviewer_applications")
						.select("user_id")
						.in("user_id", userIds),
				])
			: [
					{ data: [], error: null },
					{ data: [], error: null },
					{ data: [], error: null },
					{ data: [], error: null },
					{ data: [], error: null },
					{ data: [], error: null },
				];

		for (const result of [
			resumesResult,
			roastsResult,
			votesResult,
			attachmentsResult,
			reportsResult,
			applicationsResult,
		]) {
			if (result.error) throw new Error(result.error.message);
		}

		const resumeCounts = countByUserId(resumesResult.data ?? [], "user_id");
		const roastCounts = countByUserId(roastsResult.data ?? [], "author_id");
		const voteCounts = countByUserId(votesResult.data ?? [], "voter_id");
		const attachmentCounts = countByUserId(
			attachmentsResult.data ?? [],
			"user_id",
		);
		const reportCounts = countByUserId(reportsResult.data ?? [], "reporter_id");
		const applicationCounts = countByUserId(
			applicationsResult.data ?? [],
			"user_id",
		);

		return Response.json({
			users: authUsers.map((authUser) => ({
				id: authUser.id,
				email: authUser.email ?? null,
				created_at: authUser.created_at ?? null,
				last_sign_in_at: authUser.last_sign_in_at ?? null,
				profile: profilesById.get(authUser.id) ?? null,
				dataFootprint: {
					attachments: attachmentCounts.get(authUser.id) ?? 0,
					reportsFiled: reportCounts.get(authUser.id) ?? 0,
					resumes: resumeCounts.get(authUser.id) ?? 0,
					reviewerApplications: applicationCounts.get(authUser.id) ?? 0,
					reviews: roastCounts.get(authUser.id) ?? 0,
					votes: voteCounts.get(authUser.id) ?? 0,
				},
			})),
		});
	} catch (error) {
		if (error instanceof Error && !(error as { status?: number }).status) {
			return Response.json({ message: error.message }, { status: 500 });
		}

		return adminErrorResponse(error);
	}
}
