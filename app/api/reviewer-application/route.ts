import {
	getReviewerApplicationIssue,
	isCommunityRole,
	isReviewerType,
	limitReviewerText,
	normalizeProofUrl,
	parseReviewerExpertise,
	REVIEWER_FIELD_LIMITS,
} from "@/lib/reviewer-validation";
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

		const profileUpdate = await admin
			.from("profiles")
			.update({
				community_role: communityRole,
				reviewer_bio: reviewerBio,
				reviewer_expertise: reviewerExpertise,
				reviewer_headline: reviewerHeadline,
				reviewer_type: reviewerType,
				reviewer_verification_status: "pending",
			})
			.eq("id", user.id);

		if (profileUpdate.error) throw new Error(profileUpdate.error.message);

		const applicationResult = await admin
			.from("reviewer_applications")
			.upsert(
				{
					admin_note: "",
					expertise: reviewerExpertise,
					note,
					proof_url: proofUrl,
					requested_type: reviewerType,
					reviewed_at: null,
					reviewed_by: null,
					status: "pending",
					user_id: user.id,
				},
				{ onConflict: "user_id" },
			)
			.select(
				"id,user_id,requested_type,expertise,proof_url,note,status,admin_note,reviewed_by,reviewed_at,created_at,updated_at",
			)
			.single();

		if (applicationResult.error) {
			throw new Error(applicationResult.error.message);
		}

		return Response.json({
			application: applicationResult.data,
			status: "ok",
		});
	} catch (error) {
		if (error instanceof Error && !(error as { status?: number }).status) {
			return Response.json({ message: error.message }, { status: 500 });
		}

		return serverAuthErrorResponse(error);
	}
}
