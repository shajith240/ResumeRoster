import { adminErrorResponse, requireAdmin } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminReportAction =
	| "dismiss_report"
	| "mark_report_reviewing"
	| "mark_report_actioned"
	| "remove_roast"
	| "restore_roast"
	| "close_resume"
	| "reopen_resume";

type RouteContext = {
	params: Promise<{ id: string }>;
};

const ACTIONS = new Set<AdminReportAction>([
	"dismiss_report",
	"mark_report_reviewing",
	"mark_report_actioned",
	"remove_roast",
	"restore_roast",
	"close_resume",
	"reopen_resume",
]);

function badRequest(message: string, status = 400) {
	return Response.json({ message }, { status });
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

		const reportResult = await admin
			.from("content_reports")
			.select(
				"id,target_type,resume_id,roast_id,status,moderator_note,report_count",
			)
			.eq("id", reportId)
			.maybeSingle();

		if (reportResult.error) throw new Error(reportResult.error.message);
		if (!reportResult.data) return badRequest("Report not found.", 404);

		const report = reportResult.data;
		let targetType: "report" | "roast" | "resume" = "report";
		let targetId: string | null = report.id;
		let nextStatus: "pending" | "reviewing" | "dismissed" | "actioned" =
			report.status;
		let metadata: Record<string, unknown> = {};

		if (action === "dismiss_report") {
			nextStatus = "dismissed";
		}

		if (action === "mark_report_reviewing") {
			nextStatus = "reviewing";
		}

		if (action === "mark_report_actioned") {
			nextStatus = "actioned";
		}

		if (action === "remove_roast") {
			if (!report.roast_id) return badRequest("This report has no roast target.");
			targetType = "roast";
			targetId = report.roast_id;
			nextStatus = "actioned";

			const roastResult = await admin
				.from("roasts")
				.select("id,content,helpful_votes,dislike_count,is_deleted")
				.eq("id", report.roast_id)
				.maybeSingle();

			if (roastResult.error) throw new Error(roastResult.error.message);
			if (!roastResult.data) return badRequest("Roast not found.", 404);

			metadata = {
				previous_content: roastResult.data.content,
				previous_dislike_count: roastResult.data.dislike_count ?? 0,
				previous_helpful_votes: roastResult.data.helpful_votes ?? 0,
				was_deleted: Boolean(roastResult.data.is_deleted),
			};

			if (!roastResult.data.is_deleted) {
				const removeVotes = await admin
					.from("votes")
					.delete()
					.eq("roast_id", report.roast_id);
				if (removeVotes.error) throw new Error(removeVotes.error.message);

				const updateRoast = await admin
					.from("roasts")
					.update({
						content: "This roast was removed by moderation.",
						deleted_at: new Date().toISOString(),
						dislike_count: 0,
						helpful_votes: 0,
						is_deleted: true,
					})
					.eq("id", report.roast_id);
				if (updateRoast.error) throw new Error(updateRoast.error.message);
			}
		}

		if (action === "restore_roast") {
			if (!report.roast_id) return badRequest("This report has no roast target.");
			targetType = "roast";
			targetId = report.roast_id;
			nextStatus = "actioned";

			const latestRemoval = await admin
				.from("moderation_actions")
				.select("metadata")
				.eq("action", "remove_roast")
				.eq("target_type", "roast")
				.eq("target_id", report.roast_id)
				.order("created_at", { ascending: false })
				.limit(1)
				.maybeSingle();

			if (latestRemoval.error) throw new Error(latestRemoval.error.message);
			const previousContent =
				typeof latestRemoval.data?.metadata === "object" &&
				latestRemoval.data?.metadata !== null &&
				"previous_content" in latestRemoval.data.metadata &&
				typeof latestRemoval.data.metadata.previous_content === "string"
					? latestRemoval.data.metadata.previous_content
					: "";

			if (!previousContent) {
				return badRequest("This roast cannot be restored from admin history.");
			}

			const restoreRoast = await admin
				.from("roasts")
				.update({
					content: previousContent,
					deleted_at: null,
					is_deleted: false,
				})
				.eq("id", report.roast_id);

			if (restoreRoast.error) throw new Error(restoreRoast.error.message);
			metadata = { restored_content: true };
		}

		if (action === "close_resume" || action === "reopen_resume") {
			if (!report.resume_id) return badRequest("This report has no resume target.");
			targetType = "resume";
			targetId = report.resume_id;
			nextStatus = "actioned";

			const updateResume = await admin
				.from("resumes")
				.update({ status: action === "close_resume" ? "closed" : "open" })
				.eq("id", report.resume_id);

			if (updateResume.error) throw new Error(updateResume.error.message);
		}

		const updateReport = await admin
			.from("content_reports")
			.update({
				moderator_note: note || report.moderator_note,
				reviewed_at: new Date().toISOString(),
				reviewed_by: user.id,
				status: nextStatus,
			})
			.eq("id", report.id)
			.select("id,status")
			.single();

		if (updateReport.error) throw new Error(updateReport.error.message);

		const logResult = await admin.from("moderation_actions").insert({
			action,
			admin_user_id: user.id,
			metadata,
			reason: note,
			report_id: report.id,
			target_id: targetId,
			target_type: targetType,
		});

		if (logResult.error) throw new Error(logResult.error.message);

		return Response.json({
			report: updateReport.data,
			status: "ok",
		});
	} catch (error) {
		if (error instanceof Error && !(error as { status?: number }).status) {
			return Response.json({ message: error.message }, { status: 500 });
		}
		return adminErrorResponse(error);
	}
}
