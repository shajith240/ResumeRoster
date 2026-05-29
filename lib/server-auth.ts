import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

export const GENERIC_REQUEST_ERROR = "Request failed. Try again.";

export type SignedInUserResult = {
	admin: SupabaseClient;
	user: User;
};

export class ServerAuthError extends Error {
	status: number;

	constructor(message: string, status = 401) {
		super(message);
		this.name = "ServerAuthError";
		this.status = status;
	}
}

export function getBearerToken(request: Request) {
	const authorization = request.headers.get("authorization") ?? "";
	const [scheme, token] = authorization.split(/\s+/);
	return /^bearer$/i.test(scheme) && token ? token : "";
}

export function createServiceSupabaseClient() {
	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

	if (!supabaseUrl || !serviceRoleKey) {
		throw new ServerAuthError("Server auth setup is missing.", 503);
	}

	return createClient(supabaseUrl, serviceRoleKey, {
		auth: {
			autoRefreshToken: false,
			persistSession: false,
		},
	});
}

export async function requireSignedInUser(
	request: Request,
): Promise<SignedInUserResult> {
	const token = getBearerToken(request);
	if (!token) {
		throw new ServerAuthError("Sign in again to continue.", 401);
	}

	const admin = createServiceSupabaseClient();
	const {
		data: { user },
		error,
	} = await admin.auth.getUser(token);

	if (error || !user) {
		throw new ServerAuthError("Your session expired. Sign in again.", 401);
	}

	return { admin, user };
}

export function serverAuthErrorResponse(error: unknown) {
	if (error instanceof ServerAuthError) {
		return Response.json({ message: error.message }, { status: error.status });
	}

	return Response.json({ message: GENERIC_REQUEST_ERROR }, { status: 500 });
}
