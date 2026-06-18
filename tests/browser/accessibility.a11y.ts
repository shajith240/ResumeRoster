import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { prepareAuthenticatedPage } from "./helpers/supabase";

async function expectNoCriticalA11yViolations(pageName: string, page: Page) {
	const results = await new AxeBuilder({ page })
		.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
		.analyze();
	const criticalViolations = results.violations.filter(
		(violation) => violation.impact === "critical",
	);

	await test.info().attach(`${pageName}-axe-results.json`, {
		body: JSON.stringify(results.violations, null, 2),
		contentType: "application/json",
	});

	expect(criticalViolations).toEqual([]);
}

test("login has no critical automated WCAG violations", async ({ page }) => {
	await page.goto("/login");

	await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
	await expectNoCriticalA11yViolations("login", page);
});

test("authenticated resume feed has no critical automated WCAG violations", async ({
	page,
}) => {
	await prepareAuthenticatedPage(page);

	await page.goto("/feed");

	await expect(page.getByRole("heading", { name: "Resume Feed" })).toBeVisible();
	await expectNoCriticalA11yViolations("feed", page);
});
