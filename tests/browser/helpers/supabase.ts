import type { Page, Route } from "@playwright/test";
import { expect } from "@playwright/test";

const SUPABASE_ORIGIN = "https://ci.supabase.co";
const TEST_USER_ID = "11111111-1111-4111-8111-111111111111";
const TEST_USER_EMAIL = "candidate@example.com";
const TEST_ACCESS_TOKEN = "e2e-access-token";
const TEST_REFRESH_TOKEN = "e2e-refresh-token";

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
		roast_count: 3,
		status: "open",
		title: "Data Scientist or Analyst",
		user_id: TEST_USER_ID,
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

const REVIEW_ROWS = [
	{
		attachment_id: null,
		content:
			"Honestly, your experience section is stronger than most fresher resumes I see, but I would quantify the model impact and shorten the project bullets.",
		content_format: "markdown",
		created_at: "2026-06-01T10:00:00.000Z",
		helpful_votes: 4,
		id: "44444444-4444-4444-8444-444444444444",
		is_deleted: false,
		parent_id: null,
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

async function fulfillRestTable(route: Route, table: string) {
	const method = route.request().method();

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
		await fulfillJson(route, RESUME_ROWS);
		return;
	}

	if (table === "roasts") {
		await fulfillJson(route, REVIEW_ROWS);
		return;
	}

	if (table === "profiles") {
		await fulfillJson(route, PROFILE_ROW);
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

async function fulfillSupabase(route: Route) {
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
		await fulfillRestTable(route, tableNameFromPath(url.pathname));
		return;
	}

	if (url.pathname.startsWith("/storage/v1/object/sign/resumes")) {
		await fulfillJson(route, []);
		return;
	}

	await fulfillJson(route, {});
}

export async function mockSupabaseForAuthenticatedPages(page: Page) {
	await page.route(`${SUPABASE_ORIGIN}/**`, fulfillSupabase);
	await page.route("**/api/admin/me", (route) =>
		fulfillJson(route, { email: TEST_USER_EMAIL, isAdmin: false }),
	);
}

export async function seedAuthenticatedSession(page: Page) {
	await page.addInitScript(
		({ session }) => {
			window.localStorage.setItem("linted-theme", "dark");
			window.localStorage.setItem("sb-ci-auth-token", JSON.stringify(session));
		},
		{ session: TEST_SESSION },
	);
}

export async function prepareAuthenticatedPage(page: Page) {
	await seedAuthenticatedSession(page);
	await mockSupabaseForAuthenticatedPages(page);
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
