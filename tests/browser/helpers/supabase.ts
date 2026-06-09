import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Page, Route } from "@playwright/test";
import { expect } from "@playwright/test";

const TEST_USER_ID = "11111111-1111-4111-8111-111111111111";
const TEST_USER_EMAIL = "candidate@example.com";
const TEST_ACCESS_TOKEN = "e2e-access-token";
const TEST_REFRESH_TOKEN = "e2e-refresh-token";
const TEST_RESUME_OWNER_ID = "99999999-aaaa-4aaa-8aaa-999999999999";

const TEST_USER = {
	app_metadata: {},
	aud: "authenticated",
	confirmed_at: "2026-06-01T00:00:00.000Z",
	created_at: "2026-06-01T00:00:00.000Z",
	email: TEST_USER_EMAIL,
	email_confirmed_at: "2026-06-01T00:00:00.000Z",
	id: TEST_USER_ID,
	role: "authenticated",
	updated_at: "2026-06-01T00:00:00.000Z",
	user_metadata: {},
};

const TEST_SESSION = {
	access_token: TEST_ACCESS_TOKEN,
	expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
	expires_in: 60 * 60,
	refresh_token: TEST_REFRESH_TOKEN,
	token_type: "bearer",
	user: TEST_USER,
};

type SupabaseMockOptions = {
	delayCommunityPostsMs?: number;
};

function readLocalSupabaseUrl() {
	const envPath = resolve(process.cwd(), ".env.local");
	if (!existsSync(envPath)) return null;

	const match = readFileSync(envPath, "utf8").match(
		/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m,
	);

	return match?.[1]?.trim() || null;
}

function getSupabaseAuthStorageKeys() {
	const keys = new Set(["sb-ci-auth-token"]);
	const supabaseUrl =
		process.env.NEXT_PUBLIC_SUPABASE_URL ?? readLocalSupabaseUrl();

	if (!supabaseUrl) return [...keys];

	try {
		const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
		if (projectRef) {
			keys.add(`sb-${projectRef}-auth-token`);
		}
	} catch {
		return [...keys];
	}

	return [...keys];
}

const RESUME_ROWS = [
	{
		created_at: "2026-06-01T09:00:00.000Z",
		file_path: `${TEST_USER_ID}/data-scientist.pdf`,
		id: "22222222-2222-4222-8222-222222222222",
		is_anonymous: true,
		job_description: "Data Analyst",
		post_description:
			"I want feedback on my resume for Data Scientist/Data Analyst roles, especially ATS optimization and project impact.",
		read_count: 13,
		roast_count: 5,
		status: "open",
		title: "Data Scientist or Analyst",
		user_id: TEST_RESUME_OWNER_ID,
	},
	{
		created_at: "2026-06-04T09:00:00.000Z",
		file_path: `${TEST_USER_ID}/sde-intern.pdf`,
		id: "33333333-3333-4333-8333-333333333333",
		is_anonymous: true,
		job_description: "SDE Intern",
		post_description:
			"Looking for a sharper project section and clearer internship bullets.",
		read_count: 3,
		roast_count: 0,
		status: "open",
		title: "AI/ML Intern, SDE Intern",
		user_id: TEST_USER_ID,
	},
];

const REVIEW_AUTHOR_ROWS = [
	{
		avatar_url: null,
		full_name: "Calm Proof",
		id: "aaaaaaaa-bbbb-4ccc-8ddd-000000000001",
		username: "calmproof",
	},
	{
		avatar_url: null,
		full_name: "Neat Coach",
		id: "aaaaaaaa-bbbb-4ccc-8ddd-000000000002",
		username: "neatcoach",
	},
];

