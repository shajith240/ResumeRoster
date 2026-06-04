import {
	getReviewerApplicationIssue,
	isCommunityRole,
	isReviewerType,
	limitReviewerText,
	normalizeProofUrl,
	REVIEWER_FIELD_LIMITS,
} from "@/lib/reviewer-validation";
import { internalErrorResponse } from "@/lib/api-errors";
import { requireSignedInUser, serverAuthErrorResponse } from "@/lib/server-auth";
import { enforceApiRateLimit } from "@/lib/server/rate-limit";
import type { CommunityRole, ReviewerType } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReviewerApplicationRpcResult = {
	application: unknown | null;
	error_code: string | null;
	ok: boolean;
};

const RPC_FAILURES: Record<string, { message: string; status: number }> = {
	details_too_long: {
		message: "Reviewer application details are too long.",
		status: 400,
	},
	invalid_community_role: {
		message: "Choose how you want to participate.",
		status: 400,
	},
	invalid_reviewer_type: {
		message: "Choose a valid reviewer role.",
		status: 400,
	},
	profile_not_found: {
		message: "Profile not found.",
		status: 404,
	},
	profile_required: {
		message: "Profile is required.",
		status: 400,
	},
	too_many_expertise: {
		message: "Choose fewer expertise areas.",
		status: 400,
	},
};

function badRequest(message: string, status = 400) {
	return Response.json({ message }, { status });
}

function applicationFailure(error?: unknown, status = 500) {
	const publicMessage = "Reviewer application failed. No changes were saved.";

	if (error) {
		return internalErrorResponse(error, {
			context: {
				area: "reviewer_application",
				operation: "submit_reviewer_application",
				route: "POST /api/reviewer-application",
			},
			publicMessage,
			status,
		});
	}

	return Response.json({ message: publicMessage }, { status });
}

function firstRpcResult(
	data:
		| ReviewerApplicationRpcResult[]
		| ReviewerApplicationRpcResult
		| null,
) {
	if (Array.isArray(data)) return data[0] ?? null;
	return data;
}

function rpcFailureResponse(code: string | null | undefined) {
	const failure = code ? RPC_FAILURES[code] : null;
	if (!failure) {
		return applicationFailure(
			new Error("Unknown reviewer application RPC failure."),
		);
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

function getString(payload: Record<string, unknown>, key: string) {
	const value = payload[key];
	return typeof value === "string" ? value : "";
}

export async function POST(request: Request) {
	try {
		const { admin, user } = await requireSignedInUser(request);
		const payload = await getPayload(request);

		if (!payload || typeof payload !== "object") {
			return badRequest("Send reviewer application details.");
		}

		const record = payload as Record<string, unknown>;
		const communityRole = getString(record, "communityRole");
		const reviewerType = getString(record, "reviewerType");
		const proofUrl = normalizeProofUrl(getString(record, "proofUrl"));
		const note = limitReviewerText(
			getString(record, "note"),
			REVIEWER_FIELD_LIMITS.applicationNote,
		);
		const reviewerHeadline =
			limitReviewerText(
				getString(record, "reviewerHeadline"),
				REVIEWER_FIELD_LIMITS.headline,
			) || null;
		const reviewerBio =
			limitReviewerText(
				getString(record, "reviewerBio"),
				REVIEWER_FIELD_LIMITS.bio,
			) || null;
		const reviewerExpertise: string[] = [];

		if (!isCommunityRole(communityRole)) {
			return badRequest("Choose how you want to participate.");
		}

		if (!isReviewerType(reviewerType)) {
			return badRequest("Choose a valid reviewer role.");
		}

		const issue = getReviewerApplicationIssue({
			communityRole: communityRole as CommunityRole,
			note,
			proofUrl,
			reviewerType: reviewerType as ReviewerType,
		});

		if (issue) return badRequest(issue);

		const rateLimitResponse = await enforceApiRateLimit(
			admin,
			user.id,
			"reviewerApplicationSubmit",
		);
		if (rateLimitResponse) return rateLimitResponse;

		const applicationResult = await admin.rpc("submit_reviewer_application", {
			requested_community_role: communityRole,
			requested_expertise: reviewerExpertise,
			requested_note: note,
			requested_proof_url: proofUrl,
			requested_reviewer_bio: reviewerBio,
			requested_reviewer_headline: reviewerHeadline,
			requested_reviewer_type: reviewerType,
			target_user_id: user.id,
		});

		if (applicationResult.error) return applicationFailure(applicationResult.error);

		const result = firstRpcResult(
			applicationResult.data as
				| ReviewerApplicationRpcResult[]
				| ReviewerApplicationRpcResult
				| null,
		);

		if (!result) {
			return applicationFailure(
				new Error("Reviewer application RPC returned no result."),
			);
		}
		if (!result.ok) return rpcFailureResponse(result.error_code);
		if (!result.application) {
			return applicationFailure(
				new Error("Reviewer application RPC returned no application."),
			);
		}

		return Response.json({
			application: result.application,
			status: "ok",
		});
	} catch (error) {
		if (error instanceof Error && !(error as { status?: number }).status) {
			return applicationFailure(error);
		}

		return serverAuthErrorResponse(error);
	}
}
