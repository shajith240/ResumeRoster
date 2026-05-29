import { getCurrentPathForLogin, getLoginPath } from "@/lib/auth-redirect";
import { supabase } from "@/lib/supabase/client";

export const SESSION_SUPERSEDED_MESSAGE =
	"This account is already active in another browser. Sign in again here to continue.";

const ACTIVE_SESSION_STORAGE_PREFIX = "linted.active-session";
const SESSION_NOTICE_STORAGE_KEY = "linted.session.notice";
const CLIENT_SESSION_PATTERN = /^[A-Za-z0-9:_-]{16,128}$/;

type ActiveSessionStatus = {
	active: boolean;
	featureReady: boolean;
	sessionId: string;
};

function isActiveSessionFeatureError(error: { message?: string } | null) {
	return /active_user_sessions|active_user_session|claim_active_user_session|verify_active_user_session|release_active_user_session|schema cache|function|relation|does not exist/i.test(
		error?.message ?? "",
	);
}

export function isValidClientSessionId(value: string) {
	return CLIENT_SESSION_PATTERN.test(value);
}

export function createClientSessionId() {
	const randomId =
		typeof crypto !== "undefined" && "randomUUID" in crypto
			? crypto.randomUUID()
			: Math.random().toString(36).slice(2) + Date.now().toString(36);

	return `browser-${randomId}`;
}

export function getClientSessionId(userId: string) {
	if (typeof window === "undefined") return createClientSessionId();

	const storageKey = `${ACTIVE_SESSION_STORAGE_PREFIX}:${userId}`;
	const storedSessionId = window.localStorage.getItem(storageKey);

	if (storedSessionId && isValidClientSessionId(storedSessionId)) {
		return storedSessionId;
	}

	const nextSessionId = createClientSessionId();
	window.localStorage.setItem(storageKey, nextSessionId);
	return nextSessionId;
}

export function consumeSessionSupersededNotice() {
	if (typeof window === "undefined") return "";

	const notice = window.localStorage.getItem(SESSION_NOTICE_STORAGE_KEY) ?? "";
	window.localStorage.removeItem(SESSION_NOTICE_STORAGE_KEY);
	return notice;
}

function persistSessionSupersededNotice() {
	if (typeof window === "undefined") return;
	window.localStorage.setItem(
		SESSION_NOTICE_STORAGE_KEY,
		SESSION_SUPERSEDED_MESSAGE,
	);
}

function activeStatus(sessionId: string, active: boolean): ActiveSessionStatus {
	return {
		active,
		featureReady: true,
		sessionId,
	};
}

function featureNotReadyStatus(sessionId: string): ActiveSessionStatus {
	return {
		active: true,
		featureReady: false,
		sessionId,
	};
}

export async function claimActiveUserSession(userId: string) {
	const sessionId = getClientSessionId(userId);

	const { error } = await supabase.rpc("claim_active_user_session", {
		client_session_id: sessionId,
	});

	if (error) {
		if (isActiveSessionFeatureError(error)) {
			return featureNotReadyStatus(sessionId);
		}

		console.warn("Could not claim active session", error.message);
		return featureNotReadyStatus(sessionId);
	}

	return activeStatus(sessionId, true);
}

export async function verifyActiveUserSession(userId: string) {
	const sessionId = getClientSessionId(userId);

	const { data, error } = await supabase.rpc("verify_active_user_session", {
		client_session_id: sessionId,
	});

	if (error) {
		if (isActiveSessionFeatureError(error)) {
			return featureNotReadyStatus(sessionId);
		}

		console.warn("Could not verify active session", error.message);
		return featureNotReadyStatus(sessionId);
	}

	return activeStatus(sessionId, data === true);
}

export async function releaseActiveUserSession(userId: string) {
	const sessionId = getClientSessionId(userId);

	const { error } = await supabase.rpc("release_active_user_session", {
		client_session_id: sessionId,
	});

	if (error && !isActiveSessionFeatureError(error)) {
		console.warn("Could not release active session", error.message);
	}
}

export async function endSupersededSession() {
	persistSessionSupersededNotice();
	await supabase.auth.signOut({ scope: "local" });

	if (typeof window !== "undefined") {
		window.location.assign(getLoginPath(getCurrentPathForLogin()));
	}
}

export async function ensureActiveUserSession(userId: string) {
	const status = await verifyActiveUserSession(userId);

	if (status.featureReady && !status.active) {
		await endSupersededSession();
		return false;
	}

	return true;
}
