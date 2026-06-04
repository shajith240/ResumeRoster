import type { SupabaseClient } from "@supabase/supabase-js";
import { adminErrorResponse, requireAdmin } from "@/lib/admin";
import {
	type AdminMessageInput,
	validateAdminMessagePayload,
} from "@/lib/admin-messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProfileRecipientRow = {
	id: string;
};

type NotificationPreferenceRow = {
	in_app_enabled: boolean;
	system_enabled: boolean;
	user_id: string;
};

type DeliveryCounts = {
	delivered: number;
	failed: number;
	skipped: number;
	total: number;
};

type DeliveryContext = {
	adminEmail: string | null;
	adminMessageId: string;
	adminUserId: string;
	message: AdminMessageInput;
};

const PROFILE_PAGE_SIZE = 1000;
const NOTIFICATION_INSERT_CHUNK_SIZE = 500;

class AdminMessageError extends Error {
	status: number;

	constructor(message: string, status = 400) {
		super(message);
		this.name = "AdminMessageError";
		this.status = status;
	}
}

function badRequest(message: string, status = 400) {
	return Response.json({ message }, { status });
}

function getErrorMessage(error: unknown) {
	return error instanceof Error ? error.message : "Admin message failed.";
}

function chunkValues<T>(values: T[], chunkSize: number) {
	const chunks: T[][] = [];
	for (let index = 0; index < values.length; index += chunkSize) {
		chunks.push(values.slice(index, index + chunkSize));
	}
	return chunks;
}

async function getPreferenceMap(admin: SupabaseClient, userIds: string[]) {
	if (!userIds.length) return new Map<string, NotificationPreferenceRow>();

	const { data, error } = await admin
		.from("notification_preferences")
		.select("user_id,in_app_enabled,system_enabled")
		.in("user_id", userIds)
		.returns<NotificationPreferenceRow[]>();

	if (error) throw new Error(error.message);

	return new Map((data ?? []).map((row) => [row.user_id, row]));
}

async function getEligibleRecipientIds(
	admin: SupabaseClient,
	userIds: string[],
) {
	const preferencesByUserId = await getPreferenceMap(admin, userIds);
	const eligibleIds: string[] = [];
	let skipped = 0;

	for (const userId of userIds) {
		const preferences = preferencesByUserId.get(userId);
		if (
			preferences &&
			(preferences.in_app_enabled === false ||
				preferences.system_enabled === false)
		) {
			skipped += 1;
			continue;
		}

		eligibleIds.push(userId);
	}

	return { eligibleIds, skipped };
}

async function insertNotifications(
	admin: SupabaseClient,
	recipientIds: string[],
	context: DeliveryContext,
) {
	if (!recipientIds.length) return 0;

	let delivered = 0;
	const dedupeKey = `admin-message:${context.adminMessageId}`;

	for (const chunk of chunkValues(recipientIds, NOTIFICATION_INSERT_CHUNK_SIZE)) {
		const rows = chunk.map((recipientId) => ({
			actor_id: null,
			body: context.message.body,
			dedupe_key: dedupeKey,
			link_href: context.message.linkHref,
			metadata: {
				admin_email: context.adminEmail,
				admin_message_id: context.adminMessageId,
				admin_user_id: context.adminUserId,
			},
			recipient_id: recipientId,
			title: context.message.title,
			type: "system",
		}));

		const { error } = await admin.from("notifications").insert(rows);
		if (error) throw new Error(error.message);

		delivered += rows.length;
	}

	return delivered;
}

async function deliverToUser(
	admin: SupabaseClient,
	context: DeliveryContext,
	userId: string,
): Promise<DeliveryCounts> {
	const { data, error } = await admin
		.from("profiles")
		.select("id")
		.eq("id", userId)
		.maybeSingle<ProfileRecipientRow>();

	if (error) throw new Error(error.message);
	if (!data) throw new AdminMessageError("User profile not found.", 404);

	const { eligibleIds, skipped } = await getEligibleRecipientIds(admin, [userId]);
	const delivered = await insertNotifications(admin, eligibleIds, context);

	return {
		delivered,
		failed: 0,
		skipped,
		total: 1,
	};
}

