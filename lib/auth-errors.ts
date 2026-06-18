export const AUTH_SESSION_EXPIRED_MESSAGE =
	"Your session expired. Refresh the page or sign in again.";

type AuthLikeError = {
	code?: string;
	message?: string;
	status?: number;
} | null | undefined;

export function isAuthSessionError(error: AuthLikeError) {
	const message = `${error?.message ?? ""} ${error?.code ?? ""}`.toLowerCase();

	return (
		(/\bjwt\b/.test(message) &&
			/(expired|failed verification|invalid|malformed)/.test(message)) ||
		/auth session missing|refresh token|session.*expired|invalid claim/.test(
			message,
		)
	);
}

export function getSafeAuthErrorMessage(
	error: AuthLikeError,
	fallback = "Something went wrong.",
) {
	if (isAuthSessionError(error)) return AUTH_SESSION_EXPIRED_MESSAGE;
	return error?.message || fallback;
}
