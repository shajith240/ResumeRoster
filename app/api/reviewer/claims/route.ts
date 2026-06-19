import { NextResponse } from "next/server";
import { capturePrivateError } from "@/lib/monitoring/capture-errors";
import { requireSignedInUser, serverAuthErrorResponse } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type ReviewerClaim = {
	id: string;
	user_id: string;
	title: string;
	post_description: string | null;
	review_deadline: string | null;
	premium_claimed_at: string | null;
	status: string;
	roast_count: number;
	has_review: boolean;
	author: {
		id: string;
		username: string | null;
		full_name: string | null;
		avatar_url: string | null;
	} | null;
};

export async function GET(request: Request) {
	let signedIn: Awaited<ReturnType<typeof requireSignedInUser>>;
	try {
		signedIn = await requireSignedInUser(request, {
			missingTokenMessage: "Sign in to view your reviewer queue.",
			setupMessage: "Server reviewer-queue setup is missing.",
		});
	} catch (error) {
		return serverAuthErrorResponse(error);
	}
	const { admin, user } = signedIn;

	const profileResult = await admin
		.from("profiles")
		.select("reviewer_verification_status")
		.eq("id", user.id)
		.maybeSingle();

	if (
		profileResult.error ||
		profileResult.data?.reviewer_verification_status !== "verified"
	) {
		return NextResponse.json(
			{ message: "Verified reviewer access required." },
			{ status: 403 },
		);
	}

	const { data: resumes, error: resumesError } = await admin
		.from("resumes")
		.select("id, user_id, title, post_description, review_deadline, premium_claimed_at, status, roast_count")
		.eq("assigned_reviewer_id", user.id)
		.eq("is_premium", true)
		.order("review_deadline", { ascending: true });

	if (resumesError) {
		capturePrivateError(resumesError, {
			area: "reviewer",
			operation: "fetch_reviewer_claims",
			userId: user.id,
		});
		return NextResponse.json(
			{ message: "Could not load your claims." },
			{ status: 500 },
		);
	}

	if (!resumes?.length) {
		return NextResponse.json({ claims: [] });
	}

	const userIds = [...new Set(resumes.map((r) => r.user_id))];
	const resumeIds = resumes.map((r) => r.id);

	const [profilesResult, reviewsResult] = await Promise.all([
		admin
			.from("profiles")
			.select("id, username, full_name, avatar_url")
			.in("id", userIds),
		admin
			.from("roasts")
			.select("resume_id")
			.eq("author_id", user.id)
			.eq("is_deleted", false)
			.in("resume_id", resumeIds),
	]);

	const profilesById = Object.fromEntries(
		(profilesResult.data ?? []).map((p) => [p.id, p]),
	);
	const reviewedSet = new Set(
		(reviewsResult.data ?? []).map((r) => r.resume_id),
	);

	const claims: ReviewerClaim[] = resumes.map((resume) => ({
		...resume,
		has_review: reviewedSet.has(resume.id),
		author: profilesById[resume.user_id] ?? null,
	}));

	return NextResponse.json({ claims });
}
