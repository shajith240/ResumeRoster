import { adminErrorResponse, requireAdmin } from "@/lib/admin";
import { internalErrorResponse } from "@/lib/api-errors";
import { capturePrivateError } from "@/lib/monitoring/capture-errors";
import { getUserEmail, sendEmail } from "@/lib/email/send";
import { refundIssued, reviewerAssigned } from "@/lib/email/templates";
import { issueRazorpayRefund, PREMIUM_AMOUNT_PAISE } from "@/lib/razorpay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type _Action = "force_refund" | "assign_reviewer" | "retry_refund";

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { admin, user: adminUser } = await requireAdmin(request);
		const { id: resumeId } = await params;

		if (!UUID_PATTERN.test(resumeId)) {
			return Response.json({ message: "Resume not found." }, { status: 404 });
		}

		let body: Record<string, unknown>;
		try {
			body = await request.json();
		} catch {
			return Response.json({ message: "Invalid request body." }, { status: 400 });
		}

		const action = typeof body.action === "string" ? body.action : "";

		if (action === "force_refund") {
			// Fetch the resume — must be premium + paid.
			const { data: resume, error: fetchError } = await admin
				.from("resumes")
				.select("id,user_id,payment_id,payment_status,is_premium")
				.eq("id", resumeId)
				.maybeSingle();

			if (fetchError) throw new Error(fetchError.message);
			if (!resume) return Response.json({ message: "Resume not found." }, { status: 404 });
			if (!resume.is_premium) return Response.json({ message: "Not a premium resume." }, { status: 400 });
			if (resume.payment_status !== "paid") {
				return Response.json({ message: "Resume is not in a refundable state." }, { status: 409 });
			}

			// Update DB to refunded + clear reviewer assignment.
			const { error: updateError } = await admin
				.from("resumes")
				.update({
					payment_status: "refunded",
					assigned_reviewer_id: null,
					review_deadline: null,
				})
				.eq("id", resumeId)
				.eq("payment_status", "paid");

			if (updateError) throw new Error(updateError.message);

			// Audit log.
			void admin.from("moderation_actions").insert({
				action: "premium_refund_issued",
				admin_user_id: adminUser.id,
				target_type: "resume",
				target_id: resumeId,
				metadata: {
					candidate_id: resume.user_id,
					payment_id: resume.payment_id,
					trigger: "admin_force_refund",
					amount_paise: PREMIUM_AMOUNT_PAISE,
				},
				reason: "Admin-issued manual refund",
			});

			// Issue Razorpay refund if payment_id is present.
			if (resume.payment_id) {
				try {
					await issueRazorpayRefund(resume.payment_id, PREMIUM_AMOUNT_PAISE);
				} catch (refundError) {
					capturePrivateError(refundError, {
						area: "admin",
						operation: "force_refund_razorpay",
						resumeId,
						paymentId: resume.payment_id,
					});
					// DB is already updated — return success with a warning.
					return Response.json({
						ok: true,
						warning: "DB updated but Razorpay refund API call failed. Manual recovery required.",
					});
				}
			}

			// Email the candidate.
			void getUserEmail(admin, resume.user_id).then((email) => {
				if (!email) return;
				void sendEmail({ to: email, ...refundIssued(resumeId) });
			});

			return Response.json({ ok: true });
		}

		if (action === "assign_reviewer") {
			const reviewerId = typeof body.reviewer_id === "string" ? body.reviewer_id.trim() : "";
			if (!UUID_PATTERN.test(reviewerId)) {
				return Response.json({ message: "reviewer_id must be a valid UUID." }, { status: 400 });
			}

			// Verify the reviewer is a verified reviewer.
			const { data: reviewerProfile, error: profileError } = await admin
				.from("profiles")
				.select("id,community_role,reviewer_verification_status,reviewer_claim_suspended")
				.eq("id", reviewerId)
				.maybeSingle();

			if (profileError) throw new Error(profileError.message);
			if (!reviewerProfile) {
				return Response.json({ message: "Reviewer not found." }, { status: 404 });
			}
			if (reviewerProfile.reviewer_verification_status !== "verified") {
				return Response.json({ message: "This user is not a verified reviewer." }, { status: 400 });
			}

			// Fetch the resume to validate.
			const { data: resume, error: fetchError } = await admin
				.from("resumes")
				.select("id,user_id,payment_status,is_premium,status")
				.eq("id", resumeId)
				.maybeSingle();

			if (fetchError) throw new Error(fetchError.message);
			if (!resume) return Response.json({ message: "Resume not found." }, { status: 404 });
			if (!resume.is_premium || resume.payment_status !== "paid") {
				return Response.json({ message: "Resume must be a paid premium resume." }, { status: 400 });
			}
			if (resume.status !== "open") {
				return Response.json({ message: "Resume is not open for review." }, { status: 409 });
			}
			if (resume.user_id === reviewerId) {
				return Response.json({ message: "A reviewer cannot be assigned to their own resume." }, { status: 400 });
			}

			const { error: updateError } = await admin
				.from("resumes")
				.update({
					assigned_reviewer_id: reviewerId,
					review_deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
					premium_claimed_at: new Date().toISOString(),
				})
				.eq("id", resumeId);

			if (updateError) throw new Error(updateError.message);

			void admin.from("moderation_actions").insert({
				action: "admin_assign_reviewer",
				admin_user_id: adminUser.id,
				target_type: "resume",
				target_id: resumeId,
				metadata: { reviewer_id: reviewerId },
				reason: "Admin manual reviewer assignment",
			});

			// Notify the reviewer — they have a 24h clock running from this moment.
			void getUserEmail(admin, reviewerId).then((email) => {
				if (!email) return;
				void sendEmail({ to: email, ...reviewerAssigned(resumeId) });
			});

			return Response.json({ ok: true });
		}

		if (action === "retry_refund") {
			// For resumes where the Razorpay refund API call failed but the DB is already
			// marked refunded — re-attempt the refund using the payment_id on the resume.
			const { data: resume, error: fetchError } = await admin
				.from("resumes")
				.select("id,user_id,payment_id,payment_status,is_premium")
				.eq("id", resumeId)
				.maybeSingle();

			if (fetchError) throw new Error(fetchError.message);
			if (!resume) return Response.json({ message: "Resume not found." }, { status: 404 });
			if (!resume.is_premium) return Response.json({ message: "Not a premium resume." }, { status: 400 });
			if (!resume.payment_id) {
				return Response.json({ message: "No payment ID on this resume — cannot retry." }, { status: 409 });
			}

			await issueRazorpayRefund(resume.payment_id, PREMIUM_AMOUNT_PAISE);

			void admin.from("moderation_actions").insert({
				action: "premium_refund_retry_issued",
				admin_user_id: adminUser.id,
				target_type: "resume",
				target_id: resumeId,
				metadata: {
					candidate_id: resume.user_id,
					payment_id: resume.payment_id,
					trigger: "admin_retry_refund",
					amount_paise: PREMIUM_AMOUNT_PAISE,
				},
				reason: "Admin retried failed Razorpay refund",
			});

			return Response.json({ ok: true });
		}

		return Response.json({ message: "Unknown action." }, { status: 400 });
	} catch (error) {
		if (error instanceof Error && !(error as { status?: number }).status) {
			return internalErrorResponse(error, {
				context: { area: "admin", operation: "premium_resume_action", route: "POST /api/admin/premium-resumes/[id]" },
				publicMessage: "Premium resume action failed.",
			});
		}
		return adminErrorResponse(error);
	}
}
