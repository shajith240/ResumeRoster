import { describe, expect, it } from "vitest";
import { getPrimaryNavigationItems } from "@/lib/primary-navigation";

function getIds(pathname: string, communityEnabled = true) {
	return getPrimaryNavigationItems({ communityEnabled, pathname }).map(
		(item) => item.id,
	);
}

describe("primary navigation", () => {
	it("exposes community routes in the primary mobile dock when enabled", () => {
		expect(getIds("/feed")).toEqual([
			"community",
			"feed",
			"submit",
			"community-new",
			"leaderboard",
		]);
	});

	it("keeps the dock valid when community posting is disabled", () => {
		expect(getIds("/feed", false)).toEqual([
			"feed",
			"submit",
			"leaderboard",
		]);
	});

	it("keeps admin out of the standard dock but available to admin chrome", () => {
		expect(getIds("/admin")).not.toContain("admin");

		expect(
			getPrimaryNavigationItems({
				communityEnabled: true,
				includeAdmin: true,
				isAdmin: true,
				pathname: "/admin",
			}).map((item) => item.id),
		).toContain("admin");
	});

	it("marks community feed and composer routes separately", () => {
		const resumeFeedItems = getPrimaryNavigationItems({
			communityEnabled: true,
			pathname: "/feed",
		});
		const detailItems = getPrimaryNavigationItems({
			communityEnabled: true,
			pathname: "/community/post-1",
		});
		const composeItems = getPrimaryNavigationItems({
			communityEnabled: true,
			pathname: "/community/new",
		});

		expect(resumeFeedItems.find((item) => item.id === "feed")).toMatchObject({
			active: true,
			label: "Resume Feed",
			mobileLabel: "Resume",
		});
		expect(resumeFeedItems.find((item) => item.id === "community")).toMatchObject(
			{
				label: "Community",
				mobileLabel: "Home",
			},
		);
		expect(detailItems.find((item) => item.id === "community")?.active).toBe(
			true,
		);
		expect(
			detailItems.find((item) => item.id === "community-new")?.active,
		).toBe(false);
		expect(composeItems.find((item) => item.id === "community")?.active).toBe(
			false,
		);
		expect(
			composeItems.find((item) => item.id === "community-new")?.active,
		).toBe(true);
	});
});
