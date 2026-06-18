import type { Session } from "@supabase/supabase-js";
import { isAuthSessionError } from "@/lib/auth-errors";
import { supabase } from "@/lib/supabase/client";

type FreshSessionResult = {
	error: { message?: string } | null;
	session: Session | null;
};

export async function getFreshAuthSession(): Promise<FreshSessionResult> {
	const { data, error } = await supabase.auth.getSession();

	if (!error && data.session) {
		return { error: null, session: data.session };
	}

	if (error && isAuthSessionError(error)) {
		const refreshed = await supabase.auth.refreshSession();
		return {
			error: refreshed.error ?? null,
			session: refreshed.data.session ?? null,
		};
	}

	return { error: error ?? null, session: null };
}

export async function refreshAuthSessionAfterError(
	error: { message?: string } | null | undefined,
) {
	if (!isAuthSessionError(error)) return false;

	const refreshed = await supabase.auth.refreshSession();
	return !refreshed.error && Boolean(refreshed.data.session);
}