async function deliverToAll(
	admin: SupabaseClient,
	context: DeliveryContext,
): Promise<DeliveryCounts> {
	const counts: DeliveryCounts = {
		delivered: 0,
		failed: 0,
		skipped: 0,
		total: 0,
	};
	let from = 0;

	while (true) {
		const { data, error } = await admin
			.from("profiles")
			.select("id")
			.order("id", { ascending: true })
			.range(from, from + PROFILE_PAGE_SIZE - 1)
			.returns<ProfileRecipientRow[]>();

		if (error) throw new Error(error.message);

		const profileIds = (data ?? []).map((row) => row.id);
		if (!profileIds.length) break;

		counts.total += profileIds.length;

		const { eligibleIds, skipped } = await getEligibleRecipientIds(
			admin,
			profileIds,
		);
		counts.skipped += skipped;

		try {
			counts.delivered += await insertNotifications(admin, eligibleIds, context);
		} catch (error) {
			counts.failed += eligibleIds.length;
			throw error;
		}

		if (profileIds.length < PROFILE_PAGE_SIZE) break;
		from += PROFILE_PAGE_SIZE;
	}

	return counts;
}

function getAuditMetadata(
	message: AdminMessageInput,
	delivery: DeliveryCounts,
	status: "completed" | "failed" | "started",
	errorMessage?: string,
) {
	return {
		admin_message: {
			body: message.body,
			link_href: message.linkHref,
			target: message.target,
			title: message.title,
		},
		delivered_count: delivery.delivered,
		delivery_status: status,
		error: errorMessage,
		failed_count: delivery.failed,
		skipped_count: delivery.skipped,
		total_recipients: delivery.total,
	};
}

async function updateAuditMetadata(
	admin: SupabaseClient,
	auditLogId: string,
	message: AdminMessageInput,
	delivery: DeliveryCounts,
	status: "completed" | "failed" | "started",
	errorMessage?: string,
) {
	const { error } = await admin
		.from("moderation_actions")
		.update({
			metadata: getAuditMetadata(message, delivery, status, errorMessage),
		})
		.eq("id", auditLogId);

	if (error) throw new Error(error.message);
}

export async function POST(request: Request) {
	let auditLogId = "";
	let delivery: DeliveryCounts = {
		delivered: 0,
		failed: 0,
		skipped: 0,
		total: 0,
	};
	let message: AdminMessageInput | null = null;
	let adminClient: SupabaseClient | null = null;

	try {
		const { admin, user } = await requireAdmin(request);
		adminClient = admin;

		const payload = await request.json().catch(() => null);
		const validation = validateAdminMessagePayload(payload);
		if (!validation.ok) {
			return badRequest(validation.message);
		}

		message = validation.value;

		const auditResult = await admin
			.from("moderation_actions")
			.insert({
				action: "send_admin_message",
				admin_user_id: user.id,
				metadata: getAuditMetadata(message, delivery, "started"),
				reason: message.title,
				target_id: message.target.mode === "user" ? message.target.userId : null,
				target_type: message.target.mode === "all" ? "broadcast" : "user",
			})
			.select("id")
			.single<{ id: string }>();

		if (auditResult.error) throw new Error(auditResult.error.message);

		auditLogId = auditResult.data.id;

		const context: DeliveryContext = {
			adminEmail: user.email ?? null,
			adminMessageId: auditLogId,
			adminUserId: user.id,
			message,
		};

		delivery =
			message.target.mode === "all"
				? await deliverToAll(admin, context)
				: await deliverToUser(admin, context, message.target.userId);

		await updateAuditMetadata(
			admin,
			auditLogId,
			message,
			delivery,
			"completed",
		);

		return Response.json({
			auditLogId,
			delivered: delivery.delivered,
			failed: delivery.failed,
			skipped: delivery.skipped,
			status: "ok",
			total: delivery.total,
		});
	} catch (error) {
		if (auditLogId && adminClient && message) {
			try {
				await updateAuditMetadata(
					adminClient,
					auditLogId,
					message,
					delivery,
					"failed",
					getErrorMessage(error),
				);
			} catch {
				// Preserve the original delivery error for the admin response.
			}
		}

		if (error instanceof AdminMessageError) {
			return badRequest(error.message, error.status);
		}

		if (error instanceof Error && !(error as { status?: number }).status) {
			return Response.json({ message: error.message }, { status: 500 });
		}

		return adminErrorResponse(error);
	}
}
