import {
	getReviewerApplicationIssue,
	isCommunityRole,
	isReviewerType,
	limitReviewerText,
	normalizeProofUrl,
	parseReviewerExpertise,
	REVIEWER_FIELD_LIMITS,
} from "@/lib/reviewer-validation";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requireSignedInUser, serverAuthErrorResponse } from "@/lib/server-auth";
import type { CommunityRole, ReviewerType } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function getString(payload: Record<string, unknown>, key: string) {
	const value = payload[key];
	return typeof value === "string" ? value : "";
}

export async function POST(request: Request) {
	try {
		const { admin, user } = await requireSignedInUser(request);
		await enforceRateLimit(admin, {
			action: "reviewer_application",
			limit: 8,
			request,
			userId: user.id,
			windowSeconds: 60 * 60,
		});

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
		const reviewerExpertise = parseReviewerExpertise(
			Array.isArray(record.reviewerExpertise)
				? record.reviewerExpertise.filter(
						(item): item is string => typeof item === "string",
					)
				: getString(record, "reviewerExpertise"),
		);

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

		if (applicationResult.error) {
			console.error("Reviewer application RPC failed", applicationResult.error);
			throw new Error("reviewer-application-failed");
		}

		const application = Array.isArray(applicationResult.data)
			? applicationResult.data[0]
			: applicationResult.data;

		return Response.json({
			application,
			status: "ok",
		});
	} catch (error) {
		if (error instanceof Error && !(error as { status?: number }).status) {
			return Response.json(
				{ message: "We could not send this application." },
				{ status: 500 },
			);
		}

		return serverAuthErrorResponse(error);
	}
}
