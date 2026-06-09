import { randomUUID } from "node:crypto";
import { adminErrorResponse, requireAdmin } from "@/lib/admin";
import { internalErrorResponse } from "@/lib/api-errors";
import type {
	UserFeedbackPriority,
	UserFeedbackStatus,
} from "@/lib/supabase/types";
import {
	getFeedbackStatusForAction,
	isAdminFeedbackAction,
	isUserFeedbackPriority,
	USER_FEEDBACK_ADMIN_NOTE_MAX_LENGTH,
	USER_FEEDBACK_ADMIN_REPLY_MAX_LENGTH,
	type AdminFeedbackAction,
} from "@/lib/user-feedback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
	params: Promise<{ id: string }>;
};

type FeedbackTicket = {
	admin_note: string | null;
	admin_reply: string | null;
	assigned_admin_id: string | null;
	body: string;
	category: string;
	id: string;
	priority: UserFeedbackPriority;
	source_path: string | null;
	status: UserFeedbackStatus;
	title: string;
	user_id: string | null;
};

type AdminSendMessageResult = {
	audit_log_id: string;
	delivered_count: number;
	delivery_status: "completed" | "conflict" | "failed";
	error_code: "delivery_failed" | "request_id_reused" | null;
	failed_count: number;
	skipped_count: number;
	total_recipients: number;
};

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function badRequest(message: string, status = 400) {
	return Response.json({ message }, { status });
}

function isUuid(value: string) {
	return UUID_PATTERN.test(value);
}

function limitString(value: unknown, limit: number) {
	return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

async function getPayload(request: Request) {
	try {
		return await request.json();
	} catch {
		return null;
	}
}

function firstMessageResult(
	data: AdminSendMessageResult[] | AdminSendMessageResult | null,
) {
	if (Array.isArray(data)) return data[0] ?? null;
	return data;
}

function getAuditReason({
	action,
	note,
	priority,
	reply,
}: {
	action: AdminFeedbackAction;
	note: string;
	priority: UserFeedbackPriority | null;
	reply: string;
}) {
	if (action === "reply_feedback_ticket") return reply;
	if (action === "update_feedback_priority" && priority) {
		return `Priority changed to ${priority}.`;
	}
	return note;
}

export async function POST(request: Request, context: RouteContext) {
	try {
		const { admin, user } = await requireAdmin(request);
		const { id: feedbackId } = await context.params;
		if (!isUuid(feedbackId)) return badRequest("Feedback ticket not found.", 404);

		const payload = await getPayload(request);
		const action = (payload as { action?: unknown } | null)?.action;
		if (!isAdminFeedbackAction(action)) {
			return badRequest("Choose a valid feedback action.");
		}

		const note = limitString(
			(payload as { note?: unknown } | null)?.note,
			USER_FEEDBACK_ADMIN_NOTE_MAX_LENGTH,
		);
		const reply = limitString(
			(payload as { reply?: unknown } | null)?.reply,
			USER_FEEDBACK_ADMIN_REPLY_MAX_LENGTH,
		);
		const nextPriority = isUserFeedbackPriority(
			(payload as { priority?: unknown } | null)?.priority,
		)
			? ((payload as { priority: UserFeedbackPriority }).priority)
			: null;

		const ticketResult = await admin
			.from("user_feedback")
			.select(
				"id,user_id,category,priority,status,title,body,source_path,assigned_admin_id,admin_note,admin_reply",
			)
			.eq("id", feedbackId)
			.maybeSingle<FeedbackTicket>();

		if (ticketResult.error) throw new Error(ticketResult.error.message);
		if (!ticketResult.data) return badRequest("Feedback ticket not found.", 404);

		if (action === "update_feedback_priority" && !nextPriority) {
			return badRequest("Choose a valid priority.");
		}

		if (action === "reply_feedback_ticket") {
			if (!ticketResult.data.user_id) {
				return badRequest("This ticket no longer has a user to reply to.", 400);
			}
			if (reply.length < 10) {
				return badRequest("Write a useful reply before sending.");
			}

			const sendResult = await admin.rpc("admin_send_message", {
				message_body: reply,
				message_link_href: ticketResult.data.source_path || "/community",
				message_request_id: randomUUID(),
				message_title: "Reply from Linted",
				sending_admin_email: user.email ?? null,
				sending_admin_user_id: user.id,
				target_mode: "user",
				target_user_id: ticketResult.data.user_id,
			});

			if (sendResult.error) {
				throw new Error(sendResult.error.message);
			}

			const delivery = firstMessageResult(
				sendResult.data as AdminSendMessageResult[] | null,
			);
			if (!delivery || delivery.delivery_status !== "completed") {
				return badRequest("Admin reply could not be delivered.", 500);
			}
		}

		const nextStatus =
			action === "reply_feedback_ticket"
				? "needs_user_reply"
				: getFeedbackStatusForAction(action);
		const now = new Date().toISOString();
		const patch: Record<string, unknown> = {
			admin_note: note || ticketResult.data.admin_note,
			assigned_admin_id:
				action === "mark_feedback_reviewing"
					? user.id
					: ticketResult.data.assigned_admin_id,
			reviewed_at: now,
			reviewed_by: user.id,
		};

		if (nextStatus) {
			patch.status = nextStatus;
			patch.resolved_at =
				nextStatus === "resolved" || nextStatus === "closed" ? now : null;
		}

		if (nextPriority) {
			patch.priority = nextPriority;
		}

		if (action === "reply_feedback_ticket") {
			patch.admin_reply = reply;
		}

		const updateResult = await admin
			.from("user_feedback")
			.update(patch)
			.eq("id", feedbackId)
			.select(
				"id,user_id,category,priority,status,title,body,source_path,user_agent,viewport,metadata,assigned_admin_id,admin_note,admin_reply,reviewed_by,reviewed_at,resolved_at,created_at,updated_at",
			)
			.single();

		if (updateResult.error) throw new Error(updateResult.error.message);

		const auditResult = await admin.from("moderation_actions").insert({
			action,
			admin_user_id: user.id,
			metadata: {
				next_priority: nextPriority,
				next_status: nextStatus,
				previous_priority: ticketResult.data.priority,
				previous_status: ticketResult.data.status,
				replied: action === "reply_feedback_ticket",
			},
			reason: getAuditReason({ action, note, priority: nextPriority, reply }),
			target_id: feedbackId,
			target_type: "feedback",
		});

		if (auditResult.error) throw new Error(auditResult.error.message);

		return Response.json({
			feedback: updateResult.data,
			status: "ok",
		});
	} catch (error) {
		if (error instanceof Error && !(error as { status?: number }).status) {
			return internalErrorResponse(error, {
				context: {
					area: "admin",
					operation: "mutate_feedback",
					route: "POST /api/admin/feedback/[id]/action",
				},
				publicMessage: "Feedback action failed. No changes were saved.",
			});
		}

		return adminErrorResponse(error);
	}
}
