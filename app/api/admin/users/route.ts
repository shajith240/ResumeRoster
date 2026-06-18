import type { SupabaseClient, User } from "@supabase/supabase-js";
import { adminErrorResponse, requireAdmin } from "@/lib/admin";
import { internalErrorResponse } from "@/lib/api-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIVE_WINDOW_MS = 120_000;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 25;
const LATEST_USER_LIMIT = 10;
const ACTIVE_USER_LIMIT = 24;
const PRESENCE_FETCH_LIMIT = 100;
const AUTH_USER_FETCH_CONCURRENCY = 5;
const PROFILE_SELECT =
	"id,username,full_name,avatar_url,college,target_role,current_position,app_status,community_role,reviewer_type,reviewer_headline,reviewer_verification_status,roast_count,helpful_votes,created_at";

type ProfileRow = {
	id: string;
	username: string | null;
	full_name: string | null;
	avatar_url?: string | null;
	college?: string | null;
	target_role?: string | null;
	current_position?: string | null;
	app_status?: string | null;
	community_role?: string | null;
	reviewer_type?: string | null;
	reviewer_headline?: string | null;
	reviewer_verification_status?: string | null;
	roast_count?: number;
	helpful_votes?: number;
	created_at?: string;
};

type PresenceRow = {
	user_id: string;
	status: string;
	last_seen_at: string;
};

type AdminUserDataFootprint = {
	attachments: number;
	reportsFiled: number;
	resumes: number;
	reviewerApplications: number;
	reviews: number;
	votes: number;
};

type AdminUserRow = {
	id: string;
	email: string | null;
	created_at: string | null;
	last_sign_in_at: string | null;
	profile: ProfileRow | null;
	dataFootprint: AdminUserDataFootprint;
};

type AdminUserSearchPayload = {
	page: number;
	perPage: number;
	total: number;
	users: AdminUserRow[];
};

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

