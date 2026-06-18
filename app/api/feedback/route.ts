import { NextResponse } from "next/server";
import { getAnonymousProfileUsername } from "@/lib/anonymous-profile";
import { internalErrorResponse } from "@/lib/api-errors";
import { createServiceRoleClient } from "@/lib/server/supabase-admin";
import { enforceApiRateLimit } from "@/lib/server/rate-limit";
import { validateUserFeedbackPayload } from "@/lib/user-feedback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonResponse(message: string, status = 400) {
	return NextResponse.json({ message }, { status });
}

function getBearerToken(request: Request) {
	const authorization = request.headers.get("authorization") ?? "";
	const [scheme, token] = authorization.split(/\s+/);
	return /^bearer$/i.test(scheme) && token ? token : "";
}

async function readPayload(request: Request) {
	try {
		return await request.json();
	} catch {
		return null;
	}
}

async function ensureFeedbackProfile(
	admin: ReturnType<typeof createServiceRoleClient>,
	userId: string,
) {
	const existing = await admin
		.from("profiles")
		.select("id")
		.eq("id", userId)
		.maybeSingle();

	if (existing.error) throw new Error(existing.error.message);
	if (existing.data?.id) return;

	const insert = await admin.from("profiles").insert({
		id: userId,
		username: getAnonymousProfileUsername(userId),
	});

	if (insert.error && insert.error.code !== "23505") {
		throw new Error(insert.error.message);
	}
}

export async function POST(request: Request) {
	try {
		const admin = createServiceRoleClient();
		const token = getBearerToken(request);

		if (!token) return jsonResponse("Sign in to send feedback.", 401);

		const {
			data: { user },
			error: userError,
		} = await admin.auth.getUser(token);

		if (userError || !user) {
			return jsonResponse("Your session expired. Sign in again.", 401);
		}

		const rateLimitResponse = await enforceApiRateLimit(
			admin,
			user.id,
			"feedbackSubmit",
		);
		if (rateLimitResponse) return rateLimitResponse;

		const validation = validateUserFeedbackPayload(await readPayload(request));
		if (!validation.ok) return jsonResponse(validation.message);

		await ensureFeedbackProfile(admin, user.id);

		const feedback = validation.value;
		const userAgent = (request.headers.get("user-agent") ?? "").slice(0, 500);
		const { data, error } = await admin
			.from("user_feedback")
			.insert({
				body: feedback.body,
				category: feedback.category,
				metadata: feedback.metadata,
				source_path: feedback.sourcePath,
				title: feedback.title,
				user_agent: userAgent || null,
				user_id: user.id,
				viewport: feedback.viewport || null,
			})
			.select("id,status")
			.single();

		if (error) throw new Error(error.message);

		return NextResponse.json({
			feedback: data,
			status: "ok",
		});
	} catch (error) {
		return internalErrorResponse(error, {
			context: {
				area: "feedback",
				operation: "submit_user_feedback",
				route: "POST /api/feedback",
			},
			publicMessage: "Feedback could not be sent. Please try again.",
		});
	}
}
