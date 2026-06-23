import { Ratelimit } from "@upstash/ratelimit";
import { NextResponse, type NextRequest } from "next/server";
import { redis } from "./lib/redis";
import {
	buildContentSecurityPolicy,
	buildSecurityHeaders,
} from "./lib/security/headers";

// IP rate limiters — sliding window, fail open if Redis is unavailable
const submitRateLimit = new Ratelimit({
	redis,
	limiter: Ratelimit.slidingWindow(3, "1 h"),
	prefix: "rl:submit",
});

const paymentRateLimit = new Ratelimit({
	redis,
	limiter: Ratelimit.slidingWindow(5, "1 h"),
	prefix: "rl:payment",
});

const IP_LIMITS: Record<string, Ratelimit> = {
	"/api/resumes/submit": submitRateLimit,
	"/api/payments/create-order": paymentRateLimit,
};

function getIp(request: NextRequest): string {
	return (
		request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
		request.headers.get("x-real-ip") ??
		"unknown"
	);
}

function createNonce() {
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);

	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}

	return btoa(binary);
}

export async function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;

	// IP rate limiting for sensitive API routes
	const limiter = IP_LIMITS[pathname];
	if (limiter) {
		try {
			const { success } = await limiter.limit(getIp(request));
			if (!success) {
				return Response.json(
					{ message: "Too many requests. Please try again later." },
					{ status: 429, headers: { "Retry-After": "3600" } },
				);
			}
		} catch {
			// Redis unavailable — fail open, per-user Supabase limits still protect the routes
		}
		return NextResponse.next();
	}

	// CSP + security headers for page requests
	const nonce = createNonce();
	const isDevelopment = process.env.NODE_ENV !== "production";
	const csp = buildContentSecurityPolicy({ isDevelopment, nonce });
	const requestHeaders = new Headers(request.headers);
	requestHeaders.set("Content-Security-Policy", csp);
	requestHeaders.set("x-nonce", nonce);

	const response = NextResponse.next({
		request: { headers: requestHeaders },
	});

	for (const header of buildSecurityHeaders({ isDevelopment, nonce })) {
		response.headers.set(header.key, header.value);
	}

	return response;
}

export const config = {
	matcher: [
		// Page routes — CSP and security headers
		{
			source:
				"/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|push-sw.js|assets/).*)",
			missing: [
				{ type: "header", key: "next-router-prefetch" },
				{ type: "header", key: "purpose", value: "prefetch" },
			],
		},
		// IP rate-limited API routes
		"/api/resumes/submit",
		"/api/payments/create-order",
	],
};
