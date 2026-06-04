import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type EmailLookupRow = {
	account_exists: boolean;
	email_confirmed: boolean;
	providers: string[] | null;
};

type RateLimitBucket = {
	count: number;
	resetAt: number;
};

type RateLimitGlobal = typeof globalThis & {
	resumeRosterEmailLookupRateLimit?: Map<string, RateLimitBucket>;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 8;

function rateLimitKey(request: Request, email: string) {
	const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0];
	const ip =
		forwardedFor?.trim() ||
		request.headers.get("x-real-ip") ||
		request.headers.get("cf-connecting-ip") ||
		"unknown";

	return `${ip}:${email}`;
}

function isRateLimited(key: string) {
	const store =
		(globalThis as RateLimitGlobal).resumeRosterEmailLookupRateLimit ??
		new Map<string, RateLimitBucket>();
	(globalThis as RateLimitGlobal).resumeRosterEmailLookupRateLimit = store;

	const now = Date.now();
	const current = store.get(key);

	if (!current || current.resetAt <= now) {
		store.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
		return false;
	}

	current.count += 1;
	return current.count > RATE_LIMIT_MAX_REQUESTS;
}

function unavailable(requiresMigration = false) {
	return NextResponse.json({
		accountExists: false,
		emailConfirmed: false,
		lookupAvailable: false,
		providers: [],
		requiresMigration,
	});
}

export async function POST(request: Request) {
	let payload: unknown;

	try {
		payload = await request.json();
	} catch {
		return NextResponse.json({ message: "Invalid request." }, { status: 400 });
	}

	const email =
		typeof payload === "object" &&
		payload !== null &&
		"email" in payload &&
		typeof payload.email === "string"
			? payload.email.trim().toLowerCase()
			: "";

	if (!EMAIL_PATTERN.test(email) || email.length > 320) {
		return NextResponse.json(
			{ message: "Enter a valid email." },
			{ status: 400 },
		);
	}

	if (isRateLimited(rateLimitKey(request, email))) {
		return NextResponse.json(
			{ message: "Too many checks. Wait a minute and try again." },
			{ status: 429 },
		);
	}

	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

	if (!supabaseUrl || !serviceRoleKey) {
		return unavailable();
	}

	const admin = createClient(supabaseUrl, serviceRoleKey, {
		auth: {
			autoRefreshToken: false,
			persistSession: false,
		},
	});

	const { data, error } = await admin.rpc("get_auth_email_state", {
		target_email: email,
	});

	if (error) {
		const requiresMigration =
			/get_auth_email_state|function|schema cache/i.test(error.message);
		return unavailable(requiresMigration);
	}

	const row = Array.isArray(data)
		? ((data[0] ?? null) as EmailLookupRow | null)
		: ((data ?? null) as EmailLookupRow | null);

	return NextResponse.json({
		accountExists: Boolean(row?.account_exists),
		emailConfirmed: Boolean(row?.email_confirmed),
		lookupAvailable: true,
		providers: Array.isArray(row?.providers) ? row.providers : [],
	});
}
