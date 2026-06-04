import { adminErrorResponse, requireAdmin } from "@/lib/admin";
import { validateAdminMessagePayload } from "@/lib/admin-messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProfileRecipientRow = {
	id: string;
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

function adminMessageFailure(status = 500) {
	return Response.json(
		{ message: "Admin message failed. No users were messaged." },
		{ status },
	);
}

function firstRpcResult(
	data: AdminSendMessageResult[] | AdminSendMessageResult | null,
) {
	if (Array.isArray(data)) return data[0] ?? null;
	return data;
}

async function getPayload(request: Request) {
	try {
		return await request.json();
	} catch {
		return null;
	}
}

export async function POST(request: Request) {
	try {
		const { admin, user } = await requireAdmin(request);
		const validation = validateAdminMessagePayload(await getPayload(request));

		if (!validation.ok) {
			return badRequest(validation.message);
		}

		const message = validation.value;

		if (message.target.mode === "user") {
			const { data, error } = await admin
				.from("profiles")
				.select("id")
				.eq("id", message.target.userId)
				.maybeSingle<ProfileRecipientRow>();

			if (error) return adminMessageFailure();
			if (!data) throw new AdminMessageError("User profile not found.", 404);
		}

		const sendResult = await admin.rpc("admin_send_message", {
			message_body: message.body,
			message_link_href: message.linkHref,
			message_request_id: message.requestId,
			message_title: message.title,
			sending_admin_email: user.email ?? null,
			sending_admin_user_id: user.id,
			target_mode: message.target.mode,
			target_user_id:
				message.target.mode === "user" ? message.target.userId : null,
		});

		if (sendResult.error) {
			return adminMessageFailure();
		}

		const delivery = firstRpcResult(
			sendResult.data as AdminSendMessageResult[] | null,
		);

		if (!delivery) {
			return adminMessageFailure();
		}

		if (
			delivery.delivery_status === "conflict" ||
			delivery.error_code === "request_id_reused"
		) {
			return badRequest(
				"This message request was already used. Reopen the message dialog and try again.",
				409,
			);
		}

		if (delivery.delivery_status !== "completed") {
			return adminMessageFailure();
		}

		return Response.json({
			auditLogId: delivery.audit_log_id,
			delivered: delivery.delivered_count,
			failed: delivery.failed_count,
			skipped: delivery.skipped_count,
			status: "ok",
			total: delivery.total_recipients,
		});
	} catch (error) {
		if (error instanceof AdminMessageError) {
			return badRequest(error.message, error.status);
		}

		if (error instanceof Error && !(error as { status?: number }).status) {
			return adminMessageFailure();
		}

		return adminErrorResponse(error);
	}
}
