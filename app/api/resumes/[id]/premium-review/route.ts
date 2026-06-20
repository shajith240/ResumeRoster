import { NextResponse } from "next/server";
import { capturePrivateError } from "@/lib/monitoring/capture-errors";
import { getUserEmail, sendEmail } from "@/lib/email/send";
import { premiumReviewPosted } from "@/lib/email/templates";
import { requireSignedInUser, serverAuthErrorResponse } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
	params: Promise<{ id: string }>;
};

type PremiumReviewPayload = {
	overallRating: number;
	overallImpression: string;
	clarityFeedback: string;
	impactFeedback: string;
	skillsGap: string;
	topChanges: string;
};

type ValidationResult =
	| { ok: true; payload: PremiumReviewPayload }
	| { ok: false; error: string };

function validatePayload(body: unknown): ValidationResult {
	if (typeof body !== "object" || body === null) {
		return { ok: false, error: "Invalid request body." };
	}

	const b = body as Record<string, unknown>;

	const rating = Number(b.overallRating);
	if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
		return { ok: false, error: "Overall rating must be a whole number between 1 and 5." };
	}

	const textFields: Array<[keyof Omit<PremiumReviewPayload, "overallRating">, string, number, number]> = [
		["overallImpression", "Overall impression", 20, 2000],
		["clarityFeedback", "Clarity feedback", 10, 2000],
		["impactFeedback", "Impact feedback", 10, 2000],
		["skillsGap", "Skills gap", 10, 2000],
		["topChanges", "Top changes", 10, 2000],
	];

	for (const [key, label, min, max] of textFields) {
		const value = typeof b[key] === "string" ? (b[key] as string).trim() : "";
		if (value.length < min) return { ok: false, error: `${label} must be at least ${min} characters.` };
		if (value.length > max) return { ok: false, error: `${label} must be under ${max} characters.` };
	}

	return {
		ok: true,
		payload: {
			overallRating: rating,
			overallImpression: (b.overallImpression as string).trim(),
			clarityFeedback: (b.clarityFeedback as string).trim(),
			impactFeedback: (b.impactFeedback as string).trim(),
			skillsGap: (b.skillsGap as string).trim(),
			topChanges: (b.topChanges as string).trim(),
		},
	};
}

const RATING_LABELS: Record<number, string> = {
	1: "Needs significant work",
	2: "Below average",
	3: "Average",
	4: "Good",
	5: "Excellent",
};

function formatAsMarkdown(payload: PremiumReviewPayload): string {
	const stars = "★".repeat(payload.overallRating) + "☆".repeat(5 - payload.overallRating);
	const ratingLabel = RATING_LABELS[payload.overallRating] ?? "";

	return [
		`### Priority Review`,
		``,
		`**Overall impression** ${stars} *(${ratingLabel})*`,
		payload.overallImpression,
		``,
		`**Clarity & formatting**`,
		payload.clarityFeedback,
		``,
		`**Impact statements — what's weak**`,
		payload.impactFeedback,
		``,
		`**Skills & keywords gap**`,
		payload.skillsGap,
		``,
		`**Top 3 actionable changes**`,
		payload.topChanges,
	].join("\n");
}

