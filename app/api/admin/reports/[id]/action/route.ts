import { adminErrorResponse, requireAdmin } from "@/lib/admin";
import { internalErrorResponse } from "@/lib/api-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminReportAction =
	| "dismiss_report"
	| "mark_report_reviewing"
	| "mark_report_actioned"
	| "remove_roast"
	| "restore_roast"
	| "close_resume"
	| "reopen_resume"
	| "reset_reviewer_trust"
	| "clear_public_profile_text"
	| "clear_reviewer_profile"
	| "remove_community_post"
	| "restore_community_post"
	| "lock_community_post"
	| "unlock_community_post"
	| "remove_community_comment"
	| "restore_community_comment";

type AdminReportRpcResult = {
	error_code: string | null;
	ok: boolean;
	report: unknown | null;
};

type RouteContext = {
	params: Promise<{ id: string }>;
};

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ACTIONS = new Set<AdminReportAction>([
	"dismiss_report",
	"mark_report_reviewing",
	"mark_report_actioned",
	"remove_roast",
	"restore_roast",
	"close_resume",
	"reopen_resume",
	"reset_reviewer_trust",
	"clear_public_profile_text",
	"clear_reviewer_profile",
	"remove_community_post",
	"restore_community_post",
	"lock_community_post",
	"unlock_community_post",
	"remove_community_comment",
	"restore_community_comment",
]);

const RPC_FAILURES: Record<string, { message: string; status: number }> = {
	admin_user_required: {
		message: "Admin user is required.",
		status: 400,
	},
	invalid_action: {
		message: "Choose a valid admin action.",
		status: 400,
	},
	community_comment_not_found: {
		message: "Community comment not found.",
		status: 404,
	},
	community_comment_target_missing: {
		message: "This report has no community comment target.",
		status: 400,
	},
	community_post_not_found: {
		message: "Community post not found.",
		status: 404,
	},
	community_post_target_missing: {
		message: "This report has no community post target.",
		status: 400,
	},
	profile_not_found: {
		message: "Profile not found.",
		status: 404,
	},
	profile_target_missing: {
		message: "This report has no profile target.",
		status: 400,
	},
	report_not_found: {
		message: "Report not found.",
		status: 404,
	},
	restore_history_missing: {
		message: "This item cannot be restored from admin history.",
		status: 400,
	},
	resume_not_found: {
		message: "Resume not found.",
		status: 404,
	},
	resume_target_missing: {
		message: "This report has no resume target.",
		status: 400,
	},
	review_not_found: {
		message: "Review not found.",
		status: 404,
	},
	review_target_missing: {
		message: "This report has no review target.",
		status: 400,
	},
};

function badRequest(message: string, status = 400) {
	return Response.json({ message }, { status });
}

function actionFailure(error?: unknown, status = 500) {
	const publicMessage = "Moderation action failed. No changes were saved.";

	if (error) {
		return internalErrorResponse(error, {
			context: {
				area: "admin",
				operation: "apply_report_action",
				route: "POST /api/admin/reports/[id]/action",
			},
			publicMessage,
			status,
		});
	}

	return Response.json({ message: publicMessage }, { status });
}

function isUuid(value: string) {
	return UUID_PATTERN.test(value);
}

function firstRpcResult(
	data: AdminReportRpcResult[] | AdminReportRpcResult | null,
) {
	if (Array.isArray(data)) return data[0] ?? null;
	return data;
}

function rpcFailureResponse(code: string | null | undefined) {
	const failure = code ? RPC_FAILURES[code] : null;
	if (!failure) return actionFailure(new Error("Unknown report action RPC failure."));

	return badRequest(failure.message, failure.status);
}

function normalizeNote(value: unknown) {
	return typeof value === "string" ? value.trim().slice(0, 800) : "";
}

async function getPayload(request: Request) {
	try {
		return await request.json();
	} catch {
		return null;
	}
}

export async function POST(request: Request, context: RouteContext) {
	try {
		const { admin, user } = await requireAdmin(request);
		const { id: reportId } = await context.params;
		const payload = await getPayload(request);
		const action =
			typeof payload === "object" &&
			payload !== null &&
			"action" in payload &&
			typeof payload.action === "string"
				? payload.action
				: "";
		const note = normalizeNote(
			typeof payload === "object" && payload !== null && "note" in payload
				? payload.note
				: "",
		);

		if (!ACTIONS.has(action as AdminReportAction)) {
			return badRequest("Choose a valid admin action.");
		}

		if (!isUuid(reportId)) return badRequest("Report not found.", 404);

		const rpcResult = await admin.rpc("admin_apply_report_action", {
			moderation_note: note,
			report_action: action,
			reviewing_admin_user_id: user.id,
			target_report_id: reportId,
		});

		if (rpcResult.error) return actionFailure(rpcResult.error);

		const result = firstRpcResult(
			rpcResult.data as AdminReportRpcResult[] | AdminReportRpcResult | null,
		);

		if (!result) return actionFailure(new Error("Report action RPC returned no result."));
		if (!result.ok) return rpcFailureResponse(result.error_code);
		if (!result.report) {
			return actionFailure(new Error("Report action RPC returned no report."));
		}

		return Response.json({
			report: result.report,
			status: "ok",
		});
	} catch (error) {
		if (error instanceof Error && !(error as { status?: number }).status) {
			return actionFailure(error);
		}
		return adminErrorResponse(error);
	}
}
