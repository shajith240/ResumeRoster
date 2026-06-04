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

	await page.goto("/feed");

	await expect(
		page.getByRole("heading", { name: "Community Lint Feed" }),
	).toBeVisible();
	await expect(
		page.getByRole("heading", { name: "Data Scientist or Analyst" }),
	).toBeVisible();
	await expectNoHorizontalOverflow(page);
	await expectVisibleWithinViewport(page, ".resume-card");
	await expectVisibleWithinViewport(page, ".feed-sortbar");

	const screenshot = await page.screenshot({ fullPage: false });
	expect(screenshot.byteLength).toBeGreaterThan(8_000);

	if (testInfo.project.name === "visual-mobile") {
		await expect(page.locator(".feed-right-rail")).toBeHidden();
		await expect(
			page.getByRole("navigation", { name: "Mobile navigation" }),
		).toBeVisible();
		await expect(page.locator(".session-sidebar")).toBeHidden();
		return;
	}

	await expect(page.locator(".feed-right-rail")).toBeVisible();
	await expect(page.locator(".session-sidebar")).toBeVisible();
});
