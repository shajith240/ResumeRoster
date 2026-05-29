import { adminErrorResponse, requireAdmin } from "@/lib/admin";
import { enforceRateLimit } from "@/lib/rate-limit";
import { REVIEWER_FIELD_LIMITS, limitReviewerText } from "@/lib/reviewer-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminReviewerAction =
	| "approve_reviewer"
	| "reject_reviewer"
	| "reset_reviewer";

type RouteContext = {
	params: Promise<{ id: string }>;
};

const ACTIONS = new Set<AdminReviewerAction>([
	"approve_reviewer",
	"reject_reviewer",
	"reset_reviewer",
]);

function badRequest(message: string, status = 400) {
	return Response.json({ message }, { status });
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
		await enforceRateLimit(admin, {
			action: "admin_reviewer_action",
			limit: 120,
			request,
			userId: user.id,
			windowSeconds: 10 * 60,
		});

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

		const applicationUpdate = await admin.rpc(
			"admin_review_reviewer_application",
			{
				admin_user_id: user.id,
				reviewer_action: action,
				reviewer_admin_note: adminNote,
				target_application_id: applicationId,
			},
		);

		if (applicationUpdate.error) {
			console.error("Admin reviewer action RPC failed", applicationUpdate.error);
			throw new Error("admin-reviewer-action-failed");
		}

		const application = Array.isArray(applicationUpdate.data)
			? applicationUpdate.data[0]
			: applicationUpdate.data;

		if (!application) return badRequest("Application not found.", 404);

		return Response.json({
			application,
			status: "ok",
		});
	} catch (error) {
		if (error instanceof Error && !(error as { status?: number }).status) {
			return Response.json(
				{ message: "We could not update this reviewer application." },
				{ status: 500 },
			);
		}

		return adminErrorResponse(error);
	}
}