const REVIEW_ROWS = [
	{
		attachment_id: null,
		author_id: REVIEW_AUTHOR_ROWS[0].id,
		content:
			"Honestly, your experience section is stronger than most fresher resumes I see, but I would quantify the model impact and shorten the project bullets.",
		content_format: "markdown",
		created_at: "2026-06-01T10:00:00.000Z",
		dislike_count: 0,
		helpful_votes: 4,
		id: "44444444-4444-4444-8444-444444444444",
		is_deleted: false,
		parent_id: null,
		reply_count: 3,
		resume_id: RESUME_ROWS[0].id,
		sticker_id: null,
	},
	{
		attachment_id: null,
		author_id: REVIEW_AUTHOR_ROWS[1].id,
		content:
			"I agree on quantifying impact. The first project has useful signal, but the bullet reads like a task list instead of a result.",
		content_format: "plain",
		created_at: "2026-06-01T10:05:00.000Z",
		dislike_count: 0,
		helpful_votes: 2,
		id: "44444444-4444-4444-8444-444444444445",
		is_deleted: false,
		parent_id: "44444444-4444-4444-8444-444444444444",
		reply_count: 2,
		resume_id: RESUME_ROWS[0].id,
		sticker_id: null,
	},
	{
		attachment_id: null,
		author_id: REVIEW_AUTHOR_ROWS[0].id,
		content:
			"Exactly. Replace the generic model line with one metric, one dataset context, and one business outcome so a recruiter can scan it quickly.",
		content_format: "plain",
		created_at: "2026-06-01T10:10:00.000Z",
		dislike_count: 0,
		helpful_votes: 1,
		id: "44444444-4444-4444-8444-444444444446",
		is_deleted: false,
		parent_id: "44444444-4444-4444-8444-444444444445",
		reply_count: 1,
		resume_id: RESUME_ROWS[0].id,
		sticker_id: null,
	},
	{
		attachment_id: null,
		author_id: REVIEW_AUTHOR_ROWS[1].id,
		content: "Got it. That makes the rewrite direction much clearer.",
		content_format: "plain",
		created_at: "2026-06-01T10:15:00.000Z",
		dislike_count: 0,
		helpful_votes: 1,
		id: "44444444-4444-4444-8444-444444444447",
		is_deleted: false,
		parent_id: "44444444-4444-4444-8444-444444444446",
		reply_count: 0,
		resume_id: RESUME_ROWS[0].id,
		sticker_id: null,
	},
	{
		attachment_id: null,
		author_id: REVIEW_AUTHOR_ROWS[1].id,
		content:
			"The summary section can be shorter. Lead with role target and strongest stack instead of a broad objective line.",
		content_format: "plain",
		created_at: "2026-06-01T11:00:00.000Z",
		dislike_count: 0,
		helpful_votes: 1,
		id: "44444444-4444-4444-8444-444444444448",
		is_deleted: false,
		parent_id: null,
		reply_count: 0,
		resume_id: RESUME_ROWS[0].id,
		sticker_id: null,
	},
];

const PROFILE_ROW = {
	app_status: "online",
	avatar_path: null,
	avatar_url: null,
	college: "Anonymous college",
	current_position: "Candidate",
	full_name: "Test Candidate",
	id: TEST_USER_ID,
	target_role: "Data Analyst",
	username: "candidate",
};

const COMMUNITY_AUTHOR_ROWS = [
	{
		avatar_url: null,
		full_name: "helpfulfinder",
		id: "55555555-5555-4555-8555-555555555555",
		username: "helpfulfinder",
	},
	{
		avatar_url: null,
		full_name: "Community member",
		id: "66666666-6666-4666-8666-666666666666",
		username: "community_member",
	},
];

const COMMUNITY_TOPIC_ROWS = [
	{
		id: "77777777-7777-4777-8777-777777777777",
		name: "Interview",
		slug: "interview",
	},
	{
		id: "88888888-8888-4888-8888-888888888888",
		name: "Career",
		slug: "career",
	},
];

const COMMUNITY_POST_ROWS = Array.from({ length: 14 }, (_, index) => {
	const isQuestion = index % 3 === 1;
	const author = COMMUNITY_AUTHOR_ROWS[index % COMMUNITY_AUTHOR_ROWS.length];
	const isOwnPost = index === 2;
	const topic = COMMUNITY_TOPIC_ROWS[index % COMMUNITY_TOPIC_ROWS.length];

	return {
		author_id: isOwnPost ? TEST_USER_ID : author.id,
		body: "A focused community post body for visual navigation coverage.",
		comment_count: index === 0 ? 5 : index + 1,
		created_at: `2026-06-${String(8 - Math.min(index, 6)).padStart(2, "0")}T09:00:00.000Z`,
		downvote_count: index % 2,
		id: `99999999-9999-4999-8999-${String(index + 1).padStart(12, "0")}`,
		last_activity_at: `2026-06-08T0${index % 9}:00:00.000Z`,
		post_type: isQuestion ? "question" : "discussion",
		status: "active",
		title:
			index === 0
				? "ygjfjyfjhfgjhflkhjghmhn"
				: isOwnPost
					? "My community guardrail post"
				: isQuestion
					? "This is a test poll"
					: `Community discussion ${index + 1}`,
		topic_id: topic.id,
		upvote_count: index + 2,
	};
});

