import { expect, test } from "@playwright/test";
import {
	expectNoHorizontalOverflow,
	prepareAuthenticatedPage,
} from "./helpers/supabase";

test("submit resume page uses no-card responsive form layout", async ({
	page,
}, testInfo) => {
	await prepareAuthenticatedPage(page);
	await page.goto("/submit", { waitUntil: "domcontentloaded" });
	await expectNoHorizontalOverflow(page);

	await expect(
		page.getByRole("heading", { name: "Submit Anonymously" }),
	).toBeVisible();

	const layoutMetrics = await page.evaluate(() => {
		const route = document.querySelector(".submit-route");
		const heading = document.querySelector(".submit-header h1");
		const form = document.querySelector(".submit-form");
		const firstColumn = document.querySelector(".submit-form-column");
		const contextColumn = document.querySelector(".submit-context-column");
		const privacyOptions = document.querySelector(".privacy-options");
		const selectedPrivacy = document.querySelector(".privacy-options label.selected");
		const submitButton = document.querySelector(".submit-button");
		const submitHint = document.querySelector(".submit-action-hint");
		const formStyle = form ? window.getComputedStyle(form) : null;
		const firstColumnStyle = firstColumn
			? window.getComputedStyle(firstColumn)
			: null;
		const selectedPrivacyBefore = selectedPrivacy
			? window.getComputedStyle(selectedPrivacy, "::before")
			: null;
		const routeRect = route?.getBoundingClientRect();
		const headingRect = heading?.getBoundingClientRect();
		const firstColumnRect = firstColumn?.getBoundingClientRect();
		const contextColumnRect = contextColumn?.getBoundingClientRect();
		const privacyOptionsRect = privacyOptions?.getBoundingClientRect();
		const submitButtonRect = submitButton?.getBoundingClientRect();
		const submitHintRect = submitHint?.getBoundingClientRect();

		return {
			contextTop: contextColumnRect?.top ?? 0,
			firstColumnTop: firstColumnRect?.top ?? 0,
			formBackground: formStyle?.backgroundColor ?? "",
			formBorderTopWidth: Number.parseFloat(formStyle?.borderTopWidth ?? "0"),
			headingLeft: headingRect?.left ?? 0,
			privacyOptionsTop: privacyOptionsRect?.top ?? 0,
			routeLeft: routeRect?.left ?? 0,
			sectionBorderTopWidth: Number.parseFloat(
				firstColumnStyle?.borderTopWidth ?? "0",
			),
			selectedPrivacyMarkerWidth: selectedPrivacyBefore?.width ?? "",
			submitButtonBottom: submitButtonRect?.bottom ?? 0,
			submitButtonTop: submitButtonRect?.top ?? 0,
			submitHintTop: submitHintRect?.top ?? 0,
		};
	});

	expect(layoutMetrics.formBackground).toBe("rgba(0, 0, 0, 0)");
	expect(layoutMetrics.formBorderTopWidth).toBe(0);
	expect(layoutMetrics.sectionBorderTopWidth).toBe(1);
	expect(Math.abs(layoutMetrics.headingLeft - layoutMetrics.routeLeft)).toBeLessThanOrEqual(1);
	expect(layoutMetrics.selectedPrivacyMarkerWidth).toBe("14px");
	expect(layoutMetrics.submitHintTop).toBeGreaterThan(layoutMetrics.submitButtonBottom);
	expect(layoutMetrics.submitHintTop - layoutMetrics.submitButtonBottom).toBeLessThanOrEqual(14);

	if (testInfo.project.name === "visual-mobile") {
		expect(layoutMetrics.contextTop).toBeGreaterThan(layoutMetrics.firstColumnTop);
		await expect(page.locator(".privacy-options label")).toHaveCount(3);
		return;
	}

	expect(Math.abs(layoutMetrics.contextTop - layoutMetrics.firstColumnTop)).toBeLessThanOrEqual(1);
	expect(Math.abs(layoutMetrics.submitButtonTop - layoutMetrics.privacyOptionsTop)).toBeLessThanOrEqual(4);
	await expect(page.locator(".privacy-options")).toBeVisible();
});