function getPositiveInt(value: string | null, fallback: number) {
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function clampPageSize(value: string | null) {
	return Math.min(getPositiveInt(value, DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
}

async function getProfilesById(admin: SupabaseClient, userIds: string[]) {
	if (!userIds.length) return new Map<string, ProfileRow>();

	const { data, error } = await admin
		.from("profiles")
		.select(PROFILE_SELECT)
		.in("id", userIds)
		.returns<ProfileRow[]>();

	if (error) throw new Error(error.message);

	return new Map((data ?? []).map((profile) => [profile.id, profile]));
}

async function getAuthUsersById(admin: SupabaseClient, userIds: string[]) {
	if (!userIds.length) return [];

	const authUsers: User[] = [];
	for (
		let index = 0;
		index < userIds.length;
		index += AUTH_USER_FETCH_CONCURRENCY
	) {
		const batch = userIds.slice(index, index + AUTH_USER_FETCH_CONCURRENCY);
		const results = await Promise.all(
			batch.map((userId) => admin.auth.admin.getUserById(userId)),
		);

		for (const result of results) {
			if (result.error) continue;
			if (result.data.user) {
				authUsers.push(result.data.user);
			}
		}
	}

	return authUsers;
}

async function buildAdminUsers(
	admin: SupabaseClient,
	authUsers: User[],
	knownProfilesById?: Map<string, ProfileRow>,
): Promise<AdminUserRow[]> {
	const userIds = authUsers.map((user) => user.id);
	const profilesById = knownProfilesById ?? (await getProfilesById(admin, userIds));

	const [
		resumesResult,
		reviewsResult,
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
		reviewsResult,
		votesResult,
		attachmentsResult,
		reportsResult,
		applicationsResult,
	]) {
		if (result.error) throw new Error(result.error.message);
	}

	const resumeCounts = countByUserId(resumesResult.data ?? [], "user_id");
	const reviewCounts = countByUserId(reviewsResult.data ?? [], "author_id");
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

	return authUsers.map((authUser) => ({
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
			reviews: reviewCounts.get(authUser.id) ?? 0,
			votes: voteCounts.get(authUser.id) ?? 0,
		},
	}));
}

function normalizeSearchPayload(
	data: unknown,
	fallbackPage: number,
	perPage: number,
): AdminUserSearchPayload {
	const payload = data as Partial<AdminUserSearchPayload> | null;
	const total =
		typeof payload?.total === "number" && Number.isFinite(payload.total)
			? payload.total
			: 0;
	const page =
		typeof payload?.page === "number" && Number.isFinite(payload.page)
			? payload.page
			: fallbackPage;
	const users = Array.isArray(payload?.users) ? payload.users : [];

	return {
		page,
		perPage,
		total,
		users,
	};
}

async function searchAdminUsers(
	admin: SupabaseClient,
	query: string,
	page: number,
	perPage: number,
) {
	const { data, error } = await admin
		.rpc("admin_search_users", {
			page_number: page,
			page_size: perPage,
			search_query: query,
		})
		.returns<AdminUserSearchPayload>();

	if (error) throw new Error("Unable to search admin users.");

	return normalizeSearchPayload(data, page, perPage);
}

async function getLatestUsers(admin: SupabaseClient) {
	const { data: profiles, error } = await admin
		.from("profiles")
		.select(PROFILE_SELECT)
		.order("created_at", { ascending: false })
		.limit(LATEST_USER_LIMIT)
		.returns<ProfileRow[]>();

	if (error) throw new Error(error.message);

	const profileRows = profiles ?? [];
	const authUsers = await getAuthUsersById(
		admin,
		profileRows.map((profile) => profile.id),
	);
	const rows = await buildAdminUsers(
		admin,
		authUsers,
		new Map(profileRows.map((profile) => [profile.id, profile])),
	);
	const rowsById = new Map(rows.map((row) => [row.id, row]));

	return profileRows
		.map((profile) => rowsById.get(profile.id))
		.filter((user): user is Awaited<ReturnType<typeof buildAdminUsers>>[number] =>
			Boolean(user),
		);
}

async function getActiveUsers(admin: SupabaseClient) {
	const activeSince = new Date(Date.now() - ACTIVE_WINDOW_MS).toISOString();
	const { data, error } = await admin
		.from("app_presence_sessions")
		.select("user_id,status,last_seen_at")
		.gte("last_seen_at", activeSince)
		.order("last_seen_at", { ascending: false })
		.limit(PRESENCE_FETCH_LIMIT)
		.returns<PresenceRow[]>();

	if (error) throw new Error(error.message);

	const deduped = new Map<string, PresenceRow>();
	for (const row of data ?? []) {
		if (!deduped.has(row.user_id)) {
			deduped.set(row.user_id, row);
		}
	}

	const presenceRows = Array.from(deduped.values()).slice(0, ACTIVE_USER_LIMIT);
	const userIds = presenceRows.map((row) => row.user_id);
	const [profilesById, authUsers] = await Promise.all([
		getProfilesById(admin, userIds),
		getAuthUsersById(admin, userIds),
	]);
	const authUsersById = new Map(authUsers.map((user) => [user.id, user]));

	return presenceRows.map((presence) => ({
		email: authUsersById.get(presence.user_id)?.email ?? null,
		lastSeenAt: presence.last_seen_at,
		profile: profilesById.get(presence.user_id) ?? null,
		status: presence.status,
		userId: presence.user_id,
	}));
}

async function getProfilePage(
	admin: SupabaseClient,
	page: number,
	perPage: number,
) {
	const from = (page - 1) * perPage;
	const to = from + perPage - 1;
	const { count, data, error } = await admin
		.from("profiles")
		.select(PROFILE_SELECT, { count: "exact" })
		.order("created_at", { ascending: false })
		.range(from, to)
		.returns<ProfileRow[]>();

	if (error) throw new Error(error.message);

	return {
		profiles: data ?? [],
		total: count ?? 0,
	};
}

export async function GET(request: Request) {
	try {
		const { admin } = await requireAdmin(request);
		const url = new URL(request.url);
		const page = getPositiveInt(url.searchParams.get("page"), 1);
		const perPage = clampPageSize(url.searchParams.get("perPage"));
		const query = (url.searchParams.get("query") ?? "").trim().toLowerCase();

		let users: AdminUserRow[] = [];
		let currentPage = page;
		let pageProfilesById = new Map<string, ProfileRow>();
		let total = 0;
		let lastPage = 1;

		if (query) {
			const searchResult = await searchAdminUsers(admin, query, page, perPage);
			users = searchResult.users;
			total = searchResult.total;
			lastPage = Math.max(1, Math.ceil(total / perPage));
			currentPage = Math.min(searchResult.page, lastPage);
		} else {
			let profilePage = await getProfilePage(admin, page, perPage);
			total = profilePage.total;
			lastPage = Math.max(1, Math.ceil(total / perPage));
			currentPage = Math.min(page, lastPage);

			if (currentPage !== page) {
				profilePage = await getProfilePage(admin, currentPage, perPage);
			}

			pageProfilesById = new Map(
				profilePage.profiles.map((profile) => [profile.id, profile]),
			);
			const authUsers = await getAuthUsersById(
				admin,
				profilePage.profiles.map((profile) => profile.id),
			);
			users = await buildAdminUsers(admin, authUsers, pageProfilesById);
		}

		const [latestUsers, activeUsers] = await Promise.all([
			getLatestUsers(admin),
			getActiveUsers(admin),
		]);

		const from = total ? (currentPage - 1) * perPage + 1 : 0;
		const to = total ? Math.min(currentPage * perPage, total) : 0;

		return Response.json({
			activeUsers,
			latestUsers,
			pagination: {
				from,
				hasNextPage: currentPage < lastPage,
				hasPreviousPage: currentPage > 1,
				lastPage,
				page: currentPage,
				perPage,
				to,
				total,
			},
			query,
			users,
		});
	} catch (error) {
		if (error instanceof Error && !(error as { status?: number }).status) {
			return internalErrorResponse(error, {
				context: {
					area: "admin",
					operation: "list_users",
					route: "GET /api/admin/users",
				},
				publicMessage: "Admin users could not be loaded.",
			});
		}

		return adminErrorResponse(error);
	}
}