const COMMUNITY_COMMENT_ROWS = [
	{
		author_id: COMMUNITY_AUTHOR_ROWS[1].id,
		body:
			"Seems you don't want to leave, but the cleanest answer is to understand what problem you are solving before resigning.",
		created_at: "2026-06-08T09:10:00.000Z",
		deleted_at: null,
		downvote_count: 0,
		id: "bbbbbbbb-bbbb-4bbb-8bbb-000000000001",
		parent_id: null,
		post_id: COMMUNITY_POST_ROWS[0].id,
		reply_count: 3,
		status: "active",
		upvote_count: 8,
		updated_at: "2026-06-08T09:10:00.000Z",
	},
	{
		author_id: COMMUNITY_AUTHOR_ROWS[0].id,
		body:
			"Yeah because I have other issues than just money. Location, work culture, and quality of work matter too.",
		created_at: "2026-06-08T09:12:00.000Z",
		deleted_at: null,
		downvote_count: 0,
		id: "bbbbbbbb-bbbb-4bbb-8bbb-000000000002",
		parent_id: "bbbbbbbb-bbbb-4bbb-8bbb-000000000001",
		post_id: COMMUNITY_POST_ROWS[0].id,
		reply_count: 2,
		status: "active",
		upvote_count: 4,
		updated_at: "2026-06-08T09:12:00.000Z",
	},
	{
		author_id: COMMUNITY_AUTHOR_ROWS[1].id,
		body:
			"It's always a gamble once you resign. You cannot let them know that you really want and if they already know that you want to be retained then you'll be lowballed.",
		created_at: "2026-06-08T09:14:00.000Z",
		deleted_at: null,
		downvote_count: 0,
		id: "bbbbbbbb-bbbb-4bbb-8bbb-000000000003",
		parent_id: "bbbbbbbb-bbbb-4bbb-8bbb-000000000002",
		post_id: COMMUNITY_POST_ROWS[0].id,
		reply_count: 1,
		status: "active",
		upvote_count: 4,
		updated_at: "2026-06-08T09:14:00.000Z",
	},
	{
		author_id: COMMUNITY_AUTHOR_ROWS[0].id,
		body: "Got it.",
		created_at: "2026-06-08T09:16:00.000Z",
		deleted_at: null,
		downvote_count: 0,
		id: "bbbbbbbb-bbbb-4bbb-8bbb-000000000004",
		parent_id: "bbbbbbbb-bbbb-4bbb-8bbb-000000000003",
		post_id: COMMUNITY_POST_ROWS[0].id,
		reply_count: 0,
		status: "active",
		upvote_count: 2,
		updated_at: "2026-06-08T09:16:00.000Z",
	},
	{
		author_id: COMMUNITY_AUTHOR_ROWS[1].id,
		body:
			"Relax, no one's gonna sabotage your offer. Most people aren't interested in that kind of drama.",
		created_at: "2026-06-08T09:18:00.000Z",
		deleted_at: null,
		downvote_count: 0,
		id: "bbbbbbbb-bbbb-4bbb-8bbb-000000000005",
		parent_id: null,
		post_id: COMMUNITY_POST_ROWS[0].id,
		reply_count: 0,
		status: "active",
		upvote_count: 6,
		updated_at: "2026-06-08T09:18:00.000Z",
	},
	{
		author_id: TEST_USER_ID,
		body:
			"I posted this follow-up myself, so voting and replying to it should stay hidden.",
		created_at: "2026-06-08T09:20:00.000Z",
		deleted_at: null,
		downvote_count: 0,
		id: "bbbbbbbb-bbbb-4bbb-8bbb-000000000006",
		parent_id: null,
		post_id: COMMUNITY_POST_ROWS[0].id,
		reply_count: 0,
		status: "active",
		upvote_count: 1,
		updated_at: "2026-06-08T09:20:00.000Z",
	},
];

