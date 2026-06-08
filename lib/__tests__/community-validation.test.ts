import { describe, expect, it } from "vitest";
import {
	COMMUNITY_POST_BODY_MAX_LENGTH,
	COMMUNITY_POST_TAG_MAX_COUNT,
	getCommunityPostIssue,
	parseCommunityTags,
} from "@/lib/community-validation";

describe("community post validation", () => {
	it("parses comma separated tags with trimming and dedupe", () => {
		expect(parseCommunityTags(" React, react, Next.js,  internships ")).toEqual([
			"React",
			"Next.js",
			"internships",
		]);
	});

	it("requires title, topic, and type", () => {
		expect(
			getCommunityPostIssue({
				body: "",
				postType: "question",
				tags: [],
				title: "",
				topicId: "",
			}),
		).toBe("Add a title.");

		expect(
			getCommunityPostIssue({
				body: "How should I prepare for this internship interview?",
				postType: "question",
				tags: [],
				title: "Interview prep",
				topicId: "",
			}),
		).toBe("Choose a topic.");

		expect(
			getCommunityPostIssue({
				body: "How should I prepare for this internship interview?",
				postType: "announcement",
				tags: [],
				title: "Interview prep",
				topicId: "topic-id",
			}),
		).toBe("Choose a valid post type.");
	});

	it("allows title-only posts", () => {
		expect(
			getCommunityPostIssue({
				body: "",
				postType: "question",
				tags: [],
				title: "Interview prep",
				topicId: "topic-id",
			}),
		).toBe("");
	});

	it("keeps the body and tag limits explicit", () => {
		expect(
			getCommunityPostIssue({
				body: "a".repeat(COMMUNITY_POST_BODY_MAX_LENGTH + 1),
				postType: "question",
				tags: [],
				title: "Interview prep",
				topicId: "topic-id",
			}),
		).toBe(`Keep the body under ${COMMUNITY_POST_BODY_MAX_LENGTH} characters.`);

		expect(
			getCommunityPostIssue({
				body: "How should I prepare for this internship interview?",
				postType: "question",
				tags: Array.from(
					{ length: COMMUNITY_POST_TAG_MAX_COUNT + 1 },
					(_, index) => `tag-${index}`,
				),
				title: "Interview prep",
				topicId: "topic-id",
			}),
		).toBe(`Use at most ${COMMUNITY_POST_TAG_MAX_COUNT} tags.`);

		expect(
			getCommunityPostIssue({
				body: "How should I prepare for this internship interview?",
				postType: "question",
				tags: ["a".repeat(41)],
				title: "Interview prep",
				topicId: "topic-id",
			}),
		).toBe("Keep each tag between 2 and 40 characters.");
	});
});
