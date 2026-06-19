import { NextResponse } from "next/server";
import { capturePrivateError } from "@/lib/monitoring/capture-errors";
import { getUserEmail, sendEmail } from "@/lib/email/send";
import { reviewerAssigned } from "@/lib/email/templates";
import { requireSignedInUser, serverAuthErrorResponse } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ClaimResult = {
	claimed: boolean;
	reason: string;
};

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	let signedIn: Awaited<ReturnType<typeof requireSignedInUser>>;
	try {
		signedIn = await requireSignedInUser(request, {
			missingTokenMessage: "Sign in to claim a review.",
			setupMessage: "Server claim setup is missing.",
		});
	} catch (error) {
		return serverAuthErrorResponse(error);
	}
	const { admin, user } = signedIn;
	const { id: resumeId } = await params;

	if (!resumeId) {
		return NextResponse.json({ message: "Resume ID is required." }, { status: 400 });
	}

	// Verify the user is an approved reviewer before hitting the DB.
	const profile = await admin
		.from("profiles")
		.select("community_role, reviewer_verification_status")
		.eq("id", user.id)
		.maybeSingle();

	if (profile.error) {
		capturePrivateError(profile.error, {
			area: "payments",
			operation: "claim_check_reviewer_profile",
			userId: user.id,
			resumeId,
		});
		return NextResponse.json(
			{ message: "Could not verify reviewer status." },
			{ status: 500 },
		);
	}

	const isReviewer =
		profile.data?.community_role === "reviewer" ||
		profile.data?.community_role === "both";
	const isVerified = profile.data?.reviewer_verification_status === "verified";

	if (!isReviewer) {
		return NextResponse.json(
			{ message: "You need to apply as a reviewer before claiming priority reviews." },
			{ status: 403 },
		);
	}

	if (!isVerified) {
		return NextResponse.json(
			{ message: "Your reviewer application is still pending admin approval." },
			{ status: 403 },
		);
	}

	// Atomic claim — the WHERE clause prevents race conditions.
	const result = await admin.rpc("claim_premium_resume", {
		p_resume_id: resumeId,
		p_reviewer_id: user.id,
	});

	const row = Array.isArray(result.data)
		? (result.data[0] as ClaimResult | undefined)
		: (result.data as ClaimResult | null);

	if (result.error) {
		capturePrivateError(result.error, {
			area: "payments",
			operation: "claim_premium_resume_rpc",
			userId: user.id,
			resumeId,
		});
		return NextResponse.json(
			{ message: "Claim failed. Please try again." },
			{ status: 500 },
		);
	}

	if (!row?.claimed) {
		return NextResponse.json(
			{ message: row?.reason ?? "This resume is no longer available for claiming." },
			{ status: 409 },
		);
	}

	// Send "you've been assigned" email — fire-and-forget, non-blocking.
	void getUserEmail(admin, user.id).then((email) => {
		if (!email) return;
		const tpl = reviewerAssigned(resumeId);
		void sendEmail({ to: email, ...tpl });
	});

	return NextResponse.json({ claimed: true });
}