const COMMUNITY_POST_POLL_ROWS = [
	{
		closes_at: "2026-06-09T09:00:00.000Z",
		created_at: "2026-06-08T09:00:00.000Z",
		duration_days: 7,
		id: "cccccccc-cccc-4ccc-8ccc-000000000001",
		post_id: COMMUNITY_POST_ROWS[1].id,
		question: "Which career step are you taking?",
		updated_at: "2026-06-08T09:00:00.000Z",
	},
];

const COMMUNITY_POST_POLL_OPTION_ROWS = [
	{
		created_at: "2026-06-08T09:00:00.000Z",
		display_order: 0,
		id: "dddddddd-dddd-4ddd-8ddd-000000000001",
		option_text: "Preparing for interviews",
		poll_id: COMMUNITY_POST_POLL_ROWS[0].id,
		updated_at: "2026-06-08T09:00:00.000Z",
		vote_count: 3,
	},
	{
		created_at: "2026-06-08T09:00:00.000Z",
		display_order: 1,
		id: "dddddddd-dddd-4ddd-8ddd-000000000002",
		option_text: "Fixing my resume",
		poll_id: COMMUNITY_POST_POLL_ROWS[0].id,
		updated_at: "2026-06-08T09:00:00.000Z",
		vote_count: 2,
	},
];

const COMMUNITY_POST_POLL_VOTE_ROWS = [
	{
		option_id: COMMUNITY_POST_POLL_OPTION_ROWS[0].id,
		poll_id: COMMUNITY_POST_POLL_ROWS[0].id,
	},
];

