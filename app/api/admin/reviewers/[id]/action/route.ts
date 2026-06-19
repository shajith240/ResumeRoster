import { adminErrorResponse, requireAdmin } from "@/lib/admin";
import { internalErrorResponse } from "@/lib/api-errors";
import { getUserEmail, sendEmail } from "@/lib/email/send";
import { reviewerApproved, reviewerRejected } from "@/lib/email/templates";
import { REVIEWER_FIELD_LIMITS, limitReviewerText } from "@/lib/reviewer-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminReviewerAction =
	| "approve_reviewer"
	| "reject_reviewer"
	| "reset_reviewer";

type AdminReviewerRpcResult = {
	application: unknown | null;
	error_code: string | null;
	ok: boolean;
};

type RouteContext = {
	params: Promise<{ id: string }>;
};

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ACTIONS = new Set<AdminReviewerAction>([
	"approve_reviewer",
	"reject_reviewer",
	"reset_reviewer",
]);

const RPC_FAILURES: Record<string, { message: string; status: number }> = {
	admin_user_required: {
		message: "Admin user is required.",
		status: 400,
	},
	application_not_found: {
		message: "Application not found.",
		status: 404,
	},
	invalid_action: {
		message: "Choose a valid reviewer action.",
		status: 400,
	},
	profile_not_found: {
		message: "Profile not found.",
		status: 404,
	},
};

function badRequest(message: string, status = 400) {
	return Response.json({ message }, { status });
}

function actionFailure(error?: unknown, status = 500) {
	const publicMessage = "Reviewer action failed. No changes were saved.";

	if (error) {
		return internalErrorResponse(error, {
			context: {
				area: "admin",
				operation: "review_reviewer_application",
				route: "POST /api/admin/reviewers/[id]/action",
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
	data: AdminReviewerRpcResult[] | AdminReviewerRpcResult | null,
) {
	if (Array.isArray(data)) return data[0] ?? null;
	return data;
}

function rpcFailureResponse(code: string | null | undefined) {
	const failure = code ? RPC_FAILURES[code] : null;
	if (!failure) {
		return actionFailure(new Error("Unknown reviewer action RPC failure."));
	}

	return badRequest(failure.message, failure.status);
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
		const { id: applicationId } = await context.params;
		const payload = await getPayload(request);
		const action =
			typeof payload === "object" &&
			payload !== null &&
			"action" in payload &&
			typeof payload.action === "string"
				? payload.action
				: "";
		const adminNote = limitReviewerText(
			typeof payload === "object" &&
				payload !== null &&
				"adminNote" in payload &&
				typeof payload.adminNote === "string"
				? payload.adminNote
				: "",
			REVIEWER_FIELD_LIMITS.adminNote,
		);

		if (!ACTIONS.has(action as AdminReviewerAction)) {
			return badRequest("Choose a valid reviewer action.");
		}

		if (!isUuid(applicationId)) return badRequest("Application not found.", 404);

		const rpcResult = await admin.rpc("admin_review_reviewer_application", {
			reviewer_action: action,
			reviewer_admin_note: adminNote,
			reviewing_admin_user_id: user.id,
			target_application_id: applicationId,
		});

		if (rpcResult.error) return actionFailure(rpcResult.error);

		const result = firstRpcResult(
			rpcResult.data as AdminReviewerRpcResult[] | AdminReviewerRpcResult | null,
		);

		if (!result) {
			return actionFailure(new Error("Reviewer action RPC returned no result."));
		}
		if (!result.ok) return rpcFailureResponse(result.error_code);
		if (!result.application) {
			return actionFailure(new Error("Reviewer action RPC returned no application."));
		}

		// Send status email to the reviewer — fire-and-forget.
		const application = result.application as { user_id?: string } | null;
		if (application?.user_id && (action === "approve_reviewer" || action === "reject_reviewer")) {
			void getUserEmail(admin, application.user_id).then((email) => {
				if (!email) return;
				const tpl =
					action === "approve_reviewer"
						? reviewerApproved()
						: reviewerRejected(adminNote || undefined);
				void sendEmail({ to: email, ...tpl });
			});
		}

		return Response.json({
			application: result.application,
			status: "ok",
		});
	} catch (error) {
		if (error instanceof Error && !(error as { status?: number }).status) {
			return actionFailure(error);
		}

		return adminErrorResponse(error);
	}
}
