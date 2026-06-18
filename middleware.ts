import { NextResponse, type NextRequest } from "next/server";
import {
	buildContentSecurityPolicy,
	buildSecurityHeaders,
} from "./lib/security/headers";

function createNonce() {
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);

	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}

	return btoa(binary);
}

export function middleware(request: NextRequest) {
	const nonce = createNonce();
	const isDevelopment = process.env.NODE_ENV !== "production";
	const csp = buildContentSecurityPolicy({ isDevelopment, nonce });
	const requestHeaders = new Headers(request.headers);
	requestHeaders.set("Content-Security-Policy", csp);
	requestHeaders.set("x-nonce", nonce);

	const response = NextResponse.next({
		request: {
			headers: requestHeaders,
		},
	});

	for (const header of buildSecurityHeaders({ isDevelopment, nonce })) {
		response.headers.set(header.key, header.value);
	}

	return response;
}

export const config = {
	matcher: [
		{
			source:
				"/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|push-sw.js|assets/).*)",
			missing: [
				{ type: "header", key: "next-router-prefetch" },
				{ type: "header", key: "purpose", value: "prefetch" },
			],
		},
	],
};
