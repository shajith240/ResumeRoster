export const ADMIN_MESSAGE_TITLE_MAX_LENGTH = 80;
export const ADMIN_MESSAGE_BODY_MAX_LENGTH = 220;
export const DEFAULT_ADMIN_MESSAGE_LINK = "/feed";

type AdminMessageTarget =
	| {
			mode: "all";
	  }
	| {
			mode: "user";
			userId: string;
	  };

type AdminMessageInput = {
	body: string;
	linkHref: string;
	requestId: string;
	target: AdminMessageTarget;
	title: string;
};

export type AdminMessageValidationResult =
	| {
			ok: true;
			value: AdminMessageInput;
	  }
	| {
			message: string;
			ok: false;
	  };

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INTERNAL_LINK_ORIGIN = "https://linted.space";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getTrimmedString(value: unknown) {
	return typeof value === "string" ? value.trim() : "";
}

export function isSafeAdminMessageLink(value: string) {
	const href = value.trim();

	if (!href || !href.startsWith("/") || href.startsWith("//")) {
		return false;
	}

	if (href.includes("\\") || /\s/.test(href)) {
		return false;
	}

	try {
		const parsed = new URL(href, INTERNAL_LINK_ORIGIN);
		return parsed.origin === INTERNAL_LINK_ORIGIN;
	} catch {
		return false;
	}
}

export function normalizeAdminMessageLink(value: unknown) {
	if (typeof value !== "string" || !isSafeAdminMessageLink(value)) {
		return DEFAULT_ADMIN_MESSAGE_LINK;
	}

	return value.trim();
}

function validateTarget(value: unknown): AdminMessageTarget | string {
	if (!isRecord(value)) {
		return "Choose who should receive the message.";
	}

	if (value.mode === "all") {
		return { mode: "all" };
	}

	if (value.mode === "user") {
		const userId = getTrimmedString(value.userId);
		if (!UUID_PATTERN.test(userId)) {
			return "Choose a valid user.";
		}

		return { mode: "user", userId };
	}

	return "Choose who should receive the message.";
}

export function validateAdminMessagePayload(
	payload: unknown,
): AdminMessageValidationResult {
	if (!isRecord(payload)) {
		return { message: "Message details are required.", ok: false };
	}

	const target = validateTarget(payload.target);
	if (typeof target === "string") {
		return { message: target, ok: false };
	}

	const requestId = getTrimmedString(payload.requestId);
	if (!UUID_PATTERN.test(requestId)) {
		return { message: "Message request id is required.", ok: false };
	}

	const title = getTrimmedString(payload.title);
	if (!title) {
		return { message: "Add a message title.", ok: false };
	}
	if (title.length > ADMIN_MESSAGE_TITLE_MAX_LENGTH) {
		return {
			message: `Keep the title under ${ADMIN_MESSAGE_TITLE_MAX_LENGTH} characters.`,
			ok: false,
		};
	}

	const body = getTrimmedString(payload.body);
	if (!body) {
		return { message: "Add a message body.", ok: false };
	}
	if (body.length > ADMIN_MESSAGE_BODY_MAX_LENGTH) {
		return {
			message: `Keep the message under ${ADMIN_MESSAGE_BODY_MAX_LENGTH} characters.`,
			ok: false,
		};
	}

	const hasLinkHref = Object.hasOwn(payload, "linkHref");
	const rawLinkHref = payload.linkHref;
	const linkHref =
		!hasLinkHref ||
		rawLinkHref == null ||
		(typeof rawLinkHref === "string" && !rawLinkHref.trim())
			? DEFAULT_ADMIN_MESSAGE_LINK
			: getTrimmedString(rawLinkHref);

	if (!isSafeAdminMessageLink(linkHref)) {
		return { message: "Use an internal Linted path.", ok: false };
	}

	return {
		ok: true,
		value: {
			body,
			linkHref,
			requestId,
			target,
			title,
		},
	};
}
