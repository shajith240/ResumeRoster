import { expect, test } from "@playwright/test";
import {
	expectNoHorizontalOverflow,
	expectVisibleWithinViewport,
	prepareAuthenticatedPage,
} from "./helpers/supabase";

test("authenticated feed preserves responsive layout", async ({
	page,
}, testInfo) => {
	await prepareAuthenticatedPage(page);

	await page.goto("/feed", { waitUntil: "domcontentloaded" });

	await expect(page.getByRole("heading", { name: "Resume Feed" })).toBeVisible();
	await expect(
		page.getByRole("heading", { name: "Data Scientist or Analyst" }),
	).toBeVisible();
	await expectNoHorizontalOverflow(page);
	await expectVisibleWithinViewport(page, ".resume-card");
	await expectVisibleWithinViewport(page, ".feed-sortbar");
	await expect(page.locator(".feed-sortbar.pill-tabs")).toHaveCount(0);
	await expect(
		page.getByRole("button", { name: "Sort resumes by Best" }),
	).toBeVisible();

	const resumeFeedMetrics = await page.locator(".resume-card").first().evaluate(
		(element) => {
			const cardStyle = window.getComputedStyle(element);
			const separatorStyle = window.getComputedStyle(element, "::after");
			const authorAvatar = element.querySelector(".post-author-avatar");
			const authorAvatarRect = authorAvatar?.getBoundingClientRect();
			const reviewSummary = element.querySelector(".feed-review-summary");
			const reviewSummaryStyle = reviewSummary
				? window.getComputedStyle(reviewSummary)
				: null;
			const readCount = element.querySelector(".post-read-count");
			const actions = element.querySelector(".post-actions");
			const actionButton = element.querySelector(".post-action-button");
			const actionsStyle = actions ? window.getComputedStyle(actions) : null;
			const actionRect = actionButton?.getBoundingClientRect();

			return {
				actionButtonHeight: actionRect?.height ?? 0,
				actionButtonWidth: actionRect?.width ?? 0,
				actionsDisplay: actionsStyle?.display ?? "",
				authorAvatarHeight: authorAvatarRect?.height ?? 0,
				authorAvatarWidth: authorAvatarRect?.width ?? 0,
				cardBackground: cardStyle.backgroundColor,
				cardBorderBottomWidth: Number.parseFloat(cardStyle.borderBottomWidth),
				cardBorderRadius: cardStyle.borderRadius,
				cardBorderTopWidth: Number.parseFloat(cardStyle.borderTopWidth),
				cardBoxShadow: cardStyle.boxShadow,
				readCountAria: readCount?.getAttribute("aria-label") ?? "",
				readCountText: readCount?.textContent?.trim() ?? "",
				reviewSummaryBackground: reviewSummaryStyle?.backgroundColor ?? "",
				reviewSummaryPaddingTop: Number.parseFloat(
					reviewSummaryStyle?.paddingTop ?? "0",
				),
				separatorBackground: separatorStyle.backgroundColor,
				separatorHeight: Number.parseFloat(separatorStyle.height),
			};
		},
	);

	expect(resumeFeedMetrics.cardBorderBottomWidth).toBe(0);
	expect(resumeFeedMetrics.cardBorderTopWidth).toBe(0);
	expect(resumeFeedMetrics.cardBoxShadow).toBe("none");
	expect(resumeFeedMetrics.reviewSummaryBackground).toBe("rgba(0, 0, 0, 0)");
	expect(resumeFeedMetrics.reviewSummaryPaddingTop).toBe(0);
	expect(resumeFeedMetrics.actionsDisplay).toBe("flex");
	expect(resumeFeedMetrics.actionButtonHeight).toBeGreaterThanOrEqual(30);
	expect(resumeFeedMetrics.actionButtonHeight).toBeLessThanOrEqual(34);
	expect(resumeFeedMetrics.actionButtonWidth).toBeLessThan(160);
	expect(resumeFeedMetrics.authorAvatarWidth).toBeGreaterThanOrEqual(22);
	expect(resumeFeedMetrics.authorAvatarHeight).toBeGreaterThanOrEqual(22);
	expect(resumeFeedMetrics.readCountText).not.toContain("reads");
	expect(resumeFeedMetrics.readCountAria).toContain("reads");
	expect(resumeFeedMetrics.separatorHeight).toBe(1);
	expect(resumeFeedMetrics.separatorBackground).not.toBe("rgba(0, 0, 0, 0)");

	await page.getByRole("button", { name: "Sort resumes by Best" }).click();
	await page.getByRole("menuitem", { name: "New" }).click();
	await expect(page).toHaveURL(/\/feed\?sort=new$/);
	await expect(
		page.getByRole("button", { name: "Sort resumes by New" }),
	).toBeVisible();

	const screenshot = await page.screenshot({ fullPage: false });
	expect(screenshot.byteLength).toBeGreaterThan(8_000);

	if (testInfo.project.name === "visual-mobile") {
		await expect(page.locator(".app-header")).toBeHidden();
		await expect(page.locator(".feed-route-header")).toBeVisible();
		await expect(page.locator(".feed-right-rail")).toBeHidden();
		await expect(
			page.getByRole("navigation", { name: "Mobile navigation" }),
		).toBeVisible();
		await expect(page.locator(".session-sidebar")).toBeHidden();
		expect(resumeFeedMetrics.cardBackground).toBe("rgba(0, 0, 0, 0)");
		expect(resumeFeedMetrics.cardBorderRadius).toBe("0px");
		return;
	}

	await expect(page.locator(".feed-right-rail")).toBeVisible();
	await expect(page.locator(".session-sidebar")).toBeVisible();
	expect(resumeFeedMetrics.cardBackground).toBe("rgba(0, 0, 0, 0)");
	expect(resumeFeedMetrics.cardBorderRadius).toBe("0px");
});
