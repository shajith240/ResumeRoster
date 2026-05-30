import { createServiceSupabaseClient } from "@/lib/server-auth";
import { sendPushForNotificationId } from "@/lib/server/push";

export const runtime = "nodejs";

type DatabaseWebhookPayload = {
	event?: unknown;
	eventType?: unknown;
	record?: unknown;
	schema?: unknown;
	table?: unknown;
	type?: unknown;
};

function getSecretFromRequest(request: Request) {
	const authorization = request.headers.get("authorization") ?? "";
	const bearer = authorization.replace(/^bearer\s+/i, "").trim();
	const headerSecret = request.headers.get("x-linted-push-secret") ?? "";
	return bearer || headerSecret.trim();
}

function isAuthorized(request: Request) {
	const configuredSecret = process.env.PUSH_WEBHOOK_SECRET;
	if (!configuredSecret) return false;
	return getSecretFromRequest(request) === configuredSecret;
}

function getWebhookEvent(payload: DatabaseWebhookPayload) {
	const event =
		typeof payload.type === "string"
			? payload.type
			: typeof payload.eventType === "string"
				? payload.eventType
				: typeof payload.event === "string"
					? payload.event
					: "";

	return event.toUpperCase();
}

function getNotificationId(record: unknown) {
	if (!record || typeof record !== "object") return "";
	const id = (record as { id?: unknown }).id;
	return typeof id === "string" ? id : "";
}

export async function POST(request: Request) {
	if (!process.env.PUSH_WEBHOOK_SECRET) {
		return Response.json(
			{ message: "Push webhook secret is not configured." },
			{ status: 503 },
		);
	}

	if (!isAuthorized(request)) {
		return Response.json({ message: "Unauthorized." }, { status: 401 });
	}

	const payload = (await request.json().catch(() => null)) as
		| DatabaseWebhookPayload
		| null;
	if (!payload) {
		return Response.json({ message: "Invalid webhook payload." }, { status: 400 });
	}

	const schema = typeof payload.schema === "string" ? payload.schema : "public";
	const table = typeof payload.table === "string" ? payload.table : "notifications";
	const event = getWebhookEvent(payload);

	if (schema !== "public" || table !== "notifications") {
		return Response.json({ ok: true, skipped: "Not a notifications event." });
	}

	if (event && event !== "INSERT") {
		return Response.json({ ok: true, skipped: "Only inserts send push." });
	}

	const notificationId = getNotificationId(payload.record ?? payload);
	if (!notificationId) {
		return Response.json(
			{ message: "Webhook record is missing a notification id." },
			{ status: 400 },
		);
	}

	const admin = createServiceSupabaseClient();
	const result = await sendPushForNotificationId(admin, notificationId);

	return Response.json({ ok: true, ...result });
}
