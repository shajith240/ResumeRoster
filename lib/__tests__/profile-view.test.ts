import { describe, expect, it, vi } from "vitest";
import { lintPoints } from "@/lib/leaderboard-ranking";
import type { PublicProfile } from "@/lib/supabase/types";

function profile(overrides: Partial<PublicProfile> = {}): PublicProfile {
	return {
		about: null,
		app_status: null,
		avatar_path: null,
		avatar_url: null,
		best_roast_count: 0,
		college: null,
		college_location: null,
		community_role: "candidate",
		created_at: "2026-06-10T00:00:00.000Z",
		current_position: null,
		full_name: "Profile Reviewer",
		helpful_votes: 0,
		id: "11111111-1111-4111-8111-111111111111",
		received_helpful_votes: 0,
		received_roast_count: 0,
		resume_highlight_id: null,
		resume_improvement: 0,
		resumes_roasted_count: 0,
		resumes_submitted_count: 0,
		review_credit_balance: 0,
		reviewer_bio: null,
		reviewer_expertise: null,
		reviewer_headline: null,
		reviewer_type: null,
		reviewer_verification_status: "none",
		reviewer_verified_at: null,
		reviewer_verified_by: null,
		roast_count: 0,
		roast_points: 0,
		skills: null,
		tagline: null,
		target_role: null,
		username: "profile-reviewer",
		...overrides,
	};
}

describe("profile view", () => {
	it("uses the same lint-point formula as the leaderboard", async () => {
		vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
		vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
		const { buildProfileView } = await import(
			"@/components/profile-detail/profile-view"
		);

		const view = buildProfileView(
			profile({
				helpful_votes: 3,
				roast_count: 4,
				roast_points: 999,
			}),
			[],
			[],
		);

		expect(view.lintPoints).toBe(lintPoints(3, 4));
	});
});
