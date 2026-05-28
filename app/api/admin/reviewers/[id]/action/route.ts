import { adminErrorResponse, requireAdmin } from "@/lib/admin";
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

		const applicationResult = await admin
			.from("reviewer_applications")
			.select(
				"id,user_id,requested_type,expertise,proof_url,note,status,admin_note,reviewed_by,reviewed_at,created_at,updated_at",
			)
			.eq("id", applicationId)
			.maybeSingle();

		if (applicationResult.error) {
			throw new Error(applicationResult.error.message);
		}
		if (!applicationResult.data) return badRequest("Application not found.", 404);

		const application = applicationResult.data;
		const now = new Date().toISOString();
		let nextStatus: "pending" | "approved" | "rejected" = "pending";
		let profilePatch: Record<string, unknown> = {};

		if (action === "approve_reviewer") {
			nextStatus = "approved";
			profilePatch = {
				reviewer_expertise: application.expertise ?? [],
				reviewer_type: application.requested_type,
				reviewer_verification_status: "verified",
				reviewer_verified_at: now,
				reviewer_verified_by: user.id,
			};
		}

		if (action === "reject_reviewer") {
			nextStatus = "rejected";
			profilePatch = {
				reviewer_verification_status: "rejected",
				reviewer_verified_at: null,
				reviewer_verified_by: null,
			};
		}

		if (action === "reset_reviewer") {
			nextStatus = "pending";
			profilePatch = {
				reviewer_verification_status: "pending",
				reviewer_verified_at: null,
				reviewer_verified_by: null,
			};
		}

		const [applicationUpdate, profileUpdate] = await Promise.all([
			admin
				.from("reviewer_applications")
				.update({
					admin_note: adminNote,
					reviewed_at: action === "reset_reviewer" ? null : now,
					reviewed_by: action === "reset_reviewer" ? null : user.id,
					status: nextStatus,
				})
				.eq("id", application.id)
				.select(
					"id,user_id,requested_type,expertise,proof_url,note,status,admin_note,reviewed_by,reviewed_at,created_at,updated_at",
				)
				.single(),
			admin.from("profiles").update(profilePatch).eq("id", application.user_id),
		]);

		if (applicationUpdate.error) {
			throw new Error(applicationUpdate.error.message);
		}
		if (profileUpdate.error) throw new Error(profileUpdate.error.message);

		const logResult = await admin.from("moderation_actions").insert({
			action,
			admin_user_id: user.id,
			metadata: {
				application_status: nextStatus,
				requested_type: application.requested_type,
				user_id: application.user_id,
			},
			reason: adminNote,
			target_id: application.id,
			target_type: "reviewer_application",
		});

		if (logResult.error) throw new Error(logResult.error.message);

		return Response.json({
			application: applicationUpdate.data,
			status: "ok",
		});
	} catch (error) {
		if (error instanceof Error && !(error as { status?: number }).status) {
			return Response.json({ message: error.message }, { status: 500 });
		}

		return adminErrorResponse(error);
	}
}