export async function POST(request: Request, context: RouteContext) {
	let signedIn: Awaited<ReturnType<typeof requireSignedInUser>>;
	try {
		signedIn = await requireSignedInUser(request, {
			missingTokenMessage: "Sign in to submit a premium review.",
			setupMessage: "Server setup is missing.",
		});
	} catch (error) {
		return serverAuthErrorResponse(error);
	}
	const { admin, user } = signedIn;
	const { id: resumeId } = await context.params;

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
	}

	const validation = validatePayload(body);
	if (!validation.ok) {
		return NextResponse.json({ message: validation.error }, { status: 400 });
	}
	const payload = validation.payload;

	// Verify the resume exists, is premium, and this user is the assigned reviewer.
	const resumeResult = await admin
		.from("resumes")
		.select("id,is_premium,payment_status,assigned_reviewer_id,status,user_id,review_deadline")
		.eq("id", resumeId)
		.maybeSingle();

	if (resumeResult.error) {
		capturePrivateError(resumeResult.error, {
			area: "payments",
			operation: "premium_review_fetch_resume",
			resumeId,
			userId: user.id,
		});
		return NextResponse.json({ message: "Could not load resume." }, { status: 500 });
	}

	const resume = resumeResult.data;

	if (!resume) {
		return NextResponse.json({ message: "Resume not found." }, { status: 404 });
	}

	if (!resume.is_premium || resume.payment_status !== "paid") {
		return NextResponse.json(
			{ message: "This resume is not eligible for a premium review." },
			{ status: 400 },
		);
	}

	if (resume.assigned_reviewer_id !== user.id) {
		return NextResponse.json(
			{ message: "You are not the assigned reviewer for this resume." },
			{ status: 403 },
		);
	}

	if (resume.status !== "open") {
		return NextResponse.json(
			{ message: "This resume is no longer accepting feedback." },
			{ status: 409 },
		);
	}

	if (resume.review_deadline && new Date(resume.review_deadline) < new Date()) {
		return NextResponse.json(
			{ message: "The review deadline for this resume has passed." },
			{ status: 409 },
		);
	}

	// Idempotency: one premium review per (resume, reviewer).
	const existing = await admin
		.from("premium_reviews")
		.select("id,roast_id")
		.eq("resume_id", resumeId)
		.eq("reviewer_id", user.id)
		.maybeSingle();

	if (existing.error) {
		capturePrivateError(existing.error, {
			area: "payments",
			operation: "premium_review_check_existing",
			resumeId,
			userId: user.id,
		});
	}

	if (existing.data) {
		return NextResponse.json(
			{ message: "You have already submitted a premium review for this resume." },
			{ status: 409 },
		);
	}

	// Create the roast entry so it appears in the review thread.
	const roastContent = formatAsMarkdown(payload);
	const roastResult = await admin
		.from("roasts")
		.insert({
			author_id: user.id,
			content: roastContent,
			content_format: "markdown",
			resume_id: resumeId,
		})
		.select("id")
		.single();

	if (roastResult.error) {
		capturePrivateError(roastResult.error, {
			area: "payments",
			operation: "premium_review_insert_roast",
			resumeId,
			userId: user.id,
		});
		return NextResponse.json(
			{ message: "Could not post your review. Please try again." },
			{ status: 500 },
		);
	}

	// Store the structured data linked to the roast.
	const structuredResult = await admin.from("premium_reviews").insert({
		clarity_feedback: payload.clarityFeedback,
		impact_feedback: payload.impactFeedback,
		overall_impression: payload.overallImpression,
		overall_rating: payload.overallRating,
		resume_id: resumeId,
		reviewer_id: user.id,
		roast_id: roastResult.data.id,
		skills_gap: payload.skillsGap,
		top_changes: payload.topChanges,
	});

	if (structuredResult.error) {
		capturePrivateError(structuredResult.error, {
			area: "payments",
			operation: "premium_review_insert_structured",
			resumeId,
			roastId: roastResult.data.id,
			userId: user.id,
		});
		// Roast is already posted — not a critical failure.
	}

	// Record payout owed to the reviewer — awaited because this is financial data.
	const payoutResult = await admin.from("reviewer_payouts").insert({
		reviewer_id: user.id,
		resume_id: resumeId,
	});
	if (payoutResult.error) {
		capturePrivateError(payoutResult.error, {
			area: "payments",
			operation: "premium_review_insert_payout",
			resumeId,
			userId: user.id,
		});
	}

	// Notify the resume owner — fire-and-forget.
	void getUserEmail(admin, resume.user_id).then((email) => {
		if (!email) return;
		const tpl = premiumReviewPosted(resumeId);
		void sendEmail({ to: email, ...tpl });
	});

	return NextResponse.json({ roastId: roastResult.data.id });
}