const COMMUNITY_POST_ATTACHMENT_ROWS = Array.from({ length: 3 }, (_, index) => ({
	created_at: "2026-06-08T09:00:00.000Z",
	display_order: index,
	file_size: 128_000 + index,
	id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(index + 1).padStart(12, "0")}`,
	kind: "image",
	mime_type: "image/jpeg",
	post_id: COMMUNITY_POST_ROWS[0].id,
	source: "upload",
	storage_path: `${COMMUNITY_AUTHOR_ROWS[0].id}/carousel-${index + 1}.jpg`,
	title: `carousel-${index + 1}.jpg`,
	user_id: COMMUNITY_AUTHOR_ROWS[0].id,
	alt_text: `Community carousel image ${index + 1}`,
}));

function corsHeaders() {
	return {
		"access-control-allow-headers":
			"authorization, apikey, content-type, prefer, x-client-info",
		"access-control-allow-methods": "GET,HEAD,POST,PATCH,DELETE,OPTIONS",
		"access-control-allow-origin": "*",
	};
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
	await route.fulfill({
		body: JSON.stringify(body),
		contentType: "application/json",
		headers: corsHeaders(),
		status,
	});
}

function tableNameFromPath(pathname: string) {
	const match = pathname.match(/^\/rest\/v1\/([^/]+)/);
	return match?.[1] ?? "";
}

function valuesFromInFilter(value: string | null) {
	return value?.startsWith("in.")
		? value
				.replace(/^in\.\(/, "")
				.replace(/\)$/, "")
				.split(",")
		: [];
}

async function fulfillRestTable(
	route: Route,
	table: string,
	options: SupabaseMockOptions = {},
) {
	const method = route.request().method();
	const url = new URL(route.request().url());

	if (method === "OPTIONS") {
		await route.fulfill({ headers: corsHeaders(), status: 204 });
		return;
	}

	if (method !== "GET" && method !== "HEAD") {
		await fulfillJson(route, {});
		return;
	}

	if (method === "HEAD") {
		await route.fulfill({
			headers: { ...corsHeaders(), "content-range": "0-0/0" },
			status: 200,
		});
		return;
	}

	if (table === "resumes") {
		const resumeId = url.searchParams.get("id")?.replace(/^eq\./, "");

		if (resumeId) {
			await fulfillJson(
				route,
				RESUME_ROWS.find((resume) => resume.id === resumeId) ?? null,
			);
			return;
		}

		await fulfillJson(route, RESUME_ROWS);
		return;
	}

	if (table === "roasts") {
		const resumeId = url.searchParams.get("resume_id")?.replace(/^eq\./, "");

		await fulfillJson(
			route,
			resumeId
				? REVIEW_ROWS.filter((review) => review.resume_id === resumeId)
				: REVIEW_ROWS,
		);
		return;
	}

	if (table === "profiles") {
		if (url.searchParams.get("id")?.startsWith("in.")) {
			await fulfillJson(route, [
				PROFILE_ROW,
				...REVIEW_AUTHOR_ROWS,
				...COMMUNITY_AUTHOR_ROWS,
			]);
			return;
		}

		await fulfillJson(route, PROFILE_ROW);
		return;
	}

	if (table === "community_posts") {
		if (options.delayCommunityPostsMs) {
			await new Promise((resolve) =>
				setTimeout(resolve, options.delayCommunityPostsMs),
			);
		}

		const postId = url.searchParams.get("id")?.replace(/^eq\./, "");

		if (postId) {
			await fulfillJson(
				route,
				COMMUNITY_POST_ROWS.find((post) => post.id === postId) ?? null,
			);
			return;
		}

		await fulfillJson(route, COMMUNITY_POST_ROWS);
		return;
	}

	if (table === "community_topics") {
		await fulfillJson(route, COMMUNITY_TOPIC_ROWS);
		return;
	}

	if (table === "community_post_attachments") {
		const postIdFilter = url.searchParams.get("post_id");
		const postIds = valuesFromInFilter(postIdFilter);
		const postId = postIdFilter?.startsWith("eq.")
			? postIdFilter.replace(/^eq\./, "")
			: "";
		await fulfillJson(
			route,
			postId
				? COMMUNITY_POST_ATTACHMENT_ROWS.filter(
						(attachment) => attachment.post_id === postId,
					)
				: postIds.length
					? COMMUNITY_POST_ATTACHMENT_ROWS.filter((attachment) =>
							postIds.includes(attachment.post_id),
						)
				: COMMUNITY_POST_ATTACHMENT_ROWS,
		);
		return;
	}

	if (table === "community_post_comments") {
		const postId = url.searchParams.get("post_id")?.replace(/^eq\./, "");
		await fulfillJson(
			route,
			postId
				? COMMUNITY_COMMENT_ROWS.filter((comment) => comment.post_id === postId)
				: COMMUNITY_COMMENT_ROWS,
		);
		return;
	}

	if (table === "community_comment_votes" || table === "community_post_saves") {
		await fulfillJson(route, []);
		return;
	}

	if (table === "community_post_votes") {
		await fulfillJson(route, []);
		return;
	}

	if (table === "community_post_polls") {
		const postIdFilter = url.searchParams.get("post_id");
		const postIds = valuesFromInFilter(postIdFilter);
		const postId = postIdFilter?.startsWith("eq.")
			? postIdFilter.replace(/^eq\./, "")
			: "";
		await fulfillJson(
			route,
			postId
				? (COMMUNITY_POST_POLL_ROWS.find((poll) => poll.post_id === postId) ??
						null)
				: postIds.length
					? COMMUNITY_POST_POLL_ROWS.filter((poll) =>
							postIds.includes(poll.post_id),
						)
					: COMMUNITY_POST_POLL_ROWS,
		);
		return;
	}

	if (table === "community_post_poll_options") {
		const pollIdFilter = url.searchParams.get("poll_id");
		const pollIds = valuesFromInFilter(pollIdFilter);
		const pollId = pollIdFilter?.startsWith("eq.")
			? pollIdFilter.replace(/^eq\./, "")
			: "";
		await fulfillJson(
			route,
			pollId
				? COMMUNITY_POST_POLL_OPTION_ROWS.filter(
						(option) => option.poll_id === pollId,
					)
				: pollIds.length
					? COMMUNITY_POST_POLL_OPTION_ROWS.filter((option) =>
							pollIds.includes(option.poll_id),
						)
					: COMMUNITY_POST_POLL_OPTION_ROWS,
		);
		return;
	}

	if (table === "community_post_poll_votes") {
		const pollIdFilter = url.searchParams.get("poll_id");
		const pollIds = valuesFromInFilter(pollIdFilter);
		const pollId = pollIdFilter?.startsWith("eq.")
			? pollIdFilter.replace(/^eq\./, "")
			: "";
		await fulfillJson(
			route,
			pollId
				? (COMMUNITY_POST_POLL_VOTE_ROWS.find((vote) => vote.poll_id === pollId) ??
						null)
				: pollIds.length
					? COMMUNITY_POST_POLL_VOTE_ROWS.filter((vote) =>
							pollIds.includes(vote.poll_id),
						)
					: COMMUNITY_POST_POLL_VOTE_ROWS,
		);
		return;
	}

	if (table === "notifications" || table === "saved_resumes") {
		await fulfillJson(route, []);
		return;
	}

	if (table === "profile_onboarding") {
		await fulfillJson(route, null);
		return;
	}

	await fulfillJson(route, []);
}

async function fulfillSupabase(
	route: Route,
	options: SupabaseMockOptions = {},
) {
	const request = route.request();
	const url = new URL(request.url());

	if (request.method() === "OPTIONS") {
		await route.fulfill({ headers: corsHeaders(), status: 204 });
		return;
	}

	if (url.pathname === "/auth/v1/user") {
		await fulfillJson(route, TEST_USER);
		return;
	}

	if (url.pathname === "/auth/v1/token") {
		await fulfillJson(route, TEST_SESSION);
		return;
	}

	if (url.pathname.startsWith("/rest/v1/rpc/")) {
		if (url.pathname.endsWith("/verify_active_user_session")) {
			await fulfillJson(route, { active: true, feature_ready: true });
			return;
		}

		if (url.pathname.endsWith("/claim_active_user_session")) {
			await fulfillJson(route, { active: true, feature_ready: true });
			return;
		}

		await fulfillJson(route, null);
		return;
	}

	if (url.pathname.startsWith("/rest/v1/")) {
		await fulfillRestTable(route, tableNameFromPath(url.pathname), options);
		return;
	}

	if (url.pathname.startsWith("/storage/v1/object/sign/resumes")) {
		await fulfillJson(route, []);
		return;
	}

	await fulfillJson(route, {});
}

export async function mockSupabaseForAuthenticatedPages(
	page: Page,
	options: SupabaseMockOptions = {},
) {
	await page.route("**/auth/v1/**", (route) => fulfillSupabase(route, options));
	await page.route("**/rest/v1/**", (route) => fulfillSupabase(route, options));
	await page.route("**/storage/v1/**", (route) => fulfillSupabase(route, options));
	await page.route("**/api/admin/me", (route) =>
		fulfillJson(route, { email: TEST_USER_EMAIL, isAdmin: false }),
	);
}

export async function seedAuthenticatedSession(page: Page) {
	await page.addInitScript(
		({ session, storageKeys }) => {
			window.localStorage.setItem("linted-theme", "dark");
			for (const storageKey of storageKeys) {
				window.localStorage.setItem(storageKey, JSON.stringify(session));
			}
		},
		{ session: TEST_SESSION, storageKeys: getSupabaseAuthStorageKeys() },
	);
}

export async function prepareAuthenticatedPage(
	page: Page,
	options: SupabaseMockOptions = {},
) {
	await seedAuthenticatedSession(page);
	await mockSupabaseForAuthenticatedPages(page, options);
}

export async function expectNoHorizontalOverflow(page: Page) {
	const overflow = await page.evaluate(() => ({
		body: document.body.scrollWidth,
		viewport: document.documentElement.clientWidth,
		root: document.documentElement.scrollWidth,
	}));

	expect(Math.max(overflow.body, overflow.root)).toBeLessThanOrEqual(
		overflow.viewport + 1,
	);
}

export async function expectVisibleWithinViewport(page: Page, selector: string) {
	const boxes = await page.locator(selector).evaluateAll((elements) =>
		elements.map((element) => {
			const rect = element.getBoundingClientRect();
			return {
				bottom: rect.bottom,
				left: rect.left,
				right: rect.right,
				top: rect.top,
				visible:
					rect.width > 0 &&
					rect.height > 0 &&
					getComputedStyle(element).visibility !== "hidden" &&
					getComputedStyle(element).display !== "none",
			};
		}),
	);

	for (const box of boxes.filter((item) => item.visible)) {
		expect(box.left).toBeGreaterThanOrEqual(-1);
		expect(box.right).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
	}
}
