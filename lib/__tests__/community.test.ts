import { describe, expect, it } from "vitest";
import {
	COMMUNITY_POSTS_FEATURE_FLAG,
	COMMUNITY_POST_TYPES,
	RESERVED_COMMUNITY_POST_TYPES,
	areCommunityPostsEnabled,
	isCommunityPostType,
	isReservedCommunityPostType,
	parseBooleanFeatureFlag,
} from "@/lib/community";

describe("community rollout controls", () => {
	it("keeps community posting disabled by default", () => {
		expect(areCommunityPostsEnabled({})).toBe(false);
		expect(parseBooleanFeatureFlag(undefined)).toBe(false);
		expect(parseBooleanFeatureFlag("maybe")).toBe(false);
		expect(parseBooleanFeatureFlag("maybe", true)).toBe(true);
	});

	it("enables community posting only for explicit truthy flag values", () => {
		expect(
			areCommunityPostsEnabled({
				[COMMUNITY_POSTS_FEATURE_FLAG]: "true",
			}),
		).toBe(true);
		expect(
			areCommunityPostsEnabled({
				[COMMUNITY_POSTS_FEATURE_FLAG]: " on ",
			}),
		).toBe(true);
		expect(
			areCommunityPostsEnabled({
				[COMMUNITY_POSTS_FEATURE_FLAG]: "0",
			}),
		).toBe(false);
	});

	it("locks the first public community post types", () => {
		expect(COMMUNITY_POST_TYPES).toEqual([
			"question",
			"discussion",
			"resource",
		]);
		expect(isCommunityPostType("question")).toBe(true);
		expect(isCommunityPostType("discussion")).toBe(true);
		expect(isCommunityPostType("resource")).toBe(true);
		expect(isCommunityPostType("announcement")).toBe(false);
		expect(isCommunityPostType("resume")).toBe(false);
	});

	it("keeps announcements reserved for a later admin-only release", () => {
		expect(RESERVED_COMMUNITY_POST_TYPES).toEqual(["announcement"]);
		expect(isReservedCommunityPostType("announcement")).toBe(true);
		expect(isReservedCommunityPostType("question")).toBe(false);
	});
});
