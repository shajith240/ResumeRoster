import {
	cacheMentionSearchSuggestions,
	extractMentionHandlesFromTexts,
	getCachedMentionSearchSuggestions,
	mergeMentionSuggestions,
	normalizeMentionHandleList,
} from "@/lib/comment-mentions";
import { describe, expect, it } from "vitest";

describe("comment mention helpers", () => {
	it("extracts unique handles from visible comment text", () => {
		expect(
			extractMentionHandlesFromTexts([
				"Thanks @alice and @Bob.Builder.",
				"Looping @alice back in with @career-coach",
			]),
		).toEqual(["alice", "Bob.Builder", "career-coach"]);
	});

	it("normalizes raw handle lists without requiring @ prefixes", () => {
		expect(
			normalizeMentionHandleList(["@Alice", "alice", "Bob Smith", "bob_smith"]),
		).toEqual(["Alice", "BobSmith", "bob_smith"]);
	});

	it("merges local suggestions before remote suggestions by handle", () => {
		const local = [
			{
				displayName: "Alice Local",
				handle: "alice",
				id: "local-alice",
			},
		];
		const remote = [
			{
				displayName: "Alice Remote",
				handle: "alice",
				id: "remote-alice",
			},
			{
				displayName: "Blake Remote",
				handle: "blake",
				id: "remote-blake",
			},
		];

		expect(mergeMentionSuggestions(local, remote, 4)).toEqual([
			local[0],
			remote[1],
		]);
	});

	it("reuses cached broader prefixes for instant narrower searches", () => {
		const cachedSuggestions = [
			{
				displayName: "Shana Reviewer",
				handle: "shana",
				id: "user-shana",
			},
			{
				displayName: "Asha Mentor",
				handle: "asha",
				id: "user-asha",
			},
		];

		cacheMentionSearchSuggestions("sh", cachedSuggestions);

		expect(getCachedMentionSearchSuggestions("sha", 6)).toEqual({
			exact: false,
			suggestions: cachedSuggestions,
		});
		expect(getCachedMentionSearchSuggestions("sh", 6)).toEqual({
			exact: true,
			suggestions: cachedSuggestions,
		});
	});
});
