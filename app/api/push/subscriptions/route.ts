import { requireSignedInUser, serverAuthErrorResponse } from "@/lib/server-auth";

export const runtime = "nodejs";

type PushSubscriptionRequest = {
	endpoint?: unknown;
	expirationTime?: unknown;
	keys?: {
		auth?: unknown;
		p256dh?: unknown;
	};
};

function getSubscriptionPayload(payload: unknown) {
	if (!payload || typeof payload !== "object") return null;
	const subscription = payload as PushSubscriptionRequest;
	const endpoint =
		typeof subscription.endpoint === "string"
			? subscription.endpoint.trim()
			: "";
	const auth =
		typeof subscription.keys?.auth === "string"
			? subscription.keys.auth.trim()
			: "";
	const p256dh =
		typeof subscription.keys?.p256dh === "string"
			? subscription.keys.p256dh.trim()
			: "";

	if (
		!endpoint.startsWith("https://") ||
		endpoint.length > 2048 ||
		auth.length < 10 ||
		p256dh.length < 20
	) {
		return null;
	}

	const expirationTime =
		typeof subscription.expirationTime === "number" &&
		Number.isFinite(subscription.expirationTime)
			? new Date(subscription.expirationTime).toISOString()
			: null;

	return { auth, endpoint, expirationTime, p256dh };
}

async function setPushPreference(
	admin: Awaited<ReturnType<typeof requireSignedInUser>>["admin"],
	userId: string,
	pushEnabled: boolean,
) {
	await admin.from("notification_preferences").upsert(
		{
			push_enabled: pushEnabled,
			updated_at: new Date().toISOString(),
			user_id: userId,
		},
		{ onConflict: "user_id" },
	);
}

export async function POST(request: Request) {
	try {
		const { admin, user } = await requireSignedInUser(request);
		const payload = getSubscriptionPayload(await request.json().catch(() => null));

		if (!payload) {
			return Response.json(
				{ message: "Choose a valid push subscription." },
				{ status: 400 },
			);
		}

		const now = new Date().toISOString();
		const { error } = await admin.from("push_subscriptions").upsert(
			{
				auth: payload.auth,
				endpoint: payload.endpoint,
				expiration_time: payload.expirationTime,
				last_seen_at: now,
				p256dh: payload.p256dh,
				revoked_at: null,
				updated_at: now,
				user_agent: (request.headers.get("user-agent") ?? "").slice(0, 300),
				user_id: user.id,
			},
			{ onConflict: "endpoint" },
		);

		if (error) {
			return Response.json(
				{ message: "Could not save push subscription." },
				{ status: 500 },
			);
		}

		await setPushPreference(admin, user.id, true);

		return Response.json({ ok: true });
	} catch (error) {
		return serverAuthErrorResponse(error);
	}
}

export async function DELETE(request: Request) {
	try {
		const { admin, user } = await requireSignedInUser(request);
		const payload = (await request.json().catch(() => null)) as
			| { endpoint?: unknown }
			| null;
		const endpoint =
			typeof payload?.endpoint === "string" ? payload.endpoint.trim() : "";
		const now = new Date().toISOString();

		let update = admin
			.from("push_subscriptions")
			.update({ revoked_at: now, updated_at: now })
			.eq("user_id", user.id)
			.is("revoked_at", null);

		if (endpoint) {
			update = update.eq("endpoint", endpoint);
		}

		const { error } = await update;
		if (error) {
			return Response.json(
				{ message: "Could not disable push notifications." },
				{ status: 500 },
			);
		}

		const { count } = await admin
			.from("push_subscriptions")
			.select("id", { count: "exact", head: true })
			.eq("user_id", user.id)
			.is("revoked_at", null);

		if (!count) {
			await setPushPreference(admin, user.id, false);
		}

		return Response.json({ ok: true });
	} catch (error) {
		return serverAuthErrorResponse(error);
	}
}
