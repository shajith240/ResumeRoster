import { NextResponse } from "next/server";
import { capturePrivateError } from "@/lib/monitoring/capture-errors";
import { requireSignedInUser, serverAuthErrorResponse } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_REVIEWER_TYPES = [
	"student",
	"placed_professional",
	"recruiter",
	"hiring_manager",
	"engineer",
	"designer",
	"product_manager",
	"career_coach",
	"founder",
	"other",
] as const;

type ReviewerType = (typeof VALID_REVIEWER_TYPES)[number];

function isValidReviewerType(value: unknown): value is ReviewerType {
	return VALID_REVIEWER_TYPES.includes(value as ReviewerType);
}

type RpcRow = { ok: boolean; error_code: string | null } | null | undefined;

const RPC_ERROR_MESSAGES: Record<string, string> = {
	profile_not_found: "Profile not found.",
	invalid_community_role: "Invalid community role.",
	invalid_reviewer_type: "Select a valid reviewer type.",
	too_many_expertise: "Too many expertise tags selected.",
	details_too_long: "One of your entries is too long.",
};

export async function POST(request: Request) {
	let signedIn: Awaited<ReturnType<typeof requireSignedInUser>>;
	try {
		signedIn = await requireSignedInUser(request, {
			missingTokenMessage: "Sign in to apply as a reviewer.",
			setupMessage: "Server reviewer-application setup is missing.",
		});
	} catch (error) {
		return serverAuthErrorResponse(error);
	}
	const { admin, user } = signedIn;

	let body: Record<string, unknown>;
	try {
		body = (await request.json()) as Record<string, unknown>;
	} catch {
		return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
	}

	const { reviewer_type, headline, proof_url, note } = body;

	if (!isValidReviewerType(reviewer_type)) {
		return NextResponse.json(
			{ message: "Select a valid reviewer type." },
			{ status: 400 },
		);
	}

	if (
		!headline ||
		typeof headline !== "string" ||
		headline.trim().length < 5
	) {
		return NextResponse.json(
			{ message: "Add a short headline (minimum 5 characters)." },
			{ status: 400 },
		);
	}

	const result = await admin.rpc("submit_reviewer_application", {
		target_user_id: user.id,
		requested_community_role: "reviewer",
		requested_reviewer_type: reviewer_type,
		requested_reviewer_headline: headline.trim().slice(0, 90),
		requested_proof_url:
			typeof proof_url === "string" ? proof_url.trim().slice(0, 240) : "",
		requested_note:
			typeof note === "string" ? note.trim().slice(0, 600) : "",
	});

	const row: RpcRow = Array.isArray(result.data)
		? (result.data[0] as RpcRow)
		: (result.data as RpcRow);

	if (result.error) {
		capturePrivateError(result.error, {
			area: "reviewer",
			operation: "submit_reviewer_application_rpc",
			userId: user.id,
		});
		return NextResponse.json(
			{ message: "Application submission failed. Please try again." },
			{ status: 500 },
		);
	}

	if (!row?.ok) {
		const errorCode = row?.error_code ?? "";
		return NextResponse.json(
			{ message: RPC_ERROR_MESSAGES[errorCode] ?? "Application submission failed." },
			{ status: 422 },
		);
	}

	return NextResponse.json({ applied: true });
}
