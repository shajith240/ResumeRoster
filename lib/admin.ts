import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/server/supabase-admin";

export type AdminAuthResult = {
	admin: SupabaseClient;
	user: User;
};

class AdminAuthError extends Error {
	status: number;

	constructor(message: string, status = 403) {
		super(message);
		this.name = "AdminAuthError";
		this.status = status;
	}
}

export function parseAdminEmails(value: string | null | undefined) {
	return new Set(
		(value ?? "")
			.split(",")
			.map((email) => email.trim().toLowerCase())
			.filter(Boolean),
	);
}

export function isAdminEmail(
	email: string | null | undefined,
	adminEmails = process.env.ADMIN_EMAILS,
) {
	if (!email) return false;

	return parseAdminEmails(adminEmails).has(email.trim().toLowerCase());
}

function getBearerToken(request: Request) {
	const authorization = request.headers.get("authorization") ?? "";
	const [scheme, token] = authorization.split(/\s+/);
	return /^bearer$/i.test(scheme) && token ? token : "";
}

function createAdminSupabaseClient() {
	try {
		return createServiceRoleClient();
	} catch {
		throw new AdminAuthError("Admin server setup is missing.", 503);
	}
}

export async function requireAdmin(request: Request): Promise<AdminAuthResult> {
	const token = getBearerToken(request);
	if (!token) {
		throw new AdminAuthError("Sign in as an admin.", 401);
	}

	const admin = createAdminSupabaseClient();
	const {
		data: { user },
		error,
	} = await admin.auth.getUser(token);

	if (error || !user) {
		throw new AdminAuthError("Your admin session expired.", 401);
	}

	if (!isAdminEmail(user.email)) {
		throw new AdminAuthError("Admin access required.", 403);
	}

	return { admin, user };
}

export function adminErrorResponse(error: unknown) {
	if (error instanceof AdminAuthError) {
		return Response.json({ message: error.message }, { status: error.status });
	}

	return Response.json({ message: "Admin request failed." }, { status: 500 });
}
