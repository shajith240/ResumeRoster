import { adminErrorResponse, requireAdmin } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminUserAction =
	| "reset_reviewer_trust"
	| "clear_public_profile_text"
	| "clear_reviewer_profile";

type RouteContext = {
	params: Promise<{ id: string }>;
};

const ACTIONS = new Set<AdminUserAction>([
	"reset_reviewer_trust",
	"clear_public_profile_text",
	"clear_reviewer_profile",
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
		const { id: profileId } = await context.params;
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

		if (!ACTIONS.has(action as AdminUserAction)) {
			return badRequest("Choose a valid profile action.");
		}

		if (profileId === user.id) {
			return badRequest("Use another admin account before moderating yourself.", 403);
		}

		const profileResult = await admin
			.from("profiles")
			.select(
				"id,tagline,about,skills,community_role,reviewer_type,reviewer_headline,reviewer_bio,reviewer_expertise,reviewer_verification_status",
			)
			.eq("id", profileId)
			.maybeSingle();

		if (profileResult.error) throw new Error(profileResult.error.message);
		if (!profileResult.data) return badRequest("Profile not found.", 404);

		let profilePatch: Record<string, unknown> = {};

		if (action === "reset_reviewer_trust") {
			profilePatch = {
				reviewer_verification_status: "none",
				reviewer_verified_at: null,
				reviewer_verified_by: null,
			};
		}

		if (action === "clear_public_profile_text") {
			profilePatch = {
				about: null,
				skills: [],
				tagline: null,
			};
		}

		if (action === "clear_reviewer_profile") {
			profilePatch = {
				community_role: "candidate",
				reviewer_bio: null,
				reviewer_expertise: [],
				reviewer_headline: null,
				reviewer_type: null,
				reviewer_verification_status: "none",
				reviewer_verified_at: null,
				reviewer_verified_by: null,
			};
		}

		const updateProfile = await admin
			.from("profiles")
			.update(profilePatch)
			.eq("id", profileId)
			.select(
				"id,username,full_name,avatar_url,current_position,community_role,reviewer_type,reviewer_headline,reviewer_verification_status,roast_count,helpful_votes,created_at",
			)
			.single();

		if (updateProfile.error) throw new Error(updateProfile.error.message);

		const logResult = await admin.from("moderation_actions").insert({
			action,
			admin_user_id: user.id,
			metadata: { previous_profile: profileResult.data },
			reason: note,
			target_id: profileId,
			target_type: "profile",
		});

		if (logResult.error) throw new Error(logResult.error.message);

		return Response.json({
			profile: updateProfile.data,
			status: "ok",
		});
	} catch (error) {
		if (error instanceof Error && !(error as { status?: number }).status) {
			return Response.json({ message: error.message }, { status: 500 });
		}

		return adminErrorResponse(error);
	}
}
